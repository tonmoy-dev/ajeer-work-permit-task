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
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

// Initialize DB (creates permits.db & users table if not exists)
const db = require('./db');

const permitsRouter = require('./routes/permits');
const { router: authRouter, requireAuth, parseSession } = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

// ── Middleware ─────────────────────────────────────────────────
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Search Engine De-indexing & Crawl Prevention ───────────────
// Method B: Server-level X-Robots-Tag header (drops existing indexed pages in Google)
app.use((req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    next();
});

// Method A: robots.txt route (stops crawlers from crawling)
app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send('User-agent: *\nDisallow: /\n');
});

// ── Frontend config generated from .env ────────────────────────
app.get('/config.js', (req, res) => {
    res.type('application/javascript').send(`window.APP_CONFIG = { BASE_URL: ${JSON.stringify(BASE_URL)} };`);
});

// ── Authentication API Routes ──────────────────────────────────
app.use('/api/auth', authRouter);

// ── Permits API Routes ─────────────────────────────────────────
app.use('/api/permits', permitsRouter);

// ── Protected Page Routes ──────────────────────────────────────
// Unauthenticated access redirects immediately to login (/)
app.get(['/permit-form.html', '/permit-form'], requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'permit-form.html'));
});

app.get(['/document.html', '/document'], requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'document.html'));
});

// ── Verification Page Route (Private / Validated ID only) ───────
// Validates query param ?id=<id_number | permit_number> in SQLite.
// If missing or not found in DB, redirects to /not-found.html
app.get(['/verify.html', '/verify'], (req, res) => {
    const id = (req.query.id || '').trim();
    if (!id) {
        return res.redirect('/not-found.html');
    }

    const permit = db.prepare(
        'SELECT id FROM permits WHERE id_number = ? OR permit_number = ? LIMIT 1'
    ).get(id, id);

    if (!permit) {
        return res.redirect('/not-found.html');
    }

    res.sendFile(path.join(__dirname, 'verify.html'));
});

// ── Not Found / Invalid Access Page ────────────────────────────
app.get(['/not-found.html', '/not-found'], (req, res) => {
    res.sendFile(path.join(__dirname, 'not-found.html'));
});

// ── Login / Home Page (/) ──────────────────────────────────────
// If user already logged in, redirect straight to /permit-form.html
app.get(['/', '/index.html'], (req, res) => {
    const session = parseSession(req);
    if (session) {
        return res.redirect('/permit-form.html');
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ── Serve public static files ──────────────────────────────────
// Block direct static access to protected HTML pages (bypass prevention)
const PROTECTED_PAGES = ['permit-form.html', 'document.html'];
app.use((req, res, next) => {
    const urlPath = req.path.replace(/^\//, '');
    if (PROTECTED_PAGES.includes(urlPath)) {
        const session = parseSession(req);
        if (!session) return res.redirect('/');
    }
    next();
});
// verify.html, images, logos, etc.
app.use(express.static(path.join(__dirname)));

// ── Health Check ───────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Ajeer Permit System',
        timestamp: new Date().toISOString()
    });
});

// ── Catch-all: redirect to app or login ────────────────────────
app.get('*', (req, res) => {
    const session = parseSession(req);
    if (session) {
        return res.redirect('/permit-form.html');
    }
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
    console.log('║   🔐 Auth: /api/auth                          ║');
    console.log('║   🛡️ Protected: /permit-form.html             ║');
    console.log('╚═══════════════════════════════════════════════╝');
    console.log('');
});
