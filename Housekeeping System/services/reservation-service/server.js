const express = require('express');
const crypto = require('crypto');
const { init, get, all, run } = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 3001);
const ROOM_SERVICE_URL = process.env.ROOM_SERVICE_URL || 'http://localhost:3002';
const TASK_SERVICE_URL = process.env.TASK_SERVICE_URL || 'http://localhost:3003';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004';

app.use(express.json());

function requestHash(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function logger(level, message, extra = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'reservation-service',
    message,
    ...extra,
  };
  console.log(JSON.stringify(entry));
}

function correlationId(req) {
  return req.headers['x-correlation-id'] || crypto.randomUUID();
}

app.use((req, res, next) => {
  req.correlationId = correlationId(req);
  logger('info', 'request received', { method: req.method, path: req.path, correlationId: req.correlationId });
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'reservation-service', time: new Date().toISOString() });
});

app.get('/api/v1/openapi.json', (req, res) => {
  res.json({
    openapi: '3.0.0',
    info: { title: 'Reservation Service', version: '1.0.0' },
    paths: {
      '/api/v1/reservations': {
        post: {
          summary: 'Create or replay a reservation',
        },
      },
    },
  });
});

app.get('/api/v1/reservations', async (req, res) => {
  const rows = await all('SELECT * FROM reservations ORDER BY createdAt DESC');
  res.json(rows);
});

app.post('/api/v1/reservations', async (req, res) => {
  const correlationIdValue = req.correlationId;
  const payload = req.body || {};
  const { guestName, roomType, checkInDate, nights } = payload;

  if (!guestName || !roomType || !checkInDate || !nights || Number(nights) <= 0) {
    logger('warn', 'invalid reservation request', { correlationId: correlationIdValue, payload });
    return res.status(400).json({ error: 'Validation failed', message: 'guestName, roomType, checkInDate and nights are required.' });
  }

  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    logger('warn', 'missing idempotency key', { correlationId: correlationIdValue });
    return res.status(400).json({ error: 'Validation failed', message: 'Idempotency-Key header is required.' });
  }

  const requestHashValue = requestHash(payload);
  const existing = await get('SELECT * FROM reservations WHERE idempotencyKey = ?', [idempotencyKey]);

  if (existing) {
    if (existing.requestHash !== requestHashValue) {
      logger('warn', 'idempotency key collision', {
        correlationId: correlationIdValue,
        key: idempotencyKey,
        existingHash: existing.requestHash,
        currentHash: requestHashValue,
      });
      return res.status(409).json({ error: 'Conflict', message: 'Same idempotency key cannot be re-used with different payload.' });
    }

    logger('info', 'replay reservation', { correlationId: correlationIdValue, reservationId: existing.id, key: idempotencyKey });
    return res.status(200).json({ message: 'Reservation replayed', reservation: existing });
  }

  const reservationId = crypto.randomUUID();

  try {
    const roomHoldResponse = await fetch(`${ROOM_SERVICE_URL}/api/v1/room-holds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationIdValue },
      body: JSON.stringify({ roomType, reservationId, holdSeconds: 50 }),
    });

    const roomHoldData = await roomHoldResponse.json();
    if (!roomHoldResponse.ok) {
      logger('error', 'room hold failed', { correlationId: correlationIdValue, status: roomHoldResponse.status, body: roomHoldData });
      return res.status(502).json({ error: 'Upstream failure', message: 'Room service rejected the hold request.', details: roomHoldData });
    }

    const taskResponse = await fetch(`${TASK_SERVICE_URL}/api/v1/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationIdValue, 'idempotency-key': `task-${reservationId}` },
      body: JSON.stringify({ reservationId, roomType, taskType: 'room-cleaning', assignedStaff: 'Housekeeper Team A' }),
    });

    const taskData = await taskResponse.json();
    if (!taskResponse.ok) {
      logger('error', 'task creation failed', { correlationId: correlationIdValue, status: taskResponse.status, body: taskData });
      return res.status(502).json({ error: 'Upstream failure', message: 'Task service rejected the housekeeping request.', details: taskData });
    }

    const notificationResponse = await fetch(`${NOTIFICATION_SERVICE_URL}/api/v1/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationIdValue },
      body: JSON.stringify({ taskId: taskData.task.id, message: `Room cleaning requested for ${guestName}` }),
    });

    const notificationData = await notificationResponse.json();
    if (!notificationResponse.ok) {
      logger('warn', 'notification send failed', { correlationId: correlationIdValue, status: notificationResponse.status, body: notificationData });
    }

    const inserted = {
      id: reservationId,
      guestName,
      roomType,
      checkInDate,
      nights: Number(nights),
      status: 'CONFIRMED',
      requestHash: requestHashValue,
      idempotencyKey,
      roomHoldId: roomHoldData.holdId || null,
      createdAt: new Date().toISOString(),
    };

    await run(
      `INSERT INTO reservations (id, guestName, roomType, checkInDate, nights, status, requestHash, idempotencyKey, roomHoldId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        inserted.id,
        inserted.guestName,
        inserted.roomType,
        inserted.checkInDate,
        inserted.nights,
        inserted.status,
        inserted.requestHash,
        inserted.idempotencyKey,
        inserted.roomHoldId,
        inserted.createdAt,
      ],
    );

    logger('info', 'reservation created', { correlationId: correlationIdValue, reservationId: inserted.id, taskId: taskData.task.id });
    return res.status(201).json({ message: 'Reservation created', reservation: inserted, task: taskData.task, notification: notificationData.notification || null });
  } catch (error) {
    logger('error', 'reservation error', { correlationId: correlationIdValue, message: error.message });
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

init().then(() => {
  app.listen(PORT, () => {
    logger('info', 'reservation service started', { port: PORT });
  });
}).catch((error) => {
  console.error('Failed to initialize reservation service', error);
  process.exit(1);
});
