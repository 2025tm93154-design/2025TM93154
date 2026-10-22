const express = require('express');
const crypto = require('crypto');
const { init, get, all, run } = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 3002);
app.use(express.json());

function logger(level, message, extra = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'room-service',
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

async function cleanupExpiredHolds() {
  const now = new Date().toISOString();
  const expiredHolds = await all('SELECT * FROM room_holds WHERE status = ? AND expiresAt <= ?', ['ACTIVE', now]);

  for (const hold of expiredHolds) {
    await run('UPDATE rooms SET status = ?, reservedUntil = NULL, version = version + 1 WHERE id = ?', ['AVAILABLE', hold.roomId]);
    await run('UPDATE room_holds SET status = ? WHERE id = ?', ['EXPIRED', hold.id]);
    logger('warn', 'room hold expired', { roomId: hold.roomId, holdId: hold.id, reservationId: hold.reservationId });
  }
}

setInterval(() => {
  cleanupExpiredHolds().catch((error) => {
    logger('error', 'cleanup failed', { message: error.message });
  });
}, 5000);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'room-service', time: new Date().toISOString() });
});

app.get('/api/v1/openapi.json', (req, res) => {
  res.json({
    openapi: '3.0.0',
    info: { title: 'Room Service', version: '1.0.0' },
    paths: {
      '/api/v1/rooms': { get: { summary: 'List rooms' } },
      '/api/v1/room-holds': { post: { summary: 'Hold a room for a reservation' } },
      '/api/v1/cleaning-slots/reserve': { post: { summary: 'Reserve a cleaning slot using atomic update' } },
    },
  });
});

app.get('/api/v1/rooms', async (req, res) => {
  const rows = await all('SELECT * FROM rooms ORDER BY roomNumber');
  res.json(rows);
});

app.post('/api/v1/room-holds', async (req, res) => {
  const { roomType, reservationId, holdSeconds = 30 } = req.body || {};

  if (!reservationId || !roomType) {
    return res.status(400).json({ error: 'Validation failed', message: 'roomType and reservationId are required.' });
  }

  const room = await get('SELECT * FROM rooms WHERE roomType = ? AND status = ? ORDER BY roomNumber LIMIT 1', [roomType, 'AVAILABLE']);
  if (!room) {
    logger('warn', 'no available room for hold', { roomType, reservationId, correlationId: req.correlationId });
    return res.status(409).json({ error: 'Conflict', message: `No available room of type ${roomType} is currently free.` });
  }

  const holdId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + Number(holdSeconds) * 1000).toISOString();

  await run('UPDATE rooms SET status = ?, reservedUntil = ?, version = version + 1 WHERE id = ?', ['HELD', expiresAt, room.id]);
  await run('INSERT INTO room_holds (id, roomId, reservationId, holdSeconds, expiresAt, status) VALUES (?, ?, ?, ?, ?, ?)', [holdId, room.id, reservationId, Number(holdSeconds), expiresAt, 'ACTIVE']);

  logger('info', 'room hold created', { roomId: room.id, reservationId, holdId, expiresAt, correlationId: req.correlationId });
  return res.status(201).json({ message: 'Room successfully held', holdId, roomId: room.id, expiresAt });
});

app.post('/api/v1/cleaning-slots/reserve', async (req, res) => {
  const { shiftId = 'day-shift', required = 1 } = req.body || {};

  let existing = await get('SELECT * FROM cleaning_slots WHERE shiftId = ?', [shiftId]);
  if (!existing) {
    const generatedId = `${shiftId}-slot-${Date.now()}`;
    await run('INSERT INTO cleaning_slots (id, shiftId, capacity, reserved, updatedAt) VALUES (?, ?, ?, ?, ?)', [generatedId, shiftId, 2, 0, new Date().toISOString()]);
    existing = await get('SELECT * FROM cleaning_slots WHERE shiftId = ?', [shiftId]);
  }

  const available = existing.capacity - existing.reserved;
  if (available < Number(required)) {
    logger('warn', 'slot capacity reached', { shiftId, required, available, correlationId: req.correlationId });
    return res.status(409).json({ error: 'Conflict', message: 'No slots available for this shift.' });
  }

  const updated = await run(
    'UPDATE cleaning_slots SET reserved = reserved + ?, updatedAt = ? WHERE shiftId = ? AND reserved + ? <= capacity',
    [Number(required), new Date().toISOString(), shiftId, Number(required)],
  );

  if (updated.changes === 0) {
    return res.status(409).json({ error: 'Conflict', message: 'The request could not be committed because capacity was exhausted concurrently.' });
  }

  const finalRow = await get('SELECT * FROM cleaning_slots WHERE shiftId = ?', [shiftId]);
  logger('info', 'slots reserved', { shiftId, required, finalRow, correlationId: req.correlationId });
  return res.status(201).json({ message: 'Cleaning slot reserved', shift: finalRow });
});

app.post('/api/v1/room-holds/release', async (req, res) => {
  const { roomId } = req.body || {};
  if (!roomId) {
    return res.status(400).json({ error: 'Validation failed', message: 'roomId is required.' });
  }

  await run('UPDATE rooms SET status = ?, reservedUntil = NULL, version = version + 1 WHERE id = ?', ['AVAILABLE', roomId]);
  await run('UPDATE room_holds SET status = ? WHERE roomId = ? AND status = ?', ['RELEASED', roomId, 'ACTIVE']);

  logger('info', 'room hold released', { roomId, correlationId: req.correlationId });
  return res.json({ message: 'Room hold released', roomId });
});

init().then(() => {
  app.listen(PORT, () => {
    logger('info', 'room service started', { port: PORT });
  });
}).catch((error) => {
  console.error('Failed to initialize room service', error);
  process.exit(1);
});
