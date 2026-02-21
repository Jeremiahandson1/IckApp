/**
 * Ick Velocity Alert Scheduler
 *
 * Runs once at startup (after 5min delay) then daily at 8:00 AM local time.
 * Queries all users with push subscriptions whose pantry items are predicted
 * to run out within the next 3 days, then sends a personalized push notification.
 *
 * Notification cadence:
 *   - Only sends if we haven't notified this user in the last 20 hours
 *   - Only sends if they have medium/high confidence velocity data
 *   - Groups multiple running-low items into a single notification
 *
 * Tracked in: velocity_alert_log table (auto-created on first run)
 */

import pool from '../db/init.js';
import { sendPush } from './pushNotifications.js';

const ALERT_WINDOW_DAYS = 3;      // notify when item runs out within 3 days
const COOLDOWN_HOURS = 20;        // don't re-notify same user within 20 hours

/**
 * Ensure the alert log table exists
 */
async function ensureAlertLogTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS velocity_alert_log (
      id SERIAL PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      upcs_alerted JSONB DEFAULT '[]',
      sent_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_velocity_alert_log_user ON velocity_alert_log(user_id, sent_at DESC);
  `);
}

/**
 * Run the velocity alert job once
 */
export async function runVelocityAlerts() {
  try {
    await ensureAlertLogTable();

    // Get all users with push subscriptions who haven't been alerted recently
    const users = await pool.query(`
      SELECT u.id, u.name, u.push_subscription
      FROM users u
      WHERE u.push_subscription IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM velocity_alert_log val
        WHERE val.user_id = u.id
        AND val.sent_at > NOW() - INTERVAL '${COOLDOWN_HOURS} hours'
      )
    `);

    if (users.rows.length === 0) {
      console.log('[VelocityAlerts] No eligible users to notify');
      return;
    }

    let sent = 0;
    let skipped = 0;

    for (const user of users.rows) {
      try {
        // Get their items running low within the alert window
        const runningLow = await pool.query(`
          SELECT cv.upc, cv.next_predicted_empty, cv.avg_days_to_consume,
                 p.name, p.brand
          FROM consumption_velocity cv
          JOIN products p ON cv.product_id = p.id
          WHERE cv.user_id = $1
          AND cv.confidence IN ('medium', 'high')
          AND cv.next_predicted_empty IS NOT NULL
          AND cv.next_predicted_empty <= NOW() + INTERVAL '${ALERT_WINDOW_DAYS} days'
          AND cv.next_predicted_empty > NOW()
          ORDER BY cv.next_predicted_empty ASC
          LIMIT 5
        `, [user.id]);

        if (runningLow.rows.length === 0) {
          skipped++;
          continue;
        }

        const items = runningLow.rows;
        const firstName = user.name?.split(' ')[0] || 'Hey';

        // Build notification text
        let title, body;
        if (items.length === 1) {
          const item = items[0];
          const daysLeft = Math.ceil(
            (new Date(item.next_predicted_empty) - new Date()) / (1000 * 60 * 60 * 24)
          );
          const productName = item.name?.split(' ').slice(0, 3).join(' ') || 'An item';
          title = daysLeft <= 1 ? `${productName} runs out today` : `${productName} runs out in ${daysLeft} days`;
          body = daysLeft <= 1
            ? `Time to add it to your shopping list.`
            : `Add it to your list before you run out.`;
        } else {
          title = `${items.length} pantry items running low`;
          const names = items.slice(0, 2).map(i => i.name?.split(' ')[0]).filter(Boolean);
          body = `${names.join(', ')}${items.length > 2 ? ` and ${items.length - 2} more` : ''} — check your pantry.`;
        }

        const outcome = await sendPush(user.push_subscription, {
          title,
          body,
          tag: 'velocity-alert',
          url: '/pantry',
          data: {
            type: 'velocity_alert',
            upcs: items.map(i => i.upc),
          },
        });

        if (outcome === true) {
          // Log the alert
          await pool.query(
            `INSERT INTO velocity_alert_log (user_id, upcs_alerted) VALUES ($1, $2)`,
            [user.id, JSON.stringify(items.map(i => i.upc))]
          );
          sent++;
        } else if (outcome === 'expired') {
          // Clean up expired subscription
          await pool.query(
            'UPDATE users SET push_subscription = NULL WHERE id = $1',
            [user.id]
          );
        }
      } catch (userErr) {
        console.error(`[VelocityAlerts] Error processing user ${user.id}:`, userErr.message);
      }
    }

    console.log(`[VelocityAlerts] Done — sent: ${sent}, skipped (no alerts): ${skipped}`);
  } catch (err) {
    console.error('[VelocityAlerts] Job error:', err);
  }
}

/**
 * Schedule velocity alerts
 * - Runs once 5 minutes after startup (catches anyone who just logged in)
 * - Then runs every 24 hours
 */
export function startVelocityAlertScheduler() {
  // Initial run after 5 min delay
  setTimeout(async () => {
    console.log('[VelocityAlerts] Running initial check...');
    await runVelocityAlerts();

    // Then schedule daily (every 24 hours)
    setInterval(async () => {
      console.log('[VelocityAlerts] Running daily check...');
      await runVelocityAlerts();
    }, 24 * 60 * 60 * 1000);

  }, 5 * 60 * 1000);

  console.log('▸ Velocity alert scheduler started (first run in 5 min, then daily)');
}
