const CACHE_NAME = "sewa-cache-v2";
const ASSETS = [
  "/",
  "/index.html",
  "/logo.svg",
  "/favicon.svg"
];

// Install Service Worker - Skip waiting to activate new version immediately
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching app shell assets");
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Service Worker - Purge all old caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Purging old cache:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Interceptor
self.addEventListener("fetch", (e) => {
  if (!e.request.url.startsWith("http")) return;
  
  // API Requests - Network only with offline fallback
  if (e.request.url.includes("/api/")) {
    e.respondWith(
      fetch(e.request).catch(() => {
        return new Response(
          JSON.stringify({ error: "offline", message: "You are offline. Action queued." }),
          { headers: { "Content-Type": "application/json" } }
        );
      })
    );
    return;
  }

  // HTML Navigation Requests - NETWORK FIRST to ensure latest code edits load on refresh
  if (e.request.mode === 'navigate' || (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html'))) {
    e.respondWith(
      fetch(e.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(e.request);
        })
    );
    return;
  }

  // Static Assets - Stale While Revalidate
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      const fetchPromise = fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, responseToCache));
        }
        return networkResponse;
      }).catch(() => cachedResponse);
      
      return cachedResponse || fetchPromise;
    })
  );
});
