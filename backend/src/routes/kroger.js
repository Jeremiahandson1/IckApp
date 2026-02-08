import express from 'express';
import pool from '../db/init.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Unified product availability — combines up to 5 sources:
 * 1. Kroger API (real-time, requires OAuth — future)
 * 2. Community sightings (local_sightings table)
 * 3. Flyer crawler (Flipp backend, nationwide)
 * 4. Curated ground-truth (hardcoded reliable data)
 * 5. Online purchase links
 */
router.get('/product/:upc', optionalAuth, async (req, res) => {
  try {
    const { upc } = req.params;
    const userZip = req.query.zip || null;

    const results = { kroger: [], community: [], flyer: [], curated: [] };
    let onlineLinks = [];

    // 1. Community sightings
    try {
      const sightingResult = await pool.query(
        `SELECT store_name, store_address, store_zip, price, aisle, 
                verified_count, last_verified_at, 'community' as source
         FROM local_sightings
         WHERE upc = $1 AND in_stock = true
         AND last_verified_at > NOW() - INTERVAL '90 days'
         ORDER BY verified_count DESC, last_verified_at DESC
         LIMIT 10`,
        [upc]
      );
      results.community = sightingResult.rows;
    } catch (e) { /* table might be empty, non-fatal */ }

    // 2. Flyer crawler data (nationwide, no login needed)
    try {
      const flyerResult = await pool.query(
        `SELECT DISTINCT ON (merchant)
           merchant as store_name, price, price_text, sale_story,
           crawled_at, search_zip, region, 'flyer' as source
         FROM flyer_availability
         WHERE (upc = $1 OR our_product_name ILIKE $2) AND expires_at > NOW()
         ORDER BY merchant, crawled_at DESC
         LIMIT 10`,
        [upc, `%${upc}%`] // fallback to name match later
      );
      results.flyer = flyerResult.rows.map(r => ({
        ...r,
        disclaimer: `Price as of ${new Date(r.crawled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      }));
    } catch (e) { /* flyer_availability table may not exist yet */ }

    // 3. Curated ground-truth
    try {
      const curatedResult = await pool.query(
        `SELECT store_name, 'curated' as source FROM curated_availability WHERE upc = $1 ORDER BY store_name`,
        [upc]
      );
      results.curated = curatedResult.rows;
    } catch (e) { /* curated_availability table may not exist yet */ }

    // 4. Online links
    try {
      const linkResult = await pool.query(
        `SELECT name, url, link_type FROM online_links WHERE upc = $1 AND active = true
         ORDER BY CASE link_type WHEN 'marketplace' THEN 1 WHEN 'health' THEN 2 WHEN 'delivery' THEN 3 WHEN 'brand' THEN 4 END`,
        [upc]
      );
      onlineLinks = linkResult.rows;
    } catch (e) { /* online_links table may not exist yet */ }

    // 5. Combine and deduplicate
    // Priority: Kroger (real-time) > Community (local) > Flyer (weekly ad) > Curated (baseline)
    const seen = new Set();
    const combined = [];

    for (const list of [results.kroger, results.community, results.flyer, results.curated]) {
      for (const item of list) {
        const key = item.store_name?.toLowerCase()?.replace(/[^a-z]/g, '');
        if (key && !seen.has(key)) {
          seen.add(key);
          combined.push(item);
        }
      }
    }

    res.json({
      upc,
      stores: combined,
      online_links: onlineLinks,
      kroger_stores: results.kroger.length,
      flyer_stores: results.flyer.length,
      community_stores: results.community.length,
      curated_stores: results.curated.length,
      total: combined.length
    });

  } catch (err) {
    console.error('Availability error:', err);
    res.status(500).json({ error: 'Failed to get availability', stores: [], online_links: [] });
  }
});

// Crawler stats
router.get('/crawler/stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(DISTINCT upc) as products_with_data,
        COUNT(DISTINCT merchant) as unique_merchants,
        COUNT(DISTINCT search_zip) as zips_covered,
        COUNT(*) as total_listings
      FROM flyer_availability WHERE expires_at > NOW()
    `);
    res.json(stats.rows[0]);
  } catch (e) {
    res.json({ products_with_data: 0, unique_merchants: 0, zips_covered: 0, total_listings: 0 });
  }
});

// Manual crawler trigger
router.post('/crawler/run', async (req, res) => {
  try {
    const { crawlOnce } = await import('../services/flyerCrawler.js');
    const { limit, zipsPerProduct } = req.body || {};
    const result = await crawlOnce(limit || 10, zipsPerProduct || 3);
    res.json({ status: 'complete', ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
