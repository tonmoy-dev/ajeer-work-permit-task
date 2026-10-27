/**
 * routes/permits.js — API routes for Ajeer Permit System
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('./auth');

// ── Helper: Generate TQ permit number ─────────────────────────
function generatePermitNumber(idNumber) {
    if (!idNumber) return 'TQ' + Math.floor(100000 + Math.random() * 900000);
    const cleanId = String(idNumber).replace(/\D/g, '');
    let num;
    if (cleanId.length >= 6) {
        num = cleanId.slice(-6);
    } else if (cleanId.length > 0) {
        num = cleanId.padStart(6, '0');
    } else {
        num = '100000';
    }
    return 'TQ' + num;
}

// ── Helper: Compute status based on date ─────────────────────────
function computeStatus(endDate) {
    if (!endDate) return 'active';
    // If format is YYYY-MM-DD, permit is valid through the entire end date (until 23:59:59.999)
    if (/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        const [y, m, d] = endDate.split('-').map(Number);
        const endOfDay = new Date(y, m - 1, d, 23, 59, 59, 999);
        return endOfDay < new Date() ? 'expired' : 'active';
    }
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return end < today ? 'expired' : 'active';
}



// ── POST /api/permits ──────────────────────────────────────────
// Submit a new permit (called from permit-form.html form, protected)
router.post('/', requireAuth, (req, res) => {
    const {
        laborerName, occupation, idNumber, nationality,
        providerName, providerNum,
        beneficiaryName, beneficiaryNum,
        contractDesc, startDate, endDate, workLocation
    } = req.body;

    // Basic validation
    const required = {
        laborerName, occupation, idNumber, nationality,
        providerName, providerNum,
        beneficiaryName, beneficiaryNum,
        startDate, endDate
    };
    for (const [key, val] of Object.entries(required)) {
        if (!val || String(val).trim() === '') {
            return res.status(400).json({ error: `Missing required field: ${key}` });
        }
    }

    // Calculate status based on dates before saving to database
    const status = computeStatus(endDate);

    // Check if a permit for this ID already exists today — if so, reuse it
    const existing = db.prepare(
        `SELECT * FROM permits WHERE id_number = ? ORDER BY created_at DESC LIMIT 1`
    ).get(idNumber);

    if (existing) {
        // Update existing record
        db.prepare(`
            UPDATE permits SET
                laborer_name     = ?,
                occupation       = ?,
                nationality      = ?,
                provider_name    = ?,
                provider_num     = ?,
                beneficiary_name = ?,
                beneficiary_num  = ?,
                contract_desc    = ?,
                start_date       = ?,
                end_date         = ?,
                work_location    = ?,
                status           = ?
            WHERE id = ?
        `).run(
            laborerName, occupation, nationality,
            providerName, providerNum,
            beneficiaryName, beneficiaryNum,
            contractDesc || '', startDate, endDate,
            workLocation || '', status,
            existing.id
        );

        const updated = db.prepare('SELECT * FROM permits WHERE id = ?').get(existing.id);
        return res.status(200).json({
            success: true,
            message: 'Permit updated successfully',
            permit: formatPermit(updated)
        });
    }

    // Insert new permit
    const permitNumber = generatePermitNumber(idNumber);

    const stmt = db.prepare(`
        INSERT INTO permits
            (permit_number, laborer_name, occupation, id_number, nationality,
             provider_name, provider_num, beneficiary_name, beneficiary_num,
             contract_desc, start_date, end_date, work_location, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
        permitNumber, laborerName, occupation, idNumber, nationality,
        providerName, providerNum, beneficiaryName, beneficiaryNum,
        contractDesc || '', startDate, endDate, workLocation || '', status
    );

    const permit = db.prepare('SELECT * FROM permits WHERE id = ?').get(info.lastInsertRowid);

    return res.status(201).json({
        success: true,
        message: 'Permit created successfully',
        permit: formatPermit(permit)
    });
});

// ── GET /api/permits/by-id/:idNumber ──────────────────────────
// Fetch permit by Iqama/ID number (used by document.html + verify.html)
router.get('/by-id/:idNumber', (req, res) => {
    const { idNumber } = req.params;

    const permit = db.prepare(
        `SELECT * FROM permits WHERE id_number = ? OR permit_number = ? ORDER BY created_at DESC LIMIT 1`
    ).get(idNumber, idNumber);

    if (!permit) {
        return res.status(404).json({ error: 'Permit not found', idNumber });
    }

    return res.json({ success: true, permit: formatPermit(permit) });
});

// ── GET /api/permits/by-permit/:permitNumber ──────────────────
// Fetch permit by TQ number (QR code contains this)
router.get('/by-permit/:permitNumber', (req, res) => {
    const { permitNumber } = req.params;

    const permit = db.prepare(
        `SELECT * FROM permits WHERE permit_number = ?`
    ).get(permitNumber);

    if (!permit) {
        return res.status(404).json({ error: 'Permit not found', permitNumber });
    }

    return res.json({ success: true, permit: formatPermit(permit) });
});

// ── GET /api/permits (Disabled for security) ────────────────────
router.get('/', (req, res) => {
    const permits = db.prepare(
        `SELECT * FROM permits ORDER BY created_at DESC LIMIT 100`
    ).all();

    return res.json({
        success: true,
        count: permits.length,
        permits: permits.map(formatPermit)
    });
});

// ── DELETE /api/permits/:permitNumber ─────────────────────────
// Revoke a permit
// router.delete('/:permitNumber', (req, res) => {
//     const { permitNumber } = req.params;

//     const permit = db.prepare('SELECT * FROM permits WHERE permit_number = ?').get(permitNumber);
//     if (!permit) {
//         return res.status(404).json({ error: 'Permit not found' });
//     }

//     db.prepare(`UPDATE permits SET status = 'revoked' WHERE permit_number = ?`).run(permitNumber);

//     return res.json({ success: true, message: `Permit ${permitNumber} revoked` });
// });

// ── Format helper: snake_case DB → camelCase API response ─────
function formatPermit(p) {
    return {
        id: p.id,
        permitNumber: p.permit_number,
        laborerName: p.laborer_name,
        occupation: p.occupation,
        idNumber: p.id_number,
        nationality: p.nationality,
        providerName: p.provider_name,
        providerNum: p.provider_num,
        beneficiaryName: p.beneficiary_name,
        beneficiaryNum: p.beneficiary_num,
        contractDesc: p.contract_desc,
        startDate: p.start_date,
        endDate: p.end_date,
        workLocation: p.work_location,
        status: p.status || 'active',
        createdAt: p.created_at
    };
}

module.exports = router;
