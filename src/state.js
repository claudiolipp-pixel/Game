// Globaler, veränderlicher Spielzustand (Singleton), von allen Modulen geteilt.
export const G = {
  mode: 'menu',        // menu | play | dead
  paused: true,
  seed: 1,
  clock: 0,            // gesamte Spielzeit in Sekunden (inkl. Start-Offset)
  dayLen: 480,
  player: null,
  stats: null,
  bp: {},              // freigeschaltete Baupläne
  build: null,         // aktiver Platzierungsmodus
  tick: 0,
  shake: 0,
};
