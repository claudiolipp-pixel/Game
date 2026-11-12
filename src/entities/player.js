// Spielfigur: Bewegung, Ausdauer, Blickrichtung.
import { G } from '../state.js';
import { CFG } from '../config.js';
import { input } from '../core/input.js';
import { moveCircle } from '../world/world.js';
import { sfx } from '../audio/audio.js';
import { blood } from './fx.js';
import { toast } from '../ui/hud.js';

export function newPlayer(x, y) {
  return {
    x, y, ox: x, oy: y, ang: 0, r: CFG.player.r,
    hp: 100, hunger: 100, thirst: 100, temp: 37, stamina: 100, infection: 0,
    moving: false, sprinting: false, sneaking: false, speedMul: 1,
    atkCd: 0, swing: 0, reloadT: 0, hurtT: 0, torchT: 0, flash: true, stepT: 0,
    mounted: null, inside: false, sick: 0, wet: 0,
  };
}

export function updatePlayer(dt) {
  const p = G.player, P = CFG.player;
  p.ox = p.x; p.oy = p.y;
  if (p.hurtT > 0) p.hurtT -= dt;
  p.ang = Math.atan2(input.ay, input.ax);
  const mm = Math.hypot(input.mx, input.my);
  p.moving = mm > 0 && !p.mounted;
  p.sneaking = input.sneak && p.moving;
  p.sprinting = input.sprint && p.moving && p.stamina > 1;
  if (p.sprinting) { p.stamina -= P.staminaDrain * dt; if (p.stamina <= 1) input.sprintToggle = false; }
  else p.stamina = Math.min(100, p.stamina + P.staminaRegen * dt * (p.moving ? 0.6 : 1));
  if (!p.moving) return;
  let sp = p.sprinting ? P.sprint : p.sneaking ? P.sneak : P.walk * Math.max(0.6, mm);
  sp *= p.speedMul;
  const nx = input.mx / mm, ny = input.my / mm;
  moveCircle(p, nx * sp * dt, ny * sp * dt, false);
}

// Schaden am Spieler. z = angreifender Zombie (für Infektion) oder null
export function hurtPlayer(dmg, cause, z) {
  const p = G.player; if (p.hp <= 0) return;
  const armor = p.armor || 0;
  p.hp -= dmg * (1 - armor); p.hurtT = 0.35; G.shake = Math.min(8, G.shake + dmg * 0.3);
  blood(p.x, p.y, 4); sfx('hurt');
  if (z) {
    if (z.frost) p.temp -= 0.35;
    if (p.infection <= 0 && Math.random() < CFG.survival.infectChance * (z.def.infect || 1) * (1 - armor)) { p.infection = 1; toast('Du wurdest gebissen – INFIZIERT! Nur Antibiotika helfen.', true); }
  }
  if (p.hp <= 0) { p.hp = 0; G.stats.cause = cause; }
}
