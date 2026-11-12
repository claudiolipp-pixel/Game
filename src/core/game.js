// Spiel-Orchestrierung: neues Spiel, Update-Reihenfolge der Systeme.
import { G } from '../state.js';
import { CFG } from '../config.js';
import { settings } from './save.js';
import { input, pollInput, clearActions, resetSticks } from './input.js';
import { newPlayer, updatePlayer } from '../entities/player.js';
import { initWorld, updateWorld, findSpawn } from '../world/world.js';
import { view, playerScreen } from '../render/renderer.js';

const ps = { x: 0, y: 0 };

export function newGame(seed) {
  G.seed = seed >>> 0;
  G.dayLen = settings.dayLen;
  G.clock = CFG.START_HOUR / 24 * G.dayLen;
  G.stats = { kills: 0, trapKills: 0, cause: '' };
  G.bp = {}; G.build = null; G.tick = 0;
  initWorld(G.seed);
  const sp = findSpawn();
  G.player = newPlayer(sp.x, sp.y);
  view.camX = G.player.x; view.camY = G.player.y;
  G.mode = 'play'; setPaused(false);
}

export function setPaused(v) {
  G.paused = v; resetSticks();
  document.getElementById('hud').classList.toggle('hidden', G.mode !== 'play');
}

export function update(dt) {
  if (G.mode !== 'play' || G.paused) { clearActions(); return; }
  G.tick++;
  playerScreen(ps);
  pollInput(ps.x, ps.y);
  G.clock += dt;
  updatePlayer(dt);
  updateWorld();
  clearActions();
}
