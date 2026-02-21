/**
 * Ick Push Notification Service
 *
 * Handles server-side push delivery for both:
 *   - Web Push (PWA): W3C Web Push Protocol via VAPID + web-push library
 *   - Native (iOS/Android): Firebase Admin SDK via FCM device tokens
 *
 * Setup:
 *   Web Push:
 *     1. npm install web-push
 *     2. Generate VAPID keys: node -e "const wp=require('web-push'); console.log(JSON.stringify(wp.generateVAPIDKeys()))"
 *     3. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL in Render env vars
 *
 *   Native Push (FCM):
 *     1. Create a Firebase project at console.firebase.google.com
 *     2. Go to Project Settings → Service Accounts → Generate new private key
 *     3. Base64-encode the JSON: base64 -i serviceAccountKey.json | tr -d '\n'
 *     4. Set FIREBASE_SERVICE_ACCOUNT_BASE64 in Render env vars
 *
 * Usage:
 *   import { sendPushToUser } from './services/pushNotifications.js';
 *   await sendPushToUser(userId, { title: 'Ick Alert', body: '...' });
 */

import webpush from 'web-push';
import pool from '../db/init.js';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:hello@ick.app';

let vapidConfigured = false;
let firebaseApp = null;
let firebaseMessaging = null;

function ensureVapid() {
  if (vapidConfigured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[Push] VAPID keys not set — web push disabled.');
    return false;
  }
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  vapidConfigured = true;
  return true;
}

async function ensureFirebase() {
  if (firebaseMessaging) return firebaseMessaging;

  const serviceAccountB64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!serviceAccountB64) {
    console.warn('[Push] FIREBASE_SERVICE_ACCOUNT_BASE64 not set — native push disabled.');
    return null;
  }

  try {
    const { default: admin } = await import('firebase-admin');

    if (!firebaseApp) {
      const serviceAccount = JSON.parse(Buffer.from(serviceAccountB64, 'base64').toString('utf8'));
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    firebaseMessaging = admin.messaging(firebaseApp);
    console.log('[Push] Firebase Admin SDK initialized');
    return firebaseMessaging;
  } catch (err) {
    console.error('[Push] Firebase init error:', err.message);
    return null;
  }
}

/**
 * Send a Web Push notification to a VAPID subscription object.
 */
async function sendWebPush(subscription, payload) {
  if (!ensureVapid()) return false;
  const sub = typeof subscription === 'string' ? JSON.parse(subscription) : subscription;
  if (!sub?.endpoint) return false;

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
      { TTL: 60 * 60 * 24 }
    );
    return true;
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) return 'expired';
    console.error('[Push] Web push send error:', err.message);
    return false;
  }
}

/**
 * Send an FCM notification to a native device token.
 */
async function sendFCM(token, payload) {
  const messaging = await ensureFirebase();
  if (!messaging) return false;

  try {
    await messaging.send({
      token,
      notification: {
        title: payload.title || 'Ick',
        body: payload.body || '',
      },
      data: {
        url: payload.url || '/pantry',
        tag: payload.tag || 'ick-alert',
        ...(payload.data ? Object.fromEntries(
          Object.entries(payload.data).map(([k, v]) => [k, String(v)])
        ) : {}),
      },
      android: {
        notification: {
          icon: 'ic_notification',
          color: '#f97316', // Ick orange
          sound: 'default',
          channelId: 'ick-alerts',
        },
        priority: 'high',
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    });
    return true;
  } catch (err) {
    // Token is invalid/unregistered — clean it up
    if (err.code === 'messaging/registration-token-not-registered' ||
        err.code === 'messaging/invalid-registration-token') {
      return 'expired';
    }
    console.error('[Push] FCM send error:', err.message);
    return false;
  }
}

/**
 * Send push to a user by user ID.
 * Tries native FCM first if available, falls back to web push.
 */
export async function sendPushToUser(userId, payload) {
  try {
    const result = await pool.query(
      'SELECT push_subscription, native_push_token FROM users WHERE id = $1',
      [userId]
    );
    const row = result.rows[0];
    if (!row) return 'no_sub';

    // Try native FCM first
    if (row.native_push_token) {
      const outcome = await sendFCM(row.native_push_token, payload);
      if (outcome === 'expired') {
        await pool.query('UPDATE users SET native_push_token = NULL WHERE id = $1', [userId]);
      }
      if (outcome === true) return true;
      // fall through to web push if FCM failed non-fatally
    }

    // Fall back to web push
    if (row.push_subscription) {
      const outcome = await sendWebPush(row.push_subscription, payload);
      if (outcome === 'expired') {
        await pool.query('UPDATE users SET push_subscription = NULL WHERE id = $1', [userId]);
      }
      return outcome;
    }

    return 'no_sub';
  } catch (err) {
    console.error('[Push] sendPushToUser error:', err);
    return false;
  }
}

/**
 * Legacy single-subscription send (kept for backward compat).
 */
export async function sendPush(subscription, payload) {
  if (!subscription) return false;
  const sub = typeof subscription === 'string' ? JSON.parse(subscription) : subscription;
  if (sub.type === 'native') return sendFCM(sub.token, payload);
  return sendWebPush(sub, payload);
}

/**
 * Broadcast push to multiple users (by user rows with id + push columns).
 */
export async function broadcastPush(users, payload) {
  const CONCURRENCY = 10;
  const results = { sent: 0, failed: 0, expired: 0, no_sub: 0 };

  for (let i = 0; i < users.length; i += CONCURRENCY) {
    const batch = users.slice(i, i + CONCURRENCY);
    const outcomes = await Promise.all(batch.map(u => sendPushToUser(u.id, payload)));
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
 * Return the VAPID public key for frontend PWA subscription registration.
 */
export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY || null;
}
