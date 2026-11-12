// DOM-Menüs (Overlay).
import { G } from '../state.js';
import { newGame } from '../core/game.js';
import { getHighscores } from '../core/save.js';

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
