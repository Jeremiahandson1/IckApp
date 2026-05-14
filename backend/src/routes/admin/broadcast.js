// Admin: email + push broadcast composer.
//
// POST /admin/broadcast
//   body: { subject, body, segment, channels }
//     segment   = 'all' | 'premium' | 'verified' | 'trial' | 'free'
//     channels  = subset of ['email', 'push']
//
// GET /admin/broadcast/segments  → recipient counts per segment
//
// Both channels reuse existing helpers (broadcastPush, sendBroadcastEmail) so
// concurrency control and provider quirks are handled in one place.

import express from 'express';
import pool from '../../db/init.js';
import { logAdminAction } from '../../utils/adminAudit.js';
import { broadcastPush } from '../../services/pushNotifications.js';
import { sendBroadcastEmail } from '../../services/email.js';

const router = express.Router();

const SEGMENT_SQL = {
  all:      `SELECT id, email FROM users`,
  verified: `SELECT id, email FROM users WHERE email_verified_at IS NOT NULL`,
  premium:  `SELECT u.id, u.email FROM users u
             JOIN subscriptions s ON s.user_id = u.id
             WHERE s.status = 'active' AND s.plan IN ('monthly','yearly','comp')`,
  trial:    `SELECT u.id, u.email FROM users u
             JOIN subscriptions s ON s.user_id = u.id
             WHERE s.plan = 'trial' AND s.status = 'active'`,
  free:     `SELECT u.id, u.email FROM users u
             LEFT JOIN subscriptions s ON s.user_id = u.id
             WHERE s.user_id IS NULL OR s.plan = 'free' OR s.status <> 'active'`,
};

router.get('/segments', async (req, res) => {
  try {
    const out = {};
    for (const [key, sql] of Object.entries(SEGMENT_SQL)) {
      const r = await pool.query(`SELECT COUNT(*)::int AS n FROM (${sql}) x`);
      out[key] = r.rows[0].n;
    }
    res.json({ segments: out });
  } catch (err) {
    console.error('broadcast /segments error:', err);
    res.status(500).json({ error: 'Failed to load segments' });
  }
});

router.post('/', async (req, res) => {
  const { subject = '', body = '', segment = 'all', channels = ['email'] } = req.body || {};

  if (!body.trim()) return res.status(400).json({ error: 'Body required' });
  if (!Array.isArray(channels) || channels.length === 0)
    return res.status(400).json({ error: 'At least one channel required' });
  if (channels.includes('email') && !subject.trim())
    return res.status(400).json({ error: 'Subject required for email' });

  const sql = SEGMENT_SQL[segment];
  if (!sql) return res.status(400).json({ error: 'Unknown segment' });

  try {
    const recipients = (await pool.query(sql)).rows;
    if (recipients.length === 0) {
      return res.json({ ok: true, recipients: 0, email: null, push: null });
    }

    const result = { ok: true, recipients: recipients.length, email: null, push: null };

    if (channels.includes('email')) {
      const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0a0a0a;padding:32px;color:#e5e5e5;">
        <div style="max-width:560px;margin:0 auto;background:#161616;border:1px solid #2a2a2a;border-radius:16px;padding:32px;">
          <h2 style="color:#c8f135;margin:0 0 16px;font-family:'Bebas Neue',sans-serif;letter-spacing:1px;">${subject.replace(/</g, '&lt;')}</h2>
          <div style="line-height:1.6;font-size:15px;white-space:pre-wrap;">${body.replace(/</g, '&lt;')}</div>
        </div>
      </div>`;
      result.email = await sendBroadcastEmail({
        recipients: recipients.map(r => r.email).filter(Boolean),
        subject,
        html,
        text: body,
      });
    }

    if (channels.includes('push')) {
      result.push = await broadcastPush(recipients, {
        title: subject || 'Ick',
        body,
        url: '/',
        tag: 'admin-broadcast',
      });
    }

    await logAdminAction(req, 'broadcast', 'segment', segment, {
      subject, channels, recipients: recipients.length,
      email: result.email, push: result.push,
    });

    res.json(result);
  } catch (err) {
    console.error('broadcast error:', err);
    res.status(500).json({ error: 'Broadcast failed' });
  }
});

export default router;
