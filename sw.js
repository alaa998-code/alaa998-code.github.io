const CACHE = 'azkar-v1';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'privacy.html',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png',
  'fonts/fonts.css',
  'fonts/amiri-arabic-400-normal.woff2', 'fonts/amiri-arabic-700-normal.woff2',
  'fonts/amiri-latin-400-normal.woff2', 'fonts/amiri-latin-700-normal.woff2',
  'fonts/readex-pro-arabic-400-normal.woff2', 'fonts/readex-pro-arabic-500-normal.woff2', 'fonts/readex-pro-arabic-600-normal.woff2',
  'fonts/readex-pro-latin-400-normal.woff2', 'fonts/readex-pro-latin-500-normal.woff2', 'fonts/readex-pro-latin-600-normal.woff2'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Serve from cache first (works offline), refresh the cache in the background.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: true }) ||
                     (req.mode === 'navigate' ? await cache.match('index.html') : undefined);
      const network = fetch(req).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      if (cached) { e.waitUntil(network); return cached; }
      return network;
    })
  );
});
