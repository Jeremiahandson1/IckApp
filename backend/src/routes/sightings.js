import express from 'express';
import pool from '../db/init.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Report a product sighting at a store
router.post('/report', authenticateToken, async (req, res) => {
  try {
    const { upc, store_name, store_address, store_city, store_state, store_zip, aisle, price } = req.body;

    if (!upc || !store_name) {
      return res.status(400).json({ error: 'UPC and store name required' });
    }

    // Get product_id
    const productResult = await pool.query('SELECT id FROM products WHERE upc = $1', [upc]);
    const productId = productResult.rows[0]?.id || null;

    // Check for existing sighting at same store
    const existing = await pool.query(
      `SELECT id, verified_count FROM local_sightings 
       WHERE upc = $1 AND LOWER(store_name) = LOWER($2) 
       AND (store_zip = $3 OR ($3 IS NULL AND store_zip IS NULL))`,
      [upc, store_name, store_zip]
    );

    if (existing.rows.length > 0) {
      // Bump verified_count and update details
      await pool.query(
        `UPDATE local_sightings SET 
           verified_count = verified_count + 1,
           last_verified_at = NOW(),
           price = COALESCE($1, price),
           aisle = COALESCE($2, aisle),
           in_stock = true
         WHERE id = $3`,
        [price, aisle, existing.rows[0].id]
      );

      // Remember this store for auto-sighting
      await pool.query(
        `UPDATE users SET last_store = $1, last_store_zip = $2, updated_at = NOW() WHERE id = $3`,
        [store_name, store_zip, req.user.id]
      ).catch(() => {}); // Non-fatal if columns don't exist yet

      return res.json({ status: 'verified', verified_count: existing.rows[0].verified_count + 1 });
    }

    // New sighting
    await pool.query(
      `INSERT INTO local_sightings (user_id, product_id, upc, store_name, store_address, store_city, store_state, store_zip, aisle, price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [req.user.id, productId, upc, store_name, store_address, store_city, store_state, store_zip, aisle, price]
    );

    // Remember this store for auto-sighting
    await pool.query(
      `UPDATE users SET last_store = $1, last_store_zip = $2, updated_at = NOW() WHERE id = $3`,
      [store_name, store_zip, req.user.id]
    ).catch(() => {});

    res.json({ status: 'reported' });
  } catch (err) {
    console.error('Sighting report error:', err);
    res.status(500).json({ error: 'Failed to report sighting' });
  }
});

// Auto-sighting: called when a user scans a product
// If user has a remembered store, auto-associate the scan with that store
// This builds community sighting data passively from normal scanning
router.post('/auto', optionalAuth, async (req, res) => {
  try {
    const { upc, store_name, store_zip } = req.body;
    if (!upc) return res.json({ status: 'skipped' });

    // Need a user to attribute the sighting
    if (!req.user) return res.json({ status: 'skipped', reason: 'anonymous' });

    // Determine store: explicit > user's last_store > user's zip (generic)
    let storeName = store_name || null;
    let storeZip = store_zip || null;

    if (!storeName) {
      try {
        const userResult = await pool.query(
          'SELECT last_store, last_store_zip, zip_code FROM users WHERE id = $1',
          [req.user.id]
        );
        const u = userResult.rows[0];
        if (u?.last_store) {
          storeName = u.last_store;
          storeZip = u.last_store_zip || u.zip_code;
        }
      } catch { /* last_store columns may not exist yet */ }
    }

    // Can't create a sighting without at least a store name
    if (!storeName) return res.json({ status: 'skipped', reason: 'no_store' });

    const productResult = await pool.query('SELECT id FROM products WHERE upc = $1', [upc]);
    const productId = productResult.rows[0]?.id || null;

    // Upsert: bump verified_count if exists, insert if new
    const existing = await pool.query(
      `SELECT id, verified_count FROM local_sightings 
       WHERE upc = $1 AND LOWER(store_name) = LOWER($2) 
       AND (store_zip = $3 OR ($3 IS NULL AND store_zip IS NULL))`,
      [upc, storeName, storeZip]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE local_sightings SET 
           verified_count = verified_count + 1,
           last_verified_at = NOW(),
           in_stock = true
         WHERE id = $1`,
        [existing.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO local_sightings (user_id, product_id, upc, store_name, store_zip)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, productId, upc, storeName, storeZip]
      );
    }

    res.json({ status: 'recorded', store: storeName });
  } catch (err) {
    // Auto-sighting should never break the scan flow
    console.error('Auto-sighting error:', err);
    res.json({ status: 'skipped' });
  }
});

// Get sightings for a product
router.get('/product/:upc', optionalAuth, async (req, res) => {
  try {
    const { upc } = req.params;

    const result = await pool.query(
      `SELECT store_name, store_address, store_city, store_state, store_zip, 
              aisle, price, in_stock, verified_count, last_verified_at,
              'community' as source
       FROM local_sightings 
       WHERE upc = $1 AND in_stock = true
       AND last_verified_at > NOW() - INTERVAL '90 days'
       ORDER BY verified_count DESC, last_verified_at DESC
       LIMIT 10`,
      [upc]
    );

    res.json({ stores: result.rows });
  } catch (err) {
    console.error('Sighting query error:', err);
    res.status(500).json({ error: 'Failed to get sightings' });
  }
});

export default router;
