const CACHE_NAME = 'gd-library-v1';
const ASSETS = [
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
});

// Fetch assets from cache or network
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});