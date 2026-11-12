// DOM-Menüs (Overlay): Hauptmenü, Pause, Inventar, Karte, Game Over.
import { G } from '../state.js';
import { CFG, ITEMS, RECIPES, BUILD } from '../config.js';
import { newGame, setPaused } from '../core/game.js';
import { getHighscores } from '../core/save.js';
import { SPR, iconCanvas } from '../render/sprites.js';
import { weight, maxWeight, maxSlots, countItem, removeItem, hasCost, payCost, give, addItem, addTo, makeItem } from '../systems/inventory.js';
import { startBuild } from '../building/build.js';
import { ST, removeStruct, skipStructs } from '../building/structures.js';
import { Z } from '../entities/zombies.js';
import { toast } from './hud.js';
import { W } from '../world/world.js';
import { useItem, dropItem } from '../systems/survival.js';
import { paintBigMap } from './minimap.js';
import { sfx } from '../audio/audio.js';

const ov = () => document.getElementById('overlay');
export function closeOverlay() { const o = ov(); o.className = ''; o.innerHTML = ''; if (G.mode === 'play') setPaused(false); }
export function showOverlay(html, cls) { const o = ov(); o.className = 'show ' + (cls || ''); o.innerHTML = html; if (G.mode === 'play') setPaused(true); return o; }
export function overlayOpen() { return ov().classList.contains('show'); }
const X = '<button class="close" id="x-close">✖</button>';
function bindClose(o) { const b = o.querySelector('#x-close'); if (b) b.onclick = () => { sfx('click'); closeOverlay(); }; }

export function showMainMenu() {
  G.mode = 'menu'; G.paused = true;
  document.getElementById('hud').classList.add('hidden');
  const o = showOverlay(`<div class="panel narrow"><h1>LETZTER WINTER</h1><div class="sub">Endloses Zombie-Survival</div>
    <button class="btn pri" id="m-new">Neues Spiel</button></div>`);
  o.querySelector('#m-new').onclick = () => { ov().className = ''; ov().innerHTML = ''; newGame((Math.random() * 2 ** 31) | 0); };
}

export function showPause() {
  const o = showOverlay(`<div class="panel narrow"><h2>Pause</h2>
    <button class="btn pri" id="p-res">Weiter</button>
    <button class="btn" id="p-menu">Hauptmenü</button></div>`);
  o.querySelector('#p-res').onclick = closeOverlay;
  o.querySelector('#p-menu').onclick = showMainMenu;
}

// Slot-Raster (wiederverwendet für Inventar + Kisten)
export function slotGrid(slots, n, sel, onTap, eqIdx) {
  const g = document.createElement('div'); g.className = 'grid';
  for (let i = 0; i < n; i++) {
    const s = slots[i], b = document.createElement('button');
    b.className = 'slot' + (i === sel ? ' sel' : '') + (i === eqIdx ? ' eq' : '');
    if (s) {
      b.appendChild(iconCanvas(SPR.item[s.id]));
      if (s.n > 1) { const sp = document.createElement('span'); sp.textContent = s.n; b.appendChild(sp); }
      const it = ITEMS[s.id], frac = s.f !== undefined ? s.f : (s.d !== undefined ? s.d / (it.dur || it.burn || 1) : -1);
      if (frac >= 0) { const em = document.createElement('em'); em.style.width = Math.max(4, frac * 100) + '%'; em.style.background = frac > 0.5 ? '#4c4' : frac > 0.2 ? '#cc4' : '#c44'; b.appendChild(em); }
    }
    b.onclick = () => onTap(i);
    g.appendChild(b);
  }
  return g;
}
export function itemInfo(s) {
  const it = ITEMS[s.id]; let t = `<b>${it.n}</b>${s.n > 1 ? ' ×' + s.n : ''} <small>(${(it.w * s.n).toFixed(1)} kg)</small><br>`;
  if (it.food) t += `Nahrung +${it.food} `; if (it.water) t += `Wasser +${it.water} `; if (it.sick) t += `<span style="color:#c66">Risiko: Übelkeit</span> `;
  if (s.f !== undefined) t += `<br>Frische ${Math.round(s.f * 100)}%`;
  if (it.heal) t += `Heilt ${it.heal} HP `; if (it.cure) t += 'Heilt Infektion ';
  if (it.t === 'melee') t += `Schaden ${it.dmg} · Haltbarkeit ${Math.ceil(s.d)}/${it.dur}`;
  if (it.t === 'gun') t += `Schaden ${it.dmg}${it.pellets > 1 ? '×' + it.pellets : ''} · ${ITEMS[it.ammo].n}${it.silent ? ' · lautlos' : ' · LAUT'}`;
  if (it.t === 'cloth') t += `Wärme ${it.warm > 0 ? '+' : ''}${it.warm} · Rüstung ${Math.round(it.armor * 100)}%`;
  if (it.t === 'pack') t += `+${it.slots} Slots · +${it.carry} kg`;
  if (it.t === 'bp') t += 'Benutzen, um den Bauplan zu lernen.';
  if (it.t === 'light') t += 'Licht + Wärme, entzündet Benzinpfützen.';
  return t;
}
const USE = { food: 'Essen/Trinken', med: 'Benutzen', melee: 'Ausrüsten', gun: 'Ausrüsten', cloth: 'Anziehen', pack: 'Anlegen', light: 'Anzünden', bp: 'Lernen' };

let invSel = -1;
export function showInventory() {
  const inv = G.inv, p = G.player;
  const o = showOverlay(`<div class="panel">${X}<h2>Inventar</h2><div class="cols"><div id="inv-grid"></div><div>
    <div class="detail" id="inv-detail"></div>
    <p>Gewicht: <b style="color:${p.over ? '#c66' : '#cfc'}">${weight().toFixed(1)} / ${maxWeight()} kg</b><br>
    Kleidung: <b>${inv.body ? ITEMS[inv.body].n : '–'}</b><br>Rucksack: <b>${inv.pack ? ITEMS[inv.pack].n : '–'}</b><br>
    Baupläne: <b>${Object.keys(G.bp).length}/6</b></p></div></div></div>`);
  bindClose(o);
  o.querySelector('#inv-grid').appendChild(slotGrid(inv.slots, maxSlots(), invSel, i => { invSel = i; sfx('click'); showInventory(); }, inv.weapon));
  const det = o.querySelector('#inv-detail'), s = inv.slots[invSel];
  if (!s) { det.innerHTML = '<small>Gegenstand antippen.</small>'; return; }
  const it = ITEMS[s.id];
  det.innerHTML = itemInfo(s) + '<br>' + (USE[it.t] ? `<button class="btn pri" id="i-use">${inv.weapon === invSel ? 'Ablegen' : USE[it.t]}</button>` : '') + '<button class="btn" id="i-drop">Wegwerfen</button>';
  const u = det.querySelector('#i-use'); if (u) u.onclick = () => { useItem(invSel); showInventory(); };
  det.querySelector('#i-drop').onclick = () => { dropItem(invSel); showInventory(); };
}

export function showMap() {
  const o = showOverlay(`<div class="panel" style="width:auto">${X}<h2>Karte</h2><canvas id="bigmap" width="240" height="240"></canvas>
    <p>Weiß: du · <span style="color:#ffb040">Basis</span> · <span style="color:#ff4040">Fallen</span> · <span style="color:#40e0ff">Türme</span> · Bett = großer weißer Punkt</p></div>`);
  bindClose(o); paintBigMap(o.querySelector('#bigmap'));
}

export function showGameOver(rank) {
  const st = G.stats;
  const o = showOverlay(`<div class="panel narrow"><h1 style="color:#c33">TOT</h1><div class="sub">${st.cause || 'Gestorben'}</div>
    <div class="stat"><span>Überlebte Tage</span><b>${st.days}</b></div>
    <div class="stat"><span>Getötete Zombies</span><b>${st.kills}</b></div>
    <div class="stat"><span>… davon durch Fallen/Türme</span><b>${st.trapKills}</b></div>
    <div class="stat"><span>Highscore-Platz</span><b>${rank >= 0 ? '#' + (rank + 1) : '–'}</b></div>
    <button class="btn pri" id="go-menu">Hauptmenü</button></div>`);
  o.querySelector('#go-menu').onclick = () => showMainMenu();
}

// ---------- Crafting / Bauen ----------
function costHtml(cost) { return Object.keys(cost).map(k => { const have = countItem(k); return `<small class="${have >= cost[k] ? 'ok' : 'no'}">${ITEMS[k].n} ${have}/${cost[k]}</small>`; }).join(' · '); }
let craftTab = 'items';
export function showCraft(tab) {
  if (tab) craftTab = tab;
  const tabs = [['items', 'Gegenstände'], ['base', 'Basis'], ['trap', 'Fallen'], ['gun', 'Geschütze']];
  const o = showOverlay(`<div class="panel">${X}<h2>Herstellen &amp; Bauen</h2><div class="tabs">${tabs.map(t => `<button data-tab="${t[0]}" class="${t[0] === craftTab ? 'on' : ''}">${t[1]}</button>`).join('')}</div><div class="recipes" id="recs"></div></div>`);
  bindClose(o);
  o.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { sfx('click'); showCraft(b.dataset.tab); });
  const box = o.querySelector('#recs');
  if (craftTab === 'items') {
    for (const r of RECIPES) {
      const can = hasCost(r.cost), b = document.createElement('button'); b.className = 'rec' + (can ? ' can' : '');
      b.appendChild(iconCanvas(SPR.item[r.out]));
      const d = document.createElement('div'); d.innerHTML = `<b>${ITEMS[r.out].n}${r.n > 1 ? ' ×' + r.n : ''}</b>${costHtml(r.cost)}`; b.appendChild(d);
      b.onclick = () => { if (!hasCost(r.cost)) { sfx('deny'); return; } payCost(r.cost); give(r.out, r.n, true); sfx('craft'); showCraft(); };
      box.appendChild(b);
    }
  } else {
    for (const id in BUILD) {
      const def = BUILD[id]; if (def.cat !== craftTab) continue;
      const locked = def.bp && !G.bp[def.bp], can = !locked && hasCost(def.cost), b = document.createElement('button');
      b.className = 'rec' + (can ? ' can' : '') + (locked ? ' locked' : '');
      b.appendChild(iconCanvas(SPR.build[id]));
      const d = document.createElement('div'); d.innerHTML = `<b>${def.n}</b>${locked ? '<small class="no">🔒 Bauplan fehlt</small>' : costHtml(def.cost)}<br><small>${def.d}</small>`; b.appendChild(d);
      b.onclick = () => { if (locked || !hasCost(def.cost)) { sfx('deny'); return; } closeOverlay(); startBuild(id); };
      box.appendChild(b);
    }
  }
}

// ---------- Bauwerk-Panel ----------
function repairCost(s) { const main = s.def.cost.scrap && !s.def.cost.wood ? 'scrap' : s.def.cost.stone && !s.def.cost.wood ? 'stone' : s.def.cost.wood ? 'wood' : 'scrap'; return { item: main, n: Math.max(1, Math.ceil((s.maxHp - s.hp) / CFG.build.repairPerScrap)) }; }
export const structActions = {};   // id → (s, add) => void, von turrets.js erweitert
export function showStruct(s) {
  if (s.dead) { closeOverlay(); return; }
  const d = s.def, p = G.player;
  const o = showOverlay(`<div class="panel narrow">${X}<h2>${d.n} <small style="color:#8a8f98">Stufe ${s.lvl}/3</small></h2>
    <p>${d.d}<br>Zustand: <b>${Math.ceil(s.hp)} / ${Math.ceil(s.maxHp)}</b>${d.ammo && d.cap ? `<br>${ITEMS[d.ammo].n}: <b>${Math.floor(s.ammo)} / ${d.cap}</b>` : ''}<span id="s-extra"></span></p><div id="s-btns"></div></div>`);
  bindClose(o);
  const box = o.querySelector('#s-btns');
  const add = (label, fn, dis, pri) => { const b = document.createElement('button'); b.className = 'btn' + (pri ? ' pri' : ''); b.innerHTML = label; if (dis) b.disabled = true; b.onclick = () => { fn(); }; box.appendChild(b); return b; };
  const re = () => showStruct(s);
  // spezifisch
  if (s.id === 'chest') add('Kiste öffnen', () => showChest(s), false, true);
  if (s.id === 'bed') add('Schlafen (bis zum Morgen)', () => sleep(), false, true);
  if (s.id === 'campfire') {
    const raw = countItem('rawmeat'), dw = countItem('dwater'), bt = countItem('bottle');
    add(`Kochen (${raw} Fleisch, ${dw} Wasser)`, () => { if (raw) { removeItem('rawmeat', raw); give('meat', raw, true); } if (dw) { removeItem('dwater', dw); give('water', dw, true); } sfx('fire'); toast('Gekocht.'); re(); }, !raw && !dw, true);
    if (W.season === 3) add(`Schnee schmelzen (${bt} Flaschen)`, () => { removeItem('bottle', bt); give('water', bt, true); sfx('drink'); re(); }, !bt);
  }
  if (s.id === 'collector') {
    o.querySelector('#s-extra').innerHTML = `<br>Wasser: <b>${Math.floor(s.water)} / ${d.cap * s.lvl}</b>`;
    add('Wasser abfüllen (braucht Flaschen)', () => { const n = Math.min(Math.floor(s.water), countItem('bottle')); removeItem('bottle', n); give('water', n, true); s.water -= n; sfx('drink'); re(); }, s.water < 1 || !countItem('bottle'), true);
    add('Direkt trinken', () => { s.water -= 1; p.thirst = Math.min(100, p.thirst + 45); sfx('drink'); re(); }, s.water < 1);
  }
  if (s.id === 'plot') {
    o.querySelector('#s-extra').innerHTML = `<br>${s.planted ? 'Wachstum: <b>' + Math.floor(s.grow * 100) + '%</b>' + (G.env.season >= 2 && s.grow < 1 ? ' (wächst nur im Frühling/Sommer)' : '') : 'Leer'}`;
    if (s.planted) add('Ernten', () => { give('veg', 2 + ((Math.random() * 2) | 0) + (s.lvl - 1)); give('seeds', 1); s.planted = false; s.grow = 0; sfx('pickup'); re(); }, s.grow < 1, true);
    else add('Bepflanzen (1 Saatgut)', () => { removeItem('seeds', 1); s.planted = true; s.grow = 0; sfx('build'); re(); }, !countItem('seeds') || G.env.season >= 2, true);
  }
  if (s.id === 'beartrap') add('Neu spannen', () => { s.shut = false; sfx('snap'); re(); }, !s.shut, true);
  if (s.id === 'lure') add(s.on ? 'Ausschalten' : 'Einschalten', () => { s.on = !s.on; s.t = d.dur * s.lvl; s.cd = 0; sfx('click'); closeOverlay(); }, false, true);
  if (s.id === 'gas') add('Anzünden (brennende Fackel nötig)', () => { closeOverlay(); import('../building/structures.js').then(m => m.igniteGas(s)); }, !(p.torchT > 0), true);
  if (structActions[s.id]) structActions[s.id](s, add, re, o);
  if (d.ammo && d.cap) { const have = countItem(d.ammo), need = Math.ceil(d.cap - s.ammo); add(`${ITEMS[d.ammo].n} nachfüllen (${Math.min(have, need)})`, () => { const n = Math.min(countItem(d.ammo), Math.ceil(d.cap - s.ammo)); removeItem(d.ammo, n); s.ammo += n; sfx('reload'); re(); }, !have || need <= 0); }
  // allgemein
  if (s.hp < s.maxHp - 1) { const rc = repairCost(s); add(`Reparieren (${rc.n} ${ITEMS[rc.item].n})`, () => { removeItem(rc.item, rc.n); s.hp = s.maxHp; sfx('build'); re(); }, countItem(rc.item) < rc.n); }
  if (s.lvl < 3) { const uc = CFG.build.upgCost[s.lvl]; add(`Aufwerten → Stufe ${s.lvl + 1} <small>(${Object.keys(uc).map(k => uc[k] + ' ' + ITEMS[k].n).join(', ')})</small>`, () => { payCost(uc); s.lvl++; s.maxHp = d.hp * CFG.build.upgHp[s.lvl - 1]; s.hp = s.maxHp; sfx('craft'); re(); }, !hasCost(uc)); }
  add('Abbauen (50 % Material zurück)', () => { if (s.inv) for (const it of s.inv) if (it) { const r = addItem(it); if (r > 0) { it.n = r; import('../systems/inventory.js').then(m => m.dropAt(s.x, s.y, it)); } } for (const k in d.cost) { const n = Math.floor(d.cost[k] / 2); if (n) give(k, n, true); } removeStruct(s); sfx('snap'); closeOverlay(); });
}
G.onStruct = s => showStruct(s);

let chSel = -1, chSide = 0;
function showChest(s) {
  const inv = G.inv;
  const o = showOverlay(`<div class="panel">${X}<h2>Kiste</h2><div class="cols"><div><p>Kiste (antippen = nehmen)</p><div id="c-a"></div></div><div><p>Inventar (antippen = einlagern) · ${weight().toFixed(1)}/${maxWeight()} kg</p><div id="c-b"></div></div></div></div>`);
  bindClose(o);
  o.querySelector('#c-a').appendChild(slotGrid(s.inv, s.inv.length, -1, i => { const it = s.inv[i]; if (!it) return; const r = addItem(it); if (r <= 0) s.inv[i] = null; else it.n = r; sfx('click'); showChest(s); }));
  o.querySelector('#c-b').appendChild(slotGrid(inv.slots, maxSlots(), -1, i => { const it = inv.slots[i]; if (!it) return; const r = addTo(s.inv, s.inv.length, it); if (r <= 0) { inv.slots[i] = null; if (inv.weapon === i) inv.weapon = -1; } else it.n = r; sfx('click'); showChest(s); }, inv.weapon));
}

function sleep() {
  const p = G.player, e = G.env;
  for (const z of Z.list) if (z.alive && !z.def.animal && Math.hypot(z.x - p.x, z.y - p.y) < 420) { toast('Zombies in der Nähe – du kannst nicht schlafen!', true); sfx('deny'); closeOverlay(); return; }
  if (e.bloodMoon || G.alarmT > 0) { toast('Zu gefährlich zum Schlafen.', true); closeOverlay(); return; }
  if (e.dark < 0.5 && e.hour > 6 && e.hour < 17) { toast('Du bist noch nicht müde (erst abends).'); closeOverlay(); return; }
  const S = CFG.seasons[e.season]; let h = S.sunrise + 0.9 - e.hour; if (h <= 0) h += 24;
  const sec = h / 24 * G.dayLen, k = sec / G.dayLen;
  G.clock += sec; p.hunger = Math.max(5, p.hunger - CFG.survival.hungerPerDay * k * 0.5); p.thirst = Math.max(5, p.thirst - CFG.survival.thirstPerDay * k * 0.5);
  p.hp = Math.min(100, p.hp + 35); p.stamina = 100; if (p.infection > 0) p.infection += CFG.survival.infectPerDay * k;
  skipStructs(sec); G.wT = 0; G.wantSave = true;
  closeOverlay(); toast(`Du hast ${Math.round(h)} Stunden geschlafen. Spiel gespeichert.`);
}
