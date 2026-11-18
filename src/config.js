// ============================================================
//  SKYFALL — configuration: blocks, weapons, mobs, waves, loot
// ============================================================

export const WORLD_SIZE = { x: 256, y: 80, z: 256 };
export const ISLAND_CENTER = { x: 128, z: 128 };
export const CHUNK = 16;

/* ------------------------------------------------------------------
   Per-run world styles: colours of terrain + sky design
------------------------------------------------------------------ */
export const WORLD_PALETTES = [
  {
    name: 'ИЗУМРУДНЫЙ',
    tints: {
      grass: [0.72, 1.12, 0.68], stone: [0.9, 0.98, 0.92], wood: [1.0, 0.94, 0.82],
      sand: [0.98, 0.98, 0.82], metal: [0.9, 1.0, 1.02], infected: [0.85, 1.25, 0.7],
    },
  },
  {
    name: 'ОСЕННИЙ',
    tints: {
      grass: [1.32, 0.88, 0.4], stone: [1.04, 0.92, 0.78], wood: [1.16, 0.82, 0.6],
      sand: [1.12, 0.98, 0.7], metal: [1.0, 0.94, 0.82], infected: [1.2, 1.0, 0.6],
    },
  },
  {
    name: 'ПЕПЕЛЬНЫЙ',
    tints: {
      grass: [0.86, 0.86, 0.92], stone: [0.72, 0.74, 0.84], wood: [0.8, 0.78, 0.84],
      sand: [0.88, 0.88, 0.92], metal: [0.86, 0.9, 0.98], infected: [0.8, 1.05, 0.9],
    },
  },
  {
    name: 'БАГРОВЫЙ',
    tints: {
      grass: [1.26, 0.68, 0.66], stone: [1.08, 0.78, 0.78], wood: [1.18, 0.74, 0.68],
      sand: [1.2, 0.86, 0.74], metal: [1.04, 0.8, 0.84], infected: [1.12, 0.86, 0.86],
    },
  },
  {
    name: 'ЛЕДЯНОЙ',
    tints: {
      grass: [0.66, 0.98, 1.26], stone: [0.78, 0.94, 1.2], wood: [0.84, 0.94, 1.12],
      sand: [0.9, 1.02, 1.2], metal: [0.82, 0.98, 1.16], infected: [0.7, 1.15, 1.26],
    },
  },
  {
    name: 'АМЕТИСТОВЫЙ',
    tints: {
      grass: [0.9, 0.72, 1.3], stone: [0.86, 0.8, 1.12], wood: [0.96, 0.8, 1.16],
      sand: [1.0, 0.86, 1.16], metal: [0.88, 0.84, 1.2], infected: [0.9, 0.9, 1.34],
    },
  },
  {
    name: 'ЗОЛОТОЙ',
    tints: {
      grass: [1.18, 1.08, 0.56], stone: [1.06, 0.98, 0.78], wood: [1.14, 0.94, 0.66],
      sand: [1.18, 1.08, 0.72], metal: [1.06, 1.02, 0.82], infected: [1.1, 1.15, 0.66],
    },
  },
  {
    name: 'ЯДОВИТЫЙ',
    tints: {
      grass: [0.84, 1.18, 0.6], stone: [0.8, 1.02, 0.86], wood: [0.86, 1.0, 0.76],
      sand: [0.92, 1.08, 0.74], metal: [0.82, 1.06, 0.94], infected: [0.8, 1.32, 0.62],
    },
  },
];

export const SKY_THEMES = [
  {
    id: 'day', name: 'ЯСНЫЙ ДЕНЬ',
    top: 0x2f6fbf, mid: 0xa8d3ef, low: 0xe7f1fa, fog: 0xd2e5f6,
    light: 0xfff0d2, lightIntensity: 2.7, hemiSky: 0xd4eaff, hemiGround: 0x7d6c52, hemiIntensity: 1.55,
    sun: true, sunColor: 0xffd27a, sunSize: 105,
    moon: false, stars: false, meteors: false,
    cloud: 0xffffff, cloudEmissive: 0xbcd2e6, cloudOpacity: 0.9,
    zoneVolcano: 0xe8cbb6, zoneRad: 0xa8e08a,
  },
  {
    id: 'dusk', name: 'ЗАКАТ',
    top: 0x3b2a6b, mid: 0xd26a4a, low: 0xffd08a, fog: 0xdba07a,
    light: 0xffd0a8, lightIntensity: 2.2, hemiSky: 0xffc0a0, hemiGround: 0x6b5240, hemiIntensity: 1.3,
    sun: true, sunColor: 0xff9a4a, sunSize: 120,
    moon: false, stars: false, meteors: false,
    cloud: 0xffd0b0, cloudEmissive: 0xc07060, cloudOpacity: 0.8,
    zoneVolcano: 0xe2c4ae, zoneRad: 0xa8e08a,
  },
  {
    id: 'night', name: 'ЛУННАЯ НОЧЬ',
    top: 0x050b18, mid: 0x152a44, low: 0x40607e, fog: 0x1a2a42,
    light: 0x9fc4ff, lightIntensity: 1.35, hemiSky: 0x7f9fd0, hemiGround: 0x323844, hemiIntensity: 1.0,
    sun: false, sunColor: 0xffd27a, sunSize: 90,
    moon: true, moonColor: 0xdfe9ff, stars: true, meteors: false,
    cloud: 0x9fb4cc, cloudEmissive: 0x2c3e58, cloudOpacity: 0.55,
    zoneVolcano: 0xdcbda7, zoneRad: 0x9aff7a,
  },
  {
    id: 'meteor', name: 'ЗВЁЗДОПАД',
    top: 0x070d24, mid: 0x281d4a, low: 0x6b4a6f, fog: 0x241d38,
    light: 0xffd8c0, lightIntensity: 1.65, hemiSky: 0xc0a0e0, hemiGround: 0x38303e, hemiIntensity: 1.1,
    sun: false, sunColor: 0xffd27a, sunSize: 90,
    moon: true, moonColor: 0xffe0c0, stars: true, meteors: true,
    cloud: 0xb0a0c0, cloudEmissive: 0x4a3060, cloudOpacity: 0.6,
    zoneVolcano: 0xdcbda7, zoneRad: 0x9aff7a,
  },
  {
    id: 'blood', name: 'КРОВАВАЯ ЛУНА',
    top: 0x1a070d, mid: 0x4a1018, low: 0x8a3a2a, fog: 0x381216,
    light: 0xff9a7a, lightIntensity: 1.7, hemiSky: 0xd07a6a, hemiGround: 0x3a2020, hemiIntensity: 1.05,
    sun: false, sunColor: 0xff5a3c, sunSize: 100,
    moon: true, moonColor: 0xff5a3c, stars: true, meteors: true,
    cloud: 0xb06060, cloudEmissive: 0x5a2020, cloudOpacity: 0.7,
    zoneVolcano: 0xd8b7a1, zoneRad: 0xbaff6a,
  },
  {
    id: 'aurora', name: 'СЕВЕРНОЕ СИЯНИЕ',
    top: 0x04141c, mid: 0x0c3a4a, low: 0x2a7a7a, fog: 0x123238,
    light: 0x9fe8d8, lightIntensity: 1.35, hemiSky: 0x7ad0d0, hemiGround: 0x1c3034, hemiIntensity: 1.0,
    sun: false, sunColor: 0x9fe8d8, sunSize: 90,
    moon: true, moonColor: 0xbff0ff, stars: true, meteors: false,
    cloud: 0x8ac0c0, cloudEmissive: 0x1a4a50, cloudOpacity: 0.5,
    zoneVolcano: 0xdcbda7, zoneRad: 0x7affc0,
  },
  {
    id: 'overcast', name: 'ПАСМУРНО',
    top: 0x4a5a6e, mid: 0x8a98a8, low: 0xc0c8d0, fog: 0xaebac6,
    light: 0xe0e8f4, lightIntensity: 1.9, hemiSky: 0xc0d0e0, hemiGround: 0x606058, hemiIntensity: 1.4,
    sun: false, sunColor: 0xffd27a, sunSize: 90,
    moon: false, stars: false, meteors: false,
    cloud: 0xffffff, cloudEmissive: 0x808898, cloudOpacity: 1,
    zoneVolcano: 0xe8cbb6, zoneRad: 0xa8e08a,
  },
  {
    id: 'toxic', name: 'ЯДОВИТЫЙ РАССВЕТ',
    top: 0x1d3a2a, mid: 0x5a7a3a, low: 0xc0c070, fog: 0x8a9a5a,
    light: 0xe8f0a0, lightIntensity: 1.8, hemiSky: 0xc0e090, hemiGround: 0x4a5230, hemiIntensity: 1.2,
    sun: true, sunColor: 0xd8ff8a, sunSize: 95,
    moon: false, stars: false, meteors: false,
    cloud: 0xc8e0a0, cloudEmissive: 0x6a7a40, cloudOpacity: 0.8,
    zoneVolcano: 0xe2c4ae, zoneRad: 0x9aff6a,
  },
];

export const ZONE = { NORMAL: 0, VOLCANO: 1, RADIATION: 2 };
export const ZONE_NAMES = ['ОБЫЧНАЯ ЗОНА', 'ВУЛКАНИЧЕСКАЯ ЗОНА', 'ЗОНА РАДИАЦИИ'];
export const HAZARD = { magmaDps: 14, radiationDps: 9, tick: 0.5 };

/* ------------------------------------------------------------------
   Run modes and difficulty
------------------------------------------------------------------ */
export const RUN_MODES = {
  campaign: {
    id: 'campaign', name: 'КАМПАНИЯ', short: '3 ВОЛНЫ',
    tagline: 'Три штурма и финальный Титан. Классическая высадка.',
  },
  endless: {
    id: 'endless', name: 'БЕСКОНЕЧНЫЙ', short: '4 МИНУТЫ',
    tagline: 'Развивайте остров: каждые 4 минуты приходит группа из 8–12 мобов.',
  },
  sandbox: {
    id: 'sandbox', name: 'ПЕСОЧНИЦА', short: 'ВСЁ ОТКРЫТО',
    tagline: 'Все оружие, бесконечные патроны и блоки. Стройте без ограничений.',
  },
};

export const ENDLESS = {
  interval: 240,
  firstDelay: 240,
  minGroup: 8,
  maxGroup: 12,
};

export const DIFFICULTIES = [
  {
    id: 'easy', name: 'ЛЕГКО', short: 'ДЛЯ СТРОЙКИ',
    hp: 0.75, dmg: 0.7, speed: 0.92, coins: 0.85, drop: 0.85,
  },
  {
    id: 'normal', name: 'НОРМАЛЬНО', short: 'БАЛАНС',
    hp: 1, dmg: 1, speed: 1, coins: 1, drop: 1,
  },
  {
    id: 'hard', name: 'СЛОЖНО', short: '+30% HP',
    hp: 1.3, dmg: 1.28, speed: 1.06, coins: 1.2, drop: 1.1,
  },
  {
    id: 'nightmare', name: 'КОШМАР', short: 'ЖЕСТОКО',
    hp: 1.7, dmg: 1.6, speed: 1.15, coins: 1.45, drop: 1.25,
  },
];

export const DIFFICULTY_BY_ID = Object.fromEntries(DIFFICULTIES.map(d => [d.id, d]));

/* ------------------------------------------------------------------
   Gunsmith: weapon parts, paint, upgrades, airship, loot refresh
------------------------------------------------------------------ */
export const WEAPON_PARTS = {
  scope: {
    id: 'scope', name: 'ОПТИЧЕСКИЙ ПРИЦЕЛ', desc: '+45% зума и +15% дальности',
    color: 0x8ef0ff,
  },
  suppressor: {
    id: 'suppressor', name: 'ГЛУШИТЕЛЬ', desc: '−30% разброса и −20% отдачи',
    color: 0x5d6a78,
  },
  extmag: {
    id: 'extmag', name: 'РАСШИРЕННЫЙ МАГАЗИН', desc: '+60% ёмкости магазина',
    color: 0xffb144,
  },
};

export const WEAPON_PAINTS = [
  { id: 'stock', name: 'ЗАВОДСКАЯ', price: 0, color: null, accent: null },
  { id: 'graphite', name: 'ГРАФИТ', price: 40, color: 0x2b3038, accent: 0x8ef0ff },
  { id: 'bronze', name: 'БРОНЗА', price: 60, color: 0x8a5a33, accent: 0xffd24a },
  { id: 'crimson', name: 'БАГРЯНЕЦ', price: 80, color: 0x6a1f2a, accent: 0xff6a3c },
  { id: 'toxic', name: 'ТОКСИН', price: 100, color: 0x2a4a2a, accent: 0x9aff6a },
  { id: 'gold', name: 'ЗОЛОТО', price: 150, color: 0x7a5a1a, accent: 0xffd24a },
];

export const WEAPON_UPGRADE = {
  maxLevel: 5,
  costs: [60, 110, 180, 270, 380],
  damageStep: 0.1,
  reloadStep: 0.03,
};

export const AIRSHIP = {
  radius: 98,
  deckY: 56,
  raidRadius: 28,
  raidMobs: 26,
};

export const LOOT_REFRESH = 300; // seconds

/* Block ids */
export const B = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  BRICK: 4,
  LOG: 5,
  PLANKS: 6,
  METAL: 7,
  SAND: 8,
  OBSIDIAN: 9,
  LEAVES: 10,
  RUST: 11,
  BASALT: 12,
  MAGMA: 13,
  INF_GRASS: 14,
  INF_DIRT: 15,
  INF_STONE: 16,
  INF_BRICK: 17,
  INF_LOG: 18,
  INF_PLANKS: 19,
  INF_METAL: 20,
  INF_SAND: 21,
  INF_OBSIDIAN: 22,
  INF_LEAVES: 23,
  INF_RUST: 24,
  RED_BRICK: 25,
  HAY: 26,
  WIRE: 27,
};

export const BLOCKS = {
  [B.GRASS]:    { name: 'Трава',    tiles: { top: 'grass_top', side: 'grass_side', bottom: 'dirt' }, hardness: 0.30, color: '#6c9c42', drop: B.DIRT, tintKind: 'grass' },
  [B.DIRT]:     { name: 'Земля',    tiles: { all: 'dirt' }, hardness: 0.32, color: '#7a5a3d', tintKind: 'grass' },
  [B.STONE]:    { name: 'Камень',   tiles: { all: 'stone' }, hardness: 0.85, color: '#8a9099', tintKind: 'stone' },
  [B.BRICK]:    { name: 'Кирпич',   tiles: { all: 'brick' }, hardness: 1.15, color: '#8d949e', tintKind: 'stone' },
  [B.LOG]:      { name: 'Бревно',   tiles: { top: 'log_top', bottom: 'log_top', side: 'log_side' }, hardness: 0.65, color: '#7f5a33', tintKind: 'wood' },
  [B.PLANKS]:   { name: 'Доски',    tiles: { all: 'planks' }, hardness: 0.5, color: '#b98a52', tintKind: 'wood' },
  [B.METAL]:    { name: 'Сталь',    tiles: { all: 'metal' }, hardness: 1.7, color: '#7b8ea3', tintKind: 'metal' },
  [B.SAND]:     { name: 'Песок',    tiles: { all: 'sand' }, hardness: 0.28, color: '#d9c489', tintKind: 'sand' },
  [B.OBSIDIAN]: { name: 'Обсидиан', tiles: { all: 'obsidian' }, hardness: 2.4, color: '#241c33', tintKind: 'stone' },
  [B.LEAVES]:   { name: 'Листва',   tiles: { all: 'leaves' }, hardness: 0.2, color: '#396b2c', tintKind: 'grass' },
  [B.RUST]:     { name: 'Ржавчина', tiles: { all: 'rust' }, hardness: 0.95, color: '#8a5a3e', tintKind: 'wood' },

  /* volcanic zone */
  [B.BASALT]:   { name: 'Базальт',  tiles: { all: 'basalt' }, hardness: 1.0, color: '#3c3b46', drop: B.STONE, tintKind: 'stone' },
  [B.MAGMA]:    { name: 'Магма',    tiles: { all: 'magma' }, hardness: 1.2, color: '#ff6a2b', drop: B.OBSIDIAN, tintKind: 'stone', hazard: 'magma' },

  /* infected variants (radiation zone) */
  [B.INF_GRASS]:    { name: 'Заражённая трава', tiles: { top: 'grass_top', side: 'grass_side', bottom: 'dirt' }, hardness: 0.30, color: '#8fbf3a', drop: B.DIRT, tint: [0.92, 1.36, 0.62], tintKind: 'infected', infected: true },
  [B.INF_DIRT]:     { name: 'Заражённая земля', tiles: { all: 'dirt' }, hardness: 0.32, color: '#6f7a33', drop: B.DIRT, tint: [0.9, 1.3, 0.66], tintKind: 'infected', infected: true },
  [B.INF_STONE]:    { name: 'Заражённый камень', tiles: { all: 'stone' }, hardness: 0.85, color: '#6d8a65', drop: B.STONE, tint: [0.78, 1.22, 0.82], tintKind: 'infected', infected: true },
  [B.INF_BRICK]:    { name: 'Заражённый кирпич', tiles: { all: 'brick' }, hardness: 1.15, color: '#7d8a62', drop: B.BRICK, tint: [0.86, 1.18, 0.74], tintKind: 'infected', infected: true },
  [B.INF_LOG]:      { name: 'Заражённое бревно', tiles: { top: 'log_top', bottom: 'log_top', side: 'log_side' }, hardness: 0.65, color: '#6f7a3d', drop: B.LOG, tint: [0.88, 1.24, 0.7], tintKind: 'infected', infected: true },
  [B.INF_PLANKS]:   { name: 'Заражённые доски', tiles: { all: 'planks' }, hardness: 0.5, color: '#8a9452', drop: B.PLANKS, tint: [0.92, 1.2, 0.72], tintKind: 'infected', infected: true },
  [B.INF_METAL]:    { name: 'Заражённая сталь', tiles: { all: 'metal' }, hardness: 1.7, color: '#6a8f82', drop: B.METAL, tint: [0.7, 1.2, 0.95], tintKind: 'infected', infected: true },
  [B.INF_SAND]:     { name: 'Заражённый песок', tiles: { all: 'sand' }, hardness: 0.28, color: '#a4b66b', drop: B.SAND, tint: [0.9, 1.22, 0.7], tintKind: 'infected', infected: true },
  [B.INF_OBSIDIAN]: { name: 'Заражённый обсидиан', tiles: { all: 'obsidian' }, hardness: 2.4, color: '#3f3454', drop: B.OBSIDIAN, tint: [1.05, 0.9, 1.35], tintKind: 'infected', infected: true },
  [B.INF_LEAVES]:   { name: 'Заражённая листва', tiles: { all: 'leaves' }, hardness: 0.2, color: '#6f9a33', drop: B.LEAVES, tint: [0.9, 1.35, 0.6], tintKind: 'infected', infected: true },
  [B.INF_RUST]:     { name: 'Заражённая ржавчина', tiles: { all: 'rust' }, hardness: 0.95, color: '#8a8a4a', drop: B.RUST, tint: [1.0, 1.22, 0.66], tintKind: 'infected', infected: true },

  /* farm location */
  [B.RED_BRICK]:    { name: 'Красный кирпич', tiles: { all: 'red_brick' }, hardness: 1.1, color: '#a33b32', tintKind: 'stone', collectible: true },
  [B.HAY]:          { name: 'Сноп сена', tiles: { all: 'hay' }, hardness: 0.35, color: '#d9b44a', tintKind: 'grass', collectible: true },
  [B.WIRE]:         { name: 'Колючая проволока', tiles: { all: 'wire' }, hardness: 0.55, color: '#8c9199', tintKind: 'metal', collectible: true, hazard: 'wire' },
};

/* Blocks available in the hotbar (slots 2..6) */
export const HOTBAR_BLOCKS = [B.STONE, B.PLANKS, B.BRICK, B.METAL, B.OBSIDIAN];
export const START_BLOCKS = [B.STONE, B.PLANKS, null, null, null];
export const INVENTORY_BLOCKS = [
  B.DIRT, B.STONE, B.BRICK, B.LOG, B.PLANKS, B.METAL, B.SAND, B.OBSIDIAN, B.LEAVES, B.RUST,
  B.RED_BRICK, B.HAY, B.WIRE,
];

export const SLOT = {
  PICKAXE: 0,
  BLOCK0: 1,
  BLOCK1: 2,
  BLOCK2: 3,
  BLOCK3: 4,
  BLOCK4: 5,
  PRIMARY: 6,
  SECONDARY: 7,
  MEDKIT: 8,
};

export const WEAPONS = {
  pistol: {
    name: 'КЛЫК-12', type: 'ПИСТОЛЕТ', key: 'pistol',
    dmg: 26, rpm: 310, mag: 12, reserveMax: 120, spread: 0.0075, pellets: 1,
    auto: false, reload: 1.15, range: 110, kick: 0.030, rank: 1,
    color: 0xc9d2df, accent: 0xffb144,
  },
  smg: {
    name: 'ШЕРШЕНЬ', type: 'ПИСТОЛЕТ-ПУЛЕМЁТ', key: 'smg',
    dmg: 15, rpm: 800, mag: 32, reserveMax: 288, spread: 0.019, pellets: 1,
    auto: true, reload: 1.55, range: 90, kick: 0.016, rank: 2,
    color: 0x8d99a9, accent: 0x8ef0ff,
  },
  shotgun: {
    name: 'МОЛОТ', type: 'ДРОБОВИК', key: 'shotgun',
    dmg: 12, rpm: 82, mag: 6, reserveMax: 54, spread: 0.055, pellets: 9,
    auto: false, reload: 2.1, range: 48, kick: 0.075, rank: 3,
    color: 0x9a7550, accent: 0xffb144,
  },
  rifle: {
    name: 'СТРИЖ', type: 'ВИНТОВКА', key: 'rifle',
    dmg: 44, rpm: 440, mag: 25, reserveMax: 225, spread: 0.009, pellets: 1,
    auto: true, reload: 1.85, range: 180, kick: 0.042, rank: 4, zoom: 1.3,
    color: 0x6e7b8c, accent: 0x8ef0ff,
  },
  ak: {
    name: 'КАЛАШ', type: 'АВТОМАТ', key: 'ak',
    dmg: 27, rpm: 640, mag: 30, reserveMax: 300, spread: 0.013, pellets: 1,
    auto: true, reload: 1.95, range: 145, kick: 0.03, rank: 4,
    color: 0x8a6234, accent: 0xffb144,
  },
  sniper: {
    name: 'СОКОЛ', type: 'СНАЙПЕРСКАЯ ВИНТОВКА', key: 'sniper',
    dmg: 130, rpm: 55, mag: 5, reserveMax: 45, spread: 0.0015, pellets: 1,
    auto: false, reload: 2.6, range: 280, kick: 0.095, rank: 5, zoom: 2.8,
    color: 0x56697a, accent: 0x8ef0ff,
  },
  minigun: {
    name: 'ШКВАЛ', type: 'МИНИГАН', key: 'minigun',
    dmg: 11, rpm: 1000, mag: 150, reserveMax: 900, spread: 0.034, pellets: 1,
    auto: true, reload: 4.2, range: 85, kick: 0.008, rank: 5,
    color: 0x6b727d, accent: 0xffb144,
  },
  laser: {
    name: 'ЛУЧ', type: 'ЛАЗЕРНАЯ ПУШКА', key: 'laser',
    dmg: 95, rpm: 170, mag: 40, reserveMax: 240, spread: 0.002, pellets: 1,
    auto: true, reload: 2.3, range: 240, kick: 0.024, rank: 6, laser: true,
    color: 0x5a2a7a, accent: 0xff4dff,
  },
  plasma: {
    name: 'ПЛАЗМА', type: 'ПЛАЗМОГАН', key: 'plasma',
    dmg: 68, rpm: 360, mag: 30, reserveMax: 210, spread: 0.006, pellets: 1,
    auto: true, reload: 1.65, range: 150, kick: 0.032, rank: 6,
    color: 0x2a4a4a, accent: 0x8affd0,
  },

  /* ---- melee: no ammo, hold LMB to swing ---- */
  knife: {
    name: 'ОСКАЛ', type: 'НОЖ', key: 'knife',
    dmg: 42, rpm: 170, range: 2.4, arc: 1.15, knockback: 2.4,
    auto: true, melee: true, spread: 0, pellets: 1, kick: 0.006, rank: 1,
    color: 0xc7d2de, accent: 0xff5468,
  },
  bat: {
    name: 'ГВОЗДОДЁР', type: 'БИТА', key: 'bat',
    dmg: 62, rpm: 120, range: 2.7, arc: 1.3, knockback: 4.6,
    auto: true, melee: true, spread: 0, pellets: 1, kick: 0.012, rank: 2,
    color: 0x9a6a3d, accent: 0xffb144,
  },
  axe: {
    name: 'ДРОВОСЕК', type: 'ТОПОР', key: 'axe',
    dmg: 78, rpm: 100, range: 2.6, arc: 1.2, knockback: 3.8,
    auto: true, melee: true, spread: 0, pellets: 1, kick: 0.018, rank: 3,
    color: 0x8a6234, accent: 0xd7e1ea,
  },
  sword: {
    name: 'РАССВЕТ', type: 'МЕЧ', key: 'sword',
    dmg: 88, rpm: 140, range: 2.9, arc: 1.5, knockback: 2.8,
    auto: true, melee: true, spread: 0, pellets: 1, kick: 0.014, rank: 4,
    color: 0xd7e1ea, accent: 0x8ef0ff,
  },
  sledge: {
    name: 'ГРОМОБОЙ', type: 'КУВАЛДА', key: 'sledge',
    dmg: 140, rpm: 70, range: 3.0, arc: 1.7, knockback: 6.5,
    auto: true, melee: true, spread: 0, pellets: 1, kick: 0.05, rank: 5,
    color: 0x6b727d, accent: 0xffd24a,
  },
};

export const MOBS = {
  grunt: {
    name: 'ГРОМИЛА', hp: 70, speed: 3.6, dmg: 14, range: 2.0, attackCd: 1.0,
    radius: 0.42, height: 1.9, score: 100, flying: false, body: 0x53614b, head: 0x788a68,
  },
  flyer: {
    name: 'ОСА', hp: 52, speed: 3.3, dmg: 11, range: 16, attackCd: 2.15,
    radius: 0.46, height: 0.85, score: 200, flying: true, body: 0x4c4658, head: 0x8a5a66,
    hoverHeight: 4.2, keepRange: 10, minRange: 5.5, castRange: 19,
    projSpeed: 17, projDmg: 11, projColor: 0xffb060, projBig: false,
  },
  brute: {
    name: 'ТАРАН', hp: 340, speed: 2.45, dmg: 30, range: 2.5, attackCd: 1.35,
    radius: 0.72, height: 2.45, score: 400, flying: false, body: 0x5b3f38, head: 0x8a5d4a,
  },
  skeleton: {
    name: 'СКЕЛЕТ', hp: 110, speed: 3.15, dmg: 12, range: 1.8, attackCd: 1.2,
    radius: 0.38, height: 1.85, score: 180, flying: false, body: 0xcfcabb, head: 0xe3dfd3,
    caster: true, castRange: 18, castCd: 2.1, stopRange: 11, keepDistance: 6,
    projSpeed: 25, projDmg: 13, projColor: 0xe8f0ff, projBig: false,
  },
  demon: {
    name: 'ДЕМОН', hp: 180, speed: 3.5, dmg: 22, range: 2.2, attackCd: 1.15,
    radius: 0.5, height: 2.15, score: 260, flying: false, body: 0x5a2330, head: 0x8f3a3a,
    breaksBlocks: true, breakTime: 2.4,
  },
  gargoyle: {
    name: 'ГОРГУЛЬЯ', hp: 230, speed: 3.4, dmg: 15, range: 16, attackCd: 2.0,
    radius: 0.62, height: 1.25, score: 320, flying: true, body: 0x5d5a55, head: 0x7a766e,
    hoverHeight: 2.8, keepRange: 11, minRange: 7, castRange: 22,
    projSpeed: 20, projDmg: 16, projColor: 0xaab6c2, projBig: false,
  },
  troll: {
    name: 'ТРОЛЛЬ', hp: 640, speed: 2.35, dmg: 36, range: 3.1, attackCd: 1.5,
    radius: 0.86, height: 2.95, score: 650, flying: false, body: 0x4d5a3f, head: 0x6e7a55,
    breaksBlocks: true, breakTime: 1.9,
  },
  boss: {
    name: 'ТИТАН', hp: 1100, speed: 2.15, dmg: 38, range: 3.6, attackCd: 1.6,
    radius: 1.15, height: 3.6, score: 2500, flying: false, body: 0x2d2a3e, head: 0x4b4466, boss: true,
  },
};

export const WAVES = [
  {
    title: 'ВОЛНА 1 · РАЗВЕДКА',
    sub: 'Громилы и скелеты идут с края острова',
    prep: 46, between: 22,
    groups: [
      { type: 'grunt', count: 10, gap: 1.25 },
      { type: 'skeleton', count: 4, gap: 3.2, delay: 7 },
    ],
  },
  {
    title: 'ВОЛНА 2 · НАЖИМ',
    sub: 'Осы, демоны и горгульи. Не стойте на открытом',
    prep: 22, between: 24,
    groups: [
      { type: 'grunt', count: 12, gap: 1.15 },
      { type: 'flyer', count: 4, gap: 2.4, delay: 4 },
      { type: 'demon', count: 3, gap: 4.5, delay: 9 },
      { type: 'gargoyle', count: 2, gap: 6, delay: 14 },
    ],
  },
  {
    title: 'ВОЛНА 3 · ШТУРМ',
    sub: 'Тролль, скелеты, демоны. Титан идёт за всеми',
    prep: 24, between: 0,
    groups: [
      { type: 'grunt', count: 10, gap: 1.0 },
      { type: 'flyer', count: 4, gap: 2.2, delay: 3 },
      { type: 'skeleton', count: 3, gap: 3.0, delay: 6 },
      { type: 'demon', count: 3, gap: 4.0, delay: 9 },
      { type: 'gargoyle', count: 2, gap: 5, delay: 12 },
      { type: 'brute', count: 2, gap: 6, delay: 15 },
      { type: 'troll', count: 1, gap: 1, delay: 18 },
      { type: 'boss', count: 1, gap: 1, delay: 22 },
    ],
  },
];

export const LOOT = {
  /* tier 1 — simple camps / ruins */
  1: {
    label: 'РЕЗЕРВ ЛАГЕРЯ',
    ammo: [0.5, 0.9],
    blocks: [24, 44],
    medkit: 0.35,
    weapon: [0.34, ['smg', 'shotgun', 'knife', 'bat']],
    metal: 0.2,
    obsidian: 0,
  },
  /* tier 2 — tower / wreck */
  2: {
    label: 'ТЕХНИЧЕСКИЙ ЯЩИК',
    ammo: [0.8, 1.3],
    blocks: [36, 64],
    medkit: 0.8,
    weapon: [0.6, ['smg', 'shotgun', 'rifle', 'ak', 'axe', 'sword']],
    metal: 0.55,
    obsidian: 0.25,
  },
  /* tier 3 — sky islet jackpot */
  3: {
    label: 'НЕБЕСНЫЙ ТРОФЕЙ',
    ammo: [1.4, 1.9],
    blocks: [60, 90],
    medkit: 1.5,
    weapon: [1, ['rifle', 'sniper', 'minigun', 'sledge']],
    metal: 1,
    obsidian: 0.9,
  },
};

export const CHEST_COUNT = 22;

/* Coins dropped by enemies */
export const COIN_VALUE = {
  grunt: 2, skeleton: 3, flyer: 3, brute: 10,
  demon: 6, gargoyle: 7, troll: 16, boss: 40,
};

/* Everything the dandy sells. Weapons are keyed by WEAPONS id. */
export const SHOP = {
  ammo: {
    name: 'Боезапас', desc: 'Патроны для всего арсенала', price: 20, kind: 'ammo',
  },
  medkit: {
    name: 'Аптечка', desc: '+1 аптечка', price: 30, kind: 'medkit',
  },
  armor: {
    name: 'Щит +30', desc: 'Поглощает половину урона, пока не сломается', price: 45, kind: 'armor', amount: 30,
  },
  weapons: {
    knife: { price: 40 },
    bat: { price: 70 },
    axe: { price: 110 },
    sword: { price: 170 },
    sledge: { price: 230 },
    smg: { price: 90 },
    shotgun: { price: 150 },
    rifle: { price: 240 },
    ak: { price: 260 },
    sniper: { price: 340 },
    minigun: { price: 480 },
  },
};

export const ARMOR = { max: 100, absorb: 0.5 };

/* Weapons sold only by the alien trader after wave 2. */
export const ALIEN_SHOP = {
  laser: { price: 333 },
  plasma: { price: 333 },
};

/* Wearable armour: five sets, three pieces each. dr = damage reduction in %. */
export const ARMOR_SLOTS = {
  helmet: { name: 'ШЛЕМ' },
  chest: { name: 'НАГРУДНИК' },
  legs: { name: 'ПОНОЖИ' },
};

export const ARMOR_SETS = {
  warrior: {
    id: 'warrior', name: 'ВОИН', full: 'СЕТ ВОИНА', rarity: 1,
    color: 0x8a9099, accent: 0xc9d2df,
    dr: { helmet: 3, chest: 5, legs: 4 }, bonus: 3,
  },
  knight: {
    id: 'knight', name: 'РЫЦАРЬ', full: 'СЕТ РЫЦАРЯ', rarity: 2,
    color: 0xa8b3c2, accent: 0xffd24a,
    dr: { helmet: 5, chest: 8, legs: 6 }, bonus: 4,
  },
  hazmat: {
    id: 'hazmat', name: 'ХИМЗАЩИТА', full: 'СЕТ ХИМЗАЩИТЫ', rarity: 3,
    color: 0x7fae52, accent: 0xd8ff8a,
    dr: { helmet: 6, chest: 9, legs: 7 }, bonus: 5,
  },
  cool: {
    id: 'cool', name: 'КРУТОЙ ПАРЕНЬ', full: 'СЕТ КРУТОГО ПАРНЯ', rarity: 4,
    color: 0x35313f, accent: 0xff5aa8,
    dr: { helmet: 7, chest: 10, legs: 8 }, bonus: 6,
  },
  demon: {
    id: 'demon', name: 'ДЕМОН', full: 'СЕТ ДЕМОНА', rarity: 5,
    color: 0x5a1f2a, accent: 0xff6a3c,
    dr: { helmet: 8, chest: 12, legs: 10 }, bonus: 7,
  },
};

export const ARMOR_SET_ORDER = ['warrior', 'knight', 'hazmat', 'cool', 'demon'];

/* Drop odds. bias 0..3 pushes the roll towards rarer sets. */
export const ARMOR_DROP = {
  weights: [
    [0.55, 0.28, 0.12, 0.04, 0.01],
    [0.25, 0.38, 0.24, 0.10, 0.03],
    [0.05, 0.20, 0.32, 0.28, 0.15],
    [0.00, 0.05, 0.20, 0.40, 0.35],
  ],
};

export const PLAYER = {
  maxHp: 100,
  maxArmor: 100,
  eye: 1.62,
  height: 1.8,
  radius: 0.31,
  walk: 5.1,
  sprint: 7.4,
  crouch: 2.0,
  jump: 8.2,
  gravity: 24,
  regenDelay: 8,
  regenRate: 3.2,
  reach: 6.2,
  crouchHeight: 1.5,
  crouchEye: 1.27,
};
