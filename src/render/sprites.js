// Prozedurale Pixel-Art: alle Grafiken werden hier im Code erzeugt (keine externen Assets).
import { ITEMS, BUILD, ZT } from '../config.js';

export function mk(w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; fn(x, w, h); return c;
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
function humanoid(body, skin, hair, zombie) {
  return mk(16, 16, x => {
    R(x, shade(body, 0.7), 5, 2, 6, 12); R(x, body, 5, 3, 6, 10); R(x, body, 6, 2, 4, 12);
    if (zombie) { R(x, skin, 9, 2, 5, 2); R(x, skin, 9, 12, 5, 2); R(x, shade(skin, 0.7), 13, 2, 1, 2); R(x, shade(skin, 0.7), 13, 12, 1, 2); }
    else { R(x, body, 8, 2, 3, 2); R(x, body, 8, 12, 3, 2); R(x, skin, 11, 3, 2, 2); R(x, skin, 11, 11, 2, 2); }
    R(x, hair, 5, 5, 3, 6); R(x, skin, 7, 5, 4, 6); R(x, shade(skin, 0.8), 10, 6, 1, 4);
    if (zombie) { R(x, '#300', 10, 6, 1, 1); R(x, '#300', 10, 9, 1, 1); }
  });
}
export const SPR = { z: {}, zf: {}, item: {}, build: {}, tiles: [] };

export function initSprites() {
  SPR.player = humanoid('#3b5f8a', '#e0b890', '#4a3020', false);
  for (const k in ZT) {
    SPR.z[k] = humanoid(shade(ZT[k].col, 0.75), ZT[k].col, shade(ZT[k].col, 0.5), true);
    SPR.zf[k] = humanoid('#7fa8c8', '#bfe0f0', '#e8f4fa', true);   // Frost-Variante
  }
  for (const k of ['deer', 'rabbit']) SPR.z[k] = SPR.zf[k] = mk(16, 16, x => {
    const c = ZT[k].col; R(x, shade(c, 0.8), 3, 5, 9, 6); R(x, c, 4, 6, 7, 4); R(x, c, 11, 6, 3, 4); R(x, shade(c, 0.6), 13, 6, 1, 1); R(x, shade(c, 0.6), 13, 9, 1, 1);
    R(x, shade(c, 0.6), 4, 4, 2, 1); R(x, shade(c, 0.6), 4, 11, 2, 1); R(x, shade(c, 0.6), 9, 4, 2, 1); R(x, shade(c, 0.6), 9, 11, 2, 1); R(x, '#eee', 2, 7, 1, 2);
    if (k === 'deer') { R(x, '#d8c8a0', 12, 4, 1, 2); R(x, '#d8c8a0', 12, 10, 1, 2); }
  });
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
  for (const id in ITEMS) SPR.item[id] = mk(16, 16, x => drawItem(x, id));
  for (const id in BUILD) SPR.build[id] = mk(16, 16, x => drawBuild(x, id));
  SPR.build.beartrap_shut = mk(16, 16, x => { R(x, '#555', 3, 7, 10, 2); R(x, '#888', 4, 6, 8, 1); R(x, '#888', 4, 9, 8, 1); R(x, '#333', 7, 7, 2, 2); });
  SPR.build.plot1 = mk(16, 16, x => { drawBuild(x, 'plot'); for (let i = 0; i < 3; i++) R(x, '#6c4', 3 + i * 4, 6, 1, 2), R(x, '#6c4', 5 + i * 4, 10, 1, 2); });
  SPR.build.plot2 = mk(16, 16, x => { drawBuild(x, 'plot'); for (let i = 0; i < 3; i++) { R(x, '#4a3', 2 + i * 4, 4, 3, 4); R(x, '#e84', 3 + i * 4, 5, 1, 1); R(x, '#4a3', 4 + i * 4, 9, 3, 4); R(x, '#e84', 5 + i * 4, 10, 1, 1); } });
  SPR.build.campfire_off = mk(16, 16, x => { ring(x); R(x, '#333', 6, 6, 4, 4); });
  SPR.build.gas_burn = mk(16, 16, x => { R(x, '#f80', 2, 3, 12, 10); R(x, '#fc3', 4, 5, 8, 6); R(x, '#fff3a0', 6, 7, 4, 3); });
  SPR.lvl = [null, mk(16, 16, x => { R(x, '#b8bcc4', 0, 0, 2, 2); R(x, '#b8bcc4', 14, 0, 2, 2); R(x, '#b8bcc4', 0, 14, 2, 2); R(x, '#b8bcc4', 14, 14, 2, 2); }),
    mk(16, 16, x => { R(x, '#3c4048', 0, 0, 16, 1); R(x, '#3c4048', 0, 15, 16, 1); R(x, '#3c4048', 0, 0, 1, 16); R(x, '#3c4048', 15, 0, 1, 16); R(x, '#ffd060', 0, 0, 2, 2); R(x, '#ffd060', 14, 0, 2, 2); R(x, '#ffd060', 0, 14, 2, 2); R(x, '#ffd060', 14, 14, 2, 2); })];
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
  HEAD.xbow = mk(16, 16, x => { R(x, '#3e2a16', 4, 7, 10, 2); R(x, '#888', 10, 2, 1, 12); R(x, '#888', 9, 3, 1, 2); R(x, '#888', 9, 11, 1, 2); R(x, '#ccc', 12, 7, 3, 2); });
  HEAD.flamer = mk(16, 16, x => { R(x, '#333', 5, 6, 9, 4); R(x, '#f80', 14, 7, 2, 2); R(x, '#a33', 3, 5, 4, 6); });
  HEAD.mg = mk(16, 16, x => { R(x, '#222', 5, 7, 11, 2); R(x, '#444', 4, 5, 5, 6); R(x, '#333', 9, 6, 2, 4); });
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
  { grass: '#5d8f3e', grassB: '#548636', forest: '#44713a', farm: '#8a6e3f', farmB: '#7a6036', swamp: '#4d5e3a', water: '#2f6fa3', waterB: '#3a7db0', sand: '#c9b877', road: '#55575a', pave: '#7f817a', floor: '#9a8a70', tree: '#2f7a35', treeB: '#245e2a', bush: '#3a8a3a', flower: '#e8d24a', crop: '#7ab04a' },
  { grass: '#7b9a3c', grassB: '#728f36', forest: '#4b7430', farm: '#a58a42', farmB: '#94793a', swamp: '#55632f', water: '#2c74aa', waterB: '#3a84b8', sand: '#d6c27a', road: '#5a5b5c', pave: '#868780', floor: '#9a8a70', tree: '#2d6b2a', treeB: '#235522', bush: '#3f7f30', flower: '#f0f0e0', crop: '#d0b040' },
  { grass: '#8c8a45', grassB: '#80793c', forest: '#6c5a32', farm: '#7a5c38', farmB: '#6b5030', swamp: '#5a5636', water: '#35658f', waterB: '#41739c', sand: '#bfae72', road: '#525355', pave: '#7a7a74', floor: '#9a8a70', tree: '#c0742a', treeB: '#9a4f22', bush: '#9a6a2a', flower: '#b04a2a', crop: '#c98a30' },
  { grass: '#dfe6ea', grassB: '#d3dce2', forest: '#cdd7dc', farm: '#d6dad8', farmB: '#c6ccca', swamp: '#b9c4c4', water: '#a9cfe0', waterB: '#bfdcea', sand: '#dadad2', road: '#8d9195', pave: '#b6babc', floor: '#9a8a70', tree: '#eef3f5', treeB: '#57705f', bush: '#c9d6d2', flower: '#ffffff', crop: '#aab0a0' },
];
export const WALLCOL = { house: '#8a5a44', market: '#5a7a94', hardware: '#b8742c', police: '#34466a', gas: '#b0b0a8', military: '#56633c', farm: '#7a5530' };
export const ROOFCOL = { house: '#6e3b30', market: '#3f5f7a', hardware: '#8f561c', police: '#22304e', gas: '#c23a2a', military: '#3e4a2a', farm: '#5c3a22' };

function makeTileSet(s) {
  const p = PAL[s], T = {};
  T.tree = mk(16, 16, x => {
    R(x, 'rgba(0,0,0,.22)', 2, 3, 13, 13);
    R(x, p.treeB, 2, 1, 12, 13); R(x, p.treeB, 1, 3, 14, 9); R(x, p.tree, 3, 2, 9, 9); R(x, p.tree, 2, 4, 11, 6);
    R(x, shade(p.tree, 1.15), 4, 3, 4, 3); R(x, p.treeB, 9, 8, 2, 2); R(x, p.treeB, 5, 9, 2, 1);
    if (s === 3) { R(x, '#5a4630', 7, 7, 2, 2); }
  });
  T.stump = mk(16, 16, x => { R(x, '#5c3f22', 5, 5, 6, 6); R(x, '#c9a070', 6, 6, 4, 4); R(x, '#94693c', 7, 7, 2, 2); });
  T.rock = mk(16, 16, x => { R(x, 'rgba(0,0,0,.2)', 3, 5, 12, 10); R(x, '#6b6e73', 2, 4, 12, 9); R(x, '#8a8d92', 3, 3, 9, 8); R(x, '#a5a8ad', 4, 4, 4, 3); if (s === 3) R(x, '#eef3f5', 3, 3, 8, 2); });
  T.bush = mk(16, 16, x => { R(x, shade(p.bush, 0.8), 2, 4, 12, 9); R(x, p.bush, 3, 3, 10, 9); R(x, '#b02a50', 5, 5, 2, 2); R(x, '#b02a50', 9, 7, 2, 2); R(x, '#b02a50', 6, 9, 2, 2); });
  T.bushE = mk(16, 16, x => { R(x, shade(p.bush, 0.8), 2, 4, 12, 9); R(x, p.bush, 3, 3, 10, 9); });
  T.reed = mk(16, 16, x => { for (let i = 0; i < 5; i++) { R(x, s === 3 ? '#a8a890' : '#7a8a45', 2 + i * 3, 4 + (i * 5) % 6, 1, 6); R(x, '#5a4020', 2 + i * 3, 3 + (i * 5) % 6, 1, 2); } });
  T.crop = mk(16, 16, x => { for (let i = 0; i < 3; i++) { R(x, p.crop, 2 + i * 5, 3, 2, 10); R(x, shade(p.crop, 1.2), 2 + i * 5, 3, 2, 3); } });
  T.cropE = mk(16, 16, x => { for (let i = 0; i < 3; i++) R(x, shade(p.farmB, 0.85), 2 + i * 5, 6, 2, 5); });
  T.crate = mk(16, 16, x => { R(x, '#6a4828', 2, 3, 12, 11); R(x, '#94693c', 3, 4, 10, 9); R(x, '#6a4828', 3, 8, 10, 1); R(x, '#6a4828', 7, 4, 2, 9); R(x, '#ffd060', 7, 7, 2, 3); });
  T.crateO = mk(16, 16, x => { R(x, '#4a3420', 2, 3, 12, 11); R(x, '#2a1c10', 3, 4, 10, 9); });
  T.wall = {}; T.win = {};
  for (const k in WALLCOL) {
    const c = WALLCOL[k];
    T.wall[k] = mk(16, 16, x => { R(x, c, 0, 0, 16, 16); R(x, shade(c, 1.2), 0, 0, 16, 2); R(x, shade(c, 0.75), 0, 14, 16, 2); R(x, shade(c, 0.85), 7, 2, 1, 12); if (s === 3) R(x, '#eef3f5', 0, 0, 16, 1); });
    T.win[k] = mk(16, 16, x => { R(x, c, 0, 0, 16, 16); R(x, shade(c, 1.2), 0, 0, 16, 2); R(x, '#223', 3, 4, 10, 8); R(x, '#8bd', 4, 5, 8, 6); R(x, '#cef', 5, 6, 2, 2); });
  }
  return T;
}

// Icon für UI (liefert neues Canvas-Element)
export function iconCanvas(src) {
  const c = document.createElement('canvas'); c.width = 16; c.height = 16;
  c.getContext('2d').drawImage(src, 0, 0); return c;
}
