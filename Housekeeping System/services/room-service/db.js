const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'room.db');

if (process.env.RESET_DB === '1' && fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function init() {
  await run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      roomNumber TEXT NOT NULL,
      roomType TEXT NOT NULL,
      status TEXT NOT NULL,
      reservedUntil TEXT,
      version INTEGER NOT NULL DEFAULT 0,
      cleaningCapacity INTEGER NOT NULL DEFAULT 3,
      reservedSlots INTEGER NOT NULL DEFAULT 0
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS room_holds (
      id TEXT PRIMARY KEY,
      roomId TEXT NOT NULL,
      reservationId TEXT NOT NULL,
      holdSeconds INTEGER NOT NULL,
      expiresAt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE'
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS cleaning_slots (
      id TEXT PRIMARY KEY,
      shiftId TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      reserved INTEGER NOT NULL DEFAULT 0,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const count = await get('SELECT COUNT(*) as total FROM rooms');
  if ((count?.total || 0) === 0) {
    const seed = [
      ['room-101', '101', 'STANDARD', 'AVAILABLE', null, 0, 3, 0],
      ['room-102', '102', 'STANDARD', 'AVAILABLE', null, 0, 3, 0],
      ['room-201', '201', 'DELUXE', 'AVAILABLE', null, 0, 3, 0],
      ['room-202', '202', 'DELUXE', 'AVAILABLE', null, 0, 3, 0],
    ];

    for (const row of seed) {
      await run(
        `INSERT INTO rooms (id, roomNumber, roomType, status, reservedUntil, version, cleaningCapacity, reservedSlots)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        row,
      );
    }
  }

  const slotCount = await get('SELECT COUNT(*) as total FROM cleaning_slots WHERE shiftId = ?', ['day-shift']);
  if ((slotCount?.total || 0) === 0) {
    await run('INSERT INTO cleaning_slots (id, shiftId, capacity, reserved, updatedAt) VALUES (?, ?, ?, ?, ?)', ['slot-1', 'day-shift', 1, 0, new Date().toISOString()]);
  }
}

module.exports = { db, run, get, all, init };
