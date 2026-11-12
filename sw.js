// Service Worker (cache-first) – generiert von tools/make-sw.mjs
const CACHE = 'letzter-winter-70b28929b9';
const FILES = [
 "./",
 "index.html",
 "style.css",
 "manifest.json",
 "src/config.js",
 "src/core/game.js",
 "src/core/input.js",
 "src/core/loop.js",
 "src/core/rng.js",
 "src/core/save.js",
 "src/entities/player.js",
 "src/main.js",
 "src/render/renderer.js",
 "src/render/sprites.js",
 "src/state.js",
 "src/ui/menus.js",
 "src/world/world.js",
 "icons/apple-touch-icon.png",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "icons/icon-maskable-512.png"
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => r || fetch(e.request).then(res => {
    if (res.ok && new URL(e.request.url).origin === location.origin) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); }
    return res;
  }).catch(() => caches.match('index.html'))));
});
