// Dynamische Beleuchtung: Dunkelheits-Layer mit ausgestanzten Lichtquellen (Canvas-Compositing).
import { G } from '../state.js';
import { SPR } from './sprites.js';

const LS = 3;
let lc = null, lx = null;
export const lights = { n: 0, x: new Float32Array(64), y: new Float32Array(64), r: new Float32Array(64), a: new Float32Array(64) };
export function addLight(x, y, r, a) { if (lights.n >= 64) return; const i = lights.n++; lights.x[i] = x; lights.y[i] = y; lights.r[i] = r; lights.a[i] = a; }

export function drawLighting(ctx, v) {
  const e = G.env, p = G.player;
  if (e.season === 3) { ctx.fillStyle = 'rgba(46,62,132,0.17)'; ctx.fillRect(0, 0, v.w, v.h); }      // kaltes, blaues Winterlicht
  else if (e.weather !== 'clear' && e.weather !== 'heat') { ctx.fillStyle = 'rgba(50,60,90,0.1)'; ctx.fillRect(0, 0, v.w, v.h); }
  if (e.dark > 0.02 && e.dark < 0.8 && !e.bloodMoon) { ctx.fillStyle = 'rgba(255,128,48,' + (Math.sin(e.dark / 0.8 * Math.PI) * 0.17).toFixed(3) + ')'; ctx.fillRect(0, 0, v.w, v.h); }   // warmes Dämmerungslicht
  let dark = e.dark * 0.94;
  if (e.weather === 'storm' || e.weather === 'blizzard') dark = Math.max(dark, 0.35); else if (e.weather === 'rain' || e.weather === 'fog') dark = Math.max(dark, 0.18);
  if (G.lightning > 0) dark *= 1 - Math.min(1, G.lightning * 4);
  if (dark < 0.03) { lights.n = 0; return; }
  const w = Math.ceil(v.w / LS), h = Math.ceil(v.h / LS);
  if (!lc) { lc = document.createElement('canvas'); lx = lc.getContext('2d'); }
  if (lc.width !== w || lc.height !== h) { lc.width = w; lc.height = h; }
  const s = v.scale / LS, tx = v.tx / LS, ty = v.ty / LS;
  lx.setTransform(1, 0, 0, 1, 0, 0);
  lx.globalCompositeOperation = 'source-over'; lx.globalAlpha = 1;
  lx.clearRect(0, 0, w, h);
  lx.fillStyle = e.bloodMoon ? 'rgba(30,3,6,' + dark + ')' : 'rgba(5,7,20,' + dark + ')';
  lx.fillRect(0, 0, w, h);
  lx.globalCompositeOperation = 'destination-out';
  const px = v.px * s + tx, py = v.py * s + ty;
  lx.globalAlpha = 0.75; lx.drawImage(SPR.light, px - 52 * s, py - 52 * s, 104 * s, 104 * s);
  if (p.flash) {
    const L = 250 * s;
    lx.setTransform(Math.cos(p.ang), Math.sin(p.ang), -Math.sin(p.ang), Math.cos(p.ang), px, py);
    lx.globalAlpha = 0.95; lx.drawImage(SPR.cone, 0, -L, L, 2 * L);
    lx.setTransform(1, 0, 0, 1, 0, 0);
  }
  const fl = 0.92 + Math.sin(G.tick * 0.4) * 0.05 + Math.random() * 0.04;
  if (p.torchT > 0) { const r = 135 * fl * s; lx.globalAlpha = 0.95; lx.drawImage(SPR.light, px - r, py - r, 2 * r, 2 * r); }
  if (G.flashT > 0) { const r = 190 * s; lx.globalAlpha = 1; lx.drawImage(SPR.light, px - r, py - r, 2 * r, 2 * r); }
  for (let i = 0; i < lights.n; i++) {
    const r = lights.r[i] * fl * s, x = lights.x[i] * s + tx, y = lights.y[i] * s + ty;
    lx.globalAlpha = lights.a[i]; lx.drawImage(SPR.light, x - r, y - r, 2 * r, 2 * r);
  }
  lights.n = 0;
  lx.globalAlpha = 1;
  ctx.drawImage(lc, 0, 0, v.w, v.h);
}
