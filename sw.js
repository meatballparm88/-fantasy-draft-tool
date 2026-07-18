// MeatballParm Draft Assistant — service worker
// Bump CACHE when you change index.html so phones pick up the new build.
const CACHE = 'ffdraft-v23';

const SHELL = [
  'index.html',
  'manifest.webmanifest',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png',
  'icon-512-maskable.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Never cache Sleeper — draft picks must always be live.
  if (url.hostname.endsWith('sleeper.app')) return;

  if (url.origin !== self.location.origin) return;

  // HTML / navigations: NETWORK-FIRST so a new build appears immediately when
  // online. Falls back to the cached shell when offline.
  const isHTML = e.request.mode === 'navigate'
    || (e.request.headers.get('accept') || '').includes('text/html')
    || url.pathname.endsWith('.html')
    || url.pathname.endsWith('/');

  if (isHTML) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request).then(hit => hit || caches.match('index.html')))
    );
    return;
  }

  // Other same-origin assets (icons, manifest): cache-first, revalidate in background.
  e.respondWith(
    caches.match(e.request).then(hit => {
      const net = fetch(e.request)
        .then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
