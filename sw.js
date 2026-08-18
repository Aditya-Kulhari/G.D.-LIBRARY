const CACHE_NAME = 'gd-library-v4'; // Bumped version to invalidate old cache
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './index.js',
  './manifest.json'
];

// 1. Install Service Worker and cache assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching shell assets...');
      return cache.addAll(ASSETS); // Fixed: was STATIC_ASSETS
    })
  );
  self.skipWaiting();
});

// 2. Clean up OLD caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// 3. Fetch Strategy: Network-First for HTML & JS, Cache-First for static styling/icons
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const isHtmlOrJs =
    e.request.mode === 'navigate' ||
    url.pathname.endsWith('index.html') ||
    url.pathname.endsWith('index.js') ||
    url.pathname === '/';

  if (isHtmlOrJs) {
    // Network-First: Always try fresh code first
    e.respondWith(
      fetch(e.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // Cache-First: For CSS, images, and manifest
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        return cachedResponse || fetch(e.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
  }
});
