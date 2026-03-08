const STATIC_CACHE = 'duitlog-static-v1';
const OFFLINE_CACHE = 'duitlog-offline-v1';
const VALID_CACHES = [STATIC_CACHE, OFFLINE_CACHE];

const OFFLINE_URL = '/offline';
const PRECACHE_ASSETS = [
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/manifest.webmanifest',
];

// Install: pre-cache offline page and static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .open(OFFLINE_CACHE)
        .then((cache) => cache.add(OFFLINE_URL)),
      caches
        .open(STATIC_CACHE)
        .then((cache) => cache.addAll(PRECACHE_ASSETS)),
    ]),
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !VALID_CACHES.includes(key))
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

// Listen for SKIP_WAITING message from the client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background Sync handler
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-expenses') {
    event.waitUntil(syncFromSW());
  }
});

async function syncFromSW() {
  // Acquire a Web Lock so the page's fallback auto-sync and this SW handler
  // cannot run at the same time and double-submit the same queued entry.
  if ('locks' in navigator) {
    return navigator.locks.request('duitlog-sync', () =>
      _doSyncFromSW(),
    );
  }
  return _doSyncFromSW();
}

async function _doSyncFromSW() {
  let db;
  try {
    db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('duitlog-offline', 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('pending-expenses')) {
          database.createObjectStore('pending-expenses', {
            keyPath: 'id',
          });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return;
  }

  let entries;
  try {
    const tx = db.transaction('pending-expenses', 'readonly');
    const store = tx.objectStore('pending-expenses');
    entries = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch {
    db.close();
    return;
  }

  // Ensure deterministic, chronological sync order by createdAt
  entries.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  for (const entry of entries) {
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...entry.formData,
          createdAt: entry.createdAt,
        }),
      });

      if (response.ok || response.status === 400) {
        // Remove from queue
        const deleteTx = db.transaction(
          'pending-expenses',
          'readwrite',
        );
        deleteTx.objectStore('pending-expenses').delete(entry.id);
        await new Promise((resolve, reject) => {
          deleteTx.oncomplete = resolve;
          deleteTx.onerror = reject;
        });
      }
    } catch {
      // Still offline — stop trying
      break;
    }
  }

  db.close();

  // Notify the client to refresh pending count
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage({ type: 'SYNC_COMPLETE' });
  }
}

// Fetch strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Only handle GET requests — let POSTs go through to the network
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    // Navigation: network-first, fallback to offline page
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL)),
    );
    return;
  }

  // Static assets (JS, CSS, images): stale-while-revalidate
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.webmanifest') ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request).then((response) => {
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          });
          return cached || networkFetch;
        }),
      ),
    );
  }
});
