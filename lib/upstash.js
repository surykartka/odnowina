// Thin wrapper around the Upstash Redis REST API (https://upstash.com/docs/redis/features/restapi).
// Required env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

async function redisPipeline(commands) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error('Baza rezerwacji nie jest skonfigurowana (brak zmiennych środowiskowych Upstash). Patrz SETUP.md.');
  }

  const response = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  });

  const results = await response.json();

  if (!response.ok) {
    throw new Error('Błąd połączenia z bazą rezerwacji.');
  }
  for (const r of results) {
    if (r && r.error) {
      throw new Error(`Błąd bazy rezerwacji: ${r.error}`);
    }
  }
  return results.map((r) => r.result);
}

module.exports = { redisPipeline };
