// Admin: feature flag management.
import express from 'express';
import pool from '../../db/init.js';
import { invalidateFlags } from '../../utils/featureFlags.js';
import { logAdminAction } from '../../utils/adminAudit.js';

const router = express.Router();

// GET /admin/flags — list all flags
router.get('/', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT key, enabled, description, updated_at, updated_by FROM feature_flags ORDER BY key`
    );
    res.json({ flags: r.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load flags' });
  }
});

// PATCH /admin/flags/:key — { enabled: true|false }
router.patch('/:key', async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be boolean' });
    }
    const r = await pool.query(
      `UPDATE feature_flags SET enabled = $1, updated_at = NOW(), updated_by = $2
       WHERE key = $3
       RETURNING *`,
      [enabled, req.user.id, req.params.key]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Flag not found' });

    invalidateFlags(); // ensure next read picks up the new value
    await logAdminAction(req, 'toggle_flag', 'feature_flag', req.params.key, { enabled });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update flag' });
  }
});

// POST /admin/flags — create a new flag (rare; usually you add via DB seed)
router.post('/', async (req, res) => {
  try {
    const { key, enabled = false, description } = req.body;
    if (!key) return res.status(400).json({ error: 'key required' });
    const r = await pool.query(
      `INSERT INTO feature_flags (key, enabled, description, updated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (key) DO NOTHING
       RETURNING *`,
      [key, enabled, description || null, req.user.id]
    );
    if (r.rows.length === 0) return res.status(409).json({ error: 'Flag already exists' });
    invalidateFlags();
    await logAdminAction(req, 'create_flag', 'feature_flag', key, { description });
    res.status(201).json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create flag' });
  }
});

export default router;
