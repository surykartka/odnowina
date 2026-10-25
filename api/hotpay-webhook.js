// Vercel serverless function — receives HotPay's payment notification (POST
// multipart/form-data to the URL configured in the HotPay panel for this
// service) and verifies it by recomputing the HASH. This is the authoritative
// payment confirmation; the browser redirect to ADRES_WWW is only a UX hint.
//
// HotPay sends multipart/form-data, which Vercel does not auto-parse into
// req.body, so we read the raw request stream with busboy instead.

const crypto = require('crypto');
const Busboy = require('busboy');
const { getOrder, updateOrder } = require('../lib/orders');
const { sendEmail } = require('../lib/resend');

function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({ headers: req.headers });
    const fields = {};
    busboy.on('field', (name, value) => {
      fields[name] = value;
    });
    busboy.on('finish', () => resolve(fields));
    busboy.on('error', reject);
    req.pipe(busboy);
  });
}

function sign(password, amount, paymentId, orderId, status, secure, secret) {
  return crypto
    .createHash('sha256')
    .update(`${password};${amount};${paymentId};${orderId};${status};${secure};${secret}`)
    .digest('hex');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).end();
    return;
  }

  try {
    const fields = await parseMultipart(req);
    const { SEKRET, KWOTA, STATUS, ID_ZAMOWIENIA: sessionId, ID_PLATNOSCI: paymentId, SECURE, HASH } = fields;

    if (!SEKRET || !KWOTA || !STATUS || !sessionId || !paymentId || !SECURE || !HASH) {
      res.status(400).end();
      return;
    }

    const sekret = process.env.HOTPAY_SEKRET;
    const password = process.env.HOTPAY_PASSWORD;

    if (SEKRET !== sekret) {
      console.error(`HotPay webhook: nieznany SEKRET sessionId=${sessionId}`);
      res.status(400).end();
      return;
    }

    const expectedHash = sign(password, KWOTA, paymentId, sessionId, STATUS, SECURE, sekret);
    if (expectedHash !== HASH) {
      console.error(`HotPay webhook: nieprawidłowy HASH sessionId=${sessionId} orderId=${paymentId}`);
      res.status(400).end();
      return;
    }

    if (STATUS !== 'SUCCESS') {
      // PENDING / FAILURE — nothing to confirm yet, acknowledge and wait for the next notification.
      res.status(200).end('OK');
      return;
    }

    // Authoritative confirmation that the payment succeeded.
    console.log(`✅ Zamówienie opłacone — sessionId=${sessionId} orderId=${paymentId} kwota=${KWOTA} PLN`);

    const order = await getOrder(sessionId);
    // HotPay may retry this webhook; only send confirmation e-mails once.
    if (order && order.status !== 'paid') {
      const updated = await updateOrder(sessionId, {
        status: 'paid',
        paidAt: new Date().toISOString(),
        hotpayPaymentId: paymentId,
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

    res.status(200).end('OK');
  } catch (err) {
    console.error('HotPay webhook error', err);
    res.status(500).end();
  }
};
