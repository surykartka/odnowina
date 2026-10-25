// Thin wrapper around the Resend email API (https://api.resend.com).
// Required env vars: RESEND_API_KEY, RESEND_FROM (e.g. "Odnowina <rezerwacje@twojadomena.pl>")
// If RESEND_API_KEY is not set, sendEmail() is a no-op (booking still succeeds without email).

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    console.log('(Resend nieskonfigurowany — pomijam wysyłkę e-maila)', { to, subject });
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error('Resend: wysyłka e-maila nie powiodła się', response.status, details);
  }
}

module.exports = { sendEmail };
