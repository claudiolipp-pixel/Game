// Überleben: Hunger, Durst, Infektion, Übelkeit, Verderb, Gegenstände benutzen.
import { G } from '../state.js';
import { CFG, ITEMS } from '../config.js';
import { weight, maxWeight, maxSlots, addItem, makeItem, give, dropAt } from './inventory.js';
import { getGround, G_SWAMP, T, buildingAt, W } from '../world/world.js';
import { toast } from '../ui/hud.js';
import { sfx } from '../audio/audio.js';

let spoilT = 0;
function drain(amount, cause) { const p = G.player; if (p.hp <= 0) return; p.hp -= amount; if (p.hp <= 0) { p.hp = 0; G.stats.cause = cause; } }
export { drain };

export function spoilSlots(slots, k, mult) {
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]; if (!s || s.f === undefined) continue;
    s.f -= k / ITEMS[s.id].spoil * mult;
    if (s.f <= 0) { s.id = 'rotten'; delete s.f; }
  }
}

export function updateSurvival(dt) {
  const p = G.player, e = G.env, S = CFG.survival, k = dt / G.dayLen;
  const hot = e.weather === 'heat' || (e.season === 1 && e.dark < 0.3);
  p.hunger = Math.max(0, p.hunger - S.hungerPerDay * k * (p.sprinting ? S.sprintHunger : 1) * (p.temp < 36 ? 1.4 : 1));
  p.thirst = Math.max(0, p.thirst - S.thirstPerDay * k * (hot ? S.heatThirst : 1) * (p.sprinting ? 1.4 : 1) * (p.sick > 0 ? 1.8 : 1));
  if (p.hunger <= 0) drain(230 * k, 'Verhungert');
  if (p.thirst <= 0) drain(380 * k, 'Verdurstet');
  if (p.sick > 0) { p.sick -= dt; drain(0.6 * dt, 'An einer Lebensmittelvergiftung gestorben'); }
  if (p.infection > 0) {
    p.infection += S.infectPerDay * k;
    if (p.infection > 55) drain(90 * k, 'Der Infektion erlegen');
    if (p.infection >= 100) drain(999, 'Der Infektion erlegen');
  }
  const tempOk = p.temp > S.coldDmgTemp && p.temp < S.heatDmgTemp;
  if (p.hunger > 35 && p.thirst > 35 && p.infection < 55 && p.sick <= 0 && tempOk && p.hp < 100) p.hp = Math.min(100, p.hp + S.regenPerSec * dt * (p.hunger > 70 ? 1.5 : 1));
  if (p.torchT > 0) { p.torchT -= dt * (e.raining ? 2 : 1); if (p.torchT <= 0) toast('Die Fackel ist erloschen.'); }
  p.lit = e.dark > 0.5 && (p.flash || p.torchT > 0);
  const body = G.inv.body ? ITEMS[G.inv.body] : null;
  p.armor = body ? body.armor : 0; p.warm = body ? body.warm : 0;
  // Bewegungstempo
  const tx = Math.floor(p.x / T), ty = Math.floor(p.y / T);
  p.inside = !!buildingAt(tx, ty);
  p.over = weight() > maxWeight();
  let sm = 1;
  if (p.over) sm *= 0.6;
  if (getGround(tx, ty) === G_SWAMP && !W.frozen) sm *= 0.65;
  if (e.weather === 'blizzard' && !p.inside) sm *= 0.8;
  if (p.hp < 25) sm *= 0.85;
  if (p.slowT > 0) { p.slowT -= dt; sm *= 0.45; }
  p.speedMul = sm;
  // Verderb
  spoilT += dt;
  if (spoilT >= 5) { const kk = spoilT / G.dayLen, m = S.spoil[e.season]; spoilT = 0; spoilSlots(G.inv.slots, kk, m); if (G.onSpoil) G.onSpoil(kk, m); }
}

// Gegenstand in Slot i benutzen. Rückgabe: Text für UI
export function useItem(i) {
  const inv = G.inv, s = inv.slots[i], p = G.player; if (!s) return;
  const it = ITEMS[s.id];
  const dec = () => { s.n--; if (s.n <= 0) { inv.slots[i] = null; if (inv.weapon === i) inv.weapon = -1; } };
  switch (it.t) {
    case 'food': {
      const q = s.f === undefined ? 1 : 0.5 + 0.5 * s.f;
      if (it.food) p.hunger = Math.min(100, p.hunger + it.food * q);
      if (it.water) p.thirst = Math.min(100, p.thirst + it.water);
      if (it.sick && Math.random() < it.sick) { p.sick = 45; toast('Dir wird übel…', true); }
      sfx(it.food ? 'eat' : 'drink'); dec(); if (it.ret) give(it.ret, 1, true); break;
    }
    case 'med':
      if (it.cure) { if (p.infection > 0) toast('Die Infektion klingt ab.'); p.infection = 0; p.sick = 0; }
      if (it.heal) p.hp = Math.min(100, p.hp + it.heal);
      sfx('pickup'); dec(); break;
    case 'melee': case 'gun': inv.weapon = inv.weapon === i ? -1 : i; p.reloadT = 0; sfx('click'); break;
    case 'cloth': { const old = inv.body; inv.body = s.id; inv.slots[i] = old ? makeItem(old, 1) : null; sfx('click'); break; }
    case 'pack': {
      const old = inv.pack, ns = CFG.player.baseSlots + it.slots;
      for (let k = ns; k < inv.slots.length; k++) if (inv.slots[k]) { toast('Erst hintere Slots leeren.', true); return; }
      inv.pack = s.id; inv.slots[i] = old ? makeItem(old, 1) : null; inv.slots.length = ns; for (let k = 0; k < ns; k++) if (inv.slots[k] === undefined) inv.slots[k] = null;
      sfx('click'); break;
    }
    case 'light': p.torchT = it.burn; dec(); sfx('fire'); toast('Fackel entzündet.'); break;
    case 'bp': G.bp[it.bp] = true; dec(); sfx('craft'); toast('Bauplan gelernt: ' + it.n.replace('Bauplan: ', '')); break;
  }
}
export function dropItem(i) {
  const s = G.inv.slots[i]; if (!s) return;
  G.inv.slots[i] = null; if (G.inv.weapon === i) G.inv.weapon = -1;
  dropAt(G.player.x + Math.cos(G.player.ang) * 30, G.player.y + Math.sin(G.player.ang) * 30, s);
}
