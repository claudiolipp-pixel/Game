// Wetter + Temperatur: Regen, Gewitter, Nebel, Schnee, Blizzard, Hitzewelle – mit Gameplay-Wirkung.
import { G } from '../state.js';
import { CFG } from '../config.js';
import { toast } from '../ui/hud.js';
import { sfx, setAmbient } from '../audio/audio.js';
import { drain } from '../systems/survival.js';

let warnT = 0;
export function resetWeather() { G.wT = 40 + Math.random() * 60; G.lightning = 0; G.lightT = 5; G.env.weather = 'clear'; G.env.temp = 12; }

function pick(season) {
  const tb = CFG.weather.table[season]; let tot = 0;
  for (const k in tb) tot += tb[k];
  let r = Math.random() * tot;
  for (const k in tb) { r -= tb[k]; if (r <= 0) return k; }
  return 'clear';
}

export function updateWeather(dt) {
  const e = G.env, p = G.player, WC = CFG.weather, ts = 480 / G.dayLen;
  G.wT -= dt * ts;
  if (G.wT <= 0 || WC.table[e.season][e.weather] === undefined) {
    const w = pick(e.season);
    G.wT = WC.minDur + Math.random() * (WC.maxDur - WC.minDur);
    if (w !== e.weather) { e.weather = w; if (w !== 'clear') toast('Wetter: ' + WC.names[w], w === 'blizzard' || w === 'heat' || w === 'storm'); }
  }
  const w = e.weather;
  e.raining = w === 'rain' || w === 'storm';
  e.sight = WC.sight[w]; e.hear = WC.hear[w]; e.zSpeed = w === 'blizzard' ? 0.85 : 1;
  const S = CFG.seasons[e.season];
  const amb = S.tempNight + (S.tempDay - S.tempNight) * (1 - e.dark) + WC.temp[w] - e.year * 1.5 * (e.season === 3 ? 1 : 0);
  e.temp += (amb - e.temp) * Math.min(1, dt * 0.2 * ts);
  // gefühlte Temperatur → Körpertemperatur
  let feel = e.temp + (p.warm || 0);
  if (p.inside) feel += 6; else { if (e.raining) feel -= 4; if (w === 'blizzard') feel -= 4; }
  if (p.fireT > 0) { feel = Math.max(feel + 8, Math.min(feel + 22, 18)); p.fireT -= dt; }
  if (p.torchT > 0) feel += 4;
  let target = 37;
  if (feel < 10) target = 37 - (10 - feel) * 0.14; else if (feel > 26) target = 37 + (feel - 26) * 0.2;
  p.temp += (target - p.temp) * Math.min(1, dt * ts / 38);
  const SV = CFG.survival;
  if (p.temp < SV.coldDmgTemp) { drain((SV.coldDmgTemp - p.temp + 0.3) * 1.1 * dt * ts, 'Erfroren'); warnT -= dt; if (warnT <= 0) { warnT = 12; toast('Du erfrierst! Feuer, Kleidung oder ein Dach suchen.', true); } }
  else if (p.temp > SV.heatDmgTemp) { drain((p.temp - SV.heatDmgTemp + 0.3) * 1.1 * dt * ts, 'An einem Hitzschlag gestorben'); p.thirst = Math.max(0, p.thirst - dt * 0.4); warnT -= dt; if (warnT <= 0) { warnT = 12; toast('Hitzschlag droht! Schatten suchen, warme Kleidung ablegen.', true); } }
  // Blitze
  if (G.lightning > 0) G.lightning -= dt;
  if (w === 'storm') { G.lightT -= dt; if (G.lightT <= 0) { G.lightT = 4 + Math.random() * 10; G.lightning = 0.28; sfx('thunder', 0.7 + Math.random() * 0.3); } }
  setAmbient(p.inside ? (e.raining ? 0.35 : 0) : w === 'storm' ? 1 : w === 'rain' ? 0.7 : 0, w === 'blizzard' ? 1 : w === 'snow' || w === 'storm' ? 0.35 : w === 'fog' ? 0.12 : 0);
}
