// Admin: view the audit log.
import express from 'express';
import pool from '../../db/init.js';

const router = express.Router();

// GET /admin/audit — paginated, filterable
//   ?action=toggle_admin
//   ?target_type=user
//   ?target_id=<id>
//   ?admin_email=foo@bar.com
//   ?since=2026-01-01
router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = (page - 1) * limit;

    const where = ['1=1'];
    const params = [];
    if (req.query.action)      { params.push(req.query.action);      where.push(`action = $${params.length}`); }
    if (req.query.target_type) { params.push(req.query.target_type); where.push(`target_type = $${params.length}`); }
    if (req.query.target_id)   { params.push(String(req.query.target_id)); where.push(`target_id = $${params.length}`); }
    if (req.query.admin_email) { params.push(`%${req.query.admin_email.toLowerCase()}%`); where.push(`LOWER(admin_email) LIKE $${params.length}`); }
    if (req.query.since)       { params.push(req.query.since);       where.push(`created_at >= $${params.length}`); }

    params.push(limit, offset);
    const list = await pool.query(
      `SELECT id, admin_user_id, admin_email, action, target_type, target_id,
              details, ip_address, created_at
       FROM admin_actions
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const total = await pool.query(
      `SELECT COUNT(*)::int AS n FROM admin_actions WHERE ${where.join(' AND ')}`,
      params.slice(0, params.length - 2)
    );

    // Quick summary of distinct actions
    const actionSummary = await pool.query(
      `SELECT action, COUNT(*)::int AS n FROM admin_actions
       GROUP BY action ORDER BY n DESC LIMIT 20`
    );

    res.json({
      actions: list.rows,
      total: total.rows[0].n,
      page, limit,
      action_summary: actionSummary.rows,
    });
  } catch (err) {
    console.error('admin /audit error:', err);
    res.status(500).json({ error: 'Failed to load audit log' });
  }
});

export default router;
