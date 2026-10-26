/**
 * routes/auth.js — Authentication routes & middleware for Ajeer Permit System
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');

const SESSION_SECRET = process.env.SESSION_SECRET || 'ajeer_work_permit_secure_session_secret_2026';
const COOKIE_NAME = 'ajeer_session';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Token Helpers (HMAC-SHA256 signed session token) ───────────
function createToken(user) {
    const payload = JSON.stringify({
        id: user.id,
        username: user.username,
        exp: Date.now() + SESSION_DURATION_MS
    });
    const b64Payload = Buffer.from(payload).toString('base64url');
    const signature = crypto.createHmac('sha256', SESSION_SECRET).update(b64Payload).digest('hex');
    return `${b64Payload}.${signature}`;
}

function verifyToken(token) {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [b64Payload, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(b64Payload).digest('hex');

    if (signature.length !== expectedSig.length) return null;
    const isValidSig = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig));
    if (!isValidSig) return null;

    try {
        const payloadStr = Buffer.from(b64Payload, 'base64url').toString('utf8');
        const data = JSON.parse(payloadStr);
        if (data.exp && data.exp > Date.now()) {
            return data;
        }
    } catch {
        return null;
    }
    return null;
}

// ── Authentication Middleware ─────────────────────────────────
function requireAuth(req, res, next) {
    const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
    const session = verifyToken(token);

    if (session) {
        req.user = session;
        return next();
    }

    // If client is requesting an API endpoint, return 401 JSON
    if (req.path.startsWith('/api/') || req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    // For page requests (e.g. /permit-form.html), redirect to login page
    return res.redirect('/');
}

// Optional helper to check current user without blocking
function parseSession(req) {
    const token = req.cookies ? req.cookies[COOKIE_NAME] : null;
    return verifyToken(token);
}

// ── POST /api/auth/login ───────────────────────────────────────
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            error: 'Please enter both username/email and password / يرجى إدخال اسم المستخدم وكلمة المرور'
        });
    }

    const user = db.verifyUserCredentials(username, password);
    if (!user) {
        return res.status(401).json({
            error: 'Invalid credentials. Please verify and try again. / بيانات الاعتماد غير صحيحة، يرجى المحاولة مرة أخرى.'
        });
    }

    const token = createToken(user);

    // Set secure HTTP-only cookie
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: SESSION_DURATION_MS,
        path: '/'
    });

    return res.json({
        success: true,
        message: 'Logged in successfully',
        redirect: '/permit-form.html',
        user: { username: user.username }
    });
});

// ── POST /api/auth/logout ──────────────────────────────────────
router.post('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return res.json({ success: true, message: 'Logged out successfully' });
});

// ── GET /api/auth/check ────────────────────────────────────────
router.get('/check', (req, res) => {
    const session = parseSession(req);
    if (session) {
        return res.json({ authenticated: true, user: { username: session.username } });
    }
    return res.json({ authenticated: false });
});

module.exports = {
    router,
    requireAuth,
    parseSession,
    COOKIE_NAME
};
