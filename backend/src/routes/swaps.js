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

    // Helper: extract product type keywords from name for smarter matching
    // "Salted Caramel Dark Chocolate Nut" (Kind) → type: bar (from brand context)
    // "Fruity Pebbles Cereal" → type: cereal
    const productTypes = {
      bar:      /\b(bar|bars|protein bar|granola bar|nut bar|snack bar|energy bar)\b/i,
      cereal:   /\b(cereal|cereals|flakes|puffs|loops|crunch|o's|oats|granola|muesli)\b/i,
      chips:    /\b(chips|crisps|tortilla|puffs|popcorn|pretzels)\b/i,
      crackers: /\b(crackers|cracker|goldfish|bunnies|crisps|thins)\b/i,
      cookies:  /\b(cookies|cookie|wafers|biscuits|oreo)\b/i,
      candy:    /\b(candy|candies|gummies|gummy|gems|cups|truffles|bonbons|m&m|skittles|sour|caramels|fudge|licorice|jelly beans)\b/i,
      drink:    /\b(juice|drink|water|soda|tea|coffee|milk|lemonade|smoothie)\b/i,
      sauce:    /\b(sauce|ketchup|mustard|mayo|dressing|salsa|dip)\b/i,
      yogurt:   /\b(yogurt|yoghurt|parfait|kefir)\b/i,
      bread:    /\b(bread|bagel|muffin|roll|bun|tortilla|wrap|pita)\b/i,
      pasta:    /\b(pasta|noodle|spaghetti|macaroni|mac.*cheese|ramen)\b/i,
      frozen:   /\b(frozen|pizza|nuggets|fries|ice cream|popsicle|waffles)\b/i,
      baby:     /\b(baby|infant|toddler|puree|formula|gerber|beech-nut)\b/i,
      fruit:    /\b(fruit snack|fruit roll|fruit leather|dried fruit|applesauce|apple sauce)\b/i,
    };

    // Also check brand for type hints (e.g., Kind = bars, Cheerios = cereal)
    const brandTypeHints = {
      'kind': 'bar', 'rxbar': 'bar', 'larabar': 'bar', 'clif': 'bar', 'gomacro': 'bar',
      'nature valley': 'bar', 'luna': 'bar', 'quest': 'bar', 'built': 'bar',
      'cheerios': 'cereal', 'kashi': 'cereal', 'three wishes': 'cereal',
      'doritos': 'chips', 'lay\'s': 'chips', 'kettle': 'chips',
      'goldfish': 'crackers', 'annie\'s': 'crackers',
      'oreo': 'cookies', 'chips ahoy': 'cookies',
      'dove': 'candy', 'hershey': 'candy', 'reese': 'candy', 'snickers': 'candy',
      'milky way': 'candy', 'twix': 'candy', 'butterfinger': 'candy', 'nestle': 'candy',
      'unreal': 'candy', 'hu': 'candy', 'lindt': 'candy', 'ghirardelli': 'candy',
    };

    // Broader filter regexes — used when filtering category results (more inclusive than detection)
    const typeFilters = {
      ...productTypes,
      candy: /\b(candy|candies|chocolate|gummies|gummy|gems|cups|truffles|bonbons|m&m|skittles|sour|caramels|fudge|licorice|jelly beans|cocoa)\b/i,
      bar: /\b(bar|bars|protein bar|granola bar|nut bar|snack bar|energy bar|kind|rxbar|larabar|clif)\b/i,
    };

    const nameForMatch = `${product.name || ''} ${product.brand || ''}`.toLowerCase();
    let detectedType = null;
    
    // Brand hints first — more reliable than name keywords
    if (product.brand) {
      const brandLower = product.brand.toLowerCase();
      for (const [brand, type] of Object.entries(brandTypeHints)) {
        if (brandLower.includes(brand)) {
          detectedType = type;
          break;
        }
      }
    }
    
    // Name-based detection only if brand didn't match
    if (!detectedType) {
      for (const [type, regex] of Object.entries(productTypes)) {
        if (regex.test(nameForMatch)) {
          detectedType = type;
          break;
        }
      }
    }

    // 2. Subcategory match first (most specific)
    if (swaps.length === 0 && product.subcategory) {
      const subResult = await pool.query(
        `SELECT p.*, c.name as company_name 
         FROM products p 
         LEFT JOIN companies c ON p.company_id = c.id
         WHERE p.subcategory = $1
         AND p.total_score > $2
         AND p.total_score IS NOT NULL
         AND p.upc != $3
         ORDER BY p.total_score DESC
         LIMIT 5`,
        [product.subcategory, Math.max(product.total_score || 0, 40), upc]
      );
      swaps = subResult.rows;
    }

    // 3. Category match WITH product type filter (prevents bar → apple sauce)
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
          Math.max(product.total_score || 0, 40),
          upc,
          `%${product.category.split(':').pop().replace(/-/g, '%')}%`
        ]
      );
      
      // If we detected a product type, filter results to same type
      if (detectedType && categoryResult.rows.length > 0) {
        const typeRegex = typeFilters[detectedType] || productTypes[detectedType];
        const typed = categoryResult.rows.filter(r => {
          const rName = `${r.name || ''} ${r.brand || ''} ${r.subcategory || ''}`.toLowerCase();
          return typeRegex.test(rName);
        });
        // Only use same-type matches — don't fall back to garbage like apple sauce for chocolate
        swaps = typed.slice(0, 5);
      } else {
        swaps = categoryResult.rows.slice(0, 5);
      }
    }

    // 4. Name-based matching — find products with similar product words
    if (swaps.length === 0) {
      // Strip brand from name to get product-descriptive words
      const brandWords = (product.brand || '').toLowerCase().split(/\s+/);
      const nameWords = (product.name || '').split(/\s+/)
        .filter(w => w.length > 3 && !brandWords.includes(w.toLowerCase()))
        .map(w => w.toLowerCase());
      
      // Try progressively broader searches — type keyword first (most relevant)
      const searches = [];
      if (detectedType) searches.push(detectedType);
      if (nameWords.length >= 2) searches.push(nameWords.slice(0, 2).join(' '));
      if (nameWords.length >= 1) searches.push(nameWords[0]);

      for (const searchTerm of searches) {
        if (swaps.length > 0) break;
        try {
          const nameResult = await pool.query(
            `SELECT p.*, c.name as company_name 
             FROM products p 
             LEFT JOIN companies c ON p.company_id = c.id
             WHERE to_tsvector('english', COALESCE(p.name,'') || ' ' || COALESCE(p.brand,'') || ' ' || COALESCE(p.subcategory,''))
                   @@ plainto_tsquery('english', $1)
             AND p.total_score > $2
             AND p.total_score IS NOT NULL
             AND p.upc != $3
             AND p.brand != $4
             ORDER BY p.total_score DESC
             LIMIT 5`,
            [searchTerm, Math.max(product.total_score || 0, 40), upc, product.brand || '']
          );
          swaps = nameResult.rows;
        } catch (e) { /* non-fatal */ }
      }
    }

    // Format swaps with score improvement + nearby store availability
    const formattedSwaps = [];
    for (const swap of swaps) {
      let nearbyStores = [];

      // Layer 1: Community sightings
      try {
        const sightingResult = await pool.query(
          `SELECT store_name, store_address, store_zip, price, aisle, verified_count, 'community' as source
           FROM local_sightings
           WHERE upc = $1 AND in_stock = true AND last_verified_at > NOW() - INTERVAL '90 days'
           ORDER BY verified_count DESC LIMIT 3`,
          [swap.upc]
        );
        nearbyStores = sightingResult.rows;
      } catch (e) { /* non-fatal */ }

      // Layer 2: Flyer crawler (nationwide, everyone)
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
          nearbyStores = [...nearbyStores, ...flyerStores.filter(s => !seen.has(s.store_name?.toLowerCase()?.replace(/[^a-z]/g, '')))].slice(0, 5);
        } catch (e) { /* flyer_availability table may not exist yet */ }
      }

      // Layer 3: Curated ground-truth (always available baseline)
      if (nearbyStores.length < 3) {
        try {
          const curatedResult = await pool.query(
            `SELECT store_name, 'curated' as source FROM curated_availability WHERE upc = $1 LIMIT 8`,
            [swap.upc]
          );
          const seen = new Set(nearbyStores.map(s => s.store_name?.toLowerCase()?.replace(/[^a-z]/g, '')));
          nearbyStores = [...nearbyStores, ...curatedResult.rows.filter(s => !seen.has(s.store_name?.toLowerCase()?.replace(/[^a-z]/g, '')))].slice(0, 5);
        } catch (e) { /* curated_availability table may not exist yet */ }
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
    const recipeResult = await pool.query(
      `SELECT * FROM recipes 
       WHERE replaces_category = $1 
       OR replaces_products @> $2::jsonb`,
      [product.category, JSON.stringify([upc])]
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
