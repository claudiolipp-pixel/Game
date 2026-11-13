// Persistenz: Einstellungen, Highscores, Spielstand (localStorage).
const K_SET = 'lw_settings', K_HS = 'lw_highscores', K_SAVE = 'lw_save';
export const settings = { vol: 0.7, stickSize: 1, stickFixed: false, lefty: false, quality: 1, dayLen: 480, markTraps: false, tutorial: true, gfx3d: true };

function read(k) { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

export function loadSettings() { const s = read(K_SET); if (s) Object.assign(settings, s); document.body.classList.toggle('lefty', !!settings.lefty); }
export function saveSettings() { write(K_SET, settings); document.body.classList.toggle('lefty', !!settings.lefty); }
export function getHighscores() { return read(K_HS) || []; }
export function addHighscore(e) {
  const l = getHighscores(); l.push(e);
  l.sort((a, b) => b.days - a.days || b.kills - a.kills);
  l.length = Math.min(l.length, 10); write(K_HS, l);
  return l.indexOf(e);
}
export function hasSave() { try { return !!localStorage.getItem(K_SAVE); } catch (e) { return false; } }
export function readSave() { return read(K_SAVE); }
export function writeSave(obj) { return write(K_SAVE, obj); }
export function clearSave() { try { localStorage.removeItem(K_SAVE); } catch (e) { } }
