import express from 'express';
import pool from '../db/init.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Get all recipes
router.get('/', async (req, res) => {
  try {
    const { category, difficulty, max_time, kid_friendly } = req.query;

    let query = 'SELECT * FROM recipes WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (category) {
      paramCount++;
      query += ` AND replaces_category = $${paramCount}`;
      params.push(category);
    }

    if (difficulty) {
      paramCount++;
      query += ` AND difficulty = $${paramCount}`;
      params.push(difficulty);
    }

    if (max_time) {
      paramCount++;
      query += ` AND total_time_minutes <= $${paramCount}`;
      params.push(parseInt(max_time));
    }

    if (kid_friendly === 'true') {
      query += ' AND kid_friendly = true';
    }

    query += ' ORDER BY name';

    const result = await pool.query(query, params);
    res.json(result.rows);

  } catch (err) {
    console.error('Recipes fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

// Get recipes for a product (alternatives to that product)
router.get('/for/:upc', async (req, res) => {
  try {
    const { upc } = req.params;

    // Get product category
    const productResult = await pool.query(
      'SELECT category FROM products WHERE upc = $1',
      [upc]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const category = productResult.rows[0].category;

    // Get recipes that replace this product or category
    const result = await pool.query(
      `SELECT * FROM recipes 
       WHERE replaces_products @> to_jsonb($1::text)
       OR replaces_category = $2
       ORDER BY total_time_minutes ASC`,
      [upc, category]
    );

    res.json(result.rows);

  } catch (err) {
    console.error('Recipes for product error:', err);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

// Mark recipe as made
router.post('/:id/made', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, notes } = req.body;

    await pool.query(
      `INSERT INTO user_recipes (user_id, recipe_id, made_it, made_at, rating, notes)
       VALUES ($1, $2, true, NOW(), $3, $4)
       ON CONFLICT (user_id, recipe_id) DO UPDATE SET
         made_it = true,
         made_at = NOW(),
         rating = COALESCE($3, user_recipes.rating),
         notes = COALESCE($4, user_recipes.notes)`,
      [req.user.id, id, rating, notes]
    );

    res.json({ tracked: true });

  } catch (err) {
    console.error('Recipe made error:', err);
    res.status(500).json({ error: 'Failed to track recipe' });
  }
});

// Get user's recipe history
router.get('/user/history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ur.*, r.name, r.description, r.total_time_minutes, r.difficulty, r.image_url
       FROM user_recipes ur
       JOIN recipes r ON ur.recipe_id = r.id
       WHERE ur.user_id = $1
       ORDER BY ur.viewed_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);

  } catch (err) {
    console.error('Recipe history error:', err);
    res.status(500).json({ error: 'Failed to fetch recipe history' });
  }
});

// Get categories that have recipes
router.get('/meta/categories', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT replaces_category FROM recipes WHERE replaces_category IS NOT NULL ORDER BY replaces_category'
    );
    res.json(result.rows.map(r => r.replaces_category));
  } catch (err) {
    console.error('Recipe categories error:', err);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

// Get recipe by ID — MUST be last (/:id catches everything)
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM recipes WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const recipe = result.rows[0];

    // Get products this recipe replaces
    let replacesProducts = [];
    if (recipe.replaces_products && recipe.replaces_products.length > 0) {
      const productsResult = await pool.query(
        'SELECT upc, name, brand, total_score FROM products WHERE upc = ANY($1)',
        [recipe.replaces_products]
      );
      replacesProducts = productsResult.rows;
    }

    // Track view if user is logged in
    if (req.user) {
      try {
        const trackResult = await pool.query(
          `INSERT INTO user_recipes (user_id, recipe_id, viewed_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (user_id, recipe_id) DO UPDATE SET viewed_at = NOW()
           RETURNING (xmax = 0) AS is_new_view`,
          [req.user.id, id]
        );

        if (trackResult.rows[0]?.is_new_view) {
          await pool.query(
            `UPDATE user_engagement 
             SET total_recipes_viewed = total_recipes_viewed + 1, updated_at = NOW()
             WHERE user_id = $1`,
            [req.user.id]
          );
        }
      } catch (e) { /* tracking tables may not exist — non-fatal */ }
    }

    res.json({
      ...recipe,
      replaces_products_details: replacesProducts
    });

  } catch (err) {
    console.error('Recipe fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch recipe' });
  }
});

export default router;
