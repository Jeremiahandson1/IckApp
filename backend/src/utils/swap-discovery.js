// ============================================================
// DYNAMIC SWAP DISCOVERY ENGINE
// When no curated swap exists, searches Open Food Facts for
// better-scored products in the same category. Results get
// cached in our DB so subsequent lookups are instant.
// ============================================================

import pool from '../db/init.js';

const OFF_BASE = 'https://world.openfoodfacts.org';
const USER_AGENT = 'Ick/2.0 (swap-discovery)';
const CACHE_HOURS = 72; // re-search after 3 days

// ============================================================
// PRODUCT TYPE DEFINITIONS
// Each type has: test pattern, OFF category tags to search,
// must_contain keywords for filtering, and a display label
// ============================================================
const PRODUCT_TYPES = [
  { id: 'fruit-snacks',
    test: /fruit\s*snack|fruit\s*roll|fruit\s*leather|fruit\s*gumm/i,
    off_categories: ['en:fruit-snacks', 'en:fruit-based-snacks'],
    search_terms: 'fruit snacks organic',
    must_contain: ['fruit'],
    exclude: ['nut', 'seed', 'chip', 'water', 'chestnut'],
    label: 'Fruit Snacks' },
  
  { id: 'candy-fruity',
    test: /skittle|sour.*candy|fruity.*candy|jelly.*bean|gumm(?!y\s*bear)|chewy.*candy|starburst/i,
    off_categories: ['en:candies', 'en:confectioneries', 'en:gummy-candies'],
    search_terms: 'organic gummy candy fruit',
    must_contain: ['candy', 'gumm', 'sweet', 'fruit', 'sour', 'chew'],
    exclude: ['chocolate', 'cocoa', 'bar'],
    label: 'Fruity Candy' },
  
  { id: 'candy-chocolate',
    test: /chocolate\s*(bar|candy|piece)|m&m|cocoa.*candy|truffle/i,
    off_categories: ['en:chocolates', 'en:dark-chocolates', 'en:chocolate-bars'],
    search_terms: 'organic dark chocolate bar',
    must_contain: ['chocolate', 'cocoa', 'cacao'],
    exclude: ['milk', 'syrup', 'powder', 'cookie'],
    label: 'Chocolate' },
  
  { id: 'candy-licorice',
    test: /licorice|twizzler/i,
    off_categories: ['en:liquorice', 'en:candies'],
    search_terms: 'organic licorice',
    must_contain: ['licorice', 'liquorice'],
    exclude: [],
    label: 'Licorice' },
  
  { id: 'cereal-fruity',
    test: /froot|fruity.*cereal|fruit.*loop|toucan|berry.*cereal/i,
    off_categories: ['en:breakfast-cereals'],
    search_terms: 'organic fruity cereal kids',
    must_contain: ['cereal', 'flake', 'loop', 'puff', 'crunch', "o's"],
    exclude: ['bar', 'milk', 'yogurt'],
    label: 'Fruity Cereal' },
  
  { id: 'cereal-chocolate',
    test: /cocoa.*puff|chocolate.*cereal|cocoa.*crispies|count.*chocula/i,
    off_categories: ['en:breakfast-cereals', 'en:chocolate-cereals'],
    search_terms: 'organic chocolate cereal',
    must_contain: ['cereal', 'chocolate', 'cocoa', 'puff', 'crunch'],
    exclude: ['bar', 'milk', 'cookie'],
    label: 'Chocolate Cereal' },
  
  { id: 'cereal-cinnamon',
    test: /cinnamon.*crunch|cinnamon.*toast|cinnamon.*cereal/i,
    off_categories: ['en:breakfast-cereals'],
    search_terms: 'organic cinnamon cereal',
    must_contain: ['cereal', 'cinnamon', 'crunch', 'flake'],
    exclude: ['bar', 'oatmeal'],
    label: 'Cinnamon Cereal' },
  
  { id: 'cereal-general',
    test: /cereal|loops|flakes|puffs|crunch|charms|cheerio/i,
    off_categories: ['en:breakfast-cereals'],
    search_terms: 'organic cereal whole grain',
    must_contain: ['cereal', 'flake', 'puff', 'crunch', "o's", 'grain'],
    exclude: ['bar', 'milk'],
    label: 'Cereal' },
  
  { id: 'granola-bar',
    test: /granola\s*bar|chewy\s*bar|oat\s*bar|nature.*valley/i,
    off_categories: ['en:cereal-bars', 'en:granola-bars'],
    search_terms: 'organic granola bar',
    must_contain: ['bar', 'granola'],
    exclude: ['cereal', 'protein'],
    label: 'Granola Bar' },
  
  { id: 'protein-bar',
    test: /protein\s*bar|energy\s*bar|rxbar|clif/i,
    off_categories: ['en:energy-bars', 'en:protein-bars'],
    search_terms: 'organic protein bar clean',
    must_contain: ['bar', 'protein', 'energy'],
    exclude: ['cereal', 'granola'],
    label: 'Protein Bar' },
  
  { id: 'chips',
    test: /chip|crisp|tortilla\s*chip|dorito|cheeto|lay's|pringles|frito/i,
    off_categories: ['en:chips-and-fries', 'en:tortilla-chips', 'en:potato-chips'],
    search_terms: 'organic chips',
    must_contain: ['chip', 'crisp', 'tortilla'],
    exclude: ['dip', 'salsa', 'chocolate'],
    label: 'Chips' },
  
  { id: 'crackers',
    test: /cracker|goldfish|cheez-?it|ritz/i,
    off_categories: ['en:crackers'],
    search_terms: 'organic crackers whole grain',
    must_contain: ['cracker'],
    exclude: ['soup', 'dip'],
    label: 'Crackers' },
  
  { id: 'cookies',
    test: /cookie|biscuit|chips\s*ahoy|oreo|nutter/i,
    off_categories: ['en:biscuits-and-cakes', 'en:cookies'],
    search_terms: 'organic cookies',
    must_contain: ['cookie', 'biscuit'],
    exclude: ['cream', 'ice', 'dough'],
    label: 'Cookies' },
  
  { id: 'soda',
    test: /soda|cola|sprite|fanta|mountain\s*dew|dr\s*pepper|pepsi|coke/i,
    off_categories: ['en:sodas', 'en:carbonated-drinks'],
    search_terms: 'prebiotic soda sparkling',
    must_contain: ['soda', 'sparkling', 'cola', 'carbonated', 'prebiotic', 'fizz'],
    exclude: ['candy', 'gummy'],
    label: 'Soda' },
  
  { id: 'juice',
    test: /juice|lemonade|fruit\s*drink|capri\s*sun|kool/i,
    off_categories: ['en:fruit-juices', 'en:juices-and-nectars'],
    search_terms: 'organic 100 fruit juice',
    must_contain: ['juice', 'lemonade', 'nectar'],
    exclude: ['gummy', 'snack', 'bar'],
    label: 'Juice' },
  
  { id: 'sports-drink',
    test: /sport.*drink|electrolyte|gatorade|powerade/i,
    off_categories: ['en:sports-drinks'],
    search_terms: 'natural electrolyte drink',
    must_contain: ['electrolyte', 'sport', 'hydrat'],
    exclude: ['protein', 'bar'],
    label: 'Sports Drink' },
  
  { id: 'energy-drink',
    test: /energy\s*drink|monster|red\s*bull|celsius|bang/i,
    off_categories: ['en:energy-drinks'],
    search_terms: 'clean energy drink natural',
    must_contain: ['energy', 'sparkling'],
    exclude: ['bar', 'candy'],
    label: 'Energy Drink' },
  
  { id: 'mac-cheese',
    test: /mac.*cheese|macaroni|velveeta/i,
    off_categories: ['en:macaroni-and-cheese', 'en:pasta-dishes'],
    search_terms: 'organic mac cheese',
    must_contain: ['mac', 'cheese', 'macaroni'],
    exclude: ['pizza', 'sauce'],
    label: 'Mac & Cheese' },
  
  { id: 'yogurt',
    test: /yogurt|yoghurt|yoplait|dannon|activia|chobani/i,
    off_categories: ['en:yogurts'],
    search_terms: 'organic whole milk yogurt',
    must_contain: ['yogurt', 'yoghurt'],
    exclude: ['bar', 'drink', 'tube'],
    label: 'Yogurt' },
  
  { id: 'ice-cream',
    test: /ice\s*cream|gelato|frozen\s*dessert|haagen|ben.*jerry/i,
    off_categories: ['en:ice-creams'],
    search_terms: 'organic ice cream',
    must_contain: ['ice cream', 'gelato', 'frozen'],
    exclude: ['sandwich', 'bar', 'cone'],
    label: 'Ice Cream' },
  
  { id: 'bread',
    test: /bread|wonder\s*bread|sara\s*lee|bun|loaf/i,
    off_categories: ['en:breads'],
    search_terms: 'organic whole grain bread sprouted',
    must_contain: ['bread', 'loaf', 'grain', 'wheat', 'sprouted'],
    exclude: ['crumb', 'stick'],
    label: 'Bread' },
  
  { id: 'pasta-sauce',
    test: /pasta\s*sauce|marinara|tomato\s*sauce|prego|ragu|bertolli/i,
    off_categories: ['en:pasta-sauces', 'en:tomato-sauces'],
    search_terms: 'organic marinara sauce',
    must_contain: ['sauce', 'marinara', 'tomato'],
    exclude: ['pizza', 'salsa'],
    label: 'Pasta Sauce' },
  
  { id: 'ketchup',
    test: /ketchup|catsup/i,
    off_categories: ['en:ketchup'],
    search_terms: 'organic ketchup unsweetened',
    must_contain: ['ketchup'],
    exclude: [],
    label: 'Ketchup' },
  
  { id: 'dressing',
    test: /dressing|vinaigrette|ranch|caesar|italian\s*dressing/i,
    off_categories: ['en:salad-dressings'],
    search_terms: 'organic salad dressing',
    must_contain: ['dressing', 'ranch', 'vinaigrette'],
    exclude: [],
    label: 'Salad Dressing' },
  
  { id: 'mayo',
    test: /mayo|miracle\s*whip/i,
    off_categories: ['en:mayonnaises'],
    search_terms: 'avocado oil mayo organic',
    must_contain: ['mayo', 'aioli'],
    exclude: [],
    label: 'Mayo' },
  
  { id: 'peanut-butter',
    test: /peanut\s*butter|nut\s*butter|almond\s*butter|jif|skippy/i,
    off_categories: ['en:peanut-butters', 'en:nut-butters'],
    search_terms: 'organic peanut butter',
    must_contain: ['peanut', 'almond', 'butter', 'nut'],
    exclude: ['cup', 'candy', 'bar'],
    label: 'Peanut Butter' },
  
  { id: 'ramen',
    test: /ramen|instant\s*noodle|maruchan|top\s*ramen/i,
    off_categories: ['en:instant-noodles'],
    search_terms: 'organic ramen noodles',
    must_contain: ['ramen', 'noodle'],
    exclude: [],
    label: 'Ramen' },
  
  { id: 'soup',
    test: /soup|broth|stock|campbell|progresso/i,
    off_categories: ['en:soups'],
    search_terms: 'organic soup low sodium',
    must_contain: ['soup', 'broth', 'stock', 'stew', 'chowder'],
    exclude: ['cracker', 'noodle'],
    label: 'Soup' },
  
  { id: 'hot-dog',
    test: /hot\s*dog|frank|wiener|oscar\s*mayer/i,
    off_categories: ['en:sausages', 'en:hot-dogs'],
    search_terms: 'uncured organic hot dogs',
    must_contain: ['hot dog', 'frank', 'wiener', 'sausage', 'uncured'],
    exclude: [],
    label: 'Hot Dogs' },
  
  { id: 'frozen-pizza',
    test: /frozen.*pizza|pizza.*frozen|digiorno|red\s*baron|totino/i,
    off_categories: ['en:frozen-pizzas'],
    search_terms: 'organic frozen pizza',
    must_contain: ['pizza'],
    exclude: ['roll', 'bite', 'sauce'],
    label: 'Frozen Pizza' },
  
  { id: 'frozen-meal',
    test: /frozen\s*meal|frozen\s*dinner|tv\s*dinner|stouffer|banquet|hot\s*pocket/i,
    off_categories: ['en:frozen-meals'],
    search_terms: 'organic frozen meal',
    must_contain: ['frozen', 'meal', 'dinner', 'entree'],
    exclude: ['pizza', 'ice'],
    label: 'Frozen Meals' },
  
  { id: 'popcorn',
    test: /popcorn|pop\s*corn/i,
    off_categories: ['en:popcorn'],
    search_terms: 'organic popcorn',
    must_contain: ['popcorn'],
    exclude: [],
    label: 'Popcorn' },
  
  { id: 'pretzel',
    test: /pretzel/i,
    off_categories: ['en:pretzels'],
    search_terms: 'organic pretzels',
    must_contain: ['pretzel'],
    exclude: [],
    label: 'Pretzels' },
  
  { id: 'oatmeal',
    test: /oatmeal|instant\s*oats|quaker/i,
    off_categories: ['en:oatmeals'],
    search_terms: 'organic oatmeal rolled oats',
    must_contain: ['oat', 'oatmeal', 'porridge'],
    exclude: ['bar', 'cookie'],
    label: 'Oatmeal' },
  
  { id: 'toaster-pastry',
    test: /toaster.*pastry|pop.*tart/i,
    off_categories: ['en:pastries'],
    search_terms: 'organic toaster pastry',
    must_contain: ['pastry', 'toaster', 'tart'],
    exclude: [],
    label: 'Toaster Pastries' },
  
  { id: 'lunch-meat',
    test: /lunch\s*meat|deli\s*meat|bologna|turkey\s*breast|ham\s*slice/i,
    off_categories: ['en:cold-cuts'],
    search_terms: 'organic uncured deli meat',
    must_contain: ['turkey', 'ham', 'deli', 'meat', 'roast', 'uncured', 'slice'],
    exclude: ['sandwich', 'wrap'],
    label: 'Lunch Meat' },
  
  { id: 'syrup',
    test: /syrup|aunt\s*jemima|mrs\s*butterworth/i,
    off_categories: ['en:syrups', 'en:maple-syrups'],
    search_terms: 'organic maple syrup pure',
    must_contain: ['syrup', 'maple'],
    exclude: ['cough', 'medicine'],
    label: 'Syrup' },
  
  { id: 'coffee-creamer',
    test: /creamer|coffee.*mate/i,
    off_categories: ['en:coffee-creamers'],
    search_terms: 'organic oat milk creamer',
    must_contain: ['creamer', 'milk', 'oat'],
    exclude: [],
    label: 'Coffee Creamer' },
  
  { id: 'chocolate-milk',
    test: /chocolate\s*milk|nesquik/i,
    off_categories: ['en:chocolate-milks'],
    search_terms: 'organic chocolate milk',
    must_contain: ['chocolate', 'milk'],
    exclude: ['candy', 'bar', 'cookie'],
    label: 'Chocolate Milk' },
];

// Nutriscore ranking for sorting
const NUTRISCORE_RANK = { a: 5, b: 4, c: 3, d: 2, e: 1 };

// ============================================================
// MAIN: Find dynamic swaps for a product
// ============================================================
export async function findDynamicSwaps(product, upc, limit = 5) {
  const fullName = `${product.name || ''} ${product.subcategory || ''} ${product.category || ''}`.toLowerCase();

  // 1. Identify product type
  let matchedType = null;
  for (const type of PRODUCT_TYPES) {
    if (type.test.test(fullName)) {
      matchedType = type;
      break;
    }
  }

  if (!matchedType) {
    // Can't identify product type — try to match from OFF category tags
    matchedType = inferTypeFromCategory(product.category);
    if (!matchedType) return []; // truly unknown — return empty rather than garbage
  }

  // 2. Check cache — have we searched this type recently?
  try {
    const cached = await pool.query(
      `SELECT p.*, c.name as company_name
       FROM products p
       LEFT JOIN companies c ON p.company_id = c.id
       WHERE p.swap_discovery_type = $1
       AND p.total_score > $2
       AND p.total_score IS NOT NULL
       AND p.upc != $3
       AND p.swap_discovered_at > NOW() - INTERVAL '${CACHE_HOURS} hours'
       ORDER BY p.total_score DESC
       LIMIT $4`,
      [matchedType.id, Math.max(product.total_score || 0, 30), upc, limit * 2]
    );

    if (cached.rows.length >= limit) {
      // Apply type filter and return
      const filtered = applyTypeFilter(cached.rows, matchedType);
      if (filtered.length > 0) return filtered.slice(0, limit);
    }
  } catch (e) {
    // swap_discovery_type column may not exist yet — that's OK, we'll search
  }

  // 3. Search OFF for alternatives
  const candidates = await searchOFF(matchedType, product, upc);
  
  if (candidates.length === 0) return [];

  // 4. Save discoveries to DB and return
  const saved = await saveDiscoveries(candidates, matchedType);
  return saved.slice(0, limit);
}

// ============================================================
// Search Open Food Facts for better products
// ============================================================
async function searchOFF(type, product, excludeUpc) {
  const allCandidates = [];

  // Strategy 1: Category-based search (most targeted)
  for (const category of type.off_categories.slice(0, 2)) {
    try {
      const url = `${OFF_BASE}/cgi/search.pl?` + new URLSearchParams({
        action: 'process',
        json: 'true',
        page_size: '30',
        tagtype_0: 'categories',
        tag_contains_0: 'contains',
        tag_0: category,
        tagtype_1: 'countries',
        tag_contains_1: 'contains',
        tag_1: 'united-states',
        sort_by: 'nutriscore_score',
        fields: 'code,product_name,brands,image_url,nutriscore_grade,nova_group,categories_tags,ingredients_text,allergens_tags,labels_tags,nutriments'
      });

      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(5000)
      });

      if (res.ok) {
        const data = await res.json();
        const products = data.products || [];
        for (const p of products) {
          if (!p.code || p.code === excludeUpc) continue;
          if (!p.product_name) continue;
          allCandidates.push(p);
        }
      }
    } catch (e) { /* timeout or error — continue */ }
  }

  // Strategy 2: Keyword search (broader net)
  if (allCandidates.length < 10) {
    try {
      const url = `${OFF_BASE}/cgi/search.pl?` + new URLSearchParams({
        search_terms: type.search_terms,
        search_simple: '1',
        action: 'process',
        json: 'true',
        page_size: '20',
        tagtype_0: 'countries',
        tag_contains_0: 'contains',
        tag_0: 'united-states',
        sort_by: 'nutriscore_score',
        fields: 'code,product_name,brands,image_url,nutriscore_grade,nova_group,categories_tags,ingredients_text,allergens_tags,labels_tags,nutriments'
      });

      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(5000)
      });

      if (res.ok) {
        const data = await res.json();
        for (const p of (data.products || [])) {
          if (!p.code || p.code === excludeUpc || !p.product_name) continue;
          // Dedup by code
          if (!allCandidates.some(c => c.code === p.code)) {
            allCandidates.push(p);
          }
        }
      }
    } catch (e) { /* continue */ }
  }

  // 5. Filter + rank candidates
  const scoredCandidates = allCandidates
    .filter(p => {
      const name = (p.product_name || '').toLowerCase();
      // Must match product type
      if (!type.must_contain.some(kw => name.includes(kw))) {
        // Also check categories
        const cats = (p.categories_tags || []).join(' ').toLowerCase();
        if (!type.must_contain.some(kw => cats.includes(kw))) return false;
      }
      // Must not match exclude keywords
      if (type.exclude.some(kw => name.includes(kw))) return false;
      // Must have a nutriscore (quality signal)
      if (!p.nutriscore_grade) return false;
      return true;
    })
    .map(p => ({
      ...p,
      nutri_rank: NUTRISCORE_RANK[p.nutriscore_grade?.toLowerCase()] || 0,
      nova_rank: p.nova_group ? (5 - p.nova_group) : 0, // lower NOVA = better
      has_organic: (p.labels_tags || []).some(l => l.includes('organic')),
    }))
    .sort((a, b) => {
      // Sort by: nutriscore desc, then organic, then NOVA asc
      if (b.nutri_rank !== a.nutri_rank) return b.nutri_rank - a.nutri_rank;
      if (a.has_organic !== b.has_organic) return a.has_organic ? -1 : 1;
      return b.nova_rank - a.nova_rank;
    });

  // Deduplicate by brand+name (OFF has many duplicates)
  const seen = new Set();
  const deduped = [];
  for (const p of scoredCandidates) {
    const key = `${(p.brands || '').toLowerCase()}_${(p.product_name || '').toLowerCase()}`.replace(/\s+/g, '');
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(p);
  }

  return deduped.slice(0, 15); // top 15 for saving
}

// ============================================================
// Save discovered products to our DB
// ============================================================
async function saveDiscoveries(candidates, type) {
  const saved = [];

  for (const p of candidates) {
    try {
      const upc = p.code.padStart(13, '0'); // normalize UPC
      const ingredients = p.ingredients_text || '';
      const brand = p.brands || 'Unknown';
      const name = p.product_name || 'Unknown';
      const imageUrl = p.image_url || null;
      const category = p.categories_tags?.[0]?.replace('en:', '') || type.label;
      const nutriscoreGrade = p.nutriscore_grade || null;
      const novaGroup = p.nova_group || null;
      const isOrganic = (p.labels_tags || []).some(l => l.includes('organic'));
      const allergensTags = p.allergens_tags || [];

      // Build basic nutrition facts from OFF nutriments
      const nm = p.nutriments || {};
      const nutritionFacts = {
        energy_kcal_100g: nm['energy-kcal_100g'] || null,
        fat_100g: nm.fat_100g || null,
        saturated_fat_100g: nm['saturated-fat_100g'] || null,
        carbohydrates_100g: nm.carbohydrates_100g || null,
        sugars_100g: nm.sugars_100g || null,
        fiber_100g: nm.fiber_100g || null,
        proteins_100g: nm.proteins_100g || null,
        sodium_100g: nm.sodium_100g || null,
      };

      // Compute a basic score from nutriscore + nova + organic
      // This is a quick estimate — full scoring happens when user scans
      const nutriScore = NUTRISCORE_RANK[nutriscoreGrade?.toLowerCase()] || 2;
      const basicScore = Math.min(100, Math.round(
        nutriScore * 15 +                           // 15-75 from nutriscore
        (novaGroup ? (4 - novaGroup) * 5 : 0) +     // 0-15 from NOVA
        (isOrganic ? 10 : 0)                          // 0-10 organic bonus
      ));

      const result = await pool.query(
        `INSERT INTO products (upc, name, brand, category, image_url, ingredients,
         nutriscore_grade, nova_group, is_organic, allergens_tags, nutrition_facts,
         total_score, swap_discovery_type, swap_discovered_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
         ON CONFLICT (upc) DO UPDATE SET
           name = COALESCE(NULLIF(EXCLUDED.name, 'Unknown'), products.name),
           image_url = COALESCE(EXCLUDED.image_url, products.image_url),
           nutriscore_grade = COALESCE(EXCLUDED.nutriscore_grade, products.nutriscore_grade),
           nova_group = COALESCE(EXCLUDED.nova_group, products.nova_group),
           is_organic = EXCLUDED.is_organic OR products.is_organic,
           swap_discovery_type = EXCLUDED.swap_discovery_type,
           swap_discovered_at = NOW(),
           total_score = CASE 
             WHEN products.nutrition_score IS NOT NULL THEN products.total_score
             ELSE GREATEST(EXCLUDED.total_score, products.total_score)
           END
         RETURNING *`,
        [
          upc, name, brand, category, imageUrl, ingredients,
          nutriscoreGrade, novaGroup, isOrganic,
          JSON.stringify(allergensTags), JSON.stringify(nutritionFacts),
          basicScore, type.id
        ]
      );

      if (result.rows.length > 0) {
        saved.push(result.rows[0]);
      }
    } catch (e) {
      // Duplicate or constraint error — skip
      console.error('Swap discovery save error:', e.message);
    }
  }

  // Return sorted by total_score desc
  return saved.sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
}

// ============================================================
// Apply type filter to cached results
// ============================================================
function applyTypeFilter(rows, type) {
  return rows.filter(r => {
    const name = `${r.name || ''} ${r.subcategory || ''}`.toLowerCase();
    if (!type.must_contain.some(kw => name.includes(kw))) {
      // Check category
      const cat = (r.category || '').toLowerCase();
      if (!type.must_contain.some(kw => cat.includes(kw))) return false;
    }
    if (type.exclude.some(kw => name.includes(kw))) return false;
    return true;
  });
}

// ============================================================
// Try to infer type from OFF category string
// ============================================================
function inferTypeFromCategory(category) {
  if (!category) return null;
  const cat = category.toLowerCase().replace(/^en:/, '');
  
  for (const type of PRODUCT_TYPES) {
    for (const offCat of type.off_categories) {
      const cleanCat = offCat.replace('en:', '');
      if (cat.includes(cleanCat) || cleanCat.includes(cat)) {
        return type;
      }
    }
  }
  return null;
}

// ============================================================
// Get the product type for a given product (exported for recipe matching)
// ============================================================
export function getProductType(product) {
  const fullName = `${product.name || ''} ${product.subcategory || ''} ${product.category || ''}`.toLowerCase();
  for (const type of PRODUCT_TYPES) {
    if (type.test.test(fullName)) return type;
  }
  return inferTypeFromCategory(product.category);
}

export { PRODUCT_TYPES };
