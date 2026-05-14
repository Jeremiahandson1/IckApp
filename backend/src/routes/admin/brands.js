// Admin: brand_aliases CRUD + impact preview.
import express from 'express';
import pool from '../../db/init.js';
import { logAdminAction } from '../../utils/adminAudit.js';

const router = express.Router();

function normalizeAlias(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company|usa|us|na|north[\s-]america|n[\s-]a|brands|foods|group|holdings|gmbh|s[\s-]a|sa|ag|plc|llp|limited)\b/gi, ' ')
    .replace(/[^a-z0-9]/g, '');
}

// GET /admin/brand-aliases — paginated, searchable, filterable by company
router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const companyId = req.query.company_id;

    const where = [];
    const params = [];
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(`(LOWER(ba.alias) LIKE $${params.length} OR LOWER(ba.alias_display) LIKE $${params.length} OR LOWER(c.name) LIKE $${params.length})`);
    }
    if (companyId) {
      params.push(parseInt(companyId, 10));
      where.push(`ba.company_id = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    params.push(limit, offset);
    const list = await pool.query(
      `SELECT ba.alias, ba.alias_display, ba.company_id, ba.created_at,
              c.name AS company_name, c.behavior_score
       FROM brand_aliases ba JOIN companies c ON ba.company_id = c.id
       ${whereSql}
       ORDER BY c.name, ba.alias
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const total = await pool.query(
      `SELECT COUNT(*)::int AS n FROM brand_aliases ba JOIN companies c ON ba.company_id = c.id ${whereSql}`,
      params.slice(0, params.length - 2)
    );

    res.json({ aliases: list.rows, total: total.rows[0].n, page, limit });
  } catch (err) {
    console.error('admin /brand-aliases error:', err);
    res.status(500).json({ error: 'Failed to load aliases' });
  }
});

// POST /admin/brand-aliases — add a new alias
router.post('/', async (req, res) => {
  try {
    const { alias_display, company_id } = req.body;
    if (!alias_display || !company_id) {
      return res.status(400).json({ error: 'alias_display and company_id required' });
    }
    const norm = normalizeAlias(alias_display);
    if (!norm) return res.status(400).json({ error: 'Alias normalizes to empty string' });

    const r = await pool.query(
      `INSERT INTO brand_aliases (alias, alias_display, company_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (alias) DO UPDATE SET alias_display = EXCLUDED.alias_display, company_id = EXCLUDED.company_id
       RETURNING *`,
      [norm, alias_display, company_id]
    );

    // Apply to any unmatched products with this normalized brand
    const update = await pool.query(
      `UPDATE products
         SET company_id = $1,
             company_behavior_score = (SELECT behavior_score FROM companies WHERE id = $1)
       WHERE company_id IS NULL
         AND brand IS NOT NULL AND brand != ''
         AND normalize_brand(brand) = $2`,
      [company_id, norm]
    );

    await logAdminAction(req, 'add_brand_alias', 'brand_alias', norm, {
      display: alias_display,
      company_id,
      products_updated: update.rowCount,
    });

    res.status(201).json({ alias: r.rows[0], products_matched: update.rowCount });
  } catch (err) {
    console.error('POST brand-alias error:', err);
    res.status(500).json({ error: 'Failed to add alias' });
  }
});

// DELETE /admin/brand-aliases/:alias
router.delete('/:alias', async (req, res) => {
  try {
    const norm = normalizeAlias(req.params.alias);
    const r = await pool.query(
      `DELETE FROM brand_aliases WHERE alias = $1 RETURNING alias, company_id`,
      [norm]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    await logAdminAction(req, 'delete_brand_alias', 'brand_alias', norm, { company_id: r.rows[0].company_id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete alias' });
  }
});

// POST /admin/brand-aliases/preview — show what would match (no writes)
router.post('/preview', async (req, res) => {
  try {
    const norm = normalizeAlias(req.body.alias_display || '');
    if (!norm) return res.json({ normalized: '', count: 0, sample: [] });
    const count = await pool.query(
      `SELECT COUNT(*)::int AS n FROM products
       WHERE company_id IS NULL AND normalize_brand(brand) = $1`,
      [norm]
    );
    const sample = await pool.query(
      `SELECT upc, brand, name FROM products
       WHERE company_id IS NULL AND normalize_brand(brand) = $1
       LIMIT 10`,
      [norm]
    );
    res.json({ normalized: norm, count: count.rows[0].n, sample: sample.rows });
  } catch (err) {
    res.status(500).json({ error: 'Preview failed' });
  }
});

export default router;
