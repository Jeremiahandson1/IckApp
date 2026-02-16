import express from 'express';
import pool from '../db/init.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import { getScoreRating } from '../utils/helpers.js';
import { findDynamicSwaps, getProductType } from '../utils/swap-discovery.js';

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
      const validUpcs = swapUpcs.filter(u => u && u.length > 0);
      if (validUpcs.length > 0) {
        const swapResult = await pool.query(
          `SELECT p.*, c.name as company_name 
           FROM products p 
           LEFT JOIN companies c ON p.company_id = c.id
           WHERE p.upc = ANY($1::text[])
           AND p.total_score IS NOT NULL`,
          [validUpcs]
        );
        swaps = swapResult.rows;
      }
    }

    // 1.5. If no swaps_to (or swap targets don't exist in DB), find another UPC of the 
    //      same product that HAS working swaps. Handles: "Skittles Original" UPC A has [],
    //      but "Skittles Original" UPC B has ['smartsweets_upc']. Also handles name variants
    //      like "Original Skittles" vs "Skittles Original" vs "Skittles - Original Bite Size"
    if (swaps.length === 0 && product.name) {
      try {
        // Extract core product name words (remove generic words like Original, Classic, etc.)
        const stopWords = ['original', 'classic', 'regular', 'the', 'bite', 'size', 'candy', 'candies', 'cereal', 'snack', 'snacks', 'bar', 'bars', 'flavored'];
        const coreWords = product.name
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter(w => w.length > 2 && !stopWords.includes(w));
        
        if (coreWords.length > 0) {
          // Build ILIKE pattern: find any product containing the core name words
          const likePatterns = coreWords.map(w => `%${w}%`);
          
          // Query: find products with matching names that have non-empty swaps_to
          // Use the most specific (longest) word first for better matching
          const sortedWords = [...coreWords].sort((a, b) => b.length - a.length);
          const primaryWord = sortedWords[0];
          
          const nameMatch = await pool.query(
            `SELECT swaps_to, name, upc FROM products 
             WHERE LOWER(name) ILIKE $1
             AND upc != $2 
             AND swaps_to IS NOT NULL 
             AND swaps_to != '[]' 
             AND swaps_to != 'null'
             AND jsonb_array_length(swaps_to::jsonb) > 0
             ORDER BY 
               CASE WHEN LOWER(name) = LOWER($3) THEN 0 ELSE 1 END,
               LENGTH(swaps_to::text) DESC
             LIMIT 3`,
            [`%${primaryWord}%`, upc, product.name]
          );
          
          // Try each match — pick the first one whose swap targets actually exist
          for (const match of nameMatch.rows) {
            const swapUpcs = Array.isArray(match.swaps_to) 
              ? match.swaps_to 
              : JSON.parse(match.swaps_to);
            const validUpcs = swapUpcs.filter(u => u && u.length > 0);
            if (validUpcs.length === 0) continue;
            
            const swapResult = await pool.query(
              `SELECT p.*, c.name as company_name 
               FROM products p 
               LEFT JOIN companies c ON p.company_id = c.id
               WHERE p.upc = ANY($1::text[])
               AND p.total_score IS NOT NULL`,
              [validUpcs]
            );
            if (swapResult.rows.length > 0) {
              swaps = swapResult.rows;
              break;
            }
          }
        }
      } catch (e) { /* non-fatal */ }
    }

    // 2. Smart subcategory + name matching
    //    The old approach matched on OFF's broad categories like "en:snacks" which 
    //    returned chia seeds as swaps for fruit snacks. Now we:
    //    a) Match subcategory first (most specific)
    //    b) Match product TYPE via name keywords
    //    c) Return NOTHING rather than garbage — 0 results > 5 wrong results
    if (swaps.length === 0) {
      const fullName = `${product.name || ''} ${product.subcategory || ''} ${product.category || ''}`.toLowerCase();
      
      // Helper: check if a candidate matches the product type (must_contain + exclude)
      const matchesType = (candidateName, type) => {
        const name = candidateName.toLowerCase();
        const hasRequired = type.must_contain.some(kw => name.includes(kw));
        const hasExcluded = (type.exclude || []).some(kw => name.includes(kw));
        return hasRequired && !hasExcluded;
      };
      
      // Identify what TYPE of product this is and build targeted search
      // Each entry has: test (regex), search terms, must_contain keywords, exclude keywords
      const productTypeMap = [
        { test: /fruit\s*snack|fruit\s*roll|fruit\s*leather|fruit\s*gumm/i, 
          search: "fruit snack organic", must_contain: ['fruit snack', 'fruit roll', 'fruit leather', 'fruit bite'],
          exclude: ['nut', 'seed', 'chip'] },
        { test: /granola\s*bar|chewy\s*bar|oat\s*bar|snack\s*bar/i, 
          search: "organic granola bar clean", must_contain: ['bar', 'granola'],
          exclude: ['cereal', 'cookie'] },
        { test: /protein\s*bar|energy\s*bar/i, 
          search: "organic protein bar", must_contain: ['bar', 'protein'],
          exclude: ['cereal', 'cookie'] },
        { test: /cookie|biscuit/i, 
          search: "organic cookies clean", must_contain: ['cookie', 'biscuit'],
          exclude: ['chip', 'cracker'] },
        { test: /cracker|goldfish|cheez-?it/i, 
          search: "organic crackers clean", must_contain: ['cracker'],
          exclude: ['cookie', 'chip'] },
        { test: /tortilla\s*chip|corn\s*chip|nacho|dorito|tostito/i, 
          search: "organic tortilla chips", must_contain: ['tortilla', 'corn chip', 'nacho'],
          exclude: ['cookie', 'cracker', 'chocolate'] },
        { test: /potato\s*chip|chip|crisp|lay'?s|pringle|cheeto|frito/i, 
          search: "organic potato chips", must_contain: ['potato', 'chip', 'crisp', 'kettle'],
          exclude: ['cookie', 'chocolate', 'tortilla'] },
        { test: /cereal|loops|flakes|puffs|crunch|charms/i, 
          search: "organic cereal clean", must_contain: ['cereal', 'flake', 'puff', 'crunch', 'loop', 'o\'s', 'grain'],
          exclude: ['bar', 'cookie'] },
        { test: /candy|skittle|gumm|sour|jelly/i, 
          search: "organic candy clean low sugar", must_contain: ['candy', 'gumm', 'sour', 'sweet'],
          exclude: ['chocolate', 'bar', 'chip'] },
        { test: /chocolate\s*(bar|candy)|cocoa/i, 
          search: "organic dark chocolate bar", must_contain: ['chocolate', 'cocoa'],
          exclude: ['cookie', 'cereal', 'milk', 'chip'] },
        { test: /mac.*cheese|macaroni/i, 
          search: "organic mac cheese", must_contain: ['mac', 'cheese', 'macaroni'],
          exclude: ['pizza', 'sauce'] },
        { test: /yogurt|yoghurt/i, 
          search: "organic yogurt", must_contain: ['yogurt', 'yoghurt'],
          exclude: ['bar', 'drink'] },
        { test: /ice\s*cream|frozen\s*dessert/i, 
          search: "organic ice cream", must_contain: ['ice cream', 'frozen'],
          exclude: ['sandwich', 'bar'] },
        { test: /juice|lemonade|fruit\s*drink/i, 
          search: "organic juice 100", must_contain: ['juice', 'lemonade'],
          exclude: ['snack', 'bar', 'candy'] },
        { test: /soda|cola|sprite|pop/i, 
          search: "sparkling water prebiotic soda", must_contain: ['sparkling', 'soda', 'cola', 'water'],
          exclude: ['candy', 'gummy'] },
        { test: /bread|bun|roll/i, 
          search: "organic whole grain bread", must_contain: ['bread', 'grain', 'wheat'],
          exclude: ['crumb', 'stick'] },
        { test: /pasta\s*sauce|marinara|tomato\s*sauce/i, 
          search: "organic pasta sauce marinara", must_contain: ['sauce', 'marinara'],
          exclude: ['pizza', 'salsa'] },
        { test: /ketchup/i, 
          search: "organic ketchup unsweetened", must_contain: ['ketchup'],
          exclude: [] },
        { test: /dressing|vinaigrette|ranch/i, 
          search: "organic dressing clean", must_contain: ['dressing', 'ranch', 'vinaigrette'],
          exclude: [] },
        { test: /peanut\s*butter|nut\s*butter|almond\s*butter/i, 
          search: "organic peanut butter", must_contain: ['peanut', 'almond', 'butter'],
          exclude: ['cup', 'candy', 'bar'] },
        { test: /ramen|instant\s*noodle/i, 
          search: "organic ramen noodles", must_contain: ['ramen', 'noodle'],
          exclude: [] },
        { test: /soup|broth|stock/i, 
          search: "organic soup low sodium", must_contain: ['soup', 'broth', 'stock'],
          exclude: ['cracker'] },
        { test: /hot\s*dog|frank|wiener/i, 
          search: "uncured hot dogs organic", must_contain: ['hot dog', 'frank', 'wiener', 'uncured'],
          exclude: [] },
        { test: /frozen\s*pizza|pizza/i, 
          search: "organic frozen pizza", must_contain: ['pizza'] },
        { test: /popcorn/i, 
          search: "organic popcorn", must_contain: ['popcorn'] },
        { test: /pretzel/i, 
          search: "organic pretzels", must_contain: ['pretzel'] },
        { test: /oatmeal|oats/i, 
          search: "organic oats oatmeal", must_contain: ['oat'] },
      ];

      let matchedType = null;
      for (const type of productTypeMap) {
        if (type.test.test(fullName)) {
          matchedType = type;
          break;
        }
      }

      if (matchedType) {
        // Try subcategory match first (tightest)
        if (product.subcategory) {
          const subResult = await pool.query(
            `SELECT p.*, c.name as company_name 
             FROM products p 
             LEFT JOIN companies c ON p.company_id = c.id
             WHERE p.subcategory ILIKE $1
             AND p.total_score > $2
             AND p.total_score IS NOT NULL
             AND p.upc != $3
             ORDER BY p.total_score DESC
             LIMIT 10`,
            [`%${product.subcategory}%`, Math.max(product.total_score || 0, 40), upc]
          );
          // Filter to same product type
          swaps = subResult.rows.filter(r => {
            const rName = `${r.name || ''} ${r.subcategory || ''}`;
            return matchesType(rName, matchedType);
          }).slice(0, 5);
        }

        // If subcategory didn't work, try full-text search
        if (swaps.length === 0) {
          try {
            const ftsResult = await pool.query(
              `SELECT p.*, c.name as company_name,
                      ts_rank(to_tsvector('english', p.name || ' ' || COALESCE(p.subcategory, '')), 
                              plainto_tsquery('english', $1)) as rank
               FROM products p 
               LEFT JOIN companies c ON p.company_id = c.id
               WHERE to_tsvector('english', p.name || ' ' || COALESCE(p.subcategory, '')) 
                     @@ plainto_tsquery('english', $1)
               AND p.total_score > $2
               AND p.total_score IS NOT NULL
               AND p.upc != $3
               ORDER BY rank DESC, p.total_score DESC
               LIMIT 15`,
              [matchedType.search, Math.max(product.total_score || 0, 40), upc]
            );
            // Strict filter: must actually be the same type of product
            swaps = ftsResult.rows.filter(r => {
              const rName = `${r.name || ''} ${r.subcategory || ''}`;
              return matchesType(rName, matchedType);
            }).slice(0, 5);
          } catch (e) { /* FTS may fail */ }
        }
      }

      // Last resort: category match with STRICT type filtering
      // Only if we identified a product type but FTS found nothing
      if (swaps.length === 0 && matchedType && product.category) {
        const catResult = await pool.query(
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
           LIMIT 30`,
          [
            product.category, 
            Math.max(product.total_score || 0, 40),
            upc,
            `%${product.category.split(':').pop().replace(/-/g, '%')}%`
          ]
        );
        // STRICT filter — only same type
        swaps = catResult.rows.filter(r => {
          const rName = `${r.name || ''} ${r.subcategory || ''}`;
          return matchesType(rName, matchedType);
        }).slice(0, 5);
      }

      // If STILL nothing and we couldn't even identify the type, 
      // do NOT return random category matches — return empty
      // 0 results > 5 garbage results
    }

    // 3. DYNAMIC DISCOVERY — search OFF in real-time for alternatives
    //    Only fires when curated + local DB matching found nothing
    //    Results get cached in DB so subsequent lookups are instant
    if (swaps.length === 0) {
      try {
        const dynamicResults = await findDynamicSwaps(product, upc, 5);
        if (dynamicResults.length > 0) {
          swaps = dynamicResults;
        }
      } catch (e) {
        console.error('Dynamic swap discovery error:', e.message);
        // Non-fatal — user just gets no swaps
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
      'bar|protein bar|granola bar|nut bar': ['Snack Bars', 'Protein Bars'],
      'chips|crisps|tortilla|puffs|popcorn': ['Chips', 'Microwave Popcorn'],
      'cookie|cookies|biscuit': ['Packaged Cookies'],
      'candy|gummies|gummy|skittles|sour patch': ['Candy'],
      'chocolate(?!.*cookie)': ['Candy', 'Candy Bars'],
      'juice|drink|lemonade|capri sun': ['Juice Drinks'],
      'soda|cola|sprite|fanta|sparkling': ['Soda & Flavored Water'],
      'sport.*drink|electrolyte|gatorade|powerade': ['Sports Drinks'],
      'baby|infant|toddler|puree': ['Baby Snacks'],
      'fruit snack|fruit roll|fruit leather': ['Fruit Snacks'],
      'sauce|marinara|tomato sauce': ['Pasta Sauce'],
      'mac.*cheese|macaroni': ['Mac & Cheese'],
      'dressing|vinaigrette': ['Salad Dressing'],
      'ketchup': ['Ketchup'],
      'mustard|mayo|condiment': ['Condiments', 'Mayonnaise'],
      'bbq.*sauce|barbecue': ['BBQ Sauce'],
      'frozen.*pizza|pizza roll': ['Frozen Pizza', 'Pizza Rolls', 'Frozen Snacks'],
      'nugget|tender|chicken strip': ['Frozen Chicken Tenders'],
      'waffle': ['Frozen Waffles'],
      'ice cream|popsicle|frozen treat|frozen yogurt': ['Frozen Treats', 'Ice Cream'],
      'pancake|waffle mix': ['Pancake Mix'],
      'cheese dip|queso|nacho': ['Cheese Dips'],
      'cracker|goldfish|cheez-it': ['Crackers', 'Goldfish Crackers'],
      'pretzel': ['Pretzels'],
      'ramen|noodle.*instant': ['Instant Ramen'],
      'bread|bun|roll': ['Sliced Bread'],
      'muffin': ['Muffins'],
      'toaster pastry|pop.*tart': ['Toaster Pastries'],
      'yogurt': ['Yogurt', 'Yogurt Tubes'],
      'applesauce|apple sauce': ['Applesauce'],
      'hummus': ['Hummus'],
      'peanut butter|nut butter|almond butter': ['Nut Butter Alternatives'],
      'broth|bouillon|stock': ['Broth & Bouillon'],
      'soup': ['Canned Soup'],
      'creamer|coffee mate': ['Coffee Creamer'],
      'chocolate milk': ['Chocolate Milk'],
      'lunchable': ['Lunchables'],
      'sausage': ['Breakfast Sausage'],
      'trail mix': ['Trail Mix'],
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
        // Try curated clean alternatives first, then any higher-scored product in category
        const categoryResult = await pool.query(
          `SELECT * FROM products 
           WHERE (
             category = $1
             OR category ILIKE $4
           )
           AND total_score > $2
           AND total_score IS NOT NULL
           AND upc != $3
           ORDER BY is_clean_alternative DESC, total_score DESC 
           LIMIT 1`,
          [
            item.category, 
            Math.max(item.total_score || 0, 40),
            item.upc,
            `%${item.category.split(':').pop().replace(/-/g, '%')}%`
          ]
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
