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
      return res.json({ status: 'verified', verified_count: existing.rows[0].verified_count + 1 });
    }

    // New sighting
    await pool.query(
      `INSERT INTO local_sightings (user_id, product_id, upc, store_name, store_address, store_city, store_state, store_zip, aisle, price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [req.user.id, productId, upc, store_name, store_address, store_city, store_state, store_zip, aisle, price]
    );

    res.json({ status: 'reported' });
  } catch (err) {
    console.error('Sighting report error:', err);
    res.status(500).json({ error: 'Failed to report sighting' });
  }
});

// Auto-sighting: called when a user scans a product (fire-and-forget, no store details needed initially)
router.post('/auto', optionalAuth, async (req, res) => {
  try {
    const { upc } = req.body;
    if (!upc) return res.json({ status: 'skipped' });

    // Just acknowledge — auto-sighting with store details happens via StoreTagPrompt on frontend
    res.json({ status: 'acknowledged' });
  } catch (err) {
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
