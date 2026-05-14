// Admin: companies CRUD + per-company stats.
import express from 'express';
import pool from '../../db/init.js';
import { logAdminAction } from '../../utils/adminAudit.js';

const router = express.Router();

// GET /admin/companies — list paginated + searchable + sortable
router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();
    const sortBy = ['name', 'behavior_score', 'product_count'].includes(req.query.sort)
      ? req.query.sort : 'product_count';
    const sortDir = req.query.dir === 'asc' ? 'ASC' : 'DESC';

    const where = [];
    const params = [];
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(`LOWER(c.name) LIKE $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    params.push(limit, offset);
    const list = await pool.query(
      `SELECT c.id, c.name, c.parent_company, c.behavior_score,
              c.controversies, c.transparency_rating,
              (SELECT COUNT(*) FROM products WHERE company_id = c.id)::int AS product_count,
              (SELECT COUNT(*) FROM brand_aliases WHERE company_id = c.id)::int AS alias_count
       FROM companies c
       ${whereSql}
       ORDER BY ${sortBy === 'product_count'
         ? '(SELECT COUNT(*) FROM products WHERE company_id = c.id)'
         : 'c.' + sortBy} ${sortDir} NULLS LAST,
                c.name ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const total = await pool.query(
      `SELECT COUNT(*)::int AS n FROM companies c ${whereSql}`,
      params.slice(0, params.length - 2)
    );
    res.json({ companies: list.rows, total: total.rows[0].n, page, limit });
  } catch (err) {
    console.error('admin /companies error:', err);
    res.status(500).json({ error: 'Failed to load companies' });
  }
});

// GET /admin/companies/:id — detail + linked products + aliases
router.get('/:id', async (req, res) => {
  try {
    const c = await pool.query(`SELECT * FROM companies WHERE id = $1`, [req.params.id]);
    if (c.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const aliases = await pool.query(
      `SELECT alias, alias_display FROM brand_aliases WHERE company_id = $1 ORDER BY alias`,
      [req.params.id]
    );
    const products = await pool.query(
      `SELECT upc, name, brand, total_score FROM products
       WHERE company_id = $1 ORDER BY total_score DESC NULLS LAST LIMIT 50`,
      [req.params.id]
    );
    res.json({ company: c.rows[0], aliases: aliases.rows, sample_products: products.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load company' });
  }
});

// PATCH /admin/companies/:id — update editable fields
router.patch('/:id', async (req, res) => {
  try {
    const { name, parent_company, behavior_score, controversies, transparency_rating } = req.body;
    const r = await pool.query(
      `UPDATE companies SET
        name            = COALESCE($1, name),
        parent_company  = COALESCE($2, parent_company),
        behavior_score  = COALESCE($3, behavior_score),
        controversies   = COALESCE($4, controversies),
        transparency_rating = COALESCE($5, transparency_rating)
       WHERE id = $6
       RETURNING *`,
      [name, parent_company, behavior_score, controversies, transparency_rating, req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    await logAdminAction(req, 'update_company', 'company', req.params.id, req.body);
    // Cascade: also bump every product's cached company_behavior_score
    if (typeof behavior_score === 'number') {
      await pool.query(
        `UPDATE products SET company_behavior_score = $1 WHERE company_id = $2`,
        [behavior_score, req.params.id]
      );
    }
    res.json(r.rows[0]);
  } catch (err) {
    console.error('PATCH company error:', err);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// POST /admin/companies — create a new company
router.post('/', async (req, res) => {
  try {
    const { name, parent_company, behavior_score, controversies } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = await pool.query(
      `INSERT INTO companies (name, parent_company, behavior_score, controversies)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, parent_company || null, behavior_score ?? 50, controversies || null]
    );
    await logAdminAction(req, 'create_company', 'company', r.rows[0].id, { name });
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Company name already exists' });
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// DELETE /admin/companies/:id
router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query(`DELETE FROM companies WHERE id = $1 RETURNING name`, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    await logAdminAction(req, 'delete_company', 'company', req.params.id, { name: r.rows[0].name });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete company' });
  }
});

export default router;
