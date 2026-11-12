// Bauwerke: Platzieren, Schaden, Upgrades, Basis-Objekte und Fallen. (Türme/Generator: building/turrets.js)
import { G } from '../state.js';
import { CFG, BUILD } from '../config.js';
import { settings } from '../core/save.js';
import { W, T, key, tileSolid, getGround, G_WATER } from '../world/world.js';
import { query, Q } from '../systems/spatial.js';
import { damageZombie } from '../entities/zombies.js';
import { hurtPlayer } from '../entities/player.js';
import { burst, particle } from '../entities/fx.js';
import { addLight } from '../render/lighting.js';
import { emitNoise } from '../systems/noise.js';
import { sfx } from '../audio/audio.js';
import { toast } from '../ui/hud.js';
import { dropAt, countItem, removeItem } from '../systems/inventory.js';
import { spoilSlots } from '../systems/survival.js';

export const ST = { list: [], turrets: [], beh: {}, onHit: {} };
export function clearStructs() { ST.list.length = 0; ST.turrets.length = 0; W.structs.clear(); }
export const dmgMul = s => CFG.build.upgDmg[s.lvl - 1];
const SAVE_KEYS = ['id', 'tx', 'ty', 'hp', 'lvl', 'rot', 'ammo', 'on', 'shut', 'grow', 'planted', 'water', 'inv', 't'];
export function serializeStructs() { return ST.list.map(s => { const o = {}; for (const k of SAVE_KEYS) o[k] = s[k]; return o; }); }

export function placeStruct(id, tx, ty, rot, data) {
  const def = BUILD[id];
  const s = { id, def, tx, ty, x: (tx + 0.5) * T, y: (ty + 0.5) * T, lvl: 1, rot: rot || 0, hp: def.hp, maxHp: def.hp, ammo: 0, on: false, t: 0, cd: 0,
    scan: Math.random() * 0.2, ang: (rot || 0) * Math.PI / 2, shut: false, grow: 0, planted: id === 'plot', water: 0, inv: null, pow: false, fire: 0, tick: Math.random() * 0.1, dead: false, tgt: null };
  if (def.slots) s.inv = new Array(def.slots).fill(null);
  if (data) { for (const k of SAVE_KEYS) if (data[k] !== undefined && data[k] !== null) s[k] = data[k]; s.ang = s.rot * Math.PI / 2; }
  s.maxHp = def.hp * CFG.build.upgHp[s.lvl - 1];
  ST.list.push(s); W.structs.set(key(tx, ty), s);
  if (def.turret || id === 'mg' || id === 'gen') ST.turrets.push(s);
  return s;
}
export function removeStruct(s) {
  let i = ST.list.indexOf(s); if (i >= 0) ST.list.splice(i, 1);
  i = ST.turrets.indexOf(s); if (i >= 0) ST.turrets.splice(i, 1);
  if (W.structs.get(key(s.tx, s.ty)) === s) W.structs.delete(key(s.tx, s.ty));
  s.dead = true; s.hp = 0;
  if (G.player.mounted === s) G.player.mounted = null;
}
export function canPlace(id, tx, ty) {
  if (W.structs.has(key(tx, ty))) return false;
  if (tileSolid(tx, ty, false)) return false;
  if (getGround(tx, ty) === G_WATER) return false;
  const p = G.player;
  if (BUILD[id].pblock && Math.floor(p.x / T) === tx && Math.floor(p.y / T) === ty) return false;
  return true;
}
function destroy(s, quiet) {
  if (s.inv) for (const o of s.inv) if (o) dropAt(s.x + Math.random() * 20 - 10, s.y + Math.random() * 20 - 10, o);
  burst(s.x, s.y, 10, '#94693c', 110, 0.5, 3); sfx('snap', 1, s.x, s.y);
  if (!quiet && !s.def.trap) toast(s.def.n + ' wurde zerstört!', true);
  removeStruct(s);
}
// Schaden an Bauwerk (z = angreifender Zombie oder null)
export function damageStruct(s, dmg, z) {
  if (s.dead) return;
  s.hp -= dmg; s.hitT = 0.15;
  sfx('chop', 0.7, s.x, s.y, 0.12); if (Math.random() < 0.4) particle(s.x, s.y, Math.random() * 60 - 30, Math.random() * 60 - 30, 0.3, '#94693c', 2, 3);
  if (z) {
    if (s.def.thorns) damageZombie(z, s.def.thorns * dmgMul(s), 1, 0, 0);
    if (ST.onHit[s.id]) ST.onHit[s.id](s, z);
  }
  if (s.hp <= 0) destroy(s);
}
export function explode(x, y, rad, dmg, src) {
  sfx('explosion', 1, x, y); G.shake = 9; G.flashT = 0.12; emitNoise(x, y, 900);
  burst(x, y, 26, '#f80', 260, 0.6, 4); burst(x, y, 16, '#444', 150, 1.0, 5); burst(x, y, 10, '#fe8', 320, 0.3, 3);
  const n = query(x, y, rad);
  for (let i = 0; i < n; i++) { const z = Q.items[i], d = Math.hypot(z.x - x, z.y - y); damageZombie(z, dmg * (1 - 0.6 * d / rad), src, (z.x - x) * 3, (z.y - y) * 3); }
  const p = G.player, pd = Math.hypot(p.x - x, p.y - y);
  if (pd < rad) hurtPlayer(dmg * 0.35 * (1 - pd / rad), 'Von der eigenen Sprengfalle zerrissen', null);
  for (let i = ST.list.length - 1; i >= 0; i--) { const o = ST.list[i], d = Math.hypot(o.x - x, o.y - y); if (d < rad && d > 4) { if (o.id === 'gas') igniteGas(o); else if (o.id === 'bomb' && !o.dead) { removeStruct(o); explode(o.x, o.y, o.def.rad, o.def.dmg, 1); } else damageStruct(o, dmg * 0.3 * (1 - d / rad), null); } }
}
export function igniteGas(s) {
  if (s.fire > 0 || s.dead) return;
  if (G.env.raining) { if (!s.wetMsg) { s.wetMsg = 1; toast('Regen: Die Benzinpfütze zündet nicht.'); } return; }
  s.fire = s.def.burn; sfx('fire', 1, s.x, s.y); emitNoise(s.x, s.y, 200);
}

function trapTick(s, dt) {
  const d = s.def, p = G.player, n = query(s.x, s.y, 19);
  switch (s.id) {
    case 'spikes': case 'wire':
      for (let i = 0; i < n; i++) { const z = Q.items[i]; z.slowT = 0.3; z.slowF = d.slow; const dm = d.dps * dt * dmgMul(s); damageZombie(z, dm, 1, 0, 0); s.hp -= dm * 0.22; }
      break;
    case 'beartrap':
      if (!s.shut) for (let i = 0; i < n; i++) { const z = Q.items[i]; if (z.def.heavy) continue; z.holdT = d.hold * (1 + (s.lvl - 1) * 0.5); damageZombie(z, d.dmg * dmgMul(s), 1, 0, 0); s.shut = true; sfx('snap', 1, s.x, s.y); break; }
      break;
    case 'tripwire':
      if (s.cd <= 0) for (let i = 0; i < n; i++) { if (Q.items[i].def.animal) continue; s.cd = 12; sfx('alarm', 1.4); toast('ALARM! Stolperdraht ausgelöst.', true); G.alarmT = 6; break; }
      break;
    case 'bomb':
      for (let i = 0; i < n; i++) { if (Q.items[i].def.animal) continue; removeStruct(s); explode(s.x, s.y, d.rad * (1 + (s.lvl - 1) * 0.15), d.dmg * dmgMul(s), 1); return; }
      break;
  }
  // Spieler in eigener Falle (außer „Fallen markieren“)
  if (!settings.markTraps && s.id !== 'gas' && s.id !== 'tripwire' && Math.abs(p.x - s.x) < 13 && Math.abs(p.y - s.y) < 13 && !p.mounted) {
    if (s.id === 'spikes' || s.id === 'wire') { p.slowT = 0.3; hurtPlayer(d.dps * 0.5 * dt, 'In der eigenen Falle verblutet', null); }
    else if (s.id === 'beartrap' && !s.shut) { s.shut = true; p.slowT = 3; sfx('snap'); hurtPlayer(16, 'In der eigenen Bärenfalle verblutet', null); toast('Du bist in deine eigene Bärenfalle getreten!', true); }
    else if (s.id === 'bomb') { removeStruct(s); explode(s.x, s.y, d.rad, d.dmg, 1); return; }
  }
  if (s.hp <= 0) destroy(s, true);
}

let refillT = 0;
export function updateStructs(dt) {
  const l = ST.list, p = G.player, e = G.env, dark = e.dark > 0.05;
  refillT -= dt; const refill = refillT <= 0; if (refill) refillT = 2;
  for (let i = l.length - 1; i >= 0; i--) {
    const s = l[i], d = s.def;
    if (s.hitT > 0) s.hitT -= dt;
    if (s.cd > 0) s.cd -= dt;
    if (d.trap) {
      if (s.id === 'gas') {
        if (s.fire > 0) {
          s.fire -= dt * (e.raining ? 3 : 1); addLight(s.x, s.y, 150, 0.95);
          if (G.tick % 3 === 0) particle(s.x + Math.random() * 40 - 20, s.y + Math.random() * 40 - 20, 0, -40, 0.5, Math.random() < 0.5 ? '#f80' : '#fc3', 4, 0);
          const n = query(s.x, s.y, d.rad);
          for (let k = 0; k < n; k++) { const z = Q.items[k]; damageZombie(z, d.dps * dt * dmgMul(s) * (z.frost ? 2 : 1), 1, 0, 0); z.burnT = 4; }
          if (Math.hypot(p.x - s.x, p.y - s.y) < d.rad * 0.7) hurtPlayer(d.dps * 0.4 * dt, 'Im eigenen Feuer verbrannt', null);
          if (s.fire <= 0) { removeStruct(s); continue; }
        }
      } else { s.tick -= dt; if (s.tick <= 0) { s.tick += 0.1; trapTick(s, 0.1); } }
      continue;
    }
    switch (s.id) {
      case 'campfire':
        if (dark) addLight(s.x, s.y, d.light * (1 + (s.lvl - 1) * 0.2), 0.95);
        if (Math.abs(p.x - s.x) < 80 && Math.abs(p.y - s.y) < 80) p.fireT = 0.5;
        if (G.tick % 8 === 0) particle(s.x + Math.random() * 8 - 4, s.y, Math.random() * 10 - 5, -30, 0.6, Math.random() < 0.5 ? '#f80' : '#fc3', 3, 0);
        break;
      case 'collector': if (e.raining && s.water < d.cap * s.lvl) s.water = Math.min(d.cap * s.lvl, s.water + dt * (480 / G.dayLen) / 22); break;
      case 'plot':
        if (s.planted) { if (e.season === 3) { s.planted = false; s.grow = 0; } else if (e.season < 2 && s.grow < 1) s.grow = Math.min(1, s.grow + dt / G.dayLen / d.grow * (e.raining ? 1.5 : 1)); }
        break;
      case 'lure':
        if (s.on) { s.t -= dt; if (s.cd <= 0) { s.cd = 2; emitNoise(s.x, s.y, CFG.noise.lure); sfx('ring', 0.8, s.x, s.y); burst(s.x, s.y, 3, '#ff8', 60, 0.4, 2); } if (s.t <= 0) { s.on = false; } }
        break;
      default: if (ST.beh[s.id]) ST.beh[s.id](s, dt);
    }
    // Munition aus angrenzender Kiste
    if (refill && d.ammo && d.cap && s.ammo < d.cap * 0.5) {
      for (let k = 0; k < 4; k++) {
        const c = W.structs.get(key(s.tx + (k === 0) - (k === 1), s.ty + (k === 2) - (k === 3)));
        if (!c || !c.inv) continue;
        const have = countItem(d.ammo, c.inv); if (!have) continue;
        const take = Math.min(have, Math.ceil(d.cap - s.ammo)); removeItem(d.ammo, take, c.inv); s.ammo += take; break;
      }
    }
  }
  if (G.alarmT > 0) G.alarmT -= dt;
}
// Zeit überspringen (Schlafen): Wachstum etc. nachholen
export function skipStructs(sec) {
  for (const s of ST.list) if (s.id === 'plot' && s.planted && G.env.season < 2) s.grow = Math.min(1, s.grow + sec / G.dayLen / s.def.grow);
}
G.onSpoil = (k, m) => { for (const s of ST.list) if (s.inv) spoilSlots(s.inv, k, m); };
