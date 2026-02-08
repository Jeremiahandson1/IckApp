/**
 * Curated Store Availability + Online Shopping Links
 * 
 * This is the GROUND TRUTH layer — manually verified data about
 * which major chains carry our recommended swap products.
 * 
 * Unlike the flyer crawler (weekly ads only) or Kroger API (one chain),
 * this data represents general availability: "Walmart carries Cheerios"
 * is always true, not just when it's in the weekly ad.
 * 
 * Data sources: brand websites, retailer store locators, manual verification.
 * 
 * Also includes online purchase links (Amazon, Thrive Market, brand DTC)
 * that work for EVERYONE regardless of location.
 */

import pool from '../db/init.js';

// ============================================================
// CURATED STORE DATA
// Key: UPC → which chains carry it + online links
// ============================================================

const CURATED_AVAILABILITY = {
  // ── THREE WISHES CINNAMON CEREAL ──
  '850015717017': {
    stores: ['Target', 'Whole Foods', 'Sprouts', 'Kroger', 'Walmart', 'Wegmans', 'HEB', 'Publix'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/dp/B08R7Z1KPP', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/p/three-wishes-grain-free-cereal-cinnamon', type: 'health' },
      { name: 'Three Wishes (direct)', url: 'https://threewishescereal.com', type: 'brand' }
    ]
  },

  // ── CHEERIOS (Original) ──
  '016000275867': {
    stores: ['Walmart', 'Target', 'Kroger', 'Costco', 'Aldi', 'Meijer', 'Publix', 'Safeway', 'HEB', 'Albertsons', 'Food Lion', 'Walgreens', 'CVS', 'Dollar General'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/dp/B00I5Y6TRO', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=cheerios+original', type: 'marketplace' },
      { name: 'Instacart', url: 'https://www.instacart.com/store/search_v3/cheerios', type: 'delivery' }
    ]
  },

  // ── CASCADIAN FARM ORGANIC GRANOLA ──
  '021908501234': {
    stores: ['Target', 'Whole Foods', 'Kroger', 'Sprouts', 'Natural Grocers', 'Wegmans', 'Publix', 'Safeway'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=cascadian+farm+organic+granola', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=cascadian+farm', type: 'health' }
    ]
  },

  // ── UNREAL DARK CHOCOLATE GEMS ──
  '040000003445': {
    stores: ['Target', 'Whole Foods', 'Kroger', 'CVS', 'Sprouts', 'Natural Grocers', 'Wegmans', 'Fresh Market'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/dp/B00JKJK4QE', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=unreal+candy', type: 'health' },
      { name: 'Unreal Candy (direct)', url: 'https://www.unrealsnacks.com', type: 'brand' }
    ]
  },

  // ── UNREAL DARK CHOCOLATE PEANUT BUTTER CUPS ──
  '850000439412': {
    stores: ['Target', 'Whole Foods', 'Kroger', 'CVS', 'Sprouts', 'Natural Grocers', 'Fresh Market', 'Wegmans'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=unreal+dark+chocolate+peanut+butter+cups', type: 'marketplace' },
      { name: 'Unreal Candy (direct)', url: 'https://www.unrealsnacks.com', type: 'brand' }
    ]
  },

  // ── PIRATE'S BOOTY AGED WHITE CHEDDAR ──
  '015665601004': {
    stores: ['Walmart', 'Target', 'Kroger', 'Costco', 'Whole Foods', 'Publix', 'Safeway', 'Meijer', 'HEB', 'Wegmans', 'Trader Joe\'s'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/dp/B000F0GWXA', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=pirates+booty', type: 'marketplace' },
      { name: 'Instacart', url: 'https://www.instacart.com/store/search_v3/pirates+booty', type: 'delivery' }
    ]
  },

  // ── ANNIE'S CHEDDAR BUNNIES ──
  '013562000043': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Sprouts', 'Publix', 'Safeway', 'Meijer', 'HEB', 'Wegmans', 'Trader Joe\'s'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/dp/B000HDJZWO', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=annies+cheddar+bunnies', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=annie%27s+cheddar+bunnies', type: 'health' }
    ]
  },

  // ── HONEST KIDS APPLE JUICE ──
  '657622101273': {
    stores: ['Walmart', 'Target', 'Kroger', 'Whole Foods', 'Publix', 'Safeway', 'Meijer', 'HEB'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=honest+kids+apple+juice', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=honest+kids+juice', type: 'marketplace' }
    ]
  },

  // ── SERENITY KIDS BEEF & KALE ──
  '860000826201': {
    stores: ['Target', 'Whole Foods', 'Sprouts', 'Natural Grocers', 'Fresh Market', 'Wegmans'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=serenity+kids+baby+food', type: 'marketplace' },
      { name: 'Thrive Market', url: 'https://thrivemarket.com/search?search=serenity+kids', type: 'health' },
      { name: 'Serenity Kids (direct)', url: 'https://www.myserenitykids.com', type: 'brand' }
    ]
  },

  // ── APPLE SAUCE (Mott's Natural) — common clean swap for sugary snacks ──
  '856575002018': {
    stores: ['Walmart', 'Target', 'Kroger', 'Aldi', 'Costco', 'Publix', 'Safeway', 'Meijer', 'HEB', 'Food Lion', 'Dollar General'],
    online: [
      { name: 'Amazon', url: 'https://www.amazon.com/s?k=motts+natural+applesauce', type: 'marketplace' },
      { name: 'Walmart', url: 'https://www.walmart.com/search?q=motts+natural+applesauce', type: 'marketplace' }
    ]
  }
};

// ============================================================
// INIT — seed curated data into DB
// ============================================================

export async function initCuratedAvailability() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS curated_availability (
        id SERIAL PRIMARY KEY,
        upc VARCHAR(20) NOT NULL,
        store_name VARCHAR(100) NOT NULL,
        source VARCHAR(20) DEFAULT 'curated',
        verified_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(upc, store_name)
      );

      CREATE TABLE IF NOT EXISTS online_links (
        id SERIAL PRIMARY KEY,
        upc VARCHAR(20) NOT NULL,
        name VARCHAR(100) NOT NULL,
        url TEXT NOT NULL,
        link_type VARCHAR(20) DEFAULT 'marketplace',
        active BOOLEAN DEFAULT true,
        UNIQUE(upc, name)
      );

      CREATE INDEX IF NOT EXISTS idx_curated_upc ON curated_availability(upc);
      CREATE INDEX IF NOT EXISTS idx_online_upc ON online_links(upc);
    `);

    // Seed curated data
    let storeCount = 0;
    let linkCount = 0;

    for (const [upc, data] of Object.entries(CURATED_AVAILABILITY)) {
      // Stores
      for (const store of data.stores) {
        try {
          await pool.query(
            `INSERT INTO curated_availability (upc, store_name) 
             VALUES ($1, $2) ON CONFLICT (upc, store_name) DO NOTHING`,
            [upc, store]
          );
          storeCount++;
        } catch (e) { /* dupe */ }
      }

      // Online links
      for (const link of (data.online || [])) {
        try {
          await pool.query(
            `INSERT INTO online_links (upc, name, url, link_type) 
             VALUES ($1, $2, $3, $4) ON CONFLICT (upc, name) DO UPDATE SET url = EXCLUDED.url`,
            [upc, link.name, link.url, link.type]
          );
          linkCount++;
        } catch (e) { /* dupe */ }
      }
    }

    console.log(`✓ Curated availability: ${storeCount} store listings, ${linkCount} online links`);
  } catch (err) {
    console.error('Curated availability init error:', err.message);
  }
}

// ============================================================
// QUERY — get curated stores for a product
// ============================================================

export async function getCuratedStores(upc) {
  try {
    const result = await pool.query(
      `SELECT store_name, source FROM curated_availability WHERE upc = $1 ORDER BY store_name`,
      [upc]
    );
    return result.rows.map(r => ({
      store_name: r.store_name,
      source: 'curated',
      verified: true,
      disclaimer: 'Generally carried at this retailer'
    }));
  } catch (err) {
    return [];
  }
}

export async function getOnlineLinks(upc) {
  try {
    const result = await pool.query(
      `SELECT name, url, link_type FROM online_links WHERE upc = $1 AND active = true ORDER BY 
        CASE link_type 
          WHEN 'marketplace' THEN 1 
          WHEN 'health' THEN 2 
          WHEN 'delivery' THEN 3 
          WHEN 'brand' THEN 4 
        END`,
      [upc]
    );
    return result.rows;
  } catch (err) {
    return [];
  }
}

// In-memory fast lookup (no DB needed)
export function getCuratedData(upc) {
  return CURATED_AVAILABILITY[upc] || null;
}

export default {
  initCuratedAvailability,
  getCuratedStores,
  getOnlineLinks,
  getCuratedData,
  CURATED_AVAILABILITY
};
