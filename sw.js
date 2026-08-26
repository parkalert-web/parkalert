/**
 * ParkAlert — service worker.
 * Objectif : démarrage instantané et écran d'accueil installable.
 * La mise en relation reste évidemment en ligne : rien n'est mis en cache
 * pour Firebase, les tuiles de carte ou le géocodage.
 */

const CACHE = 'parkalert-v2';
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'confidentialite.html',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'src/app.js',
  'src/backend.js',
  'src/config.js',
  'src/core.js',
  'src/give.js',
  'src/mapview.js',
  'src/panel.js',
  'src/pickers.js',
  'src/profile.js',
  'src/seek.js',
  'src/session.js',
  'src/state.js',
  'src/ui.js',
  'src/vehicles.js',
  'src/push.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return; // Firebase, tuiles, Nominatim : toujours en direct
  // Le jeu hébergé sous /minecraft/ a son propre cycle de vie : on le laisse
  // au réseau, sinon son repli hors ligne renverrait l'écran de ParkAlert.
  if (url.pathname.includes('/minecraft/')) return;

  // « Network first » : l'application se met à jour dès qu'une nouvelle version est en ligne.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('index.html'))),
  );
});

/* ══════════════════════════════════════════════════════════════════════
   Notifications reçues du serveur, application fermée.
   ══════════════════════════════════════════════════════════════════════ */

self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { body: e.data?.text() || '' }; }

  e.waitUntil(self.registration.showNotification(data.title || 'ParkAlert', {
    body: data.body || '',
    tag: data.tag || 'parkalert',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    // Une place ne se garde pas : la notification doit se voir tout de suite.
    renotify: true,
    requireInteraction: false,
    vibrate: [60, 40, 60],
    data: { url: data.url || './' },
  }));
});

/** Un appui sur la notification ramène sur l'application déjà ouverte, sinon l'ouvre. */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL(e.notification.data?.url || './', self.location.origin).href;

  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate?.(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }));
});
