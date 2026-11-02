// Bump this on every deploy so old caches are dropped.
const CACHE = 'azkar-v2';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'privacy.html',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
  'fonts/fonts.css',
  'fonts/amiri-arabic-400-normal.woff2', 'fonts/amiri-arabic-700-normal.woff2',
  'fonts/amiri-latin-400-normal.woff2', 'fonts/amiri-latin-700-normal.woff2',
  'fonts/readex-pro-arabic-400-normal.woff2', 'fonts/readex-pro-arabic-500-normal.woff2', 'fonts/readex-pro-arabic-600-normal.woff2',
  'fonts/readex-pro-latin-400-normal.woff2', 'fonts/readex-pro-latin-500-normal.woff2', 'fonts/readex-pro-latin-600-normal.woff2'
];
const BASE = new URL('./', self.location).pathname;            // "/"
const APP_PATHS = new Set(FILES.map(f => new URL(f, self.location).pathname));
const PAGES = new Set([BASE, BASE + 'index.html', BASE + 'privacy.html']);

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network with a short timeout, so a slow connection falls back to the cached copy.
function fromNetwork(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req, { cache: 'no-cache' }).then(res => { clearTimeout(t); resolve(res); }, err => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !APP_PATHS.has(url.pathname)) return; // leave everything else alone

  // Pages: newest version when online, cached copy when offline or slow.
  if (req.mode === 'navigate' || PAGES.has(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        // A navigation Request can't be re-issued with options, so fetch by URL.
        const res = await fromNetwork(req.url, 3000);
        if (res.ok) cache.put(url.pathname === BASE ? './' : req, res.clone());
        return res;
      } catch (_) {
        return (await cache.match(req, { ignoreSearch: true })) ||
               (await cache.match(url.pathname === BASE + 'privacy.html' ? 'privacy.html' : './'));
      }
    })());
    return;
  }

  // Fonts, icons, manifest: cache first, refreshed in the background.
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const network = fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    if (cached) { e.waitUntil(network.catch(() => {})); return cached; }
    return network;
  })());
});
