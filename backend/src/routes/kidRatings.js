import express from 'express';
import pool from '../db/init.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/products/kid-ratings/:upc — community + user ratings
router.get('/:upc', optionalAuth, async (req, res) => {
  try {
    const { upc } = req.params;

    const avgResult = await pool.query(
      `SELECT ROUND(AVG(rating), 1) as avg_rating,
              COUNT(*) as total_ratings,
              COUNT(CASE WHEN would_eat_again THEN 1 END) as would_eat_again_count
       FROM kid_ratings WHERE upc = $1`,
      [upc]
    );

    let myRatings = [];
    if (req.user) {
      const myResult = await pool.query(
        'SELECT * FROM kid_ratings WHERE user_id = $1 AND upc = $2 ORDER BY created_at DESC',
        [req.user.id, upc]
      );
      myRatings = myResult.rows;
    }

    const avg = avgResult.rows[0];
    res.json({
      community: {
        avg_rating: parseFloat(avg.avg_rating) || null,
        total_ratings: parseInt(avg.total_ratings),
        eat_again_pct: avg.total_ratings > 0
          ? Math.round((avg.would_eat_again_count / avg.total_ratings) * 100)
          : null
      },
      my_ratings: myRatings
    });
  } catch (err) {
    console.error('Kid ratings fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch kid ratings' });
  }
});

// POST /api/products/kid-ratings — add or update a rating
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { upc, kid_name, kid_age, rating, would_eat_again, notes } = req.body;
    if (!upc || !kid_name || !rating) {
      return res.status(400).json({ error: 'upc, kid_name, and rating required' });
    }
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be 1–5' });
    }

    const productResult = await pool.query('SELECT id FROM products WHERE upc = $1', [upc]);
    const productId = productResult.rows[0]?.id || null;

    const result = await pool.query(
      `INSERT INTO kid_ratings (user_id, product_id, upc, kid_name, kid_age, rating, would_eat_again, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, upc, kid_name) DO UPDATE SET
         kid_age = COALESCE($5, kid_ratings.kid_age),
         rating = $6,
         would_eat_again = COALESCE($7, kid_ratings.would_eat_again),
         notes = COALESCE($8, kid_ratings.notes),
         created_at = NOW()
       RETURNING *`,
      [req.user.id, productId, upc, kid_name, kid_age, rating, would_eat_again, notes]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Kid rating add error:', err);
    res.status(500).json({ error: 'Failed to save kid rating' });
  }
});

// DELETE /api/products/kid-ratings/:id — remove a rating
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM kid_ratings WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete rating' });
  }
});

export default router;
