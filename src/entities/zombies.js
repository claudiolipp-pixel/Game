// Zombies: Pool, Spawning, KI (Wandern → Wahrnehmen → Verfolgen → Angreifen), Horden.
import { G } from '../state.js';
import { CFG, ZT, ZKEYS, ANIMALS } from '../config.js';
import { moveCircle, losClear, tileSolid, W, T } from '../world/world.js';
import { rebuildHash, query, Q } from '../systems/spatial.js';
import { computeFlow, flowDir } from '../systems/flowfield.js';
import { emitNoise } from '../systems/noise.js';
import { blood, burst, particle } from './fx.js';
import { sfx } from '../audio/audio.js';
import { hurtPlayer } from './player.js';
import { damageStruct, ST } from '../building/structures.js';

export const Z = { list: [], count: 0, ambient: 0, animals: 0, migA: 0, spawnT: 0, flowT: 0, hordeT: 0, onKill: null };
for (let i = 0; i < CFG.MAX_ZOMBIES; i++) Z.list.push({ alive: false, x: 0, y: 0, ox: 0, oy: 0, r: 9, type: 'walker', def: ZT.walker, hp: 1, maxHp: 1, state: 0, tx: 0, ty: 0,
  think: 0, atk: 0, ang: 0, slowT: 0, slowF: 1, holdT: 0, burnT: 0, stunT: 0, frost: false, horde: false, flash: 0, wanderT: 0, wx: 0, wy: 0, kx: 0, ky: 0, lost: 0, scream: 0, seen: false, tgt: null, tgtT: 0 });
const dir = { x: 0, y: 0 };

export function clearZombies() { for (const z of Z.list) z.alive = false; Z.count = 0; Z.ambient = 0; Z.spawnT = 0; Z.hordeT = 0; }

export function spawnZombie(type, x, y, horde) {
  if (Z.count >= CFG.MAX_ZOMBIES) return null;
  let z = null; for (let i = 0; i < Z.list.length; i++) if (!Z.list[i].alive) { z = Z.list[i]; break; }
  if (!z) return null;
  const d = ZT[type], e = G.env, zc = CFG.zombies;
  z.alive = true; z.x = z.ox = x; z.y = z.oy = y; z.type = type; z.def = d; z.r = d.r;
  z.maxHp = z.hp = d.hp * (1 + zc.hpPerDay * e.day) * (1 + e.year * zc.yearMult);
  if (d.animal) z.maxHp = z.hp = d.hp;
  z.frost = !d.animal && e.season === 3 && Math.random() < zc.frostChance; if (z.frost) z.maxHp = z.hp *= 1.4;
  z.state = horde ? 2 : 0; z.horde = !!horde; z.think = Math.random() * 0.4; z.atk = 0.5; z.ang = Math.random() * 6.283;
  z.slowT = z.holdT = z.burnT = z.stunT = z.flash = 0; z.kx = z.ky = 0; z.lost = 0; z.scream = 0; z.wanderT = 0; z.seen = false; z.tgt = null; z.tgtT = 0;
  Z.count++; return z;
}

export function damageZombie(z, dmg, src, kx, ky) {
  if (!z.alive) return;
  z.hp -= dmg; z.flash = 0.12;
  if (kx || ky) { const f = z.def.heavy ? 0.25 : 1; z.kx += kx * f; z.ky += ky * f; }
  blood(z.x, z.y, 3);
  if (z.state !== 2 && src === 0) { z.state = 2; z.lost = 0; }
  if (z.hp <= 0) {
    z.alive = false; Z.count--;
    if (!z.def.animal) { G.stats.kills++; if (src) G.stats.trapKills++; }
    blood(z.x, z.y, 10); sfx('hit', 0.6, z.x, z.y);
    if (Z.onKill) Z.onKill(z);
  }
}

function pickType() {
  const day = G.env.day; let tot = 0;
  for (let i = 0; i < ZKEYS.length; i++) { const d = ZT[ZKEYS[i]]; if (day >= d.minDay) tot += d.w * (1 + Math.min(2, (day - d.minDay) * 0.04)); }
  let r = Math.random() * tot;
  for (let i = 0; i < ZKEYS.length; i++) { const d = ZT[ZKEYS[i]]; if (day < d.minDay) continue; r -= d.w * (1 + Math.min(2, (day - d.minDay) * 0.04)); if (r <= 0) return ZKEYS[i]; }
  return 'walker';
}
function spawnRing(n, horde, ang) {
  const p = G.player, zc = CFG.zombies;
  const a0 = ang === undefined ? Math.random() * 6.283 : ang;
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < 6; t++) {
      const a = a0 + (Math.random() - 0.5) * (horde ? 0.9 : 0.5), d = zc.spawnMin + Math.random() * (zc.spawnMax - zc.spawnMin);
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      if (tileSolid(Math.floor(x / T), Math.floor(y / T), true)) continue;
      spawnZombie(pickType(), x, y, horde); break;
    }
  }
}
function spawner(dt) {
  const e = G.env, zc = CFG.zombies, S = CFG.seasons[e.season];
  Z.spawnT -= dt;
  if (Z.spawnT <= 0) {
    Z.spawnT = 1.2;
    let target = (zc.baseCount + zc.perDay * e.day) * (1 + (zc.nightMult - 1) * e.dark) * S.zCount * (1 + e.year * zc.yearMult);
    if (e.day === 0 && G.clock < G.dayLen * 0.45) target *= 0.5;      // sanfter Einstieg
    target = Math.min(zc.maxAmbient, target);
    if (Z.animals < ANIMALS.count[e.season] && Z.count < CFG.MAX_ZOMBIES - 40) {
      const a = Math.random() * 6.283, dd = zc.spawnMin + Math.random() * 150, x = G.player.x + Math.cos(a) * dd, y = G.player.y + Math.sin(a) * dd;
      if (!tileSolid(Math.floor(x / T), Math.floor(y / T), true)) { const herd = e.season === 2 ? 3 : 1, k = Math.random() < 0.5 ? 'deer' : 'rabbit'; for (let i = 0; i < herd; i++) spawnZombie(k, x + i * 14, y + i * 9, false); }
    }
    if (Z.ambient < target) spawnRing(e.season === 1 ? 3 + ((Math.random() * 3) | 0) : 1 + ((Math.random() * 2) | 0), false);
  }
  if (e.bloodMoon) {
    Z.hordeT -= dt;
    if (Z.hordeT <= 0) {
      Z.hordeT = zc.hordeWave;
      const n = Math.min(zc.hordeMax, Math.round(zc.hordeBase + zc.hordePerDay * e.day * (1 + e.year * zc.yearMult)));
      spawnRing(n, true, Math.random() * 6.283);
      sfx('groan', 1.5);
    }
  } else Z.hordeT = 3;
}

export function updateZombies(dt) {
  const p = G.player, e = G.env, zc = CFG.zombies, l = Z.list;
  spawner(dt);
  Z.flowT -= dt; if (Z.flowT <= 0) { Z.flowT = 0.4; computeFlow(p.x, p.y); }
  rebuildHash(l, p.x, p.y);
  const desp2 = zc.despawn * zc.despawn;
  let sight = (zc.sight + (zc.sightNight - zc.sight) * e.dark) * e.sight;
  if (p.sneaking) sight *= zc.sneakMult; else if (p.sprinting) sight *= zc.sprintMult;
  if (p.lit) sight = Math.max(sight, zc.sightNight * 1.5 * e.sight);
  const spMul = CFG.seasons[e.season].zSpeed * e.zSpeed;
  let amb = 0, ani = 0;
  Z.migA += dt * 0.01;
  for (let i = 0; i < l.length; i++) {
    const z = l[i]; if (!z.alive) continue;
    z.ox = z.x; z.oy = z.y;
    const dxp = p.x - z.x, dyp = p.y - z.y, d2 = dxp * dxp + dyp * dyp;
    if (d2 > desp2 && !(z.horde && e.bloodMoon)) { z.alive = false; Z.count--; continue; }
    const d = Math.sqrt(d2);
    if (z.def.animal) {   // Wildtier: wandern, im Herbst ziehen, vor dem Spieler fliehen
      ani++;
      if (z.flash > 0) z.flash -= dt;
      if (z.kx || z.ky) { z.kx = z.ky = 0; }
      let vx = 0, vy = 0, sp = z.def.sp;
      if (d < (p.sneaking ? ANIMALS.fleeSneak : ANIMALS.flee) || z.hp < z.maxHp) { vx = -dxp / (d || 1); vy = -dyp / (d || 1); z.wanderT = 1.5; }
      else {
        z.wanderT -= dt;
        if (z.wanderT <= 0) { z.wanderT = 1 + Math.random() * 3; if (e.season === 2) { z.wx = Math.cos(Z.migA); z.wy = Math.sin(Z.migA); } else if (Math.random() < 0.5) { const a = Math.random() * 6.283; z.wx = Math.cos(a); z.wy = Math.sin(a); } else z.wx = z.wy = 0; }
        vx = z.wx; vy = z.wy; sp *= 0.25;
      }
      if (vx || vy) { z.ang = Math.atan2(vy, vx); if (moveCircle(z, vx * sp * dt, vy * sp * dt, true)) { const a = Math.random() * 6.283; z.wx = Math.cos(a); z.wy = Math.sin(a); if (z.wanderT > 1) moveCircle(z, z.wx * sp * dt, z.wy * sp * dt, true); } }
      continue;
    }
    if (!z.horde) amb++;
    if (z.flash > 0) z.flash -= dt;
    if (z.atk > 0) z.atk -= dt;
    if (z.burnT > 0) { z.burnT -= dt; damageZombie(z, 9 * dt * (z.frost ? 2.2 : 1), 1, 0, 0); if ((G.tick + i) % 6 === 0) particle(z.x, z.y, 0, -30, 0.4, '#f80', 3, 0); if (!z.alive) continue; }
    // Wahrnehmung (gestaffelt)
    z.think -= dt;
    if (z.think <= 0) {
      z.think = 0.25 + Math.random() * 0.2;
      if (d < sight && (d < 50 || losClear(z.x, z.y, p.x, p.y))) {
        if (z.state !== 2 && Math.random() < 0.5) sfx('groan', 0.8, z.x, z.y, 0.6);
        z.state = 2; z.lost = 0;
        if (z.def.scream && z.scream <= 0) { z.scream = 12; sfx('scream', 1, z.x, z.y); emitNoise(z.x, z.y, z.def.scream); burst(z.x, z.y, 8, '#fff', 120, 0.4, 2); }
      } else if (z.state === 2 && !z.horde) { z.lost += 0.35; if (z.lost > 4) { z.state = 1; z.tx = p.x; z.ty = p.y; } }
      if (z.horde && !e.bloodMoon) z.horde = false;
      // Türme gezielt angreifen
      if (z.state === 2 && !z.tgt && ST.turrets.length && Math.random() < 0.3) {
        for (let k = 0; k < ST.turrets.length; k++) { const t = ST.turrets[k]; if (Math.abs(t.x - z.x) < 90 && Math.abs(t.y - z.y) < 90) { z.tgt = t; z.tgtT = 5; break; } }
      }
    }
    if (z.scream > 0) z.scream -= dt;
    // Knockback
    if (z.kx || z.ky) { moveCircle(z, z.kx * dt, z.ky * dt, true); z.kx *= 0.82; z.ky *= 0.82; if (Math.abs(z.kx) + Math.abs(z.ky) < 4) z.kx = z.ky = 0; }
    if (z.stunT > 0) { z.stunT -= dt; continue; }
    // Zielrichtung
    let vx = 0, vy = 0, sp = z.def.sp * spMul;
    if (z.tgt) { z.tgtT -= dt; if (z.tgt.dead || z.tgtT <= 0 || d < 30) z.tgt = null; }
    if (z.tgt) { const tx = z.tgt.x - z.x, ty = z.tgt.y - z.y, td = Math.hypot(tx, ty) || 1; vx = tx / td; vy = ty / td; }
    else if (z.state === 2) {
      if (d < 44 || !flowDir(z.x, z.y, dir)) { dir.x = dxp / (d || 1); dir.y = dyp / (d || 1); }
      vx = dir.x; vy = dir.y;
    } else if (z.state === 1) {
      const tx = z.tx - z.x, ty = z.ty - z.y, td = Math.hypot(tx, ty);
      if (td < 18) { z.state = 0; z.wanderT = 2 + Math.random() * 4; z.wx = z.wy = 0; } else { vx = tx / td; vy = ty / td; }
      sp *= 0.8;
    } else {
      z.wanderT -= dt;
      if (z.wanderT <= 0) { z.wanderT = 1.5 + Math.random() * 4; if (Math.random() < 0.55) { const a = Math.random() * 6.283; z.wx = Math.cos(a); z.wy = Math.sin(a); } else z.wx = z.wy = 0; }
      vx = z.wx; vy = z.wy; sp *= 0.4;
    }
    if (z.slowT > 0) { z.slowT -= dt; sp *= z.slowF; }
    if (z.holdT > 0) { z.holdT -= dt; sp = 0; }
    // Separation
    const n = query(z.x, z.y, z.r + 10);
    for (let k = 0; k < n; k++) { const o = Q.items[k]; if (o === z) continue; const sx = z.x - o.x, sy = z.y - o.y, sd = Math.hypot(sx, sy) || 1; const push = (z.r + o.r - sd) / (z.r + o.r); if (push > 0) { vx += sx / sd * push * 1.5; vy += sy / sd * push * 1.5; } }
    if (vx || vy) {
      if (z.state !== 0 || z.wx || z.wy) z.ang = Math.atan2(vy, vx);
      W.hit = null;
      const res = moveCircle(z, vx * sp * dt, vy * sp * dt, true);
      if (res === 2 && W.hit && z.atk <= 0 && z.state !== 0) { z.atk = z.def.cd; damageStruct(W.hit, z.def.sdmg, z); }
      else if (res === 1 && z.state === 0) z.wanderT = 0;
    }
    // Angriff auf Spieler
    if (d < z.r + p.r + 5 && z.atk <= 0) {
      z.atk = z.def.cd; z.ang = Math.atan2(dyp, dxp);
      hurtPlayer(z.def.dmg, 'Von einem ' + z.def.n + ' zerfleischt', z);
    }
  }
  Z.ambient = amb; Z.animals = ani;
}
