// Lärm-System: Geräusche locken Zombies an.
import { G } from '../state.js';
import { Z } from '../entities/zombies.js';
export function emitNoise(x, y, radius) {
  const r = radius * G.env.hear; if (r <= 0) return;
  const r2 = r * r, l = Z.list;
  for (let i = 0; i < l.length; i++) {
    const z = l[i]; if (!z.alive || z.state === 2) continue;
    const dx = z.x - x, dy = z.y - y;
    if (dx * dx + dy * dy < r2) { z.state = 1; z.tx = x + (Math.random() - 0.5) * 40; z.ty = y + (Math.random() - 0.5) * 40; }
  }
}
