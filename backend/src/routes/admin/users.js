// Admin: user management.
// Every mutation logs to admin_actions.

import express from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import pool from '../../db/init.js';
import { JWT_SECRET, TOKEN_ISSUER, TOKEN_AUDIENCE } from '../../middleware/auth.js';
import { logAdminAction } from '../../utils/adminAudit.js';

const router = express.Router();

// Impersonation mints real user tokens — cap how fast a single admin account
// can do it so a compromised admin can't harvest sessions at scale.
const impersonateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `impersonate:${req.user.id}`,
  message: { error: 'Impersonation rate limit reached (10/hour). Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /admin/users — paginated, searchable list
router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    const where = [];
    const params = [];
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(`(LOWER(u.email) LIKE $${params.length} OR LOWER(u.name) LIKE $${params.length})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    params.push(limit, offset);
    const list = await pool.query(
      `SELECT u.id, u.email, u.name, u.zip_code, u.is_admin, u.created_at,
              u.email_verified_at,
              (SELECT COUNT(*) FROM scan_logs WHERE user_id = u.id) AS scans,
              s.plan AS sub_plan, s.status AS sub_status,
              s.trial_ends_at, s.expires_at
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id
       ${whereSql}
       ORDER BY u.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const total = await pool.query(
      `SELECT COUNT(*)::int AS n FROM users u ${whereSql}`,
      params.slice(0, params.length - 2)
    );

    res.json({ users: list.rows, total: total.rows[0].n, page, limit });
  } catch (err) {
    console.error('admin /users error:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

// GET /admin/users/:id — full detail
router.get('/:id', async (req, res) => {
  try {
    const u = await pool.query(
      `SELECT u.id, u.email, u.name, u.zip_code, u.kids_count, u.is_admin,
              u.created_at, u.email_verified_at, u.last_store,
              s.plan AS sub_plan, s.status AS sub_status,
              s.trial_started_at, s.trial_ends_at, s.expires_at, s.stripe_customer_id
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id
       WHERE u.id = $1`,
      [req.params.id]
    );
    if (u.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    const stats = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM scan_logs WHERE user_id = $1)::int AS scans,
        (SELECT COUNT(*) FROM pantry_items WHERE user_id = $1)::int AS pantry,
        (SELECT COUNT(*) FROM user_recipes WHERE user_id = $1)::int AS recipes_viewed,
        (SELECT COUNT(*) FROM product_contributions WHERE user_id = $1)::int AS contributions,
        (SELECT COUNT(*) FROM family_members WHERE user_id = $1)::int AS family_memberships`,
      [req.params.id]
    );

    res.json({ user: u.rows[0], stats: stats.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load user' });
  }
});

// GET /admin/users/:id/audit — actions targeting this user
router.get('/:id/audit', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, admin_email, action, details, created_at
       FROM admin_actions
       WHERE target_type = 'user' AND target_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [String(req.params.id)]
    );
    res.json({ actions: r.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load audit' });
  }
});

// PUT /admin/users/:id/admin — toggle admin role
router.put('/:id/admin', async (req, res) => {
  try {
    const { is_admin } = req.body;
    const r = await pool.query(
      `UPDATE users SET is_admin = $1 WHERE id = $2 RETURNING id, email, is_admin`,
      [!!is_admin, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    await logAdminAction(req, 'toggle_admin', 'user', req.params.id, {
      email: r.rows[0].email, is_admin: !!is_admin,
    });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update admin flag' });
  }
});

// POST /admin/users/:id/grant-trial — start or extend trial
router.post('/:id/grant-trial', async (req, res) => {
  try {
    const days = req.body.days === undefined ? 30 : parseInt(req.body.days, 10);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return res.status(400).json({ error: 'days must be an integer between 1 and 365' });
    }
    await pool.query(
      `INSERT INTO subscriptions (user_id, plan, status, trial_started_at, trial_ends_at)
       VALUES ($1, 'trial', 'active', NOW(), NOW() + ($2 || ' days')::interval)
       ON CONFLICT (user_id) DO UPDATE SET
         plan = 'trial', status = 'active',
         trial_started_at = COALESCE(subscriptions.trial_started_at, NOW()),
         trial_ends_at = GREATEST(subscriptions.trial_ends_at, NOW()) + ($2 || ' days')::interval`,
      [req.params.id, String(days)]
    );
    await logAdminAction(req, 'grant_trial', 'user', req.params.id, { days });
    res.json({ ok: true, days });
  } catch (err) {
    console.error('grant_trial error:', err);
    res.status(500).json({ error: 'Failed to grant trial' });
  }
});

// POST /admin/users/:id/comp-premium — grant comp lifetime (no expiry)
router.post('/:id/comp-premium', async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO subscriptions (user_id, plan, status, expires_at)
       VALUES ($1, 'comp', 'active', NULL)
       ON CONFLICT (user_id) DO UPDATE SET
         plan = 'comp', status = 'active', expires_at = NULL`,
      [req.params.id]
    );
    await logAdminAction(req, 'comp_premium', 'user', req.params.id, {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to comp premium' });
  }
});

// POST /admin/users/:id/cancel-subscription
router.post('/:id/cancel-subscription', async (req, res) => {
  try {
    await pool.query(
      `UPDATE subscriptions SET status = 'cancelled', plan = 'free' WHERE user_id = $1`,
      [req.params.id]
    );
    await logAdminAction(req, 'cancel_subscription', 'user', req.params.id, {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel' });
  }
});

// POST /admin/users/:id/impersonate — mint a 1-hour JWT for the target user.
// Token has an "imp" marker recording the original admin id so the app can
// show a banner and we have an audit trail when the imp uses any feature.
router.post('/:id/impersonate', impersonateLimiter, async (req, res) => {
  try {
    const u = await pool.query(
      `SELECT id, email FROM users WHERE id = $1`,
      [req.params.id]
    );
    if (u.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const target = u.rows[0];

    const token = jwt.sign(
      { id: target.id, email: target.email, imp: true, imp_by: req.user.id },
      JWT_SECRET,
      { expiresIn: '1h', issuer: TOKEN_ISSUER, audience: TOKEN_AUDIENCE }
    );

    await logAdminAction(req, 'impersonate', 'user', req.params.id, {
      email: target.email,
    });

    res.json({ token, user: { id: target.id, email: target.email } });
  } catch (err) {
    console.error('impersonate error:', err);
    res.status(500).json({ error: 'Failed to mint impersonation token' });
  }
});

// DELETE /admin/users/:id — delete a user (cascade clears related rows via FK)
router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      `DELETE FROM users WHERE id = $1 RETURNING email`,
      [req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    await logAdminAction(req, 'delete_user', 'user', req.params.id, { email: r.rows[0].email });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
