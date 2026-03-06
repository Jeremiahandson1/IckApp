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

    // ── Cache check: return cached result if fresh (<24h) ──
    const CACHE_TTL_HOURS = 24;
    try {
      const cached = await pool.query(
        `SELECT data FROM result_cache
         WHERE upc = $1 AND cache_type = 'swaps'
         AND created_at > NOW() - INTERVAL '${CACHE_TTL_HOURS} hours'`,
        [upc]
      );
      if (cached.rows.length > 0) {
        const { swaps: cachedSwaps, recipes: cachedRecipes } = cached.rows[0].data;

        // Re-enrich recipes with user's pantry (user-specific, can't cache)
        let pantryIngredients = [];
        if (req.user) {
          try {
            const pantryResult = await pool.query(
              `SELECT LOWER(COALESCE(p.name, pi.custom_name, '')) as item_name
               FROM pantry_items pi
               LEFT JOIN products p ON pi.product_id = p.id
               WHERE pi.user_id = $1 AND pi.status = 'active'`,
              [req.user.id]
            );
            pantryIngredients = pantryResult.rows.map(r => r.item_name).filter(Boolean);
          } catch (e) { /* pantry table may not exist */ }
        }

        const enrichedRecipes = (cachedRecipes || []).map(recipe => {
          const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
          let haveCount = 0;
          let needCount = 0;
          const enrichedIngredients = ingredients.map(ing => {
            const itemName = (ing.item || ing.name || '').toLowerCase().trim();
            const inPantry = itemName.length > 2 && pantryIngredients.some(p =>
              p.includes(itemName) || itemName.includes(p) ||
              itemName.split(/\s+/).some(word => word.length > 4 && p.includes(word))
            );
            if (inPantry) haveCount++;
            else needCount++;
            return { ...ing, in_pantry: inPantry };
          });
          return {
            ...recipe,
            ingredients: enrichedIngredients,
            pantry_have_count: haveCount,
            pantry_need_count: needCount,
            pantry_total_count: ingredients.length
          };
        });

        return res.json({
          original: { ...product, ...getScoreRating(product.total_score) },
          swaps: cachedSwaps || [],
          homemade_alternatives: enrichedRecipes,
          cached: true
        });
      }
    } catch (e) { /* cache table may not exist yet — fall through */ }

    let swaps = [];

    // 1. Check for hand-curated direct swaps first
    if (product.swaps_to && product.swaps_to.length > 0) {
      let swapUpcs;
      try { swapUpcs = Array.isArray(product.swaps_to) ? product.swaps_to : JSON.parse(product.swaps_to); } catch { swapUpcs = []; }
      if (!Array.isArray(swapUpcs)) swapUpcs = [];
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
            let swapUpcs;
            try { swapUpcs = Array.isArray(match.swaps_to) ? match.swaps_to : JSON.parse(match.swaps_to); } catch { swapUpcs = []; }
            if (!Array.isArray(swapUpcs)) swapUpcs = [];
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

    // 2. Smart relevance-based matching
    //    Matches product TYPE first (soup → soup, not soup → cracker),
    //    then ranks by RELEVANCE (chicken noodle soup → other chicken noodle soups
    //    before tomato soup). Uses a single combined query for speed.
    const swapScoreFloor = 50;
    if (swaps.length === 0) {
      const fullName = `${product.name || ''} ${product.subcategory || ''} ${product.category || ''}`.toLowerCase();

      // Get the comprehensive product type for cross-type rejection
      const discoveryType = getProductType(product);
      const discoveryTypeId = discoveryType?.id || '_NONE_';

      // Helper: check if a candidate matches the product type.
      // Uses cross-type rejection to prevent unrelated products
      // (e.g., "Chips Ahoy" won't match potato-chips because it's detected as cookies)
      const matchesType = (candidate, type) => {
        const rName = `${candidate.name || ''} ${candidate.subcategory || ''}`.toLowerCase();

        // 1. Exclude check (always applies)
        if ((type.exclude || []).some(kw => rName.includes(kw))) return false;

        // 2. Cross-type rejection: if candidate is detected as a different product family, reject
        if (discoveryType) {
          const candidateType = getProductType({
            name: candidate.name || '',
            subcategory: candidate.subcategory || '',
            category: candidate.category || ''
          });
          if (candidateType && candidateType.id !== discoveryType.id) return false;
        }

        // 3. Must contain at least one required keyword
        return type.must_contain.some(kw => rName.includes(kw));
      };

      // Extract meaningful keywords from product name for relevance scoring.
      // Filters out generic filler words to keep only words that describe
      // what the product actually IS (e.g., "chicken", "noodle", "tomato").
      const genericWords = new Set([
        'original', 'classic', 'regular', 'the', 'and', 'with', 'flavor',
        'flavored', 'style', 'brand', 'new', 'size', 'pack', 'count',
        'organic', 'natural', 'free', 'low', 'reduced', 'lite', 'light',
        'fat', 'sugar', 'sodium', 'calorie', 'zero', 'diet', 'gluten',
        'non', 'gmo', 'vegan', 'whole', 'grain', 'real', 'made',
        // Add each brand word individually so multi-word brands like "Nature Valley" are filtered
        ...(product.brand || '').toLowerCase().split(/\s+/).filter(w => w.length > 0)
      ]);
      const productWords = (product.name || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !genericWords.has(w));

      // Score a candidate's relevance to the original product.
      // Higher = more relevant (same flavor, same subtype, shared keywords).
      const scoreRelevance = (candidate) => {
        let score = 0;
        const cName = (candidate.name || '').toLowerCase();
        const cWords = cName.replace(/[^a-z0-9\s]/g, '').split(/\s+/);

        // Shared keyword bonus: each shared meaningful word = +10
        for (const w of productWords) {
          if (cWords.includes(w)) score += 10;
        }

        // Subcategory match bonus
        if (product.subcategory && candidate.subcategory &&
            candidate.subcategory.toLowerCase() === product.subcategory.toLowerCase()) {
          score += 15;
        }

        // Same brand penalty (user wants to discover NEW brands, not the same one)
        if (product.brand && candidate.brand &&
            candidate.brand.toLowerCase() === product.brand.toLowerCase()) {
          score -= 5;
        }

        return score;
      };

      // Identify what TYPE of product this is and build targeted search
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
        // Soup and broth/stock are SEPARATE types — chicken noodle soup ≠ beef broth
        { test: /soup(?!.*(?:broth|stock|base))/i,
          search: "organic soup low sodium", must_contain: ['soup', 'stew', 'chowder', 'bisque'],
          exclude: ['cracker', 'broth', 'stock', 'base', 'bouillon'] },
        { test: /broth|stock|bouillon|bone\s*broth/i,
          search: "organic broth low sodium", must_contain: ['broth', 'stock', 'bouillon'],
          exclude: ['cracker', 'soup'] },
        { test: /hot\s*dog|frank|wiener/i,
          search: "uncured hot dogs organic", must_contain: ['hot dog', 'frank', 'wiener', 'uncured'],
          exclude: [] },
        { test: /frozen\s*pizza|pizza/i,
          search: "organic frozen pizza", must_contain: ['pizza'],
          exclude: ['roll', 'bite', 'sauce', 'cutter'] },
        { test: /popcorn/i,
          search: "organic popcorn", must_contain: ['popcorn'],
          exclude: ['seasoning', 'topping', 'oil'] },
        { test: /pretzel/i,
          search: "organic pretzels", must_contain: ['pretzel'],
          exclude: ['dip', 'mustard', 'cheese'] },
        { test: /oatmeal|oats/i,
          search: "organic oats oatmeal", must_contain: ['oat'],
          exclude: ['bar', 'cookie', 'milk'] },
      ];

      let matchedType = null;
      for (const type of productTypeMap) {
        if (type.test.test(fullName)) {
          matchedType = type;
          break;
        }
      }

      if (matchedType) {
        // Single combined query: subcategory + category + FTS + cached discoveries in one pass
        // Fetches a broad pool, then filters by type and ranks by relevance
        const searchKeywords = productWords.slice(0, 3).join(' ');
        try {
          const combinedResult = await pool.query(
            `SELECT DISTINCT ON (p.upc) p.*, c.name as company_name
             FROM products p
             LEFT JOIN companies c ON p.company_id = c.id
             WHERE p.total_score > $1
             AND p.total_score IS NOT NULL
             AND p.upc != $2
             AND (
               p.subcategory ILIKE $3
               OR p.category = $4
               OR p.category ILIKE $5
               OR p.swap_discovery_type = $6
               ${searchKeywords ? `OR to_tsvector('english', p.name || ' ' || COALESCE(p.subcategory, ''))
                     @@ plainto_tsquery('english', $7)` : ''}
             )
             ORDER BY p.upc, p.total_score DESC
             LIMIT 40`,
            [
              swapScoreFloor,
              upc,
              `%${product.subcategory || '_NONE_'}%`,
              product.category || '_NONE_',
              `%${(product.category || '_NONE_').split(':').pop().replace(/-/g, '%')}%`,
              discoveryTypeId,
              ...(searchKeywords ? [matchedType.search] : [])
            ]
          );

          // Filter to same product type, then rank by relevance + score
          swaps = combinedResult.rows
            .filter(r => matchesType(r, matchedType))
            .map(r => ({ ...r, _relevance: scoreRelevance(r) }))
            .sort((a, b) => {
              // Primary: relevance (same subtype/flavor first)
              // Secondary: health score (better products first)
              const relDiff = b._relevance - a._relevance;
              if (relDiff !== 0) return relDiff;
              return (b.total_score || 0) - (a.total_score || 0);
            })
            .slice(0, 5);

          // Clean up internal field
          swaps.forEach(s => delete s._relevance);
        } catch (e) {
          // Fallback: simple category query if combined query fails
          if (product.category) {
            const catResult = await pool.query(
              `SELECT p.*, c.name as company_name
               FROM products p
               LEFT JOIN companies c ON p.company_id = c.id
               WHERE p.category = $1
               AND p.total_score > $2
               AND p.total_score IS NOT NULL
               AND p.upc != $3
               ORDER BY p.total_score DESC
               LIMIT 20`,
              [product.category, swapScoreFloor, upc]
            );
            swaps = catResult.rows
              .filter(r => matchesType(r, matchedType))
              .map(r => ({ ...r, _relevance: scoreRelevance(r) }))
              .sort((a, b) => b._relevance - a._relevance || (b.total_score || 0) - (a.total_score || 0))
              .slice(0, 5);
            swaps.forEach(s => delete s._relevance);
          }
        }
      }

      // If we couldn't identify the type, return empty — 0 results > 5 garbage results
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
    // Batch all store/link queries by collecting UPCs first (avoids N+1)
    const swapUpcList = swaps.map(s => s.upc).filter(Boolean);

    // Batch Layer 1: Community sightings
    let allSightings = {};
    if (swapUpcList.length > 0) {
      try {
        const sightingResult = await pool.query(
          `SELECT upc, store_name, store_address, store_zip, price, aisle,
                  verified_count, 'community' as source
           FROM local_sightings
           WHERE upc = ANY($1::text[]) AND in_stock = true
           AND last_verified_at > NOW() - INTERVAL '90 days'
           ORDER BY verified_count DESC`,
          [swapUpcList]
        );
        for (const row of sightingResult.rows) {
          (allSightings[row.upc] ??= []).push(row);
        }
      } catch (e) { /* table may not exist yet */ }
    }

    // Batch Layer 2: Flyer availability
    let allFlyers = {};
    if (swapUpcList.length > 0) {
      try {
        const flyerResult = await pool.query(
          `SELECT DISTINCT ON (upc, merchant)
             upc, merchant as store_name, price, price_text, crawled_at, 'flyer' as source
           FROM flyer_availability
           WHERE upc = ANY($1::text[]) AND expires_at > NOW()
           ORDER BY upc, merchant, crawled_at DESC`,
          [swapUpcList]
        );
        for (const row of flyerResult.rows) {
          (allFlyers[row.upc] ??= []).push({
            store_name: row.store_name, price: row.price, price_text: row.price_text,
            source: 'flyer',
            disclaimer: `Price as of ${new Date(row.crawled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
          });
        }
      } catch (e) { /* flyer table may not exist yet */ }
    }

    // Batch Layer 3: Curated availability
    let allCurated = {};
    if (swapUpcList.length > 0) {
      try {
        const curatedResult = await pool.query(
          `SELECT upc, store_name, 'curated' as source FROM curated_availability
           WHERE upc = ANY($1::text[]) ORDER BY store_name`,
          [swapUpcList]
        );
        for (const row of curatedResult.rows) {
          (allCurated[row.upc] ??= []).push(row);
        }
      } catch (e) { /* curated table may not exist yet */ }
    }

    // Batch Layer 4: Online links
    let allLinks = {};
    if (swapUpcList.length > 0) {
      try {
        const linksResult = await pool.query(
          `SELECT upc, name, url, link_type FROM online_links
           WHERE upc = ANY($1::text[]) AND active = true ORDER BY link_type`,
          [swapUpcList]
        );
        for (const row of linksResult.rows) {
          (allLinks[row.upc] ??= []).push(row);
        }
      } catch (e) { /* online_links table may not exist yet */ }
    }

    // Assemble per-swap results from batched data
    const formattedSwaps = [];
    for (const swap of swaps) {
      // Merge store layers with dedup
      let nearbyStores = (allSightings[swap.upc] || []).slice(0, 3);

      if (nearbyStores.length < 3) {
        const seen = new Set(nearbyStores.map(s => s.store_name?.toLowerCase()?.replace(/[^a-z]/g, '')));
        const flyerUnique = (allFlyers[swap.upc] || []).filter(s => !seen.has(s.store_name?.toLowerCase()?.replace(/[^a-z]/g, '')));
        nearbyStores = [...nearbyStores, ...flyerUnique].slice(0, 5);
      }

      if (nearbyStores.length < 3) {
        const seen = new Set(nearbyStores.map(s => s.store_name?.toLowerCase()?.replace(/[^a-z]/g, '')));
        const curatedUnique = (allCurated[swap.upc] || []).filter(s => !seen.has(s.store_name?.toLowerCase()?.replace(/[^a-z]/g, '')));
        nearbyStores = [...nearbyStores, ...curatedUnique].slice(0, 5);
      }

      let onlineLinks = (allLinks[swap.upc] || []).slice(0, 5);
      if (onlineLinks.length === 0 && swap.name) {
        const q = encodeURIComponent(`${swap.brand || ''} ${swap.name}`.trim());
        onlineLinks = [
          { name: 'Amazon', url: `https://www.amazon.com/s?k=${q}`, link_type: 'search' },
          { name: 'Walmart', url: `https://www.walmart.com/search?q=${q}`, link_type: 'search' },
          { name: 'Target', url: `https://www.target.com/s?searchTerm=${q}`, link_type: 'search' },
        ];
      }

      formattedSwaps.push({
        ...swap,
        ...getScoreRating(swap.total_score),
        score_improvement: (swap.total_score || 0) - (product.total_score || 0),
        savings_potential: product.typical_price && swap.typical_price
          ? (product.typical_price - swap.typical_price).toFixed(2)
          : null,
        nearby_stores: nearbyStores,
        online_links: onlineLinks
      });
    }

    // Get homemade alternatives (recipes)
    // Build recipe category candidates from product data + name keywords
    const recipeCategories = [product.category, product.subcategory].filter(Boolean);

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
      'soup(?!.*(?:broth|stock))': ['Canned Soup'],
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

    // Also match by product name keywords for broader recipe discovery
    const productNameWords = (product.name || '').toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 3);

    const recipeResult = await pool.query(
      `SELECT * FROM recipes
       WHERE replaces_category = ANY($1::text[])
       OR replaces_products @> $2::jsonb
       ORDER BY total_time_minutes ASC`,
      [[...new Set(recipeCategories)], JSON.stringify([upc])]
    );

    // Enrich recipes with pantry cross-reference if user is logged in
    let pantryIngredients = [];
    if (req.user) {
      try {
        const pantryResult = await pool.query(
          `SELECT LOWER(COALESCE(p.name, pi.custom_name, '')) as item_name
           FROM pantry_items pi
           LEFT JOIN products p ON pi.product_id = p.id
           WHERE pi.user_id = $1 AND pi.status = 'active'`,
          [req.user.id]
        );
        pantryIngredients = pantryResult.rows.map(r => r.item_name).filter(Boolean);
      } catch (e) { /* pantry table may not exist */ }
    }

    const enrichedRecipes = recipeResult.rows.map(recipe => {
      const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
      let haveCount = 0;
      let needCount = 0;

      const enrichedIngredients = ingredients.map(ing => {
        const itemName = (ing.item || ing.name || '').toLowerCase().trim();
        // Check if user has this ingredient in their pantry
        const inPantry = itemName.length > 2 && pantryIngredients.some(p =>
          p.includes(itemName) || itemName.includes(p) ||
          itemName.split(/\s+/).some(word => word.length > 4 && p.includes(word))
        );
        if (inPantry) haveCount++;
        else needCount++;
        return { ...ing, in_pantry: inPantry };
      });

      return {
        ...recipe,
        ingredients: enrichedIngredients,
        pantry_have_count: haveCount,
        pantry_need_count: needCount,
        pantry_total_count: ingredients.length
      };
    });

    // ── Cache store: save swaps + raw recipes for future hits ──
    try {
      await pool.query(
        `INSERT INTO result_cache (upc, cache_type, data, created_at)
         VALUES ($1, 'swaps', $2, NOW())
         ON CONFLICT (upc, cache_type) DO UPDATE SET
           data = EXCLUDED.data, created_at = NOW()`,
        [upc, JSON.stringify({ swaps: formattedSwaps, recipes: recipeResult.rows })]
      );
    } catch (e) { /* cache write failure is non-fatal */ }

    res.json({
      original: {
        ...product,
        ...getScoreRating(product.total_score)
      },
      swaps: formattedSwaps,
      homemade_alternatives: enrichedRecipes
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

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO swap_clicks (user_id, from_product_id, to_product_id, from_upc, to_upc)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, fromId, toId, fromUpc, toUpc]
      );
      await client.query(
        `UPDATE user_engagement
         SET total_swaps_clicked = total_swaps_clicked + 1, updated_at = NOW()
         WHERE user_id = $1`,
        [req.user.id]
      );
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

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

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
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
      await client.query(
        `UPDATE user_engagement
         SET total_swaps_purchased = total_swaps_purchased + 1, updated_at = NOW()
         WHERE user_id = $1`,
        [req.user.id]
      );
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

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

    // Batch-fetch all curated swap targets in one query (avoids N+1)
    const allSwapUpcs = [];
    for (const item of sourceItems) {
      if (item.swaps_to && item.swaps_to.length > 0) {
        let parsed;
        try { parsed = Array.isArray(item.swaps_to) ? item.swaps_to : JSON.parse(item.swaps_to); } catch { parsed = []; }
        if (Array.isArray(parsed)) allSwapUpcs.push(...parsed.filter(Boolean));
      }
    }
    let swapProductsMap = {};
    if (allSwapUpcs.length > 0) {
      const uniqueUpcs = [...new Set(allSwapUpcs)];
      const swapResult = await pool.query(
        `SELECT * FROM products WHERE upc = ANY($1::text[]) AND total_score IS NOT NULL`,
        [uniqueUpcs]
      );
      for (const row of swapResult.rows) {
        swapProductsMap[row.upc] = row;
      }
    }

    // Batch-fetch category alternatives for items without curated swaps
    // Group by category to avoid duplicate queries
    const categoryGroups = {};
    for (const item of sourceItems) {
      if (!item.category) continue;
      let hasSwap = false;
      if (item.swaps_to && item.swaps_to.length > 0) {
        let parsed;
        try { parsed = Array.isArray(item.swaps_to) ? item.swaps_to : JSON.parse(item.swaps_to); } catch { parsed = []; }
        if (Array.isArray(parsed) && parsed.some(u => swapProductsMap[u])) hasSwap = true;
      }
      if (!hasSwap) {
        const catKey = item.category;
        if (!categoryGroups[catKey]) categoryGroups[catKey] = [];
        categoryGroups[catKey].push(item);
      }
    }
    let categoryResultsMap = {};
    for (const [cat, items] of Object.entries(categoryGroups)) {
      const excludeUpcs = items.map(i => i.upc);
      const categoryResult = await pool.query(
        `SELECT * FROM products
         WHERE (category = $1 OR category ILIKE $3)
         AND total_score > 50
         AND total_score IS NOT NULL
         AND upc != ALL($2::text[])
         ORDER BY is_clean_alternative DESC, total_score DESC
         LIMIT 20`,
        [cat, excludeUpcs, `%${cat.split(':').pop().replace(/-/g, '%')}%`]
      );
      categoryResultsMap[cat] = categoryResult.rows;
    }

    // Assemble recommendations from batched data
    for (const item of sourceItems) {
      let bestSwap = null;

      // Check curated swaps first
      if (item.swaps_to && item.swaps_to.length > 0) {
        let parsed;
        try { parsed = Array.isArray(item.swaps_to) ? item.swaps_to : JSON.parse(item.swaps_to); } catch { parsed = []; }
        if (Array.isArray(parsed)) {
          // Pick best-scored curated swap
          let best = null;
          for (const u of parsed) {
            const p = swapProductsMap[u];
            if (p && (!best || (p.total_score || 0) > (best.total_score || 0))) best = p;
          }
          if (best) bestSwap = best;
        }
      }

      // Fall back to category match with type-aware filtering
      if (!bestSwap && item.category && categoryResultsMap[item.category]) {
        const itemType = getProductType(item);
        let candidates = categoryResultsMap[item.category];
        if (itemType) {
          // Always filter by type — never fall back to untyped candidates
          // (0 results is better than recommending cookies for a chips scan)
          candidates = candidates.filter(r => {
            const rName = `${r.name || ''} ${r.subcategory || ''}`.toLowerCase();
            // Cross-type rejection
            const candidateType = getProductType({
              name: r.name || '', subcategory: r.subcategory || '', category: r.category || ''
            });
            if (candidateType && candidateType.id !== itemType.id) return false;
            if ((itemType.exclude || []).some(kw => rName.includes(kw))) return false;
            return itemType.must_contain.some(kw => rName.includes(kw));
          });
        }
        // Exclude this item's own UPC
        const match = candidates.find(c => c.upc !== item.upc);
        if (match) bestSwap = match;
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
