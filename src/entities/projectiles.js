// Projektile (Object Pool): Kugeln, Pfeile, Bolzen.
import { G } from '../state.js';
import { T, W, key, getObj, O_TREE, O_ROCK, O_WALL, O_WINDOW } from '../world/world.js';
import { query, Q } from '../systems/spatial.js';
import { damageZombie } from './zombies.js';
import { burst } from './fx.js';
import { igniteGas } from '../building/structures.js';

const MAX = 140;
export const shots = [];
for (let i = 0; i < MAX; i++) shots.push({ on: false, x: 0, y: 0, ox: 0, oy: 0, vx: 0, vy: 0, life: 0, dmg: 0, pierce: 0, src: 0, kind: 0, last: null });
let si = 0;
export function fireShot(x, y, ang, speed, dmg, life, pierce, src, kind) {
  const s = shots[si]; si = (si + 1) % MAX;
  s.on = true; s.x = s.ox = x; s.y = s.oy = y; s.vx = Math.cos(ang) * speed; s.vy = Math.sin(ang) * speed;
  s.life = life; s.dmg = dmg; s.pierce = pierce || 0; s.src = src; s.kind = kind || 0; s.last = null;
}
export function clearShots() { for (const s of shots) s.on = false; }
export function updateShots(dt) {
  for (let i = 0; i < MAX; i++) {
    const s = shots[i]; if (!s.on) continue;
    s.ox = s.x; s.oy = s.y; s.life -= dt;
    if (s.life <= 0) { s.on = false; continue; }
    const dist = Math.hypot(s.vx, s.vy) * dt, steps = Math.ceil(dist / 10), sx = s.vx * dt / steps, sy = s.vy * dt / steps;
    for (let k = 0; k < steps && s.on; k++) {
      s.x += sx; s.y += sy;
      const tx = Math.floor(s.x / T), ty = Math.floor(s.y / T), ob = getObj(tx, ty);
      if (ob === O_TREE || ob === O_ROCK || ob === O_WALL || ob === O_WINDOW) { s.on = false; burst(s.x, s.y, 3, '#ccb', 60, 0.25, 2); break; }
      if (W.structs.size) {
        const st = W.structs.get(key(tx, ty));
        if (st) { if (st.id === 'gas') igniteGas(st); else if (st.id === 'wall_w' || st.id === 'wall_s') { s.on = false; burst(s.x, s.y, 3, '#ccb', 60, 0.25, 2); break; } }
      }
      const n = query(s.x, s.y, 16);
      for (let j = 0; j < n; j++) {
        const z = Q.items[j]; if (z === s.last) continue;
        const dx = z.x - s.x, dy = z.y - s.y;
        if (dx * dx + dy * dy > (z.r + 3) * (z.r + 3)) continue;
        damageZombie(z, s.dmg, s.src, s.vx * 0.12, s.vy * 0.12);
        s.last = z;
        if (s.pierce-- <= 0) { s.on = false; break; }
      }
    }
  }
}
