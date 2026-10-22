const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pidFile = path.join(root, 'reports', 'service-pids.json');

function stopPid(pid) {
  if (!pid || Number.isNaN(Number(pid))) return;
  try {
    execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
  } catch (error) {
    // Ignore if already exited.
  }
}

if (fs.existsSync(pidFile)) {
  try {
    const data = JSON.parse(fs.readFileSync(pidFile, 'utf8'));
    const pids = Array.isArray(data.pids) ? data.pids : [];
    pids.forEach(stopPid);
  } catch (error) {
    console.log('No tracked service processes were running.');
  }
}

function deleteDbFiles() {
  const serviceDirs = ['services/room-service', 'services/task-service', 'services/notification-service', 'services/reservation-service'];

  for (const dir of serviceDirs) {
    const dataDir = path.join(root, dir, 'data');
    if (!fs.existsSync(dataDir)) continue;

    for (const file of fs.readdirSync(dataDir)) {
      if (!file.endsWith('.db')) continue;

      const filePath = path.join(dataDir, file);
      for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
          fs.unlinkSync(filePath);
          break;
        } catch (error) {
          if (error.code !== 'EBUSY') throw error;
          const waitMs = 250;
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, waitMs);
        }
      }
    }
  }
}

deleteDbFiles();

if (fs.existsSync(pidFile)) {
  fs.unlinkSync(pidFile);
}

console.log('Stopped the tracked housekeeping service processes and cleared the service databases.');
