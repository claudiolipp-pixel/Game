// Erzeugt sw.js mit aktueller Dateiliste:  node tools/make-sw.mjs
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const files = ['./', 'index.html', 'style.css', 'manifest.json'];
const walk = d => { for (const f of fs.readdirSync(path.join(root, d)).sort()) { const p = d + '/' + f; if (fs.statSync(path.join(root, p)).isDirectory()) walk(p); else files.push(p); } };
walk('src'); walk('icons');
const h = crypto.createHash('sha1');
for (const f of files.slice(1)) h.update(fs.readFileSync(path.join(root, f)));
const ver = h.digest('hex').slice(0, 10);
fs.writeFileSync(path.join(root, 'sw.js'), `// Service Worker (cache-first) – generiert von tools/make-sw.mjs
const CACHE = 'letzter-winter-${ver}';
const FILES = ${JSON.stringify(files, null, 1)};
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
`);
console.log('sw.js', ver, files.length, 'Dateien');
