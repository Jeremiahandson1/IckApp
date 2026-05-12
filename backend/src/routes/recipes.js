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

// Get all recipes — supports limit/offset pagination.
// Returns a flat array (backward-compatible). Clients infer "has more" by
// checking whether the returned array length equals the limit they requested.
router.get('/', async (req, res) => {
  try {
    const { category, difficulty, max_time, kid_friendly } = req.query;

    // Pagination: default 50, hard cap 200 to prevent runaway payloads.
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

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
      params.push(parseInt(max_time, 10));
    }
    if (kid_friendly === 'true') {
      query += ' AND kid_friendly = true';
    }

    paramCount++;
    query += ` ORDER BY name LIMIT $${paramCount}`;
    params.push(limit);
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    params.push(offset);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Recipes fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

// Count endpoint — used by the frontend to render "X recipes total" without
// scanning the whole paginated list. Same filters as GET /.
router.get('/meta/count', async (req, res) => {
  try {
    const { category, difficulty, max_time, kid_friendly } = req.query;
    let query = 'SELECT COUNT(*)::int AS total FROM recipes WHERE 1=1';
    const params = [];
    let paramCount = 0;
    if (category)   { paramCount++; query += ` AND replaces_category = $${paramCount}`; params.push(category); }
    if (difficulty) { paramCount++; query += ` AND difficulty = $${paramCount}`; params.push(difficulty); }
    if (max_time)   { paramCount++; query += ` AND total_time_minutes <= $${paramCount}`; params.push(parseInt(max_time, 10)); }
    if (kid_friendly === 'true') query += ' AND kid_friendly = true';
    const result = await pool.query(query, params);
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

// Spoonacular: find recipes using product ingredients, cross-ref with pantry.
// Path includes explicit /by-upc/ to avoid colliding with sibling routes
// (/spoonacular/search, /spoonacular/from-pantry) defined below.
router.get('/spoonacular/by-upc/:upc', optionalAuth, async (req, res) => {
  const apiKey = process.env.SPOONACULAR_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Spoonacular not configured' });
  }

  try {
    const { upc } = req.params;

    // ── Cache check: return cached Spoonacular result if fresh (<24h) ──
    const CACHE_TTL_HOURS = 24;
    try {
      const cached = await pool.query(
        `SELECT data FROM result_cache
         WHERE upc = $1 AND cache_type = 'spoonacular'
         AND created_at > NOW() - INTERVAL '${CACHE_TTL_HOURS} hours'`,
        [upc]
      );
      if (cached.rows.length > 0) {
        const cachedRecipes = cached.rows[0].data.recipes || [];

        // Re-apply pantry enrichment (user-specific)
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

        const enriched = cachedRecipes.map(recipe => {
          const ingredients = (recipe.ingredients || []).map(ing => {
            const name = (ing.name || '').toLowerCase();
            const inPantry = pantryNames.some(p =>
              p.includes(name) || name.includes(p)
            );
            return { ...ing, in_pantry: inPantry };
          });
          return {
            ...recipe,
            ingredients,
            have_count: ingredients.filter(i => i.in_pantry || i.is_from_product).length,
            need_count: ingredients.filter(i => !i.in_pantry && !i.is_from_product).length
          };
        });

        return res.json({ recipes: enriched, pantry_items: pantryNames, cached: true });
      }
    } catch (e) { /* cache table may not exist — fall through */ }

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

    // ── Cache store: save base recipes (without pantry enrichment) ──
    try {
      const baseRecipes = enriched.map(r => ({
        ...r,
        ingredients: r.ingredients.map(ing => ({ ...ing, in_pantry: false })),
        have_count: r.ingredients.filter(i => i.is_from_product).length,
        need_count: r.ingredients.filter(i => !i.is_from_product).length
      }));
      await pool.query(
        `INSERT INTO result_cache (upc, cache_type, data, created_at)
         VALUES ($1, 'spoonacular', $2, NOW())
         ON CONFLICT (upc, cache_type) DO UPDATE SET
           data = EXCLUDED.data, created_at = NOW()`,
        [upc, JSON.stringify({ recipes: baseRecipes })]
      );
    } catch (e) { /* cache write failure is non-fatal */ }

    res.json({ recipes: enriched, pantry_items: pantryNames });
  } catch (err) {
    console.error('Spoonacular fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch recipe suggestions' });
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
    const { q = '', cuisine, diet, intolerances, max_time, number = 12 } = req.query;
    const cappedNumber = Math.min(parseInt(number, 10) || 12, 24);

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
