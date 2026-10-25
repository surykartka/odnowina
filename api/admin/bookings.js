const { requireAdmin } = require('../../lib/adminAuth');
const { listBookings, cancelBooking } = require('../../lib/booking');

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    if (req.method === 'GET') {
      const bookings = await listBookings();
      res.status(200).json({ bookings });
      return;
    }

    if (req.method === 'POST') {
      const { action, bookingId } = req.body || {};
      if (action !== 'cancel' || !bookingId) {
        res.status(400).json({ error: 'Nieprawidłowe żądanie.' });
        return;
      }
      const updated = await cancelBooking(bookingId);
      if (!updated) {
        res.status(404).json({ error: 'Nie znaleziono rezerwacji.' });
        return;
      }
      res.status(200).json({ booking: updated });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Błąd serwera.' });
  }
};
