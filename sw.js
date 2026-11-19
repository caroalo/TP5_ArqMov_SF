// Service worker: app shell offline + caché de teselas de mapa + clic en notificaciones.
const VERSION = 'sf-v1';
const TILES = 'sf-tiles-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'lib/leaflet/leaflet.js', 'lib/leaflet/leaflet.css',
  'js/app.js', 'js/api.js', 'js/logic.js', 'js/ui.js',
  'js/views/home.js', 'js/views/bikes.js', 'js/views/tax.js', 'js/views/claims.js', 'js/views/contacts.js',
  'js/views/alarms.js', 'js/views/parking.js', 'js/views/notifications.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== TILES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => c.delete(k)));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    e.respondWith(caches.open(TILES).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        c.put(req, res.clone()); trim(TILES, 300);
        return res;
      } catch { return new Response('', { status: 504 }); }
    }));
    return;
  }

  if (url.origin !== location.origin) return;

  // Stale-while-revalidate para el shell
  e.respondWith(caches.open(VERSION).then(async (c) => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
    return hit || (await net) || (req.mode === 'navigate' ? c.match('index.html') : Response.error());
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './#/notifications';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if ('focus' in c) { c.navigate?.(target); return c.focus(); } }
    return self.clients.openWindow(target);
  }));
});

// Preparado para Web Push real (requiere backend con claves VAPID).
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { /* noop */ }
  e.waitUntil(self.registration.showNotification(d.title || 'San Francisco Digital', { body: d.body || '', icon: 'icons/icon-192.png', data: { url: d.url } }));
});
