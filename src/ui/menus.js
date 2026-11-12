// DOM-Menüs (Overlay).
import { G } from '../state.js';
import { newGame } from '../core/game.js';

const ov = () => document.getElementById('overlay');
export function closeOverlay() { const o = ov(); o.className = ''; o.innerHTML = ''; }
export function showOverlay(html, cls) { const o = ov(); o.className = 'show ' + (cls || ''); o.innerHTML = html; return o; }

export function showMainMenu() {
  G.mode = 'menu'; G.paused = true;
  document.getElementById('hud').classList.add('hidden');
  const o = showOverlay(`<div class="panel narrow"><h1>LETZTER WINTER</h1><div class="sub">Endloses Zombie-Survival</div>
    <button class="btn pri" id="m-new">Neues Spiel</button></div>`);
  o.querySelector('#m-new').onclick = () => { closeOverlay(); newGame((Math.random() * 2 ** 31) | 0); };
}
