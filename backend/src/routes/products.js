import express from 'express';
import fetch from 'node-fetch';
import pool from '../db/init.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { getScoreRating } from '../utils/helpers.js';
import { scoreProduct as calculateProductScore } from '../utils/scoring.js';
import { lookupByUPC as usdaLookup, searchProducts as usdaSearch } from '../utils/usda.js';
import { lookupByBarcode as fatsecretLookup, searchFoods as fatsecretSearch } from '../utils/fatsecret.js';

const router = express.Router();

// Scan/lookup product by UPC
// Scanning is FREE and UNLIMITED — the core feature must never be gated.
// Premium gates: pantry audit, shopping lists, detailed progress analytics.
router.get('/scan/:upc', optionalAuth, async (req, res) => {
  try {
    const { upc } = req.params;

    // First check our database
    let result = await pool.query(
      `SELECT p.*, c.name as company_name, c.behavior_score, c.controversies
       FROM products p
       LEFT JOIN companies c ON p.company_id = c.id
       WHERE p.upc = $1`,
      [upc]
    );

    if (result.rows.length > 0) {
      const product = result.rows[0];
      const scoreInfo = getScoreRating(product.total_score);

      // Log scan and update engagement
      if (req.user) {
        await pool.query('INSERT INTO scan_logs (user_id, upc) VALUES ($1, $2)', [req.user.id, upc]);
        await pool.query(
          `UPDATE user_engagement 
           SET total_products_scanned = total_products_scanned + 1, updated_at = NOW()
           WHERE user_id = $1`,
          [req.user.id]
        );
      }

      return res.json({
        ...product,
        ...scoreInfo,
        source: 'database'
      });
    }

    // If not in our DB, fetch from Open Food Facts
    const offResponse = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${upc}.json`,
      { headers: { 'User-Agent': 'Ick/1.0' } }
    );
    const offData = await offResponse.json();

    if (offData.status !== 1 || !offData.product) {
      // ═══ FALLBACK 2: USDA FoodData Central ═══
      // 380,000+ branded US products — free API
      const usdaProduct = await usdaLookup(upc);
      
      if (!usdaProduct) {
        // ═══ FALLBACK 3: FatSecret (Premier Free = barcode lookup) ═══
        const fsProduct = await fatsecretLookup(upc);

        if (!fsProduct) {
          return res.status(404).json({ 
            error: 'Product not found', 
            upc,
            message: 'Not in our database, Open Food Facts, USDA, or FatSecret. Help us grow — submit this product!'
          });
        }

        // Score the FatSecret product
        const fsScores = await calculateProductScore({
          ingredients: fsProduct.ingredients || '',
          brand: fsProduct.brand,
          nutriscore_grade: null,
          nova_group: null,
          nutriments: fsProduct.nutrition_facts ? {
            'energy-kcal_100g': fsProduct.nutrition_facts.energy_kcal_100g,
            fat_100g: fsProduct.nutrition_facts.fat_100g,
            'saturated-fat_100g': fsProduct.nutrition_facts.saturated_fat_100g,
            carbohydrates_100g: fsProduct.nutrition_facts.carbohydrates_100g,
            sugars_100g: fsProduct.nutrition_facts.sugars_100g,
            fiber_100g: fsProduct.nutrition_facts.fiber_100g,
            proteins_100g: fsProduct.nutrition_facts.proteins_100g,
            sodium_100g: fsProduct.nutrition_facts.sodium_100g,
            salt_100g: fsProduct.nutrition_facts.salt_100g,
          } : null,
          labels: fsProduct.is_organic ? ['en:organic'] : [],
          allergens_tags: [],
        });

        // Save to our database
        const fsInsert = await pool.query(
          `INSERT INTO products (upc, name, brand, category, image_url, ingredients,
           nutrition_score, additives_score, organic_bonus,
           harmful_ingredients_score, banned_elsewhere_score, transparency_score, processing_score, company_behavior_score,
           harmful_ingredients_found, nutrition_facts, allergens_tags,
           nutriscore_grade, nova_group, is_organic)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
           ON CONFLICT (upc) DO UPDATE SET
             name = EXCLUDED.name,
             nutrition_score = EXCLUDED.nutrition_score,
             additives_score = EXCLUDED.additives_score,
             organic_bonus = EXCLUDED.organic_bonus,
             harmful_ingredients_score = EXCLUDED.harmful_ingredients_score,
             banned_elsewhere_score = EXCLUDED.banned_elsewhere_score,
             transparency_score = EXCLUDED.transparency_score,
             processing_score = EXCLUDED.processing_score,
             company_behavior_score = EXCLUDED.company_behavior_score,
             harmful_ingredients_found = EXCLUDED.harmful_ingredients_found,
             nutrition_facts = EXCLUDED.nutrition_facts,
             allergens_tags = EXCLUDED.allergens_tags,
             is_organic = EXCLUDED.is_organic,
             updated_at = NOW()
           RETURNING id, total_score`,
          [
            upc,
            fsProduct.name,
            fsProduct.brand,
            fsProduct.category,
            null,
            fsProduct.ingredients || '',
            fsScores?.nutrition_score ?? null,
            fsScores?.additives_score ?? null,
            fsScores?.organic_bonus ?? 0,
            fsScores?.harmful_ingredients_score ?? null,
            fsScores?.banned_elsewhere_score ?? null,
            fsScores?.transparency_score ?? null,
            fsScores?.processing_score ?? null,
            fsScores?.company_behavior_score ?? null,
            fsScores?.harmful_ingredients_found ? JSON.stringify(fsScores.harmful_ingredients_found) : null,
            fsScores?.nutrition_facts ? JSON.stringify(fsScores.nutrition_facts) : JSON.stringify(fsProduct.nutrition_facts || {}),
            '[]',
            fsScores?.nutriscore_grade || null,
            fsScores?.nova_group || null,
            fsProduct.is_organic || false,
          ]
        );

        const fsSavedScore = fsInsert.rows[0]?.total_score;
        const fsScoreInfo = getScoreRating(fsSavedScore);

        if (req.user) {
          await pool.query('INSERT INTO scan_logs (user_id, upc) VALUES ($1, $2)', [req.user.id, upc]);
          await pool.query(
            `UPDATE user_engagement 
             SET total_products_scanned = total_products_scanned + 1, updated_at = NOW()
             WHERE user_id = $1`,
            [req.user.id]
          );
        }

        return res.json({
          id: fsInsert.rows[0]?.id,
          upc,
          name: fsProduct.name,
          brand: fsProduct.brand,
          category: fsProduct.category,
          image_url: null,
          ingredients: fsProduct.ingredients || '',
          ...(fsScores || {}),
          total_score: fsSavedScore,
          ...fsScoreInfo,
          source: 'fatsecret'
        });
      }

      // Score the USDA product
      const usdaScores = await calculateProductScore({
        ingredients: usdaProduct.ingredients,
        brand: usdaProduct.brand,
        nutriscore_grade: null,
        nova_group: null,
        nutriments: usdaProduct.nutrition_facts ? {
          'energy-kcal_100g': usdaProduct.nutrition_facts.energy_kcal_100g,
          fat_100g: usdaProduct.nutrition_facts.fat_100g,
          'saturated-fat_100g': usdaProduct.nutrition_facts.saturated_fat_100g,
          carbohydrates_100g: usdaProduct.nutrition_facts.carbohydrates_100g,
          sugars_100g: usdaProduct.nutrition_facts.sugars_100g,
          fiber_100g: usdaProduct.nutrition_facts.fiber_100g,
          proteins_100g: usdaProduct.nutrition_facts.proteins_100g,
          sodium_100g: usdaProduct.nutrition_facts.sodium_100g,
          salt_100g: usdaProduct.nutrition_facts.salt_100g,
        } : null,
        labels: usdaProduct.is_organic ? ['en:organic'] : [],
        allergens_tags: usdaProduct.allergens_tags || [],
      });

      // Save to our database
      const usdaInsert = await pool.query(
        `INSERT INTO products (upc, name, brand, category, image_url, ingredients,
         nutrition_score, additives_score, organic_bonus,
         harmful_ingredients_score, banned_elsewhere_score, transparency_score, processing_score, company_behavior_score,
         harmful_ingredients_found, nutrition_facts, allergens_tags,
         nutriscore_grade, nova_group, is_organic)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
         ON CONFLICT (upc) DO UPDATE SET
           name = EXCLUDED.name,
           nutrition_score = EXCLUDED.nutrition_score,
           additives_score = EXCLUDED.additives_score,
           organic_bonus = EXCLUDED.organic_bonus,
           harmful_ingredients_score = EXCLUDED.harmful_ingredients_score,
           banned_elsewhere_score = EXCLUDED.banned_elsewhere_score,
           transparency_score = EXCLUDED.transparency_score,
           processing_score = EXCLUDED.processing_score,
           company_behavior_score = EXCLUDED.company_behavior_score,
           harmful_ingredients_found = EXCLUDED.harmful_ingredients_found,
           nutrition_facts = EXCLUDED.nutrition_facts,
           allergens_tags = EXCLUDED.allergens_tags,
           is_organic = EXCLUDED.is_organic,
           updated_at = NOW()
         RETURNING id, total_score`,
        [
          upc,
          usdaProduct.name,
          usdaProduct.brand,
          usdaProduct.category,
          null, // USDA doesn't provide images
          usdaProduct.ingredients,
          usdaScores?.nutrition_score ?? null,
          usdaScores?.additives_score ?? null,
          usdaScores?.organic_bonus ?? 0,
          usdaScores?.harmful_ingredients_score ?? null,
          usdaScores?.banned_elsewhere_score ?? null,
          usdaScores?.transparency_score ?? null,
          usdaScores?.processing_score ?? null,
          usdaScores?.company_behavior_score ?? null,
          usdaScores?.harmful_ingredients_found ? JSON.stringify(usdaScores.harmful_ingredients_found) : null,
          usdaScores?.nutrition_facts ? JSON.stringify(usdaScores.nutrition_facts) : JSON.stringify(usdaProduct.nutrition_facts || {}),
          usdaProduct.allergens_tags ? JSON.stringify(usdaProduct.allergens_tags) : '[]',
          usdaScores?.nutriscore_grade || null,
          usdaScores?.nova_group || null,
          usdaProduct.is_organic || false,
        ]
      );

      const usdaSavedScore = usdaInsert.rows[0]?.total_score;
      const usdaScoreInfo = getScoreRating(usdaSavedScore);

      // Log scan
      if (req.user) {
        await pool.query('INSERT INTO scan_logs (user_id, upc) VALUES ($1, $2)', [req.user.id, upc]);
        await pool.query(
          `UPDATE user_engagement 
           SET total_products_scanned = total_products_scanned + 1, updated_at = NOW()
           WHERE user_id = $1`,
          [req.user.id]
        );
      }

      return res.json({
        id: usdaInsert.rows[0]?.id,
        upc,
        name: usdaProduct.name,
        brand: usdaProduct.brand,
        category: usdaProduct.category,
        image_url: null,
        ingredients: usdaProduct.ingredients,
        ...(usdaScores || {}),
        total_score: usdaSavedScore,
        ...usdaScoreInfo,
        source: 'usda'
      });
    }

    const offProduct = offData.product;
    const ingredients = offProduct.ingredients_text || offProduct.ingredients_text_en || '';
    const brand = offProduct.brands || 'Unknown Brand';

    // Calculate scores using full OFF data (v2 scoring engine)
    const scores = await calculateProductScore({
      ingredients,
      brand,
      nutriscore_grade: offProduct.nutriscore_grade || null,
      nova_group: offProduct.nova_group || null,
      nutriments: offProduct.nutriments || null,
      labels: offProduct.labels_tags || [],
      allergens_tags: offProduct.allergens_tags || [],
    });

    // Save to our database with full nutritional data
    const insertResult = await pool.query(
      `INSERT INTO products (upc, name, brand, category, image_url, ingredients,
       nutrition_score, additives_score, organic_bonus,
       harmful_ingredients_score, banned_elsewhere_score, transparency_score, processing_score, company_behavior_score,
       harmful_ingredients_found, nutrition_facts, allergens_tags,
       nutriscore_grade, nova_group, is_organic)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       ON CONFLICT (upc) DO UPDATE SET
         name = EXCLUDED.name,
         nutrition_score = EXCLUDED.nutrition_score,
         additives_score = EXCLUDED.additives_score,
         organic_bonus = EXCLUDED.organic_bonus,
         harmful_ingredients_score = EXCLUDED.harmful_ingredients_score,
         banned_elsewhere_score = EXCLUDED.banned_elsewhere_score,
         transparency_score = EXCLUDED.transparency_score,
         processing_score = EXCLUDED.processing_score,
         company_behavior_score = EXCLUDED.company_behavior_score,
         harmful_ingredients_found = EXCLUDED.harmful_ingredients_found,
         nutrition_facts = EXCLUDED.nutrition_facts,
         allergens_tags = EXCLUDED.allergens_tags,
         nutriscore_grade = EXCLUDED.nutriscore_grade,
         nova_group = EXCLUDED.nova_group,
         is_organic = EXCLUDED.is_organic,
         updated_at = NOW()
       RETURNING id, total_score`,
      [
        upc,
        offProduct.product_name || 'Unknown Product',
        brand,
        offProduct.categories_tags?.[0]?.replace('en:', '') || 'Unknown',
        offProduct.image_url || offProduct.image_front_url,
        ingredients,
        scores?.nutrition_score ?? null,
        scores?.additives_score ?? null,
        scores?.organic_bonus ?? 0,
        scores?.harmful_ingredients_score ?? null,
        scores?.banned_elsewhere_score ?? null,
        scores?.transparency_score ?? null,
        scores?.processing_score ?? null,
        scores?.company_behavior_score ?? null,
        scores?.harmful_ingredients_found ? JSON.stringify(scores.harmful_ingredients_found) : null,
        scores?.nutrition_facts ? JSON.stringify(scores.nutrition_facts) : '{}',
        scores?.allergens_tags ? JSON.stringify(scores.allergens_tags) : '[]',
        scores?.nutriscore_grade || null,
        scores?.nova_group || null,
        scores?.is_organic || false,
      ]
    );

    const savedTotalScore = insertResult.rows[0]?.total_score;
    const scoreInfo = getScoreRating(savedTotalScore);

    // Log scan and update engagement
    if (req.user) {
      await pool.query('INSERT INTO scan_logs (user_id, upc) VALUES ($1, $2)', [req.user.id, upc]);
      await pool.query(
        `UPDATE user_engagement 
         SET total_products_scanned = total_products_scanned + 1, updated_at = NOW()
         WHERE user_id = $1`,
        [req.user.id]
      );
    }

    res.json({
      id: insertResult.rows[0]?.id,
      upc,
      name: offProduct.product_name || 'Unknown Product',
      brand,
      category: offProduct.categories_tags?.[0]?.replace('en:', '') || 'Unknown',
      image_url: offProduct.image_url || offProduct.image_front_url,
      ingredients,
      ...(scores || {}),
      total_score: savedTotalScore,
      ...scoreInfo,
      source: 'openfoodfacts'
    });

  } catch (err) {
    console.error('Product scan error:', err);
    res.status(500).json({ error: 'Failed to scan product' });
  }
});

// View a product by UPC — no scan log, no rate limit, DB only
// Used when navigating directly to /product/:upc (bookmarks, shared links)
router.get('/view/:upc', optionalAuth, async (req, res) => {
  try {
    const { upc } = req.params;
    const result = await pool.query(
      `SELECT p.*, c.name as company_name, c.behavior_score, c.controversies
       FROM products p
       LEFT JOIN companies c ON p.company_id = c.id
       WHERE p.upc = $1`,
      [upc]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found', upc });
    }

    const product = result.rows[0];
    const scoreInfo = getScoreRating(product.total_score);

    res.json({ ...product, ...scoreInfo, source: 'database' });
  } catch (err) {
    console.error('Product view error:', err);
    res.status(500).json({ error: 'Failed to load product' });
  }
});

// Search products
// Get user's scan history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const result = await pool.query(
      `SELECT sl.upc, sl.scanned_at, 
              p.name, p.brand, p.image_url, p.total_score, p.category,
              p.nutrition_score, p.additives_score
       FROM scan_logs sl
       LEFT JOIN products p ON sl.upc = p.upc
       WHERE sl.user_id = $1
       ORDER BY sl.scanned_at DESC
       LIMIT $2`,
      [req.user.id, parseInt(limit)]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Scan history error:', err);
    res.status(500).json({ error: 'Failed to load scan history' });
  }
});

router.get('/search', async (req, res) => {
  try {
    const { q, category, min_score, max_score, limit = 20 } = req.query;

    let query = `
      SELECT p.*, c.name as company_name
      FROM products p
      LEFT JOIN companies c ON p.company_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 0;

    if (q) {
      paramCount++;
      query += ` AND (p.name ILIKE $${paramCount} OR p.brand ILIKE $${paramCount})`;
      params.push(`%${q}%`);
    }

    if (category) {
      paramCount++;
      query += ` AND p.category = $${paramCount}`;
      params.push(category);
    }

    if (min_score) {
      paramCount++;
      query += ` AND p.total_score >= $${paramCount}`;
      params.push(parseInt(min_score));
    }

    if (max_score) {
      paramCount++;
      query += ` AND p.total_score <= $${paramCount}`;
      params.push(parseInt(max_score));
    }

    paramCount++;
    query += ` ORDER BY p.total_score DESC LIMIT $${paramCount}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    
    let products = result.rows.map(p => ({
      ...p,
      ...getScoreRating(p.total_score)
    }));

    // If local DB has few results and we have a text query, search Open Food Facts
    if (q && products.length < 5) {
      try {
        const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=true&page_size=10&fields=code,product_name,brands,image_url,nutriscore_grade,nova_group,categories_tags`;
        const offRes = await fetch(offUrl, {
          headers: { 'User-Agent': 'Ick/2.0' },
          signal: AbortSignal.timeout(3000) // 3s timeout
        });
        if (offRes.ok) {
          const offData = await offRes.json();
          const existingUpcs = new Set(products.map(p => p.upc));
          const offProducts = (offData.products || [])
            .filter(p => p.code && p.product_name && !existingUpcs.has(p.code))
            .slice(0, 10 - products.length)
            .map(p => {
              // Quick-score from Nutri-Score grade so search results aren't blank
              const nutriscoreMap = { a: 95, b: 75, c: 50, d: 25, e: 10 };
              const quickScore = p.nutriscore_grade 
                ? Math.round(nutriscoreMap[p.nutriscore_grade.toLowerCase()] * 0.60 + 50 * 0.30 + 0)
                : null;
              return {
                upc: p.code,
                name: p.product_name,
                brand: p.brands || 'Unknown',
                image_url: p.image_url || null,
                nutriscore_grade: p.nutriscore_grade || null,
                nova_group: p.nova_group || null,
                category: p.categories_tags?.[0]?.replace('en:', '') || null,
                total_score: quickScore, // Estimated — full score on scan
                estimated_score: !!quickScore,
                source: 'openfoodfacts',
                ...getScoreRating(quickScore)
              };
            });
          products = [...products, ...offProducts];
        }
      } catch (offErr) {
        // OFF search failed — just return local results
      }
    }

    // If still few results, try USDA Branded Foods search
    if (q && products.length < 5) {
      try {
        const usdaResults = await usdaSearch(q, 10 - products.length);
        const existingUpcs = new Set(products.map(p => p.upc));
        const usdaProducts = usdaResults
          .filter(p => p.upc && p.name && !existingUpcs.has(p.upc))
          .slice(0, 10 - products.length)
          .map(p => ({
            upc: p.upc,
            name: p.name,
            brand: p.brand,
            category: p.category,
            image_url: null,
            total_score: null, // Full score calculated on scan
            estimated_score: false,
            source: 'usda',
          }));
        products = [...products, ...usdaProducts];
      } catch (usdaErr) {
        // USDA search failed — continue with what we have
      }
    }

    // If still few results, try FatSecret search
    if (q && products.length < 5) {
      try {
        const fsResults = await fatsecretSearch(q, 10 - products.length);
        const existingNames = new Set(products.map(p => p.name?.toLowerCase()));
        const fsProducts = fsResults
          .filter(p => p.name && !existingNames.has(p.name.toLowerCase()))
          .slice(0, 10 - products.length)
          .map(p => ({
            name: p.name,
            brand: p.brand,
            category: 'Food',
            image_url: null,
            total_score: null,
            estimated_score: false,
            source: 'fatsecret',
            fatsecret_food_id: p.fatsecret_food_id,
          }));
        products = [...products, ...fsProducts];
      } catch (fsErr) {
        // FatSecret search failed — continue
      }
    }

    res.json(products);

  } catch (err) {
    console.error('Product search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get harmful ingredient details
// IMPORTANT: Must be before /:id to avoid being caught by the wildcard
router.get('/ingredients/harmful', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM harmful_ingredients ORDER BY severity DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Harmful ingredients error:', err);
    res.status(500).json({ error: 'Failed to get harmful ingredients' });
  }
});

// Get categories
// IMPORTANT: Must be before /:id to avoid being caught by the wildcard
router.get('/meta/categories', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT category FROM products WHERE category IS NOT NULL ORDER BY category'
    );
    res.json(result.rows.map(r => r.category));
  } catch (err) {
    console.error('Categories error:', err);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

// ============================================================
// CURATED PRODUCTS (for offline pre-loading)
// Returns all products with swap mappings for IndexedDB cache
// ============================================================
router.get('/curated', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.upc, p.name, p.brand, p.category, p.subcategory,
             p.total_score, p.nutrition_score, p.additives_score, p.organic_bonus,
             p.nutriscore_grade, p.nova_group, p.image_url,
             p.allergens_tags, p.ingredients,
             p.is_organic
      FROM products p
      ORDER BY p.total_score DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Curated products error:', err);
    res.status(500).json({ error: 'Failed to load curated products' });
  }
});

// ============================================================
// FAVORITES
// ============================================================

// Get user's favorites
router.get('/favorites', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT uf.upc, uf.created_at as favorited_at,
              p.name, p.brand, p.image_url, p.total_score, p.category,
              p.nutriscore_grade, p.nova_group
       FROM user_favorites uf
       LEFT JOIN products p ON uf.upc = p.upc
       WHERE uf.user_id = $1
       ORDER BY uf.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Favorites error:', err);
    res.status(500).json({ error: 'Failed to load favorites' });
  }
});

// Add favorite
router.post('/favorites/:upc', authenticateToken, async (req, res) => {
  try {
    const { upc } = req.params;
    // Get product_id if it exists
    const product = await pool.query('SELECT id FROM products WHERE upc = $1', [upc]);
    const productId = product.rows[0]?.id || null;

    await pool.query(
      `INSERT INTO user_favorites (user_id, upc, product_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, upc) DO NOTHING`,
      [req.user.id, upc, productId]
    );
    res.json({ favorited: true });
  } catch (err) {
    console.error('Add favorite error:', err);
    res.status(500).json({ error: 'Failed to add favorite' });
  }
});

// Remove favorite
router.delete('/favorites/:upc', authenticateToken, async (req, res) => {
  try {
    const { upc } = req.params;
    await pool.query(
      'DELETE FROM user_favorites WHERE user_id = $1 AND upc = $2',
      [req.user.id, upc]
    );
    res.json({ favorited: false });
  } catch (err) {
    console.error('Remove favorite error:', err);
    res.status(500).json({ error: 'Failed to remove favorite' });
  }
});

// Check if favorited
router.get('/favorites/check/:upc', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id FROM user_favorites WHERE user_id = $1 AND upc = $2',
      [req.user.id, req.params.upc]
    );
    res.json({ favorited: result.rows.length > 0 });
  } catch (err) {
    res.json({ favorited: false });
  }
});

// ── Product Contributions (user-submitted missing products) ──

// Submit a product that wasn't found
router.post('/contribute', optionalAuth, async (req, res) => {
  try {
    const { upc, name, brand, ingredients_text } = req.body;
    if (!upc) return res.status(400).json({ error: 'UPC required' });

    // Check if already contributed
    const existing = await pool.query(
      'SELECT id FROM product_contributions WHERE upc = $1 AND status = $2',
      [upc, 'pending']
    );
    if (existing.rows.length > 0) {
      return res.json({ message: 'This product has already been submitted. Thanks!' });
    }

    await pool.query(
      `INSERT INTO product_contributions (upc, name, brand, ingredients_text, submitted_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [upc, name || null, brand || null, ingredients_text || null, req.user?.id || null]
    );

    res.json({ message: 'Thanks! We\'ll add this product within 48 hours.' });
  } catch (err) {
    console.error('Contribution error:', err);
    res.status(500).json({ error: 'Failed to submit' });
  }
});

// ── Family Profiles ──

// Get all family profiles
router.get('/family', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM family_profiles WHERE user_id = $1 ORDER BY is_default DESC, created_at ASC',
      [req.user.id]
    );
    
    // If no profiles, create default from user's allergens
    if (result.rows.length === 0) {
      const user = await pool.query('SELECT name, allergen_alerts FROM users WHERE id = $1', [req.user.id]);
      const defaultProfile = await pool.query(
        `INSERT INTO family_profiles (user_id, name, avatar, allergen_alerts, is_default)
         VALUES ($1, $2, '👤', $3, true)
         RETURNING *`,
        [req.user.id, user.rows[0]?.name || 'Me', JSON.stringify(user.rows[0]?.allergen_alerts || [])]
      );
      return res.json(defaultProfile.rows);
    }
    
    res.json(result.rows);
  } catch (err) {
    console.error('Family profiles error:', err);
    res.status(500).json({ error: 'Failed to load profiles' });
  }
});

// Add family profile
router.post('/family', authenticateToken, async (req, res) => {
  try {
    const { name, avatar, allergen_alerts, dietary_prefs } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    // Max 6 profiles
    const count = await pool.query('SELECT COUNT(*) FROM family_profiles WHERE user_id = $1', [req.user.id]);
    if (parseInt(count.rows[0].count) >= 6) {
      return res.status(400).json({ error: 'Maximum 6 family profiles' });
    }

    const result = await pool.query(
      `INSERT INTO family_profiles (user_id, name, avatar, allergen_alerts, dietary_prefs)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, name, avatar || '👤', JSON.stringify(allergen_alerts || []), JSON.stringify(dietary_prefs || [])]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Add family profile error:', err);
    res.status(500).json({ error: 'Failed to add profile' });
  }
});

// Update family profile
router.put('/family/:id', authenticateToken, async (req, res) => {
  try {
    const { name, avatar, allergen_alerts, dietary_prefs } = req.body;
    const result = await pool.query(
      `UPDATE family_profiles SET name = COALESCE($1, name), avatar = COALESCE($2, avatar),
       allergen_alerts = COALESCE($3, allergen_alerts), dietary_prefs = COALESCE($4, dietary_prefs)
       WHERE id = $5 AND user_id = $6 RETURNING *`,
      [name, avatar, allergen_alerts ? JSON.stringify(allergen_alerts) : null,
       dietary_prefs ? JSON.stringify(dietary_prefs) : null, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Delete family profile
router.delete('/family/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM family_profiles WHERE id = $1 AND user_id = $2 AND is_default = false',
      [req.params.id, req.user.id]);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete profile' });
  }
});

// ============================================================
// PRODUCT DETAILS (catch-all — MUST be LAST route)
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isNumeric = /^\d+$/.test(id);
    
    const result = await pool.query(
      isNumeric
        ? `SELECT p.*, c.name as company_name, c.behavior_score, c.controversies, 
                  c.positive_actions, c.lobbying_history
           FROM products p
           LEFT JOIN companies c ON p.company_id = c.id
           WHERE p.id = $1 OR p.upc = $2`
        : `SELECT p.*, c.name as company_name, c.behavior_score, c.controversies, 
                  c.positive_actions, c.lobbying_history
           FROM products p
           LEFT JOIN companies c ON p.company_id = c.id
           WHERE p.upc = $1`,
      isNumeric ? [parseInt(id), id] : [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const product = result.rows[0];

    // Get swaps for this product
    let swaps = [];
    if (product.swaps_to && product.swaps_to.length > 0) {
      const swapUpcs = Array.isArray(product.swaps_to) ? product.swaps_to : JSON.parse(product.swaps_to);
      const swapResult = await pool.query(
        `SELECT * FROM products WHERE upc = ANY($1::text[])`,
        [swapUpcs]
      );
      swaps = swapResult.rows.map(s => ({
        ...s,
        ...getScoreRating(s.total_score)
      }));
    }

    // Get recipes that replace this product
    const recipeResult = await pool.query(
      `SELECT * FROM recipes WHERE replaces_category = $1 OR replaces_products @> $2::jsonb`,
      [product.category, JSON.stringify([product.upc])]
    );

    res.json({
      ...product,
      ...getScoreRating(product.total_score),
      swaps,
      recipes: recipeResult.rows
    });

  } catch (err) {
    console.error('Product details error:', err);
    res.status(500).json({ error: 'Failed to get product details' });
  }
});

export default router;
