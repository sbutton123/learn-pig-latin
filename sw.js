// sw.js — offline caching for Learn Pig Latin
// bump this string whenever you change the list
const CACHE = 'piglatin-v5';

// All top-level pages you want working offline:
const OFFLINE_PAGES = [
  '/',                 // host root
  '/index.html',
  '/games.html',
  '/piglatinia.html',
  '/products.html',

  // Game pages in your repo:
  '/animalsway-wordsearch.html',
  '/colorsshapes-wordsearch.html',
  '/erbsbay-wordsearch.html',
  '/oodfay-wordsearch.html'
];

// Icons & small assets
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

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Strategy:
// - HTML/navigations: **cache-first** (instant offline), then update cache in background when online
// - Other assets: cache-first
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const accept = req.headers.get('accept') || '';
  const isNavigation = req.mode === 'navigate' || accept.includes('text/html');

  if (isNavigation) {
    event.respondWith(
      caches.match(req).then(cached => {
        const fetchAndUpdate = fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        }).catch(() => cached || caches.match('/index.html'));
        // Serve cached immediately if present; otherwise go to network
        return cached || fetchAndUpdate;
      })
    );
    return;
  }

  // Assets: cache-first
  event.respondWith(
    caches.match(req).then(cached =>
      cached ||
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => cached) // if both fail, return whatever we had
    )
  );
});
