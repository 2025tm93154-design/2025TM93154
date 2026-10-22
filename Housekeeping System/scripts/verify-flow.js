const { spawn } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const ports = { reservation: 3201, room: 3202, task: 3203, notification: 3204 };
const services = [
  {
    name: 'reservation-service',
    cwd: path.join(root, 'services', 'reservation-service'),
    port: ports.reservation,
    env: {
      RESET_DB: '1',
      PORT: '3201',
      ROOM_SERVICE_URL: `http://localhost:${ports.room}`,
      TASK_SERVICE_URL: `http://localhost:${ports.task}`,
      NOTIFICATION_SERVICE_URL: `http://localhost:${ports.notification}`,
    },
  },
  {
    name: 'room-service',
    cwd: path.join(root, 'services', 'room-service'),
    port: ports.room,
    env: { RESET_DB: '1', PORT: '3202' },
  },
  {
    name: 'task-service',
    cwd: path.join(root, 'services', 'task-service'),
    port: ports.task,
    env: {
      RESET_DB: '1',
      PORT: '3203',
      NOTIFICATION_SERVICE_URL: `http://localhost:${ports.notification}`,
    },
  },
  {
    name: 'notification-service',
    cwd: path.join(root, 'services', 'notification-service'),
    port: ports.notification,
    env: { RESET_DB: '1', PORT: '3204' },
  },
];

function startService(service) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: service.cwd,
    env: { ...process.env, ...service.env },
    stdio: 'ignore',
  });
  return child;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

async function main() {
  const children = services.map(startService);

  try {
    await sleep(1500);

    const healthChecks = await Promise.all([
      fetchJson(`http://localhost:${ports.reservation}/health`),
      fetchJson(`http://localhost:${ports.room}/health`),
      fetchJson(`http://localhost:${ports.task}/health`),
      fetchJson(`http://localhost:${ports.notification}/health`),
    ]);

    for (const result of healthChecks) {
      if (result.status !== 200) {
        throw new Error(`Health check failed: ${JSON.stringify(result)}`);
      }
    }

    const reservationPayload = {
      guestName: 'Verification Guest',
      roomType: 'STANDARD',
      checkInDate: '2026-11-15',
      nights: 2,
    };

    const reservation = await fetchJson(`http://localhost:${ports.reservation}/api/v1/reservations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'verify-key-1',
      },
      body: JSON.stringify(reservationPayload),
    });

    if (reservation.status !== 201) {
      throw new Error(`Reservation failed: ${JSON.stringify(reservation)}`);
    }

    console.log('Health checks passed:', healthChecks.map((r) => r.status));
    console.log('Reservation result:', JSON.stringify(reservation.body, null, 2));
    console.log('Verification passed.');
    process.exitCode = 0;
  } catch (error) {
    console.error('Verification failed:', error.message);
    process.exitCode = 1;
  } finally {
    for (const child of children) {
      child.kill('SIGTERM');
    }
  }
}

main();
