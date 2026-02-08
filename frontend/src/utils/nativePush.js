/**
 * Native Push Notifications (iOS / Android)
 * 
 * Uses @capacitor/push-notifications for native push via APNs (iOS) and FCM (Android).
 * Falls back to Web Push API for PWA/browser.
 */

import { isNative } from './platform';

let pushPlugin = null;

async function getPushPlugin() {
  if (pushPlugin) return pushPlugin;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    pushPlugin = PushNotifications;
    return pushPlugin;
  } catch {
    return null;
  }
}

/**
 * Initialize push notifications
 * Call once on app startup (after user logs in)
 * 
 * @param {Function} onToken - Called with device token string for server registration
 * @param {Function} onNotification - Called when notification received while app is open
 * @param {Function} onAction - Called when user taps a notification
 */
export async function initPushNotifications({ onToken, onNotification, onAction }) {
  if (!isNative) {
    // Web push — handled by service worker, nothing to init here
    return false;
  }

  const push = await getPushPlugin();
  if (!push) return false;

  try {
    // Request permission
    const permission = await push.requestPermissions();
    if (permission.receive !== 'granted') {
      console.log('[Push] Permission denied');
      return false;
    }

    // Register with APNs/FCM
    await push.register();

    // Listen for registration token
    push.addListener('registration', (token) => {
      console.log('[Push] Token:', token.value);
      if (onToken) onToken(token.value);
    });

    // Registration error
    push.addListener('registrationError', (error) => {
      console.error('[Push] Registration error:', error);
    });

    // Notification received while app is in foreground
    push.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Received:', notification);
      if (onNotification) onNotification(notification);
    });

    // User tapped on a notification
    push.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[Push] Action:', action);
      if (onAction) onAction(action);
    });

    return true;
  } catch (error) {
    console.error('[Push] Init error:', error);
    return false;
  }
}

/**
 * Get current notification permission status
 */
export async function getPushPermissionStatus() {
  if (!isNative) {
    if ('Notification' in window) return Notification.permission;
    return 'unsupported';
  }

  const push = await getPushPlugin();
  if (!push) return 'unsupported';

  try {
    const status = await push.checkPermissions();
    return status.receive; // 'prompt' | 'granted' | 'denied'
  } catch {
    return 'unsupported';
  }
}

/**
 * Remove all delivered notifications from notification center
 */
export async function clearNotifications() {
  if (!isNative) return;
  const push = await getPushPlugin();
  if (push) {
    try { await push.removeAllDeliveredNotifications(); } catch {}
  }
}
