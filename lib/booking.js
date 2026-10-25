const { redisPipeline } = require('./upstash');
const { saveRecord, getRecord, getRecords, addToIndex, listIndex } = require('./store');

const SLOTS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];
const BOOKINGS_INDEX = 'bookings:index';

// Ziębice runs weekdays, Wrocław runs weekends — each date maps to exactly one location.
const LOCATIONS = {
  ziebice: { name: 'Ziębice', address: 'ul. Przykładowa 1, Ziębice', allowedDays: [1, 2, 3, 4, 5] },
  wroclaw: { name: 'Wrocław', address: 'ul. Przykładowa 2, Wrocław', allowedDays: [0, 6] },
};

function locationForDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  const entry = Object.entries(LOCATIONS).find(([, loc]) => loc.allowedDays.includes(dow));
  return entry ? entry[0] : null;
}

function isValidDateStr(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function slotKey(location, date, time) {
  return `slot:${location}:${date}:${time}`;
}

function bookingKey(bookingId) {
  return `booking:${bookingId}`;
}

// Atomically claims a slot (NX = fails if already taken) and stores the
// bookingId as the slot's value, so a cancellation can find it again.
async function reserveSlot(location, date, time, bookingId) {
  const [setResult] = await redisPipeline([
    ['SET', slotKey(location, date, time), bookingId, 'NX'],
  ]);
  return setResult === 'OK';
}

async function saveBooking(record) {
  await saveRecord(bookingKey(record.bookingId), record);
  await addToIndex(BOOKINGS_INDEX, Date.now(), record.bookingId);
}

async function getBooking(bookingId) {
  return getRecord(bookingKey(bookingId));
}

async function listBookings(limit = 200) {
  const bookingIds = await listIndex(BOOKINGS_INDEX, limit);
  const records = await getRecords(bookingIds.map(bookingKey));
  return records.filter(Boolean);
}

// Frees the slot so it can be rebooked, and marks the booking record as
// cancelled (kept around for the admin panel's history).
async function cancelBooking(bookingId) {
  const booking = await getBooking(bookingId);
  if (!booking) return null;
  const updated = { ...booking, status: 'cancelled', cancelledAt: new Date().toISOString() };
  await saveRecord(bookingKey(bookingId), updated);
  await redisPipeline([['DEL', slotKey(booking.location, booking.date, booking.time)]]);
  return updated;
}

module.exports = {
  SLOTS,
  LOCATIONS,
  locationForDate,
  isValidDateStr,
  reserveSlot,
  saveBooking,
  getBooking,
  listBookings,
  cancelBooking,
};
