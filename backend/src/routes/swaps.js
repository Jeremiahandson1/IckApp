import express from 'express';
import pool from '../db/init.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { getScoreRating } from '../utils/helpers.js';

const router = express.Router();

// Get swaps for a product
router.get('/for/:upc', optionalAuth, async (req, res) => {
  try {
    const { upc } = req.params;

    // Get original product
    const productResult = await pool.query(
      `SELECT p.*, c.name as company_name 
       FROM products p 
       LEFT JOIN companies c ON p.company_id = c.id
       WHERE p.upc = $1`,
      [upc]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = productResult.rows[0];
    let swaps = [];

    // 1. Check for hand-curated direct swaps first
    if (product.swaps_to && product.swaps_to.length > 0) {
      const swapUpcs = Array.isArray(product.swaps_to) ? product.swaps_to : JSON.parse(product.swaps_to);
      const swapResult = await pool.query(
        `SELECT p.*, c.name as company_name 
         FROM products p 
         LEFT JOIN companies c ON p.company_id = c.id
         WHERE p.upc = ANY($1::text[])`,
        [swapUpcs]
      );
      swaps = swapResult.rows;
    }

    // 2. If no direct swaps, find by category with higher score
    //    Handle OFF-style categories (en:breakfast-cereals) and plain categories
    if (swaps.length === 0 && product.category) {
      const categoryResult = await pool.query(
        `SELECT p.*, c.name as company_name 
         FROM products p 
         LEFT JOIN companies c ON p.company_id = c.id
         WHERE (
           p.category = $1 
           OR p.category ILIKE $4
         )
         AND p.total_score > $2
         AND p.total_score IS NOT NULL
         AND p.upc != $3
         ORDER BY p.total_score DESC
         LIMIT 20`,
        [
          product.category,
          Math.max(product.total_score || 0, 40), // must actually be better, min 40
          upc,
          // Fuzzy: extract last segment of "en:breakfast-cereals" → "%breakfast-cereals%"
          `%${product.category.split(':').pop().replace(/-/g, '%')}%`
        ]
      );

      // Post-filter: remove obviously wrong product types
      // e.g., prevent "Kind bar" → "Organic apple sauce" when both are in "en:snacks"
      const origName = `${product.name || ''} ${product.brand || ''} ${product.subcategory || ''}`.toLowerCase();
      const typeKeywords = [
        ['bar', 'bars'], ['cereal', 'loops', 'flakes', 'crunch', 'puffs', 'oats', 'oatmeal', 'granola', 'muesli'],
        ['chips', 'crisps', 'tortilla'], ['crackers', 'cracker', 'bunnies', 'goldfish'],
        ['cookies', 'cookie', 'biscuit'], ['candy', 'candies', 'gummies', 'gummy'],
        ['chocolate', 'cocoa'], ['juice', 'drink', 'beverage'],
        ['sauce', 'ketchup', 'mustard', 'dressing'], ['yogurt', 'yoghurt'],
        ['bread', 'bagel', 'muffin'], ['pasta', 'noodle', 'macaroni'],
        ['apple sauce', 'applesauce', 'puree'],
        ['baby', 'infant', 'toddler'],
      ];
      // Find which type group the scanned product belongs to
      const origTypes = typeKeywords.filter(group => group.some(kw => origName.includes(kw)));
      
      if (origTypes.length > 0) {
        // Always filter when we can identify product type — 0 good results > 5 garbage results
        const origKeywords = origTypes.flat();
        const filtered = categoryResult.rows.filter(r => {
          const rName = `${r.name || ''} ${r.brand || ''} ${r.subcategory || ''}`.toLowerCase();
          return origKeywords.some(kw => rName.includes(kw));
        });
        swaps = filtered.slice(0, 5);
      } else {
        swaps = categoryResult.rows.slice(0, 5);
      }
    }

    // 3. If still nothing, try matching by brand similarity + higher score
    if (swaps.length === 0 && product.brand) {
      // Find products in similar name space with better scores
      // e.g., if scanning "Kraft Mac & Cheese", find other mac & cheese products
      const nameWords = product.name?.split(/\s+/).filter(w => w.length > 3) || [];
      if (nameWords.length > 0) {
        // Use the most distinctive word(s) from the product name
        const searchTerm = nameWords.slice(0, 2).join(' & ');
        const nameResult = await pool.query(
          `SELECT p.*, c.name as company_name 
           FROM products p 
           LEFT JOIN companies c ON p.company_id = c.id
           WHERE to_tsvector('english', p.name) @@ plainto_tsquery('english', $1)
           AND p.total_score > $2
           AND p.total_score IS NOT NULL
           AND p.upc != $3
           AND p.brand != $4
           ORDER BY p.total_score DESC
           LIMIT 5`,
          [searchTerm, Math.max(product.total_score || 0, 40), upc, product.brand || '']
        );
        swaps = nameResult.rows;
      }
    }

    // Format swaps with score improvement + nearby store availability
    const formattedSwaps = [];
    for (const swap of swaps) {
      let nearbyStores = [];

      // Layer 1: Community sightings (most recent, verified)
      try {
        const sightingResult = await pool.query(
          `SELECT store_name, store_address, store_zip, price, aisle, 
                  verified_count, 'community' as source
           FROM local_sightings
           WHERE upc = $1 AND in_stock = true
           AND last_verified_at > NOW() - INTERVAL '90 days'
           ORDER BY verified_count DESC LIMIT 3`,
          [swap.upc]
        );
        nearbyStores = sightingResult.rows;
      } catch (e) { /* table may not exist yet */ }

      // Layer 2: Flyer crawler (nationwide, price data)
      if (nearbyStores.length < 3) {
        try {
          const flyerResult = await pool.query(
            `SELECT DISTINCT ON (merchant) 
               merchant as store_name, price, price_text, crawled_at, 'flyer' as source
             FROM flyer_availability
             WHERE upc = $1 AND expires_at > NOW()
             ORDER BY merchant, crawled_at DESC LIMIT 5`,
            [swap.upc]
          );
          const flyerStores = flyerResult.rows.map(r => ({
            store_name: r.store_name, price: r.price, price_text: r.price_text,
            source: 'flyer',
            disclaimer: `Price as of ${new Date(r.crawled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          }));
          const seen = new Set(nearbyStores.map(s => s.store_name?.toLowerCase()?.replace(/[^a-z]/g, '')));
          const flyerUnique = flyerStores.filter(s => !seen.has(s.store_name?.toLowerCase()?.replace(/[^a-z]/g, '')));
          nearbyStores = [...nearbyStores, ...flyerUnique].slice(0, 5);
        } catch (e) { /* flyer table may not exist yet */ }
      }

      // Layer 3: Curated ground-truth (always available for top swap products)
      if (nearbyStores.length < 3) {
        try {
          const curatedResult = await pool.query(
            `SELECT store_name, 'curated' as source FROM curated_availability WHERE upc = $1 ORDER BY store_name LIMIT 8`,
            [swap.upc]
          );
          const seen = new Set(nearbyStores.map(s => s.store_name?.toLowerCase()?.replace(/[^a-z]/g, '')));
          const curatedUnique = curatedResult.rows.filter(s => !seen.has(s.store_name?.toLowerCase()?.replace(/[^a-z]/g, '')));
          nearbyStores = [...nearbyStores, ...curatedUnique].slice(0, 5);
        } catch (e) { /* curated table may not exist yet */ }
      }

      formattedSwaps.push({
        ...swap,
        ...getScoreRating(swap.total_score),
        score_improvement: (swap.total_score || 0) - (product.total_score || 0),
        savings_potential: product.typical_price && swap.typical_price
          ? (product.typical_price - swap.typical_price).toFixed(2)
          : null,
        nearby_stores: nearbyStores
      });
    }

    // Get homemade alternatives (recipes)
    // Build recipe category candidates from product data + name keywords
    const recipeCategories = [product.category, product.subcategory || ''];
    
    // Map product name/category keywords to recipe categories
    const nameAndCat = `${product.name || ''} ${product.category || ''} ${product.subcategory || ''}`.toLowerCase();
    const recipeKeywordMap = {
      'cereal|loops|flakes|puffs|crunch': ['Kids Cereal', 'Cereal'],
      'oats|oatmeal|porridge': ['Instant Oatmeal'],
      'bar|protein bar|granola bar|nut bar': ['Snack Bars'],
      'chips|crisps|tortilla|puffs|popcorn': ['Chips'],
      'candy|chocolate|gummies|gummy': ['Candy'],
      'juice|drink|lemonade': ['Juice Drinks'],
      'sport.*drink|electrolyte|gatorade': ['Sports Drinks'],
      'baby|infant|toddler|puree': ['Baby Snacks'],
      'fruit snack|fruit roll|fruit leather': ['Fruit Snacks'],
      'sauce|marinara|tomato sauce': ['Pasta Sauce'],
      'mac.*cheese|macaroni': ['Mac & Cheese'],
      'dressing|vinaigrette': ['Salad Dressing'],
      'ketchup|mustard|mayo|condiment': ['Condiments'],
      'frozen|pizza|nugget|waffle': ['Frozen Meals'],
      'ice cream|popsicle|frozen treat': ['Frozen Treats'],
      'pancake|waffle mix': ['Pancake Mix'],
      'cheese dip|queso|nacho': ['Cheese Dips'],
    };
    for (const [pattern, cats] of Object.entries(recipeKeywordMap)) {
      if (new RegExp(pattern, 'i').test(nameAndCat)) {
        recipeCategories.push(...cats);
      }
    }

    const recipeResult = await pool.query(
      `SELECT * FROM recipes 
       WHERE replaces_category = ANY($1::text[])
       OR replaces_products @> $2::jsonb`,
      [[...new Set(recipeCategories)], JSON.stringify([upc])]
    );

    res.json({
      original: {
        ...product,
        ...getScoreRating(product.total_score)
      },
      swaps: formattedSwaps,
      homemade_alternatives: recipeResult.rows
    });

  } catch (err) {
    console.error('Swaps error:', err);
    res.status(500).json({ error: 'Failed to get swaps' });
  }
});

// Track swap click
router.post('/click', authenticateToken, async (req, res) => {
  try {
    const { from_product_id, to_product_id, from_upc, to_upc } = req.body;

    // Resolve IDs and UPCs — frontend may send either
    let fromId = from_product_id, toId = to_product_id;
    let fromUpc = from_upc, toUpc = to_upc;

    if (from_product_id && !from_upc) {
      const r = await pool.query('SELECT upc FROM products WHERE id = $1', [from_product_id]);
      fromUpc = r.rows[0]?.upc;
    }
    if (to_product_id && !to_upc) {
      const r = await pool.query('SELECT upc FROM products WHERE id = $1', [to_product_id]);
      toUpc = r.rows[0]?.upc;
    }
    if (from_upc && !from_product_id) {
      const r = await pool.query('SELECT id FROM products WHERE upc = $1', [from_upc]);
      fromId = r.rows[0]?.id;
    }
    if (to_upc && !to_product_id) {
      const r = await pool.query('SELECT id FROM products WHERE upc = $1', [to_upc]);
      toId = r.rows[0]?.id;
    }

    await pool.query(
      `INSERT INTO swap_clicks (user_id, from_product_id, to_product_id, from_upc, to_upc)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.id, fromId, toId, fromUpc, toUpc]
    );

    // Update engagement
    await pool.query(
      `UPDATE user_engagement 
       SET total_swaps_clicked = total_swaps_clicked + 1, updated_at = NOW()
       WHERE user_id = $1`,
      [req.user.id]
    );

    res.json({ tracked: true });

  } catch (err) {
    console.error('Swap click error:', err);
    res.status(500).json({ error: 'Failed to track swap click' });
  }
});

// Mark swap as purchased
router.post('/purchased', authenticateToken, async (req, res) => {
  try {
    const { from_upc, to_upc } = req.body;

    // Update most recent swap click
    await pool.query(
      `UPDATE swap_clicks 
       SET purchased = true, purchased_at = NOW()
       WHERE id = (
         SELECT id FROM swap_clicks
         WHERE user_id = $1 AND from_upc = $2 AND to_upc = $3
         AND purchased = false
         ORDER BY clicked_at DESC
         LIMIT 1
       )`,
      [req.user.id, from_upc, to_upc]
    );

    // Update engagement
    await pool.query(
      `UPDATE user_engagement 
       SET total_swaps_purchased = total_swaps_purchased + 1, updated_at = NOW()
       WHERE user_id = $1`,
      [req.user.id]
    );

    res.json({ tracked: true });

  } catch (err) {
    console.error('Swap purchased error:', err);
    res.status(500).json({ error: 'Failed to track purchase' });
  }
});

// Get user's swap history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT sc.*,
              fp.name as from_name, fp.brand as from_brand, fp.total_score as from_score,
              tp.name as to_name, tp.brand as to_brand, tp.total_score as to_score
       FROM swap_clicks sc
       LEFT JOIN products fp ON sc.from_product_id = fp.id
       LEFT JOIN products tp ON sc.to_product_id = tp.id
       WHERE sc.user_id = $1
       ORDER BY sc.clicked_at DESC
       LIMIT 50`,
      [req.user.id]
    );

    res.json(result.rows);

  } catch (err) {
    console.error('Swap history error:', err);
    res.status(500).json({ error: 'Failed to get swap history' });
  }
});

// Get swap recommendations — pantry first, then scan history fallback
// Works for both logged-in users and returns curated "popular swaps" for anonymous
router.get('/recommendations', optionalAuth, async (req, res) => {
  try {
    let sourceItems = [];

    if (req.user) {
      // 1. Try pantry items first
      const pantryResult = await pool.query(
        `SELECT pi.upc, p.name, p.brand, p.category, p.total_score, p.swaps_to, p.image_url
         FROM pantry_items pi
         JOIN products p ON pi.product_id = p.id
         WHERE pi.user_id = $1 
         AND pi.status = 'active'
         AND p.total_score < 70
         ORDER BY p.total_score ASC
         LIMIT 10`,
        [req.user.id]
      );
      sourceItems = pantryResult.rows;

      // 2. If pantry empty, fall back to recent scans
      if (sourceItems.length === 0) {
        const scanResult = await pool.query(
          `SELECT DISTINCT ON (sl.upc) sl.upc, p.name, p.brand, p.category, p.total_score, p.swaps_to, p.image_url
           FROM scan_logs sl
           JOIN products p ON sl.upc = p.upc
           WHERE sl.user_id = $1 
           AND p.total_score IS NOT NULL
           AND p.total_score < 70
           ORDER BY sl.upc, sl.scanned_at DESC
           LIMIT 10`,
          [req.user.id]
        );
        sourceItems = scanResult.rows;
      }
    }

    // 3. If still empty (anonymous or no history), show popular curated swaps
    if (sourceItems.length === 0) {
      const curatedResult = await pool.query(
        `SELECT upc, name, brand, category, total_score, swaps_to, image_url
         FROM products
         WHERE swaps_to IS NOT NULL AND swaps_to != '[]'
         AND total_score IS NOT NULL AND total_score < 60
         ORDER BY total_score ASC
         LIMIT 10`
      );
      sourceItems = curatedResult.rows;
    }

    const recommendations = [];

    for (const item of sourceItems) {
      let bestSwap = null;
      
      if (item.swaps_to && item.swaps_to.length > 0) {
        const swapUpcs = Array.isArray(item.swaps_to) ? item.swaps_to : JSON.parse(item.swaps_to);
        const swapResult = await pool.query(
          `SELECT * FROM products WHERE upc = ANY($1::text[]) ORDER BY total_score DESC LIMIT 1`,
          [swapUpcs]
        );
        if (swapResult.rows.length > 0) bestSwap = swapResult.rows[0];
      }

      if (!bestSwap && item.category) {
        const categoryResult = await pool.query(
          `SELECT * FROM products 
           WHERE category = $1 AND total_score > $2 AND is_clean_alternative = true
           ORDER BY total_score DESC LIMIT 1`,
          [item.category, item.total_score]
        );
        if (categoryResult.rows.length > 0) bestSwap = categoryResult.rows[0];
      }

      if (bestSwap) {
        recommendations.push({
          current: { ...item, ...getScoreRating(item.total_score) },
          recommended: { ...bestSwap, ...getScoreRating(bestSwap.total_score) },
          score_improvement: bestSwap.total_score - item.total_score
        });
      }
    }

    recommendations.sort((a, b) => b.score_improvement - a.score_improvement);
    res.json(recommendations);

  } catch (err) {
    console.error('Recommendations error:', err);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

export default router;
