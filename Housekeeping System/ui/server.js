const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const uiDir = __dirname;
const reportDir = path.join(rootDir, 'reports');
const reportPath = path.join(reportDir, 'service-run-report.json');
const failureSuiteReportPath = path.join(reportDir, 'failure-scenarios-report.json');
const port = Number(process.env.UI_PORT || 4100);

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
  };
  return mime[ext] || 'application/octet-stream';
}

function buildReport() {
  try {
    const output = execFileSync(process.execPath, [path.join(rootDir, 'scripts', 'service-report.js')], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (fs.existsSync(reportPath)) {
      return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    }
    return { overallStatus: 'error', services: [], raw: output };
  } catch (error) {
    return {
      overallStatus: 'error',
      services: [],
      error: error.message,
      stdout: error.stdout ? String(error.stdout) : '',
      stderr: error.stderr ? String(error.stderr) : '',
    };
  }
}

function readReport() {
  if (fs.existsSync(reportPath)) {
    try {
      return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch (error) {
      return buildReport();
    }
  }
  return buildReport();
}

function readFailureSuiteReport() {
  if (fs.existsSync(failureSuiteReportPath)) {
    try {
      return JSON.parse(fs.readFileSync(failureSuiteReportPath, 'utf8'));
    } catch (error) {
      return { error: 'Failed to parse failure suite report', file: failureSuiteReportPath };
    }
  }
  return { error: 'Failure suite report not found', file: failureSuiteReportPath };
}

function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(rootDir, 'scripts', scriptName)], {
      cwd: rootDir,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ code, stdout, stderr });
      } else {
        reject(new Error(stderr || `Script exited with code ${code}`));
      }
    });
  });
}

async function callAction(action, body = {}) {
  const actionMap = {
    reservation: {
      method: 'POST',
      url: 'http://localhost:3201/api/v1/reservations',
      payload: {
        guestName: 'UI Guest',
        roomType: 'STANDARD',
        checkInDate: '2026-11-30',
        nights: 1,
      },
    },
    'room-hold': {
      method: 'POST',
      url: 'http://localhost:3202/api/v1/room-holds',
      payload: {
        roomType: 'STANDARD',
        reservationId: `ui-room-hold-${Date.now()}`,
        holdSeconds: 30,
      },
    },
    task: {
      method: 'POST',
      url: 'http://localhost:3203/api/v1/tasks',
      payload: {
        reservationId: `ui-task-${Date.now()}`,
        roomType: 'STANDARD',
        taskType: 'room-cleaning',
        assignedStaff: 'Housekeeper Team UI',
      },
    },
    notification: {
      method: 'POST',
      url: 'http://localhost:3204/api/v1/notifications',
      payload: {
        taskId: `demo-task-${Date.now()}`,
        message: 'UI demo notification from housekeeping dashboard.',
      },
    },
    refresh: {
      method: 'GET',
      url: 'http://localhost:3201/health',
      payload: {},
    },
  };

  const selected = actionMap[action] || actionMap.reservation;
  const finalPayload = { ...selected.payload, ...body };

  const response = await fetch(selected.url, {
    method: selected.method,
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `ui-${action}-${Date.now()}` },
    body: selected.method === 'POST' ? JSON.stringify(finalPayload) : undefined,
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return {
    action,
    ok: response.ok,
    status: response.status,
    result: data,
  };
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/report') {
    const report = readReport();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(report));
    return;
  }

  if (req.url === '/api/action/run-suite') {
    try {
      const child = spawn(process.execPath, ['--test', path.join(rootDir, 'tests', 'failure-scenarios.test.js')], {
        cwd: rootDir,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      await new Promise((resolve, reject) => {
        child.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(stderr || `Failure suite exited with code ${code}`));
          }
        });
      });

      const report = readFailureSuiteReport();
      const payload = {
        ok: true,
        report,
        reportUrl: '/reports/failure-scenarios-report.json',
        stdout,
        stderr,
      };

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(payload));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: error.message }));
    }
    return;
  }

  if (req.url === '/api/tasks') {
    try {
      const response = await fetch('http://localhost:3203/api/v1/tasks');
      const tasks = await response.json();
      res.writeHead(response.ok ? 200 : 500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: response.ok, tasks }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: error.message }));
    }
    return;
  }

  if (req.url === '/api/action/start') {
    try {
      await runScript('start-all.js');
      const report = readReport();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, message: 'All services started', report }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: error.message }));
    }
    return;
  }

  if (req.url === '/api/action/stop') {
    try {
      await runScript('stop-all.js');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, message: 'All services stopped' }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: error.message }));
    }
    return;
  }

  if (req.url.startsWith('/api/action/')) {
    const action = req.url.split('/').pop();
    try {
      const payload = JSON.parse(await streamBody(req));
      if (action === 'task-status') {
        const { taskId, status } = payload || {};
        const response = await fetch(`http://localhost:3203/api/v1/tasks/${taskId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
        const result = await response.json();
        const report = readReport();
        res.writeHead(response.ok ? 200 : 500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: response.ok, result, report }));
        return;
      }
      const result = await callAction(action, payload || {});
      const report = readReport();
      res.writeHead(result.ok ? 200 : 500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: result.ok, result, report }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: error.message }));
    }
    return;
  }

  let requestPath = req.url === '/' ? '/index.html' : req.url;
  requestPath = requestPath.split('?')[0];

  let filePath;
  if (requestPath.startsWith('/reports/')) {
    filePath = path.join(rootDir, requestPath);
  } else {
    filePath = path.join(uiDir, requestPath);
  }

  const allowedRoot = requestPath.startsWith('/reports/') ? rootDir : uiDir;
  if (!filePath.startsWith(allowedRoot)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType(filePath) });
    res.end(data);
  });
});

function streamBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      resolve(body || '{}');
    });
    req.on('error', reject);
  });
}

server.listen(port, () => {
  console.log(`UI dashboard running at http://localhost:${port}`);
});
