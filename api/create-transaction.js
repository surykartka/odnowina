// Vercel serverless function — registers a card payment transaction with HotPay
// (Przelewy, "advanced API with validation", TYP=INIT — see dokumentacja.hotpay.pl).
// Required env vars: HOTPAY_SEKRET, HOTPAY_PASSWORD, SITE_URL
//
// The notification URL below (SITE_URL + /api/hotpay-webhook) must also be
// pasted into the HotPay panel for this service — unlike Przelewy24, HotPay
// does not accept urlStatus per-request.

const crypto = require('crypto');
const { createOrder } = require('../lib/orders');

const SHIPPING_FEE_GR = 1399; // 13.99 zł paczkomat, in groszy
const FREE_SHIPPING_FROM_GR = 15000; // 150 zł

const HOTPAY_URL = 'https://platnosc.hotpay.pl/';

function sign(password, amountZl, serviceName, returnUrl, orderId, secret) {
  return crypto
    .createHash('sha256')
    .update(`${password};${amountZl};${serviceName};${returnUrl};${orderId};${secret}`)
    .digest('hex');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { items, customer, locker } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Koszyk jest pusty.' });
      return;
    }
    if (!customer || !customer.email || !customer.name) {
      res.status(400).json({ error: 'Podaj imię i nazwisko oraz adres e-mail.' });
      return;
    }
    if (!locker || !locker.name) {
      res.status(400).json({ error: 'Wybierz paczkomat InPost.' });
      return;
    }

    const subtotalGr = items.reduce((sum, item) => {
      const price = Number(item.price);
      const qty = Number(item.qty);
      if (!Number.isFinite(price) || price <= 0 || !Number.isInteger(qty) || qty <= 0) {
        throw new Error('Nieprawidłowe dane produktu w koszyku.');
      }
      return sum + Math.round(price * 100) * qty;
    }, 0);

    const shippingGr = subtotalGr >= FREE_SHIPPING_FROM_GR ? 0 : SHIPPING_FEE_GR;
    const amountGr = subtotalGr + shippingGr;

    const sekret = process.env.HOTPAY_SEKRET;
    const password = process.env.HOTPAY_PASSWORD;
    const siteUrl = process.env.SITE_URL;

    if (!sekret || !password || !siteUrl) {
      res.status(500).json({ error: 'Płatności nie są jeszcze skonfigurowane na serwerze (brak zmiennych środowiskowych HotPay). Patrz SETUP.md.' });
      return;
    }

    const sessionId = `odnowina_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const lockerLabel = `${locker.name}${locker.address ? ' – ' + locker.address : ''}`;
    const serviceName = `Zamówienie Odnowina (${items.reduce((n, i) => n + i.qty, 0)} szt.) – odbiór: ${lockerLabel}`;
    const returnUrl = `${siteUrl}/platnosc-potwierdzenie.html?sessionId=${encodeURIComponent(sessionId)}`;
    const amountZl = (amountGr / 100).toFixed(2);

    const form = new FormData();
    form.append('SEKRET', sekret);
    form.append('KWOTA', amountZl);
    form.append('NAZWA_USLUGI', serviceName);
    form.append('ADRES_WWW', returnUrl);
    form.append('ID_ZAMOWIENIA', sessionId);
    form.append('TYP', 'INIT');
    form.append('EMAIL', customer.email);
    form.append('HASH', sign(password, amountZl, serviceName, returnUrl, sessionId, sekret));

    const response = await fetch(HOTPAY_URL, { method: 'POST', body: form });
    const data = await response.json();

    if (!response.ok || !data.STATUS || !data.URL) {
      res.status(502).json({ error: 'Rejestracja transakcji w HotPay nie powiodła się.', details: data });
      return;
    }

    await createOrder({
      sessionId,
      items: items.map((item) => ({ name: item.name, price: Number(item.price), qty: Number(item.qty) })),
      customer: { name: customer.name, email: customer.email, phone: customer.phone || '' },
      locker,
      subtotalGr,
      shippingGr,
      amountGr,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    res.status(200).json({
      sessionId,
      amountGr,
      redirectUrl: data.URL,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Nieznany błąd przy rejestracji płatności.' });
  }
};
