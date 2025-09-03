// sw.js — offline caching for Learn Pig Latin
// bump this if you change the file list
const CACHE = 'piglatin-v4';

// Put every page you want to work offline here.
// (Add new game pages here in the future.)
const OFFLINE_PAGES = [
  '/',                 // host root
  '/index.html',
  '/games.html',
  '/piglatinia.html',
  '/products.html',

  // Word search / games pages (from your repo listing)
  '/animalsway-wordsearch.html',
  '/colorsshapes-wordsearch.html',
  '/erbsbay-wordsearch.html',
  '/oodfay-wordsearch.html'
];

// Icons & small assets (safe to keep)
const OFFLINE_ASSETS = [
  '/img/piglatinfavicon.png',
  '/img/iconsandroidchrome192x192.png',
  '/img/iconsandroidchrome512x512.png',
  '/img/appletouchicon180.png',
  '/img/favicon-32x32.png',
  '/img/favicon-16x16.png',
  '/img/favicon.ico'
];

// Combine for install pre-cache
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
// - HTML/navigations: network-first, fall back to cached copy
// - Everything else: cache-first (once seen online, it works offline)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const accept = req.headers.get('accept') || '';
  const isNavigation = req.mode === 'navigate' || accept.includes('text/html');

  if (isNavigation) {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(async () => {
        // try exact page first
        const cached = await caches.match(req);
        if (cached) return cached;
        // last resort: show the home page
        return caches.match('/index.html');
      })
    );
  } else {
    // cache-first for assets (images, css, js)
    event.respondWith(
      caches.match(req).then(cached =>
        cached ||
        fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
      )
    );
  }
});
