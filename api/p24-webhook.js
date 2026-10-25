// Vercel serverless function — receives Przelewy24's payment notification (urlStatus)
// and confirms it by calling transaction/verify. This is the authoritative payment
// confirmation; the browser redirect to urlReturn is only a UX hint.

const crypto = require('crypto');
const { getOrder, updateOrder } = require('../lib/orders');
const { sendEmail } = require('../lib/resend');

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
    res.status(405).end();
    return;
  }

  try {
    const { sessionId, orderId, amount, currency } = req.body || {};

    if (!sessionId || !orderId || !amount || !currency) {
      res.status(400).end();
      return;
    }

    const merchantId = Number(process.env.P24_MERCHANT_ID);
    const posId = Number(process.env.P24_POS_ID || process.env.P24_MERCHANT_ID);
    const apiKey = process.env.P24_API_KEY;
    const crc = process.env.P24_CRC;

    const verifySign = sign({ sessionId, orderId, amount, currency, crc });

    const verifyRes = await fetch(`${p24BaseUrl()}/api/v1/transaction/verify`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${posId}:${apiKey}`).toString('base64'),
      },
      body: JSON.stringify({ merchantId, posId, sessionId, amount, currency, orderId, sign: verifySign }),
    });

    const verifyData = await verifyRes.json();

    if (!verifyRes.ok || verifyData.responseCode !== 0) {
      console.error(`P24 webhook: weryfikacja nieudana sessionId=${sessionId} orderId=${orderId}`, verifyData);
      res.status(400).end();
      return;
    }

    // Authoritative confirmation that the card payment succeeded.
    console.log(`✅ Zamówienie opłacone — sessionId=${sessionId} orderId=${orderId} kwota=${amount / 100} ${currency}`);

    const order = await getOrder(sessionId);
    // P24 may retry this webhook; only send confirmation e-mails once.
    if (order && order.status !== 'paid') {
      const updated = await updateOrder(sessionId, {
        status: 'paid',
        paidAt: new Date().toISOString(),
        p24OrderId: orderId,
      });

      const itemsHtml = updated.items
        .map((i) => `<li>${i.name} x${i.qty} — ${(i.price * i.qty).toFixed(2)} zł</li>`)
        .join('');
      const totalZl = (updated.amountGr / 100).toFixed(2);
      const lockerLabel = `${updated.locker.name}${updated.locker.address ? ' – ' + updated.locker.address : ''}`;

      await sendEmail({
        to: updated.customer.email,
        subject: 'Potwierdzenie zamówienia — Odnowina',
        html: `
          <p>Dzień dobry ${updated.customer.name},</p>
          <p>Twoja płatność została zaksięgowana. Zamówienie jest w przygotowaniu.</p>
          <ul>${itemsHtml}</ul>
          <p><strong>Razem:</strong> ${totalZl} zł</p>
          <p><strong>Odbiór:</strong> paczkomat InPost — ${lockerLabel}</p>
          <p>Numer zamówienia: ${sessionId}</p>
        `,
      });

      if (process.env.OWNER_EMAIL) {
        await sendEmail({
          to: process.env.OWNER_EMAIL,
          subject: `Nowe opłacone zamówienie — ${totalZl} zł`,
          html: `
            <p>Nowe opłacone zamówienie (${sessionId}):</p>
            <p><strong>Klient:</strong> ${updated.customer.name} — ${updated.customer.email} — ${updated.customer.phone}</p>
            <ul>${itemsHtml}</ul>
            <p><strong>Razem:</strong> ${totalZl} zł</p>
            <p><strong>Odbiór:</strong> paczkomat InPost — ${lockerLabel}</p>
          `,
        });
      }
    }

    res.status(200).end();
  } catch (err) {
    console.error('P24 webhook error', err);
    res.status(500).end();
  }
};
