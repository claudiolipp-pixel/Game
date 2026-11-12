// HUD (DOM): Statusbalken, Uhr, Waffe, Toasts.
import { G } from '../state.js';
import { CFG, ITEMS } from '../config.js';
import { weaponSlot, weaponDef } from '../systems/combat.js';
import { countItem } from '../systems/inventory.js';
import { findTarget } from '../systems/interact.js';
import { SPR, iconCanvas } from '../render/sprites.js';
import { useItem } from '../systems/survival.js';

const $ = id => document.getElementById(id);
let acc = 0, lastClock = '', lastWeapon = '', lastStatus = '', lastBar = '';
export function toast(msg, warn) {
  const box = $('toasts'); if (!box) return;
  if (box.lastChild && box.lastChild.textContent === msg) return;
  const d = document.createElement('div'); d.textContent = msg; if (warn) d.className = 'warn';
  box.appendChild(d); while (box.children.length > 4) box.removeChild(box.firstChild);
  setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 4000);
}
export function updateHud(dt, force) {
  acc += dt; if (acc < 0.2 && !force) return; acc = 0;
  const p = G.player, e = G.env;
  $('b-hp').style.width = Math.max(0, p.hp) + '%';
  $('b-hunger').style.width = Math.max(0, p.hunger) + '%';
  $('b-thirst').style.width = Math.max(0, p.thirst) + '%';
  $('b-stam').style.width = Math.max(0, p.stamina) + '%';
  const hh = Math.floor(e.hour), mm = Math.floor((e.hour - hh) * 6) * 10;
  const clock = `Tag ${e.day + 1} · ${CFG.seasons[e.season].name}${e.year ? ' (Jahr ' + (e.year + 1) + ')' : ''} · ${hh < 10 ? '0' : ''}${hh}:${mm < 10 ? '0' : ''}${mm} · ${Math.round(e.temp)}°C · ${e.bloodMoon ? 'BLUTMOND' : CFG.weather.names[e.weather]}`;
  if (clock !== lastClock) { $('clock').textContent = lastClock = clock; $('clock').classList.toggle('blood', e.bloodMoon); }
  let st = '';
  if (p.temp < 36) st += (p.temp < CFG.survival.coldDmgTemp ? '❄ ERFRIERUNG ' : '❄ Kalt ') + p.temp.toFixed(1) + '°\n';
  else if (p.temp > 38.3) st += (p.temp > CFG.survival.heatDmgTemp ? '☀ HITZSCHLAG ' : '☀ Heiß ') + p.temp.toFixed(1) + '°\n';
  if (p.infection > 0) st += '☣ Infektion ' + Math.floor(p.infection) + '%\n';
  if (p.sick > 0) st += '🤢 Übelkeit\n';
  if (p.hunger <= 0) st += 'VERHUNGERN\n'; if (p.thirst <= 0) st += 'VERDURSTEN\n';
  if (p.sneaking) st += '… schleichen\n';
  if (p.over) st += '⚖ Überladen\n';
  if (st !== lastStatus) $('status').textContent = lastStatus = st;
  const s = weaponSlot(), w = weaponDef();
  let wt = w.n;
  if (s && w.t === 'gun') wt += w.reload ? ` ${s.m}/${w.mag} (${countItem(w.ammo)})` : ` (${countItem(w.ammo)})`;
  else if (s && s.d !== undefined) wt += ` ${Math.ceil(s.d / w.dur * 100)}%`;
  if (p.reloadT > 0) wt += ' – lädt…';
  if (p.mounted) wt = 'MG-Nest (' + countItem('ammoR') + ')';
  if (wt !== lastWeapon) $('weapon').textContent = lastWeapon = wt;
  // Schnellleiste: die ersten 8 Inventar-Slots, Tippen = benutzen/ausrüsten
  const sl = G.inv.slots; let sig = '' + G.inv.weapon;
  for (let i = 0; i < 8; i++) sig += sl[i] ? '|' + sl[i].id + sl[i].n : '|';
  if (sig !== lastBar) {
    lastBar = sig; const bar = $('hotbar'); bar.textContent = '';
    for (let i = 0; i < 8; i++) {
      const b = document.createElement('button'); b.className = 'slot' + (i === G.inv.weapon ? ' eq' : '');
      if (sl[i]) { b.appendChild(iconCanvas(SPR.item[sl[i].id])); if (sl[i].n > 1) { const sp = document.createElement('span'); sp.textContent = sl[i].n; b.appendChild(sp); } }
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (!G.paused && G.inv.slots[i]) { useItem(i); updateHud(0, true); } });
      bar.appendChild(b);
    }
  }
  $('btn-interact').classList.toggle('on', findTarget() > 0);
  $('btn-sprint').classList.toggle('on', p.sprinting);
  $('btn-light').classList.toggle('on', p.flash);
}
