// Spiel-Orchestrierung: neues Spiel, Update-Reihenfolge der Systeme.
import { G } from '../state.js';
import { CFG } from '../config.js';
import { settings } from './save.js';
import { input, pollInput, clearActions, resetSticks } from './input.js';
import { newPlayer, updatePlayer } from '../entities/player.js';
import { initWorld, updateWorld, findSpawn } from '../world/world.js';
import { view, playerScreen } from '../render/renderer.js';
import { Z, clearZombies, updateZombies } from '../entities/zombies.js';
import { updateShots, clearShots } from '../entities/projectiles.js';
import { updateFx, clearFx } from '../entities/fx.js';
import { updateCombat } from '../systems/combat.js';
import { newInventory, addItem, makeItem, updateDrops } from '../systems/inventory.js';
import { updateHud } from '../ui/hud.js';
import { showGameOver, showInventory, showPause, showMap } from '../ui/menus.js';
import { updateTime, resetTime } from '../world/time.js';
import { updateSurvival } from '../systems/survival.js';
import { interact, rollLoot } from '../systems/interact.js';
import { updateMinimap } from '../ui/minimap.js';
import { LOOT } from '../config.js';
import { dropAt } from '../systems/inventory.js';
import { addHighscore, clearSave } from './save.js';
import { sfx } from '../audio/audio.js';

const ps = { x: 0, y: 0 };

export function newGame(seed) {
  G.seed = seed >>> 0;
  G.dayLen = settings.dayLen;
  G.clock = CFG.START_HOUR / 24 * G.dayLen;
  G.stats = { kills: 0, trapKills: 0, cause: '' };
  G.bp = {}; G.build = null; G.tick = 0;
  initWorld(G.seed); resetTime(); G.env.bloodMoon = false; G.env.weather = 'clear';
  updateTime(0);
  clearZombies(); clearShots(); clearFx(); G.drops.length = 0; G.flashT = 0; G.shake = 0;
  G.inv = newInventory();
  for (const [id, n] of [['knife', 1], ['bandage', 1], ['can', 2], ['water', 1], ['torch', 1]]) addItem(makeItem(id, n));
  G.inv.weapon = 0;
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
  const a = input.act;
  if (a.pause) { showPause(); clearActions(); return; }
  if (a.inv) { showInventory(); clearActions(); return; }
  if (a.light) G.player.flash = !G.player.flash;
  if (a.interact && !G.build) interact();
  G.clock += dt;
  updateTime(dt);
  updateSurvival(dt);
  updatePlayer(dt);
  updateWorld();
  updateCombat(dt);
  updateZombies(dt);
  updateShots(dt);
  updateDrops(dt);
  updateFx(dt);
  if (G.flashT > 0) G.flashT -= dt;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 14);
  updateHud(dt); updateMinimap(dt);
  if (G.player.hp <= 0) die();
  clearActions();
}

export function daysSurvived() { return Math.floor(G.clock / G.dayLen); }
function die() {
  G.mode = 'dead'; G.paused = true; sfx('die');
  const st = G.stats; st.days = daysSurvived();
  const rank = addHighscore({ days: st.days, kills: st.kills, traps: st.trapKills, cause: st.cause, seed: G.seed, date: new Date().toISOString().slice(0, 10) });
  clearSave();
  document.getElementById('hud').classList.add('hidden');
  setTimeout(() => showGameOver(rank), 900);
}

Z.onKill = z => {
  const n = z.def.heavy ? 3 : Math.random() < 0.16 ? 1 : 0;
  for (let i = 0; i < n; i++) { const l = rollLoot(LOOT.zombie, Math.random); dropAt(z.x + Math.random() * 16 - 8, z.y + Math.random() * 16 - 8, makeItem(l[0], l[1])); }
};
document.getElementById('minimap').addEventListener('pointerdown', e => { e.preventDefault(); if (G.mode === 'play' && !G.paused) showMap(); });
