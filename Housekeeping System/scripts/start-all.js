const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pidFile = path.join(root, 'reports', 'service-pids.json');
const services = [
  {
    name: 'reservation-service',
    cwd: path.join(root, 'services', 'reservation-service'),
    port: 3201,
    env: {
      RESET_DB: '1',
      PORT: '3201',
      ROOM_SERVICE_URL: 'http://localhost:3202',
      TASK_SERVICE_URL: 'http://localhost:3203',
      NOTIFICATION_SERVICE_URL: 'http://localhost:3204',
    },
  },
  {
    name: 'room-service',
    cwd: path.join(root, 'services', 'room-service'),
    port: 3202,
    env: {
      RESET_DB: '1',
      PORT: '3202',
    },
  },
  {
    name: 'task-service',
    cwd: path.join(root, 'services', 'task-service'),
    port: 3203,
    env: {
      RESET_DB: '1',
      PORT: '3203',
      NOTIFICATION_SERVICE_URL: 'http://localhost:3204',
    },
  },
  {
    name: 'notification-service',
    cwd: path.join(root, 'services', 'notification-service'),
    port: 3204,
    env: {
      RESET_DB: '1',
      PORT: '3204',
    },
  },
];

const children = [];

for (const svc of services) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: svc.cwd,
    env: { ...process.env, ...svc.env },
    detached: true,
    stdio: 'ignore',
  });

  child.on('exit', (code, signal) => {
    console.log(`${svc.name} exited with code ${code} signal ${signal}`);
  });

  children.push(child);
}

const ui = spawn(process.execPath, [path.join(root, 'ui', 'server.js')], {
  cwd: root,
  env: { ...process.env, UI_PORT: '4100' },
  detached: true,
  stdio: 'ignore',
});

ui.on('exit', (code, signal) => {
  console.log(`ui-server exited with code ${code} signal ${signal}`);
});

children.push(ui);

fs.mkdirSync(path.dirname(pidFile), { recursive: true });
fs.writeFileSync(pidFile, JSON.stringify({ pids: children.map((child) => child.pid) }, null, 2));

console.log('Started housekeeping services on ports 3201-3204 and dashboard at http://localhost:4100');
console.log('Use Ctrl+C in this terminal or run: npm run stop');
process.exit(0);
