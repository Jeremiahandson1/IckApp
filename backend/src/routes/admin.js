// Admin routes index — gates everything behind authenticateToken +
// requireAdmin, then mounts per-concern sub-routers.

import express from 'express';
import pool from '../db/init.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/admin.js';

import usersRouter         from './admin/users.js';
import subscriptionsRouter from './admin/subscriptions.js';
import companiesRouter     from './admin/companies.js';
import brandsRouter        from './admin/brands.js';
import recipesRouter       from './admin/recipes.js';
import flagsRouter         from './admin/flags.js';
import auditRouter         from './admin/audit.js';

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

// ── System health (dashboard) ──────────────────────────────────────────────
router.get('/health', async (req, res) => {
  try {
    const [
      users, products, scans, pantryItems, recipes, contributions,
      sightings, subscriptions, companies, brandAliases, auditCount, flags,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total,
                         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS new_7d,
                         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS new_24h
                  FROM users`),
      pool.query(`SELECT COUNT(*)::int AS total,
                         COUNT(*) FILTER (WHERE total_score IS NOT NULL)::int AS scored,
                         COUNT(*) FILTER (WHERE company_id IS NOT NULL)::int AS with_company
                  FROM products`),
      pool.query(`SELECT COUNT(*)::int AS total,
                         COUNT(*) FILTER (WHERE scanned_at > NOW() - INTERVAL '24 hours')::int AS last_24h,
                         COUNT(*) FILTER (WHERE scanned_at > NOW() - INTERVAL '7 days')::int AS last_7d
                  FROM scan_logs`),
      pool.query(`SELECT COUNT(*)::int AS total,
                         COUNT(*) FILTER (WHERE status = 'active')::int AS active
                  FROM pantry_items`),
      pool.query(`SELECT COUNT(*)::int AS total,
                         COUNT(*) FILTER (WHERE source = 'wikibooks')::int AS wikibooks,
                         COUNT(*) FILTER (WHERE source = 'curated')::int AS curated
                  FROM recipes`),
      pool.query(`SELECT status, COUNT(*)::int AS count FROM product_contributions GROUP BY status`),
      pool.query(`SELECT COUNT(*)::int AS total FROM local_sightings`),
      pool.query(`SELECT plan, status, COUNT(*)::int AS count FROM subscriptions GROUP BY plan, status`),
      pool.query(`SELECT COUNT(*)::int AS total FROM companies`),
      pool.query(`SELECT COUNT(*)::int AS total FROM brand_aliases`),
      pool.query(`SELECT COUNT(*)::int AS total,
                         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS last_24h
                  FROM admin_actions`),
      pool.query(`SELECT COUNT(*) FILTER (WHERE enabled = true)::int AS on,
                         COUNT(*) FILTER (WHERE enabled = false)::int AS off
                  FROM feature_flags`),
    ]);

    const contribObj = contributions.rows.reduce((acc, r) => ({ ...acc, [r.status]: r.count }), {});
    const pendingContribs = contribObj.pending || 0;

    res.json({
      users:         users.rows[0],
      products:      products.rows[0],
      scans:         scans.rows[0],
      pantry:        pantryItems.rows[0],
      recipes:       recipes.rows[0],
      contributions: { ...contribObj, pending: pendingContribs },
      sightings:     sightings.rows[0],
      subscriptions: subscriptions.rows,
      companies:     companies.rows[0],
      brand_aliases: brandAliases.rows[0],
      audit:         auditCount.rows[0],
      flags:         flags.rows[0],
    });
  } catch (err) {
    console.error('admin /health error:', err);
    res.status(500).json({ error: 'Failed to load system health' });
  }
});

// ── External-service health probe ─────────────────────────────────────────
// Each probe has a hard timeout and a single small request. We return
// per-service status + latency so the admin dashboard can render badges.
router.get('/health/external', async (req, res) => {
  async function probe(name, url, opts = {}) {
    const t = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs || 5000);
    try {
      const r = await fetch(url, { signal: ctrl.signal, headers: opts.headers || {} });
      return { name, ok: r.ok, status: r.status, ms: Date.now() - t };
    } catch (e) {
      return { name, ok: false, status: 0, ms: Date.now() - t, error: e.name === 'AbortError' ? 'timeout' : e.message };
    } finally { clearTimeout(timer); }
  }

  const probes = [
    probe('open_food_facts', 'https://world.openfoodfacts.org/api/v0/product/737628064502.json'),
    probe('usda',            'https://api.nal.usda.gov/fdc/v1/foods/search?api_key=DEMO_KEY&query=ping&pageSize=1'),
  ];
  if (process.env.SPOONACULAR_API_KEY) {
    probes.push(probe('spoonacular',
      `https://api.spoonacular.com/recipes/complexSearch?apiKey=${process.env.SPOONACULAR_API_KEY}&query=ping&number=1`));
  } else {
    probes.push(Promise.resolve({ name: 'spoonacular', ok: false, status: 0, ms: 0, error: 'no_api_key' }));
  }
  if (process.env.OPENAI_API_KEY) {
    probes.push(probe('openai', 'https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    }));
  } else {
    probes.push(Promise.resolve({ name: 'openai', ok: false, status: 0, ms: 0, error: 'no_api_key' }));
  }

  const results = await Promise.all(probes);
  res.json({ services: results, checked_at: new Date().toISOString() });
});

// ── Product gaps + bulk operations (kept here, small surface) ─────────────
router.post('/products/auto-flag-clean', async (req, res) => {
  try {
    const min = parseInt(req.body.min_score, 10) || 75;
    const r = await pool.query(
      `UPDATE products SET is_clean_alternative = true
       WHERE total_score >= $1 AND total_score IS NOT NULL AND is_clean_alternative = false
       RETURNING upc, name, total_score`,
      [min]
    );
    res.json({ flagged: r.rowCount, sample: r.rows.slice(0, 20) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to flag products' });
  }
});

router.get('/products/gaps', async (req, res) => {
  try {
    const counts = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE total_score IS NULL)::int AS no_score,
        COUNT(*) FILTER (WHERE image_url IS NULL)::int AS no_image,
        COUNT(*) FILTER (WHERE ingredients IS NULL OR ingredients = '')::int AS no_ingredients,
        COUNT(*) FILTER (WHERE company_id IS NULL)::int AS no_company,
        COUNT(*) FILTER (WHERE brand IS NULL OR brand = '')::int AS no_brand
      FROM products
    `);
    const samples = await pool.query(
      `SELECT upc, name, brand, total_score, image_url,
              (ingredients IS NULL OR ingredients = '') AS missing_ingredients
       FROM products
       WHERE total_score IS NULL OR image_url IS NULL OR ingredients IS NULL
       ORDER BY created_at DESC LIMIT 20`
    );
    res.json({ ...counts.rows[0], samples: samples.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get product gaps' });
  }
});

// ── Mount sub-routers ──────────────────────────────────────────────────────
router.use('/users',          usersRouter);
router.use('/subscriptions',  subscriptionsRouter);
router.use('/companies',      companiesRouter);
router.use('/brand-aliases',  brandsRouter);
router.use('/recipes',        recipesRouter);
router.use('/flags',          flagsRouter);
router.use('/audit',          auditRouter);

export default router;
