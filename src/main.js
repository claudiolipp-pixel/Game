// Einstiegspunkt.
import { loadSettings } from './core/save.js';
import { initInput } from './core/input.js';
import { startLoop } from './core/loop.js';
import { initSprites, initHeads } from './render/sprites.js';
import { initRenderer, render } from './render/renderer.js';
import { update } from './core/game.js';
import { showMainMenu } from './ui/menus.js';
import { G } from './state.js';

loadSettings();
initSprites(); initHeads();
const canvas = document.getElementById('game');
initRenderer(canvas);
initInput(canvas);
showMainMenu();
startLoop(update, render);
window.__G = G;   // Debug-Zugriff

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => { }));
}
