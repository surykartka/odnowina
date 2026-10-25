// Vercel serverless function — registers a card payment transaction with Przelewy24.
// Required env vars: P24_MERCHANT_ID, P24_POS_ID (defaults to P24_MERCHANT_ID), P24_API_KEY, P24_CRC, P24_SANDBOX, SITE_URL

const crypto = require('crypto');
const { createOrder } = require('../lib/orders');

const SHIPPING_FEE_GR = 1399; // 13.99 zł paczkomat, in groszy
const FREE_SHIPPING_FROM_GR = 15000; // 150 zł

function p24BaseUrl() {
  return process.env.P24_SANDBOX === 'true'
    ? 'https://sandbox.przelewy24.pl'
    : 'https://secure.przelewy24.pl';
}

function sign(fields) {
  return crypto.createHash('sha384').update(JSON.stringify(fields)).digest('hex');
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

    const merchantId = Number(process.env.P24_MERCHANT_ID);
    const posId = Number(process.env.P24_POS_ID || process.env.P24_MERCHANT_ID);
    const apiKey = process.env.P24_API_KEY;
    const crc = process.env.P24_CRC;
    const siteUrl = process.env.SITE_URL;

    if (!merchantId || !apiKey || !crc || !siteUrl) {
      res.status(500).json({ error: 'Płatności nie są jeszcze skonfigurowane na serwerze (brak zmiennych środowiskowych Przelewy24). Patrz SETUP.md.' });
      return;
    }

    const sessionId = `odnowina_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const registerSign = sign({ sessionId, merchantId, amount: amountGr, currency: 'PLN', crc });

    const lockerLabel = `${locker.name}${locker.address ? ' – ' + locker.address : ''}`;

    const payload = {
      merchantId,
      posId,
      sessionId,
      amount: amountGr,
      currency: 'PLN',
      description: `Zamówienie Odnowina (${items.reduce((n, i) => n + i.qty, 0)} szt.) – odbiór: ${lockerLabel}`,
      email: customer.email,
      client: customer.name,
      phone: (customer.phone || '').replace(/\s+/g, ''),
      country: 'PL',
      language: 'pl',
      urlReturn: `${siteUrl}/platnosc-potwierdzenie.html?sessionId=${encodeURIComponent(sessionId)}`,
      urlStatus: `${siteUrl}/api/p24-webhook`,
      shipping: shippingGr,
      sign: registerSign,
    };

    const response = await fetch(`${p24BaseUrl()}/api/v1/transaction/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${posId}:${apiKey}`).toString('base64'),
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok || data.responseCode !== 0 || !data.data || !data.data.token) {
      res.status(502).json({ error: 'Rejestracja transakcji w Przelewy24 nie powiodła się.', details: data });
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
      redirectUrl: `${p24BaseUrl()}/trnRequest/${data.data.token}`,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Nieznany błąd przy rejestracji płatności.' });
  }
};
