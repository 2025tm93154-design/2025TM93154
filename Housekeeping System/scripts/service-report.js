const fs = require('fs');
const path = require('path');

const services = [
  { name: 'reservation-service', url: 'http://localhost:3201/health' },
  { name: 'room-service', url: 'http://localhost:3202/health' },
  { name: 'task-service', url: 'http://localhost:3203/health' },
  { name: 'notification-service', url: 'http://localhost:3204/health' },
];

async function checkService(service) {
  try {
    const response = await fetch(service.url);
    const body = await response.text();
    return {
      name: service.name,
      url: service.url,
      status: response.ok ? 'success' : 'error',
      statusCode: response.status,
      body,
    };
  } catch (error) {
    return {
      name: service.name,
      url: service.url,
      status: 'error',
      statusCode: 0,
      body: error.message,
    };
  }
}

async function checkReservationFlow() {
  const reservationUrl = 'http://localhost:3201/api/v1/reservations';
  const payload = {
    guestName: 'UI Guest',
    roomType: 'STANDARD',
    checkInDate: '2026-11-25',
    nights: 1,
  };

  try {
    const response = await fetch(reservationUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `report-${Date.now()}`,
      },
      body: JSON.stringify(payload),
    });
    const body = await response.text();
    return {
      name: 'reservation-flow',
      status: response.ok ? 'success' : 'error',
      statusCode: response.status,
      body,
    };
  } catch (error) {
    return {
      name: 'reservation-flow',
      status: 'error',
      statusCode: 0,
      body: error.message,
    };
  }
}

(async () => {
  const results = await Promise.all(services.map(checkService));
  const reservationFlow = await checkReservationFlow();

  const report = {
    generatedAt: new Date().toISOString(),
    overallStatus: results.every((service) => service.status === 'success') && reservationFlow.status === 'success' ? 'success' : 'error',
    services: results,
    endToEnd: reservationFlow,
  };

  const reportDir = path.join(__dirname, '..', 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, 'service-run-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));
})();
