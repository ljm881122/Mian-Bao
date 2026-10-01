/* Mian & Bao Kitchen SOP — service worker
   Opens the app instantly from the local cache. The page checks the build
   number on every launch (a light "has it changed?" request) and reloads
   only when a newer version is on the server. */
const CACHE = 'mb-sop-v2';
const APP = new URL('./', self.registration.scope).href;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

const isAppPage = u => u.origin === self.location.origin &&
  (u.pathname.endsWith('/') || u.pathname.endsWith('.html'));

async function fresh(url) {               // conditional request: 304 when unchanged
  const cache = await caches.open(CACHE);
  const res = await fetch(url, { cache: 'no-cache' });
  if (res.ok) await cache.put(APP, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (isAppPage(url)) {
    if (req.mode === 'navigate') {
      // open from cache instantly; refresh the cached copy in the background
      e.respondWith((async () => {
        const hit = await (await caches.open(CACHE)).match(APP);
        const net = fresh(req.url).catch(() => null);
        if (hit) { e.waitUntil(net); return hit; }
        return (await net) || new Response('Offline', { status: 503 });
      })());
    } else {
      // the page's version check: ask the server, fall back to cache offline
      e.respondWith(fresh(req.url).catch(async () =>
        (await (await caches.open(CACHE)).match(APP)) || Response.error()));
    }
    return;
  }

  // Google Fonts: keep a local copy
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
      return res;
    })());
  }
});
