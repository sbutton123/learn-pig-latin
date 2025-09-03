// sw.js — offline caching for Learn Pig Latin
const CACHE = 'piglatin-v6';

// Pages that should work offline
const OFFLINE_PAGES = [
  '/index.html',
  '/games.html',
  '/piglatinia.html',
  '/products.html',

  // Game pages
  '/animalsway-wordsearch.html',
  '/colorsshapes-wordsearch.html',
  '/erbsbay-wordsearch.html',
  '/oodfay-wordsearch.html'
];

// Small assets/icons
const OFFLINE_ASSETS = [
  '/img/piglatinfavicon.png',
  '/img/iconsandroidchrome192x192.png',
  '/img/iconsandroidchrome512x512.png',
  '/img/appletouchicon180.png',
  '/img/favicon-32x32.png',
  '/img/favicon-16x16.png',
  '/img/favicon.ico'
];

const PRECACHE = [...OFFLINE_PAGES, ...OFFLINE_ASSETS];

// Install: cache everything we can, but don't abort if one item fails
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(PRECACHE.map(async (url) => {
      try { await cache.add(url); } catch (e) { /* skip missing/blocked */ }
    }));
  })());
  self.skipWaiting();
});

// Activate: delete old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch:
// - HTML/navigations: cache-first, update in background when online, hard fallback to /index.html
// - Other assets: cache-first
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const accept = req.headers.get('accept') || '';
  const isNavigation = req.mode === 'navigate' || accept.includes('text/html');

  if (isNavigation) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req) || await cache.match('/index.html');
      // Start a background update (won't block the response)
      fetch(req).then(res => cache.put(req, res.clone())).catch(() => {});
      return cached;
    })());
    return;
  }

  event.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => cached)
    )
  );
});
