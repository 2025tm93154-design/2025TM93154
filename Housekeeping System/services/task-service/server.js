const express = require('express');
const crypto = require('crypto');
const { init, get, all, run } = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 3003);
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004';
app.use(express.json());

function logger(level, message, extra = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'task-service',
    message,
    ...extra,
  };
  console.log(JSON.stringify(entry));
}

function requestHash(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function correlationId(req) {
  return req.headers['x-correlation-id'] || crypto.randomUUID();
}

app.use((req, res, next) => {
  req.correlationId = correlationId(req);
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'task-service', time: new Date().toISOString() });
});

app.get('/api/v1/openapi.json', (req, res) => {
  res.json({
    openapi: '3.0.0',
    info: { title: 'Task Service', version: '1.0.0' },
    paths: {
      '/api/v1/tasks': {
        post: { summary: 'Create a housekeeping task' },
      },
    },
  });
});

app.get('/api/v1/tasks', async (req, res) => {
  const rows = await all('SELECT * FROM tasks ORDER BY createdAt DESC');
  res.json(rows);
});

app.get('/api/v1/tasks/:id', async (req, res) => {
  const task = await get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!task) {
    return res.status(404).json({ error: 'Not found', message: 'Task not found.' });
  }
  return res.json(task);
});

app.patch('/api/v1/tasks/:id/status', async (req, res) => {
  const { status } = req.body || {};
  const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      error: 'Validation failed',
      message: 'Status is required and must be one of: ' + validStatuses.join(', '),
    });
  }

  const existingTask = await get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  if (!existingTask) {
    return res.status(404).json({ error: 'Not found', message: 'Task not found.' });
  }

  await run('UPDATE tasks SET status = ? WHERE id = ?', [status, req.params.id]);
  const updatedTask = await get('SELECT * FROM tasks WHERE id = ?', [req.params.id]);

  logger('info', 'task status updated', {
    correlationId: req.correlationId,
    taskId: req.params.id,
    status,
  });

  return res.json({ message: 'Task status updated', task: updatedTask });
});

app.post('/api/v1/tasks', async (req, res) => {
  const payload = req.body || {};
  const { reservationId, roomType, taskType, assignedStaff } = payload;

  if (!reservationId || !roomType || !taskType) {
    return res.status(400).json({ error: 'Validation failed', message: 'reservationId, roomType and taskType are required.' });
  }

  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Validation failed', message: 'Idempotency-Key header is required.' });
  }

  const hash = requestHash(payload);
  const existing = await get('SELECT * FROM tasks WHERE idempotencyKey = ?', [idempotencyKey]);
  if (existing) {
    if (existing.requestHash !== hash) {
      return res.status(409).json({ error: 'Conflict', message: 'Same idempotency key cannot be re-used with different payload.' });
    }
    logger('info', 'task replayed', { correlationId: req.correlationId, taskId: existing.id, reservationId });
    return res.status(200).json({ message: 'Task replayed', task: existing });
  }

  const taskId = crypto.randomUUID();
  const task = {
    id: taskId,
    reservationId,
    roomType,
    taskType,
    assignedStaff: assignedStaff || 'Housekeeper Team A',
    status: 'PENDING',
    idempotencyKey,
    requestHash: hash,
    createdAt: new Date().toISOString(),
  };

  await run(
    `INSERT INTO tasks (id, reservationId, roomType, taskType, assignedStaff, status, idempotencyKey, requestHash, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [task.id, task.reservationId, task.roomType, task.taskType, task.assignedStaff, task.status, task.idempotencyKey, task.requestHash, task.createdAt],
  );

  logger('info', 'task created', { correlationId: req.correlationId, taskId: task.id, assignedStaff: task.assignedStaff });

  try {
    const notificationResponse = await fetch(`${NOTIFICATION_SERVICE_URL}/api/v1/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-correlation-id': req.correlationId },
      body: JSON.stringify({ taskId: task.id, message: `Housekeeping task created: ${task.taskType}` }),
    });
    const notificationData = await notificationResponse.json();
    if (!notificationResponse.ok) {
      logger('warn', 'notification creation failed', { correlationId: req.correlationId, status: notificationResponse.status, body: notificationData });
    }
    return res.status(201).json({ message: 'Housekeeping task created', task, notification: notificationData.notification || null });
  } catch (error) {
    logger('warn', 'notification call failed', { correlationId: req.correlationId, message: error.message });
    return res.status(201).json({ message: 'Housekeeping task created', task });
  }
});

init().then(() => {
  app.listen(PORT, () => {
    logger('info', 'task service started', { port: PORT });
  });
}).catch((error) => {
  console.error('Failed to initialize task service', error);
  process.exit(1);
});
