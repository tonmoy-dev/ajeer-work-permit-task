/**
 * db.js — SQLite database initialization for Ajeer Permit System
 * Uses better-sqlite3 (synchronous, zero-config)
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'permits.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create the permits table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS permits (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    permit_number    TEXT    NOT NULL UNIQUE,
    laborer_name     TEXT    NOT NULL,
    occupation       TEXT    NOT NULL,
    id_number        TEXT    NOT NULL,
    nationality      TEXT    NOT NULL,
    provider_name    TEXT    NOT NULL,
    provider_num     TEXT    NOT NULL,
    beneficiary_name TEXT    NOT NULL,
    beneficiary_num  TEXT    NOT NULL,
    contract_desc    TEXT    DEFAULT '',
    start_date       TEXT    NOT NULL,
    end_date         TEXT    NOT NULL,
    work_location    TEXT    DEFAULT '',
    status           TEXT    DEFAULT 'active',
    created_at       DATETIME DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_id_number     ON permits(id_number);
  CREATE INDEX IF NOT EXISTS idx_permit_number ON permits(permit_number);
`);

console.log(`✅ SQLite database ready at: ${DB_PATH}`);

module.exports = db;
