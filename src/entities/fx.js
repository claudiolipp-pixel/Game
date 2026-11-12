// Partikel + schwebende Texte (Object Pools).
const MAXP = 360, MAXT = 24;
export const parts = [], texts = [];
for (let i = 0; i < MAXP; i++) parts.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, col: '#fff', sz: 2, drag: 0 });
for (let i = 0; i < MAXT; i++) texts.push({ on: false, x: 0, y: 0, life: 0, txt: '', col: '#fff' });
let pi = 0, ti = 0;
export function particle(x, y, vx, vy, life, col, sz, drag) {
  const p = parts[pi]; pi = (pi + 1) % MAXP;
  p.on = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = p.max = life; p.col = col; p.sz = sz; p.drag = drag || 0;
}
export function burst(x, y, n, col, speed, life, sz) {
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, s = speed * (0.3 + Math.random() * 0.7); particle(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.5 + Math.random() * 0.5), col, sz, 4); }
}
export function blood(x, y, n) { burst(x, y, n, '#8a1010', 90, 0.45, 2); particle(x + Math.random() * 8 - 4, y + Math.random() * 8 - 4, 0, 0, 14, '#5a0c0c', 4, 0); }
export function floatText(x, y, txt, col) {
  const t = texts[ti]; ti = (ti + 1) % MAXT;
  t.on = true; t.x = x; t.y = y; t.life = 1.1; t.txt = txt; t.col = col || '#fff';
}
export function updateFx(dt) {
  for (let i = 0; i < MAXP; i++) {
    const p = parts[i]; if (!p.on) continue;
    p.life -= dt; if (p.life <= 0) { p.on = false; continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.drag) { const f = Math.max(0, 1 - p.drag * dt); p.vx *= f; p.vy *= f; }
  }
  for (let i = 0; i < MAXT; i++) { const t = texts[i]; if (!t.on) continue; t.life -= dt; t.y -= 22 * dt; if (t.life <= 0) t.on = false; }
}
export function clearFx() { for (const p of parts) p.on = false; for (const t of texts) t.on = false; }
