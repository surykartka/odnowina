// Generic record + time-sorted index helpers on top of Upstash Redis (REST,
// serverless — no database server to run or manage). Used by lib/booking.js
// (bookings) and lib/orders.js (orders) so admin listing/lookup stays O(1)
// instead of relying on Redis KEYS/SCAN.

const { redisPipeline } = require('./upstash');

async function saveRecord(key, record) {
  await redisPipeline([['SET', key, JSON.stringify(record)]]);
}

async function getRecord(key) {
  const [raw] = await redisPipeline([['GET', key]]);
  return raw ? JSON.parse(raw) : null;
}

async function getRecords(keys) {
  if (keys.length === 0) return [];
  const results = await redisPipeline(keys.map((key) => ['GET', key]));
  return results.map((raw) => (raw ? JSON.parse(raw) : null));
}

async function addToIndex(indexKey, score, member) {
  await redisPipeline([['ZADD', indexKey, score, member]]);
}

async function removeFromIndex(indexKey, member) {
  await redisPipeline([['ZREM', indexKey, member]]);
}

async function listIndex(indexKey, limit = 200) {
  const [members] = await redisPipeline([['ZREVRANGE', indexKey, 0, limit - 1]]);
  return members || [];
}

module.exports = { saveRecord, getRecord, getRecords, addToIndex, removeFromIndex, listIndex };
