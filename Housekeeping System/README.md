# Housekeeping System Microservices

This project implements a small microservices-based housekeeping application for a hotel or serviced apartment operation.

## Services

1. Reservation Service — handles guest room reservations and idempotent reservation requests.
2. Room Service — manages room inventory, room holds, room status, and concurrency-safe cleaning-slot allocation.
3. Task Service — creates and tracks housekeeping tasks assigned to staff.
4. Notification Service — simulates outbound staff alerts and notifications.

## Main transaction

The flow is:

Reservation -> Room hold -> Housekeeping task -> Notification

This satisfies the cross-service transaction requirement and demonstrates a real multi-service flow.

## Run all services

The easiest way is to use the project runner:

```powershell
cd "C:\Users\sivam\Downloads\BootStrap 5\Restaurant Equipment Lending\Housekeeping System"
npm install
npm start
```

This starts the four services together on the project ports and launches the dashboard UI automatically:

- Reservation Service: 3201
- Room Service: 3202
- Task Service: 3203
- Notification Service: 3204
- Dashboard UI: 4100

Then visit:

`http://localhost:4100`

The dashboard shows the health status of each service and the successful end-to-end reservation run.

You can also stop everything with:

```powershell
npm run stop
```

If you want to launch the dashboard only later, you can still run:

```powershell
cd "C:\Users\sivam\Downloads\BootStrap 5\Restaurant Equipment Lending\Housekeeping System"
npm run ui
```

## Generate the run report

```powershell
cd "C:\Users\sivam\Downloads\BootStrap 5\Restaurant Equipment Lending\Housekeeping System"
npm run report
```

This writes a JSON report to:

`Housekeeping System/reports/service-run-report.json`

If you want to start them manually, run one terminal per service:

```powershell
cd "C:\Users\sivam\Downloads\BootStrap 5\Restaurant Equipment Lending\Housekeeping System\services\reservation-service"
$env:PORT = "3201"
$env:ROOM_SERVICE_URL = "http://localhost:3202"
$env:TASK_SERVICE_URL = "http://localhost:3203"
$env:NOTIFICATION_SERVICE_URL = "http://localhost:3204"
node server.js
```

Each service is independent and uses its own SQLite database.

## Health check

Each service exposes:

- GET /health
- GET /api/v1/openapi.json

## Business rules

- BR1: A room may only be held once per reservation window.
- BR2: A reservation request with the same Idempotency-Key must be replayed without duplicate effects.
- BR3: A room cannot be assigned to an active housekeeping task while it is already under hold.
- BR4: A notification is valid only for a known task and cannot be created for a missing task.

## Challenges implemented

- Challenge 1: Concurrency control for room cleaning slots
- Challenge 2: Idempotent reservation and task requests
- Challenge 3: Time-bound room holds with release after expiry

## Test and evidence

Run the challenge scripts from the repository root:

```bash
node scripts/challenge-1-concurrency.js
node scripts/challenge-2-idempotency.js
node scripts/challenge-3-holds.js
```

The results are stored in the evidence folder.
