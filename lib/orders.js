// Order storage on Upstash Redis — persists shop orders (cart, customer,
// InPost locker, payment status) so they survive beyond the HotPay webhook
// log and can be reviewed/fulfilled from the admin panel.

const { saveRecord, getRecord, getRecords, addToIndex, listIndex } = require('./store');

const ORDERS_INDEX = 'orders:index';

function orderKey(sessionId) {
  return `order:${sessionId}`;
}

async function createOrder(order) {
  await saveRecord(orderKey(order.sessionId), order);
  await addToIndex(ORDERS_INDEX, Date.now(), order.sessionId);
}

async function getOrder(sessionId) {
  return getRecord(orderKey(sessionId));
}

async function updateOrder(sessionId, patch) {
  const existing = await getOrder(sessionId);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  await saveRecord(orderKey(sessionId), updated);
  return updated;
}

async function listOrders(limit = 200) {
  const sessionIds = await listIndex(ORDERS_INDEX, limit);
  const records = await getRecords(sessionIds.map(orderKey));
  return records.filter(Boolean);
}

module.exports = { createOrder, getOrder, updateOrder, listOrders };
