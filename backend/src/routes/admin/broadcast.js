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
    const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#0a0a0a;padding:32px;color:#e5e5e5;">
      <div style="max-width:560px;margin:0 auto;background:#161616;border:1px solid #2a2a2a;border-radius:16px;padding:32px;">
        <h2 style="color:#c8f135;margin:0 0 16px;font-family:'Bebas Neue',sans-serif;letter-spacing:1px;">${subject.replace(/</g, '&lt;')}</h2>
        <div style="line-height:1.6;font-size:15px;white-space:pre-wrap;">${body.replace(/</g, '&lt;')}</div>
      </div>
    </div>`;

    // Fetch recipients in keyset-paginated batches so a large user base never
    // sits in the heap all at once (the server runs with a 450MB old-space cap).
    const BATCH_SIZE = 1000;
    const emailTotals = { sent: 0, failed: 0 };
    const pushTotals = { sent: 0, failed: 0, expired: 0, no_sub: 0 };
    let recipientCount = 0;
    let lastId = null;

    for (;;) {
      const { rows } = await pool.query(
        `SELECT * FROM (${sql}) seg
         WHERE $1::uuid IS NULL OR seg.id > $1
         ORDER BY seg.id
         LIMIT $2`,
        [lastId, BATCH_SIZE]
      );
      if (rows.length === 0) break;
      recipientCount += rows.length;
      lastId = rows[rows.length - 1].id;

      if (channels.includes('email')) {
        const r = await sendBroadcastEmail({
          recipients: rows.map(r => r.email).filter(Boolean),
          subject,
          html,
          text: body,
        });
        emailTotals.sent += r.sent;
        emailTotals.failed += r.failed;
      }

      if (channels.includes('push')) {
        const p = await broadcastPush(rows, {
          title: subject || 'Ick',
          body,
          url: '/',
          tag: 'admin-broadcast',
        });
        pushTotals.sent += p.sent;
        pushTotals.failed += p.failed;
        pushTotals.expired += p.expired;
        pushTotals.no_sub += p.no_sub;
      }

      if (rows.length < BATCH_SIZE) break;
    }

    const result = {
      ok: true,
      recipients: recipientCount,
      email: recipientCount > 0 && channels.includes('email') ? emailTotals : null,
      push: recipientCount > 0 && channels.includes('push') ? pushTotals : null,
    };

    if (recipientCount > 0) {
      await logAdminAction(req, 'broadcast', 'segment', segment, {
        subject, channels, recipients: recipientCount,
        email: result.email, push: result.push,
      });
    }

    res.json(result);
  } catch (err) {
    console.error('broadcast error:', err);
    res.status(500).json({ error: 'Broadcast failed' });
  }
});

export default router;
