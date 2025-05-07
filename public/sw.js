const CACHE_NAME = 'zapsliggers-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  // Add paths to your main JS/CSS bundles if they are static and not hash-named
  // e.g., '/assets/index.js', '/assets/index.css'
  // Vite usually generates hashed assets, so these might not be needed or change frequently.
  // You might need a more sophisticated service worker setup if using Vite's default build.
  '/images/icon-192.png',
  '/images/icon-512.png',
  '/backdrop.png', // Assuming backdrop.png is in the public folder
  // Add other essential assets like spaceship images, sounds, etc.
  // e.g., '/images/spaceship_blue.png', '/images/spaceship_red.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
}); 