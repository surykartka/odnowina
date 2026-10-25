// Shared auth check for /api/admin/* endpoints. A single shared password
// (ADMIN_PASSWORD) is enough for a one-person/one-shop admin panel — sent by
// the browser as the x-admin-key header on every request.

function requireAdmin(req, res) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    res.status(500).json({ error: 'Panel admina nie jest skonfigurowany (brak ADMIN_PASSWORD). Patrz SETUP.md.' });
    return false;
  }
  const provided = req.headers['x-admin-key'];
  if (!provided || provided !== expected) {
    res.status(401).json({ error: 'Nieprawidłowe hasło.' });
    return false;
  }
  return true;
}

module.exports = { requireAdmin };
