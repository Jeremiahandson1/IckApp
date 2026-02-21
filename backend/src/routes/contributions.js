import express from 'express';
import pool from '../db/init.js';
import { authenticateToken } from '../middleware/auth.js';
import { scoreProduct } from '../utils/scoring.js';

const router = express.Router();

// All routes here require authentication + admin role
router.use(authenticateToken);
router.use(async (req, res, next) => {
  try {
    const result = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch {
    res.status(403).json({ error: 'Admin check failed' });
  }
});

// GET /api/products/admin/contributions?status=pending
router.get('/', async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    const result = await pool.query(
      `SELECT pc.*, u.email as submitted_by_email
       FROM product_contributions pc
       LEFT JOIN users u ON pc.submitted_by = u.id
       WHERE pc.status = $1
       ORDER BY pc.created_at ASC`,
      [status]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Admin contributions error:', err);
    res.status(500).json({ error: 'Failed to load contributions' });
  }
});

// PUT /api/products/admin/contributions/:id/approve
router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const contrib = await pool.query('SELECT * FROM product_contributions WHERE id = $1', [id]);
    if (contrib.rows.length === 0) return res.status(404).json({ error: 'Contribution not found' });

    const c = contrib.rows[0];

    // Score the contributed product before inserting
    const scores = await scoreProduct({
      ingredients: c.ingredients_text || '',
      brand: c.brand || '',
    }).catch(() => null);

    await pool.query(
      `INSERT INTO products (upc, name, brand, ingredients,
         nutrition_score, additives_score, organic_bonus,
         harmful_ingredients_found, nutrition_facts, allergens_tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (upc) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, products.name),
         brand = COALESCE(EXCLUDED.brand, products.brand),
         ingredients = COALESCE(EXCLUDED.ingredients, products.ingredients),
         nutrition_score = COALESCE(EXCLUDED.nutrition_score, products.nutrition_score),
         additives_score = COALESCE(EXCLUDED.additives_score, products.additives_score),
         organic_bonus = COALESCE(EXCLUDED.organic_bonus, products.organic_bonus),
         harmful_ingredients_found = COALESCE(EXCLUDED.harmful_ingredients_found, products.harmful_ingredients_found),
         image_url = COALESCE($11, products.image_url)`,
      [
        c.upc, c.name, c.brand, c.ingredients_text,
        scores?.nutrition_score ?? 50,
        scores?.additives_score ?? 50,
        scores?.organic_bonus ?? 0,
        scores?.harmful_ingredients_found ? JSON.stringify(scores.harmful_ingredients_found) : '[]',
        scores?.nutrition_facts ? JSON.stringify(scores.nutrition_facts) : '{}',
        scores?.allergens_tags ? JSON.stringify(scores.allergens_tags) : '[]',
        c.image_url || null
      ]
    );

    await pool.query(
      `UPDATE product_contributions SET status = 'approved', reviewed_at = NOW() WHERE id = $1`,
      [id]
    );

    res.json({ approved: true, upc: c.upc });
  } catch (err) {
    console.error('Approve contribution error:', err);
    res.status(500).json({ error: 'Failed to approve' });
  }
});

// PUT /api/products/admin/contributions/:id/reject
router.put('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const result = await pool.query(
      `UPDATE product_contributions SET status = 'rejected', reviewed_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Contribution not found' });

    res.json({ rejected: true, reason });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject' });
  }
});

export default router;
