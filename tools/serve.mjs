// Minimaler statischer Server ohne Abhängigkeiten:  node tools/serve.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const port = +process.argv[2] || 8080;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.md': 'text/plain; charset=utf-8' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(port, '0.0.0.0', () => {
  console.log(`Letzter Winter läuft auf:\n  http://localhost:${port}/`);
  for (const list of Object.values(os.networkInterfaces())) for (const i of list)
    if (i.family === 'IPv4' && !i.internal) console.log(`  http://${i.address}:${port}/   (iPad im selben WLAN)`);
});
