const { redisPipeline } = require('../lib/upstash');
const { SLOTS, LOCATIONS, locationForDate, isValidDateStr } = require('../lib/booking');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { location, date } = req.query || {};

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

    const commands = SLOTS.map((time) => ['EXISTS', `slot:${location}:${date}:${time}`]);
    const results = await redisPipeline(commands);

    const taken = SLOTS.filter((_, i) => results[i] === 1);

    res.status(200).json({ slots: SLOTS, taken });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Nie udało się sprawdzić dostępności terminów.' });
  }
};
