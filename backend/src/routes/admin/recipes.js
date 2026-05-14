// Admin: recipe moderation (list, edit, delete, bulk).
import express from 'express';
import pool from '../../db/init.js';
import { logAdminAction } from '../../utils/adminAudit.js';

const router = express.Router();

// GET /admin/recipes — paginated list with filters
router.get('/', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = (page - 1) * limit;
    const { source, search } = req.query;
    const kid = req.query.kid_friendly;

    const where = ['1=1'];
    const params = [];
    if (source) {
      params.push(source);
      where.push(`source = $${params.length}`);
    }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(`LOWER(name) LIKE $${params.length}`);
    }
    if (kid === 'true')  where.push('kid_friendly = true');
    if (kid === 'false') where.push('kid_friendly = false');

    params.push(limit, offset);
    const list = await pool.query(
      `SELECT id, name, source, source_url, replaces_category, difficulty,
              total_time_minutes, servings, kid_friendly,
              jsonb_array_length(ingredients) AS ing_count,
              dietary_tags, image_url,
              created_at
       FROM recipes
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const total = await pool.query(
      `SELECT COUNT(*)::int AS n FROM recipes WHERE ${where.join(' AND ')}`,
      params.slice(0, params.length - 2)
    );

    const sourceBreakdown = await pool.query(
      `SELECT COALESCE(source, '(null)') AS source, COUNT(*)::int AS n
       FROM recipes GROUP BY source ORDER BY n DESC`
    );

    res.json({
      recipes: list.rows,
      total: total.rows[0].n,
      page, limit,
      source_breakdown: sourceBreakdown.rows,
    });
  } catch (err) {
    console.error('admin /recipes error:', err);
    res.status(500).json({ error: 'Failed to load recipes' });
  }
});

// GET /admin/recipes/:id — full recipe
router.get('/:id', async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM recipes WHERE id = $1`, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load recipe' });
  }
});

// PATCH /admin/recipes/:id — edit name/description/kid_friendly/tags
router.patch('/:id', async (req, res) => {
  try {
    const { name, description, kid_friendly, dietary_tags, replaces_category,
            ingredients, instructions, vs_store_bought } = req.body;
    const r = await pool.query(
      `UPDATE recipes SET
        name             = COALESCE($1, name),
        description      = COALESCE($2, description),
        kid_friendly     = COALESCE($3, kid_friendly),
        dietary_tags     = COALESCE($4::jsonb, dietary_tags),
        replaces_category= COALESCE($5, replaces_category),
        ingredients      = COALESCE($6::jsonb, ingredients),
        instructions     = COALESCE($7::jsonb, instructions),
        vs_store_bought  = COALESCE($8, vs_store_bought)
       WHERE id = $9
       RETURNING *`,
      [
        name, description, kid_friendly,
        dietary_tags ? JSON.stringify(dietary_tags) : null,
        replaces_category,
        ingredients  ? JSON.stringify(ingredients)  : null,
        instructions ? JSON.stringify(instructions) : null,
        vs_store_bought,
        req.params.id,
      ]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    await logAdminAction(req, 'update_recipe', 'recipe', req.params.id, { name: r.rows[0].name });
    res.json(r.rows[0]);
  } catch (err) {
    console.error('PATCH recipe error:', err);
    res.status(500).json({ error: 'Failed to update' });
  }
});

// DELETE /admin/recipes/:id
router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query(`DELETE FROM recipes WHERE id = $1 RETURNING name`, [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    await logAdminAction(req, 'delete_recipe', 'recipe', req.params.id, { name: r.rows[0].name });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// POST /admin/recipes/bulk-delete — { ids: [1,2,3] }
router.post('/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }
    const r = await pool.query(
      `DELETE FROM recipes WHERE id = ANY($1::int[]) RETURNING id`,
      [ids]
    );
    await logAdminAction(req, 'bulk_delete_recipes', 'recipe', null, { count: r.rowCount, ids });
    res.json({ deleted: r.rowCount });
  } catch (err) {
    res.status(500).json({ error: 'Bulk delete failed' });
  }
});

export default router;
