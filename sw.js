// sw.js — offline support for Learn Pig Latin
//
// How it works:
// - Pages (HTML), scripts, and the manifest: NETWORK FIRST.
//   Visitors always get the real, current page when they're online.
//   The cached copy is only used when the network is unavailable.
// - Images and icons from this site: served from cache when available,
//   refreshed in the background.
// - Anything from other websites (Google Analytics, YouTube, etc.):
//   never touched or cached by this worker.
// - Extra cached items are capped so the cache can't grow forever.
//
// When you change this file, bump VERSION so old caches get cleaned up.

const VERSION = 'v8';
const CORE_CACHE = `piglatin-core-${VERSION}`;       // saved at install, kept for offline
const RUNTIME_CACHE = `piglatin-runtime-${VERSION}`; // saved while browsing, size-limited
const RUNTIME_MAX_ENTRIES = 40;
const MAX_CACHEABLE_BYTES = 1024 * 1024;              // don't keep files over 1 MB (e.g. full-size coloring pages)

// Pages that should work offline
// ("/index.html" is not listed: Netlify redirects it to "/", and a saved
//  redirect can't be shown as a page.)
const OFFLINE_PAGES = [
  '/',
  '/translator.html',
  '/games.html',
  '/piglatinia.html',
  '/products.html',

  // Game pages
  '/animalsway-wordsearch.html',
  '/colorsshapes-wordsearch.html',
  '/erbsvay-wordsearch.html',
  '/oodfay-wordsearch.html'
];

// Scripts and small assets/icons the pages need
const OFFLINE_ASSETS = [
  '/js/piglatin.js',
  '/js/translator-ui.js',
  '/site.webmanifest',
  '/img/piglatinpig1.png',
  '/img/piglatinpig2.png',
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
    const cache = await caches.open(CORE_CACHE);
    await Promise.all(PRECACHE.map(async (url) => {
      try {
        const res = await fetch(url, { cache: 'reload' });
        if (res.ok && !res.redirected) await cache.put(url, res);
      } catch (e) { /* skip missing/blocked */ }
    }));
  })());
  self.skipWaiting();
});

// Activate: delete caches from older versions (including the old "piglatin-v6")
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith('piglatin') && k !== CORE_CACHE && k !== RUNTIME_CACHE)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// ---------- Helpers ----------

function isCacheable(res) {
  if (!res || !res.ok || res.type !== 'basic' || res.redirected) return false;
  const len = Number(res.headers.get('content-length') || 0);
  return !len || len <= MAX_CACHEABLE_BYTES;
}

// Keep the runtime cache from growing without limit (oldest entries go first).
async function trimRuntimeCache() {
  const cache = await caches.open(RUNTIME_CACHE);
  const keys = await cache.keys();
  const extra = keys.length - RUNTIME_MAX_ENTRIES;
  for (let i = 0; i < extra; i++) await cache.delete(keys[i]);
}

// Save a fresh copy: core files update the core cache, everything else goes to runtime.
async function saveCopy(request, response) {
  if (!isCacheable(response)) return;
  const path = new URL(request.url).pathname;
  if (PRECACHE.includes(path)) {
    const core = await caches.open(CORE_CACHE);
    await core.put(path, response);
  } else {
    const runtime = await caches.open(RUNTIME_CACHE);
    await runtime.put(request, response);
    await trimRuntimeCache();
  }
}

function offlinePage() {
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>You're offline | Learn Pig Latin</title>
<style>body{margin:0;font-family:Arial,sans-serif;background:#f3eaff;color:#1f1440;text-align:center;padding:3rem 1rem}
h1{color:#9063f5}a{display:inline-block;margin-top:1rem;background:#a97ef9;color:#fff;padding:.75rem 1.5rem;border-radius:.5rem;text-decoration:none;font-weight:bold}</style>
</head><body><h1>Ou'reyay offlineyay!</h1><p>You're offline, and this page hasn't been saved on your device yet.</p>
<a href="/">Go to the translator</a></body></html>`;
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// Network first, cache as backup.
async function networkFirst(event) {
  const req = event.request;
  try {
    const res = await fetch(req);
    event.waitUntil(saveCopy(req, res.clone()));
    return res;
  } catch (err) {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    if (req.mode === 'navigate') {
      // Offline visit to the homepage under another address (e.g. /?source=pwa)
      const path = new URL(req.url).pathname;
      if (path === '/' || path === '/index.html') {
        const home = await caches.match('/', { ignoreSearch: true });
        if (home) return home;
      }
      return offlinePage();
    }
    return Response.error();
  }
}

// Cache first for images, refreshing the cached copy in the background.
async function staleWhileRevalidate(event) {
  const req = event.request;
  const cached = await caches.match(req);
  const refresh = fetch(req)
    .then((res) => { event.waitUntil(saveCopy(req, res.clone())); return res; })
    .catch(() => null);
  if (cached) {
    event.waitUntil(refresh);
    return cached;
  }
  const res = await refresh;
  return res || Response.error();
}

// ---------- Fetch ----------
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Leave other websites alone (Google Analytics, YouTube, fonts, etc.)
  if (url.origin !== self.location.origin) return;

  const accept = req.headers.get('accept') || '';
  const isPage = req.mode === 'navigate' || accept.includes('text/html');
  const isImage = req.destination === 'image' || /\.(png|jpe?g|gif|webp|svg|ico)$/i.test(url.pathname);

  if (isPage || !isImage) {
    // Pages, scripts, styles, manifest, sitemap, etc.
    event.respondWith(networkFirst(event));
    return;
  }
  event.respondWith(staleWhileRevalidate(event));
});
