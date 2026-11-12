// Renderer: Kamera, Welt, Figuren, Overlays.
import { G } from '../state.js';
import { CFG } from '../config.js';
import { settings } from '../core/save.js';
import { input, stickRadius } from '../core/input.js';
import { SPR } from './sprites.js';
import { drawGround, drawRoofs, T } from '../world/world.js';

export const view = { w: 1, h: 1, scale: 1, camX: 0, camY: 0, tx: 0, ty: 0, css: 1, px: 0, py: 0 };
let canvas, ctx;

export function initRenderer(cv) {
  canvas = cv; ctx = cv.getContext('2d', { alpha: false });
  resize();
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 200));
}
export function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2) * settings.quality;
  canvas.width = Math.max(320, Math.round(innerWidth * dpr));
  canvas.height = Math.max(200, Math.round(innerHeight * dpr));
  view.w = canvas.width; view.h = canvas.height; view.css = canvas.width / innerWidth;
  view.scale = view.h / CFG.VIEW_H;
  if (view.w / view.scale > CFG.VIEW_H * 2.3) view.scale = view.w / (CFG.VIEW_H * 2.3);
  ctx.imageSmoothingEnabled = false;
}
// Bildschirmposition des Spielers in CSS-Pixeln (für Maus-Zielen)
export function playerScreen(out) { out.x = (view.px * view.scale + view.tx) / view.css; out.y = (view.py * view.scale + view.ty) / view.css; }

function drawSprite(img, x, y, ang, sz) {
  const s = view.scale;
  ctx.setTransform(Math.cos(ang) * s * sz, Math.sin(ang) * s * sz, -Math.sin(ang) * s * sz, Math.cos(ang) * s * sz, x * s + view.tx, y * s + view.ty);
  ctx.drawImage(img, -img.width, -img.height, img.width * 2, img.height * 2);
}

export function render(alpha) {
  const p = G.player;
  if (!p) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b0d10'; ctx.fillRect(0, 0, view.w, view.h); return; }
  const s = view.scale;
  view.px = p.ox + (p.x - p.ox) * alpha; view.py = p.oy + (p.y - p.oy) * alpha;
  view.camX += (view.px + input.ax * 24 - view.camX) * 0.12;
  view.camY += (view.py + input.ay * 24 - view.camY) * 0.12;
  view.tx = Math.round(view.w / 2 - view.camX * s); view.ty = Math.round(view.h / 2 - view.camY * s);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  drawGround(ctx, view);

  drawSprite(SPR.player, view.px, view.py, p.ang, 1);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawRoofs(ctx, view, Math.floor(p.x / T), Math.floor(p.y / T));
  drawSticks();
}

function drawSticks() {
  if (!input.touch || G.paused) return;
  const c = view.css, R = stickRadius() * c;
  for (let i = 0; i < 2; i++) {
    const st = i ? input.R : input.L;
    if (!st.on && !settings.stickFixed) continue;
    let ox = st.ox, oy = st.oy;
    if (!st.on) { const left = (i === 0) !== !!settings.lefty; ox = left ? 40 + stickRadius() * 1.4 : innerWidth - 40 - stickRadius() * 1.4; oy = innerHeight - 40 - stickRadius() * 1.4; }
    ctx.globalAlpha = 0.28; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(ox * c, oy * c, R, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 0.5; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * c; ctx.stroke();
    ctx.fillStyle = i ? '#e0a040' : '#fff';
    ctx.beginPath(); ctx.arc((ox + st.x * stickRadius()) * c, (oy + st.y * stickRadius()) * c, R * 0.42, 0, 6.283); ctx.fill();
    ctx.globalAlpha = 1;
  }
}
