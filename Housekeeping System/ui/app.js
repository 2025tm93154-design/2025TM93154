const actions = {
  refresh: '/api/report',
  start: '/api/action/start',
  stop: '/api/action/stop',
  reservation: '/api/action/reservation',
  'room-hold': '/api/action/room-hold',
  task: '/api/action/task',
  notification: '/api/action/notification',
  'task-status': '/api/action/task-status',
  'run-suite': '/api/action/run-suite',
};

const serviceFields = {
  reservation: [
    { name: 'guestName', label: 'Guest Name', type: 'text', value: 'UI Guest' },
    { name: 'roomType', label: 'Room Type', type: 'select', value: 'STANDARD', options: ['STANDARD', 'DELUXE', 'SUITE'] },
    { name: 'checkInDate', label: 'Check-in Date', type: 'date', value: '2026-11-30' },
    { name: 'nights', label: 'Nights', type: 'number', value: '1' },
  ],
  'room-hold': [
    { name: 'roomType', label: 'Room Type', type: 'select', value: 'STANDARD', options: ['STANDARD', 'DELUXE', 'SUITE'] },
    { name: 'reservationId', label: 'Reservation ID', type: 'text', value: 'ui-room-hold-' + Date.now() },
    { name: 'holdSeconds', label: 'Hold Seconds', type: 'number', value: '30' },
  ],
  task: [
    { name: 'reservationId', label: 'Reservation ID', type: 'text', value: 'ui-task-' + Date.now() },
    { name: 'roomType', label: 'Room Type', type: 'select', value: 'STANDARD', options: ['STANDARD', 'DELUXE', 'SUITE'] },
    { name: 'taskType', label: 'Task Type', type: 'select', value: 'room-cleaning', options: ['room-cleaning', 'linen-change', 'deep-clean'] },
    { name: 'assignedStaff', label: 'Assigned Staff', type: 'text', value: 'Housekeeper Team UI' },
  ],
  notification: [
    { name: 'taskId', label: 'Task ID', type: 'text', value: 'demo-task-' + Date.now() },
    { name: 'message', label: 'Message', type: 'text', value: 'UI demo notification from housekeeping dashboard.' },
  ],
};

function renderDynamicFields(serviceName = 'reservation') {
  const container = document.getElementById('dynamicFields');
  if (!container) return;

  const fields = serviceFields[serviceName] || serviceFields.reservation;
  container.innerHTML = '';

  fields.forEach((field) => {
    const wrapper = document.createElement('label');
    wrapper.style.display = 'grid';
    wrapper.style.gap = '8px';
    wrapper.innerHTML = `<div style="font-weight: bold;">${field.label}</div>`;

    if (field.type === 'select') {
      const select = document.createElement('select');
      select.name = field.name;
      select.style.padding = '10px 12px';
      select.style.borderRadius = '8px';
      select.style.border = '1px solid var(--line)';
      field.options.forEach((option) => {
        const optionEl = document.createElement('option');
        optionEl.value = option;
        optionEl.textContent = option;
        if (option === field.value) optionEl.selected = true;
        select.appendChild(optionEl);
      });
      wrapper.appendChild(select);
    } else {
      const input = document.createElement('input');
      input.name = field.name;
      input.type = field.type;
      input.value = field.value;
      input.style.padding = '10px 12px';
      input.style.borderRadius = '8px';
      input.style.border = '1px solid var(--line)';
      wrapper.appendChild(input);
    }

    container.appendChild(wrapper);
  });
}

function collectServicePayload() {
  const serviceName = document.getElementById('serviceSelect').value;
  const fields = serviceFields[serviceName] || serviceFields.reservation;
  const payload = {};

  fields.forEach((field) => {
    const el = document.querySelector(`[name="${field.name}"]`);
    if (!el) return;
    const rawValue = el.value;
    if (rawValue === '' || rawValue === null || rawValue === undefined) return;

    const numericFields = ['nights', 'holdSeconds'];
    payload[field.name] = numericFields.includes(field.name) ? Number(rawValue) : rawValue;
  });

  return payload;
}

async function callAction(action) {
  const endpoint = actions[action];
  const response = await fetch(endpoint, {
    method: action === 'refresh' ? 'GET' : 'POST',
    headers: action === 'refresh' ? {} : { 'Content-Type': 'application/json' },
    body: action === 'refresh' ? undefined : JSON.stringify({}),
  });

  const payload = await response.json();
  const output = document.getElementById('actionOutput');
  output.textContent = JSON.stringify(payload, null, 2);

  if (action === 'run-suite' && payload.report) {
    const reportText = JSON.stringify(payload.report, null, 2);
    const reportWindow = window.open('', '_blank');
    if (reportWindow) {
      reportWindow.document.write('<pre style="font-family: monospace; white-space: pre-wrap; padding: 20px;">' + escapeHtml(reportText) + '</pre>');
      reportWindow.document.title = 'Failure Suite Report';
    }
    output.textContent = 'Automated suite completed. Report opened in a new tab.\n\n' + reportText;
  }

  if (action !== 'refresh' && payload.report) {
    renderReport(payload.report);
  }

  if (action === 'refresh' || action === 'start' || action === 'stop') {
    renderReport(payload.report || payload);
  }

  return payload;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function submitSelectedService() {
  const serviceName = document.getElementById('serviceSelect').value;
  const payload = collectServicePayload();
  const response = await fetch(`/api/action/${serviceName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  const output = document.getElementById('actionOutput');
  output.textContent = JSON.stringify(result, null, 2);

  if (result.report) {
    renderReport(result.report);
  }

  if (serviceName === 'task') {
    await loadTaskOptions();
  }

  return result;
}

async function loadTaskOptions() {
  const taskSelect = document.getElementById('taskStatusTask');
  const taskStatusOutput = document.getElementById('taskStatusOutput');
  if (!taskSelect) return;

  try {
    const response = await fetch('/api/tasks');
    const payload = await response.json();
    const tasks = Array.isArray(payload.tasks) ? payload.tasks : Array.isArray(payload) ? payload : [];
    taskSelect.innerHTML = '<option value="">Select a task</option>';
    tasks.forEach((task) => {
      const option = document.createElement('option');
      option.value = task.id;
      option.textContent = `${task.taskType} (${task.status})`;
      taskSelect.appendChild(option);
    });

    if (taskStatusOutput) {
      taskStatusOutput.textContent = tasks.length ? `Loaded ${tasks.length} task(s).` : 'No tasks available yet.';
    }
  } catch (error) {
    if (taskStatusOutput) {
      taskStatusOutput.textContent = `Could not load tasks: ${error.message}`;
    }
  }
}

async function updateTaskStatusFromUI() {
  const taskId = document.getElementById('taskStatusTask')?.value;
  const status = document.getElementById('taskStatusValue')?.value;
  const output = document.getElementById('taskStatusOutput');

  if (!taskId || !status) {
    if (output) output.textContent = 'Please choose a task and a status.';
    return;
  }

  try {
    const response = await fetch('/api/action/task-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, status }),
    });
    const payload = await response.json();
    if (output) output.textContent = JSON.stringify(payload, null, 2);
    await loadTaskOptions();
  } catch (error) {
    if (output) output.textContent = `Update failed: ${error.message}`;
  }
}

function renderReport(report) {
  const rows = document.getElementById('serviceRows');
  const reportOutput = document.getElementById('reportOutput');
  const overallStatus = document.getElementById('overallStatus');

  if (!report || !Array.isArray(report.services)) {
    reportOutput.textContent = JSON.stringify(report || {}, null, 2);
    return;
  }

  rows.innerHTML = '';

  report.services.forEach((service) => {
    const row = document.createElement('tr');
    const statusClass = service.status === 'success' ? 'badge-success' : 'badge-error';
    const badge = `<span class="badge ${statusClass}">${service.status}</span>`;
    row.innerHTML = `
      <td>${service.name}</td>
      <td>${service.url}</td>
      <td>${badge}</td>
    `;
    rows.appendChild(row);
  });

  const isHealthy = report.overallStatus === 'success';
  overallStatus.textContent = isHealthy ? 'All services are running successfully' : 'One or more services failed';
  overallStatus.className = `status-banner ${isHealthy ? 'status-success' : 'status-error'}`;
  reportOutput.textContent = JSON.stringify(report, null, 2);
}

async function loadReport() {
  try {
    const response = await fetch('/api/report');
    const report = await response.json();
    renderReport(report);
  } catch (error) {
    const overallStatus = document.getElementById('overallStatus');
    overallStatus.textContent = 'Could not load status report';
    overallStatus.className = 'status-banner status-error';
    document.getElementById('reportOutput').textContent = String(error);
  }
}

function wireButtons() {
  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const action = button.getAttribute('data-action');
      button.disabled = true;
      button.textContent = 'Running...';
      try {
        await callAction(action);
      } finally {
        button.disabled = false;
        const original = button.dataset.label || button.textContent.replace('Running...', '');
        button.textContent = original;
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-action]').forEach((button) => {
    button.dataset.label = button.textContent;
  });

  const serviceSelect = document.getElementById('serviceSelect');
  const submitButton = document.getElementById('submitServiceRequest');
  const updateTaskStatusButton = document.getElementById('updateTaskStatus');

  if (serviceSelect) {
    serviceSelect.addEventListener('change', (event) => {
      renderDynamicFields(event.target.value);
    });
  }

  if (submitButton) {
    submitButton.addEventListener('click', async () => {
      submitButton.disabled = true;
      submitButton.textContent = 'Sending...';
      try {
        await submitSelectedService();
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Send request';
      }
    });
  }

  if (updateTaskStatusButton) {
    updateTaskStatusButton.addEventListener('click', async () => {
      updateTaskStatusButton.disabled = true;
      updateTaskStatusButton.textContent = 'Updating...';
      try {
        await updateTaskStatusFromUI();
      } finally {
        updateTaskStatusButton.disabled = false;
        updateTaskStatusButton.textContent = 'Update status';
      }
    });
  }

  renderDynamicFields('reservation');
  wireButtons();
  loadReport();
  loadTaskOptions();
});
