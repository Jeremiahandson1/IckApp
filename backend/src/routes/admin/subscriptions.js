// Admin: subscription management.
import express from 'express';
import pool from '../../db/init.js';
import { logAdminAction } from '../../utils/adminAudit.js';

const router = express.Router();

// GET /admin/subscriptions — list with filters
router.get('/', async (req, res) => {
  try {
    const { plan, status } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];
    if (plan)   { params.push(plan);   where.push(`s.plan = $${params.length}`); }
    if (status) { params.push(status); where.push(`s.status = $${params.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    params.push(limit, offset);
    const list = await pool.query(
      `SELECT s.user_id, u.email, u.name,
              s.plan, s.status,
              s.trial_started_at, s.trial_ends_at, s.expires_at,
              s.stripe_customer_id, s.created_at
       FROM subscriptions s
       JOIN users u ON s.user_id = u.id
       ${whereSql}
       ORDER BY s.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const total = await pool.query(
      `SELECT COUNT(*)::int AS n FROM subscriptions s ${whereSql}`,
      params.slice(0, params.length - 2)
    );

    // Summary breakdown
    const summary = await pool.query(`
      SELECT plan, status, COUNT(*)::int AS n
      FROM subscriptions
      GROUP BY plan, status
      ORDER BY n DESC
    `);

    res.json({
      subscriptions: list.rows,
      total: total.rows[0].n,
      page, limit,
      summary: summary.rows,
    });
  } catch (err) {
    console.error('admin /subscriptions error:', err);
    res.status(500).json({ error: 'Failed to load subscriptions' });
  }
});

// POST /admin/subscriptions/:userId/extend — extend trial/sub by N days
router.post('/:userId/extend', async (req, res) => {
  try {
    const days = Math.max(1, Math.min(parseInt(req.body.days, 10) || 30, 365));
    const r = await pool.query(
      `UPDATE subscriptions
       SET trial_ends_at = COALESCE(trial_ends_at, NOW()) + ($2 || ' days')::interval,
           expires_at    = COALESCE(expires_at,    NOW()) + ($2 || ' days')::interval
       WHERE user_id = $1
       RETURNING user_id, plan, status, trial_ends_at, expires_at`,
      [req.params.userId, String(days)]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'No subscription' });
    await logAdminAction(req, 'extend_subscription', 'user', req.params.userId, { days });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to extend' });
  }
});

export default router;
