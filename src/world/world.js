// Unendliche Chunk-Welt: prozedurale Generierung, Kollision, Persistenz von Änderungen, Boden-Rendering.
import { CFG } from '../config.js';
import { G } from '../state.js';
import { hash2, noise, seedNoise } from '../core/rng.js';
import { SPR, PAL, ROOFCOL, shade } from '../render/sprites.js';

export const T = CFG.TILE, CH = CFG.CHUNK, CPX = T * CH;
// Boden
export const G_GRASS = 0, G_FOREST = 1, G_FARM = 2, G_SWAMP = 3, G_WATER = 4, G_SAND = 5, G_ROAD = 6, G_PAVE = 7, G_FLOOR = 8;
// Objekte
export const O_NONE = 0, O_TREE = 1, O_ROCK = 2, O_BUSH = 3, O_BUSH_E = 4, O_WALL = 5, O_CRATE = 6, O_CRATE_O = 7, O_STUMP = 8, O_REED = 9, O_WINDOW = 10, O_CROP = 11, O_CAR = 12, O_CAR2 = 13, O_CAR_O = 14;
const SOLID = new Uint8Array(16); SOLID[O_TREE] = SOLID[O_ROCK] = SOLID[O_WALL] = SOLID[O_CRATE] = SOLID[O_CRATE_O] = SOLID[O_WINDOW] = SOLID[O_CAR] = SOLID[O_CAR2] = SOLID[O_CAR_O] = 1;
const OPAQUE = new Uint8Array(16); OPAQUE[O_TREE] = OPAQUE[O_WALL] = 1;

export const W = {
  seed: 1, chunks: new Map(), mods: {}, season: 0, frozen: false,
  smoothGround: true, mode3d: false, structs: new Map(), hit: null, pcx: 1e9, pcy: 1e9, free: [], dmg: new Map(),
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

// Dörfer: je 6x6-Chunk-Region höchstens ein kleines Dorf (3x3 Chunks). Die Start-Region hat immer eines.
const VR = 6, vc = { x: 0, y: 0 };
export function villageCenter(rx, ry, out) {
  if (hash2(rx, ry, W.seed + 500) > 0.6 && (rx !== 0 || ry !== 0)) return false;
  for (let k = 0; k < 6; k++) {
    const x = rx * VR + 1 + Math.floor(hash2(rx + k * 17, ry, W.seed + 501) * (VR - 2)), y = ry * VR + 1 + Math.floor(hash2(rx, ry + k * 17, W.seed + 502) * (VR - 2));
    out.x = x; out.y = y;
    let land = 0; for (let j = 0; j < 5; j++) { const gt = groundAt((x + (j === 1) - (j === 2)) * CH + 8, (y + (j === 3) - (j === 4)) * CH + 8); if (gt !== G_WATER && gt !== G_SAND) land++; }
    if (land >= 4) return true;
  }
  return rx === 0 && ry === 0;
}
export function isVillage(cx, cy) {
  if (!villageCenter(Math.floor(cx / VR), Math.floor(cy / VR), vc)) return false;
  return Math.abs(cx - vc.x) <= 1 && Math.abs(cy - vc.y) <= 1;
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
  const gc = g[8 + 8 * CH], h = hash2(cx, cy, sd + 77), h2 = hash2(cx, cy, sd + 78), vil = gc !== G_WATER && isVillage(cx, cy);
  let type = null;
  if (gc === G_PAVE || vil) {
    if (vil) for (let i = 0; i < CH * CH; i++) if (o[i] === O_TREE && hash2(i, cx * 131 + cy, sd + 5) > 0.3) o[i] = O_NONE;     // Dorf: lichter Baumbestand
    // Straßen / Dorfwege an den Chunk-Kanten
    for (let k = 0; k < CH; k++) for (let e = 0; e < 2; e++) { const i = e ? k * CH : k, gt = g[i]; if (gt === G_PAVE || (vil && gt !== G_WATER && gt !== G_SAND)) { g[i] = G_ROAD; o[i] = 0; } }
    if (vil && gc !== G_PAVE) { if (h < 0.85) type = h2 < 0.62 ? 'house' : h2 < 0.74 ? 'market' : h2 < 0.84 ? 'hardware' : h2 < 0.92 ? 'gas' : 'police'; }
    else if (h < 0.92) type = h2 < 0.56 ? 'house' : h2 < 0.68 ? 'market' : h2 < 0.79 ? 'hardware' : h2 < 0.88 ? 'police' : 'gas';
  } else if (gc === G_FARM && h < 0.2) type = 'farm';
  else if ((gc === G_GRASS || gc === G_FOREST) && h < 0.016 && (Math.abs(cx) > 2 || Math.abs(cy) > 2)) type = 'military';
  else if ((gc === G_GRASS || gc === G_FOREST || gc === G_SWAMP) && h > 0.94) type = 'house';     // einsame Hütte
  if (type) placeBuilding(c, type);
  if ((gc === G_PAVE || vil) && hash2(cx, cy, sd + 90) > 0.4) {      // Autowrack am Straßenrand
    const i = 3 + Math.floor(hash2(cx, cy, sd + 91) * 10) + CH;
    if (!o[i] && !o[i + 1] && g[i] !== G_FLOOR && g[i + 1] !== G_FLOOR && g[i] !== G_WATER && g[i + 1] !== G_WATER) { o[i] = O_CAR; o[i + 1] = O_CAR2; }
  }
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
  villageCenter(0, 0, vc);
  const bx = vc.x * CH + 8, by = (vc.y + 2) * CH + 4;        // knapp südlich des Start-Dorfs
  W.village = { x: (vc.x * CH + 8) * T, y: (vc.y * CH + 8) * T };
  for (let r = 0; r < 200; r++) for (let a = 0; a < 16; a++) {
    const tx = bx + Math.round(Math.cos(a / 16 * 6.283) * r * 3), ty = by + Math.round(Math.sin(a / 16 * 6.283) * r * 3);
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
  for (const c of W.chunks.values()) if (c.canvas && (Math.abs(c.cx - pcx) > 2 || Math.abs(c.cy - pcy) > 2)) { cpool.push(c.canvas); c.canvas = null; c.ctx = null; c.ver = -1; }
  for (const [k, c] of W.chunks) if (Math.abs(c.cx - pcx) > R + 1 || Math.abs(c.cy - pcy) > R + 1) { W.chunks.delete(k); W.free.push(c); if (lastC === c) lastC = null; }
}
export function updateWorld() { loadAround(G.player.x, G.player.y); }
export function setSeason(s) { W.season = s; W.frozen = s === 3; }

// ---------- Rendering ----------
const GCOL = ['grass', 'forest', 'farm', 'swamp', 'water', 'sand', 'road', 'pave', 'floor'];
const PRI = [4, 5, 3, 2, 0, 1, -1, 6, -1];           // wer "wächst" in wen hinein (Kanten-Dithering)
const TEX = [];                                       // [season][ground] = [base, dunkel, hell]
function tex(s) { if (!TEX[s]) TEX[s] = GCOL.map(k => [PAL[s][k], shade(PAL[s][k], 0.87), shade(PAL[s][k], 1.1)]); return TEX[s]; }
let rs = 1;
const rnd = () => { rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0; return rs / 4294967296; };
const gAt = (c, lx, ly) => (lx >= 0 && ly >= 0 && lx < CH && ly < CH) ? c.g[lx + ly * CH] : groundAt(c.cx * CH + lx, c.cy * CH + ly);
const isWall = ob => ob === O_WALL || ob === O_WINDOW;

// --- Pixelweises Boden-Rendering: Biom-Grenzen werden mit weichem Rauschen verschoben (organisch statt Kacheln) ---
const CS = CH * T, DS = 256, cpool = [];
const dispX = new Int8Array(DS * DS), dispY = new Int8Array(DS * DS), mott = new Int8Array(DS * DS), patch = new Int8Array(DS * DS);
(function initNoiseTables() {
  let r = 9001; const rn = () => { r = (Math.imul(r, 1664525) + 1013904223) >>> 0; return r / 4294967296; };
  const layer = cells => {      // kachelbares Value-Noise
    const lat = new Float32Array(cells * cells); for (let i = 0; i < lat.length; i++) lat[i] = rn() * 2 - 1;
    const out = new Float32Array(DS * DS), cs = DS / cells;
    for (let y = 0; y < DS; y++) for (let x = 0; x < DS; x++) {
      const fx = x / cs, fy = y / cs, x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0, u = tx * tx * (3 - 2 * tx), v = ty * ty * (3 - 2 * ty);
      const a = lat[x0 % cells + (y0 % cells) * cells], b = lat[(x0 + 1) % cells + (y0 % cells) * cells], c2 = lat[x0 % cells + ((y0 + 1) % cells) * cells], d = lat[(x0 + 1) % cells + ((y0 + 1) % cells) * cells];
      out[x + y * DS] = a + (b - a) * u + (c2 - a + (a - b - c2 + d) * u) * v;
    }
    return out;
  };
  const a1 = layer(8), a2 = layer(32), b1 = layer(8), b2 = layer(32), m1 = layer(16), m2 = layer(64), q1 = layer(4), q2 = layer(16);
  for (let i = 0; i < DS * DS; i++) patch[i] = Math.round((q1[i] * 0.65 + q2[i] * 0.35) * 100);
  for (let i = 0; i < DS * DS; i++) { dispX[i] = Math.round((a1[i] * 0.72 + a2[i] * 0.28) * 15); dispY[i] = Math.round((b1[i] * 0.72 + b2[i] * 0.28) * 15); mott[i] = Math.round((m1[i] * 0.6 + m2[i] * 0.4) * 11); }
})();
const NAT = new Uint8Array([1, 1, 1, 1, 1, 1, 0, 0, 0]);      // natürliche Böden (weiche Kanten)
const RGB = [];
function rgbOf(s) { if (!RGB[s]) RGB[s] = GCOL.map(k => { const n = parseInt(PAL[s][k].slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }); return RGB[s]; }
let pimg = null, p32 = null;
const gpad = new Uint8Array((CH + 2) * (CH + 2));

function renderChunk(c) {
  if (!c.canvas) { c.canvas = cpool.pop() || document.createElement('canvas'); c.canvas.width = c.canvas.height = CS; c.ctx = c.canvas.getContext('2d', { alpha: false }); }
  const x = c.ctx, s = W.season, p = PAL[s], ts = SPR.tiles[s], tx_ = tex(s), cols = rgbOf(s), type = c.bld ? c.bld.type : 'house', PW = CH + 2;
  const trees = c.trees || (c.trees = []); trees.length = 0;
  const cars = c.cars || (c.cars = []); cars.length = 0;
  if (!pimg) { pimg = x.createImageData(CS, CS); p32 = new Uint32Array(pimg.data.buffer); }
  for (let ly = -1; ly <= CH; ly++) for (let lx = -1; lx <= CH; lx++) gpad[lx + 1 + (ly + 1) * PW] = gAt(c, lx, ly);
  const wx0 = c.cx * CS, wy0 = c.cy * CS;
  for (let py = 0; py < CS; py++) {
    const wy = wy0 + py, row = ((py >> 5) + 1) * PW + 1, dy8 = (wy & 255) << 8, my8 = ((wy + 37) & 255) << 8;
    for (let px = 0; px < CS; px++) {
      const wx = wx0 + px;
      let g = gpad[row + (px >> 5)];
      if (NAT[g]) { const di = (wx & 255) + dy8, g1 = gpad[(((py + dispY[di]) >> 5) + 1) * PW + 1 + ((px + dispX[di]) >> 5)]; if (NAT[g1]) g = g1; }
      let h = Math.imul(wx, 374761393) ^ Math.imul(wy, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177);
      let v = mott[((wx + 91) & 255) + my8] + ((h >>> 29) - 4);
      if (g === G_FARM) { if ((wy & 7) < 2) v -= 13; }
      else if (g === G_WATER) v = (v >> 1) + (((wy + (mott[(wx & 255) + dy8] >> 1)) & 7) === 0 ? 9 : 0);
      else if (g === G_PAVE) { if ((wx & 31) === 0 || (wy & 31) === 0 || ((wx & 31) === 16 && (wy & 32))) v -= 15; }
      else if (g === G_FLOOR) { v >>= 1; if ((wy & 15) === 0 || ((wx + ((wy >> 4) & 1) * 16) & 31) === 0) v -= 20; }
      else if (g === G_ROAD) { v += ((h >>> 20) & 31) === 0 ? -22 : 0; const q = ((px >> 5) === 0 ? px : py) & 31; if ((q > 7 && q < 12) || (q > 19 && q < 24)) v -= s === 3 ? 20 : 9; }
      if (s === 3 && NAT[g] && g !== G_WATER) v += (mott[((wx >> 2) & 255) + (((wy + (dispX[(wx & 255) + dy8] >> 1)) & 255) << 8)] * 1.5) | 0;    // Schneeverwehungen
      const cc = cols[g]; let r = cc[0] + v, gg = cc[1] + v, b = cc[2] + v;
      if (g <= G_FOREST) {            // kahle Erdflecken in Wiese/Wald
        const pt = patch[((wx >> 1) & 255) + (((wy >> 1) & 255) << 8)];
        if (pt > 26) { const k = (pt > 56 ? 30 : pt - 26) * 0.017, dc = cols[G_FARM]; r += (dc[0] - 14 + v - r) * k; gg += (dc[1] - 14 + v - gg) * k; b += (dc[2] - 12 + v - b) * k; }
        else if (pt < -34) { r -= 7; gg -= 4; b -= 6; }      // sattere, dunklere Stellen
      } else if (g === G_WATER) {     // flaches, helleres Wasser am Ufer; tiefes Wasser dunkler
        const di = (wx & 255) + dy8, g2 = gpad[(((py + dispY[di] * 2 + 9) >> 5) + 1) * PW + 1 + ((px + dispX[di] * 2 + 9) >> 5)], g3 = gpad[(((py - dispY[di] * 2 - 9) >> 5) + 1) * PW + 1 + ((px - dispX[di] * 2 - 9) >> 5)];
        if (g2 !== G_WATER || g3 !== G_WATER) { const sc = cols[G_SAND]; r += (sc[0] - r) * 0.3; gg += (sc[1] - gg) * 0.3 + 4; b += (sc[2] - b) * 0.18 + 5; } else { r -= 6; gg -= 5; b -= 3; }
      }
      p32[px + py * CS] = 0xff000000 | ((b < 0 ? 0 : b > 255 ? 255 : b) << 16) | ((gg < 0 ? 0 : gg > 255 ? 255 : gg) << 8) | (r < 0 ? 0 : r > 255 ? 255 : r);
    }
  }
  x.putImageData(pimg, 0, 0);
  for (let ly = 0; ly < CH; ly++) for (let lx = 0; lx < CH; lx++) {
    const i = lx + ly * CH, g = c.g[i], px = lx * T, py = ly * T, tx = c.cx * CH + lx, ty = c.cy * CH + ly;
    const h = hash2(tx, ty, 9), t = tx_[g];
    rs = ((h * 4294967296) >>> 0) | 1;
    if (g === G_GRASS || g === G_FOREST || g === G_SWAMP) {        // Grashalme
      for (let k = 0; k < 5; k++) { const gx = px + 4 + (rnd() * 24 | 0), gy = py + 5 + (rnd() * 22 | 0); x.fillStyle = t[1]; x.fillRect(gx, gy, 1, 3); x.fillRect(gx + 2, gy + 1, 1, 2); x.fillStyle = t[2]; x.fillRect(gx + 1, gy - 1, 1, 3); }
      if (g === G_GRASS && h > 0.94 && s < 2) { x.fillStyle = p.flower; x.fillRect(px + 6 + (rnd() * 20 | 0), py + 6 + (rnd() * 20 | 0), 2, 2); }
    } else if (g === G_ROAD && h > 0.86) { x.fillStyle = shade(p.road, 0.72); const gx = px + 6 + (rnd() * 14 | 0), gy = py + 6 + (rnd() * 10 | 0); x.fillRect(gx, gy, 1, 9); x.fillRect(gx + 1, gy + 8, 6, 1); x.fillRect(gx - 4, gy + 3, 4, 1); }
    const ob = c.o[i]; let spr = null;
    switch (ob) {
      case O_TREE: spr = ts.tree; trees.push(i); break;
      case O_ROCK: spr = ts.rock; break; case O_STUMP: spr = ts.stump; break; case O_REED: spr = ts.reed; break;
      case O_BUSH: spr = s === 3 ? ts.bushE : ts.bush; break; case O_BUSH_E: spr = ts.bushE; break;
      case O_CROP: spr = (s === 1 || s === 2) ? ts.crop : ts.cropE; break;
      case O_WALL: case O_WINDOW: {
        const south = ly + 1 >= CH || !isWall(c.o[i + CH]);     // Südseite sichtbar → Fassade
        spr = south ? (ob === O_WINDOW ? ts.win[type] : ts.wall[type]) : ts.wallTop[type];
        if (!south && ob === O_WINDOW && !W.mode3d) { x.drawImage(spr, px, py); x.fillStyle = '#4a6470'; x.fillRect(px + 10, py + 8, 12, 16); spr = null; }
        break;
      }
      case O_CAR: case O_CAR_O: if (!W.mode3d) x.drawImage(ts.car[(((tx * 7 + ty * 3) % 3) + 3) % 3], px, py - 8, 64, 40); cars.push(i); break;
      case O_CRATE: spr = ts.crate; break; case O_CRATE_O: spr = ts.crateO; break;
    }
    if (spr && W.mode3d && ob !== O_STUMP && ob !== O_REED && ob !== O_CROP) spr = null;      // in 3D sind Objekte echte Modelle
    if (spr) { if (ob === O_BUSH || ob === O_BUSH_E) x.drawImage(spr, px - 3, py - 3, 38, 38); else x.drawImage(spr, px, py, T, T); }
    if (g === G_FLOOR && !isWall(ob) && ly > 0 && isWall(c.o[i - CH])) { x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(px, py, 32, 7); x.fillStyle = 'rgba(0,0,0,0.14)'; x.fillRect(px, py + 7, 32, 5); }   // Wandschatten innen
  }
  c.ver = s;
}

export function prepareChunk(c) { if (c.ver !== W.season || !c.canvas) renderChunk(c); }
function visRange(v, out) {
  const s = v.scale, hw = v.w / 2 / s, hh = v.h / 2 / s;
  out[0] = Math.floor((v.camX - hw - 26) / CPX); out[1] = Math.floor((v.camX + hw + 26) / CPX);
  out[2] = Math.floor((v.camY - hh) / CPX); out[3] = Math.floor((v.camY + hh + 46) / CPX);
}
const vr = [0, 0, 0, 0];
export function drawGround(ctx, v) {
  const s = v.scale; visRange(v, vr);
  ctx.imageSmoothingEnabled = W.smoothGround;
  let budget = 1;
  for (let cy = vr[2]; cy <= vr[3]; cy++) for (let cx = vr[0]; cx <= vr[1]; cx++) {
    const c = ensureChunk(cx, cy);
    if (c.ver !== W.season && (!c.canvas || budget-- > 0)) renderChunk(c);
    const dx = Math.round(cx * CPX * s + v.tx), dy = Math.round(cy * CPX * s + v.ty);
    const dx2 = Math.round((cx + 1) * CPX * s + v.tx), dy2 = Math.round((cy + 1) * CPX * s + v.ty);
    ctx.drawImage(c.canvas, dx, dy, dx2 - dx, dy2 - dy);
  }
  ctx.imageSmoothingEnabled = true;
}
// Schlagschatten nach Sonnenstand (Welt-Transform gesetzt, vor den Figuren zeichnen): Gebäude, Autos, Bäume
function castRect(ctx, x0, y0, x1, y1, dx, dy) {
  ctx.beginPath();
  if (dx >= 0) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1 + dx, y0 + dy); ctx.lineTo(x1 + dx, y1 + dy); ctx.lineTo(x0 + dx, y1 + dy); ctx.lineTo(x0, y1); }
  else { ctx.moveTo(x1, y0); ctx.lineTo(x0, y0); ctx.lineTo(x0 + dx, y0 + dy); ctx.lineTo(x0 + dx, y1 + dy); ctx.lineTo(x1 + dx, y1 + dy); ctx.lineTo(x1, y1); }
  ctx.closePath(); ctx.fill();
}
export function drawShadows(ctx, v) {
  const e = G.env; if (e.shA < 0.02) return;
  visRange(v, vr); vr[0]--; vr[1]++; vr[2]--;
  const ca = Math.cos(e.shAng) * e.shLen, sa = Math.sin(e.shAng) * e.shLen, sh = SPR.tiles[W.season].treeShadow, rot = e.shAng + Math.PI / 2;
  ctx.globalAlpha = e.shA; ctx.fillStyle = '#121a3c';
  for (let cy = vr[2]; cy <= vr[3]; cy++) for (let cx = vr[0]; cx <= vr[1]; cx++) {
    const c = chunkAt(cx, cy); if (!c || c.ver !== W.season) continue;
    if (c.bld) { const b = c.bld; castRect(ctx, b.x * T, b.y * T - 8, (b.x + b.w) * T, (b.y + b.h) * T, ca * 44, sa * 44); }
    const cr = c.cars; if (cr) for (let k = 0; k < cr.length; k++) { const i = cr[k], x0 = (cx * CH + (i & 15)) * T + 3, y0 = (cy * CH + (i >> 4)) * T + 6; castRect(ctx, x0, y0, x0 + 58, y0 + 22, ca * 15, sa * 15); }
    const tr = c.trees; if (!tr) continue;
    for (let k = 0; k < tr.length; k++) {
      const i = tr[k];
      ctx.save(); ctx.translate((cx * CH + (i & 15)) * T + 16, (cy * CH + (i >> 4)) * T + 22); ctx.rotate(rot); ctx.scale(1, e.shLen);
      ctx.drawImage(sh[(((i * 7 + cx * 3 + cy) % 3) + 3) % 3], -38, -100, 76, 100); ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}
// Bäume über den Figuren (Welt-Transform gesetzt): Laubkronen durchscheinend, wenn der Spieler darunter steht; im Winter kahl
export function drawCanopies(ctx, v, px, py) {
  visRange(v, vr);
  const ts = SPR.tiles[W.season], cs = ts.canopy;
  for (let cy = vr[2]; cy <= vr[3]; cy++) for (let cx = vr[0]; cx <= vr[1]; cx++) {
    const c = chunkAt(cx, cy); if (!c || !c.trees || c.ver !== W.season) continue;
    const tr = c.trees;
    for (let k = 0; k < tr.length; k++) {
      const i = tr[k], wx = (cx * CH + (i & 15)) * T + 16, wy = (cy * CH + (i >> 4)) * T + 16, img = cs[(((i * 7 + cx * 3 + cy) % 3) + 3) % 3];
      if (ts.bare) { const w = 70 + ((i * 13) % 5) * 5; ctx.drawImage(img, wx - w / 2, wy + 8 - w * 1.3, w, w * 1.3); continue; }
      ctx.globalAlpha = (px > wx - 24 && px < wx + 24 && py > wy - 46 && py < wy + 8) ? 0.4 : 1;
      const sz = 62 + ((i * 13) % 5) * 4; ctx.drawImage(img, wx - sz / 2, wy - sz / 2 - 16, sz, sz);
    }
  }
  ctx.globalAlpha = 1;
}
// Wellblechdächer in Schrägsicht (nach oben versetzt, Südfassade bleibt sichtbar); ausgeblendet, wenn der Spieler im Gebäude steht
export function drawRoofs(ctx, v, ptx, pty) {
  const s = v.scale; visRange(v, vr);
  for (let cy = vr[2]; cy <= vr[3]; cy++) for (let cx = vr[0]; cx <= vr[1]; cx++) {
    const c = chunkAt(cx, cy); if (!c || !c.bld) continue;
    const b = c.bld, inside = ptx >= b.x && ptx < b.x + b.w && pty >= b.y && pty < b.y + b.h;
    c.roofA += ((inside ? 0 : 1) - c.roofA) * 0.15;
    if (c.roofA < 0.02) continue;
    const x = Math.round((b.x * T - 3) * s + v.tx), y = Math.round((b.y * T - 14) * s + v.ty), w = Math.round((b.w * T + 6) * s), h = Math.round(((b.h - 1) * T + 16) * s);
    ctx.globalAlpha = c.roofA;
    const col = W.season === 3 ? '#cfd6da' : ROOFCOL[b.type];
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y + h, w, Math.round(5 * s));          // Traufschatten auf der Fassade
    ctx.fillStyle = col; ctx.fillRect(x, y, w, h);
    const st = Math.max(2, Math.round(4 * s)), half = Math.max(1, st >> 1);
    ctx.fillStyle = shade(col, 0.86); for (let k = 0; k < w; k += st) ctx.fillRect(x + k, y, half, h);   // Wellblech
    ctx.fillStyle = shade(col, 1.22); ctx.fillRect(x, y + Math.round(h * 0.42), w, Math.max(1, Math.round(2 * s)));    // First
    ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fillRect(x, y + Math.round(h * 0.42), w, h - Math.round(h * 0.42));   // abgewandte Dachhälfte
    ctx.fillStyle = shade(col, 0.55); ctx.fillRect(x, y + h - Math.round(3 * s), w, Math.round(3 * s)); ctx.fillRect(x, y, w, Math.max(1, Math.round(s)));
    ctx.fillRect(x, y, Math.max(1, Math.round(1.5 * s)), h); ctx.fillRect(x + w - Math.max(1, Math.round(1.5 * s)), y, Math.max(1, Math.round(1.5 * s)), h);
    ctx.globalAlpha = 1;
  }
}
