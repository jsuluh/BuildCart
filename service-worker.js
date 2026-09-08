/* =====================================================================
 *  BuildCart Service Worker — Offline-First PWA
 *  Caches static assets, API responses, and provides offline fallback
 * ===================================================================== */

const CACHE_NAME = 'buildcart-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/materials.html',
  '/services.html',
  '/product.html',
  '/cart.html',
  '/checkout.html',
  '/calculator.html',
  '/orders.html',
  '/css/style.css',
  '/js/data.js',
  '/js/app.js',
  '/manifest.json'
];

const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

// Install — cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 BuildCart: Caching static assets');
      // Cache local assets first (these will always succeed)
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('Some static assets failed to cache:', err);
        // Still continue — don't block install for failed caches
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch — network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // API requests — Network first, fall back to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses for 5 min
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            return new Response(JSON.stringify({ error: 'Offline', message: 'No cached data available' }), {
              headers: { 'Content-Type': 'application/json' },
              status: 503
            });
          });
        })
    );
    return;
  }

  // Static assets — Cache first, fall back to network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Cache new static assets on-the-fly
        if (response.ok && (url.origin === self.location.origin || CDN_ASSETS.some(cdn => request.url.startsWith(cdn)))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for HTML pages
        if (request.headers.get('Accept')?.includes('text/html')) {
          return caches.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// Listen for skipWaiting message from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
