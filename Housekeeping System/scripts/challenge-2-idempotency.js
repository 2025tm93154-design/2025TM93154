const BASE = 'http://localhost:3201';

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

(async () => {
  const payload = {
    guestName: 'Alice Johnson',
    roomType: 'STANDARD',
    checkInDate: '2026-11-05',
    nights: 2,
  };

  const first = await api(`${BASE}/api/v1/reservations`, {
    method: 'POST',
    headers: { 'Idempotency-Key': 'challenge-2-key-1' },
    body: JSON.stringify(payload),
  });

  const second = await api(`${BASE}/api/v1/reservations`, {
    method: 'POST',
    headers: { 'Idempotency-Key': 'challenge-2-key-1' },
    body: JSON.stringify(payload),
  });

  const collision = await api(`${BASE}/api/v1/reservations`, {
    method: 'POST',
    headers: { 'Idempotency-Key': 'challenge-2-key-1' },
    body: JSON.stringify({ ...payload, nights: 3 }),
  });

  const listing = await api(`${BASE}/api/v1/reservations`);

  console.log(JSON.stringify({
    firstResponse: first,
    secondResponse: second,
    collisionResponse: collision,
    reservationCount: listing.data.length,
    uniqueReservationIds: [...new Set(listing.data.map((item) => item.id))],
  }, null, 2));
})();
