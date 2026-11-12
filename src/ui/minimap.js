// Minimap + große Karte.
import { G } from '../state.js';
import { groundAt, W, T, CH } from '../world/world.js';
import { PAL, ROOFCOL } from '../render/sprites.js';
import { BUILD } from '../config.js';

const GK = ['grass', 'forest', 'farm', 'swamp', 'water', 'sand', 'road', 'pave', 'floor'];
const rgb = []; let rgbSeason = -1;
function prepColors() {
  if (rgbSeason === W.season) return; rgbSeason = W.season;
  for (let i = 0; i < GK.length; i++) { const n = parseInt(PAL[W.season][GK[i]].slice(1), 16); rgb[i] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
}
let img = null, acc = 9, mctx = null;
function paint(ctx, size, step, zoom) {
  prepColors();
  const n = size / zoom;
  if (!img || img.width !== n) img = ctx.createImageData(n, n);
  const d = img.data, p = G.player, ptx = Math.floor(p.x / T), pty = Math.floor(p.y / T), half = n >> 1;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const c = rgb[groundAt(ptx + (x - half) * step, pty + (y - half) * step)], i = (x + y * n) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  if (zoom > 1) { ctx.imageSmoothingEnabled = false; ctx.drawImage(ctx.canvas, 0, 0, n, n, 0, 0, size, size); }
  const sc = zoom / step, dot = (tx, ty, col, r) => { const x = (tx - ptx) * sc + size / 2, y = (ty - pty) * sc + size / 2; if (x < 0 || y < 0 || x >= size || y >= size) return; ctx.fillStyle = col; ctx.fillRect(Math.round(x - r / 2), Math.round(y - r / 2), r, r); };
  for (const c of W.chunks.values()) if (c.bld) { const b = c.bld; ctx.fillStyle = ROOFCOL[b.type]; ctx.fillRect(Math.round((b.x - ptx) * sc + size / 2), Math.round((b.y - pty) * sc + size / 2), Math.max(2, b.w * sc), Math.max(2, b.h * sc)); }
  for (const s of W.structs.values()) { const cat = BUILD[s.id].cat; dot(s.tx, s.ty, cat === 'trap' ? '#ff4040' : cat === 'gun' ? '#40e0ff' : s.id === 'bed' ? '#ffffff' : '#ffb040', s.id === 'bed' ? 4 : 2); }
  ctx.fillStyle = '#fff'; ctx.fillRect(size / 2 - 2, size / 2 - 2, 4, 4); ctx.fillStyle = '#000'; ctx.fillRect(size / 2 - 1, size / 2 - 1, 2, 2);
}
export function updateMinimap(dt) {
  acc += dt; if (acc < 1.5) return; acc = 0;
  if (!mctx) mctx = document.getElementById('minimap').getContext('2d', { willReadFrequently: true });
  paint(mctx, 96, 3, 2);
}
export function paintBigMap(canvas) { img = null; paint(canvas.getContext('2d', { willReadFrequently: true }), canvas.width, 3, 1); img = null; acc = 9; }
