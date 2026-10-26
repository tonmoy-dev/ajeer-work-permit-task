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

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    salt          TEXT    NOT NULL,
    created_at    DATETIME DEFAULT (datetime('now'))
  );
`);

console.log(`✅ SQLite database ready at: ${DB_PATH}`);

// ── Auth & Password Helpers ────────────────────────────────────
const crypto = require('crypto');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return { hash, salt };
}

function verifyPassword(password, storedHash, salt) {
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

function seedDefaultUser(username, password) {
    const checkStmt = db.prepare('SELECT id FROM users WHERE username = ?');
    const existing = checkStmt.get(username);
    if (!existing) {
        const { hash, salt } = hashPassword(password);
        const insertStmt = db.prepare('INSERT INTO users (username, password_hash, salt) VALUES (?, ?, ?)');
        insertStmt.run(username, hash, salt);
        console.log(`👤 Seeded default user: ${username}`);
    }
}

// Seed the initial default administrator
seedDefaultUser('admin@ajeers.com', 'ajeers_admin');

// Seed default permit for 2602301927 if not present
function seedDefaultPermit() {
    const existing = db.prepare('SELECT id FROM permits WHERE id_number = ?').get('2602301927');
    if (!existing) {
        db.prepare(`
            INSERT INTO permits (
                permit_number, laborer_name, occupation, id_number, nationality,
                provider_name, provider_num, beneficiary_name, beneficiary_num,
                contract_desc, start_date, end_date, work_location, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `).run(
            'TQ301927',
            'MD KHAIRUL ISLAM',
            'عامل تحميل وتنزيل',
            '2602301927',
            'بنجلاديش',
            'مؤسسة منيف عبد الله حسين الدوسري للتاجر',
            '2-2-681349',
            'مؤسسة مهارت الانجاز للمقاولات',
            '1-4242031',
            'Joint cooperation between the two companies',
            '2026-10-10',
            '2027-04-09',
            'الرياض، المملكة العربية السعودية'
        );
        console.log('📄 Seeded default permit: 2602301927 (TQ301927)');
    }
}
seedDefaultPermit();

function verifyUserCredentials(username, password) {
    if (!username || !password) return null;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
    if (!user) return null;
    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) return null;
    return { id: user.id, username: user.username };
}

db.hashPassword = hashPassword;
db.verifyPassword = verifyPassword;
db.verifyUserCredentials = verifyUserCredentials;

module.exports = db;
