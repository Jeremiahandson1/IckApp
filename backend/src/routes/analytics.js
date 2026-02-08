import express from 'express';
import pool from '../db/init.js';
import { optionalAuth, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Track an event (works for anonymous and logged-in users)
router.post('/event', optionalAuth, async (req, res) => {
  try {
    const { event_type, event_data, session_id } = req.body;
    if (!event_type) return res.status(400).json({ error: 'event_type required' });

    await pool.query(
      `INSERT INTO analytics_events (user_id, event_type, event_data, session_id)
       VALUES ($1, $2, $3, $4)`,
      [req.user?.id || null, event_type, JSON.stringify(event_data || {}), session_id || null]
    );

    res.json({ tracked: true });
  } catch (err) {
    // Analytics should never break the app
    console.error('Analytics error:', err);
    res.json({ tracked: false });
  }
});

// Batch track (for when user comes back online)
router.post('/batch', optionalAuth, async (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events)) return res.status(400).json({ error: 'events array required' });

    for (const evt of events.slice(0, 50)) { // Max 50 per batch
      await pool.query(
        `INSERT INTO analytics_events (user_id, event_type, event_data, session_id, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          req.user?.id || null,
          evt.event_type,
          JSON.stringify(evt.event_data || {}),
          evt.session_id || null,
          evt.timestamp ? new Date(evt.timestamp) : new Date()
        ]
      );
    }

    res.json({ tracked: events.length });
  } catch (err) {
    console.error('Batch analytics error:', err);
    res.json({ tracked: 0 });
  }
});

// Dashboard (admin/internal - shows funnel data)
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const [
      totalUsers,
      totalScans,
      totalSwaps,
      dailyActive,
      funnelData,
      topEvents
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query("SELECT COUNT(*) FROM analytics_events WHERE event_type = 'scan'"),
      pool.query("SELECT COUNT(*) FROM analytics_events WHERE event_type = 'swap_click'"),
      pool.query("SELECT COUNT(DISTINCT user_id) FROM analytics_events WHERE created_at >= CURRENT_DATE"),
      pool.query(`
        SELECT event_type, COUNT(*) as count
        FROM analytics_events
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY event_type
        ORDER BY count DESC
        LIMIT 20
      `),
      pool.query(`
        SELECT event_type, COUNT(*) as count,
               COUNT(DISTINCT user_id) as unique_users
        FROM analytics_events
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY event_type
        ORDER BY count DESC
        LIMIT 20
      `)
    ]);

    res.json({
      total_users: parseInt(totalUsers.rows[0].count),
      total_scans: parseInt(totalScans.rows[0].count),
      total_swaps: parseInt(totalSwaps.rows[0].count),
      daily_active: parseInt(dailyActive.rows[0].count),
      weekly_funnel: funnelData.rows,
      top_events_30d: topEvents.rows
    });
  } catch (err) {
    console.error('Analytics dashboard error:', err);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

export default router;
