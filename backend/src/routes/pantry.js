import express from 'express';
import pool from '../db/init.js';
import { authenticateToken } from '../middleware/auth.js';
import { requirePremium } from '../middleware/subscription.js';

const router = express.Router();

// Basic pantry CRUD is free (creates stickiness)
router.use(authenticateToken);

// Get all pantry items for user
router.get('/', async (req, res) => {
  try {
    const { status = 'active' } = req.query;

    const result = await pool.query(
      `SELECT pi.*, p.name, p.brand, p.category, p.total_score, p.image_url, p.harmful_ingredients_found
       FROM pantry_items pi
       LEFT JOIN products p ON pi.product_id = p.id
       WHERE pi.user_id = $1 AND pi.status = $2
       ORDER BY pi.added_at DESC`,
      [req.user.id, status]
    );

    // Normalize harmful_ingredients_found — scoring engine stores objects
    // with {name, category, severity, ...} but Pantry list renders them as text.
    // Convert to string array for safe rendering. Detail view (ProductResult) 
    // fetches its own data and handles objects via IngredientCard.
    const items = result.rows.map(row => {
      if (row.harmful_ingredients_found) {
        const raw = typeof row.harmful_ingredients_found === 'string'
          ? JSON.parse(row.harmful_ingredients_found)
          : row.harmful_ingredients_found;
        row.harmful_ingredients_found = raw.map(h => 
          typeof h === 'string' ? h : (h.name || 'Unknown')
        );
      }
      return row;
    });

    res.json(items);

  } catch (err) {
    console.error('Pantry fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch pantry' });
  }
});

// Add item to pantry
router.post('/', async (req, res) => {
  try {
    const { upc, product_id, custom_name, quantity = 1 } = req.body;

    if (!upc && !product_id) {
      return res.status(400).json({ error: 'UPC or product_id required' });
    }

    // Get product info
    let productId = product_id;
    let productUpc = upc;

    if (upc && !product_id) {
      const productResult = await pool.query(
        'SELECT id FROM products WHERE upc = $1',
        [upc]
      );
      if (productResult.rows.length > 0) {
        productId = productResult.rows[0].id;
      }
    }

    if (product_id && !upc) {
      const productResult = await pool.query(
        'SELECT upc FROM products WHERE id = $1',
        [product_id]
      );
      if (productResult.rows.length > 0) {
        productUpc = productResult.rows[0].upc;
      }
    }

    const result = await pool.query(
      `INSERT INTO pantry_items (user_id, product_id, upc, custom_name, quantity)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.id, productId, productUpc, custom_name, quantity]
    );

    // Get full product info
    const fullResult = await pool.query(
      `SELECT pi.*, p.name, p.brand, p.category, p.total_score, p.image_url
       FROM pantry_items pi
       LEFT JOIN products p ON pi.product_id = p.id
       WHERE pi.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json(fullResult.rows[0]);

  } catch (err) {
    console.error('Pantry add error:', err);
    res.status(500).json({ error: 'Failed to add to pantry' });
  }
});

// Bulk add items (pantry audit)
router.post('/bulk', async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Items array required' });
    }

    const added = [];
    
    for (const item of items) {
      const { upc, custom_name, quantity = 1 } = item;

      // Get product ID
      let productId = null;
      const productResult = await pool.query(
        'SELECT id FROM products WHERE upc = $1',
        [upc]
      );
      if (productResult.rows.length > 0) {
        productId = productResult.rows[0].id;
      }

      const result = await pool.query(
        `INSERT INTO pantry_items (user_id, product_id, upc, custom_name, quantity)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [req.user.id, productId, upc, custom_name, quantity]
      );

      added.push(result.rows[0]);
    }

    res.status(201).json({ added: added.length, items: added });

  } catch (err) {
    console.error('Bulk pantry add error:', err);
    res.status(500).json({ error: 'Failed to bulk add to pantry' });
  }
});

// Mark item as finished (for velocity tracking)
router.put('/:id/finish', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the item first
    const itemResult = await pool.query(
      'SELECT * FROM pantry_items WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = itemResult.rows[0];
    const daysToConsume = Math.ceil(
      (new Date() - new Date(item.added_at)) / (1000 * 60 * 60 * 24)
    );

    // Update item
    const result = await pool.query(
      `UPDATE pantry_items 
       SET status = 'finished', finished_at = NOW(), days_to_consume = $1
       WHERE id = $2
       RETURNING *`,
      [daysToConsume, id]
    );

    // Update velocity tracking (including next_predicted_empty for smart shopping lists)
    const velocityResult = await pool.query(
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
      [req.user.id, item.product_id, item.upc, daysToConsume]
    );

    // Update user engagement
    await pool.query(
      `UPDATE user_engagement 
       SET products_with_velocity = (
         SELECT COUNT(*) FROM consumption_velocity WHERE user_id = $1 AND consumption_count >= 2
       ),
       updated_at = NOW()
       WHERE user_id = $1`,
      [req.user.id]
    );

    res.json({
      item: result.rows[0],
      velocity: velocityResult.rows[0],
      days_to_consume: daysToConsume
    });

  } catch (err) {
    console.error('Finish item error:', err);
    res.status(500).json({ error: 'Failed to finish item' });
  }
});

// Update item quantity
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, status } = req.body;

    const result = await pool.query(
      `UPDATE pantry_items 
       SET quantity = COALESCE($1, quantity),
           status = COALESCE($2, status)
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [quantity, status, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.error('Update item error:', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Delete item
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM pantry_items WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ deleted: true, item: result.rows[0] });

  } catch (err) {
    console.error('Delete item error:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Get pantry audit/damage report
// Pantry health audit — premium only
router.get('/audit', requirePremium, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pi.*, p.name, p.brand, p.category, p.total_score, p.image_url, p.harmful_ingredients_found
       FROM pantry_items pi
       LEFT JOIN products p ON pi.product_id = p.id
       WHERE pi.user_id = $1 AND pi.status = 'active'
       ORDER BY p.total_score ASC`,
      [req.user.id]
    );

    const items = result.rows.map(row => {
      if (row.harmful_ingredients_found) {
        const raw = typeof row.harmful_ingredients_found === 'string'
          ? JSON.parse(row.harmful_ingredients_found)
          : row.harmful_ingredients_found;
        row.harmful_ingredients_found = raw.map(h => 
          typeof h === 'string' ? h : (h.name || 'Unknown')
        );
      }
      return row;
    });
    
    // Calculate stats
    const totalItems = items.length;
    const itemsWithScore = items.filter(i => i.total_score !== null);
    const avgScore = itemsWithScore.length > 0
      ? Math.round(itemsWithScore.reduce((sum, i) => sum + i.total_score, 0) / itemsWithScore.length)
      : 0;

    const breakdown = {
      excellent: items.filter(i => i.total_score >= 86).length,
      good: items.filter(i => i.total_score >= 71 && i.total_score < 86).length,
      okay: items.filter(i => i.total_score >= 51 && i.total_score < 71).length,
      poor: items.filter(i => i.total_score >= 31 && i.total_score < 51).length,
      avoid: items.filter(i => i.total_score < 31).length
    };

    // Get worst offenders (items to swap first)
    const worstOffenders = items
      .filter(i => i.total_score !== null && i.total_score < 50)
      .slice(0, 5);

    // Collect all harmful ingredients found
    const harmfulFound = {};
    items.forEach(item => {
      if (item.harmful_ingredients_found) {
        const found = typeof item.harmful_ingredients_found === 'string'
          ? JSON.parse(item.harmful_ingredients_found)
          : item.harmful_ingredients_found;
        found.forEach(h => {
          // Handle both string format ("Red 40") and object format ({name: "Red 40", ...})
          const name = typeof h === 'string' ? h : (h.name || 'Unknown');
          const entry = typeof h === 'string' ? { name: h } : h;
          if (!harmfulFound[name]) {
            harmfulFound[name] = { ...entry, count: 0, products: [] };
          }
          harmfulFound[name].count++;
          harmfulFound[name].products.push(item.name);
        });
      }
    });

    const topHarmfulIngredients = Object.values(harmfulFound)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({
      total_items: totalItems,
      average_score: avgScore,
      breakdown,
      worst_offenders: worstOffenders,
      top_harmful_ingredients: topHarmfulIngredients,
      items
    });

  } catch (err) {
    console.error('Pantry audit error:', err);
    res.status(500).json({ error: 'Failed to generate audit' });
  }
});

export default router;
