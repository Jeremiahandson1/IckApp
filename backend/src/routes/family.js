import express from 'express';
import pool from '../db/init.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/products/family — list all profiles for the user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM family_profiles WHERE user_id = $1 ORDER BY is_default DESC, created_at ASC',
      [req.user.id]
    );

    // Auto-create default profile from user's allergens if none exist
    if (result.rows.length === 0) {
      const user = await pool.query('SELECT name, allergen_alerts FROM users WHERE id = $1', [req.user.id]);
      const defaultProfile = await pool.query(
        `INSERT INTO family_profiles (user_id, name, avatar, allergen_alerts, is_default)
         VALUES ($1, $2, '👤', $3, true)
         RETURNING *`,
        [req.user.id, user.rows[0]?.name || 'Me', JSON.stringify(user.rows[0]?.allergen_alerts || [])]
      );
      return res.json(defaultProfile.rows);
    }

    res.json(result.rows);
  } catch (err) {
    console.error('Family profiles error:', err);
    res.status(500).json({ error: 'Failed to load profiles' });
  }
});

// POST /api/products/family — add a profile
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, avatar, allergen_alerts, dietary_prefs } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    const count = await pool.query('SELECT COUNT(*) FROM family_profiles WHERE user_id = $1', [req.user.id]);
    if (parseInt(count.rows[0].count) >= 6) {
      return res.status(400).json({ error: 'Maximum 6 family profiles' });
    }

    const result = await pool.query(
      `INSERT INTO family_profiles (user_id, name, avatar, allergen_alerts, dietary_prefs)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, name, avatar || '👤',
       JSON.stringify(allergen_alerts || []),
       JSON.stringify(dietary_prefs || [])]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Add family profile error:', err);
    res.status(500).json({ error: 'Failed to add profile' });
  }
});

// PUT /api/products/family/:id — update a profile
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, avatar, allergen_alerts, dietary_prefs } = req.body;
    const result = await pool.query(
      `UPDATE family_profiles
       SET name = COALESCE($1, name),
           avatar = COALESCE($2, avatar),
           allergen_alerts = COALESCE($3, allergen_alerts),
           dietary_prefs = COALESCE($4, dietary_prefs)
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [name, avatar,
       allergen_alerts ? JSON.stringify(allergen_alerts) : null,
       dietary_prefs ? JSON.stringify(dietary_prefs) : null,
       req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// DELETE /api/products/family/:id — remove a profile (cannot delete default)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM family_profiles WHERE id = $1 AND user_id = $2 AND is_default = false',
      [req.params.id, req.user.id]
    );
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete profile' });
  }
});

export default router;
