/* Course Card — offline service worker.
 *
 * Strategy: stale-while-revalidate.
 *   - Requests are served from the cache immediately (instant open, works with
 *     zero signal on the back nine).
 *   - In the background, if there IS signal, the file is re-fetched and the
 *     cache updated, so the next open shows your latest edits.
 *
 * Maintenance: you do NOT need to touch this file to edit the card. Just edit
 * index.html and push. Only bump CACHE below if you add or rename a FILE.
 */

const CACHE = 'course-card-v1';

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request, { ignoreSearch: true });

    const fromNetwork = fetch(event.request)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          cache.put(event.request, res.clone());
        }
        return res;
      })
      .catch(() => null);

    // Cache hit: serve instantly, refresh in the background.
    if (cached) {
      event.waitUntil(fromNetwork);
      return cached;
    }

    const res = await fromNetwork;
    if (res) return res;

    // Offline and never cached: fall back to the card itself for page loads.
    if (event.request.mode === 'navigate') {
      return (await cache.match('index.html')) || (await cache.match('./')) || Response.error();
    }
    return Response.error();
  })());
});
