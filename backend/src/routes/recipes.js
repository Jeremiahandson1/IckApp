import express from 'express';
import crypto from 'crypto';
import pool from '../db/init.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// ── recipe_cache helpers ──
// Spoonacular results are stable for a given input — caching avoids burning
// API points (free tier is 150/day) on repeated identical requests.

function hashKey(obj) {
  return crypto.createHash('sha1').update(JSON.stringify(obj)).digest('hex');
}

async function getRecipeCache(cacheKey, cacheType, ttlSeconds) {
  try {
    const result = await pool.query(
      `SELECT data FROM recipe_cache
       WHERE cache_key = $1 AND cache_type = $2
         AND created_at > NOW() - (INTERVAL '1 second' * $3)`,
      [cacheKey, cacheType, ttlSeconds]
    );
    return result.rows.length > 0 ? result.rows[0].data : null;
  } catch {
    return null;
  }
}

async function setRecipeCache(cacheKey, cacheType, data) {
  try {
    await pool.query(
      `INSERT INTO recipe_cache (cache_key, cache_type, data, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (cache_key) DO UPDATE SET
         data = EXCLUDED.data,
         cache_type = EXCLUDED.cache_type,
         created_at = NOW()`,
      [cacheKey, cacheType, JSON.stringify(data)]
    );
  } catch (e) {
    console.warn('[recipe_cache] write failed:', e.message);
  }
}

// Build the WHERE-clause + params from query string filters.
// Used by both GET /recipes and GET /recipes/meta/count so they stay in sync.
function buildRecipeFilter(q) {
  const { category, difficulty, max_time, kid_friendly } = q;
  const where = ['1=1'];
  const params = [];
  if (category) {
    params.push(category);
    where.push(`replaces_category = $${params.length}`);
  }
  if (difficulty) {
    params.push(String(difficulty).toLowerCase());
    where.push(`LOWER(difficulty) = $${params.length}`);
  }
  if (max_time) {
    params.push(parseInt(max_time, 10));
    where.push(`total_time_minutes <= $${params.length}`);
  }
  if (kid_friendly === 'true') {
    where.push(`kid_friendly = true`);
  }
  return { whereSql: where.join(' AND '), params };
}

// Get all recipes — supports limit/offset pagination.
// Returns a flat array (backward-compatible). Clients infer "has more" by
// checking whether the returned array length equals the limit they requested.
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const { whereSql, params } = buildRecipeFilter(req.query);
    params.push(limit, offset);
    const sql = `SELECT * FROM recipes WHERE ${whereSql}
                 ORDER BY name
                 LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Recipes fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

// Count endpoint — used by the frontend to render "X of Y" without
// scanning the whole paginated list. Same filter logic as GET /.
router.get('/meta/count', async (req, res) => {
  try {
    const { whereSql, params } = buildRecipeFilter(req.query);
    const result = await pool.query(
      `SELECT COUNT(*)::int AS total FROM recipes WHERE ${whereSql}`,
      params
    );
    res.json({ total: result.rows[0].total });
  } catch (err) {
    console.error('Recipes count error:', err);
    res.status(500).json({ error: 'Failed to count recipes' });
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
    // replaces_products is a JSONB array like ["043000012345"], so use array containment
    const result = await pool.query(
      `SELECT * FROM recipes
       WHERE replaces_products @> $1::jsonb
       OR replaces_category = $2
       ORDER BY total_time_minutes ASC`,
      [JSON.stringify([upc]), category]
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

// Spoonacular: general recipe search (complexSearch).
// Body: { q, cuisine, diet, intolerances, max_time, number }
router.get('/spoonacular/search', optionalAuth, async (req, res) => {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Spoonacular not configured' });
  }

  try {
    const { q = '', cuisine, diet, intolerances, max_time, number = 24 } = req.query;
    const cappedNumber = Math.min(parseInt(number, 10) || 24, 50);

    // Cache key normalizes query/filter inputs so "Salmon" and "salmon  " hit
    // the same row. TTL: 24h — Spoonacular's catalog doesn't churn fast enough
    // to matter for browsing.
    const cacheKey = hashKey({
      q: q.trim().toLowerCase(),
      cuisine: (cuisine || '').toLowerCase(),
      diet: (diet || '').toLowerCase(),
      intolerances: (intolerances || '').toLowerCase(),
      max_time: max_time ? parseInt(max_time, 10) : null,
      number: cappedNumber,
    });
    const cached = await getRecipeCache(cacheKey, 'spoonacular_search', 24 * 3600);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const params = new URLSearchParams({
      apiKey,
      number: String(cappedNumber),
      addRecipeInformation: 'true',
      instructionsRequired: 'true',
      fillIngredients: 'true',
    });
    if (q) params.set('query', q);
    if (cuisine) params.set('cuisine', cuisine);
    if (diet) params.set('diet', diet);
    if (intolerances) params.set('intolerances', intolerances);
    if (max_time) params.set('maxReadyTime', String(parseInt(max_time, 10)));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    let spoonRes;
    try {
      spoonRes = await fetch(
        `https://api.spoonacular.com/recipes/complexSearch?${params}`,
        { signal: controller.signal }
      );
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      console.warn('Spoonacular search fetch failed:', fetchErr.name === 'AbortError' ? 'timeout' : fetchErr.message);
      return res.json({ recipes: [], total: 0 });
    }
    clearTimeout(timeoutId);

    if (!spoonRes.ok) {
      console.error('Spoonacular search error:', spoonRes.status, await spoonRes.text());
      return res.json({ recipes: [], total: 0 });
    }

    const data = await spoonRes.json();
    const results = Array.isArray(data.results) ? data.results : [];

    const recipes = results.map(r => ({
      id: r.id,
      title: r.title,
      image: r.image,
      ready_in_minutes: r.readyInMinutes,
      servings: r.servings,
      vegetarian: r.vegetarian,
      vegan: r.vegan,
      gluten_free: r.glutenFree,
      dairy_free: r.dairyFree,
      summary: r.summary,
      source_url: r.sourceUrl,
      cuisines: r.cuisines || [],
      dish_types: r.dishTypes || [],
    }));

    const payload = { recipes, total: data.totalResults || recipes.length };
    await setRecipeCache(cacheKey, 'spoonacular_search', payload);
    res.json(payload);
  } catch (err) {
    console.error('Spoonacular search error:', err);
    res.status(500).json({ error: 'Failed to search recipes' });
  }
});

// Spoonacular: "What can I cook with what's in my pantry?"
// Pulls active pantry items, asks findByIngredients, enriches with what user has.
router.get('/spoonacular/from-pantry', authenticateToken, async (req, res) => {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Spoonacular not configured' });
  }

  try {
    const number = Math.min(parseInt(req.query.number, 10) || 8, 16);

    // Pull active pantry — prefer product name, fall back to custom name
    const pantryResult = await pool.query(
      `SELECT LOWER(COALESCE(p.name, pi.custom_name, '')) as item_name
       FROM pantry_items pi
       LEFT JOIN products p ON pi.product_id = p.id
       WHERE pi.user_id = $1 AND pi.status = 'active'
       LIMIT 30`,
      [req.user.id]
    );
    const pantryNames = pantryResult.rows
      .map(r => r.item_name)
      .filter(Boolean)
      .map(s => s.trim());

    if (pantryNames.length < 2) {
      return res.json({
        recipes: [],
        pantry_items: pantryNames,
        reason: 'pantry_too_small',
        message: 'Add at least 2 items to your pantry to get recipe suggestions.',
      });
    }

    // Normalize to single-token-ish ingredient names Spoonacular understands
    const ingredients = pantryNames
      .map(n => n.replace(/\(.*?\)/g, '').replace(/[^a-z0-9\s-]/gi, '').trim())
      .filter(n => n.length > 2 && n.length < 40)
      .slice(0, 15);

    // Cache key includes user + pantry fingerprint (sorted), so a pantry edit
    // invalidates naturally. TTL: 1h — short enough that frequent shoppers
    // see fresh suggestions, long enough that re-opening the tab is free.
    const cacheKey = hashKey({
      uid: req.user.id,
      ingredients: [...ingredients].sort(),
      number,
    });
    const cached = await getRecipeCache(cacheKey, 'spoonacular_pantry', 3600);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const params = new URLSearchParams({
      apiKey,
      ingredients: ingredients.join(','),
      number: String(number),
      ranking: '2', // minimize missing ingredients
      ignorePantry: 'false',
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
      console.warn('Spoonacular pantry fetch failed:', fetchErr.name === 'AbortError' ? 'timeout' : fetchErr.message);
      return res.json({ recipes: [], pantry_items: pantryNames });
    }
    clearTimeout(timeoutId);

    if (!spoonRes.ok) {
      console.error('Spoonacular pantry error:', spoonRes.status, await spoonRes.text());
      return res.json({ recipes: [], pantry_items: pantryNames });
    }

    const spoonRecipes = await spoonRes.json();
    if (!Array.isArray(spoonRecipes)) {
      return res.json({ recipes: [], pantry_items: pantryNames });
    }

    // Enrich with pantry coverage info
    const enriched = spoonRecipes.map(recipe => {
      const all = [
        ...(recipe.usedIngredients || []),
        ...(recipe.missedIngredients || []),
      ];
      const ings = all.map(ing => {
        const name = (ing.name || ing.originalName || '').toLowerCase();
        const inPantry = pantryNames.some(p => p.includes(name) || name.includes(p));
        return {
          name: ing.name || ing.originalName,
          amount: ing.amount,
          unit: ing.unit,
          image: ing.image,
          in_pantry: inPantry,
        };
      });
      return {
        id: recipe.id,
        title: recipe.title,
        image: recipe.image,
        used_count: recipe.usedIngredientCount,
        missed_count: recipe.missedIngredientCount,
        ingredients: ings,
        have_count: ings.filter(i => i.in_pantry).length,
        need_count: ings.filter(i => !i.in_pantry).length,
      };
    });

    const payload = { recipes: enriched, pantry_items: pantryNames };
    await setRecipeCache(cacheKey, 'spoonacular_pantry', payload);
    res.json(payload);
  } catch (err) {
    console.error('Spoonacular pantry error:', err);
    res.status(500).json({ error: 'Failed to fetch pantry recipes' });
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
