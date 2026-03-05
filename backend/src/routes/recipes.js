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

// Spoonacular: find recipes using product ingredients, cross-ref with pantry
router.get('/spoonacular/:upc', optionalAuth, async (req, res) => {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Spoonacular not configured' });
  }

  try {
    const { upc } = req.params;

    // Get product ingredients
    const productResult = await pool.query(
      'SELECT ingredients FROM products WHERE upc = $1',
      [upc]
    );
    if (productResult.rows.length === 0 || !productResult.rows[0].ingredients) {
      return res.json({ recipes: [], pantry_items: [] });
    }

    // Parse ingredient string into individual items
    const rawIngredients = productResult.rows[0].ingredients;
    const ingredientList = rawIngredients
      .split(/,|;/)
      .map(i => i.replace(/\(.*?\)/g, '').replace(/[^a-zA-Z0-9\s-]/g, '').trim().toLowerCase())
      .filter(i => i.length > 2 && i.length < 40)
      .slice(0, 15); // Spoonacular limit

    if (ingredientList.length === 0) {
      return res.json({ recipes: [], pantry_items: [] });
    }

    // Get user's pantry items for cross-reference
    let pantryNames = [];
    if (req.user) {
      const pantryResult = await pool.query(
        `SELECT LOWER(COALESCE(p.name, pi.custom_name, '')) as item_name
         FROM pantry_items pi
         LEFT JOIN products p ON pi.product_id = p.id
         WHERE pi.user_id = $1 AND pi.status = 'active'`,
        [req.user.id]
      );
      pantryNames = pantryResult.rows.map(r => r.item_name).filter(Boolean);
    }

    // Call Spoonacular findByIngredients
    const params = new URLSearchParams({
      apiKey,
      ingredients: ingredientList.join(','),
      number: '6',
      ranking: '2', // minimize missing ingredients
      ignorePantry: 'false'
    });
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    let spoonRes;
    try {
      spoonRes = await fetch(
        `https://api.spoonacular.com/recipes/findByIngredients?${params}`,
        { signal: controller.signal }
      );
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      console.warn('Spoonacular fetch failed:', fetchErr.name === 'AbortError' ? 'timeout' : fetchErr.message);
      return res.json({ recipes: [], pantry_items: [] });
    }
    clearTimeout(timeoutId);

    if (!spoonRes.ok) {
      console.error('Spoonacular error:', spoonRes.status, await spoonRes.text());
      return res.json({ recipes: [], pantry_items: [] });
    }

    const spoonRecipes = await spoonRes.json();
    if (!Array.isArray(spoonRecipes)) {
      console.warn('Spoonacular returned non-array:', typeof spoonRecipes);
      return res.json({ recipes: [], pantry_items: [] });
    }

    // Cross-reference each recipe's ingredients with user pantry
    const enriched = spoonRecipes.map(recipe => {
      const allIngredients = [
        ...(recipe.usedIngredients || []),
        ...(recipe.missedIngredients || [])
      ];

      const ingredients = allIngredients.map(ing => {
        const name = ing.name || ing.originalName || '';
        const inPantry = pantryNames.some(p =>
          p.includes(name.toLowerCase()) || name.toLowerCase().includes(p)
        );
        return {
          name,
          amount: ing.amount,
          unit: ing.unit,
          image: ing.image,
          in_pantry: inPantry,
          is_from_product: (recipe.usedIngredients || []).some(u => u.id === ing.id)
        };
      });

      return {
        id: recipe.id,
        title: recipe.title,
        image: recipe.image,
        used_count: recipe.usedIngredientCount,
        missed_count: recipe.missedIngredientCount,
        ingredients,
        have_count: ingredients.filter(i => i.in_pantry || i.is_from_product).length,
        need_count: ingredients.filter(i => !i.in_pantry && !i.is_from_product).length
      };
    });

    res.json({ recipes: enriched, pantry_items: pantryNames });
  } catch (err) {
    console.error('Spoonacular fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch recipe suggestions' });
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
    if (Array.isArray(recipe.replaces_products) && recipe.replaces_products.length > 0) {
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
