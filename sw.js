// Service Worker (cache-first) – generiert von tools/make-sw.mjs
const CACHE = 'letzter-winter-7ac77824a8';
const FILES = [
 "./",
 "index.html",
 "style.css",
 "manifest.json",
 "src/audio/audio.js",
 "src/building/build.js",
 "src/building/structures.js",
 "src/building/turrets.js",
 "src/config.js",
 "src/core/game.js",
 "src/core/input.js",
 "src/core/loop.js",
 "src/core/rng.js",
 "src/core/save.js",
 "src/entities/fx.js",
 "src/entities/player.js",
 "src/entities/projectiles.js",
 "src/entities/zombies.js",
 "src/main.js",
 "src/render/lighting.js",
 "src/render/renderer.js",
 "src/render/sprites.js",
 "src/render/weatherfx.js",
 "src/state.js",
 "src/systems/combat.js",
 "src/systems/flowfield.js",
 "src/systems/interact.js",
 "src/systems/inventory.js",
 "src/systems/noise.js",
 "src/systems/spatial.js",
 "src/systems/survival.js",
 "src/ui/hud.js",
 "src/ui/menus.js",
 "src/ui/minimap.js",
 "src/ui/tutorial.js",
 "src/world/time.js",
 "src/world/weather.js",
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
