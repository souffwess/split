/*
  SERVICE WORKER for Split
  -------------------------
  This is the little helper that keeps a saved copy of the app on the
  phone so it can OPEN even with no internet connection.

  - The page (index.html): "network-first" — when you're online you always
    get the latest version; when offline you get the saved copy.
  - The Supabase library: "cache-first" — it rarely changes, so we serve the
    saved copy instantly.
  - Supabase data calls: never cached — those always go to the network so
    your data is live (and just fail gracefully when offline).
*/

const CACHE = 'split-v5';
const ASSETS = [
  './',
  './index.html',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Save the app shell when the worker is first installed.
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
});

// Clean up any older cached versions.
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;            // only handle reads

  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return; // never cache live data calls

  // The page itself: try the network first, fall back to the saved copy.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Everything else (e.g. the Supabase library): saved copy first.
  e.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return res;
      }).catch(() => cached)
    )
  );
});
