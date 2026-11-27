// Gobble Run — every tuning number, colour and zone in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to
// the window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720, groundY: 620 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** How far, in metres, the turkey must run to reach the forest and escape. */
export const ESCAPE_DISTANCE = 600;
/** World pixels per metre of distance shown on the HUD. */
export const PX_PER_METRE = 50;

export const TURKEY = {
  x: 230,
  width: 72,
  height: 64,
  slideHeight: 34,
  jumpVelocity: 1020,
  gravity: 2500,
  /** Seconds of mercy after a hit, while the turkey blinks. */
  invulnerable: 1.2,
};

export const LIVES = 3;

/** The farmer starts this far behind the turkey, in pixels. */
export const FARMER = {
  startGap: 220,
  maxGap: 460,
  /** Pixels the farmer gains on the turkey every second, before bonuses. */
  creep: 5,
  /** Seconds the farmer stands still, searching, after the turkey hides. */
  searchTime: 1.6,
  /** How often the farmer hurls a carving knife, in seconds. */
  throwInterval: 4.0,
  throwIntervalKitchen: 2.8,
};

/** Scroll speed of the world, in pixels per second. */
export const SPEED = { base: 380, perSecond: 6, max: 640 };

export const DASH = {
  /** How long a dash lasts, and how much faster the world scrolls in it. */
  time: 0.35,
  multiplier: 1.6,
  /** Seconds before the next dash is ready. */
  cooldown: 1.4,
};

export const SCORE = {
  corn: 10,
  feather: 25,
  hide: 15,
  /** Points per metre run. */
  perMetre: 1,
};

/** Zone boundaries, in metres: farmyard, then cornfield, then the kitchen. */
export const ZONES = [
  { name: 'Farmyard', until: 200 },
  { name: 'Cornfield', until: 400 },
  { name: 'Kitchen', until: ESCAPE_DISTANCE },
];

/** Spawn spacing, in world pixels, between one hazard and the next. */
export const SPAWN = { minGap: 360, jitter: 200 };

export const PALETTE = {
  backdrop: '#241a12',
  text: '#fff6e6',
  muted: '#e8cfa8',
  panel: '#2e2118',
  panelEdge: '#f2a541',
  heart: '#e5534b',
  heartEmpty: '#5a4030',
  // Farmyard: a crisp Thanksgiving morning.
  farmyard: {
    skyTop: '#ffd9a0', skyBottom: '#ff9e6d', sun: '#fff3c4',
    hillFar: '#c98f4e', hillNear: '#a86f35', ground: '#7d5230', groundTop: '#b07a45',
    barn: '#a63d2f', barnRoof: '#7c2d22', fence: '#8a5a2e', corn: '#e9b949',
  },
  // Cornfield: golden stalks under a deeper sky.
  cornfield: {
    skyTop: '#ffe9a8', skyBottom: '#f08a4b', sun: '#fff8d0',
    hillFar: '#b57e2e', hillNear: '#8f5f1e', ground: '#6b4423', groundTop: '#96683a',
    barn: '#8f3a28', barnRoof: '#6e2a1d', fence: '#7a4e24', corn: '#f2c94c',
  },
  // Kitchen: warm tiles, a glowing oven, hanging pans.
  kitchen: {
    skyTop: '#8a4a2b', skyBottom: '#5d2f1d', sun: '#ffd27a',
    hillFar: '#6e3a22', hillNear: '#54301e', ground: '#4a2c1c', groundTop: '#7a4a2e',
    barn: '#7c3226', barnRoof: '#57231a', fence: '#6b4423', corn: '#f2c94c',
  },
  turkeyBody: '#8a5230',
  turkeyDark: '#6b3d22',
  turkeyTail: ['#a0522d', '#d2691e', '#e8a33c'],
  turkeyHead: '#f4ead8',
  turkeyBeak: '#f2a541',
  turkeyWattle: '#e5534b',
  turkeyLeg: '#e8a33c',
  farmerShirt: '#3e6b8e',
  farmerOveralls: '#2f4d6b',
  farmerSkin: '#e8b98a',
  farmerHat: '#d9a441',
  knifeBlade: '#dfe5ec',
  knifeHandle: '#4a3220',
  ovenBody: '#3a3f47',
  ovenGlow: '#ff7a2a',
  ovenFire: ['#ffcf4d', '#ff8a2a', '#e5534b'],
  hay: '#e9c46a',
  hayDark: '#c9a227',
  pumpkin: '#e8710a',
  pumpkinStem: '#4e7a2e',
  cornCob: '#f2c94c',
  cornHusk: '#5da24a',
  feather: '#f6d365',
  warning: '#ff5a3c',
};

/** System font stack: no font is ever fetched, so the game loads nothing. */
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'gobble-run.best';
