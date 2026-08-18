const CACHE_NAME = 'gd-library-v3';
const ASSETS = [
  './', // Essential for caching the root URL
  './index.html',
  './style.css',
  './index.js',
  './manifest.json'
];

// 1. Install Service Worker and cache static structural files
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching shell assets...');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting(); 
});

// 2. Clean up OLD caches when the new service worker takes over
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

// 3. Smart Fetch Strategy: Network-First for index.js, Cache-First for others
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // If requesting your main JavaScript engine file, always try network first so updates register instantly
  if (url.pathname.endsWith('index.js')) {
    e.respondWith(
      fetch(e.request)
        .then((networkResponse) => {
          // Save a copy of the fresh script to the cache just in case they go offline
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          // If network is completely down (offline library), fallback to cached version
          return caches.match(e.request);
        })
    );
  } else {
    // For HTML, CSS, and Manifest, use standard Cache-First strategy for speed
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        return cachedResponse || fetch(e.request);
      })
    );
  }
});
