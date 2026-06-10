import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// Auth token storage facade.
//
// Web/PWA: localStorage (unchanged behavior).
// Native (iOS/Android): Capacitor Preferences — backed by UserDefaults /
// SharedPreferences instead of the WebView's localStorage, which other code
// running in the WebView (or a lost device with WebView data extraction) can
// read trivially.
//
// Preferences is async, but everything that reads tokens (ApiClient
// constructor, AuthContext mount) expects sync access. So on native we keep
// an in-memory mirror, hydrated once at startup via hydrateTokens() BEFORE
// the app renders (see main.jsx). Writes update the mirror synchronously and
// persist in the background.

const isNative = Capacitor.isNativePlatform();
const TOKEN_KEYS = ['token', 'refreshToken'];
const cache = new Map();

// Must complete before the first getStoredToken() call on native.
// Also migrates tokens persisted by older builds out of localStorage.
export async function hydrateTokens() {
  if (!isNative) return;
  for (const key of TOKEN_KEYS) {
    let { value } = await Preferences.get({ key });
    const legacy = localStorage.getItem(key);
    if (value == null && legacy != null) {
      await Preferences.set({ key, value: legacy });
      value = legacy;
    }
    if (legacy != null) localStorage.removeItem(key);
    if (value != null) cache.set(key, value);
  }
}

export function getStoredToken(key) {
  return isNative ? (cache.get(key) ?? null) : localStorage.getItem(key);
}

export function setStoredToken(key, value) {
  if (value == null) return removeStoredToken(key);
  if (isNative) {
    cache.set(key, value);
    Preferences.set({ key, value }).catch(() => {});
  } else {
    localStorage.setItem(key, value);
  }
}

export function removeStoredToken(key) {
  if (isNative) {
    cache.delete(key);
    Preferences.remove({ key }).catch(() => {});
  } else {
    localStorage.removeItem(key);
  }
}
