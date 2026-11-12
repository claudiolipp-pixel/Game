// Web-Audio-Synthesizer: alle Sounds werden zur Laufzeit erzeugt. Entsperrung nach erster Nutzer-Geste (iOS).
import { settings } from '../core/save.js';
import { G } from '../state.js';
let ac = null, master = null, noiseBuf = null, rainG = null, windG = null;
const last = {};

export function unlockAudio() {
  if (ac) { if (ac.state !== 'running') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  try {
    ac = new AC(); master = ac.createGain(); master.gain.value = settings.vol; master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    rainG = loop(1800, 'highpass', 0.6); windG = loop(420, 'bandpass', 1.2);
    ac.resume();
  } catch (e) { ac = null; }
}
function loop(freq, type, q) {
  const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(master); s.start(); return g;
}
export function setVolume(v) { if (master) master.gain.value = v; }
export function setAmbient(rain, wind) {
  if (!ac) return; const t = ac.currentTime;
  rainG.gain.setTargetAtTime(rain * 0.22, t, 0.8); windG.gain.setTargetAtTime(wind * 0.3, t, 0.8);
}
export function suspendAudio(v) { if (ac) { if (v) ac.suspend(); else ac.resume(); } }

function tone(f0, f1, dur, type, vol, delay) {
  const t = ac.currentTime + (delay || 0), o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function nz(dur, vol, freq, type, delay) {
  const t = ac.currentTime + (delay || 0), s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq;
  const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5, dur + 0.05);
}
const S = {
  swing: v => nz(0.09, 0.25 * v, 2500, 'highpass'),
  hit: v => { tone(140, 55, 0.12, 'sine', 0.5 * v); nz(0.06, 0.25 * v, 900); },
  chop: v => { tone(220, 90, 0.08, 'square', 0.2 * v); nz(0.05, 0.3 * v, 1500); },
  pistol: v => { nz(0.16, 0.7 * v, 2600); tone(190, 50, 0.1, 'square', 0.3 * v); },
  shotgun: v => { nz(0.32, 0.9 * v, 1500); tone(110, 35, 0.2, 'sawtooth', 0.4 * v); },
  rifle: v => { nz(0.28, 0.8 * v, 3400); tone(240, 45, 0.16, 'square', 0.35 * v); },
  mg: v => { nz(0.07, 0.5 * v, 2800); tone(170, 60, 0.05, 'square', 0.25 * v); },
  bow: v => { tone(320, 140, 0.14, 'triangle', 0.3 * v); nz(0.05, 0.1 * v, 3000, 'highpass'); },
  empty: v => tone(900, 700, 0.03, 'square', 0.12 * v),
  reload: v => { tone(500, 380, 0.04, 'square', 0.14 * v); tone(700, 520, 0.04, 'square', 0.14 * v, 0.14); },
  groan: v => { tone(72 + Math.random() * 30, 55, 0.5, 'sawtooth', 0.14 * v); },
  scream: v => { tone(520, 980, 0.7, 'sawtooth', 0.22 * v); tone(540, 1010, 0.7, 'square', 0.1 * v); },
  hurt: v => { tone(200, 90, 0.18, 'sawtooth', 0.3 * v); nz(0.08, 0.2 * v, 700); },
  pickup: v => { tone(620, 620, 0.05, 'square', 0.1 * v); tone(880, 880, 0.07, 'square', 0.1 * v, 0.06); },
  craft: v => { tone(330, 330, 0.05, 'square', 0.12 * v); tone(440, 440, 0.05, 'square', 0.12 * v, 0.08); tone(660, 660, 0.09, 'square', 0.12 * v, 0.16); },
  build: v => { tone(120, 70, 0.1, 'sine', 0.5 * v); nz(0.08, 0.3 * v, 1200); },
  deny: v => tone(150, 110, 0.14, 'square', 0.14 * v),
  alarm: v => { for (let i = 0; i < 6; i++) tone(1400 + Math.random() * 900, 1200, 0.06, 'square', 0.16 * v, i * 0.07); },
  explosion: v => { nz(0.9, 1.0 * v, 600); tone(90, 28, 0.6, 'sine', 0.8 * v); },
  thunder: v => { nz(1.6, 0.6 * v, 260); tone(60, 30, 1.2, 'sine', 0.4 * v); },
  zap: v => { tone(1800, 200, 0.12, 'sawtooth', 0.18 * v); nz(0.08, 0.2 * v, 5000, 'highpass'); },
  fire: v => nz(0.3, 0.3 * v, 900, 'bandpass'),
  snap: v => { tone(900, 200, 0.06, 'square', 0.3 * v); nz(0.05, 0.3 * v, 3000, 'highpass'); },
  eat: v => { nz(0.07, 0.2 * v, 1200); nz(0.07, 0.2 * v, 1000, 'lowpass', 0.15); },
  drink: v => { tone(300, 500, 0.1, 'sine', 0.15 * v); tone(320, 520, 0.1, 'sine', 0.15 * v, 0.15); },
  click: v => tone(700, 700, 0.03, 'square', 0.08 * v),
  ring: v => { for (let i = 0; i < 4; i++) tone(1900, 1900, 0.05, 'square', 0.1 * v, i * 0.09); },
  die: v => { tone(300, 40, 1.4, 'sawtooth', 0.35 * v); },
  bloodmoon: v => { tone(55, 50, 3, 'sawtooth', 0.3 * v); tone(82, 78, 3, 'sine', 0.3 * v); },
  step: v => nz(0.04, 0.05 * v, 500),
  gen: v => tone(55, 50, 0.25, 'sawtooth', 0.12 * v),
};
// name, Lautstärke, optional Weltposition (Distanzdämpfung), min. Abstand in Sekunden
export function sfx(name, vol, x, y, gap) {
  if (!ac || ac.state !== 'running') return;
  let v = vol === undefined ? 1 : vol;
  if (x !== undefined && G.player) { const d = Math.hypot(x - G.player.x, y - G.player.y); v *= Math.max(0, 1 - d / 520); if (v < 0.03) return; }
  const now = ac.currentTime;
  if (last[name] && now - last[name] < (gap || 0.035)) return;
  last[name] = now; S[name](v);
}
