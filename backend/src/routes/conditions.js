import express from 'express';
import pool from '../db/init.js';
import { authenticateToken } from '../middleware/auth.js';
import { scoreForCondition } from '../utils/conditionScorer.js';

const router = express.Router();

// ── GET /api/conditions — list all available conditions (no auth) ──
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, slug, description, sub_types FROM conditions ORDER BY id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List conditions error:', err);
    res.status(500).json({ error: 'Failed to load conditions' });
  }
});

// ── GET /api/user/conditions — get user's active conditions ──
router.get('/user', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT uc.id, uc.condition_id, uc.sub_type, uc.active,
              c.name, c.slug, c.description, c.sub_types
       FROM user_conditions uc
       JOIN conditions c ON uc.condition_id = c.id
       WHERE uc.user_id = $1 AND uc.active = true
       ORDER BY c.id`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get user conditions error:', err);
    res.status(500).json({ error: 'Failed to load user conditions' });
  }
});

// ── POST /api/user/conditions — set user's conditions (replace all) ──
router.post('/user', authenticateToken, async (req, res) => {
  try {
    const { conditions } = req.body;
    if (!Array.isArray(conditions)) {
      return res.status(400).json({ error: 'conditions must be an array' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing
      await client.query('DELETE FROM user_conditions WHERE user_id = $1', [req.user.id]);

      // Insert new
      for (const c of conditions) {
        if (!c.conditionId) continue;
        await client.query(
          `INSERT INTO user_conditions (user_id, condition_id, sub_type, active)
           VALUES ($1, $2, $3, true)
           ON CONFLICT (user_id, condition_id) DO UPDATE SET sub_type = $3, active = true`,
          [req.user.id, c.conditionId, c.subType || null]
        );
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    // Return updated list
    const result = await pool.query(
      `SELECT uc.id, uc.condition_id, uc.sub_type, uc.active,
              c.name, c.slug, c.description, c.sub_types
       FROM user_conditions uc
       JOIN conditions c ON uc.condition_id = c.id
       WHERE uc.user_id = $1 AND uc.active = true
       ORDER BY c.id`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Set user conditions error:', err);
    res.status(500).json({ error: 'Failed to save conditions' });
  }
});

// ── GET /api/conditions/score/:productId — score a product for given conditions ──
// Query: ?conditions=thyroid:hypo,diabetes
router.get('/score/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const conditionsParam = req.query.conditions;
    if (!conditionsParam) {
      return res.status(400).json({ error: 'conditions query param required' });
    }

    // Parse conditions param
    const requested = conditionsParam.split(',').map(c => {
      const [slug, subType] = c.split(':');
      return { slug: slug.trim(), subType: subType?.trim() || null };
    });

    // Get product (support both numeric ID and UPC string)
    const isNumeric = /^\d+$/.test(productId);
    const productResult = await pool.query(
      isNumeric
        ? 'SELECT id, upc, name, ingredients, nutrition_facts, total_score FROM products WHERE id = $1 OR upc = $2'
        : 'SELECT id, upc, name, ingredients, nutrition_facts, total_score FROM products WHERE upc = $1',
      isNumeric ? [parseInt(productId), productId] : [productId]
    );
    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const product = productResult.rows[0];

    // Check cache (7-day TTL)
    const conditionScores = [];
    for (const { slug, subType } of requested) {
      // Check cache
      const cached = await pool.query(
        `SELECT score, flags FROM product_condition_scores
         WHERE product_id = $1 AND condition_slug = $2
           AND (sub_type = $3 OR ($3 IS NULL AND sub_type IS NULL))
           AND cached_at > NOW() - INTERVAL '7 days'`,
        [product.id, slug, subType]
      );

      if (cached.rows.length > 0) {
        const row = cached.rows[0];
        conditionScores.push({
          slug,
          subType,
          label: buildLabel(slug, subType),
          score: row.score,
          flags: typeof row.flags === 'string' ? JSON.parse(row.flags) : row.flags,
        });
      } else {
        // Compute score
        const result = scoreForCondition(product, slug, subType);
        conditionScores.push(result);

        // Cache it
        await pool.query(
          `INSERT INTO product_condition_scores (product_id, condition_slug, sub_type, score, flags, cached_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT DO NOTHING`,
          [product.id, slug, subType, result.score, JSON.stringify(result.flags)]
        );
      }
    }

    res.json({
      productId: product.id,
      normalScore: product.total_score,
      conditionScores,
    });
  } catch (err) {
    console.error('Condition score error:', err);
    res.status(500).json({ error: 'Failed to compute condition scores' });
  }
});

function buildLabel(slug, subType) {
  const labels = { thyroid: 'Thyroid', diabetes: 'Diabetes', heart: 'Heart', kidney: 'Kidney', celiac: 'Celiac' };
  const subLabels = { hypo: 'Hypo', hyper: 'Hyper', hashimotos: "Hashimoto's" };
  const base = labels[slug] || slug;
  return subType ? `${base} (${subLabels[subType] || subType})` : base;
}

export default router;
