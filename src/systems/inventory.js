// Inventar (Slots + Gewicht), Ausrüstung, Boden-Items.
import { G } from '../state.js';
import { CFG, ITEMS } from '../config.js';
import { floatText } from '../entities/fx.js';
import { sfx } from '../audio/audio.js';

export function newInventory() { return { slots: new Array(CFG.player.baseSlots).fill(null), weapon: -1, body: null, pack: null }; }
export function maxSlots() { const k = G.inv.pack; return CFG.player.baseSlots + (k ? ITEMS[k].slots : 0); }
export function maxWeight() { const k = G.inv.pack; return CFG.player.baseWeight + (k ? ITEMS[k].carry : 0); }
export function weight() {
  let w = 0; const s = G.inv.slots;
  for (let i = 0; i < s.length; i++) if (s[i]) w += ITEMS[s[i].id].w * s[i].n;
  if (G.inv.body) w += ITEMS[G.inv.body].w * 0.5;
  return w;
}
export function countItem(id, slots) { let n = 0; const s = slots || G.inv.slots; for (let i = 0; i < s.length; i++) if (s[i] && s[i].id === id) n += s[i].n; return n; }
export function removeItem(id, n, slots) {
  const s = slots || G.inv.slots;
  if (countItem(id, s) < n) return false;
  for (let i = s.length - 1; i >= 0 && n > 0; i--) if (s[i] && s[i].id === id) {
    const k = Math.min(n, s[i].n); s[i].n -= k; n -= k;
    if (s[i].n <= 0) { s[i] = null; if (s === G.inv.slots && G.inv.weapon === i) G.inv.weapon = -1; }
  }
  return true;
}
export function makeItem(id, n) {
  const it = ITEMS[id], o = { id, n: n || 1 };
  if (it.dur) o.d = it.dur; if (it.spoil) o.f = 1; if (it.t === 'gun') o.m = 0; if (it.burn) o.d = it.burn;
  return o;
}
// Fügt Item-Objekt in Slot-Array ein; gibt Rest (Anzahl) zurück
export function addTo(slots, max, o) {
  const it = ITEMS[o.id], st = it.st || 1; let n = o.n;
  if (st > 1) for (let i = 0; i < max && n > 0; i++) {
    const s = slots[i];
    if (s && s.id === o.id && s.n < st) { const k = Math.min(n, st - s.n); if (o.f !== undefined) s.f = (s.f * s.n + o.f * k) / (s.n + k); s.n += k; n -= k; }
  }
  for (let i = 0; i < max && n > 0; i++) if (!slots[i]) { const k = Math.min(n, st); slots[i] = Object.assign({}, o, { n: k }); n -= k; }
  return n;
}
export function addItem(o) {
  const it = ITEMS[o.id];
  const room = Math.floor((maxWeight() * 1.3 - weight()) / it.w + 1e-6);
  if (room <= 0) return o.n;
  const take = Math.min(o.n, room), rest0 = o.n - take;
  const tmp = take === o.n ? o : Object.assign({}, o, { n: take });
  return addTo(G.inv.slots, maxSlots(), tmp) + rest0;
}
// Gibt Items; was nicht passt, landet am Boden
export function give(id, n, quiet) {
  const o = makeItem(id, n), rest = addItem(o), p = G.player;
  if (rest < o.n && !quiet) floatText(p.x, p.y - 14, '+' + (o.n - rest) + ' ' + ITEMS[id].n, '#cfc');
  if (rest > 0) { o.n = rest; dropAt(p.x + Math.random() * 20 - 10, p.y + Math.random() * 20 - 10, o); }
}
export function hasCost(cost, slots) { for (const k in cost) if (countItem(k, slots) < cost[k]) return false; return true; }
export function payCost(cost) { for (const k in cost) removeItem(k, cost[k]); }

export function dropAt(x, y, o) { if (G.drops.length > 150) G.drops.shift(); G.drops.push({ x, y, o, t: 0 }); }
export function updateDrops(dt) {
  const p = G.player, d = G.drops, r2 = CFG.player.pickup * CFG.player.pickup;
  for (let i = d.length - 1; i >= 0; i--) {
    const it = d[i]; it.t += dt; if (it.t < 0.6) continue;
    const dx = it.x - p.x, dy = it.y - p.y;
    if (dx * dx + dy * dy > r2) continue;
    const before = it.o.n, rest = addItem(it.o);
    if (rest < before) { floatText(p.x, p.y - 14, '+' + (before - rest) + ' ' + ITEMS[it.o.id].n, '#cfc'); sfx('pickup', 0.7); }
    if (rest <= 0) d.splice(i, 1); else { it.o.n = rest; it.t = -1.5; }
  }
}
