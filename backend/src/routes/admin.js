import express from 'express';
import pool from '../db/init.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All admin routes require auth + admin
router.use(authenticateToken);

const requireAdmin = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch {
    res.status(403).json({ error: 'Admin check failed' });
  }
};

router.use(requireAdmin);

// ── System Health ──
router.get('/health', async (req, res) => {
  try {
    const [
      users,
      products,
      scans,
      pantryItems,
      recipes,
      contributions,
      sightings,
      subscriptions
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) as total, COUNT(CASE WHEN created_at > NOW() - INTERVAL \'7 days\' THEN 1 END) as new_7d FROM users'),
      pool.query('SELECT COUNT(*) as total, COUNT(CASE WHEN total_score IS NOT NULL THEN 1 END) as scored FROM products'),
      pool.query('SELECT COUNT(*) as total, COUNT(CASE WHEN scanned_at > NOW() - INTERVAL \'24 hours\' THEN 1 END) as last_24h FROM scan_logs'),
      pool.query('SELECT COUNT(*) as total, COUNT(CASE WHEN status = \'active\' THEN 1 END) as active FROM pantry_items'),
      pool.query('SELECT COUNT(*) as total FROM recipes'),
      pool.query(`SELECT status, COUNT(*) as count FROM product_contributions GROUP BY status`),
      pool.query('SELECT COUNT(*) as total, COUNT(CASE WHEN last_verified_at > NOW() - INTERVAL \'7 days\' THEN 1 END) as recent FROM local_sightings'),
      pool.query(`SELECT plan, status, COUNT(*) as count FROM subscriptions GROUP BY plan, status`)
    ]);

    // Check for missing tables (non-fatal)
    let flyerStats = { total: 0, active: 0 };
    try {
      const f = await pool.query('SELECT COUNT(*) as total, COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active FROM flyer_availability');
      flyerStats = f.rows[0];
    } catch { /* table may not exist */ }

    let curatedStats = { total: 0 };
    try {
      const c = await pool.query('SELECT COUNT(*) as total FROM curated_availability');
      curatedStats = c.rows[0];
    } catch { /* table may not exist */ }

    res.json({
      users: { ...users.rows[0] },
      products: { ...products.rows[0] },
      scans: { ...scans.rows[0] },
      pantry: { ...pantryItems.rows[0] },
      recipes: { total: parseInt(recipes.rows[0].total) },
      contributions: contributions.rows.reduce((acc, r) => { acc[r.status] = parseInt(r.count); return acc; }, {}),
      sightings: { ...sightings.rows[0] },
      subscriptions: subscriptions.rows,
      flyer_availability: flyerStats,
      curated_availability: curatedStats
    });
  } catch (err) {
    console.error('Admin health error:', err);
    res.status(500).json({ error: 'Failed to get system health' });
  }
});

// ── User Management ──

// List users (paginated)
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT u.id, u.email, u.name, u.zip_code, u.is_admin, u.created_at, u.updated_at,
             e.total_products_scanned, e.total_swaps_clicked,
             s.plan, s.status as sub_status,
             (SELECT COUNT(*) FROM pantry_items pi WHERE pi.user_id = u.id AND pi.status = 'active') as pantry_count
      FROM users u
      LEFT JOIN user_engagement e ON u.id = e.user_id
      LEFT JOIN subscriptions s ON u.id = s.user_id
    `;
    const params = [];
    let paramIdx = 1;

    if (search) {
      query += ` WHERE u.email ILIKE $${paramIdx} OR u.name ILIKE $${paramIdx}`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    query += ` ORDER BY u.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);
    const countResult = await pool.query('SELECT COUNT(*) FROM users');

    res.json({
      users: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

// Toggle admin status
router.put('/users/:id/admin', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_admin } = req.body;

    // Can't de-admin yourself
    if (id === req.user.id && !is_admin) {
      return res.status(400).json({ error: 'Cannot remove your own admin access' });
    }

    const result = await pool.query(
      'UPDATE users SET is_admin = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, is_admin',
      [!!is_admin, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update admin status' });
  }
});

// Grant trial to a user
router.post('/users/:id/grant-trial', async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 30 } = req.body;

    await pool.query(
      `INSERT INTO subscriptions (user_id, plan, status, trial_started_at, trial_ends_at)
       VALUES ($1, 'trial', 'active', NOW(), NOW() + ($2 || ' days')::INTERVAL)
       ON CONFLICT (user_id) DO UPDATE SET
         plan = 'trial', status = 'active',
         trial_started_at = COALESCE(subscriptions.trial_started_at, NOW()),
         trial_ends_at = NOW() + ($2 || ' days')::INTERVAL`,
      [id, String(days)]
    );

    res.json({ granted: true, days });
  } catch (err) {
    res.status(500).json({ error: 'Failed to grant trial' });
  }
});

// ── Product Management ──

// Bulk set is_clean_alternative for products above score threshold
router.post('/products/auto-flag-clean', async (req, res) => {
  try {
    const { min_score = 75 } = req.body;

    const result = await pool.query(
      `UPDATE products SET is_clean_alternative = true
       WHERE total_score >= $1 AND total_score IS NOT NULL AND is_clean_alternative = false
       RETURNING upc, name, total_score`,
      [parseInt(min_score)]
    );

    res.json({ flagged: result.rows.length, products: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to flag products' });
  }
});

// Get products missing data (no score, no image, etc.)
router.get('/products/gaps', async (req, res) => {
  try {
    const [noScore, noImage, noIngredients] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM products WHERE total_score IS NULL'),
      pool.query('SELECT COUNT(*) as count FROM products WHERE image_url IS NULL'),
      pool.query('SELECT COUNT(*) as count FROM products WHERE ingredients IS NULL OR ingredients = \'\'')
    ]);

    // Sample of worst gaps
    const samples = await pool.query(
      `SELECT upc, name, brand, total_score, image_url,
              (ingredients IS NULL OR ingredients = '') as missing_ingredients
       FROM products
       WHERE total_score IS NULL OR image_url IS NULL
       ORDER BY created_at DESC LIMIT 20`
    );

    res.json({
      no_score: parseInt(noScore.rows[0].count),
      no_image: parseInt(noImage.rows[0].count),
      no_ingredients: parseInt(noIngredients.rows[0].count),
      samples: samples.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get product gaps' });
  }
});

export default router;
