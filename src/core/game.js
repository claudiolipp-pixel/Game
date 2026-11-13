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
import { updateHud, toast } from '../ui/hud.js';
import { showGameOver, showInventory, showPause, showMap, showCraft } from '../ui/menus.js';
import { updateStructs, clearStructs } from '../building/structures.js';
import { updateBuild, stopBuild } from '../building/build.js';
import { updateTime, resetTime } from '../world/time.js';
import { updateSurvival } from '../systems/survival.js';
import { interact, rollLoot } from '../systems/interact.js';
import { updateMinimap } from '../ui/minimap.js';
import { LOOT } from '../config.js';
import { query, Q } from '../systems/spatial.js';
import { updateWeather, resetWeather } from '../world/weather.js';
import { addTrack, clearTracks } from '../render/weatherfx.js';
import { dropAt } from '../systems/inventory.js';
import { addHighscore, clearSave, writeSave, readSave } from './save.js';
import { startTutorial, endTutorial, updateTutorial } from '../ui/tutorial.js';
import { W } from '../world/world.js';
import { serializeStructs, placeStruct } from '../building/structures.js';
import { sfx, suspendAudio } from '../audio/audio.js';

const ps = { x: 0, y: 0 };
let saveT = 0;

export function newGame(seed, sv) {
  G.seed = (sv ? sv.seed : seed) >>> 0;
  G.dayLen = sv ? sv.dayLen : settings.dayLen;
  G.clock = sv ? sv.clock : CFG.START_HOUR / 24 * G.dayLen;
  G.stats = sv ? sv.stats : { kills: 0, trapKills: 0, cause: '' };
  G.bp = sv ? sv.bp : {}; G.build = null; G.tick = 0; saveT = 0; G.wantSave = false;
  initWorld(G.seed, sv ? sv.mods : null); clearStructs(); stopBuild(); G.alarmT = 0; resetTime(); G.env.bloodMoon = false; resetWeather(); clearTracks();
  updateTime(0);
  clearZombies(); clearShots(); clearFx(); G.drops.length = 0; G.flashT = 0; G.shake = 0;
  G.inv = newInventory();
  if (!sv) for (const [id, n] of [['knife', 1], ['bandage', 1], ['can', 2], ['water', 1], ['torch', 1]]) addItem(makeItem(id, n));
  if (!sv) G.inv.weapon = 0;
  const sp = sv ? sv.player : findSpawn();
  G.player = newPlayer(sp.x, sp.y);
  if (sv) {
    Object.assign(G.player, sv.player); G.player.ox = G.player.x; G.player.oy = G.player.y;
    G.inv = sv.inv; for (const d of sv.drops) G.drops.push(d);
    for (const st of sv.structs) placeStruct(st.id, st.tx, st.ty, st.rot, st);
    G.env.weather = sv.weather; G.wT = sv.wT; updateWorld();
  }
  view.camX = G.player.x; view.camY = G.player.y;
  G.mode = 'play'; setPaused(false);
  endTutorial(); if (!sv) startTutorial();
  if (!sv && W.village) {
    let dx = W.village.x - G.player.x, dy = W.village.y - G.player.y;
    const names = G.cam ? ['rechts', 'unten rechts', 'unten', 'unten links', 'links', 'oben links', 'oben', 'oben rechts'] : ['im Osten', 'im Südosten', 'im Süden', 'im Südwesten', 'im Westen', 'im Nordwesten', 'im Norden', 'im Nordosten'];
    if (G.cam) { const c = Math.cos(G.cam.yaw), s = Math.sin(G.cam.yaw), t = c * dx - s * dy; dy = s * dx + c * dy; dx = t; }
    const dir = names[((Math.round(Math.atan2(dy, dx) / Math.PI * 4) % 8) + 8) % 8];
    toast('Ein kleines Dorf liegt ganz in der Nähe – Richtung ' + dir + '. Häuser betreten und Kisten mit ✋ plündern.');
  }
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
  // Angriffs-Button ohne Ziel-Stick: automatisch auf den nächsten Zombie zielen
  if (input.atkHeld && !input.R.on) {
    const p = G.player, n = query(p.x, p.y, 230); let bd = 1e9, bz = null;
    for (let i = 0; i < n; i++) { const z = Q.items[i]; if (z.def.animal && n > 1) continue; const d = (z.x - p.x) * (z.x - p.x) + (z.y - p.y) * (z.y - p.y); if (d < bd) { bd = d; bz = z; } }
    if (bz) { const d = Math.sqrt(bd) || 1; input.ax = (bz.x - p.x) / d; input.ay = (bz.y - p.y) / d; }
  }
  const a = input.act;
  if (a.pause) { showPause(); clearActions(); return; }
  if (a.inv) { showInventory(); clearActions(); return; }
  if (a.build && !G.build) { showCraft(); clearActions(); return; }
  if (a.light) G.player.flash = !G.player.flash;
  if (G.build) updateBuild(); else if (a.interact && !G.player.mounted) interact();
  G.clock += dt;
  updateTime(dt);
  updateSurvival(dt);
  updateWeather(dt);
  if (G.env.season === 3 && G.player.moving && !G.player.inside) addTrack(G.player.x, G.player.y);
  updatePlayer(dt);
  updateWorld();
  updateCombat(dt);
  updateZombies(dt);
  updateStructs(dt);
  updateShots(dt);
  updateDrops(dt);
  updateFx(dt);
  if (G.flashT > 0) G.flashT -= dt;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 14);
  updateHud(dt); updateMinimap(dt); updateTutorial(dt);
  saveT += dt; if (saveT >= CFG.AUTOSAVE || G.wantSave) saveGame();
  if (G.player.hp <= 0) die();
  clearActions();
}

export function daysSurvived() { return Math.floor(G.clock / G.dayLen); }
export function saveGame() {
  if (G.mode !== 'play' || !G.player || G.player.hp <= 0) return false;
  saveT = 0; G.wantSave = false;
  const p = G.player;
  return writeSave({ v: 1, seed: G.seed, clock: G.clock, dayLen: G.dayLen, stats: G.stats, bp: G.bp, mods: W.mods,
    player: { x: p.x, y: p.y, hp: p.hp, hunger: p.hunger, thirst: p.thirst, temp: p.temp, stamina: p.stamina, infection: p.infection, sick: p.sick, torchT: p.torchT, flash: p.flash },
    inv: G.inv, drops: G.drops, structs: serializeStructs(), weather: G.env.weather, wT: G.wT });
}
export function loadGame() { const sv = readSave(); if (!sv || sv.v !== 1) return false; newGame(0, sv); return true; }
function die() {
  endTutorial();
  G.mode = 'dead'; G.paused = true; sfx('die');
  const st = G.stats; st.days = daysSurvived();
  const rank = addHighscore({ days: st.days, kills: st.kills, traps: st.trapKills, cause: st.cause, seed: G.seed, date: new Date().toISOString().slice(0, 10) });
  clearSave();
  document.getElementById('hud').classList.add('hidden');
  setTimeout(() => showGameOver(rank), 900);
}

Z.onKill = z => {
  if (z.def.animal) { dropAt(z.x, z.y, makeItem('rawmeat', z.def.meat)); return; }
  const n = z.def.heavy ? 3 : Math.random() < 0.16 ? 1 : 0;
  for (let i = 0; i < n; i++) { const l = rollLoot(LOOT.zombie, Math.random); dropAt(z.x + Math.random() * 16 - 8, z.y + Math.random() * 16 - 8, makeItem(l[0], l[1])); }
};
document.getElementById('minimap').addEventListener('pointerdown', e => { e.preventDefault(); if (G.mode === 'play' && !G.paused) showMap(); });

document.addEventListener('visibilitychange', () => {
  suspendAudio(document.hidden);
  if (document.hidden && G.mode === 'play') { saveGame(); if (!G.paused) showPause(); }
});
addEventListener('pagehide', () => saveGame());
