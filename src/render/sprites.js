// Prozedurale Pixel-Art: alle Grafiken werden hier im Code erzeugt (keine externen Assets).
import { ITEMS, BUILD, ZT } from '../config.js';

export function mk(w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; fn(x, w, h); return c;
}
// Verfeinert ein 16er-Sprite auf doppelte Auflösung: EPX-Glättung der Kanten + leichte Körnung (kein Klötzchen-Look)
export function up(src) {
  const w = src.width, h = src.height, sd = src.getContext('2d').getImageData(0, 0, w, h), a = new Uint32Array(sd.data.buffer);
  const out = document.createElement('canvas'); out.width = w * 2; out.height = h * 2;
  const ox = out.getContext('2d'), od = ox.createImageData(w * 2, h * 2), o = new Uint32Array(od.data.buffer), d8 = od.data;
  const at = (x, y) => a[Math.min(w - 1, Math.max(0, x)) + Math.min(h - 1, Math.max(0, y)) * w];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1), i = x * 2 + y * 2 * w * 2;
    o[i] = (C === A && C !== D && A !== B) ? A : P; o[i + 1] = (A === B && A !== C && B !== D) ? B : P;
    o[i + w * 2] = (D === C && D !== B && C !== A) ? C : P; o[i + w * 2 + 1] = (B === D && B !== A && D !== C) ? D : P;
  }
  let r = 12345 + w * 7;
  for (let i = 0; i < o.length; i++) {
    r = (Math.imul(r, 1664525) + 1013904223) >>> 0; if (d8[i * 4 + 3] < 200) continue;
    const f = 0.93 + (r >>> 24) / 255 * 0.14;
    d8[i * 4] = Math.min(255, d8[i * 4] * f); d8[i * 4 + 1] = Math.min(255, d8[i * 4 + 1] * f); d8[i * 4 + 2] = Math.min(255, d8[i * 4 + 2] * f);
  }
  ox.putImageData(od, 0, 0); return out;
}
const R = (x, col, a, b, w, h) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r * f))); g = Math.max(0, Math.min(255, Math.round(g * f))); b = Math.max(0, Math.min(255, Math.round(b * f)));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
export { shade };

// ---------- Figuren (Blick nach rechts, 16x16) ----------
let fseed = 1;
const frnd = () => { fseed = (Math.imul(fseed, 1664525) + 1013904223) >>> 0; return fseed / 4294967296; };
// Figur von oben (Blick nach rechts, 32x32): runde Formen, Rand-Schattierung, dunkle Kontur
function humanoid(body, skin, hair, zombie, seed) {
  return mk(32, 32, x => {
    fseed = seed || 7; const buf = new Array(1024).fill(null);
    const put = (cx, cy, rx, ry, col) => {
      for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let xx = Math.floor(cx - rx); xx <= cx + rx; xx++) {
        if (xx < 0 || y < 0 || xx > 31 || y > 31) continue;
        const d = ((xx - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d <= 1) buf[xx + y * 32] = shade(col, (d > 0.7 ? 0.72 : d < 0.22 ? 1.12 : 0.95) + frnd() * 0.08);
      }
    };
    const limb = (x0, y0, x1, y1, r, c0, c1, cut) => { for (let t = 0; t <= 1.001; t += 0.07) put(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, t > cut ? c1 : c0); };
    if (zombie) { limb(14, 8, 27, 10.5, 2.3, body, skin, 0.35); limb(14, 24, 26, 20.5, 2.3, body, skin, 0.5); }
    else { limb(14, 8, 22, 11, 2.4, body, skin, 0.78); limb(14, 24, 22, 21, 2.4, body, skin, 0.78); put(10, 16, 4, 6.5, shade(body, 0.55)); }
    put(14, 16, 5.6, 9.2, body);
    if (zombie) for (let i = 0; i < 9; i++) { const xx = 10 + (frnd() * 8 | 0), y = 9 + (frnd() * 14 | 0); if (buf[xx + y * 32]) buf[xx + y * 32] = frnd() < 0.5 ? '#4a1410' : shade(body, 0.55); }
    put(17.5, 16, 5.2, 5.2, skin);
    put(15.2, 16, zombie ? 3.2 : 4.2, zombie ? 4.2 : 5.3, hair);
    if (zombie) { buf[21 + 14 * 32] = '#2a0606'; buf[21 + 18 * 32] = '#2a0606'; buf[22 + 16 * 32] = '#3a0a0a'; }
    for (let i = 0; i < 1024; i++) {
      if (buf[i]) { x.fillStyle = buf[i]; x.fillRect(i & 31, i >> 5, 1, 1); continue; }
      const xx = i & 31, y = i >> 5;
      if ((xx > 0 && buf[i - 1]) || (xx < 31 && buf[i + 1]) || (y > 0 && buf[i - 32]) || (y < 31 && buf[i + 32])) { x.fillStyle = 'rgba(18,14,10,0.8)'; x.fillRect(xx, y, 1, 1); }
    }
  });
}
// Unregelmäßiger, schattierter Klecks (Fels, Busch) mit Bodenschatten
function blob(size, rx, ry, hi, mid, lo, seed, dots) {
  return mk(size, size, x => {
    fseed = seed; const c = size / 2;
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(c + 2, c + 4, rx, ry * 0.8, 0, 0, 6.283); x.fill();
    for (let y = 0; y < size; y++) for (let xx = 0; xx < size; xx++) {
      const dx = (xx - c + 0.5) / rx, dy = (y - c + 1.5) / ry, d = Math.sqrt(dx * dx + dy * dy) + frnd() * 0.16;
      if (d > 1) continue;
      const lit = (-dx - dy) * 0.55 + frnd() * 0.45;
      x.fillStyle = d > 0.9 ? shade(lo, 0.75) : lit > 0.5 ? hi : lit > 0 ? mid : lo; x.fillRect(xx, y, 1, 1);
    }
    if (dots) for (let i = 0; i < 7; i++) { const a = frnd() * 6.283, r = frnd() * 0.65; x.fillStyle = dots; x.fillRect(c + Math.cos(a) * rx * r | 0, c - 1 + Math.sin(a) * ry * r | 0, 2, 2); x.fillStyle = shade(dots, 1.4); x.fillRect(c + Math.cos(a) * rx * r | 0, c - 1 + Math.sin(a) * ry * r | 0, 1, 1); }
  });
}
const ZBODY = { walker: '#5a5a4a', runner: '#6a5038', crawler: '#3a3e34', screamer: '#8a8a88', brute: '#4a3434' };
export const SPR = { z: {}, zf: {}, item: {}, build: {}, tiles: [] };

export function initSprites() {
  SPR.player = humanoid('#3d4f5c', '#c9a27e', '#3a2a1c', false, 3);
  for (const k in ZT) {
    SPR.z[k] = humanoid(ZBODY[k] || '#5a5248', ZT[k].col, shade(ZT[k].col, 0.45), true, 11 + k.length * 13);
    SPR.zf[k] = humanoid('#6f8ea4', '#b4d2e0', '#e2eef4', true, 5 + k.length * 7);   // Frost-Variante
  }
  for (const k of ['deer', 'rabbit']) SPR.z[k] = SPR.zf[k] = up(mk(16, 16, x => {
    const c = ZT[k].col; R(x, shade(c, 0.8), 3, 5, 9, 6); R(x, c, 4, 6, 7, 4); R(x, c, 11, 6, 3, 4); R(x, shade(c, 0.6), 13, 6, 1, 1); R(x, shade(c, 0.6), 13, 9, 1, 1);
    R(x, shade(c, 0.6), 4, 4, 2, 1); R(x, shade(c, 0.6), 4, 11, 2, 1); R(x, shade(c, 0.6), 9, 4, 2, 1); R(x, shade(c, 0.6), 9, 11, 2, 1); R(x, '#eee', 2, 7, 1, 2);
    if (k === 'deer') { R(x, '#d8c8a0', 12, 4, 1, 2); R(x, '#d8c8a0', 12, 10, 1, 2); }
  }));
  SPR.light = mk(128, 128, x => {
    const g = x.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  });
  SPR.cone = mk(256, 256, x => {   // Taschenlampen-Kegel, Ursprung links-mitte
    const g = x.createRadialGradient(0, 128, 6, 0, 128, 250);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.7, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.moveTo(0, 128); x.arc(0, 128, 250, -0.42, 0.42); x.closePath(); x.fill();
  });
  SPR.bag = mk(8, 8, x => { R(x, '#8a6a3a', 1, 2, 6, 5); R(x, '#a8844a', 2, 3, 4, 3); R(x, '#5a4020', 3, 1, 2, 1); });
  SPR.mark = mk(8, 8, x => { R(x, '#ffcc00', 3, 0, 2, 5); R(x, '#ffcc00', 3, 6, 2, 2); });
  for (const id in ITEMS) SPR.item[id] = up(mk(16, 16, x => drawItem(x, id)));
  for (const id in BUILD) SPR.build[id] = up(mk(16, 16, x => drawBuild(x, id)));
  SPR.build.beartrap_shut = up(mk(16, 16, x => { R(x, '#555', 3, 7, 10, 2); R(x, '#888', 4, 6, 8, 1); R(x, '#888', 4, 9, 8, 1); R(x, '#333', 7, 7, 2, 2); }));
  SPR.build.plot1 = up(mk(16, 16, x => { drawBuild(x, 'plot'); for (let i = 0; i < 3; i++) R(x, '#6c4', 3 + i * 4, 6, 1, 2), R(x, '#6c4', 5 + i * 4, 10, 1, 2); }));
  SPR.build.plot2 = up(mk(16, 16, x => { drawBuild(x, 'plot'); for (let i = 0; i < 3; i++) { R(x, '#4a3', 2 + i * 4, 4, 3, 4); R(x, '#e84', 3 + i * 4, 5, 1, 1); R(x, '#4a3', 4 + i * 4, 9, 3, 4); R(x, '#e84', 5 + i * 4, 10, 1, 1); } }));
  SPR.build.campfire_off = up(mk(16, 16, x => { ring(x); R(x, '#333', 6, 6, 4, 4); }));
  SPR.build.gas_burn = up(mk(16, 16, x => { R(x, '#f80', 2, 3, 12, 10); R(x, '#fc3', 4, 5, 8, 6); R(x, '#fff3a0', 6, 7, 4, 3); }));
  SPR.lvl = [null, mk(16, 16, x => { R(x, '#b8bcc4', 0, 0, 2, 2); R(x, '#b8bcc4', 14, 0, 2, 2); R(x, '#b8bcc4', 0, 14, 2, 2); R(x, '#b8bcc4', 14, 14, 2, 2); }),
    mk(16, 16, x => { R(x, '#3c4048', 0, 0, 16, 1); R(x, '#3c4048', 0, 15, 16, 1); R(x, '#3c4048', 0, 0, 1, 16); R(x, '#3c4048', 15, 0, 1, 16); R(x, '#ffd060', 0, 0, 2, 2); R(x, '#ffd060', 14, 0, 2, 2); R(x, '#ffd060', 0, 14, 2, 2); R(x, '#ffd060', 14, 14, 2, 2); })];
  SPR.lvl[1] = up(SPR.lvl[1]); SPR.lvl[2] = up(SPR.lvl[2]); SPR.bag = up(SPR.bag);
  for (let s = 0; s < 4; s++) SPR.tiles[s] = makeTileSet(s);
}

function ring(x) { R(x, '#777', 4, 3, 8, 2); R(x, '#777', 4, 11, 8, 2); R(x, '#777', 3, 4, 2, 8); R(x, '#777', 11, 4, 2, 8); R(x, '#555', 5, 5, 6, 6); }

function drawBuild(x, id) {
  switch (id) {
    case 'wall_w': R(x, '#7a5530', 0, 0, 16, 16); for (let i = 0; i < 4; i++) R(x, '#5c3f22', 0, i * 4 + 3, 16, 1); R(x, '#94693c', 0, 0, 16, 1); R(x, '#3e2a16', 5, 0, 1, 16); R(x, '#3e2a16', 11, 0, 1, 16); break;
    case 'wall_s': R(x, '#8a8d92', 0, 0, 16, 16); for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) { R(x, '#6b6e73', (i * 6 + (j % 2) * 3) % 16, j * 4, 1, 4); } for (let j = 0; j < 4; j++) R(x, '#6b6e73', 0, j * 4 + 3, 16, 1); break;
    case 'door': R(x, '#5c3f22', 0, 5, 16, 6); R(x, '#94693c', 1, 6, 14, 4); R(x, '#ffd060', 12, 7, 2, 2); R(x, '#3e2a16', 0, 4, 2, 8); R(x, '#3e2a16', 14, 4, 2, 8); break;
    case 'barricade': R(x, '#7a5530', 1, 2, 14, 3); R(x, '#6a4828', 1, 11, 14, 3); R(x, '#8a6238', 2, 1, 3, 14); R(x, '#8a6238', 11, 1, 3, 14); R(x, '#5c3f22', 3, 6, 10, 2); break;
    case 'campfire': ring(x); R(x, '#f80', 6, 5, 4, 6); R(x, '#fc3', 7, 6, 2, 4); R(x, '#f40', 5, 7, 6, 2); break;
    case 'collector': R(x, '#5c3f22', 1, 1, 14, 14); R(x, '#3a7ab0', 3, 3, 10, 10); R(x, '#5aa0d0', 4, 4, 5, 4); R(x, '#888', 0, 0, 2, 2); R(x, '#888', 14, 0, 2, 2); R(x, '#888', 0, 14, 2, 2); R(x, '#888', 14, 14, 2, 2); break;
    case 'plot': R(x, '#5c3f22', 0, 0, 16, 16); R(x, '#4a3018', 1, 1, 14, 14); for (let i = 0; i < 4; i++) R(x, '#3a2410', 1, 2 + i * 4, 14, 1); break;
    case 'chest': R(x, '#7a5530', 1, 3, 14, 11); R(x, '#94693c', 1, 3, 14, 3); R(x, '#3e2a16', 1, 7, 14, 1); R(x, '#ffd060', 7, 6, 2, 3); R(x, '#3e2a16', 1, 3, 1, 11); R(x, '#3e2a16', 14, 3, 1, 11); break;
    case 'bed': R(x, '#5c3f22', 1, 2, 14, 12); R(x, '#a03030', 4, 3, 10, 10); R(x, '#e8e8e0', 2, 4, 3, 8); R(x, '#802020', 4, 3, 10, 1); break;
    case 'spikes': R(x, '#2a1c10', 1, 1, 14, 14); for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { R(x, '#c8b890', 3 + i * 4, 3 + j * 4, 2, 2); R(x, '#fff', 3 + i * 4, 3 + j * 4, 1, 1); } break;
    case 'beartrap': R(x, '#555', 3, 3, 10, 10); R(x, '#222', 4, 4, 8, 8); for (let i = 0; i < 4; i++) { R(x, '#aaa', 4 + i * 2, 3, 1, 2); R(x, '#aaa', 5 + i * 2, 11, 1, 2); } R(x, '#844', 7, 7, 2, 2); break;
    case 'wire': for (let i = 0; i < 3; i++) { R(x, '#888', 0, 3 + i * 5, 16, 1); for (let k = 0; k < 4; k++) R(x, '#bbb', 1 + k * 4 + (i % 2) * 2, 2 + i * 5, 1, 3); } R(x, '#5c3f22', 0, 1, 2, 14); R(x, '#5c3f22', 14, 1, 2, 14); break;
    case 'tripwire': R(x, '#5c3f22', 1, 6, 2, 4); R(x, '#5c3f22', 13, 6, 2, 4); R(x, '#ccc', 3, 8, 10, 1); R(x, '#b33', 5, 9, 2, 3); R(x, '#999', 9, 9, 2, 3); break;
    case 'lure': R(x, '#444', 4, 4, 8, 9); R(x, '#eee', 5, 5, 6, 6); R(x, '#c33', 8, 6, 1, 3); R(x, '#222', 8, 8, 2, 1); R(x, '#cc3', 4, 2, 3, 2); R(x, '#cc3', 9, 2, 3, 2); break;
    case 'gas': R(x, '#3a3520', 3, 4, 10, 8); R(x, '#4a452a', 2, 6, 12, 4); R(x, '#6a6540', 5, 6, 4, 2); R(x, '#807a50', 9, 8, 2, 1); break;
    case 'bomb': R(x, '#555', 4, 6, 8, 4); R(x, '#777', 4, 6, 8, 1); R(x, '#c33', 11, 5, 2, 2); R(x, '#ccc', 0, 11, 16, 1); R(x, '#333', 3, 6, 1, 4); R(x, '#333', 12, 6, 1, 4); break;
    case 'spikewall': R(x, '#5c3f22', 0, 6, 16, 4); for (let i = 0; i < 4; i++) { R(x, '#94693c', 1 + i * 4, 1, 2, 14); R(x, '#d8c8a0', 1 + i * 4, 0, 2, 2); R(x, '#d8c8a0', 1 + i * 4, 14, 2, 2); } break;
    case 'xbow': R(x, '#5c3f22', 2, 2, 12, 12); R(x, '#7a5530', 3, 3, 10, 10); break;
    case 'sgtrap': R(x, '#444', 2, 3, 12, 10); R(x, '#666', 3, 4, 10, 8); R(x, '#222', 8, 6, 8, 2); R(x, '#222', 8, 9, 8, 2); R(x, '#a33', 3, 7, 3, 2); break;
    case 'flamer': R(x, '#633', 2, 2, 12, 12); R(x, '#944', 3, 3, 10, 10); break;
    case 'mg': R(x, '#4a5a3a', 0, 0, 16, 16); R(x, '#3a4a2c', 2, 2, 12, 12); R(x, '#6a7a54', 0, 0, 16, 2); R(x, '#6a7a54', 0, 14, 16, 2); R(x, '#6a7a54', 14, 0, 2, 16); break;
    case 'gen': R(x, '#a82', 1, 3, 14, 10); R(x, '#c93', 1, 3, 14, 2); R(x, '#333', 3, 6, 5, 5); R(x, '#666', 4, 7, 3, 3); R(x, '#222', 10, 6, 3, 1); R(x, '#222', 10, 8, 3, 1); R(x, '#222', 10, 10, 3, 1); break;
    case 'fence': R(x, '#666', 1, 0, 2, 16); R(x, '#666', 13, 0, 2, 16); for (let i = 0; i < 4; i++) R(x, '#9ab', 0, 2 + i * 4, 16, 1); R(x, '#fe4', 7, 6, 2, 4); break;
  }
}
// Drehbare Turm-Köpfe (Blick nach rechts)
export const HEAD = {};
export function initHeads() {
  HEAD.xbow = up(mk(16, 16, x => { R(x, '#3e2a16', 4, 7, 10, 2); R(x, '#888', 10, 2, 1, 12); R(x, '#888', 9, 3, 1, 2); R(x, '#888', 9, 11, 1, 2); R(x, '#ccc', 12, 7, 3, 2); }));
  HEAD.flamer = up(mk(16, 16, x => { R(x, '#333', 5, 6, 9, 4); R(x, '#f80', 14, 7, 2, 2); R(x, '#a33', 3, 5, 4, 6); }));
  HEAD.mg = up(mk(16, 16, x => { R(x, '#222', 5, 7, 11, 2); R(x, '#444', 4, 5, 5, 6); R(x, '#333', 9, 6, 2, 4); }));
}

function drawItem(x, id) {
  const it = ITEMS[id];
  switch (id) {
    case 'wood': R(x, '#7a5530', 2, 5, 12, 3); R(x, '#94693c', 2, 9, 12, 3); R(x, '#c9a070', 2, 5, 1, 3); R(x, '#c9a070', 13, 9, 1, 3); return;
    case 'stone': R(x, '#8a8d92', 3, 6, 10, 7); R(x, '#a5a8ad', 4, 5, 7, 3); R(x, '#6b6e73', 5, 11, 8, 2); return;
    case 'scrap': R(x, '#777', 3, 4, 6, 6); R(x, '#999', 7, 8, 6, 5); R(x, '#555', 5, 6, 2, 2); R(x, '#b63', 9, 10, 2, 2); return;
    case 'cloth': R(x, '#c8c0a8', 3, 4, 10, 9); R(x, '#a8a088', 3, 7, 10, 1); R(x, '#a8a088', 3, 10, 10, 1); return;
    case 'fuel': R(x, '#b22', 4, 4, 8, 10); R(x, '#d44', 5, 5, 6, 3); R(x, '#333', 9, 2, 3, 2); R(x, '#fc3', 6, 9, 4, 3); return;
    case 'elec': R(x, '#285', 3, 4, 10, 8); R(x, '#fc3', 4, 5, 2, 2); R(x, '#222', 8, 6, 4, 3); R(x, '#ccc', 4, 12, 1, 2); R(x, '#ccc', 7, 12, 1, 2); R(x, '#ccc', 10, 12, 1, 2); return;
    case 'powder': R(x, '#444', 4, 6, 8, 8); R(x, '#222', 5, 7, 6, 6); R(x, '#a82', 6, 3, 4, 3); return;
    case 'seeds': R(x, '#c9b877', 4, 5, 8, 9); R(x, '#4a3', 6, 7, 4, 4); R(x, '#a89858', 4, 5, 8, 1); return;
    case 'bottle': case 'dwater': case 'water': R(x, '#9bd', 6, 2, 4, 3); R(x, '#cde', 5, 5, 6, 9);
      if (id !== 'bottle') R(x, id === 'water' ? '#39c' : '#685', 5, 7, 6, 7); R(x, '#fff', 6, 6, 1, 4); return;
    case 'can': R(x, '#999', 4, 4, 8, 9); R(x, '#c33', 4, 6, 8, 5); R(x, '#fff', 6, 8, 4, 1); R(x, '#bbb', 4, 4, 8, 1); return;
    case 'berries': R(x, '#a2254a', 4, 6, 4, 4); R(x, '#c2355a', 8, 8, 4, 4); R(x, '#a2254a', 7, 4, 3, 3); R(x, '#4a3', 6, 3, 2, 1); return;
    case 'rawmeat': R(x, '#c44', 3, 5, 9, 7); R(x, '#e88', 5, 7, 4, 3); R(x, '#eee', 11, 10, 3, 2); return;
    case 'meat': R(x, '#853', 3, 5, 9, 7); R(x, '#a64', 5, 7, 4, 3); R(x, '#eee', 11, 10, 3, 2); return;
    case 'veg': R(x, '#e73', 5, 6, 3, 8); R(x, '#4a3', 4, 3, 5, 3); R(x, '#d33', 9, 7, 4, 5); R(x, '#4a3', 10, 6, 2, 1); return;
    case 'rotten': R(x, '#564', 4, 5, 8, 8); R(x, '#342', 6, 7, 3, 3); R(x, '#786', 9, 10, 2, 2); return;
    case 'bandage': R(x, '#eee', 3, 5, 10, 7); R(x, '#c33', 7, 6, 2, 5); R(x, '#c33', 5, 8, 6, 1); return;
    case 'medkit': R(x, '#c33', 2, 4, 12, 9); R(x, '#fff', 7, 5, 2, 7); R(x, '#fff', 4, 8, 8, 2); R(x, '#822', 6, 2, 4, 2); return;
    case 'antibio': R(x, '#e80', 5, 4, 6, 10); R(x, '#fff', 5, 4, 6, 3); R(x, '#fff', 6, 9, 4, 3); return;
    case 'knife': R(x, '#ccc', 7, 2, 2, 8); R(x, '#fff', 7, 2, 1, 7); R(x, '#5c3f22', 7, 10, 2, 4); return;
    case 'bat': R(x, '#94693c', 7, 2, 3, 9); R(x, '#7a5530', 7, 11, 2, 3); R(x, '#333', 7, 13, 2, 1); return;
    case 'crowbar': R(x, '#345', 7, 3, 2, 11); R(x, '#345', 9, 3, 3, 2); R(x, '#567', 7, 3, 1, 10); return;
    case 'axe': R(x, '#7a5530', 7, 2, 2, 12); R(x, '#aaa', 9, 3, 4, 5); R(x, '#eee', 12, 3, 1, 5); return;
    case 'pistol': R(x, '#333', 3, 6, 10, 3); R(x, '#222', 4, 9, 3, 4); R(x, '#555', 3, 6, 10, 1); return;
    case 'shotgun': R(x, '#333', 1, 6, 11, 2); R(x, '#7a5530', 10, 6, 5, 4); R(x, '#555', 4, 8, 4, 2); return;
    case 'rifle': R(x, '#222', 1, 7, 12, 2); R(x, '#5c3f22', 9, 7, 6, 4); R(x, '#444', 5, 5, 4, 2); return;
    case 'bow': R(x, '#7a5530', 5, 2, 2, 3); R(x, '#7a5530', 7, 4, 2, 8); R(x, '#7a5530', 5, 11, 2, 3); R(x, '#ddd', 4, 2, 1, 12); return;
    case 'torch': R(x, '#7a5530', 7, 6, 2, 8); R(x, '#f80', 6, 2, 4, 5); R(x, '#fc3', 7, 3, 2, 3); return;
    case 'ammo9': case 'ammoR': case 'shells': { const c = id === 'shells' ? '#c33' : id === 'ammoR' ? '#b83' : '#da4'; for (let i = 0; i < 3; i++) { R(x, c, 3 + i * 4, 6, 2, 7); R(x, '#eee', 3 + i * 4, 4, 2, 2); } return; }
    case 'arrow': case 'bolt': R(x, '#94693c', 3, 7, 9, 1); R(x, '#ccc', 12, 6, 2, 3); R(x, id === 'bolt' ? '#555' : '#c33', 2, 6, 2, 3); R(x, '#94693c', 3, 11, 9, 1); R(x, '#ccc', 12, 10, 2, 3); return;
    case 'pack1': case 'pack2': R(x, id === 'pack2' ? '#375' : '#853', 3, 3, 10, 11); R(x, '#222', 5, 2, 6, 2); R(x, id === 'pack2' ? '#486' : '#a74', 5, 7, 6, 5); R(x, '#ccc', 7, 8, 2, 1); return;
  }
  if (it.t === 'cloth') { const c = { jacket: '#685', coat: '#458', vest: '#333', shirt: '#cca' }[id]; R(x, c, 4, 3, 8, 11); R(x, c, 1, 3, 3, 6); R(x, c, 12, 3, 3, 6); R(x, shade(c, 0.7), 7, 3, 2, 11); return; }
  if (it.t === 'bp') { R(x, '#27a', 2, 3, 12, 10); R(x, '#9cf', 4, 5, 8, 1); R(x, '#9cf', 4, 7, 5, 1); R(x, '#9cf', 4, 9, 7, 1); R(x, '#fff', 2, 3, 12, 1); return; }
  R(x, '#888', 4, 4, 8, 8);
}

// ---------- Jahreszeiten-Paletten + Kachel-Sprites ----------
export const PAL = [
  { grass: '#6b7340', grassB: '#5f6838', forest: '#56603a', farm: '#74603c', farmB: '#665434', swamp: '#4c5238', water: '#3c5a66', waterB: '#4a6a76', sand: '#8f8562', road: '#4a4a48', pave: '#6a6a62', floor: '#75684f', tree: '#4f6a36', treeB: '#3a5028', bush: '#58703a', flower: '#b8a85a', crop: '#7d8a44' },
  { grass: '#7a7a3e', grassB: '#6e6e36', forest: '#5c6434', farm: '#84703c', farmB: '#746234', swamp: '#535434', water: '#3a5c6a', waterB: '#486c7a', sand: '#9a8c60', road: '#4c4c49', pave: '#6e6e64', floor: '#75684f', tree: '#4a6430', treeB: '#364a22', bush: '#566a32', flower: '#c8c0a0', crop: '#a8963c' },
  { grass: '#7c6e3c', grassB: '#6e6034', forest: '#66522e', farm: '#6a5234', farmB: '#5c462c', swamp: '#54482e', water: '#3a5260', waterB: '#47606e', sand: '#8a7c5a', road: '#474745', pave: '#66665e', floor: '#75684f', tree: '#9a5c28', treeB: '#6e3c1c', bush: '#7c5a2a', flower: '#8a4428', crop: '#a07030' },
  { grass: '#c9d0d2', grassB: '#bcc4c8', forest: '#b8c2c4', farm: '#c0c4c0', farmB: '#b0b6b2', swamp: '#a4aeae', water: '#9ab8c4', waterB: '#acc8d2', sand: '#c2c2b8', road: '#7c8084', pave: '#a0a4a6', floor: '#75684f', tree: '#dfe6e8', treeB: '#4c6252', bush: '#b4c2be', flower: '#ffffff', crop: '#989e90' },
];
export const WALLCOL = { house: '#7a5a48', market: '#5f6e72', hardware: '#8a6a3a', police: '#3e4a5c', gas: '#8c8c84', military: '#555c40', farm: '#6e5236' };
export const ROOFCOL = { house: '#4e5052', market: '#3e4a52', hardware: '#5a4a34', police: '#2c3440', gas: '#7a3a30', military: '#3a402c', farm: '#4c3626' };

let lcg = 1;
const rnd = () => { lcg = (Math.imul(lcg, 1664525) + 1013904223) >>> 0; return lcg / 4294967296; };
function canopy(p, s, variant) {
  return mk(48, 48, x => {
    lcg = 77 + variant * 131 + s * 17;
    const hi = shade(p.tree, 1.2), lo = shade(p.treeB, 0.72), cl = [];
    for (let i = 0; i < 9; i++) cl.push(8 + rnd() * 32, 8 + rnd() * 30);      // Blattbüschel
    for (let y = 0; y < 48; y++) for (let xx = 0; xx < 48; xx++) {
      const dx = xx - 23.5, dy = (y - 22.5) * 1.06, d = Math.sqrt(dx * dx + dy * dy) + rnd() * 4.5 + Math.sin(Math.atan2(dy, dx) * 5 + variant * 2) * 1.6;
      if (d > 21.5) continue;
      let near = 99; for (let i = 0; i < cl.length; i += 2) { const q = Math.hypot(xx - cl[i], y - cl[i + 1]); if (q < near) near = q; }
      const lit = (-dx - dy) / 34 + rnd() * 0.5 - near * 0.045 + 0.2;
      x.fillStyle = d > 19.5 ? lo : lit > 0.5 ? hi : lit > 0.08 ? p.tree : lit > -0.3 ? p.treeB : lo;
      x.fillRect(xx, y, 1, 1);
    }
    if (s === 3) for (let i = 0; i < 90; i++) { x.fillStyle = rnd() < 0.5 ? '#f4f8fa' : '#dfe8ec'; x.fillRect(7 + (rnd() * 32 | 0), 4 + (rnd() * 24 | 0), 2, 1); }
  });
}
function makeTileSet(s) {
  const p = PAL[s], T = {};
  // Stamm + Bodenschatten (Krone wird separat über den Figuren gezeichnet)
  T.tree = up(mk(16, 16, x => { R(x, 'rgba(0,0,0,.28)', 1, 7, 14, 8); R(x, 'rgba(0,0,0,.18)', 3, 5, 11, 11); R(x, '#3e3020', 6, 4, 4, 9); R(x, '#54422c', 7, 4, 2, 9); R(x, '#2c2216', 5, 12, 6, 2); }));
  T.canopy = [canopy(p, s, 0), canopy(p, s, 1), canopy(p, s, 2)];
  T.stump = up(mk(16, 16, x => { R(x, '#5c3f22', 5, 5, 6, 6); R(x, '#c9a070', 6, 6, 4, 4); R(x, '#94693c', 7, 7, 2, 2); }));
  T.rock = blob(32, 12, 10, s === 3 ? '#e4eaee' : '#8e9088', '#6c6e68', '#4c4e4a', 21 + s);
  T.bush = blob(32, 13, 11.5, shade(p.bush, 1.2), p.bush, shade(p.bush, 0.7), 31 + s, '#8a2440');
  T.bushE = blob(32, 13, 11.5, shade(p.bush, 1.2), p.bush, shade(p.bush, 0.7), 31 + s, null);
  T.reed = up(mk(16, 16, x => { for (let i = 0; i < 5; i++) { R(x, s === 3 ? '#a8a890' : '#7a8a45', 2 + i * 3, 4 + (i * 5) % 6, 1, 6); R(x, '#5a4020', 2 + i * 3, 3 + (i * 5) % 6, 1, 2); } }));
  T.crop = up(mk(16, 16, x => { for (let i = 0; i < 3; i++) { R(x, p.crop, 2 + i * 5, 3, 2, 10); R(x, shade(p.crop, 1.2), 2 + i * 5, 3, 2, 3); } }));
  T.cropE = up(mk(16, 16, x => { for (let i = 0; i < 3; i++) R(x, shade(p.farmB, 0.85), 2 + i * 5, 6, 2, 5); }));
  T.crate = up(mk(16, 16, x => { R(x, '#6a4828', 2, 3, 12, 11); R(x, '#94693c', 3, 4, 10, 9); R(x, '#6a4828', 3, 8, 10, 1); R(x, '#6a4828', 7, 4, 2, 9); R(x, '#ffd060', 7, 7, 2, 3); }));
  T.crateO = up(mk(16, 16, x => { R(x, '#4a3420', 2, 3, 12, 11); R(x, '#2a1c10', 3, 4, 10, 9); }));
  T.wall = {}; T.win = {}; T.wallTop = {};
  for (const k in WALLCOL) {
    const c = WALLCOL[k], top = shade(ROOFCOL[k], 0.7);
    // Fassade (Südseite, Schrägsicht): Verkleidung mit Sockel
    const facade = x => { R(x, c, 0, 0, 16, 16); for (let i = 1; i < 12; i += 3) R(x, shade(c, 0.86), 0, i, 16, 1); R(x, shade(c, 1.12), 0, 0, 16, 1); R(x, shade(c, 0.6), 0, 12, 16, 4); R(x, shade(c, 0.5), 0, 15, 16, 1); if (s === 3) R(x, '#dfe6e8', 0, 15, 16, 1); };
    T.wall[k] = up(mk(16, 16, facade));
    T.win[k] = up(mk(16, 16, x => { facade(x); R(x, '#1c2226', 3, 2, 10, 9); R(x, '#4a6470', 4, 3, 8, 7); R(x, '#7a98a4', 4, 3, 3, 2); R(x, '#1c2226', 8, 3, 1, 7); R(x, shade(c, 1.2), 2, 11, 12, 1); }));
    T.wallTop[k] = up(mk(16, 16, x => { R(x, top, 0, 0, 16, 16); R(x, shade(top, 1.25), 0, 0, 16, 1); R(x, shade(top, 0.8), 0, 15, 16, 1); if (s === 3) R(x, '#dfe6e8', 0, 0, 16, 3); }));
  }
  return T;
}

// Icon für UI (liefert neues Canvas-Element)
export function iconCanvas(src) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0); return c;
}
