// Wetter-Partikel + Overlays (Bildschirmraum, vorallokiert).
import { G } from '../state.js';
import { settings } from '../core/save.js';

const N = 320, fx = new Float32Array(N), fy = new Float32Array(N), fs = new Float32Array(N);
for (let i = 0; i < N; i++) { fx[i] = Math.random(); fy[i] = Math.random(); fs[i] = 0.6 + Math.random() * 0.8; }
let fog = null, fogW = 0;
// Fußspuren im Schnee
const TR = 90, trx = new Float32Array(TR), tryy = new Float32Array(TR), trt = new Float32Array(TR); let tri = 0, lastX = 0, lastY = 0;
export function clearTracks() { trt.fill(0); }
export function addTrack(x, y) { if (Math.abs(x - lastX) + Math.abs(y - lastY) < 13) return; lastX = x; lastY = y; trx[tri] = x; tryy[tri] = y; trt[tri] = 40; tri = (tri + 1) % TR; }
export function drawTracks(ctx, dt) {
  ctx.fillStyle = '#9fb0bd';
  for (let i = 0; i < TR; i++) { if (trt[i] <= 0) continue; trt[i] -= dt; ctx.globalAlpha = Math.min(0.8, trt[i] / 12); ctx.fillRect(trx[i] - 2 + (i & 1) * 4 - 2, tryy[i] - 2, 3, 4); }
  ctx.globalAlpha = 1;
}

export function drawWeather(ctx, v, dt) {
  const w = G.env.weather, W = v.w, H = v.h, p = G.player, u = v.css;
  const q = settings.quality < 0.75 ? 0.5 : 1;
  if ((w === 'rain' || w === 'storm') && !p.inside) {
    const n = Math.floor((w === 'storm' ? 260 : 150) * q), sp = w === 'storm' ? 2.4 : 1.8, slant = w === 'storm' ? 0.35 : 0.12;
    ctx.strokeStyle = 'rgba(170,200,235,0.5)'; ctx.lineWidth = Math.max(1, 1.2 * u); ctx.beginPath();
    for (let i = 0; i < n; i++) {
      fy[i] += sp * fs[i] * dt; fx[i] -= slant * sp * dt;
      if (fy[i] > 1) { fy[i] -= 1; fx[i] = Math.random() * 1.3; }
      const x = fx[i] * W, y = fy[i] * H;
      ctx.moveTo(x, y); ctx.lineTo(x - slant * 22 * u, y + 22 * u);
    }
    ctx.stroke();
  } else if ((w === 'snow' || w === 'blizzard') && !p.inside) {
    const bz = w === 'blizzard', n = Math.floor((bz ? 320 : 130) * q), sz = Math.max(2, 2.2 * u);
    ctx.fillStyle = G.env.season === 3 ? 'rgba(175,195,215,0.9)' : 'rgba(255,255,255,0.85)';
    for (let i = 0; i < n; i++) {
      fy[i] += (bz ? 0.5 : 0.22) * fs[i] * dt; fx[i] -= (bz ? 1.5 : 0.05 + Math.sin(fy[i] * 20 + i) * 0.03) * fs[i] * dt;
      if (fy[i] > 1) fy[i] -= 1; if (fx[i] < 0) fx[i] += 1;
      ctx.fillRect(fx[i] * W, fy[i] * H, sz * fs[i], sz * fs[i]);
    }
    if (bz) { ctx.fillStyle = 'rgba(225,232,240,0.3)'; ctx.fillRect(0, 0, W, H); }
  }
  if (w === 'fog' || w === 'blizzard') {
    if (!fog || fogW !== W) {
      fog = document.createElement('canvas'); fog.width = 64; fog.height = 64; fogW = W;
      const x = fog.getContext('2d'), g = x.createRadialGradient(32, 32, 6, 32, 32, 34);
      g.addColorStop(0, 'rgba(200,206,212,0.12)'); g.addColorStop(0.6, 'rgba(200,206,212,0.72)'); g.addColorStop(1, 'rgba(200,206,212,0.94)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    }
    ctx.imageSmoothingEnabled = true; ctx.globalAlpha = w === 'fog' ? 1 : 0.6;
    const ps = Math.max(W, H) * 1.25, px = v.px * v.scale + v.tx, py = v.py * v.scale + v.ty;
    ctx.drawImage(fog, px - ps / 2, py - ps / 2, ps, ps); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
  } else if (w === 'heat') { ctx.fillStyle = 'rgba(255,170,60,0.09)'; ctx.fillRect(0, 0, W, H); }
  if (G.lightning > 0.2) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, 0, W, H); }
}
