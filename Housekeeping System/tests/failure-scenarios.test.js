const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execSync } = require('node:child_process');

const root = process.cwd();
const reportsDir = path.join(root, 'reports');
const reportPath = path.join(reportsDir, 'failure-scenarios-report.json');
const ports = {
  reservation: 3201,
  room: 3202,
  task: 3203,
  notification: 3204,
};
const services = [];
const resultLog = [];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function terminateStaleProjectProcesses() {
  try {
    if (process.platform === 'win32') {
      const escapedRoot = root.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const command = [
        'powershell',
        '-NoProfile',
        '-Command',
        `Get-CimInstance Win32_Process -Filter "name = 'node.exe'" | Where-Object { $_.ProcessId -ne ${process.pid} -and (($_.CommandLine -match [regex]::Escape('${root}')) -or ($_.CommandLine -match [regex]::Escape('server.js')) -or ($_.CommandLine -match [regex]::Escape('${escapedRoot}'))) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`,
      ];
      execSync(command.join(' '), { stdio: 'ignore' });
    } else {
      execSync("pkill -f 'server.js' || true", { stdio: 'ignore' });
    }
  } catch (error) {
    // Ignore stale-process cleanup errors; the suite should continue when no prior process exists.
  }
}

function cleanupDbFiles() {
  const serviceDirs = [
    'services/reservation-service',
    'services/room-service',
    'services/task-service',
    'services/notification-service',
  ];

  for (const relativeDir of serviceDirs) {
    const dataDir = path.join(root, relativeDir, 'data');
    if (!fs.existsSync(dataDir)) continue;
    for (const file of fs.readdirSync(dataDir)) {
      if (file.endsWith('.db')) {
        try {
          fs.unlinkSync(path.join(dataDir, file));
        } catch (error) {
          if (error.code !== 'EBUSY') throw error;
        }
      }
    }
  }
}

function startService(serviceDir, port, extraEnv = {}) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(root, serviceDir),
    env: {
      ...process.env,
      RESET_DB: '1',
      PORT: String(port),
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    if (process.env.DEBUG_TESTS === '1') {
      process.stdout.write(chunk);
    }
  });

  child.stderr.on('data', (chunk) => {
    if (process.env.DEBUG_TESTS === '1') {
      process.stderr.write(chunk);
    }
  });

  services.push(child);
  return child;
}

async function api(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const response = await fetch(url, {
    ...options,
    headers,
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: response.status, data, ok: response.ok };
}

function addResult(name, status, details) {
  resultLog.push({
    name,
    status,
    timestamp: new Date().toISOString(),
    ...details,
  });
}

function summarize() {
  const total = resultLog.length;
  const passed = resultLog.filter((entry) => entry.status === 'PASS').length;
  const failed = resultLog.filter((entry) => entry.status === 'FAIL').length;
  return { total, passed, failed };
}

async function assertFailureCase(name, url, method, expectedStatus, payload, headers = {}) {
  const startedAt = Date.now();
  const response = await api(url, {
    method,
    headers,
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const passed = response.status === expectedStatus;
  addResult(name, passed ? 'PASS' : 'FAIL', {
    expectedStatus,
    actualStatus: response.status,
    method,
    url,
    durationMs: Date.now() - startedAt,
    request: payload,
    response: response.data,
  });

  assert.equal(response.status, expectedStatus, `${name}: expected ${expectedStatus}, got ${response.status}`);
  return response;
}

test.before(async () => {
  terminateStaleProjectProcesses();
  cleanupDbFiles();
  fs.mkdirSync(reportsDir, { recursive: true });

  startService('services/room-service', ports.room);
  startService('services/task-service', ports.task, {
    NOTIFICATION_SERVICE_URL: `http://localhost:${ports.notification}`,
  });
  startService('services/notification-service', ports.notification);
  startService('services/reservation-service', ports.reservation, {
    ROOM_SERVICE_URL: `http://localhost:${ports.room}`,
    TASK_SERVICE_URL: `http://localhost:${ports.task}`,
    NOTIFICATION_SERVICE_URL: `http://localhost:${ports.notification}`,
  });

  await wait(2500);
});

test.after(() => {
  for (const child of services) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  const summary = summarize();
  const report = {
    generatedAt: new Date().toISOString(),
    suite: 'housekeeping-failure-scenarios',
    summary,
    results: resultLog,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Failure scenario report written to: ${reportPath}`);
  console.log(JSON.stringify(summary, null, 2));
});

test('FS1: all service health endpoints respond successfully', async () => {
  const endpoints = [
    `http://localhost:${ports.reservation}/health`,
    `http://localhost:${ports.room}/health`,
    `http://localhost:${ports.task}/health`,
    `http://localhost:${ports.notification}/health`,
  ];

  for (const endpoint of endpoints) {
    const response = await api(endpoint, { method: 'GET' });
    addResult(`Health check: ${endpoint}`, response.status === 200 ? 'PASS' : 'FAIL', {
      expectedStatus: 200,
      actualStatus: response.status,
      method: 'GET',
      url: endpoint,
      response: response.data,
    });
    assert.equal(response.status, 200, `Expected 200 for ${endpoint}, got ${response.status}`);
  }
});

test('FS2: reservation validation rejects missing required fields', async () => {
  await assertFailureCase(
    'Reservation validation',
    `http://localhost:${ports.reservation}/api/v1/reservations`,
    'POST',
    400,
    { guestName: '', roomType: '', checkInDate: '', nights: 0 },
    { 'Idempotency-Key': 'reservation-invalid-001' },
  );
});

test('FS3: reservation idempotency rejects conflicting payload with same key', async () => {
  const url = `http://localhost:${ports.reservation}/api/v1/reservations`;
  const key = 'reservation-conflict-001';
  const original = {
    guestName: 'Conflict Guest',
    roomType: 'STANDARD',
    checkInDate: '2026-11-15',
    nights: 2,
  };

  const first = await api(url, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify(original),
  });

  const second = await api(url, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify({ ...original, nights: 3 }),
  });

  const passed = first.status === 201 && second.status === 409;
  addResult('Reservation idempotency conflict', passed ? 'PASS' : 'FAIL', {
    expectedStatus: 409,
    actualStatus: second.status,
    method: 'POST',
    url,
    firstResponse: first.data,
    secondResponse: second.data,
  });

  assert.equal(first.status, 201, 'First reservation should succeed');
  assert.equal(second.status, 409, 'Duplicate key with different payload should fail with 409');
});

test('FS4: room service rejects invalid room hold payload', async () => {
  await assertFailureCase(
    'Room hold validation',
    `http://localhost:${ports.room}/api/v1/room-holds`,
    'POST',
    400,
    { roomType: '', reservationId: '' },
  );
});

test('FS5: room cleaning slot capacity conflict occurs when required exceeds available capacity', async () => {
  const shiftId = 'capacity-failure-shift';
  const first = await api(`http://localhost:${ports.room}/api/v1/cleaning-slots/reserve`, {
    method: 'POST',
    body: JSON.stringify({ shiftId, required: 2 }),
  });
  const second = await api(`http://localhost:${ports.room}/api/v1/cleaning-slots/reserve`, {
    method: 'POST',
    body: JSON.stringify({ shiftId, required: 1 }),
  });

  const passed = first.status === 201 && second.status === 409;
  addResult('Room slot capacity conflict', passed ? 'PASS' : 'FAIL', {
    expectedStatus: 409,
    actualStatus: second.status,
    method: 'POST',
    url: `http://localhost:${ports.room}/api/v1/cleaning-slots/reserve`,
    firstResponse: first.data,
    secondResponse: second.data,
  });

  assert.equal(first.status, 201, 'Initial room slot reservation should succeed');
  assert.equal(second.status, 409, 'Second reservation should fail when no capacity remains');
});

test('FS6: task creation rejects missing mandatory values', async () => {
  await assertFailureCase(
    'Task validation',
    `http://localhost:${ports.task}/api/v1/tasks`,
    'POST',
    400,
    { reservationId: '', roomType: '', taskType: '' },
    { 'Idempotency-Key': 'task-invalid-001' },
  );
});

test('FS7: task idempotency rejects conflicting payload with same key', async () => {
  const url = `http://localhost:${ports.task}/api/v1/tasks`;
  const key = 'task-conflict-001';
  const payload = {
    reservationId: 'task-res-001',
    roomType: 'STANDARD',
    taskType: 'room-cleaning',
    assignedStaff: 'Housekeeper Team A',
  };

  const first = await api(url, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify(payload),
  });

  const second = await api(url, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify({ ...payload, assignedStaff: 'Housekeeper Team B' }),
  });

  const passed = first.status === 201 && second.status === 409;
  addResult('Task idempotency conflict', passed ? 'PASS' : 'FAIL', {
    expectedStatus: 409,
    actualStatus: second.status,
    method: 'POST',
    url,
    firstResponse: first.data,
    secondResponse: second.data,
  });

  assert.equal(first.status, 201, 'Task creation should succeed on the first request');
  assert.equal(second.status, 409, 'Conflicting payload for same idempotency key should fail with 409');
});

test('FS8: task status update rejects invalid status values', async () => {
  const create = await api(`http://localhost:${ports.task}/api/v1/tasks`, {
    method: 'POST',
    headers: { 'Idempotency-Key': 'task-status-invalid-001' },
    body: JSON.stringify({
      reservationId: 'task-status-rsv-001',
      roomType: 'STANDARD',
      taskType: 'room-cleaning',
      assignedStaff: 'Housekeeper Team A',
    }),
  });

  if (create.status !== 201) {
    throw new Error(`Task creation failed before status validation: ${JSON.stringify(create.data)}`);
  }

  const taskId = create.data.task.id;
  const response = await api(`http://localhost:${ports.task}/api/v1/tasks/${taskId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'DONE' }),
  });

  const passed = response.status === 400;
  addResult('Invalid task status rejected', passed ? 'PASS' : 'FAIL', {
    expectedStatus: 400,
    actualStatus: response.status,
    method: 'PATCH',
    url: `http://localhost:${ports.task}/api/v1/tasks/${taskId}/status`,
    response: response.data,
  });

  assert.equal(response.status, 400, 'Status DONE should be rejected with 400');
});

test('FS9: task not found endpoint returns 404', async () => {
  const response = await api(`http://localhost:${ports.task}/api/v1/tasks/non-existent-task-id`, {
    method: 'GET',
  });

  const passed = response.status === 404;
  addResult('Task lookup not found', passed ? 'PASS' : 'FAIL', {
    expectedStatus: 404,
    actualStatus: response.status,
    method: 'GET',
    url: `http://localhost:${ports.task}/api/v1/tasks/non-existent-task-id`,
    response: response.data,
  });

  assert.equal(response.status, 404, 'Missing task should return 404');
});

test('FS10: notification validation rejects missing fields', async () => {
  await assertFailureCase(
    'Notification validation',
    `http://localhost:${ports.notification}/api/v1/notifications`,
    'POST',
    400,
    { taskId: '', message: '' },
  );
});

test('FS11: valid task status update succeeds', async () => {
  const create = await api(`http://localhost:${ports.task}/api/v1/tasks`, {
    method: 'POST',
    headers: { 'Idempotency-Key': 'task-status-valid-001' },
    body: JSON.stringify({
      reservationId: 'task-status-rsv-002',
      roomType: 'STANDARD',
      taskType: 'room-cleaning',
      assignedStaff: 'Housekeeper Team B',
    }),
  });

  if (create.status !== 201) {
    throw new Error(`Task creation failed before valid status update: ${JSON.stringify(create.data)}`);
  }

  const taskId = create.data.task.id;
  const response = await api(`http://localhost:${ports.task}/api/v1/tasks/${taskId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'IN_PROGRESS' }),
  });

  const passed = response.status === 200 && response.data.task && response.data.task.status === 'IN_PROGRESS';
  addResult('Valid task status update', passed ? 'PASS' : 'FAIL', {
    expectedStatus: 200,
    actualStatus: response.status,
    method: 'PATCH',
    url: `http://localhost:${ports.task}/api/v1/tasks/${taskId}/status`,
    response: response.data,
  });

  assert.equal(response.status, 200, 'Valid task update should return 200');
  assert.equal(response.data.task.status, 'IN_PROGRESS', 'Task status should be set to IN_PROGRESS');
});
