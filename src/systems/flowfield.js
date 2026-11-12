// Flow-Field (Dial/Bucket-Dijkstra) zum Spieler – Horden-Pathfinding. Bauwerke sind teuer, aber passierbar (werden angegriffen).
import { T, tileSolid } from '../world/world.js';
const N = 64, INF = 65535, MAXD = 600, SCOST = 7;
const dist = new Uint16Array(N * N), cost = new Uint8Array(N * N);
const head = new Int32Array(MAXD + SCOST + 2), nCell = new Int32Array(N * N * 5), nNext = new Int32Array(N * N * 5);
let ox = 0, oy = 0, valid = false;
const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];

export function computeFlow(px, py) {
  const ptx = Math.floor(px / T), pty = Math.floor(py / T);
  ox = ptx - (N >> 1); oy = pty - (N >> 1);
  dist.fill(INF); cost.fill(0); head.fill(-1);
  let nodes = 0;
  const start = (N >> 1) + (N >> 1) * N;
  dist[start] = 0; nCell[0] = start; nNext[0] = -1; head[0] = 0; nodes = 1;
  for (let d = 0; d <= MAXD; d++) {
    for (let n = head[d]; n >= 0; n = nNext[n]) {
      const c = nCell[n]; if (dist[c] !== d) continue;
      const cx = c % N, cy = (c / N) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = cx + DX[k], ny = cy + DY[k];
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const ni = nx + ny * N;
        let cs = cost[ni];
        if (!cs) { const s = tileSolid(nx + ox, ny + oy, true); cs = cost[ni] = s === 1 ? 255 : s === 2 ? 1 + SCOST : 1; }
        if (cs === 255) continue;
        const nd = d + cs;
        if (nd < dist[ni] && nd <= MAXD && nodes < nCell.length) { dist[ni] = nd; nCell[nodes] = ni; nNext[nodes] = head[nd]; head[nd] = nodes++; }
      }
    }
  }
  valid = true;
}
// Richtung für Entität; schreibt in out.x/out.y, false wenn außerhalb/unerreichbar
export function flowDir(x, y, out) {
  if (!valid) return false;
  const tx = Math.floor(x / T) - ox, ty = Math.floor(y / T) - oy;
  if (tx < 1 || ty < 1 || tx >= N - 1 || ty >= N - 1) return false;
  const i = tx + ty * N, d0 = dist[i];
  if (d0 === INF || d0 === 0) return false;
  let best = d0, bx = 0, by = 0;
  for (let k = 0; k < 4; k++) { const d = dist[i + DX[k] + DY[k] * N]; if (d < best) { best = d; bx = DX[k]; by = DY[k]; } }
  for (let sy = -1; sy <= 1; sy += 2) for (let sx = -1; sx <= 1; sx += 2) {
    const d = dist[i + sx + sy * N];
    if (d < best && cost[i + sx] === 1 && cost[i + sy * N] === 1 && cost[i + sx + sy * N] === 1) { best = d; bx = sx; by = sy; }
  }
  if (!bx && !by) return false;
  const gx = (tx + bx + ox + 0.5) * T - x, gy = (ty + by + oy + 0.5) * T - y, m = Math.hypot(gx, gy) || 1;
  out.x = gx / m; out.y = gy / m; return true;
}
