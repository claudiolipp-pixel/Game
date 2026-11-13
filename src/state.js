// Globaler, veränderlicher Spielzustand (Singleton), von allen Modulen geteilt.
export const G = {
  mode: 'menu',        // menu | play | dead
  paused: true,
  seed: 1,
  clock: 0,            // gesamte Spielzeit in Sekunden (inkl. Start-Offset)
  dayLen: 480,
  player: null,
  inv: null,
  drops: [],
  flashT: 0,
  stats: null,
  bp: {},              // freigeschaltete Baupläne
  build: null,         // aktiver Platzierungsmodus
  tick: 0,
  shake: 0,
  // Umweltwerte (von world/time.js gesetzt)
  env: { day: 0, year: 0, season: 0, hour: 12, dark: 0, sight: 1, hear: 1, zSpeed: 1, weather: 'clear', temp: 15, bloodMoon: false, raining: false, snow: 0, shAng: 1.2, shLen: 1, shA: 0.3 },
};
