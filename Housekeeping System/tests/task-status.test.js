const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = 3213;

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) return;
    } catch (error) {
      // keep retrying
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Task service did not start in time');
}

test('task status can be updated through the API', async (t) => {
  const child = spawn(process.execPath, ['services/task-service/server.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      RESET_DB: '1',
      NOTIFICATION_SERVICE_URL: 'http://localhost:3204',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  t.after(() => {
    child.kill('SIGTERM');
  });

  await waitForServer();

  const createResponse = await fetch(`http://localhost:${port}/api/v1/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'status-test-1',
    },
    body: JSON.stringify({
      reservationId: 'reservation-1001',
      roomType: 'STANDARD',
      taskType: 'room-cleaning',
      assignedStaff: 'Housekeeper Team A',
    }),
  });

  const created = await createResponse.json();
  const taskId = created.task.id;

  const updateResponse = await fetch(`http://localhost:${port}/api/v1/tasks/${taskId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'IN_PROGRESS' }),
  });

  const updated = await updateResponse.json();

  assert.equal(updateResponse.status, 200, 'expected status update to succeed');
  assert.equal(updated.task.status, 'IN_PROGRESS');
});
