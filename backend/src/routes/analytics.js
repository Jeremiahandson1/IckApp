import express from 'express';
import pool from '../db/init.js';
import { optionalAuth, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Admin check helper
const requireAdmin = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch {
    res.status(403).json({ error: 'Admin check failed' });
  }
};

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

    const batch = events.slice(0, 50).map(evt => ({
      user_id: req.user?.id || null,
      event_type: evt.event_type,
      event_data: JSON.stringify(evt.event_data || {}),
      session_id: evt.session_id || null,
      created_at: evt.timestamp ? new Date(evt.timestamp) : new Date(),
    })).filter(e => e.event_type); // drop any events missing type

    if (batch.length === 0) return res.json({ tracked: 0 });

    const placeholders = batch.map((_, i) =>
      `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`
    ).join(', ');

    const params = batch.flatMap(e =>
      [e.user_id, e.event_type, e.event_data, e.session_id, e.created_at]
    );

    await pool.query(
      `INSERT INTO analytics_events (user_id, event_type, event_data, session_id, created_at)
       VALUES ${placeholders}`,
      params
    );

    res.json({ tracked: batch.length });
  } catch (err) {
    console.error('Batch analytics error:', err);
    res.json({ tracked: 0 });
  }
});

// Dashboard (admin only — #4 fix)
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
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
