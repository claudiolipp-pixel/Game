// Fixed-Timestep-Loop: 60 Hz Logik, interpoliertes Rendering.
export const STEP = 1 / 60;
export function startLoop(update, render) {
  let acc = 0, last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 4) { update(STEP); acc -= STEP; n++; }
    if (acc >= STEP) acc = 0;           // Spirale des Todes vermeiden
    render(acc / STEP, dt);
  }
  requestAnimationFrame(frame);
}
