import express from 'express';
import pool from '../db/init.js';
import { authenticateToken } from '../middleware/auth.js';
import { requirePremium } from '../middleware/subscription.js';

const router = express.Router();

// All velocity routes require premium
router.use(authenticateToken, requirePremium);

// Get all velocity data for user
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT cv.*, p.name, p.brand, p.category, p.total_score, p.image_url
       FROM consumption_velocity cv
       JOIN products p ON cv.product_id = p.id
       WHERE cv.user_id = $1
       ORDER BY cv.next_predicted_empty ASC`,
      [req.user.id]
    );

    res.json(result.rows);

  } catch (err) {
    console.error('Velocity fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch velocity data' });
  }
});

// Get velocity for specific product
router.get('/product/:upc', async (req, res) => {
  try {
    const { upc } = req.params;

    const result = await pool.query(
      `SELECT cv.*, p.name, p.brand, p.category
       FROM consumption_velocity cv
       JOIN products p ON cv.product_id = p.id
       WHERE cv.user_id = $1 AND cv.upc = $2`,
      [req.user.id, upc]
    );

    if (result.rows.length === 0) {
      return res.json({
        upc,
        tracked: false,
        message: 'No velocity data yet. Mark items as finished to start tracking.'
      });
    }

    // Get consumption history
    const historyResult = await pool.query(
      `SELECT added_at, finished_at, days_to_consume
       FROM pantry_items
       WHERE user_id = $1 AND upc = $2 AND status = 'finished'
       ORDER BY finished_at DESC
       LIMIT 10`,
      [req.user.id, upc]
    );

    res.json({
      ...result.rows[0],
      history: historyResult.rows
    });

  } catch (err) {
    console.error('Velocity fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch velocity data' });
  }
});

// Manually log consumption
router.post('/log', async (req, res) => {
  try {
    const { upc, days_to_consume } = req.body;

    const daysNum = parseInt(days_to_consume);

    if (!upc || !daysNum || daysNum <= 0) {
      return res.status(400).json({ error: 'UPC and valid days_to_consume required' });
    }

    // Get product
    const productResult = await pool.query(
      'SELECT id FROM products WHERE upc = $1',
      [upc]
    );

    const productId = productResult.rows[0]?.id;

    // Update velocity
    const result = await pool.query(
      `INSERT INTO consumption_velocity (user_id, product_id, upc, avg_days_to_consume, consumption_count, last_consumed_at, next_predicted_empty)
       VALUES ($1, $2, $3, $4, 1, NOW(), NOW() + ($4 || ' days')::INTERVAL)
       ON CONFLICT (user_id, upc) DO UPDATE SET
         avg_days_to_consume = (consumption_velocity.avg_days_to_consume * consumption_velocity.consumption_count + $4) / (consumption_velocity.consumption_count + 1),
         consumption_count = consumption_velocity.consumption_count + 1,
         last_consumed_at = NOW(),
         next_predicted_empty = NOW() + (INTERVAL '1 day' * (
           (consumption_velocity.avg_days_to_consume * consumption_velocity.consumption_count + $4) / (consumption_velocity.consumption_count + 1)
         )),
         confidence = CASE 
           WHEN consumption_velocity.consumption_count >= 3 THEN 'high'
           WHEN consumption_velocity.consumption_count >= 1 THEN 'medium'
           ELSE 'low'
         END,
         updated_at = NOW()
       RETURNING *`,
      [req.user.id, productId, upc, daysNum]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Velocity log error:', err);
    res.status(500).json({ error: 'Failed to log consumption' });
  }
});

// Get items running low (predicted to run out soon)
router.get('/running-low', async (req, res) => {
  try {
    const { days = 7 } = req.query;

    const daysNum = parseInt(days) || 7;

    const result = await pool.query(
      `SELECT cv.*, p.name, p.brand, p.category, p.total_score, p.image_url
       FROM consumption_velocity cv
       JOIN products p ON cv.product_id = p.id
       WHERE cv.user_id = $1
       AND cv.next_predicted_empty <= NOW() + ($2 || ' days')::INTERVAL
       AND cv.confidence IN ('medium', 'high')
       ORDER BY cv.next_predicted_empty ASC`,
      [req.user.id, String(daysNum)]
    );

    res.json(result.rows);

  } catch (err) {
    console.error('Running low error:', err);
    res.status(500).json({ error: 'Failed to fetch running low items' });
  }
});

// Reset velocity for a product
router.delete('/product/:upc', async (req, res) => {
  try {
    const { upc } = req.params;

    await pool.query(
      'DELETE FROM consumption_velocity WHERE user_id = $1 AND upc = $2',
      [req.user.id, upc]
    );

    res.json({ deleted: true });

  } catch (err) {
    console.error('Velocity delete error:', err);
    res.status(500).json({ error: 'Failed to reset velocity' });
  }
});

// Mark item as restocked (resets prediction timer)
router.post('/restock/:upc', async (req, res) => {
  try {
    const { upc } = req.params;

    const result = await pool.query(
      `UPDATE consumption_velocity 
       SET next_predicted_empty = NOW() + (INTERVAL '1 day' * avg_days_to_consume),
           updated_at = NOW()
       WHERE user_id = $1 AND upc = $2
       RETURNING *`,
      [req.user.id, upc]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Velocity record not found' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Restock error:', err);
    res.status(500).json({ error: 'Failed to update restock' });
  }
});

// Get velocity summary stats
router.get('/summary', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
         COUNT(*) as total_tracked,
         COUNT(CASE WHEN confidence = 'high' THEN 1 END) as high_confidence,
         COUNT(CASE WHEN confidence = 'medium' THEN 1 END) as medium_confidence,
         COUNT(CASE WHEN confidence = 'low' THEN 1 END) as low_confidence,
         COUNT(CASE WHEN next_predicted_empty <= NOW() + INTERVAL '7 days' THEN 1 END) as running_low_7_days,
         COUNT(CASE WHEN next_predicted_empty <= NOW() + INTERVAL '14 days' THEN 1 END) as running_low_14_days
       FROM consumption_velocity
       WHERE user_id = $1`,
      [req.user.id]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Velocity summary error:', err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

export default router;
