/* Course Card — offline service worker.
 *
 * The card (the page itself):
 *   - Always served from the cache: instant open, works with zero signal.
 *   - Only changes through an update check that the page asks for when it
 *     opens or comes back to the front. If the live card differs, the cache is
 *     replaced and the page reloads, so what's on screen always matches the
 *     cache. With no signal the check just fails quietly.
 *
 * Everything else (icons, manifest): served from cache, refreshed in the
 * background.
 *
 * Maintenance: you do NOT need to touch this file to edit the card. Just edit
 * index.html and push. Only bump CACHE below if you add or rename a FILE.
 */

const CACHE = 'course-card-v2';
const PAGE = './';

const ASSETS = [
  PAGE,
  'manifest.webmanifest',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // cache: 'reload' skips the HTTP cache, so a fresh install never
      // starts from a stale copy.
      .then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
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

const reply = (changed) =>
  new Response(JSON.stringify({ changed }), { headers: { 'Content-Type': 'application/json' } });

// Compare the live card with the cached one; replace the cache if it changed.
async function checkForUpdate() {
  try {
    const cache = await caches.open(CACHE);
    const fresh = await fetch(new Request(PAGE, { cache: 'no-store' }));
    if (!fresh.ok) return reply(false);
    const cached = await cache.match(PAGE);
    const [a, b] = await Promise.all([
      fresh.clone().text(),
      cached ? cached.text() : Promise.resolve('')
    ]);
    if (a === b) return reply(false);
    await cache.put(PAGE, fresh);
    return reply(true);
  } catch (e) {
    return reply(false); // no signal
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (new URL(req.url).searchParams.has('update-check')) {
    event.respondWith(checkForUpdate());
    return;
  }

  // The card: cache only. Falls back to the network on a first-ever visit.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(PAGE);
      if (cached) return cached;
      const res = await fetch(req);
      if (res.ok) cache.put(PAGE, res.clone());
      return res;
    })());
    return;
  }

  // Everything else: stale-while-revalidate.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });

    const fromNetwork = fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          cache.put(req, res.clone());
        }
        return res;
      })
      .catch(() => null);

    if (cached) {
      event.waitUntil(fromNetwork);
      return cached;
    }
    return (await fromNetwork) || Response.error();
  })());
});
