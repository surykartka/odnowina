const crypto = require('crypto');
const { sendEmail } = require('../lib/resend');
const { SLOTS, LOCATIONS, locationForDate, isValidDateStr, reserveSlot, saveBooking } = require('../lib/booking');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { location, date, time, service, customer, notes } = req.body || {};

    if (!location || !LOCATIONS[location]) {
      res.status(400).json({ error: 'Nieznana lokalizacja.' });
      return;
    }
    if (!date || !isValidDateStr(date)) {
      res.status(400).json({ error: 'Nieprawidłowa data.' });
      return;
    }
    if (locationForDate(date) !== location) {
      res.status(400).json({ error: 'Ta lokalizacja nie działa w wybranym dniu.' });
      return;
    }
    if (!time || SLOTS.indexOf(time) === -1) {
      res.status(400).json({ error: 'Nieprawidłowa godzina.' });
      return;
    }
    if (!service) {
      res.status(400).json({ error: 'Wybierz zabieg.' });
      return;
    }
    if (!customer || !customer.name || !customer.email || !customer.phone) {
      res.status(400).json({ error: 'Podaj imię i nazwisko, e-mail oraz telefon.' });
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (date < todayStr) {
      res.status(400).json({ error: 'Nie można zarezerwować terminu w przeszłości.' });
      return;
    }

    const bookingId = `bk_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const loc = LOCATIONS[location];

    const record = {
      bookingId,
      location,
      date,
      time,
      service,
      customer: { name: customer.name, email: customer.email, phone: customer.phone },
      notes: notes || '',
      status: 'confirmed',
      createdAt: new Date().toISOString(),
    };

    const reserved = await reserveSlot(location, date, time, bookingId);
    if (!reserved) {
      res.status(409).json({ error: 'Ten termin został już zarezerwowany. Wybierz inny.' });
      return;
    }
    await saveBooking(record);

    const whenLabel = `${date} o ${time}`;

    await sendEmail({
      to: customer.email,
      subject: 'Potwierdzenie rezerwacji — Odnowina',
      html: `
        <p>Dzień dobry ${customer.name},</p>
        <p>Twoja rezerwacja została potwierdzona:</p>
        <ul>
          <li><strong>Zabieg:</strong> ${service}</li>
          <li><strong>Lokalizacja:</strong> ${loc.name} (${loc.address})</li>
          <li><strong>Termin:</strong> ${whenLabel}</li>
        </ul>
        <p>Numer rezerwacji: ${bookingId}</p>
        <p>Do zobaczenia!</p>
      `,
    });

    if (process.env.OWNER_EMAIL) {
      await sendEmail({
        to: process.env.OWNER_EMAIL,
        subject: `Nowa rezerwacja — ${loc.name}, ${whenLabel}`,
        html: `
          <p>Nowa rezerwacja (${bookingId}):</p>
          <ul>
            <li><strong>Klient:</strong> ${customer.name} — ${customer.email} — ${customer.phone}</li>
            <li><strong>Zabieg:</strong> ${service}</li>
            <li><strong>Lokalizacja:</strong> ${loc.name}</li>
            <li><strong>Termin:</strong> ${whenLabel}</li>
            <li><strong>Uwagi:</strong> ${notes || '—'}</li>
          </ul>
        `,
      });
    }

    res.status(200).json({ bookingId, location, locationName: loc.name, date, time });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Nie udało się zapisać rezerwacji.' });
  }
};
