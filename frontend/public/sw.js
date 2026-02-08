// ScanAndSwap Service Worker
const CACHE_NAME = 'scanandswap-v1';
const STATIC_CACHE = 'scanandswap-static-v1';
const DYNAMIC_CACHE = 'scanandswap-dynamic-v1';

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// API routes to cache for offline
const API_CACHE_ROUTES = [
  '/api/products/ingredients/harmful',
  '/api/recipes',
  '/api/products/meta/categories'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Push notification handler
self.addEventListener('push', (event) => {
  let data = { title: 'ScanAndSwap', body: 'You have an update!' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'ScanAndSwap', {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-96.png',
      data: data.url || '/',
      actions: data.actions || []
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip external requests
  if (url.origin !== location.origin) return;

  // API requests - Network first, fall back to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets - Cache first, fall back to network
  event.respondWith(cacheFirst(request));
});

// Cache-first strategy
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Return offline page if available
    const offlineResponse = await caches.match('/');
    return offlineResponse || new Response('Offline', { status: 503 });
  }
}

// Network-first strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful GET responses for certain routes
    if (networkResponse.ok && shouldCacheAPIResponse(request.url)) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Fall back to cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return error response
    return new Response(
      JSON.stringify({ error: 'Offline', message: 'Please check your connection' }),
      { 
        status: 503, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

// Determine if API response should be cached
function shouldCacheAPIResponse(url) {
  return API_CACHE_ROUTES.some(route => url.includes(route));
}

// Handle push notifications
self.addEventListener('push', (event) => {
  let data = { title: 'ScanAndSwap', body: 'New notification' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data;

  if (action === 'dismiss') return;

  let url = '/';
  if (data && data.url) {
    url = data.url;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pantry') {
    event.waitUntil(syncPantryData());
  }
  if (event.tag === 'sync-scans') {
    event.waitUntil(syncOfflineScans());
  }
});

// Sync pantry data when back online
async function syncPantryData() {
  try {
    // Get pending pantry updates from IndexedDB
    const db = await openDB();
    const pendingUpdates = await db.getAll('pending-pantry');
    
    for (const update of pendingUpdates) {
      await fetch('/api/pantry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update)
      });
      await db.delete('pending-pantry', update.id);
    }
  } catch (error) {
    console.error('[SW] Sync pantry failed:', error);
  }
}

// Sync offline scans
async function syncOfflineScans() {
  try {
    const db = await openDB();
    const pendingScans = await db.getAll('pending-scans');
    
    for (const scan of pendingScans) {
      await fetch(`/api/products/scan/${scan.upc}`, { method: 'GET' });
      await db.delete('pending-scans', scan.id);
    }
  } catch (error) {
    console.error('[SW] Sync scans failed:', error);
  }
}

// Simple IndexedDB wrapper (would need full implementation)
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('scanandswap-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      resolve({
        getAll: (store) => {
          return new Promise((res, rej) => {
            const tx = db.transaction(store, 'readonly');
            const req = tx.objectStore(store).getAll();
            req.onsuccess = () => res(req.result);
            req.onerror = () => rej(req.error);
          });
        },
        delete: (store, key) => {
          return new Promise((res, rej) => {
            const tx = db.transaction(store, 'readwrite');
            const req = tx.objectStore(store).delete(key);
            req.onsuccess = () => res();
            req.onerror = () => rej(req.error);
          });
        }
      });
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-pantry')) {
        db.createObjectStore('pending-pantry', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('pending-scans')) {
        db.createObjectStore('pending-scans', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

console.log('[SW] Service Worker loaded');
