/**
 * Ick Push Notification Service
 *
 * Handles server-side push delivery for both:
 *   - Web Push (PWA): W3C Web Push Protocol via VAPID + web-push library
 *   - Native (iOS/Android): Capacitor FCM device tokens — stub for future Firebase integration
 *
 * Setup:
 *   1. npm install web-push
 *   2. Generate VAPID keys once: node -e "const wp=require('web-push'); console.log(JSON.stringify(wp.generateVAPIDKeys()))"
 *   3. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL in Render env vars
 *
 * Usage:
 *   import { sendPush } from './services/pushNotifications.js';
 *   await sendPush(pushSubscriptionJson, { title: 'Ick Alert', body: '...' });
 */

import webpush from 'web-push';
import pool from '../db/init.js';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:hello@ick.app';

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[Push] VAPID keys not set — web push disabled. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars.');
    return false;
  }
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfigured = true;
  return true;
}

/**
 * Send a push notification to a single subscription object.
 * Returns true on success, false on failure.
 *
 * @param {Object} subscription - The push_subscription stored in users table
 * @param {Object} payload - { title, body, icon, badge, url, tag, data }
 */
export async function sendPush(subscription, payload) {
  if (!subscription) return false;

  const sub = typeof subscription === 'string' ? JSON.parse(subscription) : subscription;

  // Native push token (Capacitor FCM) — not yet implemented server-side
  // Would require Firebase Admin SDK + FCM send API
  if (sub.type === 'native') {
    console.log('[Push] Native FCM push not yet implemented — token:', sub.token?.slice(0, 20) + '...');
    return false;
  }

  // Web Push (PWA)
  if (!ensureVapid()) return false;
  if (!sub.endpoint) return false;

  try {
    await webpush.sendNotification(
      sub,
      JSON.stringify({
        title: payload.title || 'Ick',
        body: payload.body || '',
        icon: payload.icon || '/icons/icon-192.png',
        badge: payload.badge || '/icons/badge-72.png',
        tag: payload.tag || 'ick-alert',
        url: payload.url || '/pantry',
        data: payload.data || {},
      }),
      { TTL: 60 * 60 * 24 } // 24h TTL — if device is offline, retry for 24h
    );
    return true;
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription expired — clean it up
      console.log('[Push] Subscription expired, removing from DB');
      return 'expired';
    }
    console.error('[Push] Send error:', err.message);
    return false;
  }
}

/**
 * Send push to a user by user ID.
 * Fetches their push_subscription from DB automatically.
 *
 * @param {string} userId
 * @param {Object} payload - { title, body, url, tag, data }
 * @returns {boolean|string} true=sent, false=failed, 'no_sub'=no subscription on file
 */
export async function sendPushToUser(userId, payload) {
  try {
    const result = await pool.query(
      'SELECT push_subscription FROM users WHERE id = $1',
      [userId]
    );

    if (!result.rows[0]?.push_subscription) return 'no_sub';

    const outcome = await sendPush(result.rows[0].push_subscription, payload);

    // Clean up expired subscriptions
    if (outcome === 'expired') {
      await pool.query(
        'UPDATE users SET push_subscription = NULL WHERE id = $1',
        [userId]
      );
    }

    return outcome;
  } catch (err) {
    console.error('[Push] sendPushToUser error:', err);
    return false;
  }
}

/**
 * Broadcast push to multiple users.
 * Runs in parallel with concurrency limit to avoid overwhelming the push service.
 *
 * @param {Array<{id, push_subscription}>} users
 * @param {Object} payload
 */
export async function broadcastPush(users, payload) {
  const CONCURRENCY = 10;
  const results = { sent: 0, failed: 0, expired: 0, no_sub: 0 };

  for (let i = 0; i < users.length; i += CONCURRENCY) {
    const batch = users.slice(i, i + CONCURRENCY);
    const outcomes = await Promise.all(
      batch.map(u => sendPush(u.push_subscription, payload))
    );
    outcomes.forEach(o => {
      if (o === true) results.sent++;
      else if (o === 'expired') results.expired++;
      else if (o === 'no_sub') results.no_sub++;
      else results.failed++;
    });
  }

  return results;
}

/**
 * Return the VAPID public key for frontend subscription registration.
 * Frontend needs this to call pushManager.subscribe({ applicationServerKey: ... })
 */
export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY || null;
}
