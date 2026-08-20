/**
 * ParkAlert — service worker.
 * Objectif : démarrage instantané et écran d'accueil installable.
 * La mise en relation reste évidemment en ligne : rien n'est mis en cache
 * pour Firebase, les tuiles de carte ou le géocodage.
 */

const CACHE = 'parkalert-v1';
const ASSETS = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
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
