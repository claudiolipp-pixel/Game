// Unendliche Chunk-Welt: prozedurale Generierung, Kollision, Persistenz von Änderungen, Boden-Rendering.
import { CFG } from '../config.js';
import { G } from '../state.js';
import { hash2, noise, seedNoise } from '../core/rng.js';
import { SPR, PAL, ROOFCOL, shade } from '../render/sprites.js';

export const T = CFG.TILE, CH = CFG.CHUNK, CPX = T * CH;
// Boden
export const G_GRASS = 0, G_FOREST = 1, G_FARM = 2, G_SWAMP = 3, G_WATER = 4, G_SAND = 5, G_ROAD = 6, G_PAVE = 7, G_FLOOR = 8;
// Objekte
export const O_NONE = 0, O_TREE = 1, O_ROCK = 2, O_BUSH = 3, O_BUSH_E = 4, O_WALL = 5, O_CRATE = 6, O_CRATE_O = 7, O_STUMP = 8, O_REED = 9, O_WINDOW = 10, O_CROP = 11;
const SOLID = new Uint8Array(16); SOLID[O_TREE] = SOLID[O_ROCK] = SOLID[O_WALL] = SOLID[O_CRATE] = SOLID[O_CRATE_O] = SOLID[O_WINDOW] = 1;
const OPAQUE = new Uint8Array(16); OPAQUE[O_TREE] = OPAQUE[O_WALL] = 1;

export const W = {
  seed: 1, chunks: new Map(), mods: {}, season: 0, frozen: false,
  structs: new Map(), hit: null, pcx: 1e9, pcy: 1e9, free: [], dmg: new Map(),
};
export const key = (x, y) => (x + 32768) * 65536 + (y + 32768);

export function initWorld(seed, mods) {
  W.seed = seed; seedNoise(seed);
  for (const c of W.chunks.values()) W.free.push(c);
  W.chunks.clear(); W.mods = mods || {}; W.structs.clear(); W.dmg.clear();
  W.pcx = W.pcy = 1e9; lastC = null;
}

// Bodentyp an Kachel (deterministisch, auch für Minimap)
export function groundAt(x, y) {
  const s = W.seed % 1000;
  const e = noise(x * 0.011 + s, y * 0.011) * 0.75 + noise(x * 0.035, y * 0.035 + s) * 0.25;
  const r = Math.abs(noise(x * 0.0055 + 300, y * 0.0055 - 200 + s));
  if (e < -0.3 || r < 0.016) return G_WATER;
  if (e < -0.26 || r < 0.026) return G_SAND;
  const t = noise(x * 0.008 - 500 + s, y * 0.008 + 700);
  if (t > 0.3) return G_PAVE;
  const f = noise(x * 0.01 + 900, y * 0.01 - 900 - s);
  if (f > 0.3) return G_FARM;
  const m = noise(x * 0.018 + 100 - s, y * 0.018 + 100);
  if (e < -0.08 && m > 0.05) return G_SWAMP;
  if (m > 0.06) return G_FOREST;
  return G_GRASS;
}

const BSIZE = { house: [7, 6], market: [11, 8], hardware: [10, 8], police: [9, 8], gas: [7, 5], military: [11, 9], farm: [7, 6] };
const BCRATES = { house: 3, market: 6, hardware: 5, police: 4, gas: 3, military: 6, farm: 3 };

function genChunk(cx, cy) {
  const c = W.free.pop() || { g: new Uint8Array(CH * CH), o: new Uint8Array(CH * CH), canvas: null, ctx: null };
  c.cx = cx; c.cy = cy; c.bld = null; c.ver = -1; c.roofA = 1;
  const g = c.g, o = c.o, sd = W.seed, bx0 = cx * CH, by0 = cy * CH;
  for (let ly = 0; ly < CH; ly++) for (let lx = 0; lx < CH; lx++) {
    const i = lx + ly * CH, tx = bx0 + lx, ty = by0 + ly;
    const gt = groundAt(tx, ty); g[i] = gt;
    const h = hash2(tx, ty, sd);
    let ob = O_NONE;
    if (gt === G_FOREST) ob = h < 0.2 ? O_TREE : h < 0.215 ? O_ROCK : h < 0.24 ? O_BUSH : 0;
    else if (gt === G_GRASS) ob = h < 0.025 ? O_TREE : h < 0.037 ? O_ROCK : h < 0.05 ? O_BUSH : 0;
    else if (gt === G_SWAMP) ob = h < 0.06 ? O_TREE : h < 0.22 ? O_REED : 0;
    else if (gt === G_FARM) ob = ((tx & 1) === 0 && h < 0.5) ? O_CROP : 0;
    else if (gt === G_SAND) ob = h < 0.02 ? O_ROCK : 0;
    else if (gt === G_PAVE) ob = h < 0.012 ? O_TREE : 0;
    o[i] = ob;
  }
  // Gebäude
  const gc = g[8 + 8 * CH], h = hash2(cx, cy, sd + 77), h2 = hash2(cx, cy, sd + 78);
  let type = null;
  if (gc === G_PAVE) {
    for (let k = 0; k < CH; k++) { if (g[k] === G_PAVE) { g[k] = G_ROAD; o[k] = 0; } if (g[k * CH] === G_PAVE) { g[k * CH] = G_ROAD; o[k * CH] = 0; } }
    if (h < 0.92) type = h2 < 0.56 ? 'house' : h2 < 0.68 ? 'market' : h2 < 0.79 ? 'hardware' : h2 < 0.88 ? 'police' : 'gas';
  } else if (gc === G_FARM && h < 0.16) type = 'farm';
  else if ((gc === G_GRASS || gc === G_FOREST) && h < 0.016 && (Math.abs(cx) > 2 || Math.abs(cy) > 2)) type = 'military';
  if (type) placeBuilding(c, type);
  // gespeicherte Änderungen anwenden
  const m = W.mods[key(cx, cy)];
  if (m) for (const i in m) o[i] = m[i];
  return c;
}

function placeBuilding(c, type) {
  const g = c.g, o = c.o, sd = W.seed, cx = c.cx, cy = c.cy;
  const w = BSIZE[type][0], h = BSIZE[type][1];
  const bx = 2 + Math.floor(hash2(cx, cy, sd + 1) * (CH - 3 - w)), by = 2 + Math.floor(hash2(cx, cy, sd + 2) * (CH - 3 - h));
  for (let y = by - 1; y <= by + h; y++) for (let x = bx - 1; x <= bx + w; x++) { const gt = g[x + y * CH]; if (gt === G_WATER || gt === G_SAND) return; }
  for (let y = by - 1; y <= by + h; y++) for (let x = bx - 1; x <= bx + w; x++) {
    const i = x + y * CH, inX = x >= bx && x < bx + w, inY = y >= by && y < by + h;
    o[i] = O_NONE;
    if (!inX || !inY) continue;
    g[i] = G_FLOOR;
    const edge = x === bx || x === bx + w - 1 || y === by || y === by + h - 1;
    if (edge) { const corner = (x === bx || x === bx + w - 1) && (y === by || y === by + h - 1); o[i] = (!corner && ((x + y) % 3 === 0)) ? O_WINDOW : O_WALL; }
  }
  // Türen
  const doors = [];
  const side = Math.floor(hash2(cx, cy, sd + 3) * 4), nd = w >= 9 ? 2 : 1;
  for (let d = 0; d < nd; d++) {
    const s = (side + d * 2) % 4, hh = hash2(cx, cy, sd + 4 + d);
    let dx, dy;
    if (s === 0) { dx = bx + 1 + Math.floor(hh * (w - 2)); dy = by; } else if (s === 2) { dx = bx + 1 + Math.floor(hh * (w - 2)); dy = by + h - 1; }
    else if (s === 1) { dx = bx + w - 1; dy = by + 1 + Math.floor(hh * (h - 2)); } else { dx = bx; dy = by + 1 + Math.floor(hh * (h - 2)); }
    o[dx + dy * CH] = O_NONE; doors.push(dx, dy);
  }
  // Loot-Kisten entlang der Innenwände
  let n = BCRATES[type], tries = n * 6;
  while (n > 0 && tries-- > 0) {
    const ix = 1 + Math.floor(hash2(cx * 31 + tries, cy, sd + 9) * (w - 2)), iy = 1 + Math.floor(hash2(cx, cy * 31 + tries, sd + 10) * (h - 2));
    if (!(ix === 1 || ix === w - 2 || iy === 1 || iy === h - 2)) continue;
    const x = bx + ix, y = by + iy, i = x + y * CH;
    if (o[i] !== O_NONE) continue;
    let nearDoor = false;
    for (let d = 0; d < doors.length; d += 2) if (Math.abs(doors[d] - x) + Math.abs(doors[d + 1] - y) <= 1) nearDoor = true;
    if (nearDoor) continue;
    o[i] = O_CRATE; n--;
  }
  c.bld = { x: c.cx * CH + bx, y: c.cy * CH + by, w, h, type };
}

let lastC = null;
export function chunkAt(cx, cy) {
  if (lastC && lastC.cx === cx && lastC.cy === cy) return lastC;
  const c = W.chunks.get(key(cx, cy));
  if (c) lastC = c;
  return c;
}
export function ensureChunk(cx, cy) {
  let c = W.chunks.get(key(cx, cy));
  if (!c) { c = genChunk(cx, cy); W.chunks.set(key(cx, cy), c); }
  return c;
}
export function getObj(tx, ty) { const c = chunkAt(tx >> 4, ty >> 4); return c ? c.o[(tx & 15) + ((ty & 15) << 4)] : O_NONE; }
export function getGround(tx, ty) { const c = chunkAt(tx >> 4, ty >> 4); return c ? c.g[(tx & 15) + ((ty & 15) << 4)] : groundAt(tx, ty); }
export function setObj(tx, ty, ob) {
  const c = ensureChunk(tx >> 4, ty >> 4), i = (tx & 15) + ((ty & 15) << 4);
  c.o[i] = ob; c.ver = -1;
  const k = key(tx >> 4, ty >> 4); (W.mods[k] || (W.mods[k] = {}))[i] = ob;
}
export function buildingAt(tx, ty) {
  const c = chunkAt(tx >> 4, ty >> 4); if (!c || !c.bld) return null;
  const b = c.bld; return (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) ? b : null;
}

// 0 frei, 1 natürliches Hindernis, 2 Bauwerk (W.hit = Struktur)
export function tileSolid(tx, ty, forZ) {
  const c = chunkAt(tx >> 4, ty >> 4); if (!c) return 1;
  const i = (tx & 15) + ((ty & 15) << 4);
  if (c.g[i] === G_WATER && !W.frozen) return 1;
  if (SOLID[c.o[i]]) return 1;
  if (W.structs.size) { const s = W.structs.get(key(tx, ty)); if (s && (forZ ? s.def.block : s.def.pblock)) { W.hit = s; return 2; } }
  return 0;
}
function boxHit(x, y, r, forZ) {
  const x0 = Math.floor((x - r) / T), x1 = Math.floor((x + r) / T), y0 = Math.floor((y - r) / T), y1 = Math.floor((y + r) / T);
  let res = 0;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const s = tileSolid(tx, ty, forZ); if (s > res) res = s; }
  return res;
}
// Achsen-getrennte Kreis/Kachel-Kollision. Rückgabe: 0 frei, 1 natürlich blockiert, 2 von Bauwerk blockiert
export function moveCircle(e, dx, dy, forZ) {
  const r = e.r - 1; let res = 0;
  if (boxHit(e.x, e.y, r, forZ)) { e.x += dx; e.y += dy; return 0; }   // steckt fest → befreien
  if (dx) { const h = boxHit(e.x + dx, e.y, r, forZ); if (!h) e.x += dx; else if (h > res) res = h; }
  if (dy) { const h = boxHit(e.x, e.y + dy, r, forZ); if (!h) e.y += dy; else if (h > res) res = h; }
  return res;
}
// Sichtlinie (Wände/Bäume/Bauwerke blockieren)
export function losClear(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy), n = Math.ceil(d / 14);
  for (let i = 1; i < n; i++) {
    const tx = Math.floor((x0 + dx * i / n) / T), ty = Math.floor((y0 + dy * i / n) / T);
    const c = chunkAt(tx >> 4, ty >> 4); if (!c) return false;
    const ob = c.o[(tx & 15) + ((ty & 15) << 4)];
    if (OPAQUE[ob] || ob === O_WINDOW) return false;
    if (W.structs.size) { const s = W.structs.get(key(tx, ty)); if (s && s.def.pblock && !s.def.turret && s.id !== 'spikewall' && s.id !== 'fence' && s.id !== 'mg') return false; }
  }
  return true;
}

export function findSpawn() {
  for (let r = 0; r < 200; r++) for (let a = 0; a < 16; a++) {
    const tx = Math.round(Math.cos(a / 16 * 6.283) * r * 3), ty = Math.round(Math.sin(a / 16 * 6.283) * r * 3);
    const g = groundAt(tx, ty);
    if (g !== G_GRASS && g !== G_FOREST) continue;
    let ok = true;
    for (let y = -2; y <= 2 && ok; y++) for (let x = -2; x <= 2; x++) { const gg = groundAt(tx + x, ty + y); if (gg === G_WATER) { ok = false; break; } }
    if (!ok) continue;
    loadAround(tx * T, ty * T);
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) { const c = chunkAt((tx + x) >> 4, (ty + y) >> 4); c.o[((tx + x) & 15) + (((ty + y) & 15) << 4)] = O_NONE; }
    return { x: tx * T + 16, y: ty * T + 16 };
  }
  return { x: 16, y: 16 };
}

function loadAround(px, py) {
  const pcx = Math.floor(px / CPX), pcy = Math.floor(py / CPX);
  if (pcx === W.pcx && pcy === W.pcy) return;
  W.pcx = pcx; W.pcy = pcy;
  const R = CFG.LOAD_R;
  for (let y = pcy - R; y <= pcy + R; y++) for (let x = pcx - R; x <= pcx + R; x++) ensureChunk(x, y);
  for (const [k, c] of W.chunks) if (Math.abs(c.cx - pcx) > R + 1 || Math.abs(c.cy - pcy) > R + 1) { W.chunks.delete(k); W.free.push(c); if (lastC === c) lastC = null; }
}
export function updateWorld() { loadAround(G.player.x, G.player.y); }
export function setSeason(s) { W.season = s; W.frozen = s === 3; }

// ---------- Rendering ----------
const GCOL = ['grass', 'forest', 'farm', 'swamp', 'water', 'sand', 'road', 'pave', 'floor'];
function renderChunk(c) {
  if (!c.canvas) { c.canvas = document.createElement('canvas'); c.canvas.width = c.canvas.height = CH * 16; c.ctx = c.canvas.getContext('2d', { alpha: false }); }
  const x = c.ctx, s = W.season, p = PAL[s], ts = SPR.tiles[s], type = c.bld ? c.bld.type : 'house';
  for (let ly = 0; ly < CH; ly++) for (let lx = 0; lx < CH; lx++) {
    const i = lx + ly * CH, g = c.g[i], px = lx * 16, py = ly * 16, tx = c.cx * CH + lx, ty = c.cy * CH + ly;
    const h = hash2(tx, ty, 9), a = (h * 977) | 0;
    x.fillStyle = p[GCOL[g]]; x.fillRect(px, py, 16, 16);
    if (g === G_GRASS || g === G_FOREST || g === G_SWAMP) {
      x.fillStyle = g === G_GRASS ? p.grassB : shade(p[GCOL[g]], 0.9);
      x.fillRect(px + a % 11, py + (a >> 3) % 12, 4, 2); x.fillRect(px + (a >> 2) % 13, py + (a >> 5) % 13, 2, 3);
      if (g === G_GRASS && h > 0.93 && s < 2) { x.fillStyle = p.flower; x.fillRect(px + a % 14, py + (a >> 4) % 14, 2, 2); }
      if (g === G_SWAMP && h > 0.7) { x.fillStyle = s === 3 ? p.water : shade(p.water, 0.6); x.fillRect(px + 3, py + 5, 9, 5); }
    } else if (g === G_FARM) { x.fillStyle = p.farmB; for (let k = 1; k < 16; k += 4) x.fillRect(px, py + k, 16, 1); }
    else if (g === G_WATER) { x.fillStyle = p.waterB; x.fillRect(px + a % 9, py + (a >> 3) % 13, 6, 1); if (h > 0.5) x.fillRect(px + (a >> 2) % 10, py + (a >> 6) % 14, 4, 1); }
    else if (g === G_SAND) { x.fillStyle = shade(p.sand, 0.92); x.fillRect(px + a % 13, py + (a >> 3) % 13, 2, 2); }
    else if (g === G_ROAD) { x.fillStyle = shade(p.road, 0.88); x.fillRect(px + a % 12, py + (a >> 3) % 12, 3, 3); if (h > 0.8) { x.fillStyle = shade(p.road, 1.25); x.fillRect(px + 6, py + 6, 4, 1); } }
    else if (g === G_PAVE) { x.fillStyle = shade(p.pave, 0.92); x.fillRect(px, py + 15, 16, 1); x.fillRect(px + 15, py, 1, 16); }
    else if (g === G_FLOOR) { x.fillStyle = shade(p.floor, 0.88); x.fillRect(px, py + 7, 16, 1); x.fillRect(px, py + 15, 16, 1); x.fillRect(px + (ly & 1 ? 4 : 11), py, 1, 16); }
    const ob = c.o[i]; let spr = null;
    switch (ob) {
      case O_TREE: spr = ts.tree; break; case O_ROCK: spr = ts.rock; break; case O_STUMP: spr = ts.stump; break; case O_REED: spr = ts.reed; break;
      case O_BUSH: spr = s === 3 ? ts.bushE : ts.bush; break; case O_BUSH_E: spr = ts.bushE; break;
      case O_CROP: spr = (s === 1 || s === 2) ? ts.crop : ts.cropE; break;
      case O_WALL: spr = ts.wall[type]; break; case O_WINDOW: spr = ts.win[type]; break;
      case O_CRATE: spr = ts.crate; break; case O_CRATE_O: spr = ts.crateO; break;
    }
    if (spr) x.drawImage(spr, px, py);
  }
  c.ver = s;
}

export function drawGround(ctx, v) {
  const s = v.scale, hw = v.w / 2 / s, hh = v.h / 2 / s;
  const cx0 = Math.floor((v.camX - hw) / CPX), cx1 = Math.floor((v.camX + hw) / CPX);
  const cy0 = Math.floor((v.camY - hh) / CPX), cy1 = Math.floor((v.camY + hh) / CPX);
  let budget = 2;
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const c = ensureChunk(cx, cy);
    if (c.ver !== W.season && (!c.canvas || c.ver === -1 || budget-- > 0)) renderChunk(c);
    const dx = Math.round(cx * CPX * s + v.tx), dy = Math.round(cy * CPX * s + v.ty);
    const dx2 = Math.round((cx + 1) * CPX * s + v.tx), dy2 = Math.round((cy + 1) * CPX * s + v.ty);
    ctx.drawImage(c.canvas, dx, dy, dx2 - dx, dy2 - dy);
  }
}
// Dächer (ausgeblendet, wenn der Spieler im Gebäude steht)
export function drawRoofs(ctx, v, ptx, pty) {
  const s = v.scale, hw = v.w / 2 / s, hh = v.h / 2 / s;
  const cx0 = Math.floor((v.camX - hw) / CPX), cx1 = Math.floor((v.camX + hw) / CPX);
  const cy0 = Math.floor((v.camY - hh) / CPX), cy1 = Math.floor((v.camY + hh) / CPX);
  for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
    const c = chunkAt(cx, cy); if (!c || !c.bld) continue;
    const b = c.bld, inside = ptx >= b.x && ptx < b.x + b.w && pty >= b.y && pty < b.y + b.h;
    c.roofA += ((inside ? 0 : 1) - c.roofA) * 0.15;
    if (c.roofA < 0.02) continue;
    const x = Math.round(b.x * T * s + v.tx), y = Math.round(b.y * T * s + v.ty), w = Math.round(b.w * T * s), h = Math.round(b.h * T * s);
    ctx.globalAlpha = c.roofA;
    const col = W.season === 3 ? '#e4eaee' : ROOFCOL[b.type];
    ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = shade(col, 0.8); ctx.fillRect(x, y + (h >> 1) - Math.round(2 * s), w, Math.round(4 * s));
    ctx.fillStyle = shade(col, 0.65); ctx.fillRect(x, y, w, Math.round(3 * s)); ctx.fillRect(x, y + h - Math.round(3 * s), w, Math.round(3 * s));
    ctx.fillRect(x, y, Math.round(3 * s), h); ctx.fillRect(x + w - Math.round(3 * s), y, Math.round(3 * s), h);
    ctx.globalAlpha = 1;
  }
}
