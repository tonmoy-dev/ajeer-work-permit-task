/**
 * server.js — Ajeer Permit System Backend
 * Node.js + Express + SQLite
 *
 * Usage:
 *   npm install
 *   npm start          → production
 *   npm run dev        → development (auto-reload with nodemon)
 *
 * Then open: http://localhost:3000
 */

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

// Initialize DB (creates permits.db if not exists)
require('./db');

const permitsRouter = require('./routes/permits');

const app  = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

// ── Middleware ─────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Frontend config generated from .env ────────────────────────
app.get('/config.js', (req, res) => {
    res.type('application/javascript').send(`window.APP_CONFIG = { BASE_URL: ${JSON.stringify(BASE_URL)} };`);
});

// ── Serve static HTML files ────────────────────────────────────
// index.html, document.html, verify.html live in the root folder
app.use(express.static(path.join(__dirname)));

// ── API Routes ─────────────────────────────────────────────────
app.use('/api/permits', permitsRouter);

// ── Health Check ───────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Ajeer Permit System',
        timestamp: new Date().toISOString()
    });
});

// ── Catch-all: serve index.html for unknown routes ─────────────
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Error handler ──────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err.message);
    res.status(500).json({ error: 'Internal server error', details: err.message });
});

// ── Start server ───────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════════╗');
    console.log('║       Ajeer Permit System — Backend           ║');
    console.log(`║   🚀 Server running at http://localhost:${PORT}  ║`);
    console.log('║   📁 Database: permits.db                     ║');
    console.log('║   📄 API: /api/permits                        ║');
    console.log('╚═══════════════════════════════════════════════╝');
    console.log('');
});
