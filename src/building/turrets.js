// Stationäre Waffen: Armbrust-Turm, Selbstschuss-Anlage, Flammenwerfer, MG-Nest, Generator + Stromzaun.
import { G } from '../state.js';
import { CFG } from '../config.js';
import { input } from '../core/input.js';
import { ST, dmgMul } from './structures.js';
import { structActions } from '../ui/menus.js';
import { query, Q } from '../systems/spatial.js';
import { losClear } from '../world/world.js';
import { damageZombie } from '../entities/zombies.js';
import { fireShot } from '../entities/projectiles.js';
import { emitNoise } from '../systems/noise.js';
import { sfx } from '../audio/audio.js';
import { particle, burst } from '../entities/fx.js';
import { addLight } from '../render/lighting.js';
import { toast } from '../ui/hud.js';
import { removeItem, countItem } from '../systems/inventory.js';

// Zielsuche nur alle 200 ms über den Spatial Hash
function scan(s, dt, range) {
  s.scan -= dt; if (s.scan > 0) return s.tgt && s.tgt.alive ? s.tgt : (s.tgt = null);
  s.scan = CFG.build.turretScan;
  const n = query(s.x, s.y, range); let best = null, bd = 1e9;
  for (let i = 0; i < n; i++) {
    const z = Q.items[i]; if (z.def.animal) continue;
    const d = (z.x - s.x) * (z.x - s.x) + (z.y - s.y) * (z.y - s.y);
    if (d < bd && losClear(s.x, s.y, z.x, z.y)) { bd = d; best = z; }
  }
  return s.tgt = best;
}

ST.beh.xbow = (s, dt) => {
  const d = s.def, z = scan(s, dt, d.range * (1 + (s.lvl - 1) * 0.12));
  if (!z) return;
  s.ang = Math.atan2(z.y - s.y, z.x - s.x);
  if (s.cd > 0 || s.ammo < 1) return;
  s.ammo--; s.cd = d.reload / (1 + (s.lvl - 1) * 0.2);
  fireShot(s.x, s.y, s.ang, 520, d.dmg * dmgMul(s), 0.6, 0, 1, 1); sfx('bow', 0.6, s.x, s.y);
};

ST.beh.sgtrap = (s, dt) => {
  const d = s.def; s.ang = s.rot * Math.PI / 2;
  if (s.cd > 0 || s.ammo < 1) return;
  s.scan -= dt; if (s.scan > 0) return; s.scan = CFG.build.turretScan;
  const n = query(s.x, s.y, d.range); let trig = false;
  for (let i = 0; i < n; i++) {
    const z = Q.items[i]; if (z.def.animal) continue;
    let da = Math.atan2(z.y - s.y, z.x - s.x) - s.ang; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
    if (Math.abs(da) < 0.45 && losClear(s.x, s.y, z.x, z.y)) { trig = true; break; }
  }
  if (!trig) return;
  s.ammo--; s.cd = d.reload;
  for (let i = 0; i < d.pellets; i++) fireShot(s.x + Math.cos(s.ang) * 14, s.y + Math.sin(s.ang) * 14, s.ang + (Math.random() - 0.5) * 0.5, 520, d.dmg * dmgMul(s), 0.35, 1, 1, 0);
  sfx('shotgun', 1, s.x, s.y); emitNoise(s.x, s.y, d.noise); addLight(s.x, s.y, 120, 1);
  particle(s.x + Math.cos(s.ang) * 16, s.y + Math.sin(s.ang) * 16, 0, 0, 0.06, '#ffe9a0', 7, 0);
};

ST.beh.flamer = (s, dt) => {
  const d = s.def, range = d.range * (1 + (s.lvl - 1) * 0.1), z = scan(s, dt, range);
  if (!z || s.ammo <= 0) return;
  s.ang = Math.atan2(z.y - s.y, z.x - s.x);
  s.ammo = Math.max(0, s.ammo - dt / d.use);
  const rainF = G.env.raining ? 0.6 : 1, winter = G.env.season === 3;
  const n = query(s.x, s.y, range);
  for (let i = 0; i < n; i++) {
    const t = Q.items[i]; let da = Math.atan2(t.y - s.y, t.x - s.x) - s.ang; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
    if (Math.abs(da) > 0.42) continue;
    damageZombie(t, d.dps * dt * dmgMul(s) * rainF * (t.frost ? 2.2 : 1) * (winter && t.frost ? 1.2 : 1), 1, 0, 0); t.burnT = 3;
  }
  for (let k = 0; k < 2; k++) { const a = s.ang + (Math.random() - 0.5) * 0.7, sp = 150 + Math.random() * 90; particle(s.x + Math.cos(a) * 14, s.y + Math.sin(a) * 14, Math.cos(a) * sp, Math.sin(a) * sp, 0.55, Math.random() < 0.5 ? '#f80' : '#fc3', 5, 1); }
  addLight(s.x + Math.cos(s.ang) * 50, s.y + Math.sin(s.ang) * 50, 130, 0.9);
  sfx('fire', 0.7, s.x, s.y, 0.25);
};

ST.beh.mg = (s, dt) => {
  const p = G.player; if (p.mounted !== s) return;
  if (input.act.interact || input.act.cancel) { p.mounted = null; toast('MG-Nest verlassen.'); return; }
  s.ang = p.ang;
  if (!input.fire || s.cd > 0) return;
  if (!removeItem('ammoR', 1)) { s.cd = 0.4; sfx('empty'); toast('Keine Gewehrmunition!', true); return; }
  s.cd = s.def.cd;
  fireShot(s.x + Math.cos(p.ang) * 16, s.y + Math.sin(p.ang) * 16, p.ang + (Math.random() - 0.5) * 0.09, 820, s.def.dmg * dmgMul(s), 0.7, 1, 0, 0);
  sfx('mg'); G.flashT = 0.05; G.shake = Math.min(5, G.shake + 1.2); emitNoise(s.x, s.y, 700);
};

ST.beh.gen = (s, dt) => {
  if (!s.on) return;
  s.ammo -= dt * (480 / G.dayLen) / s.def.use * (1 - (s.lvl - 1) * 0.2);
  if (s.ammo <= 0) { s.ammo = 0; s.on = false; toast('Generator: Tank leer!', true); return; }
  if (s.cd <= 0) { s.cd = 2.2; emitNoise(s.x, s.y, CFG.noise.generator); sfx('gen', 1, s.x, s.y); particle(s.x + 8, s.y - 8, 6, -20, 0.8, '#666', 3, 0); }
};

ST.beh.fence = (s, dt) => {
  s.scan -= dt; if (s.scan > 0) return; s.scan = 0.5;
  const R = CFG.build.powerRange; s.pow = false;
  for (let i = 0; i < ST.turrets.length; i++) { const g = ST.turrets[i]; if (g.id === 'gen' && g.on && Math.abs(g.tx - s.tx) <= R && Math.abs(g.ty - s.ty) <= R) { s.pow = true; break; } }
  if (!s.pow) return;
  const n = query(s.x, s.y, 26);
  for (let i = 0; i < n; i++) { const z = Q.items[i]; damageZombie(z, s.def.zap * dmgMul(s), 1, (z.x - s.x) * 4, (z.y - s.y) * 4); z.stunT = 0.4; }
  if (n) { sfx('zap', 0.8, s.x, s.y); burst(s.x, s.y, 5, '#bdf', 120, 0.25, 2); addLight(s.x, s.y, 70, 0.8); }
};
ST.onHit.fence = (s, z) => { if (s.pow) { damageZombie(z, 34 * dmgMul(s), 1, (z.x - s.x) * 6, (z.y - s.y) * 6); z.stunT = 0.7; sfx('zap', 0.8, s.x, s.y); burst(z.x, z.y, 5, '#bdf', 120, 0.25, 2); } };

// Panel-Aktionen
structActions.mg = (s, add) => add('Bemannen', () => {
  const p = G.player; p.mounted = s; G.inv.weaponBeforeMg = G.inv.weapon;
  import('../ui/menus.js').then(m => m.closeOverlay()); toast('MG bemannt: Ziel-Stick feuert, ✋ verlässt das Nest. Munition: ' + countItem('ammoR'));
}, false, true);
structActions.gen = (s, add, re) => add(s.on ? 'Ausschalten' : 'Starten', () => {
  if (s.on) { s.on = false; re(); return; }
  if (s.ammo <= 0) { toast('Kein Benzin im Tank.', true); sfx('deny'); return; }
  const cold = G.env.temp < 0 ? 0.55 : G.env.temp < 6 ? 0.25 : 0;
  sfx('gen');
  if (Math.random() < cold) { toast('Kälte: Der Generator springt nicht an. Nochmal versuchen!', true); emitNoise(s.x, s.y, 200); }
  else { s.on = true; s.cd = 0; toast('Generator läuft – und macht Lärm.'); }
  re();
}, false, true);
structActions.fence = (s, add, re, o) => { o.querySelector('#s-extra').innerHTML = '<br>Strom: <b>' + (s.pow ? 'JA' : 'NEIN – Generator in der Nähe starten') + '</b>'; };
