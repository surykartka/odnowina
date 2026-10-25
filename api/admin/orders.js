const { requireAdmin } = require('../../lib/adminAuth');
const { listOrders, updateOrder } = require('../../lib/orders');

const ALLOWED_STATUSES = ['pending', 'paid', 'shipped', 'cancelled'];

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    if (req.method === 'GET') {
      const orders = await listOrders();
      res.status(200).json({ orders });
      return;
    }

    if (req.method === 'POST') {
      const { action, sessionId, status } = req.body || {};
      if (action !== 'status' || !sessionId || !ALLOWED_STATUSES.includes(status)) {
        res.status(400).json({ error: 'Nieprawidłowe żądanie.' });
        return;
      }
      const updated = await updateOrder(sessionId, { status, updatedAt: new Date().toISOString() });
      if (!updated) {
        res.status(404).json({ error: 'Nie znaleziono zamówienia.' });
        return;
      }
      res.status(200).json({ order: updated });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Błąd serwera.' });
  }
};
