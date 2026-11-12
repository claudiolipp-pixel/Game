// Erzeugt die App-Icons per Canvas und speichert sie als PNG:  node tools/make-icons.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const b = await chromium.launch(); const pg = await b.newPage();
const draw = (size, pad) => {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
  const u = size / 32, R = (col, a, b2, w, h) => { x.fillStyle = col; x.fillRect(Math.round(a * u), Math.round(b2 * u), Math.ceil(w * u), Math.ceil(h * u)); };
  R('#10151c', 0, 0, 32, 32);
  R('#1c2733', 0, 0, 32, 20);
  R('#e9eef2', 20, 4, 6, 6); R('#1c2733', 22, 3, 5, 5);                 // Mond
  for (const [sx, sy] of [[4, 5], [9, 9], [15, 4], [27, 13], [6, 14], [13, 12]]) R('#dfe6ea', sx, sy, 1, 1); // Schnee
  R('#dfe6ea', 0, 22, 32, 10); R('#c5ced6', 0, 22, 32, 1);
  const o = pad;                                                          // Zombie-Kopf
  R('#4f6a3d', 10 + o, 9 + o, 12 - 2 * o, 14 - 2 * o); R('#6f8a55', 11 + o, 10 + o, 10 - 2 * o, 12 - 2 * o);
  R('#300', 12 + o, 13, 3 - o, 3 - o); R('#300', 17, 13, 3 - o, 3 - o); R('#f33', 13 + o, 14, 1, 1); R('#f33', 18, 14, 1, 1);
  R('#231', 13 + o, 19 - o, 6 - 2 * o, 2); R('#dfe6ea', 14, 19 - o, 1, 1); R('#dfe6ea', 17 - o, 19 - o, 1, 1);
  return c.toDataURL('image/png');
};
for (const [name, size, pad] of [['icon-192', 192, 0], ['icon-512', 512, 0], ['icon-maskable-512', 512, 1], ['apple-touch-icon', 180, 0]]) {
  const url = await pg.evaluate(`(${draw})(${size},${pad})`);
  fs.writeFileSync(path.join(root, 'icons', name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
}
await b.close(); console.log('Icons erzeugt');
