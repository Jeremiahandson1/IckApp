import express from 'express';
import pool from '../db/init.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// ============================================================
// POST /receipts/scan — Parse a receipt image with GPT-4o vision
// ============================================================
router.post('/scan', async (req, res) => {
  try {
    const { image_base64, image_url } = req.body;

    if (!image_base64 && !image_url) {
      return res.status(400).json({ error: 'image_base64 or image_url required' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: 'Receipt scanning not configured. Set OPENAI_API_KEY.' });
    }

    // Build image content for GPT-4o
    const imageContent = image_base64
      ? { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image_base64}` } }
      : { type: 'image_url', image_url: { url: image_url } };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: [
            imageContent,
            {
              type: 'text',
              text: `Extract all items from this receipt. Return ONLY valid JSON, no markdown. Format:
{
  "store_name": "Store Name or null",
  "store_address": "Address or null",
  "receipt_date": "YYYY-MM-DD or null",
  "subtotal": number or null,
  "tax": number or null,
  "total": number or null,
  "payment_method": "VISA/CASH/etc or null",
  "items": [
    {
      "line_text": "raw text from receipt line",
      "item_name": "cleaned product name",
      "quantity": 1,
      "unit_price": 3.99,
      "total_price": 3.99,
      "category": "produce|dairy|meat|bakery|snacks|beverages|frozen|pantry_staple|household|personal_care|other"
    }
  ]
}
Rules:
- Include EVERY purchased item, even if price is unclear
- unit_price = per-unit price, total_price = quantity × unit_price
- Skip subtotals, tax lines, change/tender lines
- For BOGO or discounts, use the actual price paid
- category should be your best guess from the list above
- item_name should be a clean, readable product name (not receipt shorthand)`
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI API error:', err);
      return res.status(502).json({ error: 'Receipt parsing failed. Try again.' });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response (strip markdown fences if present)
    let parsed;
    try {
      const cleaned = content.replace(/```json\s*|```\s*/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('Failed to parse GPT response:', content);
      return res.status(422).json({ error: 'Could not parse receipt. Try a clearer photo.', raw: content });
    }

    // Save receipt to DB
    const receiptResult = await pool.query(
      `INSERT INTO receipts (user_id, store_name, store_address, receipt_date, subtotal, tax, total, payment_method, raw_text)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        req.user.id,
        parsed.store_name,
        parsed.store_address,
        parsed.receipt_date,
        parsed.subtotal,
        parsed.tax,
        parsed.total,
        parsed.payment_method,
        content
      ]
    );

    const receipt = receiptResult.rows[0];

    // Save line items and try to match to products
    const items = [];
    for (const item of (parsed.items || [])) {
      // Try to match by name search
      let productId = null;
      let upc = null;
      let matchScore = 0;

      if (item.item_name) {
        // Search products table for closest match
        const nameWords = item.item_name.split(/\s+/).filter(w => w.length > 2);
        if (nameWords.length > 0) {
          const searchTerm = nameWords.slice(0, 3).join(' & ');
          try {
            const matchResult = await pool.query(
              `SELECT id, upc, name, brand, total_score,
                      ts_rank(to_tsvector('english', name || ' ' || COALESCE(brand, '')), plainto_tsquery('english', $1)) as rank
               FROM products
               WHERE to_tsvector('english', name || ' ' || COALESCE(brand, '')) @@ plainto_tsquery('english', $1)
               ORDER BY rank DESC
               LIMIT 1`,
              [searchTerm]
            );
            if (matchResult.rows.length > 0) {
              productId = matchResult.rows[0].id;
              upc = matchResult.rows[0].upc;
              matchScore = matchResult.rows[0].rank;
            }
          } catch { /* full text search may fail on short terms */ }
        }
      }

      const itemResult = await pool.query(
        `INSERT INTO receipt_items (receipt_id, line_text, item_name, quantity, unit_price, total_price, upc, product_id, matched, category)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          receipt.id,
          item.line_text,
          item.item_name,
          item.quantity || 1,
          item.unit_price,
          item.total_price,
          upc,
          productId,
          productId !== null,
          item.category || 'other'
        ]
      );

      const saved = itemResult.rows[0];
      // Attach product info if matched
      if (productId) {
        const prodResult = await pool.query(
          'SELECT name, brand, total_score, image_url FROM products WHERE id = $1',
          [productId]
        );
        saved.product = prodResult.rows[0] || null;
      }
      saved.match_confidence = matchScore > 0.1 ? 'high' : matchScore > 0 ? 'low' : 'none';

      items.push(saved);
    }

    // Update sighting if store identified
    if (parsed.store_name) {
      await pool.query(
        `UPDATE users SET last_store = $1, updated_at = NOW() WHERE id = $2`,
        [parsed.store_name, req.user.id]
      ).catch(() => {});
    }

    res.json({
      receipt,
      items,
      summary: {
        total_items: items.length,
        matched: items.filter(i => i.matched).length,
        unmatched: items.filter(i => !i.matched).length,
        total_spent: parsed.total
      }
    });

  } catch (err) {
    console.error('Receipt scan error:', err);
    res.status(500).json({ error: 'Failed to scan receipt' });
  }
});

// ============================================================
// PUT /receipts/:id/items/:itemId — Update a receipt item match
// (user corrects product match or enters UPC manually)
// ============================================================
router.put('/:id/items/:itemId', async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { upc, product_id, item_name, total_price, quantity } = req.body;

    // Verify receipt belongs to user
    const receiptCheck = await pool.query(
      'SELECT id FROM receipts WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (receiptCheck.rows.length === 0) return res.status(404).json({ error: 'Receipt not found' });

    // If UPC provided, look up product
    let resolvedProductId = product_id || null;
    let resolvedUpc = upc || null;

    if (upc && !product_id) {
      const prod = await pool.query('SELECT id FROM products WHERE upc = $1', [upc]);
      if (prod.rows.length > 0) resolvedProductId = prod.rows[0].id;
    }

    const result = await pool.query(
      `UPDATE receipt_items SET
         item_name = COALESCE($1, item_name),
         total_price = COALESCE($2, total_price),
         quantity = COALESCE($3, quantity),
         upc = COALESCE($4, upc),
         product_id = COALESCE($5, product_id),
         matched = $6
       WHERE id = $7 AND receipt_id = $8
       RETURNING *`,
      [item_name, total_price, quantity, resolvedUpc, resolvedProductId, resolvedProductId !== null, itemId, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json(result.rows[0]);

  } catch (err) {
    console.error('Update receipt item error:', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// ============================================================
// POST /receipts/:id/add-to-pantry — Confirm items into pantry
// ============================================================
router.post('/:id/add-to-pantry', async (req, res) => {
  try {
    const { id } = req.params;
    const { item_ids } = req.body; // optional: specific items to add (all if omitted)

    // Verify receipt
    const receiptResult = await pool.query(
      'SELECT * FROM receipts WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (receiptResult.rows.length === 0) return res.status(404).json({ error: 'Receipt not found' });
    const receipt = receiptResult.rows[0];

    // Get items to add
    let itemQuery = `SELECT * FROM receipt_items WHERE receipt_id = $1 AND added_to_pantry = false`;
    const params = [id];

    if (item_ids && Array.isArray(item_ids) && item_ids.length > 0) {
      itemQuery += ` AND id = ANY($2::int[])`;
      params.push(item_ids);
    }

    const itemsResult = await pool.query(itemQuery, params);
    const added = [];

    for (const item of itemsResult.rows) {
      // Add to pantry with price
      const pantryResult = await pool.query(
        `INSERT INTO pantry_items (user_id, product_id, upc, custom_name, quantity, price_paid, store_name, receipt_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          req.user.id,
          item.product_id,
          item.upc,
          item.product_id ? null : item.item_name, // use custom_name only if no product match
          item.quantity || 1,
          item.total_price,
          receipt.store_name,
          receipt.id
        ]
      );

      // Mark as added
      await pool.query(
        'UPDATE receipt_items SET added_to_pantry = true WHERE id = $1',
        [item.id]
      );

      added.push(pantryResult.rows[0]);
    }

    res.json({
      added: added.length,
      items: added,
      store: receipt.store_name,
      total_spent: itemsResult.rows.reduce((sum, i) => sum + parseFloat(i.total_price || 0), 0)
    });

  } catch (err) {
    console.error('Add to pantry error:', err);
    res.status(500).json({ error: 'Failed to add items to pantry' });
  }
});

// ============================================================
// BUDGET / SPENDING ENDPOINTS (must be before /:id catch-all)
// ============================================================

// GET /receipts/budget/summary — Spending overview
router.get('/budget/summary', async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period) || 30;

    const [totalSpent, avgPerTrip, tripCount, topStores, byCategory, recentTrend] = await Promise.all([
      // Total spent in period
      pool.query(
        `SELECT COALESCE(SUM(total), 0) as total_spent, COUNT(*) as receipt_count
         FROM receipts WHERE user_id = $1 AND created_at >= NOW() - ($2 || ' days')::INTERVAL`,
        [req.user.id, String(days)]
      ),
      // Average per trip
      pool.query(
        `SELECT COALESCE(AVG(total), 0) as avg_per_trip
         FROM receipts WHERE user_id = $1 AND total IS NOT NULL AND created_at >= NOW() - ($2 || ' days')::INTERVAL`,
        [req.user.id, String(days)]
      ),
      // Trip count by store
      pool.query(
        `SELECT store_name, COUNT(*) as visits, SUM(total) as total_spent
         FROM receipts WHERE user_id = $1 AND created_at >= NOW() - ($2 || ' days')::INTERVAL
         GROUP BY store_name ORDER BY total_spent DESC LIMIT 5`,
        [req.user.id, String(days)]
      ),
      // Top stores
      pool.query(
        `SELECT store_name, COUNT(*) as visits
         FROM receipts WHERE user_id = $1
         GROUP BY store_name ORDER BY visits DESC LIMIT 5`,
        [req.user.id]
      ),
      // Spending by category
      pool.query(
        `SELECT ri.category, SUM(ri.total_price) as total, COUNT(*) as item_count
         FROM receipt_items ri
         JOIN receipts r ON ri.receipt_id = r.id
         WHERE r.user_id = $1 AND r.created_at >= NOW() - ($2 || ' days')::INTERVAL
         GROUP BY ri.category ORDER BY total DESC`,
        [req.user.id, String(days)]
      ),
      // Weekly spending trend (last 8 weeks)
      pool.query(
        `SELECT date_trunc('week', receipt_date) as week, SUM(total) as total_spent, COUNT(*) as trips
         FROM receipts
         WHERE user_id = $1 AND receipt_date >= NOW() - INTERVAL '8 weeks'
         GROUP BY week ORDER BY week ASC`,
        [req.user.id]
      )
    ]);

    res.json({
      period_days: days,
      total_spent: parseFloat(totalSpent.rows[0].total_spent),
      receipt_count: parseInt(totalSpent.rows[0].receipt_count),
      avg_per_trip: parseFloat(avgPerTrip.rows[0].avg_per_trip),
      top_stores: tripCount.rows,
      favorite_stores: topStores.rows,
      by_category: byCategory.rows,
      weekly_trend: recentTrend.rows
    });

  } catch (err) {
    console.error('Budget summary error:', err);
    res.status(500).json({ error: 'Failed to load budget summary' });
  }
});

// GET /receipts/budget/items — Price history for items (see how prices change)
router.get('/budget/items', async (req, res) => {
  try {
    const { upc, limit = 10 } = req.query;

    if (upc) {
      // Price history for specific product
      const result = await pool.query(
        `SELECT ri.total_price, ri.quantity, ri.unit_price,
                r.store_name, r.receipt_date
         FROM receipt_items ri
         JOIN receipts r ON ri.receipt_id = r.id
         WHERE r.user_id = $1 AND ri.upc = $2
         ORDER BY r.receipt_date DESC
         LIMIT 20`,
        [req.user.id, upc]
      );
      return res.json({
        upc,
        price_history: result.rows,
        avg_price: result.rows.length > 0
          ? result.rows.reduce((s, r) => s + parseFloat(r.total_price || 0), 0) / result.rows.length
          : null
      });
    }

    // Most expensive items (top spends)
    const result = await pool.query(
      `SELECT ri.item_name, ri.upc, p.name as product_name, p.brand,
              SUM(ri.total_price) as total_spent,
              COUNT(*) as purchase_count,
              AVG(ri.total_price) as avg_price
       FROM receipt_items ri
       JOIN receipts r ON ri.receipt_id = r.id
       LEFT JOIN products p ON ri.product_id = p.id
       WHERE r.user_id = $1
       GROUP BY ri.item_name, ri.upc, p.name, p.brand
       ORDER BY total_spent DESC
       LIMIT $2`,
      [req.user.id, parseInt(limit)]
    );

    res.json({ top_items: result.rows });

  } catch (err) {
    console.error('Budget items error:', err);
    res.status(500).json({ error: 'Failed to load item prices' });
  }
});

// GET /receipts/budget/health-cost — "Cost of eating healthy" analysis
router.get('/budget/health-cost', async (req, res) => {
  try {
    // Compare spending on high-score vs low-score products
    const result = await pool.query(
      `SELECT 
         CASE 
           WHEN p.total_score >= 70 THEN 'healthy'
           WHEN p.total_score >= 40 THEN 'moderate'
           ELSE 'unhealthy'
         END as health_tier,
         COUNT(*) as item_count,
         SUM(ri.total_price) as total_spent,
         AVG(ri.total_price) as avg_price
       FROM receipt_items ri
       JOIN receipts r ON ri.receipt_id = r.id
       JOIN products p ON ri.product_id = p.id
       WHERE r.user_id = $1 AND p.total_score IS NOT NULL
       GROUP BY health_tier
       ORDER BY health_tier`,
      [req.user.id]
    );

    // Potential savings: if you swapped unhealthy for healthy alternatives
    const unhealthySpend = result.rows.find(r => r.health_tier === 'unhealthy');

    res.json({
      by_health_tier: result.rows,
      insight: unhealthySpend && parseFloat(unhealthySpend.total_spent) > 0
        ? `You've spent $${parseFloat(unhealthySpend.total_spent).toFixed(2)} on low-score items. Swapping to healthier alternatives could improve your diet without changing your budget.`
        : 'Scan more receipts to see your health-cost breakdown.'
    });

  } catch (err) {
    console.error('Health cost error:', err);
    res.status(500).json({ error: 'Failed to analyze health costs' });
  }
});

// ============================================================
// GET /receipts — List user's receipts
// ============================================================
router.get('/', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT r.*,
              (SELECT COUNT(*) FROM receipt_items ri WHERE ri.receipt_id = r.id) as item_count,
              (SELECT COUNT(*) FROM receipt_items ri WHERE ri.receipt_id = r.id AND ri.matched = true) as matched_count
       FROM receipts r
       WHERE r.user_id = $1
       ORDER BY r.receipt_date DESC NULLS LAST, r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, parseInt(limit), parseInt(offset)]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load receipts' });
  }
});

// ============================================================
// GET /receipts/:id — Receipt detail with items
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const receiptResult = await pool.query(
      'SELECT * FROM receipts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (receiptResult.rows.length === 0) return res.status(404).json({ error: 'Receipt not found' });

    const itemsResult = await pool.query(
      `SELECT ri.*, p.name as product_name, p.brand, p.total_score, p.image_url
       FROM receipt_items ri
       LEFT JOIN products p ON ri.product_id = p.id
       WHERE ri.receipt_id = $1
       ORDER BY ri.id ASC`,
      [req.params.id]
    );

    res.json({
      ...receiptResult.rows[0],
      items: itemsResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load receipt' });
  }
});

// ============================================================
// DELETE /receipts/:id — Delete a receipt
// ============================================================
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM receipts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete receipt' });
  }
});

export default router;
