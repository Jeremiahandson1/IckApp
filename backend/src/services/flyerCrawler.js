/**
 * Flyer Crawler — Real Product Availability via Flipp Backend
 * 
 * Uses backflipp.wishabi.com/flipp/items/search to find where products
 * are carried and at what price, across ALL major retailers nationwide.
 * 
 * Covers: Walmart, Target, Aldi, Kroger, Costco, Walgreens, CVS, 
 *         Meijer, HEB, Publix, Safeway, Food Lion, and 1,600+ more.
 * 
 * Strategy:
 *   - Search Flipp for each product in our DB by name/brand
 *   - Sample across ~50 major zip codes nationwide for broad coverage
 *   - Cache results with "price as of" timestamps
 *   - Re-crawl weekly (flyers change weekly)
 * 
 * This runs:
 *   1. On server startup (background, non-blocking)
 *   2. Daily at 3 AM via setInterval
 */

import pool from '../db/init.js';

const FLIPP_SEARCH_URL = 'https://backflipp.wishabi.com/flipp/items/search';
const FLIPP_ITEM_URL = 'https://backflipp.wishabi.com/flipp/items';

// Rate limiting: be respectful — 1 request per 500ms
const DELAY_MS = 500;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ~50 zip codes covering major US metro areas
// Gives us nationwide coverage without hammering the API
const SAMPLE_ZIPS = [
  // Northeast
  '10001', // NYC
  '02101', // Boston
  '19103', // Philadelphia
  '15213', // Pittsburgh
  '06103', // Hartford
  // Southeast
  '30301', // Atlanta
  '33101', // Miami
  '28201', // Charlotte
  '37201', // Nashville
  '32801', // Orlando
  '23219', // Richmond
  // Midwest
  '60601', // Chicago
  '48201', // Detroit
  '55401', // Minneapolis
  '63101', // St. Louis
  '46201', // Indianapolis
  '53201', // Milwaukee
  '54701', // Eau Claire
  '43201', // Columbus OH
  '64101', // Kansas City
  '68101', // Omaha
  // South Central
  '75201', // Dallas
  '77001', // Houston
  '78201', // San Antonio
  '73101', // Oklahoma City
  '70112', // New Orleans
  // Mountain West
  '80201', // Denver
  '85001', // Phoenix
  '84101', // Salt Lake City
  '87101', // Albuquerque
  '89101', // Las Vegas
  // West Coast
  '90001', // Los Angeles
  '94101', // San Francisco
  '98101', // Seattle
  '97201', // Portland
  '92101', // San Diego
  '95814', // Sacramento
  // Other major
  '96801', // Honolulu
  '99501', // Anchorage
  '27601', // Raleigh
  '35201', // Birmingham
  '40201', // Louisville
  '39201', // Jackson MS
];

// ============================================================
// FLIPP API CALLS
// ============================================================

async function flippSearch(query, postalCode) {
  try {
    const url = `${FLIPP_SEARCH_URL}?locale=en&postal_code=${postalCode}&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('Flipp rate limited, backing off...');
        await sleep(5000);
        return null;
      }
      return null;
    }

    const data = await response.json();
    return data;
  } catch (err) {
    console.error('Flipp search error:', err.message);
    return null;
  }
}

async function flippItemDetail(flyerItemId) {
  try {
    const response = await fetch(`${FLIPP_ITEM_URL}/${flyerItemId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        'Accept': 'application/json'
      }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (err) {
    return null;
  }
}

// ============================================================
// PARSE FLIPP RESULTS INTO STORE AVAILABILITY
// ============================================================

function parseFlippResults(data, searchZip) {
  if (!data?.items || !Array.isArray(data.items)) return [];

  return data.items.map(item => ({
    flyer_item_id: item.flyer_item_id || item.id,
    merchant: item.merchant || item.merchant_name || null,
    store_name: item.merchant || item.merchant_name || 'Unknown',
    product_name: item.name || item.description || '',
    brand: item.brand || null,
    description: item.description || '',
    price: item.current_price != null ? parseFloat(item.current_price) : null,
    price_text: item.price_text || item.pre_price_text || null,
    pre_price_text: item.pre_price_text || null,
    sale_story: item.sale_story || null,
    valid_from: item.valid_from || null,
    valid_to: item.valid_to || null,
    image_url: item.image_url || item.cutout_image_url || null,
    flyer_id: item.flyer_id || null,
    flyer_name: item.flyer_name || null,
    search_zip: searchZip,
    crawled_at: new Date().toISOString(),
    source: 'flipp'
  }));
}

// ============================================================
// DB — store crawled flyer data
// ============================================================

async function initCrawlerTables() {
  try {
    await pool.query(`
      -- Flyer crawl results — raw data from Flipp
      CREATE TABLE IF NOT EXISTS flyer_availability (
        id SERIAL PRIMARY KEY,
        upc VARCHAR(20),
        product_id INT REFERENCES products(id),
        our_product_name VARCHAR(255),
        
        -- From Flipp
        merchant VARCHAR(100) NOT NULL,
        flyer_product_name VARCHAR(500),
        brand VARCHAR(100),
        price DECIMAL(8,2),
        price_text VARCHAR(100),
        sale_story VARCHAR(500),
        valid_from TIMESTAMP,
        valid_to TIMESTAMP,
        image_url TEXT,
        flyer_item_id VARCHAR(50),
        
        -- Location context
        search_zip VARCHAR(10),
        region VARCHAR(50),
        
        -- Metadata
        crawled_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '8 days'),
        
        -- Prevent exact dupes
        UNIQUE(upc, merchant, search_zip, flyer_item_id)
      );

      CREATE INDEX IF NOT EXISTS idx_flyer_avail_upc ON flyer_availability(upc);
      CREATE INDEX IF NOT EXISTS idx_flyer_avail_merchant ON flyer_availability(merchant);
      CREATE INDEX IF NOT EXISTS idx_flyer_avail_zip ON flyer_availability(search_zip);
      CREATE INDEX IF NOT EXISTS idx_flyer_avail_expires ON flyer_availability(expires_at);
    `);
    console.log('Flyer crawler tables ready');
  } catch (err) {
    console.error('Flyer crawler table init error:', err.message);
  }
}

function getRegionForZip(zip) {
  const prefix = parseInt(zip.substring(0, 3));
  if (prefix <= 9) return 'northeast';
  if (prefix <= 19) return 'northeast';
  if (prefix <= 29) return 'southeast';
  if (prefix <= 39) return 'southeast';
  if (prefix <= 49) return 'midwest';
  if (prefix <= 59) return 'midwest';
  if (prefix <= 69) return 'central';
  if (prefix <= 79) return 'south';
  if (prefix <= 89) return 'mountain';
  if (prefix <= 99) return 'west';
  return 'unknown';
}

async function saveFlippResults(results, upc, productId, ourProductName) {
  let saved = 0;
  for (const item of results) {
    try {
      await pool.query(
        `INSERT INTO flyer_availability 
         (upc, product_id, our_product_name, merchant, flyer_product_name, brand, 
          price, price_text, sale_story, valid_from, valid_to, image_url, 
          flyer_item_id, search_zip, region, crawled_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(),
                 COALESCE($11, NOW() + INTERVAL '8 days'))
         ON CONFLICT (upc, merchant, search_zip, flyer_item_id) DO UPDATE SET
           price = EXCLUDED.price,
           price_text = EXCLUDED.price_text,
           sale_story = EXCLUDED.sale_story,
           valid_to = EXCLUDED.valid_to,
           crawled_at = NOW(),
           expires_at = COALESCE(EXCLUDED.valid_to, NOW() + INTERVAL '8 days')`,
        [
          upc, productId, ourProductName,
          item.store_name, item.product_name, item.brand,
          item.price, item.price_text, item.sale_story,
          item.valid_from, item.valid_to, item.image_url,
          String(item.flyer_item_id || 'unknown'),
          item.search_zip, getRegionForZip(item.search_zip)
        ]
      );
      saved++;
    } catch (err) {
      // Dupe or constraint error — fine, skip
      if (!err.message.includes('duplicate') && !err.message.includes('unique')) {
        console.error('Save flyer result error:', err.message);
      }
    }
  }
  return saved;
}

// ============================================================
// QUERY — get availability for a product from crawled data
// ============================================================

export async function getProductAvailability(upc, userZip = null) {
  try {
    let query, params;
    
    if (userZip) {
      const region = getRegionForZip(userZip);
      const zipPrefix = userZip.substring(0, 3);
      // Prioritize: exact zip > same prefix > same region > nationwide
      query = `
        SELECT DISTINCT ON (merchant) 
          merchant as store_name, price, price_text, sale_story,
          valid_from, valid_to, crawled_at, search_zip, region,
          flyer_product_name, image_url,
          CASE 
            WHEN search_zip = $2 THEN 0
            WHEN search_zip LIKE $3 THEN 1
            WHEN region = $4 THEN 2
            ELSE 3
          END as proximity
        FROM flyer_availability
        WHERE upc = $1 AND expires_at > NOW()
        ORDER BY merchant, proximity ASC, crawled_at DESC`;
      params = [upc, userZip, `${zipPrefix}%`, region];
    } else {
      // No zip — dedupe by merchant, most recent crawl
      query = `
        SELECT DISTINCT ON (merchant)
          merchant as store_name, price, price_text, sale_story,
          valid_from, valid_to, crawled_at, search_zip, region,
          flyer_product_name, image_url
        FROM flyer_availability
        WHERE upc = $1 AND expires_at > NOW()
        ORDER BY merchant, crawled_at DESC`;
      params = [upc];
    }

    const result = await pool.query(query, params);
    
    return result.rows.map(r => ({
      store_name: r.store_name,
      price: r.price,
      price_text: r.price_text,
      sale_story: r.sale_story,
      valid_from: r.valid_from,
      valid_to: r.valid_to,
      crawled_at: r.crawled_at,
      region: r.region,
      source: 'flipp',
      disclaimer: `Price as of ${new Date(r.crawled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    }));
  } catch (err) {
    console.error('Get availability error:', err.message);
    return [];
  }
}

// Get unique merchants that carry a product (nationwide)
export async function getMerchantsForProduct(upc) {
  try {
    const result = await pool.query(
      `SELECT merchant as store_name, 
              COUNT(DISTINCT search_zip) as zip_count,
              MIN(price) as min_price,
              MAX(price) as max_price,
              MAX(crawled_at) as last_seen
       FROM flyer_availability
       WHERE upc = $1 AND expires_at > NOW()
       GROUP BY merchant
       ORDER BY zip_count DESC`,
      [upc]
    );
    return result.rows;
  } catch (err) {
    return [];
  }
}

// ============================================================
// CRAWLER ENGINE
// ============================================================

export async function crawlProducts(options = {}) {
  const {
    limit = 50,           // Products to crawl per run  
    zipsPerProduct = 8,   // Zip codes to sample per product
    onlyNew = false       // Only crawl products never crawled
  } = options;

  await initCrawlerTables();

  // Get products to crawl — prioritize:
  // 1. Clean alternatives (these are what we recommend)
  // 2. Products with swaps (they need availability for the swaps)
  // 3. Everything else
  let productQuery;
  if (onlyNew) {
    productQuery = `
      SELECT p.id, p.upc, p.name, p.brand, p.category
      FROM products p
      LEFT JOIN flyer_availability fa ON fa.upc = p.upc
      WHERE p.upc IS NOT NULL AND p.name IS NOT NULL
      AND fa.id IS NULL
      ORDER BY p.is_clean_alternative DESC NULLS LAST, p.total_score DESC NULLS LAST
      LIMIT $1`;
  } else {
    productQuery = `
      SELECT p.id, p.upc, p.name, p.brand, p.category
      FROM products p
      WHERE p.upc IS NOT NULL AND p.name IS NOT NULL
      ORDER BY p.is_clean_alternative DESC NULLS LAST, p.total_score DESC NULLS LAST
      LIMIT $1`;
  }

  const products = await pool.query(productQuery, [limit]);
  
  if (products.rows.length === 0) {
    console.log('Flyer crawler: no products to crawl');
    return { products_crawled: 0, results_found: 0 };
  }

  console.log(`Flyer crawler: crawling ${products.rows.length} products across ${zipsPerProduct} zip codes each...`);

  let totalResults = 0;
  let productsCrawled = 0;

  for (const product of products.rows) {
    // Pick a random sample of zip codes for this product
    const selectedZips = shuffleArray([...SAMPLE_ZIPS]).slice(0, zipsPerProduct);
    
    // Build search query — use brand + key product name words
    const searchTerms = buildSearchQuery(product);
    
    let productResults = 0;
    
    for (const zip of selectedZips) {
      const data = await flippSearch(searchTerms, zip);
      
      if (data) {
        const parsed = parseFlippResults(data, zip);
        
        // Filter to items that actually match our product (fuzzy)
        const matched = parsed.filter(item => isRelevantMatch(item, product));
        
        if (matched.length > 0) {
          const saved = await saveFlippResults(matched, product.upc, product.id, product.name);
          productResults += saved;
        }
      }
      
      await sleep(DELAY_MS);
    }

    totalResults += productResults;
    productsCrawled++;
    
    if (productResults > 0) {
      console.log(`  ✓ ${product.name} → ${productResults} store listings found`);
    }

    // Progress log every 10 products
    if (productsCrawled % 10 === 0) {
      console.log(`  ... ${productsCrawled}/${products.rows.length} products crawled, ${totalResults} total results`);
    }
  }

  // Clean up expired entries
  await pool.query('DELETE FROM flyer_availability WHERE expires_at < NOW()');

  console.log(`Flyer crawler complete: ${productsCrawled} products, ${totalResults} store listings`);
  return { products_crawled: productsCrawled, results_found: totalResults };
}

// ============================================================
// HELPERS
// ============================================================

function buildSearchQuery(product) {
  // Build a search query that Flipp will match well
  // "Cheerios" or "Annie's Cheddar Bunnies" — brand + product name
  const parts = [];
  
  if (product.brand && product.brand !== 'Unknown') {
    parts.push(product.brand);
  }
  
  // Use first 3-4 meaningful words from product name
  const nameWords = (product.name || '')
    .replace(/[^\w\s'-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !['the', 'and', 'for', 'with'].includes(w.toLowerCase()))
    .slice(0, 4);
  
  parts.push(...nameWords);
  
  // Dedupe and join
  const unique = [...new Set(parts.map(p => p.toLowerCase()))];
  return unique.join(' ').substring(0, 80);
}

function isRelevantMatch(flippItem, ourProduct) {
  const flippName = (flippItem.product_name || '').toLowerCase();
  const flippBrand = (flippItem.brand || '').toLowerCase();
  const ourName = (ourProduct.name || '').toLowerCase();
  const ourBrand = (ourProduct.brand || '').toLowerCase();
  
  // Brand match (if we have a brand)
  if (ourBrand && ourBrand.length > 2) {
    if (flippName.includes(ourBrand) || flippBrand.includes(ourBrand)) {
      // Brand matches — check if product type is similar
      const nameWords = ourName.split(/\s+/).filter(w => w.length > 3);
      const matchingWords = nameWords.filter(w => flippName.includes(w));
      if (matchingWords.length >= 1) return true;
    }
  }
  
  // Direct name substring match
  const ourNameClean = ourName.replace(/[^\w\s]/g, '').trim();
  if (ourNameClean.length > 5 && flippName.includes(ourNameClean)) return true;
  
  // Key word overlap (at least 2 significant words match)
  const ourWords = ourName.split(/\s+/).filter(w => w.length > 3);
  const matchCount = ourWords.filter(w => flippName.includes(w.toLowerCase())).length;
  if (ourWords.length > 0 && matchCount >= Math.min(2, ourWords.length)) return true;
  
  return false;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ============================================================
// SCHEDULER — run on startup + daily
// ============================================================

let crawlInterval = null;

export function startCrawlScheduler() {
  // Initial crawl — wait 30 seconds after server start, then run in background
  setTimeout(() => {
    console.log('Starting initial flyer crawl...');
    crawlProducts({ limit: 100, zipsPerProduct: 8, onlyNew: true })
      .then(result => console.log('Initial crawl done:', result))
      .catch(err => console.error('Initial crawl error:', err.message));
  }, 30000);

  // Daily re-crawl at ~3 AM (check every hour, run if it's 3 AM)
  crawlInterval = setInterval(() => {
    const hour = new Date().getUTCHours();
    // 3 AM UTC = ~9-10 PM Central
    if (hour === 3) {
      console.log('Starting scheduled flyer re-crawl...');
      crawlProducts({ limit: 200, zipsPerProduct: 10 })
        .then(result => console.log('Scheduled crawl done:', result))
        .catch(err => console.error('Scheduled crawl error:', err.message));
    }
  }, 60 * 60 * 1000); // Check every hour
}

export function stopCrawlScheduler() {
  if (crawlInterval) {
    clearInterval(crawlInterval);
    crawlInterval = null;
  }
}

// ============================================================
// STATS
// ============================================================
export async function getCrawlStats() {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(DISTINCT upc) as products_with_data,
        COUNT(DISTINCT merchant) as unique_merchants,
        COUNT(DISTINCT search_zip) as zips_covered,
        COUNT(*) as total_listings,
        MIN(crawled_at) as oldest_crawl,
        MAX(crawled_at) as newest_crawl
      FROM flyer_availability
      WHERE expires_at > NOW()
    `);
    return result.rows[0];
  } catch (err) {
    return null;
  }
}

export default {
  crawlProducts,
  getProductAvailability,
  getMerchantsForProduct,
  getCrawlStats,
  startCrawlScheduler,
  stopCrawlScheduler,
  initCrawlerTables
};
