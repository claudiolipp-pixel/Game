// Meilenstein-1-Platzhalter: leere Welt ohne Kollision (wird in Meilenstein 2 ersetzt).
export function initWorld() {}
export function updateWorld() {}
export function moveCircle(e, dx, dy) { e.x += dx; e.y += dy; return 0; }
export function drawGround(ctx, v) {
  const s = v.scale, T = 32;
  const x0 = Math.floor((v.camX - v.w / 2 / s) / T), x1 = Math.ceil((v.camX + v.w / 2 / s) / T);
  const y0 = Math.floor((v.camY - v.h / 2 / s) / T), y1 = Math.ceil((v.camY + v.h / 2 / s) / T);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    ctx.fillStyle = ((x + y) & 1) ? '#5d8f3e' : '#548636';
    ctx.fillRect(Math.round(x * T * s + v.tx), Math.round(y * T * s + v.ty), Math.ceil(T * s), Math.ceil(T * s));
  }
}
