// Interaktion mit der Welt: Kisten plündern, Beeren, Ernte, Wasser, Bauwerke.
import { G } from '../state.js';
import { LOOT, BLD_NAMES } from '../config.js';
import { T, W, key, getObj, getGround, setObj, buildingAt, G_WATER, O_CRATE, O_CRATE_O, O_BUSH, O_BUSH_E, O_CROP, O_NONE, O_CAR, O_CAR2, O_CAR_O } from '../world/world.js';
import { give, countItem, removeItem } from './inventory.js';
import { toast } from '../ui/hud.js';
import { sfx } from '../audio/audio.js';
import { mulberry, hash2 } from '../core/rng.js';
import { emitNoise } from './noise.js';

export const target = { kind: 0, tx: 0, ty: 0, s: null };   // kind: 0 nichts, 1 Struktur, 2 Kiste, 3 Busch, 4 Feld, 5 Wasser

export function findTarget() {
  const p = G.player, fx = p.x + Math.cos(p.ang) * 18, fy = p.y + Math.sin(p.ang) * 18;
  const ptx = Math.floor(p.x / T), pty = Math.floor(p.y / T);
  let best = 1e9; target.kind = 0; target.s = null;
  for (let y = pty - 1; y <= pty + 1; y++) for (let x = ptx - 1; x <= ptx + 1; x++) {
    let kind = 0, s = null;
    if (W.structs.size) { s = W.structs.get(key(x, y)); if (s) kind = 1; }
    if (!kind) {
      const ob = getObj(x, y);
      if (ob === O_CRATE) kind = 2; else if (ob === O_CAR || (ob === O_CAR2 && getObj(x - 1, y) === O_CAR)) kind = 6; else if (ob === O_BUSH && W.season !== 3) kind = 3; else if (ob === O_CROP) kind = 4;
      else if (getGround(x, y) === G_WATER) kind = 5;
    }
    if (!kind) continue;
    const dx = (x + 0.5) * T - fx, dy = (y + 0.5) * T - fy;
    let d = dx * dx + dy * dy; if (kind === 5) d += 900;
    if (d < best && d < 60 * 60) { best = d; target.kind = kind; target.tx = x; target.ty = y; target.s = s; }
  }
  return target.kind;
}

export function rollLoot(table, rnd) {
  let tot = 0; for (let i = 0; i < table.length; i++) tot += table[i][1];
  let r = rnd() * tot;
  for (let i = 0; i < table.length; i++) { r -= table[i][1]; if (r <= 0) { const e = table[i]; return [e[0], e[2] + Math.floor(rnd() * (e[3] - e[2] + 1))]; } }
  return [table[0][0], 1];
}

export function interact() {
  const k = findTarget(), tx = target.tx, ty = target.ty;
  if (!k) return;
  if (k === 1) { if (G.onStruct) G.onStruct(target.s); return; }
  if (k === 6) {
    const cx = getObj(tx, ty) === O_CAR2 ? tx - 1 : tx, rnd = mulberry((hash2(cx, ty, W.seed + 3) * 4294967296) | 0), n = 2 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) { const l = rollLoot(LOOT.car, rnd); give(l[0], l[1]); }
    setObj(cx, ty, O_CAR_O); sfx('pickup'); emitNoise(G.player.x, G.player.y, 110); toast('Autowrack durchsucht.');
    return;
  }
  if (k === 2) {
    const b = buildingAt(tx, ty), type = b ? b.type : 'house', rnd = mulberry((hash2(tx, ty, W.seed) * 4294967296) | 0);
    const n = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) { const l = rollLoot(LOOT[type], rnd); give(l[0], l[1]); }
    setObj(tx, ty, O_CRATE_O); sfx('pickup'); emitNoise(G.player.x, G.player.y, 90);
    toast(BLD_NAMES[type] + ': Kiste geplündert.');
  } else if (k === 3) { give('berries', 2 + ((Math.random() * 3) | 0)); setObj(tx, ty, O_BUSH_E); sfx('pickup'); }
  else if (k === 4) {
    if (W.season === 1 || W.season === 2) { give('veg', 1 + ((Math.random() * 2) | 0)); if (Math.random() < 0.35) give('seeds', 1); setObj(tx, ty, O_NONE); sfx('pickup'); }
    else toast(W.season === 3 ? 'Im Winter wächst hier nichts.' : 'Noch nicht reif (Ernte im Sommer/Herbst).');
  } else if (k === 5) {
    if (W.frozen) { toast('Zugefroren. Schmilz Schnee am Lagerfeuer (leere Flasche).'); return; }
    const n = countItem('bottle');
    if (n > 0) { removeItem('bottle', n); give('dwater', n); sfx('drink'); toast('Flaschen gefüllt – vor dem Trinken abkochen!'); }
    else { const p = G.player; p.thirst = Math.min(100, p.thirst + 25); sfx('drink'); if (Math.random() < 0.45) { p.sick = 45; toast('Ungekochtes Wasser… dir wird übel.', true); } else toast('Du trinkst aus dem Gewässer.'); }
  }
}
