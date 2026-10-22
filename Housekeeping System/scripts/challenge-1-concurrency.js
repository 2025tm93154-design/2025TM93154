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
  const results = [];
  for (let i = 0; i < 20; i += 1) {
    results.push(api(`${BASE}/api/v1/cleaning-slots/reserve`, {
      method: 'POST',
      body: JSON.stringify({ shiftId: 'day-shift', required: 1 }),
    }));
  }

  const responses = await Promise.all(results);
  const successCount = responses.filter((r) => r.status === 201).length;
  const rejectedCount = responses.filter((r) => r.status === 409).length;
  const summary = {
    totalRequests: 20,
    successCount,
    rejectedCount,
    responses: responses.map((r) => ({ status: r.status, message: r.data?.message || r.data })),
  };

  console.log(JSON.stringify(summary, null, 2));
  await wait(200);
  const finalState = await api(`${BASE}/api/v1/rooms`);
  console.log('Final room state:', JSON.stringify(finalState.data, null, 2));
})();
