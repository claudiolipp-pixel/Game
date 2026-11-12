// DOM-Menüs (Overlay): Hauptmenü, Pause, Inventar, Karte, Game Over.
import { G } from '../state.js';
import { CFG, ITEMS } from '../config.js';
import { newGame, setPaused } from '../core/game.js';
import { getHighscores } from '../core/save.js';
import { SPR, iconCanvas } from '../render/sprites.js';
import { weight, maxWeight, maxSlots } from '../systems/inventory.js';
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
