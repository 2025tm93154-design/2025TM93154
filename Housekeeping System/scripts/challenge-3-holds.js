const { setTimeout: wait } = require('timers/promises');

const BASE = 'http://localhost:3202';

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
  const hold = await api(`${BASE}/api/v1/room-holds`, {
    method: 'POST',
    body: JSON.stringify({ roomType: 'STANDARD', reservationId: 'hold-demo-reservation', holdSeconds: 3 }),
  });

  console.log('Initial hold response:', JSON.stringify(hold, null, 2));
  await wait(3500);

  const afterExpiry = await api(`${BASE}/api/v1/rooms`);
  console.log('Room state after expiry:', JSON.stringify(afterExpiry.data, null, 2));
})();
