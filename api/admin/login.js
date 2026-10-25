const { requireAdmin } = require('../../lib/adminAuth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!requireAdmin(req, res)) return;
  res.status(200).json({ ok: true });
};
