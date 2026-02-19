// ============================================================
// BULK SWAP + AVAILABILITY GENERATOR
// Run locally against your Render DB to:
//   1. Normalize categories so matching works
//   2. Mark clean alternatives (score 70+, no bad additives)
//   3. Assign swaps to every product by category
//   4. Keyword fallback for mismatched categories
//   5. Populate curated_availability (which stores carry it)
//   6. Populate online_links (Amazon, Thrive, brand DTC)
// 
// Usage:
//   cd backend
//   $env:DATABASE_URL="your-render-connection-string"
//   node generate-bulk-swaps.js
// ============================================================

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 60000,
  idleTimeoutMillis: 120000,
  max: 1,  // Single connection — prevents deadlocks
});

// Set statement timeout per-connection
pool.on('connect', (client) => {
  client.query('SET statement_timeout = 300000'); // 5 min per query
});

// Retry helper for transient errors
async function queryRetry(sql, params = [], retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await pool.query(sql, params);
    } catch (e) {
      if ((e.code === '40P01' || e.code === '40001') && i < retries - 1) {
        console.log(`  ⟳ Deadlock, retrying (${i + 1}/${retries})...`);
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
}

// ── Step 1: Normalize categories ──
async function normalizeCategories() {
  console.log('\n── Step 1: Normalizing categories ──');
  
  // Strip "en:" prefix from OFF categories (batch)
  let total1 = 0;
  while (true) {
    const r = await pool.query(`
      UPDATE products SET category = REGEXP_REPLACE(category, '^en:', '')
      WHERE id IN (SELECT id FROM products WHERE category LIKE 'en:%' LIMIT 10000)
    `);
    total1 += r.rowCount;
    if (r.rowCount === 0) break;
    console.log(`  ... stripped ${total1} so far`);
  }
  console.log(`  Stripped en: prefix from ${total1} products`);
  
  // Replace dashes with spaces (batch)
  let total2 = 0;
  while (true) {
    const r = await pool.query(`
      UPDATE products SET category = REPLACE(category, '-', ' ')
      WHERE id IN (SELECT id FROM products WHERE category LIKE '%-%' AND category NOT LIKE 'en:%' LIMIT 10000)
    `);
    total2 += r.rowCount;
    if (r.rowCount === 0) break;
    console.log(`  ... normalized ${total2} so far`);
  }
  console.log(`  Normalized dashes in ${total2} categories`);
}

// ── Step 2: Score products that have nutriscore but no total_score ──
async function scoreUnscoredProducts() {
  console.log('\n── Step 2: Scoring unscored products ──');
  
  let total = 0;
  while (true) {
    const result = await pool.query(`
      UPDATE products SET total_score = 
        CASE nutriscore_grade
          WHEN 'a' THEN 85 + CASE WHEN is_organic THEN 10 ELSE 0 END
          WHEN 'b' THEN 72 + CASE WHEN is_organic THEN 8 ELSE 0 END
          WHEN 'c' THEN 55 + CASE WHEN is_organic THEN 5 ELSE 0 END
          WHEN 'd' THEN 35
          WHEN 'e' THEN 15
          ELSE 50
        END
        - CASE WHEN nova_group = 4 THEN 15
               WHEN nova_group = 3 THEN 8
               WHEN nova_group = 2 THEN 3
               ELSE 0 END
      WHERE id IN (
        SELECT id FROM products 
        WHERE total_score IS NULL AND nutriscore_grade IS NOT NULL 
        LIMIT 10000
      )
    `);
    total += result.rowCount;
    if (result.rowCount === 0) break;
    console.log(`  ... scored ${total} so far`);
  }
  console.log(`  Scored ${total} products from nutriscore + nova`);
}

// ── Step 3: Mark clean alternatives ──
async function markCleanAlternatives() {
  console.log('\n── Step 3: Marking clean alternatives ──');
  
  // Reset in batches
  let resetCount = 0;
  while (true) {
    const r = await pool.query(`
      UPDATE products SET is_clean_alternative = false
      WHERE id IN (SELECT id FROM products WHERE is_clean_alternative = true LIMIT 10000)
    `);
    resetCount += r.rowCount;
    if (r.rowCount === 0) break;
  }
  
  // Mark in batches
  let total = 0;
  while (true) {
    const result = await pool.query(`
      UPDATE products SET is_clean_alternative = true
      WHERE id IN (
        SELECT id FROM products
        WHERE total_score >= 65
        AND total_score IS NOT NULL
        AND (nutriscore_grade IN ('a', 'b') OR total_score >= 75)
        AND is_clean_alternative = false
        LIMIT 10000
      )
    `);
    total += result.rowCount;
    if (result.rowCount === 0) break;
    console.log(`  ... marked ${total} so far`);
  }
  console.log(`  Marked ${total} clean alternatives`);
}

// ── Step 4: Build and assign swaps by category ──
async function assignSwapsByCategory() {
  console.log('\n── Step 4: Assigning swaps by category ──');
  
  // Get categories with clean alternatives
  const categories = await pool.query(`
    SELECT category, COUNT(*) as alt_count
    FROM products 
    WHERE is_clean_alternative = true 
    AND total_score >= 65
    AND category IS NOT NULL 
    AND TRIM(category) != ''
    AND category NOT IN ('Unknown', 'unknown', '')
    GROUP BY category 
    HAVING COUNT(*) >= 1
    ORDER BY COUNT(*) DESC
  `);
  
  console.log(`  Found ${categories.rows.length} categories with clean alternatives`);
  
  let totalUpdated = 0;
  
  for (const cat of categories.rows) {
    // Top 5 alternatives for this category
    const alts = await pool.query(`
      SELECT upc FROM products
      WHERE category = $1
      AND is_clean_alternative = true
      AND total_score >= 65
      AND upc IS NOT NULL
      ORDER BY total_score DESC
      LIMIT 5
    `, [cat.category]);
    
    if (alts.rows.length === 0) continue;
    
    const altUpcs = JSON.stringify(alts.rows.map(r => r.upc));
    
    // Assign to all lower-scoring products without existing curated swaps
    const result = await pool.query(`
      UPDATE products
      SET swaps_to = $1::jsonb
      WHERE category = $2
      AND (total_score < 65 OR total_score IS NULL)
      AND (swaps_to IS NULL OR swaps_to = '[]' OR swaps_to = 'null')
    `, [altUpcs, cat.category]);
    
    totalUpdated += result.rowCount;
  }
  
  console.log(`  ✓ Category swaps assigned to ${totalUpdated} products`);
  return totalUpdated;
}

// ── Step 5: Keyword fallback swaps ──
async function assignKeywordSwaps() {
  console.log('\n── Step 5: Keyword-based swap fallback ──');
  
  // Map name patterns → categories to search for alternatives
  const KEYWORD_MAP = [
    { pattern: '%soda%',          cats: ['sodas', 'carbonated drinks', 'soft drinks'] },
    { pattern: '%cola%',          cats: ['sodas', 'carbonated drinks'] },
    { pattern: '%coca%cola%',     cats: ['sodas', 'carbonated drinks'] },
    { pattern: '%pepsi%',         cats: ['sodas', 'carbonated drinks'] },
    { pattern: '%sprite%',        cats: ['sodas', 'carbonated drinks'] },
    { pattern: '%mountain dew%',  cats: ['sodas', 'carbonated drinks'] },
    { pattern: '%dr pepper%',     cats: ['sodas', 'carbonated drinks'] },
    { pattern: '%chip%',          cats: ['chips', 'potato chips', 'tortilla chips', 'chips and fries', 'crisps'] },
    { pattern: '%dorito%',        cats: ['chips', 'tortilla chips', 'chips and fries'] },
    { pattern: '%cheeto%',        cats: ['chips', 'chips and fries', 'crisps'] },
    { pattern: '%cereal%',        cats: ['breakfast cereals', 'cereals'] },
    { pattern: '%cheerio%',       cats: ['breakfast cereals', 'cereals'] },
    { pattern: '%froot loop%',    cats: ['breakfast cereals', 'cereals'] },
    { pattern: '%frosted flake%', cats: ['breakfast cereals', 'cereals'] },
    { pattern: '%cookie%',        cats: ['cookies', 'biscuits and cakes', 'biscuits'] },
    { pattern: '%oreo%',          cats: ['cookies', 'biscuits and cakes'] },
    { pattern: '%cracker%',       cats: ['crackers'] },
    { pattern: '%goldfish%',      cats: ['crackers'] },
    { pattern: '%candy%',         cats: ['candies', 'confectioneries', 'sweets'] },
    { pattern: '%skittle%',       cats: ['candies', 'confectioneries'] },
    { pattern: '%gumm%',          cats: ['candies', 'confectioneries', 'gummy candies'] },
    { pattern: '%chocolate%',     cats: ['chocolates', 'dark chocolates', 'chocolate bars'] },
    { pattern: '%juice%',         cats: ['fruit juices', 'juices and nectars', 'juices'] },
    { pattern: '%yogurt%',        cats: ['yogurts', 'dairy desserts'] },
    { pattern: '%ice cream%',     cats: ['ice creams', 'frozen desserts'] },
    { pattern: '%bread%',         cats: ['breads', 'sliced bread'] },
    { pattern: '%pasta sauce%',   cats: ['pasta sauces', 'tomato sauces', 'sauces'] },
    { pattern: '%marinara%',      cats: ['pasta sauces', 'tomato sauces'] },
    { pattern: '%ketchup%',       cats: ['ketchup', 'condiments'] },
    { pattern: '%dressing%',      cats: ['salad dressings'] },
    { pattern: '%ranch%',         cats: ['salad dressings'] },
    { pattern: '%peanut butter%', cats: ['peanut butters', 'nut butters'] },
    { pattern: '%almond butter%', cats: ['nut butters', 'peanut butters'] },
    { pattern: '%mac%cheese%',    cats: ['pasta dishes', 'macaroni and cheese'] },
    { pattern: '%ramen%',         cats: ['instant noodles', 'noodles'] },
    { pattern: '%soup%',          cats: ['soups'] },
    { pattern: '%hot dog%',       cats: ['sausages', 'hot dogs'] },
    { pattern: '%pizza%',         cats: ['frozen pizzas', 'pizzas'] },
    { pattern: '%popcorn%',       cats: ['popcorn'] },
    { pattern: '%pretzel%',       cats: ['pretzels'] },
    { pattern: '%oatmeal%',       cats: ['oatmeals', 'cereals'] },
    { pattern: '%granola%',       cats: ['granola', 'cereal bars', 'granola bars'] },
    { pattern: '%energy drink%',  cats: ['energy drinks'] },
    { pattern: '%monster%energy%',cats: ['energy drinks'] },
    { pattern: '%red bull%',      cats: ['energy drinks'] },
    { pattern: '%gatorade%',      cats: ['sports drinks'] },
    { pattern: '%powerade%',      cats: ['sports drinks'] },
    { pattern: '%mayo%',          cats: ['mayonnaises', 'condiments'] },
    { pattern: '%mustard%',       cats: ['mustard', 'condiments'] },
    { pattern: '%bbq sauce%',     cats: ['sauces', 'condiments'] },
    { pattern: '%syrup%',         cats: ['syrups', 'maple syrups'] },
    { pattern: '%creamer%',       cats: ['coffee creamers', 'dairy'] },
    { pattern: '%frozen meal%',   cats: ['frozen meals', 'frozen foods'] },
    { pattern: '%hot pocket%',    cats: ['frozen meals', 'frozen foods'] },
    { pattern: '%nugget%',        cats: ['frozen foods', 'chicken'] },
    { pattern: '%waffle%',        cats: ['frozen foods', 'waffles'] },
    { pattern: '%pancake%',       cats: ['pancakes', 'breakfast'] },
    { pattern: '%muffin%',        cats: ['muffins', 'biscuits and cakes'] },
    { pattern: '%pop tart%',      cats: ['pastries', 'breakfast'] },
    { pattern: '%toaster pastry%',cats: ['pastries', 'breakfast'] },
    { pattern: '%protein bar%',   cats: ['energy bars', 'protein bars'] },
    { pattern: '%granola bar%',   cats: ['cereal bars', 'granola bars'] },
    { pattern: '%fruit snack%',   cats: ['fruit snacks', 'fruit based snacks'] },
    { pattern: '%applesauce%',    cats: ['applesauces', 'fruit purees'] },
    { pattern: '%hummus%',        cats: ['hummus', 'dips'] },
  ];
  
  let totalUpdated = 0;
  
  for (const kw of KEYWORD_MAP) {
    // Find best alternatives across matching categories
    const alts = await pool.query(`
      SELECT upc, name, brand, total_score
      FROM products
      WHERE category = ANY($1)
      AND is_clean_alternative = true
      AND total_score >= 65
      ORDER BY total_score DESC
      LIMIT 5
    `, [kw.cats]);
    
    if (alts.rows.length === 0) continue;
    
    const altUpcs = JSON.stringify(alts.rows.map(r => r.upc));
    
    const result = await pool.query(`
      UPDATE products
      SET swaps_to = $1::jsonb
      WHERE LOWER(name) LIKE $2
      AND (total_score < 65 OR total_score IS NULL)
      AND (swaps_to IS NULL OR swaps_to = '[]' OR swaps_to = 'null')
    `, [altUpcs, kw.pattern]);
    
    if (result.rowCount > 0) {
      console.log(`  "${kw.pattern}": ${result.rowCount} → ${alts.rows[0].name} (${alts.rows[0].total_score})`);
      totalUpdated += result.rowCount;
    }
  }
  
  console.log(`  ✓ Keyword fallback: ${totalUpdated} more products`);
}

// ── Step 6: Populate curated_availability ──
async function populateRetailerAvailability() {
  console.log('\n── Step 6: Adding retailer availability ──');
  
  const BRAND_STORES = {
    'Annie\'s':          ['Whole Foods', 'Target', 'Walmart', 'Kroger', 'Meijer'],
    'Simple Mills':      ['Whole Foods', 'Target', 'Kroger', 'Sprouts'],
    'Siete':             ['Whole Foods', 'Target', 'Costco', 'HEB'],
    'Late July':         ['Whole Foods', 'Target', 'Kroger'],
    'Three Wishes':      ['Whole Foods', 'Target', 'Sprouts'],
    'Cascadian Farm':    ['Whole Foods', 'Target', 'Walmart', 'Kroger'],
    'Nature\'s Path':    ['Whole Foods', 'Target', 'Kroger', 'Sprouts'],
    'KIND':              ['Target', 'Walmart', 'Kroger', 'Costco', 'Meijer'],
    'Kettle Brand':      ['Whole Foods', 'Target', 'Walmart', 'Kroger'],
    'Applegate':         ['Whole Foods', 'Target', 'Kroger', 'Sprouts'],
    'Stonyfield':        ['Whole Foods', 'Target', 'Walmart', 'Kroger'],
    'Horizon':           ['Whole Foods', 'Target', 'Walmart', 'Kroger', 'Costco'],
    'Olipop':            ['Whole Foods', 'Target', 'Kroger', 'Sprouts'],
    'Spindrift':         ['Whole Foods', 'Target', 'Kroger', 'Costco'],
    'Primal Kitchen':    ['Whole Foods', 'Target', 'Kroger', 'Sprouts'],
    'Bob\'s Red Mill':   ['Whole Foods', 'Target', 'Walmart', 'Kroger'],
    'SmartSweets':       ['Whole Foods', 'Target', 'Walmart'],
    'Hu ':               ['Whole Foods', 'Target', 'Sprouts'],
    'RXBAR':             ['Target', 'Walmart', 'Kroger', 'Costco'],
    'Larabar':           ['Target', 'Walmart', 'Kroger', 'Costco'],
    'Justin\'s':         ['Whole Foods', 'Target', 'Walmart', 'Kroger'],
    'Unreal':            ['Whole Foods', 'Target', 'CVS', 'Sprouts'],
    'YumEarth':          ['Whole Foods', 'Target', 'Walmart'],
    'Enjoy Life':        ['Whole Foods', 'Target', 'Walmart', 'Kroger'],
    'Purely Elizabeth':   ['Whole Foods', 'Target', 'Sprouts'],
    'Rao\'s':            ['Whole Foods', 'Target', 'Walmart', 'Kroger', 'Costco'],
    'Dave\'s Killer':    ['Whole Foods', 'Target', 'Walmart', 'Kroger', 'Costco'],
    'Ezekiel':           ['Whole Foods', 'Target', 'Kroger', 'Sprouts'],
    'Birch Benders':     ['Whole Foods', 'Target', 'Walmart'],
    'Once Upon a Farm':  ['Whole Foods', 'Target', 'Kroger'],
    'Serenity Kids':     ['Whole Foods', 'Target', 'Sprouts'],
    'Banza':             ['Whole Foods', 'Target', 'Walmart', 'Kroger'],
    'Caulipower':        ['Whole Foods', 'Target', 'Walmart', 'Costco'],
    'Lesser Evil':       ['Whole Foods', 'Target', 'Sprouts'],
    'Skinny Pop':        ['Target', 'Walmart', 'Kroger', 'Costco'],
    'Chobani':           ['Target', 'Walmart', 'Kroger', 'Costco', 'Meijer'],
    'Siggi':             ['Whole Foods', 'Target', 'Kroger'],
    'Fage':              ['Target', 'Walmart', 'Kroger', 'Costco'],
    'Orgain':            ['Whole Foods', 'Target', 'Walmart', 'Costco'],
    'Garden of Eatin':   ['Whole Foods', 'Target', 'Kroger'],
    'Newman\'s Own':     ['Target', 'Walmart', 'Kroger'],
    'Amy\'s':            ['Whole Foods', 'Target', 'Walmart', 'Kroger'],
    'Kashi':             ['Target', 'Walmart', 'Kroger'],
    'Clif':              ['Target', 'Walmart', 'Kroger', 'Costco'],
    'Sir Kensington':    ['Whole Foods', 'Target', 'Kroger'],
    'Tessemae':          ['Whole Foods', 'Sprouts'],
  };
  
  let totalAdded = 0;
  
  for (const [brand, stores] of Object.entries(BRAND_STORES)) {
    const products = await pool.query(`
      SELECT upc FROM products WHERE brand ILIKE $1 LIMIT 200
    `, [`%${brand}%`]);
    
    for (const p of products.rows) {
      for (const store of stores) {
        try {
          await pool.query(`
            INSERT INTO curated_availability (upc, store_name, store_chain)
            VALUES ($1, $2, $2)
            ON CONFLICT (upc, store_name) DO NOTHING
          `, [p.upc, store]);
          totalAdded++;
        } catch (e) { /* skip */ }
      }
    }
  }
  
  console.log(`  ✓ Added ${totalAdded} retailer availability entries`);
}

// ── Step 7: Populate online_links ──
async function populateOnlineLinks() {
  console.log('\n── Step 7: Adding online purchase links ──');
  
  const BRAND_LINKS = {
    'Annie\'s':          { amazon: 'annies+organic', thrive: true, dtc: null },
    'Simple Mills':      { amazon: 'simple+mills', thrive: true, dtc: 'https://simplemills.com' },
    'Siete':             { amazon: 'siete+foods', thrive: true, dtc: 'https://sietefoods.com' },
    'Three Wishes':      { amazon: 'three+wishes+cereal', thrive: true, dtc: 'https://threewishescereal.com' },
    'Cascadian Farm':    { amazon: 'cascadian+farm+organic', thrive: true, dtc: null },
    'Nature\'s Path':    { amazon: 'natures+path+organic', thrive: true, dtc: null },
    'Olipop':            { amazon: 'olipop+prebiotic+soda', thrive: false, dtc: 'https://drinkolipop.com' },
    'Spindrift':         { amazon: 'spindrift+sparkling', thrive: false, dtc: 'https://drinkspindrift.com' },
    'SmartSweets':       { amazon: 'smartsweets', thrive: true, dtc: 'https://smartsweets.com' },
    'Hu ':               { amazon: 'hu+kitchen+chocolate', thrive: true, dtc: 'https://hukitchen.com' },
    'Unreal':            { amazon: 'unreal+candy', thrive: true, dtc: 'https://unrealsnacks.com' },
    'Primal Kitchen':    { amazon: 'primal+kitchen', thrive: true, dtc: 'https://primalkitchen.com' },
    'Sir Kensington':    { amazon: 'sir+kensingtons', thrive: true, dtc: null },
    'Bob\'s Red Mill':   { amazon: 'bobs+red+mill', thrive: true, dtc: 'https://bobsredmill.com' },
    'Rao\'s':            { amazon: 'raos+homemade+sauce', thrive: false, dtc: null },
    'Dave\'s Killer':    { amazon: 'daves+killer+bread', thrive: false, dtc: null },
    'Applegate':         { amazon: 'applegate+organic', thrive: true, dtc: null },
    'RXBAR':             { amazon: 'rxbar', thrive: false, dtc: 'https://rxbar.com' },
    'Larabar':           { amazon: 'larabar', thrive: true, dtc: null },
    'Justin\'s':         { amazon: 'justins+nut+butter', thrive: true, dtc: null },
    'KIND':              { amazon: 'kind+bars', thrive: false, dtc: 'https://kindsnacks.com' },
    'Kettle Brand':      { amazon: 'kettle+brand+chips', thrive: false, dtc: null },
    'Banza':             { amazon: 'banza+pasta', thrive: true, dtc: 'https://eatbanza.com' },
    'Caulipower':        { amazon: 'caulipower', thrive: false, dtc: 'https://eatcaulipower.com' },
    'YumEarth':          { amazon: 'yumearth+organic', thrive: true, dtc: 'https://yumearth.com' },
    'Enjoy Life':        { amazon: 'enjoy+life+foods', thrive: true, dtc: null },
    'Amy\'s':            { amazon: 'amys+organic', thrive: true, dtc: null },
    'Kashi':             { amazon: 'kashi+cereal', thrive: false, dtc: null },
    'Tessemae':          { amazon: 'tessemaes', thrive: true, dtc: 'https://tessemaes.com' },
    'Orgain':            { amazon: 'orgain+organic', thrive: true, dtc: 'https://orgain.com' },
  };
  
  let totalLinks = 0;
  
  for (const [brand, links] of Object.entries(BRAND_LINKS)) {
    const products = await pool.query(`
      SELECT upc FROM products WHERE brand ILIKE $1 LIMIT 200
    `, [`%${brand}%`]);
    
    for (const p of products.rows) {
      // Amazon
      try {
        await pool.query(`
          INSERT INTO online_links (upc, name, url, link_type)
          VALUES ($1, 'Amazon', $2, 'marketplace')
          ON CONFLICT (upc, url) DO NOTHING
        `, [p.upc, `https://www.amazon.com/s?k=${links.amazon}`]);
        totalLinks++;
      } catch (e) {}
      
      // Thrive Market
      if (links.thrive) {
        const term = brand.replace(/'/g, '').replace(/\s+/g, '+');
        try {
          await pool.query(`
            INSERT INTO online_links (upc, name, url, link_type)
            VALUES ($1, 'Thrive Market', $2, 'health')
            ON CONFLICT (upc, url) DO NOTHING
          `, [p.upc, `https://thrivemarket.com/search?search=${term}`]);
          totalLinks++;
        } catch (e) {}
      }
      
      // Brand DTC
      if (links.dtc) {
        try {
          await pool.query(`
            INSERT INTO online_links (upc, name, url, link_type)
            VALUES ($1, $2, $3, 'brand')
            ON CONFLICT (upc, url) DO NOTHING
          `, [p.upc, `${brand.trim()} (direct)`, links.dtc]);
          totalLinks++;
        } catch (e) {}
      }
    }
  }
  
  // Generic Amazon search for any clean alt without links
  const unlinked = await pool.query(`
    SELECT upc, name, brand FROM products 
    WHERE is_clean_alternative = true 
    AND total_score >= 70
    AND upc NOT IN (SELECT DISTINCT upc FROM online_links)
    LIMIT 10000
  `);
  
  for (const p of unlinked.rows) {
    const term = encodeURIComponent(`${p.brand} ${p.name}`.substring(0, 80));
    try {
      await pool.query(`
        INSERT INTO online_links (upc, name, url, link_type)
        VALUES ($1, 'Amazon', $2, 'search')
        ON CONFLICT (upc, url) DO NOTHING
      `, [p.upc, `https://www.amazon.com/s?k=${term}`]);
      totalLinks++;
    } catch (e) {}
  }
  
  console.log(`  ✓ Added ${totalLinks} online purchase links`);
}

// ══════════════════════════════════════
//  MAIN
// ══════════════════════════════════════
async function main() {
  console.log('════════════════════════════════════════');
  console.log('  Ick Bulk Swap & Availability Generator');
  console.log('════════════════════════════════════════');
  
  const t = Date.now();
  
  try {
    await normalizeCategories();
    await scoreUnscoredProducts();
    await markCleanAlternatives();
    await assignSwapsByCategory();
    await assignKeywordSwaps();
    await populateRetailerAvailability();
    await populateOnlineLinks();
    
    // Final stats
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN swaps_to IS NOT NULL AND swaps_to != '[]' AND swaps_to != 'null' THEN 1 END) as with_swaps,
        COUNT(CASE WHEN is_clean_alternative THEN 1 END) as clean_alts,
        COUNT(CASE WHEN total_score IS NOT NULL THEN 1 END) as scored
      FROM products
    `);
    
    const avail = await pool.query(`SELECT COUNT(*) FROM curated_availability`).catch(() => ({rows:[{count:0}]}));
    const links = await pool.query(`SELECT COUNT(*) FROM online_links`).catch(() => ({rows:[{count:0}]}));
    
    console.log('\n════════════════════════════════════════');
    console.log('  ✓ COMPLETE');
    console.log('════════════════════════════════════════');
    console.log(`  Total products:        ${stats.rows[0].total}`);
    console.log(`  Scored:                ${stats.rows[0].scored}`);
    console.log(`  Clean alternatives:    ${stats.rows[0].clean_alts}`);
    console.log(`  Products with swaps:   ${stats.rows[0].with_swaps}`);
    console.log(`  Retailer availability: ${avail.rows[0].count}`);
    console.log(`  Online links:          ${links.rows[0].count}`);
    console.log(`  Time: ${((Date.now() - t) / 1000).toFixed(1)}s`);
    
  } catch (err) {
    console.error('FATAL:', err);
  }
  
  await pool.end();
  process.exit(0);
}

main();
