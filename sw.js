const CACHE_NAME = 'gd-library-v2';
const ASSETS = [
  './', // Essential for caching the root URL
  './index.html',
  './style.css',
  './index.js',
  './manifest.json'
];

// Install Service Worker and cache the files
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  // Force the waiting service worker to become active immediately
  self.skipWaiting(); 
});

// Clean up OLD caches when the new service worker takes over
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
  // Force the new service worker to control the page immediately
  return self.clients.claim();
});

// Fetch assets from cache or network
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
