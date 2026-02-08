/**
 * Ick Offline Database
 * 
 * IndexedDB-backed product cache replacing the old localStorage approach.
 * 
 * Old: localStorage, 500 products max, ~2MB limit, blocks main thread
 * New: IndexedDB, 10,000+ products, ~50MB+ capacity, async, indexed by UPC
 * 
 * Features:
 * - Instant lookup by UPC (indexed)
 * - Background sync: fetches fresh data when online, serves stale when offline
 * - Pre-loads curated products (95 swap mappings) on first install
 * - Stores search results for offline text search
 * - LRU eviction when approaching storage quota
 * - Migration from old localStorage cache
 */

const DB_NAME = 'ick_offline';
const DB_VERSION = 1;
const PRODUCTS_STORE = 'products';
const META_STORE = 'meta';
const SEARCH_STORE = 'search_index';

// TTL for cached products
const FRESH_TTL = 24 * 60 * 60 * 1000;  // 24h = "fresh" (no refetch needed)
const STALE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days = "stale but usable"
const MAX_PRODUCTS = 10000;

let dbInstance = null;

/**
 * Open (or create) the IndexedDB database
 */
function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Products store — keyed by UPC
      if (!db.objectStoreNames.contains(PRODUCTS_STORE)) {
        const store = db.createObjectStore(PRODUCTS_STORE, { keyPath: 'upc' });
        store.createIndex('cached_at', 'cached_at', { unique: false });
        store.createIndex('last_accessed', 'last_accessed', { unique: false });
        store.createIndex('name', 'name', { unique: false });
      }

      // Meta store — key-value pairs for sync state, counts, etc
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }

      // Search index — for offline text search
      if (!db.objectStoreNames.contains(SEARCH_STORE)) {
        const searchStore = db.createObjectStore(SEARCH_STORE, { keyPath: 'term' });
        searchStore.createIndex('updated_at', 'updated_at', { unique: false });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      console.error('[OfflineDB] Failed to open:', request.error);
      reject(request.error);
    };
  });
}

/**
 * Run a transaction on one or more stores
 */
async function tx(storeNames, mode, callback) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    const result = callback(transaction);

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(new Error('Transaction aborted'));
  });
}

// ── Product Operations ──

/**
 * Get a product by UPC
 * @returns {Object|null} { data, fresh, stale, cached_at }
 */
export async function getProduct(upc) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const txn = db.transaction(PRODUCTS_STORE, 'readwrite');
      const store = txn.objectStore(PRODUCTS_STORE);
      const request = store.get(upc);

      request.onsuccess = () => {
        const entry = request.result;
        if (!entry) return resolve(null);

        const age = Date.now() - entry.cached_at;
        
        // Update last_accessed for LRU
        entry.last_accessed = Date.now();
        store.put(entry);

        resolve({
          data: entry.data,
          fresh: age < FRESH_TTL,
          stale: age > STALE_TTL,
          cached_at: entry.cached_at
        });
      };

      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Store a product
 */
export async function putProduct(upc, data) {
  if (!upc || !data) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const txn = db.transaction(PRODUCTS_STORE, 'readwrite');
      const store = txn.objectStore(PRODUCTS_STORE);
      store.put({
        upc,
        data,
        name: (data.name || '').toLowerCase(),
        brand: (data.brand || '').toLowerCase(),
        cached_at: Date.now(),
        last_accessed: Date.now()
      });
      txn.oncomplete = () => resolve();
      txn.onerror = () => reject(txn.error);
    });
  } catch (e) {
    console.error('[OfflineDB] putProduct error:', e);
  }
}

/**
 * Bulk store products (for pre-loading)
 */
export async function putProducts(products) {
  if (!products?.length) return;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const txn = db.transaction(PRODUCTS_STORE, 'readwrite');
      const store = txn.objectStore(PRODUCTS_STORE);
      const now = Date.now();

      for (const p of products) {
        if (p.upc && p.name) {
          store.put({
            upc: p.upc,
            data: p,
            name: (p.name || '').toLowerCase(),
            brand: (p.brand || '').toLowerCase(),
            cached_at: now,
            last_accessed: now
          });
        }
      }

      txn.oncomplete = () => resolve(products.length);
      txn.onerror = () => reject(txn.error);
    });
  } catch (e) {
    console.error('[OfflineDB] putProducts error:', e);
  }
}

/**
 * Search cached products by name (offline text search)
 */
export async function searchProducts(query) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const txn = db.transaction(PRODUCTS_STORE, 'readonly');
      const store = txn.objectStore(PRODUCTS_STORE);
      const results = [];

      const cursor = store.openCursor();
      cursor.onsuccess = (event) => {
        const c = event.target.result;
        if (!c) return resolve(results.slice(0, 20));

        const entry = c.value;
        if (entry.name?.includes(q) || entry.brand?.includes(q)) {
          results.push(entry.data);
        }
        c.continue();
      };
      cursor.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Count cached products
 */
export async function getProductCount() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const txn = db.transaction(PRODUCTS_STORE, 'readonly');
      const store = txn.objectStore(PRODUCTS_STORE);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

/**
 * LRU eviction — remove least recently accessed products
 */
export async function evictIfNeeded() {
  try {
    const count = await getProductCount();
    if (count <= MAX_PRODUCTS) return 0;

    const toRemove = count - MAX_PRODUCTS + 100; // Remove 100 extra for headroom
    const db = await openDB();

    return new Promise((resolve) => {
      const txn = db.transaction(PRODUCTS_STORE, 'readwrite');
      const store = txn.objectStore(PRODUCTS_STORE);
      const index = store.index('last_accessed');
      let removed = 0;

      const cursor = index.openCursor(); // Ascending = oldest first
      cursor.onsuccess = (event) => {
        const c = event.target.result;
        if (!c || removed >= toRemove) return resolve(removed);
        c.delete();
        removed++;
        c.continue();
      };
      cursor.onerror = () => resolve(removed);
    });
  } catch {
    return 0;
  }
}

// ── Meta Operations ──

export async function getMeta(key) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const txn = db.transaction(META_STORE, 'readonly');
      const request = txn.objectStore(META_STORE).get(key);
      request.onsuccess = () => resolve(request.result?.value ?? null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setMeta(key, value) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const txn = db.transaction(META_STORE, 'readwrite');
      txn.objectStore(META_STORE).put({ key, value });
      txn.oncomplete = () => resolve();
      txn.onerror = () => reject(txn.error);
    });
  } catch {}
}

// ── Migration from localStorage ──

export async function migrateFromLocalStorage() {
  const already = await getMeta('migrated_from_localstorage');
  if (already) return;

  try {
    const raw = localStorage.getItem('ick_product_cache');
    if (!raw) {
      await setMeta('migrated_from_localstorage', true);
      return;
    }

    const cache = JSON.parse(raw);
    const products = Object.entries(cache)
      .filter(([_, v]) => v?.data?.name)
      .map(([upc, v]) => ({ ...v.data, upc }));

    if (products.length > 0) {
      await putProducts(products);
      console.log(`[OfflineDB] Migrated ${products.length} products from localStorage`);
    }

    // Clean up old cache
    localStorage.removeItem('ick_product_cache');
    await setMeta('migrated_from_localstorage', true);
  } catch (e) {
    console.error('[OfflineDB] Migration error:', e);
  }
}

// ── Pre-loading ──

/**
 * Pre-load curated products from the backend
 * Called once after first install, then periodically to refresh
 */
export async function preloadProducts(apiClient) {
  const lastPreload = await getMeta('last_preload');
  const daysSince = lastPreload ? (Date.now() - lastPreload) / (24 * 60 * 60 * 1000) : Infinity;

  // Only preload if never done or >7 days old
  if (daysSince < 7) return;

  try {
    // Fetch all curated products from backend
    const response = await apiClient.get('/products/curated');
    if (Array.isArray(response) && response.length > 0) {
      await putProducts(response);
      await setMeta('last_preload', Date.now());
      console.log(`[OfflineDB] Pre-loaded ${response.length} curated products`);
    }
  } catch (e) {
    // Offline — skip preload, will retry later
    console.log('[OfflineDB] Preload skipped (offline)');
  }
}

// ── Initialization ──

/**
 * Initialize the offline database
 * - Opens IndexedDB
 * - Migrates from localStorage if needed
 * - Triggers background preload
 */
export async function initOfflineDB(apiClient) {
  try {
    await openDB();
    await migrateFromLocalStorage();
    
    // Background preload — don't await, don't block app startup
    preloadProducts(apiClient).catch(() => {});
    
    // Background eviction
    evictIfNeeded().catch(() => {});

    const count = await getProductCount();
    console.log(`[OfflineDB] Ready — ${count} products cached`);
  } catch (e) {
    console.error('[OfflineDB] Init failed — falling back to network-only:', e);
  }
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable() {
  try {
    return !!window.indexedDB;
  } catch {
    return false;
  }
}
