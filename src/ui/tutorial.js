// Kurzes, überspringbares Tutorial am ersten Tag.
import { G } from '../state.js';
import { input } from '../core/input.js';
import { settings, saveSettings } from '../core/save.js';

let el = null, step = -1, sx = 0, sy = 0, t = 0;
const STEPS = [
  { touch: 'Linker Stick: bewegen. Nur leicht auslenken = schleichen (leise). 🏃 schaltet Sprinten um.', key: 'WASD: bewegen · Shift: sprinten · C: schleichen.', done: () => Math.hypot(G.player.x - sx, G.player.y - sy) > 120 },
  { touch: 'Rechter Stick: zielen – weit auslenken = zuschlagen/schießen. ⚔ wechselt die Waffe.', key: 'Maus: zielen, Klick: angreifen · Q: Waffe wechseln · R: nachladen.', done: () => G.player.swing > 0 },
  { touch: 'Schlag auf Bäume und Steine für Holz und Stein. ✋ plündert Kisten in Gebäuden, pflückt Beeren und schöpft Wasser (abkochen!).', key: 'Schlag auf Bäume/Steine für Material. E: Kisten plündern, Beeren, Wasser (abkochen!).', done: () => t > 14 },
  { touch: '🔨 öffnet Herstellen & Bauen, 🎒 das Inventar. Bau vor der Nacht ein Lagerfeuer – und später Wände, Fallen, ein Bett.', key: 'B: Herstellen & Bauen · I: Inventar · F: Taschenlampe. Bau vor der Nacht ein Lagerfeuer!', done: () => t > 14 },
  { touch: 'Lärm lockt Zombies an. Achte auf Hunger, Durst und Temperatur. Alle 10 Tage: Blutmond. Viel Glück!', key: 'Lärm lockt Zombies an. Achte auf Hunger, Durst, Temperatur. Alle 10 Tage: Blutmond. Viel Glück!', done: () => t > 10 },
];
function show() {
  if (!el) { el = document.createElement('div'); el.className = 'tut'; document.body.appendChild(el); }
  const s = STEPS[step];
  el.innerHTML = `<div>${input.touch ? s.touch : s.key}</div><button id="t-next">Weiter</button><button id="t-skip">Tutorial überspringen</button>`;
  el.querySelector('#t-next').onclick = next;
  el.querySelector('#t-skip').onclick = () => { settings.tutorial = false; saveSettings(); endTutorial(); };
  el.classList.remove('hidden');
}
function next() { step++; t = 0; if (step >= STEPS.length) { settings.tutorial = false; saveSettings(); endTutorial(); } else show(); }
export function startTutorial() { if (!settings.tutorial) return; step = 0; t = 0; sx = G.player.x; sy = G.player.y; show(); }
export function endTutorial() { step = -1; if (el) el.classList.add('hidden'); }
export function updateTutorial(dt) { if (step < 0) return; t += dt; if (STEPS[step].done()) next(); }
