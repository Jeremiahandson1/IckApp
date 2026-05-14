// Feature flag cache + accessor.
//
// Flags live in the feature_flags table. We cache them in memory with a
// 30-second TTL so flag checks are cheap (no DB roundtrip per request).
// Updates from the admin UI bypass the cache via invalidateFlags() so
// changes take effect within ~30s globally.
//
// Code paths check flags like:
//   import { isFlagOn } from '../utils/featureFlags.js';
//   if (await isFlagOn('disable_receipt_scanning')) return 503;

import pool from '../db/init.js';

const CACHE_TTL_MS = 30_000;
let _cache = null;
let _cachedAt = 0;

async function refresh() {
  try {
    const r = await pool.query('SELECT key, enabled FROM feature_flags');
    const map = new Map();
    for (const row of r.rows) map.set(row.key, row.enabled);
    _cache = map;
    _cachedAt = Date.now();
  } catch {
    // If DB fails (e.g. on cold boot before init), treat all flags as off
    _cache = new Map();
    _cachedAt = Date.now();
  }
}

/**
 * Returns true if the named flag is enabled.
 * @param {string} key
 * @returns {Promise<boolean>}
 */
export async function isFlagOn(key) {
  if (!_cache || Date.now() - _cachedAt > CACHE_TTL_MS) await refresh();
  return _cache.get(key) === true;
}

/** Returns the full flag map (all flags + values). */
export async function getAllFlags() {
  if (!_cache || Date.now() - _cachedAt > CACHE_TTL_MS) await refresh();
  return Object.fromEntries(_cache);
}

/** Force a refresh — called by admin UI after toggling a flag. */
export function invalidateFlags() {
  _cachedAt = 0;
}
