// Platzierungsmodus: Raster-Vorschau (grün/rot), Drehen, Platzieren.
import { G } from '../state.js';
import { BUILD } from '../config.js';
import { input } from '../core/input.js';
import { T } from '../world/world.js';
import { canPlace, placeStruct } from './structures.js';
import { hasCost, payCost } from '../systems/inventory.js';
import { sfx } from '../audio/audio.js';
import { toast } from '../ui/hud.js';
import { burst } from '../entities/fx.js';

export function startBuild(id) { G.build = { id, rot: 0, tx: 0, ty: 0, ok: false }; document.getElementById('buildbar').classList.remove('hidden'); toast(BUILD[id].n + ': Position mit dem Ziel-Stick wählen, dann ✔ Platzieren.'); }
export function stopBuild() { G.build = null; document.getElementById('buildbar').classList.add('hidden'); }
export function updateBuild() {
  const b = G.build; if (!b) return;
  const p = G.player, a = input.act, def = BUILD[b.id];
  b.tx = Math.floor((p.x + Math.cos(p.ang) * 40) / T); b.ty = Math.floor((p.y + Math.sin(p.ang) * 40) / T);
  b.ok = canPlace(b.id, b.tx, b.ty) && hasCost(def.cost);
  if (a.rotate) { b.rot = (b.rot + 1) % 4; sfx('click'); }
  if (a.cancel || a.build) { stopBuild(); return; }
  if (a.place || a.interact) {
    if (!b.ok) { sfx('deny'); if (!hasCost(def.cost)) { toast('Nicht genug Material.', true); stopBuild(); } return; }
    payCost(def.cost); placeStruct(b.id, b.tx, b.ty, b.rot);
    sfx('build'); burst((b.tx + 0.5) * T, (b.ty + 0.5) * T, 6, '#c9a070', 70, 0.3, 2);
    if (!hasCost(def.cost)) stopBuild();
  }
}
