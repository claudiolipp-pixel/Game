// Kampf: Nahkampf (mit Haltbarkeit), Fernkampf (Munition, Nachladen), Bäume fällen / Steine abbauen.
import { G } from '../state.js';
import { ITEMS, FISTS } from '../config.js';
import { input } from '../core/input.js';
import { query, Q } from './spatial.js';
import { damageZombie } from '../entities/zombies.js';
import { fireShot } from '../entities/projectiles.js';
import { emitNoise } from './noise.js';
import { sfx } from '../audio/audio.js';
import { burst, particle } from '../entities/fx.js';
import { toast } from '../ui/hud.js';
import { countItem, removeItem, give } from './inventory.js';
import { T, W, key, getObj, setObj, O_TREE, O_ROCK, O_STUMP, O_NONE, O_WINDOW } from '../world/world.js';
import { CFG } from '../config.js';

export function weaponSlot() { return G.inv.weapon >= 0 ? G.inv.slots[G.inv.weapon] : null; }
export function weaponDef() { const s = weaponSlot(); return s ? ITEMS[s.id] : FISTS; }

export function cycleWeapon() {
  const s = G.inv.slots, n = s.length, start = G.inv.weapon;
  for (let k = 1; k <= n + 1; k++) {
    const i = start + k;
    if (i >= n) { if (start !== -1) { G.inv.weapon = -1; break; } continue; }
    const it = s[i] && ITEMS[s[i].id];
    if (it && (it.t === 'melee' || it.t === 'gun')) { G.inv.weapon = i; break; }
  }
  G.player.reloadT = 0; sfx('click'); toast('Waffe: ' + weaponDef().n);
}
export function startReload() {
  const p = G.player, s = weaponSlot(); if (!s || p.reloadT > 0) return;
  const w = ITEMS[s.id]; if (w.t !== 'gun' || !w.reload || s.m >= w.mag) return;
  if (countItem(w.ammo) <= 0) { toast('Keine Munition: ' + ITEMS[w.ammo].n, true); sfx('empty'); return; }
  p.reloadT = w.reload; sfx('reload');
}
function finishReload() {
  const s = weaponSlot(); if (!s) return; const w = ITEMS[s.id]; if (w.t !== 'gun') return;
  const k = Math.min(w.mag - s.m, countItem(w.ammo)); removeItem(w.ammo, k); s.m += k; sfx('reload');
}
function wear(s, amt) {
  if (!s || s.d === undefined) return;
  s.d -= amt;
  if (s.d <= 0) { toast(ITEMS[s.id].n + ' ist zerbrochen!', true); G.inv.slots[G.inv.weapon] = null; G.inv.weapon = -1; sfx('snap'); }
}

function melee(w, s) {
  const p = G.player, ax = Math.cos(p.ang), ay = Math.sin(p.ang);
  p.atkCd = w.cd; p.swing = 0.16; p.swingArc = w.arc; p.swingR = w.range;
  if (p.stamina < 5) p.atkCd *= 1.6; else p.stamina -= 3;
  sfx('swing');
  const n = query(p.x + ax * w.range * 0.5, p.y + ay * w.range * 0.5, w.range + 14);
  let hit = false;
  for (let i = 0; i < n; i++) {
    const z = Q.items[i], dx = z.x - p.x, dy = z.y - p.y, d = Math.hypot(dx, dy);
    if (d > w.range + z.r) continue;
    let da = Math.atan2(dy, dx) - p.ang; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
    if (Math.abs(da) > w.arc * 0.5 + 0.25 && d > 16) continue;
    damageZombie(z, w.dmg * (0.9 + Math.random() * 0.25), 0, dx / (d || 1) * w.kb * 3, dy / (d || 1) * w.kb * 3);
    hit = true;
  }
  if (hit) { sfx('hit'); wear(s, 1); G.shake = Math.min(6, G.shake + 1.5); return; }
  // Baum / Stein vor dem Spieler
  for (let r = 14; r <= 30; r += 16) {
    const tx = Math.floor((p.x + ax * r) / T), ty = Math.floor((p.y + ay * r) / T), ob = getObj(tx, ty);
    if (ob === O_WINDOW) {   // Fenster einschlagen: neuer Eingang, aber laut
      setObj(tx, ty, O_NONE); sfx('snap'); sfx('alarm', 0.5); burst((tx + 0.5) * T, (ty + 0.5) * T, 10, '#cef', 120, 0.4, 2);
      emitNoise(p.x, p.y, CFG.noise.glass); toast('Glas zerbrochen – das war laut.'); return;
    }
    if (ob !== O_TREE && ob !== O_ROCK) continue;
    const k = key(tx, ty), max = ob === O_TREE ? 7 : 9;
    const left = (W.dmg.has(k) ? W.dmg.get(k) : max) - (ob === O_TREE ? (w.chop || 1) : (w === FISTS ? 0.5 : 1.5));
    sfx('chop'); burst((tx + 0.5) * T, (ty + 0.5) * T, 4, ob === O_TREE ? '#94693c' : '#aaa', 70, 0.3, 2); wear(s, 1);
    if (left <= 0) {
      W.dmg.delete(k);
      if (ob === O_TREE) { setObj(tx, ty, O_STUMP); give('wood', 2 + ((Math.random() * 2) | 0)); }
      else { setObj(tx, ty, O_NONE); give('stone', 2 + ((Math.random() * 2) | 0)); }
    } else W.dmg.set(k, left);
    return;
  }
}

function shoot(w, s) {
  const p = G.player;
  if (w.reload) {
    if (s.m <= 0) { if (p.reloadT <= 0) startReload(); p.atkCd = 0.25; return; }
    s.m--;
  } else if (!removeItem(w.ammo, 1)) { toast('Keine ' + ITEMS[w.ammo].n + '!', true); sfx('empty'); p.atkCd = 0.5; return; }
  p.atkCd = w.cd;
  const mx = p.x + Math.cos(p.ang) * 14, my = p.y + Math.sin(p.ang) * 14;
  for (let i = 0; i < w.pellets; i++) fireShot(mx, my, p.ang + (Math.random() - 0.5) * 2 * w.spread, w.speed * (0.9 + Math.random() * 0.2), w.dmg, w.life || 0.9, w.pierce || 0, 0, w.silent ? 1 : 0);
  sfx(w.silent ? 'bow' : s.id);
  if (!w.silent) { G.flashT = 0.06; G.shake = Math.min(7, G.shake + 2.5); particle(mx, my, 0, 0, 0.05, '#ffe9a0', 6, 0); }
  emitNoise(p.x, p.y, w.noise);
}

export function updateCombat(dt) {
  const p = G.player;
  if (p.atkCd > 0) p.atkCd -= dt;
  if (p.swing > 0) p.swing -= dt;
  if (p.reloadT > 0) { p.reloadT -= dt; if (p.reloadT <= 0) finishReload(); }
  if (input.act.swap) cycleWeapon();
  if (input.act.reload) startReload();
  if (p.mounted || G.build) return;
  if (input.fire && p.atkCd <= 0 && p.reloadT <= 0) {
    const s = weaponSlot(), w = s ? ITEMS[s.id] : FISTS;
    if (w.t === 'gun') shoot(w, s); else melee(w, s);
  }
}
