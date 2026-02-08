import express from 'express';
import pool from '../db/init.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get overall progress dashboard
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    // Get user engagement data
    const engagementResult = await pool.query(
      `SELECT * FROM user_engagement WHERE user_id = $1`,
      [req.user.id]
    );

    const engagement = engagementResult.rows[0] || {};

    // Get pantry stats
    const pantryResult = await pool.query(
      `SELECT 
         COUNT(*) as total_items,
         ROUND(AVG(p.total_score)) as avg_score,
         COUNT(CASE WHEN p.total_score >= 86 THEN 1 END) as excellent_count,
         COUNT(CASE WHEN p.total_score >= 71 AND p.total_score < 86 THEN 1 END) as good_count,
         COUNT(CASE WHEN p.total_score >= 51 AND p.total_score < 71 THEN 1 END) as okay_count,
         COUNT(CASE WHEN p.total_score >= 31 AND p.total_score < 51 THEN 1 END) as poor_count,
         COUNT(CASE WHEN p.total_score < 31 THEN 1 END) as avoid_count
       FROM pantry_items pi
       JOIN products p ON pi.product_id = p.id
       WHERE pi.user_id = $1 AND pi.status = 'active'`,
      [req.user.id]
    );

    const pantryStats = pantryResult.rows[0];

    // Get swap stats
    const swapResult = await pool.query(
      `SELECT 
         COUNT(*) as total_swaps,
         COUNT(CASE WHEN purchased THEN 1 END) as purchased_swaps,
         COALESCE(SUM(tp.total_score - fp.total_score), 0) as total_score_improvement
       FROM swap_clicks sc
       LEFT JOIN products fp ON sc.from_product_id = fp.id
       LEFT JOIN products tp ON sc.to_product_id = tp.id
       WHERE sc.user_id = $1`,
      [req.user.id]
    );

    const swapStats = swapResult.rows[0];

    // Get recipe stats
    const recipeResult = await pool.query(
      `SELECT 
         COUNT(*) as total_viewed,
         COUNT(CASE WHEN made_it THEN 1 END) as total_made
       FROM user_recipes
       WHERE user_id = $1`,
      [req.user.id]
    );

    const recipeStats = recipeResult.rows[0];

    // Calculate health score (0-100)
    const pantryScore = parseInt(pantryStats.avg_score) || 50;
    const swapRate = swapStats.total_swaps > 0 
      ? (swapStats.purchased_swaps / swapStats.total_swaps) * 100 
      : 0;
    const engagementScore = Math.min(100, 
      (engagement.total_products_scanned || 0) * 2 +
      (engagement.total_swaps_clicked || 0) * 5 +
      (engagement.total_recipes_viewed || 0) * 3
    );

    const healthScore = Math.round(
      pantryScore * 0.5 +
      swapRate * 0.3 +
      engagementScore * 0.2
    );

    // Get weekly trend
    const trendResult = await pool.query(
      `SELECT 
         DATE_TRUNC('week', pi.added_at) as week,
         ROUND(AVG(p.total_score)) as avg_score
       FROM pantry_items pi
       JOIN products p ON pi.product_id = p.id
       WHERE pi.user_id = $1 AND pi.added_at >= NOW() - INTERVAL '8 weeks'
       GROUP BY DATE_TRUNC('week', pi.added_at)
       ORDER BY week`,
      [req.user.id]
    );

    res.json({
      health_score: healthScore,
      engagement: {
        products_scanned: engagement.total_products_scanned || 0,
        swaps_clicked: engagement.total_swaps_clicked || 0,
        swaps_purchased: engagement.total_swaps_purchased || 0,
        recipes_viewed: engagement.total_recipes_viewed || 0
      },
      pantry: {
        total_items: parseInt(pantryStats.total_items),
        average_score: parseInt(pantryStats.avg_score) || 0,
        breakdown: {
          excellent: parseInt(pantryStats.excellent_count),
          good: parseInt(pantryStats.good_count),
          okay: parseInt(pantryStats.okay_count),
          poor: parseInt(pantryStats.poor_count),
          avoid: parseInt(pantryStats.avoid_count)
        }
      },
      swaps: {
        total_explored: parseInt(swapStats.total_swaps),
        total_purchased: parseInt(swapStats.purchased_swaps),
        score_improvement: parseInt(swapStats.total_score_improvement)
      },
      recipes: {
        total_viewed: parseInt(recipeStats.total_viewed),
        total_made: parseInt(recipeStats.total_made)
      },
      weekly_trend: trendResult.rows
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// Get achievements/badges
router.get('/achievements', authenticateToken, async (req, res) => {
  try {
    const engagementResult = await pool.query(
      `SELECT * FROM user_engagement WHERE user_id = $1`,
      [req.user.id]
    );

    const e = engagementResult.rows[0] || {};

    // Get pantry avg score
    const pantryResult = await pool.query(
      `SELECT ROUND(AVG(p.total_score)) as avg_score
       FROM pantry_items pi
       JOIN products p ON pi.product_id = p.id
       WHERE pi.user_id = $1 AND pi.status = 'active'`,
      [req.user.id]
    );

    const avgScore = parseInt(pantryResult.rows[0]?.avg_score) || 0;

    const achievements = [
      {
        id: 'first_scan',
        name: 'First Scan',
        description: 'Scan your first product',
        icon: '📱',
        unlocked: (e.total_products_scanned || 0) >= 1
      },
      {
        id: 'scanner_10',
        name: 'Curious Scanner',
        description: 'Scan 10 products',
        icon: '🔍',
        unlocked: (e.total_products_scanned || 0) >= 10
      },
      {
        id: 'scanner_50',
        name: 'Super Scanner',
        description: 'Scan 50 products',
        icon: '⚡',
        unlocked: (e.total_products_scanned || 0) >= 50
      },
      {
        id: 'first_swap',
        name: 'First Swap',
        description: 'Explore your first swap',
        icon: '🔄',
        unlocked: (e.total_swaps_clicked || 0) >= 1
      },
      {
        id: 'swap_master',
        name: 'Swap Master',
        description: 'Purchase 5 healthier swaps',
        icon: '🏆',
        unlocked: (e.total_swaps_purchased || 0) >= 5
      },
      {
        id: 'home_chef',
        name: 'Home Chef',
        description: 'View 5 homemade recipes',
        icon: '👨‍🍳',
        unlocked: (e.total_recipes_viewed || 0) >= 5
      },
      {
        id: 'clean_pantry_70',
        name: 'Clean Pantry',
        description: 'Get pantry average above 70',
        icon: '🌿',
        unlocked: avgScore >= 70
      },
      {
        id: 'clean_pantry_85',
        name: 'Super Clean Pantry',
        description: 'Get pantry average above 85',
        icon: '🌟',
        unlocked: avgScore >= 85
      },
      {
        id: 'velocity_tracker',
        name: 'Velocity Tracker',
        description: 'Track consumption on 5 products',
        icon: '📈',
        unlocked: (e.products_with_velocity || 0) >= 5
      },
      {
        id: 'power_user',
        name: 'Power User',
        description: 'Scan 100 products',
        icon: '💪',
        unlocked: (e.total_products_scanned || 0) >= 100
      }
    ];

    const unlocked = achievements.filter(a => a.unlocked).length;
    const total = achievements.length;

    res.json({
      achievements,
      unlocked,
      total,
      percentage: Math.round((unlocked / total) * 100)
    });

  } catch (err) {
    console.error('Achievements error:', err);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// Get leaderboard stats (anonymized)
router.get('/leaderboard', authenticateToken, async (req, res) => {
  try {
    // Get top pantry scores
    const result = await pool.query(
      `SELECT 
         u.name,
         ROUND(AVG(p.total_score)) as avg_score,
         COUNT(pi.id) as item_count
       FROM users u
       JOIN pantry_items pi ON u.id = pi.user_id
       JOIN products p ON pi.product_id = p.id
       WHERE pi.status = 'active'
       GROUP BY u.id, u.name
       HAVING COUNT(pi.id) >= 5
       ORDER BY AVG(p.total_score) DESC
       LIMIT 10`
    );

    // Anonymize names
    const leaderboard = result.rows.map((row, index) => ({
      rank: index + 1,
      name: row.name ? row.name.charAt(0) + '***' : 'Anonymous',
      avg_score: parseInt(row.avg_score),
      item_count: parseInt(row.item_count)
    }));

    res.json(leaderboard);

  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;
