const STATIC_CACHE = "duitlog-static-v1";
const OFFLINE_CACHE = "duitlog-offline-v1";
const VALID_CACHES = [STATIC_CACHE, OFFLINE_CACHE];

const OFFLINE_URL = "/offline";
const PRECACHE_ASSETS = [
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/manifest.webmanifest",
];

// Install: pre-cache offline page and static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(OFFLINE_CACHE).then((cache) => cache.add(OFFLINE_URL)),
      caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS)),
    ])
  );
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !VALID_CACHES.includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Listen for SKIP_WAITING message from the client
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Fetch strategies
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Never cache POST/action requests
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    // Navigation: network-first, fallback to offline page
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Static assets (JS, CSS, images): stale-while-revalidate
  if (
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname.startsWith("/assets/")
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
        })
      )
    );
  }
});
