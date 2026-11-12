// Eingabe: Touch-Twin-Sticks, Tastatur/Maus, Gamepad. Liefert ein einheitliches input-Objekt.
import { settings } from './save.js';

export const input = {
  mx: 0, my: 0,            // Bewegung -1..1
  ax: 1, ay: 0, aimMag: 0, // Zielrichtung (normiert) + Auslenkung
  fire: false, sprint: false, sneak: false,
  act: {},                 // einmalige Aktionen (interact, inv, build, swap, reload, light, pause, place, rotate, cancel)
  touch: false,
  L: { id: -1, ox: 0, oy: 0, x: 0, y: 0, on: false },
  R: { id: -1, ox: 0, oy: 0, x: 0, y: 0, on: false },
  sprintToggle: false,
};
const keys = {};
const mouse = { x: 0, y: 0, down: false, used: false };
let canvas = null;
const padPrev = [];

export function stickRadius() { return 54 * settings.stickSize; }

function fixedPos(st, isMove) {
  const leftSide = isMove !== !!settings.lefty;
  st.ox = leftSide ? 40 + stickRadius() * 1.4 : innerWidth - 40 - stickRadius() * 1.4;
  st.oy = innerHeight - 40 - stickRadius() * 1.4;
}

function onTouchStart(e) {
  e.preventDefault(); input.touch = true;
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    const isMove = (t.clientX < innerWidth / 2) !== !!settings.lefty;
    const st = isMove ? input.L : input.R;
    if (st.on) continue;
    st.on = true; st.id = t.identifier;
    if (settings.stickFixed) fixedPos(st, isMove); else { st.ox = t.clientX; st.oy = t.clientY; }
    setStick(st, t.clientX, t.clientY);
  }
}
function setStick(st, x, y) {
  const R = stickRadius();
  let dx = (x - st.ox) / R, dy = (y - st.oy) / R;
  const m = Math.hypot(dx, dy);
  if (m > 1) { dx /= m; dy /= m; }
  st.x = dx; st.y = dy;
}
function onTouchMove(e) {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    if (input.L.on && t.identifier === input.L.id) setStick(input.L, t.clientX, t.clientY);
    else if (input.R.on && t.identifier === input.R.id) setStick(input.R, t.clientX, t.clientY);
  }
}
function onTouchEnd(e) {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    if (input.L.on && t.identifier === input.L.id) { input.L.on = false; input.L.x = input.L.y = 0; }
    if (input.R.on && t.identifier === input.R.id) { input.R.on = false; input.R.x = input.R.y = 0; }
  }
}

const KEYMAP = { e: 'interact', i: 'inv', tab: 'inv', b: 'build', q: 'swap', r: 'reload', f: 'light', escape: 'pause', p: 'pause', ' ': 'place', t: 'rotate', x: 'cancel' };

export function initInput(cv) {
  canvas = cv;
  const o = { passive: false };
  cv.addEventListener('touchstart', onTouchStart, o);
  cv.addEventListener('touchmove', onTouchMove, o);
  cv.addEventListener('touchend', onTouchEnd, o);
  cv.addEventListener('touchcancel', onTouchEnd, o);
  // Zoom / Scroll / Doppeltipp global unterbinden
  document.addEventListener('gesturestart', e => e.preventDefault(), o);
  document.addEventListener('dblclick', e => e.preventDefault(), o);
  document.addEventListener('touchmove', e => { if (!e.target.closest || !e.target.closest('.panel')) e.preventDefault(); }, o);
  document.addEventListener('contextmenu', e => e.preventDefault());

  addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (!keys[k] && KEYMAP[k]) input.act[KEYMAP[k]] = true;
    keys[k] = true;
    if (k === 'tab' || k === ' ') e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = false; });
  cv.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.used = true; });
  cv.addEventListener('mousedown', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.down = true; mouse.used = true; });
  addEventListener('mouseup', () => { mouse.down = false; });

  // HUD-Buttons
  document.querySelectorAll('[data-act]').forEach(el => {
    el.addEventListener('pointerdown', e => {
      e.preventDefault(); e.stopPropagation();
      const a = el.dataset.act;
      if (a === 'sprint') input.sprintToggle = !input.sprintToggle; else input.act[a] = true;
    });
  });
}

// Einmal pro Logik-Tick aufrufen. playerScreenX/Y für Maus-Zielen.
export function pollInput(psx, psy) {
  let mx = 0, my = 0, ax = 0, ay = 0, fire = false, sprint = input.sprintToggle, sneak = false, aimSet = false;
  if (input.L.on) { mx = input.L.x; my = input.L.y; }
  else {
    if (keys.a || keys.arrowleft) mx -= 1; if (keys.d || keys.arrowright) mx += 1;
    if (keys.w || keys.arrowup) my -= 1; if (keys.s || keys.arrowdown) my += 1;
    const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
  }
  if (keys.shift) sprint = true;
  if (keys.c || keys.control) sneak = true;
  if (input.R.on) {
    const m = Math.hypot(input.R.x, input.R.y);
    if (m > 0.15) { ax = input.R.x / m; ay = input.R.y / m; aimSet = true; input.aimMag = m; fire = m > 0.4; }
  } else if (mouse.used && !input.touch) {
    const dx = mouse.x - psx, dy = mouse.y - psy, m = Math.hypot(dx, dy);
    if (m > 4) { ax = dx / m; ay = dy / m; aimSet = true; }
    fire = mouse.down;
  }
  // Gamepad
  const pads = navigator.getGamepads ? navigator.getGamepads() : null;
  if (pads) for (let i = 0; i < pads.length; i++) {
    const gp = pads[i]; if (!gp || !gp.connected) continue;
    const lx = gp.axes[0] || 0, ly = gp.axes[1] || 0, rx = gp.axes[2] || 0, ry = gp.axes[3] || 0;
    if (Math.hypot(lx, ly) > 0.2) { mx = lx; my = ly; }
    const rm = Math.hypot(rx, ry);
    if (rm > 0.25) { ax = rx / rm; ay = ry / rm; aimSet = true; fire = fire || rm > 0.6; }
    const b = gp.buttons, down = j => b[j] && b[j].pressed;
    if (down(7)) fire = true;
    if (down(6) || down(10)) sprint = true;
    const map = ['interact', 'cancel', 'reload', 'inv', 'swap', 'build', null, null, 'light', 'pause', null, null, 'rotate', 'place'];
    for (let j = 0; j < map.length; j++) {
      const d = down(j);
      if (d && !padPrev[j] && map[j]) input.act[map[j]] = true;
      padPrev[j] = d;
    }
    break;
  }
  const mm = Math.hypot(mx, my);
  if (input.L.on && mm > 0.12 && mm < 0.5) sneak = true;
  if (mm < 0.12) { mx = 0; my = 0; }
  input.mx = mx; input.my = my; input.sprint = sprint && !sneak; input.sneak = sneak; input.fire = fire;
  if (aimSet) { input.ax = ax; input.ay = ay; }
  else if (mm > 0.12) { input.ax = mx / mm; input.ay = my / mm; }
}
export function clearActions() { const a = input.act; for (const k in a) a[k] = false; }
export function resetSticks() { input.L.on = input.R.on = false; input.L.x = input.L.y = input.R.x = input.R.y = 0; mouse.down = false; for (const k in keys) keys[k] = false; }
