// Zentrale Balancing-Datei – alle Spielwerte an einem Ort.
export const CFG = {
  TILE: 32,            // Welt-Einheiten pro Kachel
  CHUNK: 16,           // Kacheln pro Chunk-Kante
  VIEW_H: 430,         // sichtbare Welt-Höhe in Einheiten (Zoom)
  LOAD_R: 3,           // Chunk-Laderadius
  DAY_LEN: 480,        // Sekunden pro Spieltag (Standard, in Einstellungen änderbar)
  START_HOUR: 7,
  SEASON_DAYS: 7,
  BLOODMOON_EVERY: 10,
  AUTOSAVE: 60,
  MAX_ZOMBIES: 240,

  player: {
    r: 9, walk: 86, sprint: 142, sneak: 44,
    staminaDrain: 20, staminaRegen: 13,
    pickup: 26, reach: 46,
    baseSlots: 12, baseWeight: 25,
  },

  survival: {
    hungerPerDay: 60,        // Punkte pro Spieltag
    thirstPerDay: 85,
    sprintHunger: 1.6,       // Multiplikator beim Sprinten
    heatThirst: 2.0,         // Sommer-Hitze / Hitzewelle
    starveDmg: 3.0,          // HP pro Sekunde bei 0 (wird auf Tageslänge normiert: pro 8 s)
    regenPerSec: 0.45,       // HP-Regeneration wenn satt
    infectChance: 0.10,      // pro Biss
    infectPerDay: 55,        // Infektionsfortschritt pro Tag (100 = Tod)
    coldDmgTemp: 35, heatDmgTemp: 39.3,
    spoil: [1.0, 1.9, 1.0, 0.3], // Verderb-Multiplikator je Jahreszeit
  },

  // Jahreszeiten: 0 Frühling, 1 Sommer, 2 Herbst, 3 Winter
  seasons: [
    { name: 'Frühling', sunrise: 6.0, sunset: 19.5, tempDay: 14, tempNight: 5,  zSpeed: 1.0, zCount: 1.0 },
    { name: 'Sommer',   sunrise: 4.8, sunset: 21.5, tempDay: 29, tempNight: 16, zSpeed: 1.0, zCount: 1.3 },
    { name: 'Herbst',   sunrise: 7.0, sunset: 18.0, tempDay: 10, tempNight: 2,  zSpeed: 1.0, zCount: 1.1 },
    { name: 'Winter',   sunrise: 8.2, sunset: 16.4, tempDay: -4, tempNight: -14, zSpeed: 0.75, zCount: 0.9 },
  ],
  // Wetter-Wahrscheinlichkeiten je Jahreszeit
  weather: {
    table: [
      { clear: 5, rain: 4, storm: 1, fog: 1 },
      { clear: 5, rain: 1, storm: 2.5, heat: 3 },
      { clear: 3, rain: 3, fog: 4, storm: 1 },
      { clear: 3, snow: 5, blizzard: 2, fog: 1 },
    ],
    minDur: 70, maxDur: 190,       // Sekunden bei 480-s-Tag
    temp:   { clear: 0, rain: -3, storm: -4, fog: -2, snow: -3, blizzard: -10, heat: 8 },
    sight:  { clear: 1, rain: 0.9, storm: 0.8, fog: 0.5, snow: 0.85, blizzard: 0.45, heat: 1 },
    hear:   { clear: 1, rain: 0.8, storm: 0.6, fog: 1, snow: 0.9, blizzard: 0.5, heat: 1 },
    names:  { clear: 'Klar', rain: 'Regen', storm: 'Gewitter', fog: 'Nebel', snow: 'Schnee', blizzard: 'Blizzard', heat: 'Hitzewelle' },
  },

  zombies: {
    baseCount: 7, perDay: 0.9, maxAmbient: 70, nightMult: 1.7,
    hpPerDay: 0.03, yearMult: 0.35,          // jedes Jahr schwerer
    spawnMin: 420, spawnMax: 640, despawn: 1100,
    sight: 190, sightNight: 95, sneakMult: 0.45, sprintMult: 1.25,
    hordeBase: 7, hordePerDay: 0.55, hordeWave: 22, hordeMax: 26,
    frostChance: 0.45,
  },

  noise: { shot: 1, sprint: 130, walk: 0, glass: 260, generator: 330, lure: 430, alarm: 0, thunder: 0 },

  build: { upgHp: [1, 1.8, 3], upgDmg: [1, 1.3, 1.7], upgCost: [null, { scrap: 4 }, { scrap: 8, elec: 1 }],
    repairPerScrap: 60, turretScan: 0.2, powerRange: 6 },
};

// Zombie-Typen
export const ZT = {
  walker:   { n: 'Walker',   sp: 36, hp: 50,  dmg: 10, r: 9,  cd: 1.0, sdmg: 8,  minDay: 0,  w: 10, col: '#6f8a55', sz: 1 },
  runner:   { n: 'Runner',   sp: 98, hp: 26,  dmg: 7,  r: 8,  cd: 0.7, sdmg: 4,  minDay: 3,  w: 4,  col: '#a08a4a', sz: 0.9 },
  crawler:  { n: 'Crawler',  sp: 30, hp: 30,  dmg: 9,  r: 7,  cd: 1.0, sdmg: 4,  minDay: 5,  w: 3,  col: '#4a5540', sz: 0.75, stealth: 0.5, infect: 2 },
  screamer: { n: 'Screamer', sp: 52, hp: 38,  dmg: 6,  r: 9,  cd: 1.2, sdmg: 4,  minDay: 8,  w: 2,  col: '#b0b5c0', sz: 1, scream: 560 },
  brute:    { n: 'Brute',    sp: 30, hp: 280, dmg: 26, r: 14, cd: 1.5, sdmg: 30, minDay: 12, w: 1.2, col: '#7a4a4a', sz: 1.6, heavy: true },
};
export const ZKEYS = Object.keys(ZT);
// Wildtiere (teilen sich den Zombie-Pool; liefern rohes Fleisch). Anzahl je Jahreszeit – im Herbst ziehen Herden.
ZT.deer = { n: 'Reh', sp: 118, hp: 34, dmg: 0, r: 9, cd: 1, sdmg: 0, minDay: 1e9, w: 0, col: '#8a6a44', sz: 1.05, animal: true, meat: 3 };
ZT.rabbit = { n: 'Hase', sp: 135, hp: 8, dmg: 0, r: 5, cd: 1, sdmg: 0, minDay: 1e9, w: 0, col: '#b8a890', sz: 0.6, animal: true, meat: 1 };
export const ANIMALS = { count: [5, 5, 9, 1], flee: 125, fleeSneak: 55 };

// Gegenstände. t = Typ, w = Gewicht (kg), st = Stapelgröße
export const ITEMS = {
  wood:   { n: 'Holz', t: 'res', w: 0.5, st: 20 },
  stone:  { n: 'Stein', t: 'res', w: 0.6, st: 20 },
  scrap:  { n: 'Metallschrott', t: 'res', w: 0.5, st: 20 },
  cloth:  { n: 'Stoff', t: 'res', w: 0.1, st: 20 },
  fuel:   { n: 'Benzin', t: 'res', w: 0.5, st: 10 },
  elec:   { n: 'Elektroteile', t: 'res', w: 0.2, st: 10 },
  powder: { n: 'Schwarzpulver', t: 'res', w: 0.2, st: 10 },
  seeds:  { n: 'Saatgut', t: 'res', w: 0.05, st: 20 },

  ammo9:  { n: '9-mm-Munition', t: 'ammo', w: 0.02, st: 60 },
  shells: { n: 'Schrotpatronen', t: 'ammo', w: 0.05, st: 30 },
  ammoR:  { n: 'Gewehrmunition', t: 'ammo', w: 0.03, st: 60 },
  arrow:  { n: 'Pfeile', t: 'ammo', w: 0.05, st: 30 },
  bolt:   { n: 'Bolzen', t: 'ammo', w: 0.05, st: 40 },

  can:     { n: 'Konserve', t: 'food', w: 0.4, st: 8, food: 35, water: 5 },
  berries: { n: 'Beeren', t: 'food', w: 0.1, st: 12, food: 9, water: 5, spoil: 2 },
  rawmeat: { n: 'Rohes Fleisch', t: 'food', w: 0.4, st: 6, food: 14, sick: 0.5, spoil: 1.5, cook: 'meat' },
  meat:    { n: 'Gebratenes Fleisch', t: 'food', w: 0.35, st: 6, food: 42, spoil: 3 },
  veg:     { n: 'Gemüse', t: 'food', w: 0.25, st: 10, food: 18, water: 8, spoil: 4 },
  rotten:  { n: 'Verdorbenes Essen', t: 'food', w: 0.3, st: 10, food: 6, sick: 0.8 },
  bottle:  { n: 'Leere Flasche', t: 'misc', w: 0.1, st: 6 },
  dwater:  { n: 'Schmutziges Wasser', t: 'food', w: 0.6, st: 6, water: 32, sick: 0.45, cook: 'water', ret: 'bottle' },
  water:   { n: 'Sauberes Wasser', t: 'food', w: 0.6, st: 6, water: 48, ret: 'bottle' },

  bandage: { n: 'Verband', t: 'med', w: 0.1, st: 8, heal: 28 },
  medkit:  { n: 'Erste-Hilfe-Set', t: 'med', w: 0.5, st: 3, heal: 70 },
  antibio: { n: 'Antibiotika', t: 'med', w: 0.1, st: 4, cure: true },

  knife:   { n: 'Messer', t: 'melee', w: 0.3, dmg: 18, cd: 0.33, range: 30, arc: 0.9, dur: 90, kb: 30 },
  bat:     { n: 'Baseballschläger', t: 'melee', w: 1.0, dmg: 24, cd: 0.5, range: 40, arc: 1.3, dur: 110, kb: 110 },
  crowbar: { n: 'Brechstange', t: 'melee', w: 1.5, dmg: 30, cd: 0.6, range: 40, arc: 1.1, dur: 180, kb: 80 },
  axe:     { n: 'Axt', t: 'melee', w: 1.6, dmg: 38, cd: 0.7, range: 38, arc: 1.1, dur: 130, kb: 70, chop: 3 },

  pistol:  { n: 'Pistole', t: 'gun', w: 0.9, dmg: 34, cd: 0.28, mag: 12, reload: 1.4, ammo: 'ammo9', noise: 520, speed: 620, spread: 0.04, pellets: 1 },
  shotgun: { n: 'Schrotflinte', t: 'gun', w: 3.2, dmg: 17, cd: 0.85, mag: 4, reload: 2.4, ammo: 'shells', noise: 720, speed: 520, spread: 0.24, pellets: 6, life: 0.4 },
  rifle:   { n: 'Gewehr', t: 'gun', w: 3.8, dmg: 85, cd: 0.9, mag: 5, reload: 2.2, ammo: 'ammoR', noise: 820, speed: 900, spread: 0.01, pellets: 1, pierce: 2 },
  bow:     { n: 'Bogen', t: 'gun', w: 0.8, dmg: 42, cd: 0.85, mag: 1, reload: 0, ammo: 'arrow', noise: 40, speed: 420, spread: 0.03, pellets: 1, silent: true },

  torch:   { n: 'Fackel', t: 'light', w: 0.4, st: 5, burn: 200 },

  jacket:  { n: 'Jacke', t: 'cloth', w: 1.0, warm: 5, armor: 0.10 },
  coat:    { n: 'Wintermantel', t: 'cloth', w: 2.0, warm: 11, armor: 0.15 },
  vest:    { n: 'Schutzweste', t: 'cloth', w: 2.5, warm: 2, armor: 0.40 },
  shirt:   { n: 'Leichtes Hemd', t: 'cloth', w: 0.2, warm: -3, armor: 0 },

  pack1:   { n: 'Rucksack', t: 'pack', w: 0.5, slots: 6, carry: 12 },
  pack2:   { n: 'Wanderrucksack', t: 'pack', w: 0.8, slots: 12, carry: 25 },

  bp_xbow:  { n: 'Bauplan: Armbrust-Turm', t: 'bp', w: 0.05, bp: 'xbow' },
  bp_sgtrap:{ n: 'Bauplan: Selbstschuss-Anlage', t: 'bp', w: 0.05, bp: 'sgtrap' },
  bp_flamer:{ n: 'Bauplan: Flammenwerfer-Turm', t: 'bp', w: 0.05, bp: 'flamer' },
  bp_mg:    { n: 'Bauplan: MG-Nest', t: 'bp', w: 0.05, bp: 'mg' },
  bp_power: { n: 'Bauplan: Generator & Stromzaun', t: 'bp', w: 0.05, bp: 'power' },
  bp_bomb:  { n: 'Bauplan: Sprengfalle', t: 'bp', w: 0.05, bp: 'bomb' },
};
export const FISTS = { n: 'Fäuste', t: 'melee', dmg: 7, cd: 0.4, range: 26, arc: 0.9, kb: 40 };

// Crafting-Rezepte (Gegenstände)
export const RECIPES = [
  { out: 'bandage', n: 1, cost: { cloth: 2 } },
  { out: 'torch', n: 1, cost: { wood: 1, cloth: 1 } },
  { out: 'arrow', n: 4, cost: { wood: 1, stone: 1 } },
  { out: 'bolt', n: 4, cost: { wood: 1, scrap: 1 } },
  { out: 'knife', n: 1, cost: { scrap: 2, wood: 1 } },
  { out: 'bat', n: 1, cost: { wood: 3 } },
  { out: 'axe', n: 1, cost: { wood: 2, stone: 2, scrap: 1 } },
  { out: 'bow', n: 1, cost: { wood: 3, cloth: 2 } },
  { out: 'jacket', n: 1, cost: { cloth: 5 } },
  { out: 'coat', n: 1, cost: { cloth: 10 } },
  { out: 'pack1', n: 1, cost: { cloth: 6 } },
  { out: 'seeds', n: 2, cost: { veg: 1 } },
  { out: 'ammo9', n: 6, cost: { scrap: 1, powder: 1 } },
  { out: 'shells', n: 4, cost: { scrap: 1, powder: 1 } },
  { out: 'ammoR', n: 4, cost: { scrap: 1, powder: 1 } },
  { out: 'medkit', n: 1, cost: { bandage: 2, cloth: 1 } },
];

// Bauobjekte. cat: base | trap | gun.  block = blockiert Zombies, pblock = blockiert Spieler
export const BUILD = {
  wall_w:    { n: 'Holzwand', cat: 'base', cost: { wood: 4 }, hp: 160, block: 1, pblock: 1, d: 'Solide Holzwand.' },
  wall_s:    { n: 'Steinwand', cat: 'base', cost: { stone: 6 }, hp: 380, block: 1, pblock: 1, d: 'Hält deutlich mehr aus.' },
  door:      { n: 'Tür', cat: 'base', cost: { wood: 4, scrap: 1 }, hp: 130, block: 1, pblock: 0, d: 'Du kommst durch, Zombies nicht.' },
  barricade: { n: 'Barrikade', cat: 'base', cost: { wood: 2 }, hp: 75, block: 1, pblock: 1, d: 'Billig, hält nicht lange.' },
  campfire:  { n: 'Lagerfeuer', cat: 'base', cost: { wood: 3, stone: 3 }, hp: 60, light: 150, warm: 1, d: 'Licht, Wärme, Kochen, Wasser abkochen.' },
  collector: { n: 'Regensammler', cat: 'base', cost: { wood: 3, cloth: 2, scrap: 1 }, hp: 50, block: 1, pblock: 1, cap: 5, d: 'Sammelt bei Regen sauberes Wasser.' },
  plot:      { n: 'Beet', cat: 'base', cost: { wood: 2, seeds: 1 }, hp: 30, grow: 2.5, d: 'Anbau nur im Frühling/Sommer.' },
  chest:     { n: 'Kiste', cat: 'base', cost: { wood: 6 }, hp: 110, block: 1, pblock: 1, slots: 12, d: 'Lager. Versorgt angrenzende Türme mit Munition.' },
  bed:       { n: 'Bett', cat: 'base', cost: { wood: 4, cloth: 4 }, hp: 60, d: 'Schlafen: Zeit überspringen + speichern.' },

  spikes:    { n: 'Stachelgrube', cat: 'trap', cost: { wood: 3, stone: 2 }, hp: 420, trap: 1, dps: 13, slow: 0.4, d: 'Verlangsamt + Schaden. Nutzt sich ab.' },
  beartrap:  { n: 'Bärenfalle', cat: 'trap', cost: { scrap: 3 }, hp: 8, trap: 1, hold: 9, dmg: 28, d: 'Hält einen Zombie fest (keine Brutes). Neu spannen!' },
  wire:      { n: 'Stacheldraht', cat: 'trap', cost: { scrap: 2, wood: 1 }, hp: 300, trap: 1, dps: 6, slow: 0.5, d: 'Verlangsamt, Schaden pro Sekunde.' },
  tripwire:  { n: 'Stolperdraht + Dosen', cat: 'trap', cost: { cloth: 1, scrap: 1 }, hp: 20, trap: 1, d: 'Alarm, der dich warnt und weckt.' },
  lure:      { n: 'Lärmköder', cat: 'trap', cost: { elec: 1, scrap: 1 }, hp: 40, dur: 75, d: 'Wecker/Radio: lockt Zombies an (einschalten).' },
  gas:       { n: 'Benzinpfütze', cat: 'trap', cost: { fuel: 2, cloth: 1 }, hp: 10, trap: 1, burn: 9, dps: 32, rad: 58, d: 'Per Schuss/Fackel entzünden. Im Regen unwirksam.' },
  bomb:      { n: 'Sprengfalle', cat: 'trap', cost: { scrap: 3, powder: 3, elec: 1 }, hp: 10, trap: 1, bp: 'bomb', dmg: 240, rad: 92, noise: 900, d: 'Rohrbombe + Stolperdraht. Sehr laut.' },

  spikewall: { n: 'Speerwall', cat: 'gun', cost: { wood: 5 }, hp: 190, block: 1, pblock: 1, thorns: 11, d: 'Blockiert und verletzt Angreifer.' },
  xbow:      { n: 'Armbrust-Turm', cat: 'gun', cost: { wood: 6, scrap: 4, cloth: 2 }, hp: 140, block: 1, pblock: 1, bp: 'xbow', turret: 1, range: 215, dmg: 32, reload: 1.25, ammo: 'bolt', cap: 40, d: 'Automatisch, lautlos, braucht Bolzen.' },
  sgtrap:    { n: 'Selbstschuss-Anlage', cat: 'gun', cost: { scrap: 8, wood: 3, elec: 1 }, hp: 120, block: 1, pblock: 1, bp: 'sgtrap', turret: 1, dir: 1, range: 120, dmg: 20, pellets: 6, reload: 2.4, ammo: 'shells', cap: 12, noise: 620, d: 'Schrotflinte am Stolperdraht. Stark, laut, gerichtet.' },
  flamer:    { n: 'Flammenwerfer-Turm', cat: 'gun', cost: { scrap: 8, elec: 2, fuel: 2 }, hp: 150, block: 1, pblock: 1, bp: 'flamer', turret: 1, range: 115, dps: 48, ammo: 'fuel', cap: 20, use: 1.4, d: 'Braucht Benzin. Bonus gegen Frost-Zombies.' },
  mg:        { n: 'MG-Nest', cat: 'gun', cost: { scrap: 10, wood: 4 }, hp: 220, block: 1, pblock: 1, bp: 'mg', dmg: 30, cd: 0.085, ammo: 'ammoR', d: 'Selbst bemannen. Frisst Gewehrmunition.' },
  gen:       { n: 'Generator', cat: 'gun', cost: { scrap: 8, elec: 3 }, hp: 130, block: 1, pblock: 1, bp: 'power', ammo: 'fuel', cap: 10, use: 45, d: 'Versorgt Stromzäune. Erzeugt dauerhaft Lärm.' },
  fence:     { n: 'Stromzaun', cat: 'gun', cost: { scrap: 4, elec: 1 }, hp: 210, block: 1, pblock: 1, bp: 'power', zap: 13, d: 'Braucht laufenden Generator in der Nähe.' },
};

// Loot-Tabellen: [item, gewicht, min, max]
export const LOOT = {
  house: [['can', 8, 1, 2], ['cloth', 8, 1, 3], ['bottle', 5, 1, 1], ['water', 4, 1, 1], ['bandage', 4, 1, 2], ['knife', 2, 1, 1], ['bat', 2, 1, 1], ['jacket', 2, 1, 1],
    ['shirt', 1.5, 1, 1], ['pack1', 1.2, 1, 1], ['seeds', 3, 1, 3], ['wood', 4, 1, 3], ['elec', 2, 1, 1], ['antibio', 0.6, 1, 1], ['torch', 2, 1, 1], ['ammo9', 1, 3, 8], ['coat', 0.8, 1, 1]],
  market: [['can', 14, 1, 3], ['water', 8, 1, 2], ['bottle', 5, 1, 2], ['veg', 3, 1, 2], ['bandage', 3, 1, 1], ['cloth', 3, 1, 2], ['seeds', 3, 2, 4], ['antibio', 0.8, 1, 1], ['pack1', 1, 1, 1]],
  hardware: [['wood', 8, 2, 5], ['scrap', 10, 2, 4], ['stone', 4, 2, 4], ['elec', 6, 1, 2], ['axe', 2.5, 1, 1], ['crowbar', 3, 1, 1], ['fuel', 4, 1, 2], ['cloth', 3, 1, 3],
    ['bp_xbow', 1.6, 1, 1], ['bp_sgtrap', 1.0, 1, 1], ['bp_power', 1.0, 1, 1], ['powder', 2, 1, 2], ['pack2', 0.8, 1, 1]],
  police: [['ammo9', 10, 5, 12], ['shells', 6, 3, 6], ['pistol', 3, 1, 1], ['shotgun', 1.6, 1, 1], ['vest', 1.6, 1, 1], ['bandage', 4, 1, 2], ['medkit', 1.5, 1, 1],
    ['bp_sgtrap', 1.4, 1, 1], ['bp_xbow', 1.0, 1, 1], ['bp_bomb', 0.8, 1, 1], ['powder', 3, 1, 2], ['antibio', 1, 1, 1]],
  gas: [['fuel', 14, 1, 3], ['scrap', 6, 1, 3], ['can', 4, 1, 1], ['water', 4, 1, 1], ['elec', 4, 1, 2], ['bottle', 3, 1, 1], ['crowbar', 1.5, 1, 1], ['torch', 2, 1, 2]],
  military: [['ammoR', 10, 5, 12], ['ammo9', 6, 6, 12], ['shells', 4, 3, 6], ['rifle', 2.5, 1, 1], ['pistol', 1.5, 1, 1], ['vest', 2, 1, 1], ['medkit', 3, 1, 1], ['antibio', 2, 1, 1],
    ['powder', 5, 1, 3], ['bp_mg', 1.8, 1, 1], ['bp_flamer', 1.6, 1, 1], ['bp_bomb', 1.6, 1, 1], ['bp_power', 1.2, 1, 1], ['can', 4, 1, 3], ['pack2', 1, 1, 1], ['fuel', 3, 1, 2]],
  farm: [['veg', 8, 1, 3], ['seeds', 8, 2, 4], ['wood', 5, 2, 4], ['can', 3, 1, 1], ['axe', 2, 1, 1], ['cloth', 3, 1, 2], ['bow', 1.2, 1, 1], ['arrow', 2, 3, 6], ['fuel', 2, 1, 1], ['bottle', 3, 1, 1], ['rawmeat', 2, 1, 2]],
  zombie: [['cloth', 6, 1, 1], ['scrap', 3, 1, 1], ['ammo9', 1.5, 1, 4], ['can', 1, 1, 1], ['bandage', 1, 1, 1], ['bottle', 1, 1, 1]],
};
export const BLD_NAMES = { house: 'Haus', market: 'Supermarkt', hardware: 'Baumarkt', police: 'Polizeistation', gas: 'Tankstelle', military: 'Militärposten', farm: 'Bauernhof' };
