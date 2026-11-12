// Spatial Hash für Zombies (festes Gitter um den Spieler, ohne Allokationen).
import { CFG } from '../config.js';
const CS = 48, N = 72, MAX = CFG.MAX_ZOMBIES + 16;
const head = new Int16Array(N * N), next = new Int16Array(MAX);
let ox = 0, oy = 0, listRef = null;
export const Q = { items: new Array(64), n: 0 };

export function rebuildHash(list, px, py) {
  listRef = list; head.fill(-1);
  ox = Math.floor(px / CS) - (N >> 1); oy = Math.floor(py / CS) - (N >> 1);
  for (let i = 0; i < list.length; i++) {
    const z = list[i]; if (!z.alive) continue;
    const cx = Math.floor(z.x / CS) - ox, cy = Math.floor(z.y / CS) - oy;
    if (cx < 0 || cy < 0 || cx >= N || cy >= N) continue;
    const c = cx + cy * N; next[i] = head[c]; head[c] = i;
  }
}
// Füllt Q.items mit Zombies im Kreis (max. 64), gibt Anzahl zurück
export function query(x, y, r) {
  let n = 0;
  if (!listRef) { Q.n = 0; return 0; }
  const x0 = Math.max(0, Math.floor((x - r) / CS) - ox), x1 = Math.min(N - 1, Math.floor((x + r) / CS) - ox);
  const y0 = Math.max(0, Math.floor((y - r) / CS) - oy), y1 = Math.min(N - 1, Math.floor((y + r) / CS) - oy);
  const r2 = r * r;
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
    for (let i = head[cx + cy * N]; i >= 0; i = next[i]) {
      const z = listRef[i]; if (!z.alive) continue;
      const dx = z.x - x, dy = z.y - y;
      if (dx * dx + dy * dy <= r2 && n < 64) Q.items[n++] = z;
    }
  }
  Q.n = n; return n;
}
