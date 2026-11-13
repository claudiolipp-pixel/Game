// Renderer: Kamera, Welt, Figuren, Overlays.
import { G } from '../state.js';
import { CFG } from '../config.js';
import { settings, saveSettings } from '../core/save.js';
import { input, stickRadius } from '../core/input.js';
import { SPR, HEAD } from './sprites.js';
import { drawGround, drawRoofs, drawCanopies, drawShadows, T } from '../world/world.js';
import { drawLighting } from './lighting.js';
import { drawWeather, drawTracks } from './weatherfx.js';
import { ST } from '../building/structures.js';
import { BUILD } from '../config.js';
import { W } from '../world/world.js';
import { Z } from '../entities/zombies.js';
import { shots } from '../entities/projectiles.js';
import { parts, texts } from '../entities/fx.js';

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
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'medium';
}
// Bildschirmposition des Spielers in CSS-Pixeln (für Maus-Zielen)
export function playerScreen(out) { out.x = (view.px * view.scale + view.tx) / view.css; out.y = (view.py * view.scale + view.ty) / view.css; }

function drawSprite(img, x, y, ang, sz) {
  const s = view.scale, e = G.env, ga = ctx.globalAlpha;
  ctx.setTransform(s, 0, 0, s, view.tx, view.ty);
  ctx.globalAlpha = 0.55 * ga; ctx.drawImage(SPR.shadow, x - 11 * sz, y - 7 * sz, 24 * sz, 17 * sz);          // Kontaktschatten
  if (e.shA > 0.02) {                                                                                       // langer Schlagschatten
    const ca = Math.cos(e.shAng), sa = Math.sin(e.shAng);
    ctx.setTransform(ca * s, sa * s, -sa * s, ca * s, x * s + view.tx, y * s + view.ty);
    ctx.globalAlpha = Math.min(1, e.shA * 1.5) * ga; ctx.drawImage(SPR.shadow, -7 * sz, -8 * sz, (16 + 30 * e.shLen) * sz, 16 * sz);
  }
  ctx.globalAlpha = ga;
  ctx.setTransform(Math.cos(ang) * s * sz, Math.sin(ang) * s * sz, -Math.sin(ang) * s * sz, Math.cos(ang) * s * sz, x * s + view.tx, y * s + view.ty);
  ctx.drawImage(img, -16, -16, 32, 32);
}

// Automatische Qualitätsanpassung: bleibt die Bildrate länger unter ~37 FPS, erst Bodenglättung aus, dann Auflösung senken
let slowT = 0;
function autoQuality(fdt) {
  if (G.paused || G.mode !== 'play') { slowT = 0; return; }
  slowT = fdt > 0.027 ? slowT + fdt : Math.max(0, slowT - fdt * 2);
  if (slowT < 2.5) return;
  slowT = 0;
  if (W.smoothGround) W.smoothGround = false;
  else if (settings.quality > 0.5) { settings.quality = settings.quality > 0.75 ? 0.75 : 0.5; saveSettings(); resize(); }
}
export function render(alpha, fdt) {
  autoQuality(fdt);
  const p = G.player;
  if (!p) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0b0d10'; ctx.fillRect(0, 0, view.w, view.h); return; }
  const s = view.scale;
  view.px = p.ox + (p.x - p.ox) * alpha; view.py = p.oy + (p.y - p.oy) * alpha;
  view.camX += (view.px + input.ax * 24 - view.camX) * 0.12;
  view.camY += (view.py + input.ay * 24 - view.camY) * 0.12;
  view.tx = Math.round(view.w / 2 - view.camX * s); view.ty = Math.round(view.h / 2 - view.camY * s);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'medium';
  drawGround(ctx, view);

  if (G.shake > 0) { view.tx += Math.round((Math.random() - 0.5) * G.shake * s); view.ty += Math.round((Math.random() - 0.5) * G.shake * s); }
  const hw = view.w / 2 / s + 24, hh = view.h / 2 / s + 24, cx = view.camX, cy = view.camY;
  ctx.setTransform(s, 0, 0, s, view.tx, view.ty);
  // Partikel am Boden (Blutflecken) + Boden-Items
  for (let i = 0; i < parts.length; i++) { const q = parts[i]; if (!q.on || q.max < 5) continue; ctx.globalAlpha = Math.min(1, q.life / 3) * 0.7; ctx.fillStyle = q.col; ctx.fillRect(q.x - q.sz, q.y - q.sz, q.sz * 2, q.sz * 2); }
  ctx.globalAlpha = 1;
  if (G.env.season === 3) drawTracks(ctx, G.paused ? 0 : fdt);
  const dr = G.drops; for (let i = 0; i < dr.length; i++) ctx.drawImage(SPR.bag, dr[i].x - 8, dr[i].y - 8, 16, 16);
  drawShadows(ctx, view);
  // Bauwerke
  const sl = ST.list, snowy = W.season === 3 && !settings.markTraps;
  for (let i = 0; i < sl.length; i++) {
    const b = sl[i]; if (b.x < cx - hw || b.x > cx + hw || b.y < cy - hh || b.y > cy + hh) continue;
    let spr = SPR.build[b.id];
    if (b.id === 'beartrap' && b.shut) spr = SPR.build.beartrap_shut; else if (b.id === 'plot' && b.planted) spr = b.grow >= 1 ? SPR.build.plot2 : b.grow > 0.4 ? SPR.build.plot1 : spr; else if (b.id === 'gas' && b.fire > 0) spr = SPR.build.gas_burn;
    if (b.def.trap && snowy && !(b.fire > 0)) ctx.globalAlpha = 0.3;
    const ox = b.hitT > 0 ? (Math.random() - 0.5) * 3 : (b.id === 'gen' && b.on ? (Math.random() - 0.5) : 0);
    if (b.rot && (b.def.dir || b.id === 'door' || b.id === 'spikewall' || b.id === 'wire' || b.id === 'tripwire')) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot * Math.PI / 2); ctx.drawImage(spr, -16, -16, 32, 32); ctx.restore(); }
    else ctx.drawImage(spr, b.x - 16 + ox, b.y - 16, 32, 32);
    ctx.globalAlpha = 1;
    if (b.lvl > 1) ctx.drawImage(SPR.lvl[b.lvl - 1], b.x - 16, b.y - 16, 32, 32);
    if (HEAD[b.id]) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.id === 'mg' && p.mounted === b ? p.ang : b.ang); ctx.drawImage(HEAD[b.id], -16, -16, 32, 32); ctx.restore(); }
    if (b.id === 'lure' && b.on && (G.tick & 16)) { ctx.fillStyle = '#ff4'; ctx.fillRect(b.x - 2, b.y - 14, 4, 4); }
    if (b.def.trap && settings.markTraps) ctx.drawImage(SPR.mark, b.x - 4, b.y - 20, 8, 8);
    if (b.hp < b.maxHp * 0.98 && !b.def.trap) { ctx.fillStyle = '#000'; ctx.fillRect(b.x - 12, b.y + 11, 24, 3); ctx.fillStyle = b.hp > b.maxHp * 0.4 ? '#5c5' : '#c44'; ctx.fillRect(b.x - 12, b.y + 11, 24 * b.hp / b.maxHp, 3); }
    if (b.def.ammo && b.def.cap && b.ammo < 1 && (G.tick & 32)) { ctx.fillStyle = '#f44'; ctx.fillRect(b.x - 1, b.y - 18, 3, 6); ctx.fillRect(b.x - 1, b.y - 10, 3, 2); }
  }
  // Bau-Vorschau
  if (G.build) {
    const g = G.build, gx = g.tx * 32, gy = g.ty * 32;
    ctx.globalAlpha = 0.65; ctx.save(); ctx.translate(gx + 16, gy + 16); ctx.rotate(g.rot * Math.PI / 2); ctx.drawImage(SPR.build[g.id], -16, -16, 32, 32); ctx.restore();
    ctx.globalAlpha = 0.4; ctx.fillStyle = g.ok ? '#4ab4ff' : '#f33'; ctx.fillRect(gx, gy, 32, 32);
    ctx.globalAlpha = 1; ctx.strokeStyle = g.ok ? '#8fd4ff' : '#f33'; ctx.lineWidth = 1.5; ctx.strokeRect(gx + 0.5, gy + 0.5, 31, 31);
    const bd = BUILD[g.id];
    if (bd.range) { ctx.globalAlpha = 0.5; ctx.beginPath(); if (bd.dir) { const a = g.rot * Math.PI / 2; ctx.moveTo(gx + 16, gy + 16); ctx.arc(gx + 16, gy + 16, bd.range, a - 0.5, a + 0.5); ctx.closePath(); } else ctx.arc(gx + 16, gy + 16, bd.range, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1; }
  }
  // Zombies
  const zl = Z.list;
  for (let i = 0; i < zl.length; i++) {
    const z = zl[i]; if (!z.alive) continue;
    const zx = z.ox + (z.x - z.ox) * alpha, zy = z.oy + (z.y - z.oy) * alpha;
    if (zx < cx - hw || zx > cx + hw || zy < cy - hh || zy > cy + hh) continue;
    if (z.def.stealth) ctx.globalAlpha = G.env.dark > 0.5 ? 0.35 : 0.6;
    const zs = z.frost ? SPR.zf[z.type] : SPR.z[z.type];
    drawSprite(zs.length ? zs[((G.tick + i * 5) >> (z.def.sp > 60 ? 3 : 4)) & 1] : zs, zx, zy, z.ang + Math.sin((G.tick + i * 7) * 0.13) * 0.07, z.def.sz * (z.flash > 0 ? 1.12 : 1));
    ctx.globalAlpha = 1;
    if (z.hp < z.maxHp && z.def.heavy) { ctx.setTransform(s, 0, 0, s, view.tx, view.ty); ctx.fillStyle = '#000'; ctx.fillRect(zx - 12, zy - 22, 24, 3); ctx.fillStyle = '#c33'; ctx.fillRect(zx - 12, zy - 22, 24 * z.hp / z.maxHp, 3); }
  }
  // Spieler
  if (p.hp > 0) drawSprite(SPR.player[p.moving ? (G.tick >> (p.sprinting ? 2 : 3)) & 1 : 0], view.px, view.py, p.ang, p.hurtT > 0 ? 1.1 : 1);
  ctx.setTransform(s, 0, 0, s, view.tx, view.ty);
  if (p.swing > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3;
    const a = p.ang + (0.5 - p.swing / 0.16) * p.swingArc;
    ctx.beginPath(); ctx.arc(view.px, view.py, p.swingR - 4, a - 0.35, a + 0.35); ctx.stroke();
  }
  // Projektile
  for (let i = 0; i < shots.length; i++) {
    const q = shots[i]; if (!q.on) continue;
    const qx = q.ox + (q.x - q.ox) * alpha, qy = q.oy + (q.y - q.oy) * alpha;
    ctx.strokeStyle = q.kind === 1 ? '#d8c8a0' : '#ffe9a0'; ctx.lineWidth = q.kind === 1 ? 2 : 1.5;
    const m = Math.hypot(q.vx, q.vy) || 1, len = q.kind === 1 ? 9 : 12;
    ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(qx - q.vx / m * len, qy - q.vy / m * len); ctx.stroke();
  }
  // Partikel
  for (let i = 0; i < parts.length; i++) { const q = parts[i]; if (!q.on || q.max >= 5) continue; ctx.globalAlpha = Math.min(1, q.life / q.max * 1.5); ctx.fillStyle = q.col; ctx.fillRect(q.x - q.sz / 2, q.y - q.sz / 2, q.sz, q.sz); }
  ctx.globalAlpha = 1;

  drawCanopies(ctx, view, view.px, view.py);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawRoofs(ctx, view, Math.floor(p.x / T), Math.floor(p.y / T));
  drawWeather(ctx, view, G.paused ? 0 : fdt);
  drawLighting(ctx, view);
  // schwebende Texte
  ctx.font = 'bold ' + Math.round(6 * s) + 'px monospace'; ctx.textAlign = 'center';
  for (let i = 0; i < texts.length; i++) { const t = texts[i]; if (!t.on) continue; ctx.globalAlpha = Math.min(1, t.life * 2); ctx.fillStyle = '#000'; ctx.fillText(t.txt, t.x * s + view.tx + 1, t.y * s + view.ty + 1); ctx.fillStyle = t.col; ctx.fillText(t.txt, t.x * s + view.tx, t.y * s + view.ty); }
  ctx.globalAlpha = 1;
  if (p.hurtT > 0) { ctx.fillStyle = 'rgba(180,0,0,' + (p.hurtT * 0.8) + ')'; ctx.fillRect(0, 0, view.w, view.h); }
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
