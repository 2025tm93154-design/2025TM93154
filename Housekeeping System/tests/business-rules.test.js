const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const ports = {
  room: Number(process.env.ROOM_PORT || 3102),
  task: Number(process.env.TASK_PORT || 3103),
  notification: Number(process.env.NOTIFICATION_PORT || 3104),
  reservation: Number(process.env.RESERVATION_PORT || 3101),
};

const services = [];

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function startService(cwd, port) {
  const baseEnv = {
    ...process.env,
    RESET_DB: '1',
    PORT: String(port),
    ROOM_SERVICE_URL: `http://localhost:${ports.room}`,
    TASK_SERVICE_URL: `http://localhost:${ports.task}`,
    NOTIFICATION_SERVICE_URL: `http://localhost:${ports.notification}`,
  };

  const child = spawn('node', ['server.js'], {
    cwd,
    env: { ...baseEnv, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  services.push(child);
  return child;
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function api(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    ...options,
    headers,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

test.before(async () => {
  const serviceDirs = ['services/room-service', 'services/task-service', 'services/notification-service', 'services/reservation-service'];
  for (const dir of serviceDirs) {
    const dataDir = path.join(process.cwd(), dir, 'data');
    if (fs.existsSync(dataDir)) {
      for (const file of fs.readdirSync(dataDir)) {
        if (file.endsWith('.db')) {
          fs.unlinkSync(path.join(dataDir, file));
        }
      }
    }
  }

  startService('services/room-service', ports.room);
  startService('services/task-service', ports.task);
  startService('services/notification-service', ports.notification);
  startService('services/reservation-service', ports.reservation);
  await wait(2500);
});

test.after(() => {
  for (const child of services) {
    child.kill('SIGTERM');
  }
});

test('BR1: room cleaning slot capacity is enforced under concurrent demand', async () => {
  const shiftId = uid('day-shift');
  const slotPayload = { shiftId, required: 1 };
  await api(`http://localhost:${ports.room}/api/v1/cleaning-slots/reserve`, {
    method: 'POST',
    body: JSON.stringify({ shiftId, required: 1 }),
  });

  const first = await api(`http://localhost:${ports.room}/api/v1/cleaning-slots/reserve`, {
    method: 'POST',
    body: JSON.stringify(slotPayload),
  });
  const second = await api(`http://localhost:${ports.room}/api/v1/cleaning-slots/reserve`, {
    method: 'POST',
    body: JSON.stringify(slotPayload),
  });

  assert.equal(first.status, 201);
  assert.equal(second.status, 409);
});

test('BR2: reservation idempotency prevents duplicate effects', async () => {
  const payload = {
    guestName: 'Idempotent Guest',
    roomType: 'STANDARD',
    checkInDate: '2026-11-12',
    nights: 1,
  };
  const key = uid('br2-key');

  const first = await api(`http://localhost:${ports.reservation}/api/v1/reservations`, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify(payload),
  });
  const second = await api(`http://localhost:${ports.reservation}/api/v1/reservations`, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify(payload),
  });
  const collision = await api(`http://localhost:${ports.reservation}/api/v1/reservations`, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify({ ...payload, nights: 2 }),
  });

  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(collision.status, 409);
  assert.equal(first.data.reservation.id, second.data.reservation.id);
});

test('BR3: task service creates a housekeeping request and is safe to replay', async () => {
  const payload = {
    reservationId: uid('br3-reservation'),
    roomType: 'STANDARD',
    taskType: 'room-cleaning',
    assignedStaff: 'Housekeeper Team B',
  };
  const key = uid('br3-key');

  const first = await api(`http://localhost:${ports.task}/api/v1/tasks`, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify(payload),
  });
  const second = await api(`http://localhost:${ports.task}/api/v1/tasks`, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify(payload),
  });

  assert.equal(first.status, 201);
  assert.equal(second.status, 200);
  assert.equal(first.data.task.id, second.data.task.id);
});

test('BR4: notification service accepts a valid notification and rejects missing fields', async () => {
  const ok = await api(`http://localhost:${ports.notification}/api/v1/notifications`, {
    method: 'POST',
    body: JSON.stringify({ taskId: 'demo-task-001', message: 'Room clean-up is ready.' }),
  });
  const bad = await api(`http://localhost:${ports.notification}/api/v1/notifications`, {
    method: 'POST',
    body: JSON.stringify({ taskId: 'demo-task-001' }),
  });

  assert.equal(ok.status, 201);
  assert.equal(bad.status, 400);
});
