// Zeit: Tag/Nacht, Jahreszeiten, Blutmond. (Wetter + Temperatur: world/weather.js)
import { G } from '../state.js';
import { CFG } from '../config.js';
import { W, setSeason } from './world.js';
import { toast } from '../ui/hud.js';
import { sfx } from '../audio/audio.js';

let lastDay = -1;
export function resetTime() { lastDay = -1; }
export function updateTime(dt) {
  const e = G.env, dayF = G.clock / G.dayLen, day = Math.floor(dayF), E = CFG.BLOODMOON_EVERY;
  e.hour = (dayF - day) * 24; e.day = day;
  e.season = Math.floor(day / CFG.SEASON_DAYS) % 4; e.year = Math.floor(day / (CFG.SEASON_DAYS * 4));
  if (e.season !== W.season) { setSeason(e.season); if (lastDay >= 0) toast('Der ' + CFG.seasons[e.season].name + ' beginnt.' + (e.season === 0 && e.year ? ' Jahr ' + (e.year + 1) + ' – es wird härter.' : '')); }
  if (day !== lastDay) {
    if (lastDay >= 0) { toast('Tag ' + (day + 1) + ' – du lebst noch.'); G.wantSave = true; }
    if ((day + 1) % E === 0) toast('Heute Nacht ist BLUTMOND. Bereite deine Basis vor!', true);
    lastDay = day;
  }
  const S = CFG.seasons[e.season], h = e.hour, tw = 0.8;
  let d;
  if (h < S.sunrise - tw || h > S.sunset + tw) d = 1;
  else if (h < S.sunrise + tw) d = 1 - (h - (S.sunrise - tw)) / (2 * tw);
  else if (h > S.sunset - tw) d = (h - (S.sunset - tw)) / (2 * tw);
  else d = 0;
  e.dark = d;
  // Sonnenstand: Schatten wandern von West (morgens) über Süd (mittags) nach Ost (abends), lang bei tiefer Sonne
  const st = Math.max(0, Math.min(1, (h - S.sunrise) / (S.sunset - S.sunrise))), k = Math.abs(st - 0.5) * 2;
  e.shAng = Math.PI - st * Math.PI;
  e.shLen = 0.6 + (e.season === 3 ? 0.55 : 0) + 1.9 * k * k;
  const wf = { clear: 1, heat: 1, snow: 0.55, rain: 0.35, fog: 0.22, storm: 0.2, blizzard: 0.15 }[e.weather];
  e.shA = 0.36 * (1 - d) * (wf === undefined ? 1 : wf);
  const bm = ((day + 1) % E === 0 && h > S.sunset + 0.6) || (day > 0 && day % E === 0 && h < S.sunrise - 0.6);
  if (bm && !e.bloodMoon) { toast('BLUTMOND! Die Horde kommt…', true); sfx('bloodmoon'); }
  if (!bm && e.bloodMoon) toast('Der Blutmond ist vorüber.');
  e.bloodMoon = bm;
}
