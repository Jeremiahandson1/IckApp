import express from 'express';
import pool from '../db/init.js';
import { authenticateToken } from '../middleware/auth.js';
import { requirePremium } from '../middleware/subscription.js';

const router = express.Router();

// All shopping routes require premium
router.use(authenticateToken, requirePremium);

// Get all shopping lists
router.get('/lists', async (req, res) => {
  try {
    const { status = 'active' } = req.query;

    const result = await pool.query(
      `SELECT sl.*, 
              COUNT(sli.id) as item_count,
              COUNT(CASE WHEN sli.checked THEN 1 END) as checked_count
       FROM shopping_lists sl
       LEFT JOIN shopping_list_items sli ON sl.id = sli.list_id
       WHERE sl.user_id = $1 AND sl.status = $2
       GROUP BY sl.id
       ORDER BY sl.created_at DESC`,
      [req.user.id, status]
    );

    res.json(result.rows);

  } catch (err) {
    console.error('Shopping lists error:', err);
    res.status(500).json({ error: 'Failed to fetch shopping lists' });
  }
});

// Create new shopping list
router.post('/lists', async (req, res) => {
  try {
    const { name = 'My List', store } = req.body;

    const result = await pool.query(
      `INSERT INTO shopping_lists (user_id, name, store)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.user.id, name, store]
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error('Create list error:', err);
    res.status(500).json({ error: 'Failed to create shopping list' });
  }
});

// Get shopping list with items
router.get('/lists/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const listResult = await pool.query(
      'SELECT * FROM shopping_lists WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (listResult.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    const itemsResult = await pool.query(
      `SELECT sli.*, p.name, p.brand, p.category, p.total_score, p.image_url
       FROM shopping_list_items sli
       LEFT JOIN products p ON sli.product_id = p.id
       WHERE sli.list_id = $1
       ORDER BY sli.checked ASC, p.category, sli.created_at`,
      [id]
    );

    res.json({
      ...listResult.rows[0],
      items: itemsResult.rows
    });

  } catch (err) {
    console.error('Get list error:', err);
    res.status(500).json({ error: 'Failed to fetch shopping list' });
  }
});

// Add item to list
router.post('/lists/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
    const { upc, product_id, custom_name, quantity = 1, aisle, section, predicted_need = false } = req.body;

    // Verify list ownership
    const listCheck = await pool.query(
      'SELECT id FROM shopping_lists WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (listCheck.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    // Get product ID if UPC provided
    let productId = product_id;
    if (upc && !product_id) {
      const productResult = await pool.query(
        'SELECT id FROM products WHERE upc = $1',
        [upc]
      );
      if (productResult.rows.length > 0) {
        productId = productResult.rows[0].id;
      }
    }

    const result = await pool.query(
      `INSERT INTO shopping_list_items (list_id, product_id, upc, custom_name, quantity, aisle, section, predicted_need)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, productId, upc, custom_name, quantity, aisle, section, predicted_need]
    );

    // Get full item info
    const fullResult = await pool.query(
      `SELECT sli.*, p.name, p.brand, p.category, p.total_score, p.image_url
       FROM shopping_list_items sli
       LEFT JOIN products p ON sli.product_id = p.id
       WHERE sli.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json(fullResult.rows[0]);

  } catch (err) {
    console.error('Add item error:', err);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// Check/uncheck item
router.put('/items/:itemId/check', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { checked, price_paid } = req.body;

    // Verify ownership through list
    const itemCheck = await pool.query(
      `SELECT sli.* FROM shopping_list_items sli
       JOIN shopping_lists sl ON sli.list_id = sl.id
       WHERE sli.id = $1 AND sl.user_id = $2`,
      [itemId, req.user.id]
    );

    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const result = await pool.query(
      `UPDATE shopping_list_items 
       SET checked = $1,
           checked_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
           price_paid = COALESCE($2, price_paid)
       WHERE id = $3
       RETURNING *`,
      [checked, price_paid, itemId]
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Check item error:', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Delete item from list
router.delete('/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;

    // Verify ownership
    const itemCheck = await pool.query(
      `SELECT sli.id FROM shopping_list_items sli
       JOIN shopping_lists sl ON sli.list_id = sl.id
       WHERE sli.id = $1 AND sl.user_id = $2`,
      [itemId, req.user.id]
    );

    if (itemCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    await pool.query('DELETE FROM shopping_list_items WHERE id = $1', [itemId]);

    res.json({ deleted: true });

  } catch (err) {
    console.error('Delete item error:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Complete shopping list
router.put('/lists/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE shopping_lists 
       SET status = 'completed', completed_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    // Add purchased items to pantry
    const items = await pool.query(
      `SELECT * FROM shopping_list_items WHERE list_id = $1 AND checked = true`,
      [id]
    );

    for (const item of items.rows) {
      await pool.query(
        `INSERT INTO pantry_items (user_id, product_id, upc, custom_name, quantity)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, item.product_id, item.upc, item.custom_name, item.quantity]
      );
    }

    res.json({
      list: result.rows[0],
      items_added_to_pantry: items.rows.length
    });

  } catch (err) {
    console.error('Complete list error:', err);
    res.status(500).json({ error: 'Failed to complete list' });
  }
});

// Generate smart shopping list from velocity predictions
router.post('/lists/generate', async (req, res) => {
  try {
    const { days_ahead = 14 } = req.body;
    const daysNum = parseInt(days_ahead) || 14;

    // Create new list
    const listResult = await pool.query(
      `INSERT INTO shopping_lists (user_id, name)
       VALUES ($1, $2)
       RETURNING *`,
      [req.user.id, `Smart List - ${new Date().toLocaleDateString()}`]
    );

    const listId = listResult.rows[0].id;
    let itemsAdded = 0;
    let listType = 'velocity';

    // 1. Try velocity-based predictions first
    const velocityResult = await pool.query(
      `SELECT cv.*, p.name, p.brand, p.category, p.typical_price
       FROM consumption_velocity cv
       JOIN products p ON cv.product_id = p.id
       WHERE cv.user_id = $1
       AND cv.next_predicted_empty <= NOW() + ($2 || ' days')::INTERVAL
       AND cv.confidence IN ('medium', 'high')`,
      [req.user.id, String(daysNum)]
    );

    for (const item of velocityResult.rows) {
      await pool.query(
        `INSERT INTO shopping_list_items (list_id, product_id, upc, predicted_need)
         VALUES ($1, $2, $3, true)`,
        [listId, item.product_id, item.upc]
      );
      itemsAdded++;
    }

    // 2. Fallback: if no velocity data, suggest healthier swaps for worst pantry items
    if (itemsAdded === 0) {
      listType = 'swap_suggestions';
      
      // Get user's worst pantry items (score < 50)
      const worstItems = await pool.query(
        `SELECT pi.upc, pi.product_id, p.name, p.brand, p.category, p.total_score, p.swaps_to
         FROM pantry_items pi
         JOIN products p ON pi.product_id = p.id
         WHERE pi.user_id = $1 AND pi.status = 'active'
         AND p.total_score IS NOT NULL AND p.total_score < 50
         ORDER BY p.total_score ASC
         LIMIT 8`,
        [req.user.id]
      );

      for (const item of worstItems.rows) {
        // Find the best swap for this item
        let swapProduct = null;

        if (item.swaps_to && item.swaps_to.length > 0) {
          const swapUpcs = Array.isArray(item.swaps_to) ? item.swaps_to : JSON.parse(item.swaps_to);
          const swapResult = await pool.query(
            `SELECT id, upc FROM products WHERE upc = ANY($1::text[]) ORDER BY total_score DESC LIMIT 1`,
            [swapUpcs]
          );
          if (swapResult.rows.length > 0) swapProduct = swapResult.rows[0];
        }

        if (!swapProduct && item.category) {
          const catResult = await pool.query(
            `SELECT id, upc FROM products 
             WHERE category = $1 AND total_score > $2 AND upc != $3
             ORDER BY total_score DESC LIMIT 1`,
            [item.category, item.total_score, item.upc]
          );
          if (catResult.rows.length > 0) swapProduct = catResult.rows[0];
        }

        if (swapProduct) {
          await pool.query(
            `INSERT INTO shopping_list_items (list_id, product_id, upc, custom_name, predicted_need)
             VALUES ($1, $2, $3, $4, false)`,
            [listId, swapProduct.id, swapProduct.upc, `Swap for: ${item.name}`]
          );
          itemsAdded++;
        }
      }

      // Update list name to reflect type
      if (itemsAdded > 0) {
        await pool.query(
          `UPDATE shopping_lists SET name = $1 WHERE id = $2`,
          [`Healthier Swaps - ${new Date().toLocaleDateString()}`, listId]
        );
      }
    }

    // 3. If still empty, delete the empty list
    if (itemsAdded === 0) {
      await pool.query('DELETE FROM shopping_lists WHERE id = $1', [listId]);
      return res.json({ 
        message: 'Not enough data to generate a smart list yet. Add items to your pantry and mark them as finished to build consumption patterns.',
        items: [],
        list_type: 'empty'
      });
    }

    // Get full list
    const fullList = await pool.query(
      `SELECT sli.*, p.name, p.brand, p.category, p.total_score, p.image_url
       FROM shopping_list_items sli
       LEFT JOIN products p ON sli.product_id = p.id
       WHERE sli.list_id = $1`,
      [listId]
    );

    res.status(201).json({
      ...listResult.rows[0],
      items: fullList.rows,
      list_type: listType,
      prediction_window_days: days_ahead
    });

  } catch (err) {
    console.error('Generate list error:', err);
    res.status(500).json({ error: 'Failed to generate smart list' });
  }
});

// Delete shopping list
router.delete('/lists/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM shopping_lists WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    res.json({ deleted: true });

  } catch (err) {
    console.error('Delete list error:', err);
    res.status(500).json({ error: 'Failed to delete list' });
  }
});

export default router;
