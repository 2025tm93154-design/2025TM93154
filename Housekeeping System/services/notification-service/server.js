const express = require('express');
const crypto = require('crypto');
const { init, run, all, get } = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 3004);
app.use(express.json());

function logger(level, message, extra = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    service: 'notification-service',
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
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service', time: new Date().toISOString() });
});

app.get('/api/v1/openapi.json', (req, res) => {
  res.json({
    openapi: '3.0.0',
    info: { title: 'Notification Service', version: '1.0.0' },
    paths: {
      '/api/v1/notifications': {
        post: { summary: 'Create a housekeeping notification' },
      },
    },
  });
});

app.get('/api/v1/notifications', async (req, res) => {
  const rows = await all('SELECT * FROM notifications ORDER BY createdAt DESC');
  res.json(rows);
});

app.post('/api/v1/notifications', async (req, res) => {
  const { taskId, message } = req.body || {};

  if (!taskId || !message) {
    return res.status(400).json({ error: 'Validation failed', message: 'taskId and message are required.' });
  }

  const notification = {
    id: crypto.randomUUID(),
    taskId,
    message,
    status: 'SENT',
    createdAt: new Date().toISOString(),
  };

  await run('INSERT INTO notifications (id, taskId, message, status, createdAt) VALUES (?, ?, ?, ?, ?)', [notification.id, notification.taskId, notification.message, notification.status, notification.createdAt]);

  logger('info', 'notification sent', { correlationId: req.correlationId, taskId, notificationId: notification.id });
  return res.status(201).json({ message: 'Notification sent', notification });
});

init().then(() => {
  app.listen(PORT, () => {
    logger('info', 'notification service started', { port: PORT });
  });
}).catch((error) => {
  console.error('Failed to initialize notification service', error);
  process.exit(1);
});
