import * as THREE from '../vendor/three.module.js';
import { WORLD_SIZE, CHUNK, B, BLOCKS, ISLAND_CENTER, WORLD_PALETTES, SKY_THEMES, ZONE, AIRSHIP } from './config.js';

const SX = WORLD_SIZE.x, SY = WORLD_SIZE.y, SZ = WORLD_SIZE.z;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function hash2(x, z, seed) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 362437);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x, z, seed, oct = 3) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += vnoise(x * freq, z * freq, seed + i * 131) * amp;
    norm += amp; amp *= 0.5; freq *= 2.03;
  }
  return sum / norm;
}

export function worldStyleFor(seed) {
  return {
    palette: WORLD_PALETTES[Math.floor(hash2(seed, 17, seed + 903) * WORLD_PALETTES.length) % WORLD_PALETTES.length],
    skyTheme: SKY_THEMES[Math.floor(hash2(seed, 29, seed + 904) * SKY_THEMES.length) % SKY_THEMES.length],
  };
}

const FACES = [
  { n: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.84, t: 'side' },
  { n: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.82, t: 'side' },
  { n: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0, t: 'top' },
  { n: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.60, t: 'bottom' },
  { n: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.91, t: 'side' },
  { n: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.88, t: 'side' },
];
const AO_BRIGHT = [0.58, 0.73, 0.87, 1.0];

// Стили пещеры: у каждого босса свои блоки, свет и форма маршрута.
const CAVE_STYLES = {
  colossus: {
    floor: B.STONE, wall: B.STONE, ceil: B.STONE, accents: [B.BRICK, B.RUST],
    light: 0xffb060, fog: 0x2a1a12, hemiSky: 0x6a4a3a, hemiGround: 0x1a0f0a, hemi: 1.05,
    rMin: 3.6, rVar: 1.2, caveH: 5, bossR: 13, bossH: 8, minions: 38,
    legs: [[32, 0], [0, 18], [26, 0], [0, -14], [22, 0], [0, 18], [26, 0]],
  },
  reaper: {
    floor: B.STONE, wall: B.STONE, ceil: B.STONE, accents: [B.OBSIDIAN, B.RUST],
    light: 0x9dffc4, fog: 0x120a1a, hemiSky: 0x4a3a5a, hemiGround: 0x0e0812, hemi: 0.95,
    rMin: 2.6, rVar: 0.8, caveH: 3, bossR: 9, bossH: 5, minions: 52,
    legs: [[14, 0], [0, 12], [10, 0], [0, -10], [14, 0], [0, 12], [18, 0]],
  },
  hive: {
    floor: B.DIRT, wall: B.BRICK, ceil: B.BRICK, accents: [B.HAY, B.PLANKS],
    light: 0xffe14a, fog: 0x241c08, hemiSky: 0x6a5a2a, hemiGround: 0x1a1408, hemi: 1.0,
    rMin: 3.0, rVar: 1.0, caveH: 4, bossR: 10, bossH: 6, minions: 48,
    legs: [[24, 0], [0, 12], [18, 0], [0, 20], [16, 0], [0, -10], [30, 0]],
  },
  magma: {
    floor: B.BASALT, wall: B.BASALT, ceil: B.OBSIDIAN, accents: [B.MAGMA, B.OBSIDIAN],
    light: 0xff7a2a, fog: 0x2a0c06, hemiSky: 0x7a3a2a, hemiGround: 0x200806, hemi: 0.95,
    rMin: 3.8, rVar: 1.4, caveH: 5, bossR: 12, bossH: 7, minions: 44,
    legs: [[34, 0], [0, 14], [20, 0], [0, -18], [26, 0], [0, 16], [18, 0]],
  },
  warden: {
    floor: B.OBSIDIAN, wall: B.STONE, ceil: B.OBSIDIAN, accents: [B.OBSIDIAN, B.METAL],
    light: 0xa8f6ff, fog: 0x0a1a22, hemiSky: 0x3a5a6a, hemiGround: 0x08121a, hemi: 1.0,
    rMin: 3.2, rVar: 1.0, caveH: 6, bossR: 12, bossH: 8, minions: 40,
    legs: [[20, 0], [0, 16], [26, 0], [0, -10], [22, 0], [0, 20], [20, 0]],
  },
  shepherd: {
    floor: B.INF_DIRT, wall: B.INF_STONE, ceil: B.INF_STONE, accents: [B.INF_BRICK, B.INF_METAL],
    light: 0xc6ff6a, fog: 0x10200c, hemiSky: 0x4a6a3a, hemiGround: 0x0e1a0a, hemi: 1.05,
    rMin: 3.0, rVar: 1.2, caveH: 4, bossR: 11, bossH: 6, minions: 50,
    legs: [[28, 0], [0, 22], [14, 0], [0, -12], [26, 0], [0, 10], [22, 0]],
  },
  storm: {
    floor: B.METAL, wall: B.STONE, ceil: B.METAL, accents: [B.METAL, B.RUST],
    light: 0x9fe0ff, fog: 0x0a1422, hemiSky: 0x3a5a7a, hemiGround: 0x081018, hemi: 1.0,
    rMin: 3.4, rVar: 1.2, caveH: 6, bossR: 12, bossH: 8, minions: 46,
    legs: [[24, 0], [0, 10], [28, 0], [0, -18], [18, 0], [0, 22], [20, 0]],
  },
  worm: {
    floor: B.SAND, wall: B.SAND, ceil: B.STONE, accents: [B.BASALT, B.SAND],
    light: 0xffb144, fog: 0x2a2010, hemiSky: 0x6a5a3a, hemiGround: 0x1a1408, hemi: 1.1,
    rMin: 4.0, rVar: 1.4, caveH: 3, bossR: 14, bossH: 5, minions: 42,
    legs: [[40, 0], [0, 18], [18, 0], [0, -14], [34, 0], [0, 16], [22, 0]],
  },
};

export class World {
  constructor(seed = 7331) {
    this.seed = seed;
    this.SX = SX;
    this.SY = SY;
    this.SZ = SZ;
    this.data = new Uint8Array(SX * SY * SZ);
    this.heights = new Int16Array(SX * SZ).fill(-1);
    this.chests = [];
    this.spawnPoints = [];
    this.lights = [];
    this.group = new THREE.Group();
    this.group.name = 'voxel-world';
    this.dirty = new Set();
    this.edits = new Map();
    this.chunkMeshes = new Map();
    this.crystalMeshes = new Map();
    this.crystalGeo = null;
    this.crystalMaterial = null;
    this.material = null;
    this.atlas = null;
    this.sites = [];
    this.floatingIslands = [];
    this.airship = null;
    this.zones = new Uint8Array(SX * SZ);
    this.fenceAt = new Int16Array(SX * SZ).fill(-1);
    this.fencePosts = [];
    this.fenceGroup = null;
    this.palette = WORLD_PALETTES[0];
    this.skyTheme = SKY_THEMES[0];
    this._mapCanvas = null;
  }

  /* ---------------- data ---------------- */
  idx(x, y, z) { return (y * SZ + z) * SX + x; }
  inBounds(x, y, z) { return x >= 0 && x < SX && y >= 0 && y < SY && z >= 0 && z < SZ; }
  get(x, y, z) {
    if (x < 0 || x >= SX || y < 0 || y >= SY || z < 0 || z >= SZ) return 0;
    return this.data[(y * SZ + z) * SX + x];
  }
  isSolid(x, y, z) { return this.get(x, y, z) !== 0; }
  setRaw(x, y, z, id) {
    if (!this.inBounds(x, y, z)) return;
    this.data[(y * SZ + z) * SX + x] = id;
  }
  surfaceY(x, z) {
    if (x < 0 || x >= SX || z < 0 || z >= SZ) return -1;
    return this.heights[x + z * SX];
  }
  groundHeight(x, z) {
    const ix = clamp(Math.floor(x), 0, SX - 1);
    const iz = clamp(Math.floor(z), 0, SZ - 1);
    let y = this.heights[ix + iz * SX];
    if (y < 0) {
      // find any top block
      for (let yy = SY - 1; yy >= 0; yy--) {
        if (this.isSolid(ix, yy, iz)) return yy + 1;
      }
      return -1;
    }
    return y + 1;
  }

  zoneAt(x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    if (ix < 0 || ix >= SX || iz < 0 || iz >= SZ) return ZONE.NORMAL;
    return this.zones[ix + iz * SX];
  }

  buildZoneMap() {
    const cx = ISLAND_CENTER.x, cz = ISLAND_CENTER.z;
    const seed = this.seed;
    const TAU = Math.PI * 2;
    const offset = hash2(seed, 5, seed + 701) * TAU;
    // в одном забеге только одна опасная/особая зона: вулкан, радиация или кристаллы
    const roll = hash2(seed, 7, seed + 705);
    this.zoneType = roll < 1 / 3 ? ZONE.VOLCANO : roll < 2 / 3 ? ZONE.RADIATION : ZONE.CRYSTAL;
    const width = 0.85 + hash2(seed, 3, seed + 703) * 0.35;
    for (let x = 0; x < SX; x++) {
      for (let z = 0; z < SZ; z++) {
        const dx = x - cx, dz = z - cz;
        const dist = Math.hypot(dx, dz);
        let zone = ZONE.NORMAL;
        if (dist > 20 && dist < 88) {
          let a = Math.atan2(dz, dx) - offset;
          a = ((a % TAU) + TAU) % TAU;
          a += (fbm(x * 0.017, z * 0.017, seed + 702, 3) - 0.5) * 0.65;
          a = ((a % TAU) + TAU) % TAU;
          if (a < width) zone = this.zoneType;
        }
        this.zones[x + z * SX] = zone;
      }
    }
  }

  zoneMat(x, z, normal, volcano, radiation) {
    const zone = this.zoneAt(x, z);
    if (zone === ZONE.VOLCANO) return volcano;
    if (zone === ZONE.RADIATION) return radiation;
    return normal;
  }

  blockTint(def) {
    const base = def.tint || null;
    const kind = def.tintKind || 'stone';
    const p = this.palette?.tints?.[kind] || null;
    if (!base && !p) return [1, 1, 1];
    if (!base) return p;
    if (!p) return base;
    return [p[0] * base[0], p[1] * base[1], p[2] * base[2]];
  }

  setBlock(x, y, z, id, silentMesh = false) {
    if (!this.inBounds(x, y, z)) return false;
    const i = (y * SZ + z) * SX + x;
    if (this.data[i] === id) return false;
    this.data[i] = id;
    this.edits.set(x + ',' + y + ',' + z, id);
    // column height cache
    if (id !== 0 && y > this.heights[x + z * SX]) this.heights[x + z * SX] = y;
    if (id === 0) {
      const ix = x + z * SX;
      if (this.heights[ix] === y) {
        let yy = y - 1;
        while (yy >= 0 && !this.isSolid(x, yy, z)) yy--;
        this.heights[ix] = yy;
      }
    }
    if (!silentMesh) {
      this.markDirty(x, z);
      this.dirty.add((x >> 4) + ',' + (z >> 4));
    }
    return true;
  }

  markDirty(x, z) {
    const cx = x >> 4, cz = z >> 4;
    this.dirty.add(cx + ',' + cz);
    if ((x & 15) === 0) this.dirty.add((cx - 1) + ',' + cz);
    if ((x & 15) === 15) this.dirty.add((cx + 1) + ',' + cz);
    if ((z & 15) === 0) this.dirty.add(cx + ',' + (cz - 1));
    if ((z & 15) === 15) this.dirty.add(cx + ',' + (cz + 1));
  }

  /* ---------------- generation ---------------- */
  generate(atlas) {
    this.atlas = atlas;
    const cx = ISLAND_CENTER.x, cz = ISLAND_CENTER.z;
    const seed = this.seed;
    const style = worldStyleFor(seed);
    this.palette = style.palette;
    this.skyTheme = style.skyTheme;
    this.buildZoneMap();

    // --- island body -------------------------------------------------
    for (let x = 0; x < SX; x++) {
      for (let z = 0; z < SZ; z++) {
        const dx = x - cx, dz = z - cz;
        const dist = Math.hypot(dx, dz);
        const ang = Math.atan2(dz, dx);
        const edge = 68 + (fbm(Math.cos(ang) * 2.4 + 17, Math.sin(ang) * 2.4 + 9, seed + 11, 3) - 0.5) * 22;
        if (dist > edge) { this.heights[x + z * SX] = -1; continue; }

        let h = 33.5
          + (fbm(x * 0.021, z * 0.021, seed + 3, 4) - 0.5) * 12
          + (fbm(x * 0.075, z * 0.075, seed + 4, 2) - 0.5) * 2.6;
        h -= Math.pow(dist / edge, 3.4) * 5.8;

        // spawn plateau
        const spawnFlat = smooth(16, 6.5, dist);
        h = lerp(h, 37.0, spawnFlat * 0.95);

        let top = clamp(Math.round(h), 14, 52);
        // rare rock spires
        if (dist < edge * 0.72 && fbm(x * 0.06 + 40, z * 0.06, seed + 22, 2) > 0.8) top += 2;

        const shore = dist > edge - 9;
        const depth = 3.5
          + Math.pow(1 - dist / edge, 1.25) * 28
          + (fbm(x * 0.05, z * 0.05, seed + 9, 2) - 0.5) * 8;
        const bottom = Math.max(1, Math.round(top - depth));
        const zone = this.zoneAt(x, z);
        const topNoise = fbm(x * 0.12, z * 0.12, seed + 30, 2);

        let deepId = B.STONE, soilId = shore ? B.SAND : B.DIRT, topId;
        if (zone === ZONE.VOLCANO) {
          deepId = B.BASALT;
          soilId = B.BASALT;
          topId = fbm(x * 0.16, z * 0.16, seed + 41, 2) > 0.64 ? B.MAGMA : B.BASALT;
        } else if (zone === ZONE.RADIATION) {
          deepId = B.INF_STONE;
          soilId = B.INF_DIRT;
          topId = shore ? B.INF_SAND : (topNoise > 0.72 ? B.INF_STONE : B.INF_GRASS);
        } else if (zone === ZONE.CRYSTAL) {
          deepId = fbm(x * 0.09, z * 0.09, seed + 43, 2) > 0.72 ? B.OBSIDIAN : B.STONE;
          soilId = B.STONE;
          topId = topNoise > 0.68 ? B.CRYSTAL : B.STONE;
        } else {
          topId = shore ? B.SAND : (topNoise > 0.72 ? B.STONE : B.GRASS);
        }

        for (let y = bottom; y <= top; y++) {
          let id = deepId;
          if (y === top) id = topId;
          else if (y > top - 3) id = soilId;
          this.setRaw(x, y, z, id);
        }
        this.heights[x + z * SX] = top;
      }
    }

    // --- dynamically placed outposts ---------------------------------
    this.layoutSites(cx, cz);
    for (const s of this.sites) {
      this.pathTo(cx, cz, s.x, s.z);
    }

    // --- spawn plaza -------------------------------------------------
    this.buildSpawn(cx, cz);

    // --- outposts ----------------------------------------------------
    for (const s of this.sites) this.buildSite(s);
    this.buildRadiationFence();

    // floating islands around the main island
    this.buildFloatingIsles(cx, cz);
    this.buildAirship(cx, cz);

    // sky islet floats somewhere above the island
    const isletAngle = hash2(seed, 61, seed + 711) * Math.PI * 2;
    const isletR = 30 + hash2(seed, 62, seed + 712) * 24;
    const isletX = Math.round(cx + Math.cos(isletAngle) * isletR);
    const isletZ = Math.round(cz + Math.sin(isletAngle) * isletR);
    const isletY = 56 + Math.round(hash2(seed, 63, seed + 713) * 8);
    this.buildSkyIslet(isletX, isletY, isletZ);

    // --- trees & rocks ----------------------------------------------
    this.scatterNature(cx, cz);

    // --- mob approach points ----------------------------------------
    this.buildSpawnPoints(cx, cz);
  }

  layoutSites(cx, cz) {
    const seed = this.seed;
    const specs = [
      { key: 'camp',    label: 'ЛАГЕРЬ', w: 17, d: 15, minR: 18, maxR: 26, zone: ZONE.NORMAL },
      { key: 'ruins',   label: 'РУИНЫ', w: 15, d: 13, minR: 28, maxR: 58, zone: ZONE.NORMAL },
      { key: 'tower',   label: 'БАШНЯ', w: 11, d: 11, minR: 28, maxR: 60, zone: ZONE.NORMAL },
      { key: 'wreck',   label: 'ОБЛОМКИ', w: 13, d: 11, minR: 30, maxR: 60, zone: ZONE.NORMAL },
      { key: 'fort',    label: 'ФОРТ', w: 17, d: 15, minR: 30, maxR: 58, zone: ZONE.NORMAL },
      { key: 'temple',  label: 'ХРАМ', w: 15, d: 13, minR: 30, maxR: 60, zone: ZONE.NORMAL },
      { key: 'rift',    label: 'РАЗЛОМ', w: 13, d: 13, minR: 30, maxR: 60, zone: ZONE.NORMAL },
      { key: 'nest',    label: 'ГНЕЗДО', w: 13, d: 13, minR: 30, maxR: 60, zone: ZONE.NORMAL },
      { key: 'farm',    label: 'ФЕРМА', w: 19, d: 17, minR: 28, maxR: 60, zone: ZONE.NORMAL },
      { key: 'volcano', label: 'ВУЛКАН', w: 23, d: 23, minR: 28, maxR: 62, zone: ZONE.VOLCANO },
      { key: 'reactor', label: 'РЕАКТОР', w: 17, d: 17, minR: 28, maxR: 62, zone: ZONE.RADIATION },
      { key: 'crystal', label: 'КРИСТАЛЬНАЯ ШАХТА', w: 21, d: 21, minR: 28, maxR: 62, zone: ZONE.CRYSTAL },
    ];
    const placed = [];

    // только 6 локаций за забег; опасная — та, что совпадает с зоной
    const zoneType = this.zoneType;
    const normal = specs.filter((s) => s.zone === ZONE.NORMAL);
    const special = specs.find((s) => s.zone === zoneType);
    const order = normal.slice();
    for (let k = order.length - 1; k > 0; k--) {
      const j = Math.floor(hash2(k, order.length, seed + 730) * (k + 1));
      const tmp = order[k]; order[k] = order[j]; order[j] = tmp;
    }
    const chosen = order.slice(0, 5);
    if (special) chosen.push(special);

    const fits = (x, z, spec) => {
      if (this.zoneAt(x, z) !== spec.zone) return false;
      const y = this.surfaceY(x, z);
      if (y < 0 || y > 54) return false;
      for (const p of placed) {
        if (Math.hypot(x - p.x, z - p.z) < (spec.w + p.w) / 2 + 7) return false;
      }
      for (const [ox, oz] of [[spec.w / 2, 0], [-spec.w / 2, 0], [0, spec.d / 2], [0, -spec.d / 2]]) {
        const sy = this.surfaceY(Math.round(x + ox), Math.round(z + oz));
        if (sy < 0 || Math.abs(sy - y) > 6) return false;
      }
      return true;
    };

    for (let i = 0; i < chosen.length; i++) {
      const spec = chosen[i];
      let spot = null;
      for (let attempt = 0; attempt < 420 && !spot; attempt++) {
        const a = hash2(i, attempt, seed + 721) * Math.PI * 2;
        const r = lerp(spec.minR, spec.maxR, hash2(attempt, i, seed + 722));
        const x = Math.round(cx + Math.cos(a) * r);
        const z = Math.round(cz + Math.sin(a) * r);
        if (fits(x, z, spec)) spot = { x, z };
      }
      if (!spot) {
        // relaxed fallback: anywhere in the right zone with no overlap
        for (let attempt = 0; attempt < 900 && !spot; attempt++) {
          const x = 22 + Math.floor(hash2(attempt, i, seed + 723) * (SX - 44));
          const z = 22 + Math.floor(hash2(i, attempt, seed + 724) * (SZ - 44));
          if (this.zoneAt(x, z) !== spec.zone) continue;
          if (this.surfaceY(x, z) < 0) continue;
          let ok = true;
          for (const p of placed) {
            if (Math.hypot(x - p.x, z - p.z) < (spec.w + p.w) / 2 + 5) { ok = false; break; }
          }
          if (ok) spot = { x, z };
        }
      }
      if (!spot) {
        // last resort: ring point, still deterministic
        const a = (i / chosen.length) * Math.PI * 2;
        const x = Math.round(cx + Math.cos(a) * (spec.minR + 8));
        const z = Math.round(cz + Math.sin(a) * (spec.minR + 8));
        spot = { x, z };
      }
      placed.push({ ...spec, x: spot.x, z: spot.z });
    }
    this.sites = placed;
  }

  buildSite(s) {
    switch (s.key) {
      case 'camp': this.buildCamp(s.x, s.z); break;
      case 'ruins': this.buildRuins(s.x, s.z); break;
      case 'tower': this.buildTower(s.x, s.z); break;
      case 'wreck': this.buildWreck(s.x, s.z); break;
      case 'fort': this.buildFort(s.x, s.z); break;
      case 'temple': this.buildTemple(s.x, s.z); break;
      case 'rift': this.buildRift(s.x, s.z); break;
      case 'nest': this.buildNest(s.x, s.z); break;
      case 'farm': this.buildFarm(s.x, s.z); break;
      case 'volcano': this.buildVolcano(s.x, s.z); break;
      case 'reactor': this.buildReactor(s.x, s.z); break;
      case 'crystal': this.buildCrystalMine(s.x, s.z); break;
      default: break;
    }
  }

  pathTo(x0, z0, x1, z1) {
    const steps = Math.ceil(Math.hypot(x1 - x0, z1 - z0) * 1.6);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(lerp(x0, x1, t));
      const z = Math.round(lerp(z0, z1, t));
      for (const [ox, oz] of [[0, 0], [1, 0], [0, 1]]) {
        const y = this.surfaceY(x + ox, z + oz);
        if (y < 0) continue;
        const top = this.get(x + ox, y, z + oz);
        if (top === B.GRASS || top === B.DIRT || top === B.SAND ||
            top === B.INF_GRASS || top === B.INF_DIRT || top === B.INF_SAND) {
          this.setRaw(x + ox, y, z + oz, this.zoneMat(x + ox, z + oz, B.STONE, B.BASALT, B.INF_STONE));
        }
      }
    }
  }

  level(cx, cz, w, d, baseY, mat = B.GRASS) {
    const x0 = cx - Math.floor(w / 2), x1 = x0 + w - 1;
    const z0 = cz - Math.floor(d / 2), z1 = z0 + d - 1;
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        if (x < 1 || z < 1 || x >= SX - 1 || z >= SZ - 1) continue;
        const ix = x + z * SX;
        const old = this.heights[ix];
        for (let y = baseY + 1; y < SY; y++) this.setRaw(x, y, z, 0);
        if (old < 0) {
          for (let y = Math.max(0, baseY - 5); y < baseY; y++) {
            this.setRaw(x, y, z, this.zoneMat(x, z, B.STONE, B.BASALT, B.INF_STONE));
          }
        } else if (old < baseY) {
          for (let y = old + 1; y < baseY; y++) {
            this.setRaw(x, y, z, this.zoneMat(x, z, B.DIRT, B.BASALT, B.INF_DIRT));
          }
        }
        this.setRaw(x, baseY, z, mat);
        this.heights[ix] = baseY;
      }
    }
    return baseY;
  }

  areaMaxHeight(cx, cz, w, d) {
    let h = 0;
    for (let x = cx - (w >> 1); x <= cx + (w >> 1); x++) {
      for (let z = cz - (d >> 1); z <= cz + (d >> 1); z++) {
        const sy = this.surfaceY(x, z);
        if (sy > h) h = sy;
      }
    }
    return Math.max(h, 18);
  }

  fill(x0, y0, z0, x1, y1, z1, id) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++)
        for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
          this.setRaw(x, y, z, id);
  }

  addChest(x, y, z, tier, starter = false) {
    this.chests.push({ x, y, z, tier, looted: false, lid: 0, starter });
  }

  addLight(x, y, z, color, intensity) {
    this.lights.push({ x, y, z, color, intensity });
  }

  buildSpawn(cx, cz) {
    const baseY = this.areaMaxHeight(cx, cz, 13, 13);
    this.level(cx, cz, 15, 15, baseY, B.STONE);
    // plaza inlay
    for (let x = cx - 5; x <= cx + 5; x++) {
      for (let z = cz - 5; z <= cz + 5; z++) {
        const edge = Math.max(Math.abs(x - cx), Math.abs(z - cz));
        if (edge === 5) this.setRaw(x, baseY, z, B.BRICK);
        else if ((x + z) % 4 === 0) this.setRaw(x, baseY, z, B.BRICK);
      }
    }
    // broken gate facing north
    this.fill(cx - 4, baseY + 1, cz - 6, cx - 4, baseY + 3, cz - 6, B.BRICK);
    this.fill(cx + 4, baseY + 1, cz - 6, cx + 4, baseY + 3, cz - 6, B.BRICK);
    this.fill(cx + 4, baseY + 4, cz - 6, cx + 4, baseY + 4, cz - 6, B.BRICK);
    this.fill(cx - 4, baseY + 4, cz - 6, cx - 3, baseY + 4, cz - 6, B.BRICK);
    // crates & starter chest
    this.fill(cx + 5, baseY + 1, cz + 2, cx + 6, baseY + 1, cz + 3, B.LOG);
    this.fill(cx + 5, baseY + 2, cz + 2, cx + 5, baseY + 2, cz + 2, B.LOG);
    this.fill(cx - 5, baseY + 1, cz + 3, cx - 4, baseY + 1, cz + 4, B.PLANKS);
    this.addChest(cx, baseY + 1, cz + 4, 1, true);
    this.addLight(cx - 3.5, baseY + 2.2, cz - 4.5, 0xffb144, 0.9);
  }

  buildCamp(cx, cz) {
    const baseY = this.areaMaxHeight(cx, cz, 15, 13);
    this.level(cx, cz, 15, 13, baseY, B.GRASS);
    const x0 = cx - 6, x1 = cx + 6, z0 = cz - 5, z1 = cz + 5;

    // palisade with entrance on the east side
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const onEdge = x === x0 || x === x1 || z === z0 || z === z1;
        if (!onEdge) continue;
        const corner = (x === x0 || x === x1) && (z === z0 || z === z1);
        if (x === x1 && z >= cz - 1 && z <= cz + 1) continue; // gate
        const h = corner ? 4 : (Math.abs(x) + Math.abs(z)) % 3 === 0 ? 3 : 2;
        for (let y = 1; y <= h; y++) {
          const id = (y === h && h < 4) ? B.LOG : (y % 2 === 0 ? B.PLANKS : B.LOG);
          this.setRaw(x, baseY + y, z, id);
        }
      }
    }
    // gate posts
    this.fill(x1, baseY + 1, cz - 2, x1, baseY + 4, cz - 2, B.LOG);
    this.fill(x1, baseY + 1, cz + 2, x1, baseY + 4, cz + 2, B.LOG);
    this.fill(x1, baseY + 4, cz - 2, x1, baseY + 4, cz + 2, B.PLANKS);

    // tent
    const tx = cx - 2, tz = cz - 1;
    this.fill(tx - 2, baseY + 1, tz - 2, tx - 2, baseY + 3, tz - 2, B.LOG);
    this.fill(tx + 2, baseY + 1, tz - 2, tx + 2, baseY + 3, tz - 2, B.LOG);
    this.fill(tx - 2, baseY + 1, tz + 2, tx - 2, baseY + 2, tz + 2, B.LOG);
    this.fill(tx + 2, baseY + 1, tz + 2, tx + 2, baseY + 2, tz + 2, B.LOG);
    for (let x = tx - 2; x <= tx + 2; x++)
      for (let z = tz - 2; z <= tz + 2; z++)
        this.setRaw(x, baseY + 3 + (x === tx ? 1 : 0), z, B.PLANKS);

    // crates / table / fire
    this.fill(cx + 3, baseY + 1, cz - 3, cx + 4, baseY + 2, cz - 3, B.LOG);
    this.fill(cx + 3, baseY + 1, cz + 3, cx + 3, baseY + 1, cz + 4, B.PLANKS);
    this.fill(cx - 4, baseY + 1, cz + 2, cx - 4, baseY + 2, cz + 2, B.LOG);
    this.setRaw(cx, baseY + 1, cz + 1, B.METAL);
    this.addLight(cx, baseY + 2.2, cz + 1, 0xffa040, 1.2);

    // chests
    this.addChest(cx - 4, baseY + 1, cz - 3, 1);
    this.addChest(cx + 4, baseY + 1, cz + 4, 1);
    // flag pole
    this.fill(cx - 5, baseY + 1, cz - 5, cx - 5, baseY + 6, cz - 5, B.METAL);
    this.fill(cx - 4, baseY + 6, cz - 5, cx - 3, baseY + 6, cz - 5, B.PLANKS);
  }

  buildRuins(cx, cz) {
    const baseY = this.areaMaxHeight(cx, cz, 13, 11);
    this.level(cx, cz, 13, 11, baseY, B.STONE);
    const x0 = cx - 5, x1 = cx + 5, z0 = cz - 4, z1 = cz + 4;
    const rr = (a, b) => hash2(a + cx, b + cz, this.seed + 5);

    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const onEdge = x === x0 || x === x1 || z === z0 || z === z1;
        if (!onEdge) continue;
        const r = rr(x, z);
        if (r < 0.22) continue;
        let h = r > 0.7 ? 4 : r > 0.4 ? 2 : 1;
        if (x === cx && z === z1) continue; // entrance
        for (let y = 1; y <= h; y++) this.setRaw(x, baseY + y, z, B.BRICK);
        if (r > 0.62) this.setRaw(x, baseY + h + 1, z, B.BRICK);
      }
    }
    // arch at entrance
    this.fill(cx - 2, baseY + 1, z1, cx - 2, baseY + 4, z1, B.BRICK);
    this.fill(cx + 2, baseY + 1, z1, cx + 2, baseY + 4, z1, B.BRICK);
    this.fill(cx - 2, baseY + 4, z1, cx + 2, baseY + 4, z1, B.BRICK);
    this.fill(cx - 1, baseY + 2, z1, cx + 1, baseY + 3, z1, 0);
    // inner pillar + rubble
    this.fill(cx, baseY + 1, cz, cx, baseY + 3, cz, B.BRICK);
    this.fill(cx + 2, baseY + 1, cz - 2, cx + 3, baseY + 1, cz - 1, B.BRICK);
    this.fill(cx - 3, baseY + 1, cz + 2, cx - 2, baseY + 1, cz + 2, B.BRICK);
    this.addChest(cx - 3, baseY + 1, cz - 2, 1);
    this.addChest(cx + 3, baseY + 1, cz + 2, 1);
    this.addLight(cx, baseY + 2.4, cz, 0x8ef0ff, 0.8);
  }

  buildTower(cx, cz) {
    const baseY = this.areaMaxHeight(cx, cz, 9, 9);
    this.level(cx, cz, 9, 9, baseY, B.STONE);
    const x0 = cx - 2, x1 = cx + 2, z0 = cz - 2, z1 = cz + 2;

    // base walls, door south
    for (let y = 1; y <= 13; y++) {
      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          const edge = x === x0 || x === x1 || z === z0 || z === z1;
          if (!edge) continue;
          if (y <= 2 && z === z1 && Math.abs(x - cx) <= 1) continue; // door
          const id = (y % 5 === 0) ? B.RUST : B.METAL;
          this.setRaw(x, baseY + y, z, id);
        }
      }
    }
    // top deck & crenellations
    this.fill(x0 - 1, baseY + 14, z0 - 1, x1 + 1, baseY + 14, z1 + 1, B.METAL);
    for (let x = x0 - 1; x <= x1 + 1; x++) {
      for (let z = z0 - 1; z <= z1 + 1; z++) {
        const edge = x === x0 - 1 || x === x1 + 1 || z === z0 - 1 || z === z1 + 1;
        if (edge && (x + z) % 2 === 0) this.setRaw(x, baseY + 15, z, B.METAL);
      }
    }
    // spiral-ish exterior steps
    const sides = [
      [1, 0], [1, 0], [0, 1], [0, 1], [-1, 0], [-1, 0], [0, -1], [0, -1],
      [1, 0], [1, 0], [0, 1], [0, 1], [-1, 0],
    ];
    let sx = cx - 4, sz = cz - 4;
    for (let i = 0; i < sides.length; i++) {
      sx += sides[i][0]; sz += sides[i][1];
      this.fill(sx, baseY + 1 + i, sz, sx + 1, baseY + 1 + i, sz, B.METAL);
    }
    // chest & beacon on top
    this.addChest(cx, baseY + 15, cz, 2);
    this.addLight(cx, baseY + 16.2, cz, 0x8ef0ff, 1.6);
    // ground floor cache
    this.fill(cx - 1, baseY + 1, cz - 1, cx - 1, baseY + 1, cz - 1, B.LOG);
  }

  buildWreck(cx, cz) {
    const baseY = this.areaMaxHeight(cx, cz, 11, 9);
    this.level(cx, cz, 11, 9, baseY, B.SAND);
    const x0 = cx - 4, x1 = cx + 4, z0 = cz - 3, z1 = cz + 3;

    // crater rim
    for (let x = x0 - 2; x <= x1 + 2; x++) {
      for (let z = z0 - 2; z <= z1 + 2; z++) {
        const d = Math.hypot(x - cx, z - cz);
        if (d > 5.5 && d < 6.8 && hash2(x, z, this.seed + 8) > 0.4) {
          this.setRaw(x, baseY + 1, z, B.OBSIDIAN);
        }
      }
    }
    // hull
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / (x1 - x0);
      const h = 2 + Math.round(Math.sin(t * Math.PI) * 3);
      for (let y = 1; y <= h; y++) {
        this.setRaw(x, baseY + y, z0, y === h ? B.RUST : B.METAL);
        this.setRaw(x, baseY + y, z1, y === h ? B.RUST : B.METAL);
      }
      if (x % 2 === 0) {
        for (let z = z0; z <= z1; z++) this.setRaw(x, baseY + h, z, B.RUST);
      }
    }
    // broken bow ribs
    for (let i = 0; i < 3; i++) {
      const x = x0 + 1 + i * 3;
      this.setRaw(x, baseY + 5, cz, B.RUST);
      this.setRaw(x, baseY + 6, cz, B.RUST);
      this.setRaw(x, baseY + 7, cz, B.RUST);
    }
    // interior clear & chest
    this.fill(x0 + 2, baseY + 1, z0 + 1, x1 - 1, baseY + 2, z1 - 1, 0);
    this.addChest(cx + 2, baseY + 1, cz, 2);
    this.addLight(cx - 1, baseY + 2.2, cz, 0xff8a4d, 1.0);
    // debris
    this.setRaw(cx - 6, baseY + 1, cz + 4, B.RUST);
    this.setRaw(cx - 5, baseY + 1, cz + 4, B.RUST);
    this.setRaw(cx + 6, baseY + 1, cz - 4, B.OBSIDIAN);
  }

  buildFort(cx, cz) {
    const baseY = this.areaMaxHeight(cx, cz, 17, 15);
    this.level(cx, cz, 17, 15, baseY, B.STONE);
    const x0 = cx - 7, x1 = cx + 7, z0 = cz - 6, z1 = cz + 6;
    // perimeter walls with a south gate
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const edge = x === x0 || x === x1 || z === z0 || z === z1;
        if (!edge) continue;
        if (z === z1 && Math.abs(x - cx) <= 1) continue;
        const h = 4 + ((x + z) % 3 === 0 ? 1 : 0);
        for (let y = 1; y <= h; y++) this.setRaw(x, baseY + y, z, y === h ? B.RUST : B.BRICK);
        if ((x + z) % 2 === 0) this.setRaw(x, baseY + h + 1, z, B.BRICK);
      }
    }
    // corner towers
    for (const [ox, oz] of [[-7, -6], [7, -6], [-7, 6], [7, 6]]) {
      for (let dx = -1; dx <= 0; dx++) {
        for (let dz = -1; dz <= 0; dz++) {
          for (let y = 1; y <= 7; y++) {
            this.setRaw(cx + ox + dx, baseY + y, cz + oz + dz, y % 4 === 0 ? B.RUST : B.BRICK);
          }
        }
      }
    }
    // inner bunker / command post
    this.fill(cx - 4, baseY + 1, cz - 4, cx - 1, baseY + 3, cz - 2, B.BRICK);
    this.fill(cx - 3, baseY + 1, cz - 3, cx - 2, baseY + 2, cz - 3, 0);
    this.addChest(cx - 4, baseY + 1, cz + 3, 2);
    this.addLight(cx + 1, baseY + 2.4, cz + 1, 0xffb144, 1.1);
    // crates
    this.fill(cx + 3, baseY + 1, cz - 3, cx + 4, baseY + 2, cz - 2, B.LOG);
    this.fill(cx + 4, baseY + 1, cz + 2, cx + 5, baseY + 1, cz + 3, B.METAL);
    // banners
    this.fill(cx - 5, baseY + 1, cz - 5, cx - 5, baseY + 6, cz - 5, B.LOG);
    this.fill(cx - 4, baseY + 6, cz - 5, cx - 3, baseY + 6, cz - 5, B.RUST);
  }

  buildTemple(cx, cz) {
    const baseY = this.areaMaxHeight(cx, cz, 15, 13);
    this.level(cx, cz, 15, 13, baseY, B.SAND);
    // stepped shrine
    this.fill(cx - 5, baseY + 1, cz - 4, cx + 5, baseY + 1, cz + 4, B.BRICK);
    this.fill(cx - 4, baseY + 2, cz - 3, cx + 4, baseY + 2, cz + 3, B.BRICK);
    this.fill(cx - 3, baseY + 3, cz - 2, cx + 3, baseY + 3, cz + 2, B.BRICK);
    this.fill(cx - 2, baseY + 4, cz - 1, cx + 2, baseY + 4, cz + 1, B.BRICK);
    // climbable steps on the south face
    for (let i = 1; i <= 4; i++) {
      this.fill(cx - 1, baseY + i, cz + 5 - i, cx + 1, baseY + i, cz + 5 - i, B.BRICK);
    }
    // broken pillars
    for (const [ox, oz, h] of [[-6, -4, 4], [6, -4, 3], [-6, 4, 3], [6, 4, 5]]) {
      this.fill(cx + ox, baseY + 1, cz + oz, cx + ox, baseY + h, cz + oz, B.BRICK);
      this.setRaw(cx + ox, baseY + h + 1, cz + oz, B.OBSIDIAN);
    }
    this.addChest(cx, baseY + 5, cz, 2);
    this.addLight(cx, baseY + 6.4, cz, 0x8ef0ff, 1.2);
    // sand rubble
    for (let i = 0; i < 16; i++) {
      const a = hash2(i, 3, this.seed + 77) * Math.PI * 2;
      const r = 5 + hash2(3, i, this.seed + 78) * 4;
      const x = Math.round(cx + Math.cos(a) * r), z = Math.round(cz + Math.sin(a) * r);
      if (this.surfaceY(x, z) === baseY) this.setRaw(x, baseY + 1, z, i % 3 === 0 ? B.OBSIDIAN : B.BRICK);
    }
  }

  buildRift(cx, cz) {
    const baseY = this.areaMaxHeight(cx, cz, 13, 13);
    this.level(cx, cz, 13, 13, baseY, B.STONE);
    // obsidian halo
    for (let x = cx - 6; x <= cx + 6; x++) {
      for (let z = cz - 6; z <= cz + 6; z++) {
        const d = Math.hypot(x - cx, z - cz);
        if (d > 4.2 && d < 5.6 && hash2(x, z, this.seed + 88) > 0.45) {
          this.setRaw(x, baseY + 1, z, B.OBSIDIAN);
        }
      }
    }
    // arch
    this.fill(cx - 3, baseY + 1, cz - 3, cx - 3, baseY + 5, cz - 3, B.OBSIDIAN);
    this.fill(cx + 3, baseY + 1, cz - 3, cx + 3, baseY + 5, cz - 3, B.OBSIDIAN);
    this.fill(cx - 3, baseY + 6, cz - 3, cx + 3, baseY + 6, cz - 3, B.OBSIDIAN);
    this.fill(cx - 2, baseY + 2, cz - 3, cx + 2, baseY + 5, cz - 3, 0);
    // spikes
    for (const [ox, oz, h] of [[-5, 2, 2], [5, 2, 3], [-4, 5, 1], [4, 4, 2]]) {
      this.fill(cx + ox, baseY + 1, cz + oz, cx + ox, baseY + h, cz + oz, B.OBSIDIAN);
    }
    this.addChest(cx + 2, baseY + 1, cz + 2, 3);
    this.addLight(cx, baseY + 3.2, cz - 1, 0xff4d3d, 1.5);
    // cracked ground
    for (let i = 0; i < 24; i++) {
      const a = hash2(i, 7, this.seed + 99) * Math.PI * 2;
      const r = 1 + hash2(7, i, this.seed + 100) * 6;
      const x = Math.round(cx + Math.cos(a) * r), z = Math.round(cz + Math.sin(a) * r);
      if (this.surfaceY(x, z) === baseY) this.setRaw(x, baseY, z, B.OBSIDIAN);
    }
  }

  buildNest(cx, cz) {
    const baseY = this.areaMaxHeight(cx, cz, 13, 13);
    this.level(cx, cz, 13, 13, baseY, B.SAND);
    // central dais
    this.fill(cx - 1, baseY + 1, cz - 1, cx + 1, baseY + 1, cz + 1, B.STONE);
    this.addChest(cx, baseY + 2, cz, 2);
    // ring of broken stone pillars
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const x = Math.round(cx + Math.cos(a) * 4.8);
      const z = Math.round(cz + Math.sin(a) * 4.8);
      const h = 3 + Math.floor(hash2(i, 5, this.seed + 111) * 4);
      this.fill(x, baseY + 1, z, x, baseY + h, z, B.STONE);
      this.setRaw(x, baseY + h + 1, z, B.OBSIDIAN);
      this.setRaw(x + 1, baseY + 1, z, B.BRICK);
    }
    // roost ledge
    this.fill(cx + 2, baseY + 1, cz - 4, cx + 4, baseY + 3, cz - 4, B.BRICK);
    this.fill(cx + 4, baseY + 1, cz - 4, cx + 4, baseY + 5, cz - 4, B.STONE);
    // bone-like rubble
    for (let i = 0; i < 20; i++) {
      const a = hash2(i, 2, this.seed + 121) * Math.PI * 2;
      const r = 2 + hash2(2, i, this.seed + 122) * 5;
      const x = Math.round(cx + Math.cos(a) * r), z = Math.round(cz + Math.sin(a) * r);
      if (this.surfaceY(x, z) === baseY) this.setRaw(x, baseY + 1, z, i % 4 === 0 ? B.RUST : B.SAND);
    }
    this.addLight(cx, baseY + 3.6, cz, 0xa8e0ff, 1.2);
  }

  buildRadiationFence() {
    const posts = [];
    for (let x = 1; x < SX - 1; x++) {
      for (let z = 1; z < SZ - 1; z++) {
        if (this.zoneAt(x, z) !== ZONE.RADIATION) continue;
        const y = this.surfaceY(x, z);
        if (y < 0) continue;
        let boundary = false;
        for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (this.zoneAt(x + ox, z + oz) !== ZONE.RADIATION) { boundary = true; break; }
        }
        if (!boundary) continue;
        // keep gates and do not cut through outposts
        let skip = false;
        for (const s of this.sites) {
          if (Math.abs(x - s.x) < s.w / 2 + 1.5 && Math.abs(z - s.z) < s.d / 2 + 1.5) { skip = true; break; }
        }
        if (skip) continue;
        posts.push({ x, z, base: y + 1 });
      }
    }
    // two service gates
    let kept = posts;
    if (posts.length > 30) {
      const ga = posts[Math.floor(posts.length * 0.3)];
      const gb = posts[Math.floor(posts.length * 0.7)];
      kept = posts.filter(p =>
        Math.hypot(p.x - ga.x, p.z - ga.z) > 3.2 &&
        Math.hypot(p.x - gb.x, p.z - gb.z) > 3.2
      );
    }
    for (const p of kept) {
      this.fenceAt[p.x + p.z * SX] = p.base;
      this.fencePosts.push(p);
    }
  }

  buildFenceMesh() {
    if (!this.fencePosts.length) return;
    const group = new THREE.Group();
    group.name = 'radiation-fence';
    const unit = new THREE.BoxGeometry(1, 1, 1);
    const postMat = new THREE.MeshLambertMaterial({ color: 0x7a4a2a });
    const railMat = new THREE.MeshLambertMaterial({ color: 0x9a6a3d });
    const dummy = new THREE.Object3D();

    const posts = new THREE.InstancedMesh(unit, postMat, this.fencePosts.length);
    this.fencePosts.forEach((p, i) => {
      dummy.position.set(p.x + 0.5, p.base + 0.75, p.z + 0.5);
      dummy.scale.set(0.18, 1.5, 0.18);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      posts.setMatrixAt(i, dummy.matrix);
    });
    posts.castShadow = true;
    posts.receiveShadow = true;
    group.add(posts);

    const rails = [];
    for (const p of this.fencePosts) {
      const nx = this.fenceAt[(p.x + 1) + p.z * SX];
      const nz = this.fenceAt[p.x + (p.z + 1) * SX];
      if (nx >= 0) {
        rails.push({ x: p.x + 1, z: p.z + 0.5, y: p.base + 0.55, sx: 1, sz: 0.12 });
        rails.push({ x: p.x + 1, z: p.z + 0.5, y: p.base + 1.12, sx: 1, sz: 0.12 });
      }
      if (nz >= 0) {
        rails.push({ x: p.x + 0.5, z: p.z + 1, y: p.base + 0.55, sx: 0.12, sz: 1 });
        rails.push({ x: p.x + 0.5, z: p.z + 1, y: p.base + 1.12, sx: 0.12, sz: 1 });
      }
    }
    if (rails.length) {
      const railMesh = new THREE.InstancedMesh(unit, railMat, rails.length);
      rails.forEach((r, i) => {
        dummy.position.set(r.x, r.y, r.z);
        dummy.scale.set(r.sx, 0.11, r.sz);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        railMesh.setMatrixAt(i, dummy.matrix);
      });
      railMesh.castShadow = true;
      group.add(railMesh);
    }
    this.fenceGroup = group;
    this.group.add(group);
  }

  buildFarm(cx, cz) {
    const baseY = this.areaMaxHeight(cx, cz, 19, 17);
    this.level(cx, cz, 19, 17, baseY, B.GRASS);
    const x0 = cx - 8, x1 = cx + 8, z0 = cz - 7, z1 = cz + 7;

    // barbed-wire paddock with a gate on the south side
    for (let x = x0; x <= x1; x++) {
      for (const z of [z0, z1]) {
        if (z === z1 && Math.abs(x - cx) <= 1) continue;
        this.setRaw(x, baseY + 1, z, B.WIRE);
      }
    }
    for (let z = z0; z <= z1; z++) {
      for (const x of [x0, x1]) this.setRaw(x, baseY + 1, z, B.WIRE);
    }
    // red brick barn
    const bx0 = cx - 5, bx1 = cx + 4, bz0 = cz - 4, bz1 = cz + 3;
    for (let x = bx0; x <= bx1; x++) {
      for (let z = bz0; z <= bz1; z++) {
        const edge = x === bx0 || x === bx1 || z === bz0 || z === bz1;
        if (!edge) continue;
        if (z === bz1 && Math.abs(x - cx) <= 1) continue;
        for (let y = 1; y <= 4; y++) this.setRaw(x, baseY + y, z, B.RED_BRICK);
      }
    }
    // hay roof and bales
    this.fill(bx0 - 1, baseY + 5, bz0 - 1, bx1 + 1, baseY + 5, bz1 + 1, B.HAY);
    this.fill(bx0 + 1, baseY + 1, bz0 + 1, bx0 + 2, baseY + 2, bz0 + 2, B.HAY);
    this.fill(bx1 - 2, baseY + 1, bz0 + 1, bx1 - 1, baseY + 3, bz0 + 2, B.HAY);
    this.fill(bx1 - 2, baseY + 1, bz1 - 3, bx1 - 1, baseY + 2, bz1 - 2, B.HAY);
    // hay stacks outside
    this.fill(x0 + 2, baseY + 1, z1 - 2, x0 + 3, baseY + 2, z1 - 1, B.HAY);
    this.fill(x1 - 2, baseY + 1, z0 + 2, x1 - 1, baseY + 2, z0 + 3, B.HAY);
    // red brick path / trough
    this.fill(cx - 2, baseY, cz + 5, cx + 2, baseY, cz + 6, B.RED_BRICK);
    this.addChest(bx0 + 1, baseY + 1, bz1 - 2, 2);
    this.addChest(x1 - 2, baseY + 1, z1 - 2, 3);
    this.addLight(cx, baseY + 3.4, cz, 0xffb144, 1.2);
    this.addLight(x0 + 3, baseY + 2.2, z1 - 2, 0xffd24a, 0.9);
  }

  buildVolcano(cx, cz) {
    const baseY = this.areaMaxHeight(cx, cz, 23, 23);
    this.level(cx, cz, 23, 23, baseY, B.BASALT);

    // actual volcano cone
    const R = 11;
    for (let x = cx - R; x <= cx + R; x++) {
      for (let z = cz - R; z <= cz + R; z++) {
        const d = Math.hypot(x - cx, z - cz);
        if (d > R) continue;
        let top;
        if (d < 3.2) top = baseY + 7;
        else if (d < 5.0) top = baseY + 14;
        else top = baseY + Math.round(13 * Math.pow(1 - (d - 5) / (R - 5), 1.45));
        const lip = d < 3.2;
        for (let y = baseY + 1; y <= top; y++) {
          let id = B.BASALT;
          if (y === top) {
            if (lip) id = B.MAGMA;
            else if (d < 5) id = B.OBSIDIAN;
            else if (fbm(x * 0.24, z * 0.24, this.seed + 812, 2) > 0.74) id = B.MAGMA;
          }
          this.setRaw(x, y, z, id);
        }
        // occasional obsidian cracks on the slope
        if (d >= 5 && d < R - 1 && hash2(x, z, this.seed + 813) > 0.9) {
          this.setRaw(x, top + 1, z, B.OBSIDIAN);
        }
      }
    }
    // lava streams at the foot
    for (let i = 0; i < 34; i++) {
      const a = hash2(i, 2, this.seed + 814) * Math.PI * 2;
      const r = 6 + hash2(2, i, this.seed + 815) * 6;
      const x = Math.round(cx + Math.cos(a) * r);
      const z = Math.round(cz + Math.sin(a) * r);
      if (Math.hypot(x - cx, z - cz) < R && this.surfaceY(x, z) >= baseY) {
        this.setRaw(x, this.surfaceY(x, z), z, B.MAGMA);
      }
    }
    // forge nook at the foot
    this.fill(cx - 10, baseY + 1, cz - 3, cx - 9, baseY + 3, cz - 2, B.BASALT);
    this.fill(cx - 10, baseY + 4, cz - 3, cx - 9, baseY + 4, cz - 2, B.OBSIDIAN);
    this.fill(cx + 8, baseY + 1, cz + 6, cx + 9, baseY + 2, cz + 7, B.RUST);
    this.addChest(cx - 10, baseY + 1, cz + 7, 2);
    this.addChest(cx + 10, baseY + 1, cz - 7, 3);
    this.addLight(cx, baseY + 8.2, cz, 0xff6a2c, 2.2);
    this.addLight(cx - 9, baseY + 2.2, cz - 2, 0xffb144, 1.0);
    this.volcano = { x: cx, z: cz, baseY, top: baseY + 14 };
  }

  buildReactor(cx, cz) {
    const baseY = this.areaMaxHeight(cx, cz, 17, 17);
    this.level(cx, cz, 17, 17, baseY, B.INF_STONE);
    // cracked infected ground
    for (let i = 0; i < 30; i++) {
      const a = hash2(i, 1, this.seed + 831) * Math.PI * 2;
      const r = 2 + hash2(1, i, this.seed + 832) * 7;
      const x = Math.round(cx + Math.cos(a) * r);
      const z = Math.round(cz + Math.sin(a) * r);
      if (this.surfaceY(x, z) === baseY) this.setRaw(x, baseY, z, i % 3 === 0 ? B.INF_SAND : B.INF_DIRT);
    }
    const x0 = cx - 7, x1 = cx + 7, z0 = cz - 6, z1 = cz + 6;
    // perimeter bunker with a south gate
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        const edge = x === x0 || x === x1 || z === z0 || z === z1;
        if (!edge) continue;
        if (z === z1 && Math.abs(x - cx) <= 1) continue;
        const h = 4 + ((x + z) % 3 === 0 ? 1 : 0);
        for (let y = 1; y <= h; y++) {
          this.setRaw(x, baseY + y, z, y === h ? B.INF_METAL : (y % 3 === 0 ? B.INF_RUST : B.INF_BRICK));
        }
      }
    }
    // corner vents
    for (const [ox, oz] of [[-7, -6], [7, -6], [-7, 6], [7, 6]]) {
      for (let y = 1; y <= 7; y++) this.setRaw(cx + ox, baseY + y, cz + oz, B.INF_METAL);
      this.setRaw(cx + ox, baseY + 8, cz + oz, B.INF_OBSIDIAN);
    }
    // reactor core
    this.fill(cx - 1, baseY + 1, cz - 1, cx + 1, baseY + 4, cz + 1, B.INF_OBSIDIAN);
    this.fill(cx - 1, baseY + 5, cz - 1, cx + 1, baseY + 5, cz + 1, B.INF_METAL);
    this.setRaw(cx, baseY + 6, cz, B.INF_OBSIDIAN);
    // pipes and infested machinery
    this.fill(cx - 6, baseY + 1, cz - 4, cx - 4, baseY + 2, cz - 3, B.INF_METAL);
    this.fill(cx + 4, baseY + 1, cz - 4, cx + 6, baseY + 2, cz - 3, B.INF_METAL);
    this.fill(cx + 2, baseY + 1, cz + 3, cx + 5, baseY + 1, cz + 4, B.INF_RUST);
    this.fill(cx + 2, baseY + 1, cz - 3, cx + 3, baseY + 2, cz - 2, B.INF_PLANKS);
    this.addChest(cx - 4, baseY + 1, cz + 4, 2);
    this.addChest(cx + 4, baseY + 1, cz - 4, 3);
    this.addLight(cx, baseY + 3.2, cz, 0x8aff6a, 1.7);
    this.addLight(cx - 5, baseY + 2.2, cz + 3, 0x9affb0, 1.0);
    // warning pillars outside
    for (const [ox, oz] of [[-9, 0], [9, 0]]) {
      this.fill(cx + ox, baseY + 1, cz + oz, cx + ox, baseY + 4, cz + oz, B.INF_RUST);
      this.setRaw(cx + ox, baseY + 5, cz + oz, B.INF_OBSIDIAN);
    }
  }

  buildCrystalMine(cx, cz) {
    const baseY = this.areaMaxHeight(cx, cz, 19, 19);
    this.level(cx, cz, 19, 19, baseY, B.STONE);
    // ступенчатая шахта вниз
    const depth = 11;
    for (let d = 0; d < depth; d++) {
      const r = 6 - Math.floor(d * 0.55);
      const y = baseY - d;
      for (let x = -r; x <= r; x++) {
        for (let z = -r; z <= r; z++) {
          if (x * x + z * z > r * r + 1) continue;
          this.setRaw(cx + x, y, cz + z, 0);
        }
      }
    }
    const bottom = baseY - depth + 1;
    // камера на дне
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        if (Math.hypot(x, z) > 5.5) continue;
        this.setRaw(cx + x, bottom - 1, cz + z, B.STONE);
        this.setRaw(cx + x, bottom, cz + z, 0);
        this.setRaw(cx + x, bottom + 1, cz + z, 0);
      }
    }
    // кристаллические жилы в стенах шахты
    for (let i = 0; i < 48; i++) {
      const a = hash2(i, 3, this.seed + 861) * Math.PI * 2;
      const d = Math.floor(hash2(3, i, this.seed + 862) * depth);
      const r = Math.max(1, 6 - Math.floor(d * 0.55));
      const y = baseY - d;
      const x = Math.round(cx + Math.cos(a) * r);
      const z = Math.round(cz + Math.sin(a) * r);
      if (this.get(x, y, z) === 0) this.setRaw(x, y, z, B.CRYSTAL);
    }
    // кристаллы на дне
    for (let i = 0; i < 12; i++) {
      const a = hash2(i, 7, this.seed + 863) * Math.PI * 2;
      const rr = hash2(7, i, this.seed + 864) * 4;
      const x = Math.round(cx + Math.cos(a) * rr);
      const z = Math.round(cz + Math.sin(a) * rr);
      const h = 1 + Math.floor(hash2(x, z, this.seed + 865) * 3);
      for (let k = 0; k < h; k++) this.setRaw(x, bottom + k, z, B.CRYSTAL);
    }
    this.addChest(cx - 3, bottom, cz + 3, 3);
    this.addChest(cx + 3, bottom, cz - 3, 2);
    this.addLight(cx, bottom + 2, cz, 0x8ef0ff, 1.9);
    this.addLight(cx, baseY + 2, cz, 0xa8f6ff, 1.2);
    // кристаллы по ободу
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * 7);
      const z = Math.round(cz + Math.sin(a) * 7);
      const y = this.surfaceY(x, z);
      if (y >= 0) this.setRaw(x, y + 1, z, B.CRYSTAL);
    }
  }

  buildFloatingIsles(cx, cz) {
    const seed = this.seed;
    const count = 5;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + hash2(i, 1, seed + 841) * 0.55;
      const r = 36 + hash2(i, 2, seed + 842) * 22;
      const ix = Math.round(cx + Math.cos(a) * r);
      const iz = Math.round(cz + Math.sin(a) * r);
      const iy = 60 + Math.round(hash2(i, 3, seed + 843) * 10);
      const rad = 3 + Math.floor(hash2(i, 4, seed + 844) * 3);
      const zone = this.zoneAt(ix, iz);
      const crystal = zone === ZONE.CRYSTAL;
      const topId = zone === ZONE.VOLCANO ? B.BASALT : zone === ZONE.RADIATION ? B.INF_GRASS : crystal ? B.CRYSTAL : B.GRASS;
      const soilId = zone === ZONE.VOLCANO ? B.BASALT : zone === ZONE.RADIATION ? B.INF_DIRT : crystal ? B.STONE : B.DIRT;
      const deepId = zone === ZONE.VOLCANO ? B.BASALT : zone === ZONE.RADIATION ? B.INF_STONE : B.STONE;
      this.floatingIslands.push({ x: ix, y: iy, z: iz, r: rad });

      for (let dx = -rad - 1; dx <= rad + 1; dx++) {
        for (let dz = -rad - 1; dz <= rad + 1; dz++) {
          const d = Math.hypot(dx, dz);
          const edge = rad + (hash2(ix + dx, iz + dz, seed + 845) - 0.5) * 1.1;
          if (d > edge) continue;
          const top = iy + (hash2(ix + dx, iz + dz, seed + 846) > 0.74 ? 1 : 0);
          const bottom = top - 2 - Math.floor((1 - d / Math.max(1, edge)) * 3);
          for (let y = bottom; y <= top; y++) {
            let id = deepId;
            if (y === top) id = topId;
            else if (y > top - 2) id = soilId;
            this.setRaw(ix + dx, y, iz + dz, id);
          }
        }
      }

      // a little tree or rock cluster
      if (zone !== ZONE.VOLCANO && zone !== ZONE.CRYSTAL && rad >= 4) {
        this.tree(ix + 1, iy + 1, iz - 1);
      } else {
        for (const [ox, oz] of [[-2, 1], [2, -1], [1, 2]]) {
          this.setRaw(ix + ox, iy + 1, iz + oz, zone === ZONE.VOLCANO ? B.OBSIDIAN : zone === ZONE.CRYSTAL ? B.CRYSTAL : B.INF_STONE);
        }
      }
      if (i % 2 === 0) this.addLight(ix, iy + 2, iz, zone === ZONE.RADIATION ? 0x8aff6a : zone === ZONE.CRYSTAL ? 0x8ef0ff : 0xffb144, 1.0);
    }
  }

  buildAirship(cx, cz) {
    const seed = this.seed;
    const angle = hash2(seed, 71, seed + 861) * Math.PI * 2;
    const ax = Math.round(cx + Math.cos(angle) * AIRSHIP.radius);
    const az = Math.round(cz + Math.sin(angle) * AIRSHIP.radius);
    const deckY = AIRSHIP.deckY;
    const x0 = ax - 22, x1 = ax + 22, z0 = az - 10, z1 = az + 10;

    // main deck
    this.fill(x0, deckY, z0, x1, deckY, z1, B.PLANKS);
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        if ((x + z) % 9 === 0) this.setRaw(x, deckY, z, B.LOG);
        if (x === x0 || x === x1 || z === z0 || z === z1) this.setRaw(x, deckY, z, B.LOG);
      }
    }
    // layered hull
    for (let layer = 1; layer <= 5; layer++) {
      const inset = layer;
      for (let x = x0 + inset; x <= x1 - inset; x++) {
        for (let z = z0 + inset; z <= z1 - inset; z++) {
          this.setRaw(x, deckY - layer, z, layer >= 4 ? B.RUST : B.LOG);
        }
      }
    }
    // keel
    for (let x = ax - 8; x <= ax + 8; x++) {
      for (let z = az - 3; z <= az + 3; z++) this.setRaw(x, deckY - 6, z, B.RUST);
    }
    // railing and posts
    for (let x = x0; x <= x1; x++) {
      this.setRaw(x, deckY + 1, z0, B.RUST);
      this.setRaw(x, deckY + 1, z1, B.RUST);
    }
    for (let z = z0; z <= z1; z++) {
      this.setRaw(x0, deckY + 1, z, B.RUST);
      this.setRaw(x1, deckY + 1, z, B.RUST);
    }
    for (let x = x0; x <= x1; x += 4) {
      this.setRaw(x, deckY + 2, z0, B.LOG);
      this.setRaw(x, deckY + 2, z1, B.LOG);
    }
    for (let z = z0; z <= z1; z += 4) {
      this.setRaw(x0, deckY + 2, z, B.LOG);
      this.setRaw(x1, deckY + 2, z, B.LOG);
    }
    // big striped balloon
    const cy = deckY + 16;
    for (let dx = -18; dx <= 18; dx++) {
      for (let dy = -7; dy <= 7; dy++) {
        for (let dz = -10; dz <= 10; dz++) {
          const q = (dx * dx) / 324 + (dy * dy) / 49 + (dz * dz) / 100;
          if (q > 1.04 || q < 0.56) continue;
          const id = Math.abs(dx) % 5 === 0 ? B.BRICK : B.RUST;
          this.setRaw(ax + dx, cy + dy, az + dz, id);
        }
      }
    }
    // balloon bands and nose caps
    for (let dz = -10; dz <= 10; dz += 5) {
      for (let dx = -18; dx <= 18; dx++) {
        for (let dy = -7; dy <= 7; dy++) {
          const q = (dx * dx) / 324 + (dy * dy) / 49 + (dz * dz) / 100;
          if (q <= 1.04 && q >= 0.56) this.setRaw(ax + dx, cy + dy, az + dz, B.METAL);
        }
      }
    }
    this.fill(ax - 19, cy - 2, az - 2, ax - 19, cy + 2, az + 2, B.METAL);
    this.fill(ax + 19, cy - 2, az - 2, ax + 19, cy + 2, az + 2, B.METAL);
    // mast and rigging
    for (let y = deckY + 2; y <= cy - 7; y++) this.setRaw(ax, y, az, B.LOG);
    for (const [ox, oz] of [[-16, -9], [16, -9], [-16, 9], [16, 9], [-8, -10], [8, 10]]) {
      for (let y = deckY + 2; y <= cy - 6; y++) {
        if ((y + ox + oz) % 2 === 0) this.setRaw(ax + ox, y, az + oz, B.RUST);
      }
    }
    // side propellers and fins
    this.fill(x0 - 3, deckY + 1, az - 2, x0 - 1, deckY + 4, az + 2, B.METAL);
    this.fill(x0 - 4, deckY + 3, az, x0 - 4, deckY + 3, az, B.RUST);
    this.fill(x1 + 1, deckY + 1, az - 2, x1 + 3, deckY + 4, az + 2, B.METAL);
    this.fill(x1 + 2, deckY + 6, az, x1 + 2, deckY + 9, az, B.RUST);
    // cabin / workshop shelter
    this.fill(x0 + 3, deckY + 1, z0 + 3, x0 + 11, deckY + 3, z0 + 3, B.LOG);
    this.fill(x0 + 3, deckY + 1, z1 - 3, x0 + 11, deckY + 3, z1 - 3, B.LOG);
    this.fill(x0 + 3, deckY + 1, z0 + 3, x0 + 3, deckY + 3, z1 - 3, B.LOG);
    this.fill(x0 + 11, deckY + 1, z0 + 3, x0 + 11, deckY + 3, z1 - 3, B.LOG);
    this.fill(x0 + 3, deckY + 4, z0 + 2, x0 + 12, deckY + 4, z1 - 2, B.PLANKS);
    this.fill(x0 + 11, deckY + 1, az - 2, x0 + 11, deckY + 2, az + 2, 0);
    // chests
    this.addChest(x0 + 5, deckY + 1, z1 - 1, 3);
    this.addChest(x1 - 5, deckY + 1, z0 + 1, 3);
    this.addChest(x1 - 5, deckY + 1, z1 - 1, 3);
    this.addChest(x0 + 17, deckY + 1, z0 + 1, 3);
    // lights
    this.addLight(ax, deckY + 5, az, 0xffb144, 1.8);
    this.addLight(x1 - 6, deckY + 3, z1 - 4, 0x8ef0ff, 1.2);
    this.addLight(x0 + 8, deckY + 5, az, 0xffd24a, 1.2);
    this.airship = {
      x: ax, z: az, deckY,
      bench: { x: ax + 12, y: deckY + 1, z: az + 3 },
      bounds: { x0, x1, z0, z1 },
    };
  }

  buildSkyIslet(cx, cy, cz) {
    for (let x = cx - 4; x <= cx + 4; x++) {
      for (let z = cz - 4; z <= cz + 4; z++) {
        const d = Math.hypot(x - cx, z - cz);
        if (d > 4.1) continue;
        const top = cy + (hash2(x, z, this.seed + 31) > 0.72 ? 1 : 0);
        const bottom = top - 2 - Math.floor((1 - d / 4.1) * 5);
        for (let y = bottom; y <= top; y++) {
          let id = B.STONE;
          if (y === top) id = B.GRASS;
          else if (y > top - 2) id = B.DIRT;
          this.setRaw(x, y, z, id);
        }
      }
    }
    // small tree
    for (let y = 1; y <= 3; y++) this.setRaw(cx + 2, cy + y, cz - 1, B.LOG);
    for (let x = cx + 1; x <= cx + 3; x++)
      for (let z = cz - 2; z <= cz; z++)
        this.setRaw(x, cy + 3, z, B.LEAVES);
    this.setRaw(cx + 2, cy + 4, cz - 1, B.LEAVES);
    // flatten a tiny pad so the chest is reachable
    for (let x = cx - 2; x <= cx; x++) {
      for (let z = cz; z <= cz + 2; z++) {
        for (let y = cy + 1; y <= cy + 4; y++) this.setRaw(x, y, z, 0);
        this.setRaw(x, cy, z, B.GRASS);
      }
    }
    this.addChest(cx - 1, cy + 1, cz + 1, 3);
    // obsidian shrine
    this.setRaw(cx - 2, cy + 1, cz - 2, B.OBSIDIAN);
    this.setRaw(cx - 2, cy + 2, cz - 2, B.OBSIDIAN);
    this.addLight(cx, cy + 3.4, cz, 0xffe08a, 2.2);
  }

  findMerchantSpot(seed = this.seed) {
    const cx = ISLAND_CENTER.x, cz = ISLAND_CENTER.z;
    const candidates = [];
    for (let i = 0; i < 80 && candidates.length < 40; i++) {
      const a = hash2(i, 11, seed + 901) * Math.PI * 2;
      const r = 14 + hash2(i, 12, seed + 902) * 30;
      const x = Math.round(cx + Math.cos(a) * r);
      const z = Math.round(cz + Math.sin(a) * r);
      const y = this.surfaceY(x, z);
      if (y < 0) continue;
      const top = this.get(x, y, z);
      if (top !== B.GRASS && top !== B.SAND) continue;
      let clear = true;
      for (let yy = y + 1; yy <= y + 5; yy++) {
        if (this.isSolid(x, yy, z)) { clear = false; break; }
      }
      for (let ox = -1; ox <= 1 && clear; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
          if (Math.abs(this.surfaceY(x + ox, z + oz) - y) > 1) { clear = false; break; }
        }
      }
      if (!clear) continue;
      for (const s of this.sites) {
        if (Math.abs(x - s.x) < s.w / 2 + 5 && Math.abs(z - s.z) < s.d / 2 + 5) { clear = false; break; }
      }
      if (!clear) continue;
      for (const c of this.chests) {
        if (Math.hypot(x - c.x, z - c.z) < 6) { clear = false; break; }
      }
      if (!clear) continue;
      candidates.push({ x: x + 0.5, y: y + 1, z: z + 0.5 });
    }
    if (candidates.length) {
      const idx = Math.floor(hash2(seed, 99, seed + 903) * candidates.length) % candidates.length;
      return candidates[idx];
    }
    const p = this.spawnPoints[0];
    if (p) return { x: p.x, y: p.y, z: p.z };
    return { x: cx + 10.5, y: (this.surfaceY(cx + 10, cz) || 30) + 1, z: cz + 0.5 };
  }

  scatterNature(cx, cz) {
    let placed = 0, guard = 0;
    const blocked = (x, z) => {
      for (const s of this.sites) {
        if (Math.abs(x - s.x) < s.w / 2 + 4 && Math.abs(z - s.z) < s.d / 2 + 4) return true;
      }
      if (Math.hypot(x - cx, z - cz) < 12) return true;
      if (this.fenceAt[x + z * SX] >= 0) return true;
      for (const c of this.chests) if (Math.hypot(x - c.x, z - c.z) < 4) return true;
      return false;
    };
    while (placed < 62 && guard++ < 4000) {
      const x = 18 + Math.floor(hash2(placed, guard, this.seed + 44) * (SX - 36));
      const z = 18 + Math.floor(hash2(guard, placed, this.seed + 45) * (SZ - 36));
      const y = this.surfaceY(x, z);
      if (y < 0 || y > 54) continue;
      const top = this.get(x, y, z);
      if (top !== B.GRASS && top !== B.INF_GRASS) continue;
      if (blocked(x, z)) continue;
      let flat = true;
      for (const [ox, oz] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [0, 2]]) {
        if (Math.abs(this.surfaceY(x + ox, z + oz) - y) > 2) flat = false;
      }
      if (!flat) continue;
      this.tree(x, y + 1, z);
      placed++;
    }
    // boulders
    for (let i = 0; i < 42; i++) {
      const x = 22 + Math.floor(hash2(i, 9, this.seed + 55) * (SX - 44));
      const z = 22 + Math.floor(hash2(9, i, this.seed + 56) * (SZ - 44));
      const y = this.surfaceY(x, z);
      if (y < 0 || y > 50 || blocked(x, z)) continue;
      const r = hash2(i, 4, this.seed + 57) > 0.55 ? 2 : 1;
      const zone = this.zoneAt(x, z);
      const boulderId = zone === ZONE.RADIATION ? B.INF_STONE
        : zone === ZONE.VOLCANO ? B.BASALT
        : zone === ZONE.CRYSTAL ? B.CRYSTAL : B.STONE;
      for (let ox = -r; ox <= r; ox++)
        for (let oz = -r; oz <= r; oz++)
          for (let oy = 0; oy <= r; oy++)
            if (hash2(x + ox, z + oz, this.seed + oy + 60) > 0.28)
              this.setRaw(x + ox, y + 1 + oy, z + oz, boulderId);
    }

    // кристаллы, растущие из земли
    let spires = 0, tries = 0;
    while (spires < 30 && tries++ < 4000) {
      const x = 18 + Math.floor(hash2(spires, tries, this.seed + 90) * (SX - 36));
      const z = 18 + Math.floor(hash2(tries, spires, this.seed + 91) * (SZ - 36));
      if (this.zoneAt(x, z) !== ZONE.CRYSTAL) continue;
      const y = this.surfaceY(x, z);
      if (y < 0 || y > 52 || blocked(x, z)) continue;
      const top = this.get(x, y, z);
      if (top !== B.STONE && top !== B.CRYSTAL) continue;
      const h = 2 + Math.floor(hash2(x, z, this.seed + 92) * 4);
      for (let i = 0; i < h; i++) this.setRaw(x, y + 1 + i, z, B.CRYSTAL);
      for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (hash2(x + ox * 7, z + oz * 11, this.seed + 94) < 0.45) continue;
        const hh = 1 + Math.floor(hash2(x + ox, z + oz, this.seed + 95) * Math.max(1, h - 1));
        for (let i = 0; i < hh; i++) {
          if (this.get(x + ox, y + 1 + i, z + oz) === 0) this.setRaw(x + ox, y + 1 + i, z + oz, B.CRYSTAL);
        }
      }
      spires++;
    }
  }

  tree(x, y, z) {
    const zone = this.zoneAt(x, z);
    const logId = zone === ZONE.RADIATION ? B.INF_LOG : B.LOG;
    const leafId = zone === ZONE.RADIATION ? B.INF_LEAVES : B.LEAVES;
    const h = 4 + Math.floor(hash2(x, z, this.seed + 71) * 3);
    for (let i = 0; i < h; i++) this.setRaw(x, y + i, z, logId);
    const top = y + h;
    for (let oy = -2; oy <= 1; oy++) {
      const r = oy <= -1 ? 2 : 1;
      for (let ox = -r; ox <= r; ox++) {
        for (let oz = -r; oz <= r; oz++) {
          if (Math.abs(ox) === r && Math.abs(oz) === r && oy > -2) continue;
          if (ox === 0 && oz === 0 && oy < 0) continue;
          if (this.get(x + ox, top + oy, z + oz) === 0) {
            this.setRaw(x + ox, top + oy, z + oz, leafId);
          }
        }
      }
    }
    this.setRaw(x, top + 1, z, leafId);
  }

  buildSpawnPoints(cx, cz) {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.31;
      let found = null;
      for (let r = 64; r >= 24; r -= 2) {
        const x = Math.round(cx + Math.cos(a) * r);
        const z = Math.round(cz + Math.sin(a) * r);
        const y = this.surfaceY(x, z);
        const top = y >= 0 ? this.get(x, y, z) : 0;
        if (y > 10 && top !== 0 && top !== B.LEAVES && top !== B.LOG &&
            top !== B.INF_LEAVES && top !== B.INF_LOG && top !== B.MAGMA) {
          let free = true;
          for (const s of this.sites) {
            if (Math.hypot(x - s.x, z - s.z) < Math.max(s.w, s.d) / 2 + 3) free = false;
          }
          if (free) { found = { x: x + 0.5, y: y + 1, z: z + 0.5 }; break; }
        }
      }
      if (found) this.spawnPoints.push(found);
    }
    if (this.spawnPoints.length === 0) this.spawnPoints.push({ x: cx + 34, y: 40, z: cz });
  }

  /* ---------------- meshing ---------------- */


  // Отдельный мир-подземелье: длинная извилистая пещера с одним маршрутом.
  generateDungeon(seed, atlas, bossKey = 'colossus') {
    this.seed = seed;
    this.atlas = atlas;
    this.palette = WORLD_PALETTES[0];
    this.skyTheme = SKY_THEMES[0];
    this.dungeon = null;

    // детерминированный ГПСЧ: у хоста и гостя одна и та же пещера
    let rndState = ((seed >>> 0) ^ 0x9e3779b9) >>> 0 || 1;
    const rnd = () => {
      rndState = (Math.imul(rndState, 1664525) + 1013904223) >>> 0;
      return rndState / 4294967296;
    };

    const cx = ISLAND_CENTER.x, cz = ISLAND_CENTER.z;
    const floorY = 30;
    const start = { x: cx - 42, z: cz - 42 };
    const style = CAVE_STYLES[bossKey] || CAVE_STYLES.colossus;

    // один длинный маршрут: несколько поворотов, без развилок
    const legs = style.legs;
    const path = [{ x: start.x, z: start.z, r: 5 }];
    let px = start.x, pz = start.z;
    let dirX = 1, dirZ = 0;
    for (const [dx, dz] of legs) {
      const len = Math.max(Math.abs(dx), Math.abs(dz));
      const sx = Math.sign(dx), sz = Math.sign(dz);
      for (let i = 0; i < len; i++) {
        px += sx; pz += sz;
        dirX = sx || 0; dirZ = sz || 0;
        path.push({ x: px, z: pz, r: style.rMin + rnd() * style.rVar });
      }
    }
    const end = path[path.length - 1];

    // сплошной камень вокруг маршрута
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const fillPad = Math.max(8, style.bossR + 4);
    for (const p of path) {
      minX = Math.min(minX, p.x - fillPad); maxX = Math.max(maxX, p.x + fillPad);
      minZ = Math.min(minZ, p.z - fillPad); maxZ = Math.max(maxZ, p.z + fillPad);
    }
    minX = Math.max(2, minX - 10); maxX = Math.min(SX - 2, maxX + 10);
    minZ = Math.max(2, minZ - 10); maxZ = Math.min(SZ - 2, maxZ + 10);

    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let y = floorY; y <= floorY + 9; y++) this.setRaw(x, y, z, style.wall);
      }
    }

    const carveDisc = (cx0, cz0, r, airH) => {
      const r2 = r * r;
      const h = airH + Math.floor(rnd() * 2);
      const span = Math.ceil(r);
      for (let dz = -span; dz <= span; dz++) {
        for (let dx = -span; dx <= span; dx++) {
          if (dx * dx + dz * dz > r2) continue;
          const x = Math.floor(cx0 + dx), z = Math.floor(cz0 + dz);
          if (x < 2 || z < 2 || x >= SX - 2 || z >= SZ - 2) continue;
          for (let y = floorY; y < floorY + h; y++) this.setRaw(x, y, z, 0);
          this.setRaw(x, floorY - 1, z, rnd() < 0.12 ? style.accents[0] : style.floor);
          this.setRaw(x, floorY + h, z, style.ceil);
          this.heights[x + z * SX] = floorY - 1;
        }
      }
    };

    for (const p of path) carveDisc(p.x + 0.5, p.z + 0.5, p.r, style.caveH);
    carveDisc(end.x + 0.5, end.z + 0.5, style.bossR, style.bossH);

    // сталактиты по краям
    for (let i = 6; i < path.length - 8; i += 4) {
      const p = path[i];
      if (rnd() < 0.5) {
        const a = rnd() * Math.PI * 2;
        const rr = p.r + 1.2;
        const x = Math.floor(p.x + Math.cos(a) * rr);
        const z = Math.floor(p.z + Math.sin(a) * rr);
        if (this.get(x, floorY, z) === 0) this.setRaw(x, floorY + 3, z, style.ceil);
      }
    }

    // акцентные жилы в стенах — у каждого босса свой камень
    for (let i = 10; i < path.length - 10; i += 9) {
      const p = path[i];
      const a0 = rnd() * Math.PI * 2;
      for (const a of [a0, a0 + Math.PI]) {
        const rr = p.r + 0.7;
        const x = Math.floor(p.x + Math.cos(a) * rr);
        const z = Math.floor(p.z + Math.sin(a) * rr);
        const id = style.accents[Math.floor(rnd() * style.accents.length)];
        for (let y = floorY; y < floorY + 3; y++) {
          if (this.isSolid(x, y, z)) this.setRaw(x, y, z, id);
        }
      }
    }

    // свет по маршруту
    this.lights.push({ x: start.x + 0.5, y: floorY + 2.2, z: start.z + 0.5, color: style.light, intensity: 2.4 });
    for (const f of [0.18, 0.34, 0.5, 0.66, 0.82]) {
      const p = path[Math.floor(f * (path.length - 1))];
      this.lights.push({ x: p.x + 0.5, y: floorY + 2.2, z: p.z + 0.5, color: style.light, intensity: 2.2 });
    }
    this.lights.push({ x: end.x + 0.5, y: floorY + 3, z: end.z + 0.5, color: style.light, intensity: 2.8 });
    this.lights.push({ x: end.x - 6.5, y: floorY + 2.6, z: end.z + 4.5, color: style.light, intensity: 2.2 });

    // точки прихвостней вдоль пути: только внутри пещеры, не на крыше
    const spawns = [];
    for (let i = 6; i < path.length - 10; i += 1) {
      const p = path[i];
      if (Math.hypot(p.x - start.x, p.z - start.z) < 14) continue;
      for (let attempt = 0; attempt < 6; attempt++) {
        const a = rnd() * Math.PI * 2;
        const rr = rnd() * 1.4;
        const x = Math.floor(p.x + Math.cos(a) * rr);
        const z = Math.floor(p.z + Math.sin(a) * rr);
        if (this.get(x, floorY, z) !== 0 || this.get(x, floorY + 1, z) !== 0) continue;
        if (!this.isSolid(x, floorY - 1, z)) continue;
        spawns.push({ x: x + 0.5, y: floorY + 0.1, z: z + 0.5 });
        break;
      }
      if (spawns.length >= style.minions) break;
    }

    // награда за спиной босса
    const bx = end.x, bz = end.z;
    const dl = Math.hypot(dirX, dirZ) || 1;
    const fx = dirX / dl, fz = dirZ / dl;
    const sideX = -fz, sideZ = fx;

    this.spawnPoints = spawns.slice(0, style.minions);
    this.dungeon = {
      path: path.map((p) => ({ x: p.x, z: p.z })),
      minions: style.minions,
      atmosphere: {
        fog: style.fog,
        hemiSky: style.hemiSky,
        hemiGround: style.hemiGround,
        hemiIntensity: style.hemi,
        light: style.light,
        lightIntensity: 0.95,
      },
      start: { x: start.x + 0.5, y: floorY + 0.2, z: start.z + 0.5 },
      boss: { x: bx + 0.5, y: floorY + 0.1, z: bz + 0.5 },
      portal: { x: bx + fx * 7 + sideX * 4, y: floorY, z: bz + fz * 7 + sideZ * 4 },
      spawns: spawns.slice(0, style.minions),
      caveH: style.caveH,
      chests: [
        { x: Math.floor(bx + fx * 6 + sideX * -3), y: floorY, z: Math.floor(bz + fz * 6 + sideZ * -3) },
        { x: Math.floor(bx + fx * 6 + sideX * 3), y: floorY, z: Math.floor(bz + fz * 6 + sideZ * 3) },
        { x: Math.floor(bx + fx * 8), y: floorY, z: Math.floor(bz + fz * 8) },
      ],
    };
  }

  initRenderer(scene) {
    if (!this.atlas) return;
    this.material = new THREE.MeshLambertMaterial({
      map: this.atlas.texture,
      vertexColors: true,
    });
    this.crystalGeo = new THREE.ConeGeometry(1, 2, 5);
    this.crystalMaterial = new THREE.MeshLambertMaterial({
      color: 0x9ff4ff, emissive: 0x1a6a7a, emissiveIntensity: 0.9, flatShading: true,
    });
    scene.add(this.group);
    for (let cz = 0; cz < SZ / CHUNK; cz++) {
      for (let cx = 0; cx < SX / CHUNK; cx++) {
        this.rebuildChunk(cx, cz);
      }
    }
    this.buildFenceMesh();
  }

  rebuildChunk(cx, cz) {
    const key = cx + ',' + cz;
    const old = this.chunkMeshes.get(key);
    if (old) {
      this.group.remove(old);
      old.geometry.dispose();
      this.chunkMeshes.delete(key);
    }
    const geo = this.buildChunkGeometry(cx, cz);
    if (!geo) { this.buildCrystalMesh(cx, cz); return; }
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    this.group.add(mesh);
    this.chunkMeshes.set(key, mesh);
    this.buildCrystalMesh(cx, cz);
  }

  // Кристаллы рисуются не кубами, а острыми осколками поверх блока.
  buildCrystalMesh(cx, cz) {
    const key = cx + ',' + cz;
    const old = this.crystalMeshes.get(key);
    if (old) {
      this.group.remove(old);
      old.dispose();
      this.crystalMeshes.delete(key);
    }
    if (!this.crystalGeo || !this.crystalMaterial) return;
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    const cells = [];
    for (let y = 0; y < SY; y++) {
      for (let z = z0; z < z0 + CHUNK; z++) {
        for (let x = x0; x < x0 + CHUNK; x++) {
          if (this.get(x, y, z) !== B.CRYSTAL) continue;
          cells.push([x, y, z]);
        }
      }
    }
    if (!cells.length) return;

    const mats = [];
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const add = (px, py, pz, h, r, ex, ey, ez) => {
      e.set(ex, ey, ez);
      q.setFromEuler(e);
      p.set(px, py, pz);
      s.set(r, h / 2, r);
      m.compose(p, q, s);
      mats.push(m.clone());
    };
    const dirs = [
      { dx: 1, dz: 0, rot: [0, 0, -1.05] },
      { dx: -1, dz: 0, rot: [0, 0, 1.05] },
      { dx: 0, dz: 1, rot: [1.05, 0, 0] },
      { dx: 0, dz: -1, rot: [-1.05, 0, 0] },
    ];

    for (const [x, y, z] of cells) {
      const hx = hash2(x, z, this.seed + 501);
      const hz = hash2(z, x, this.seed + 502);
      if (this.get(x, y + 1, z) === 0) {
        for (let k = 0; k < 4; k++) {
          const h = 0.45 + hash2(x + k * 7, z + k * 11, this.seed + 503) * 0.75;
          const r = 0.09 + hash2(x + k * 3, z + k * 5, this.seed + 504) * 0.08;
          const ox = (k === 0 ? 0 : Math.cos(k * 2.1 + hx * 6) * 0.24) + (hx - 0.5) * 0.1;
          const oz = (k === 0 ? 0 : Math.sin(k * 2.1 + hz * 6) * 0.24) + (hz - 0.5) * 0.1;
          add(x + 0.5 + ox, y + 1 + h / 2 - 0.12, z + 0.5 + oz, h, r,
            (hx - 0.5) * 0.35, hx * Math.PI * 2, (hz - 0.5) * 0.35);
        }
      }
      // осколки, торчащие из открытых боковых граней
      for (const d of dirs) {
        if (this.get(x + d.dx, y, z + d.dz) !== 0) continue;
        if (hash2(x + d.dx * 13, z + d.dz * 17, this.seed + 505) < 0.35) continue;
        const h = 0.35 + hash2(x + d.dx * 3, z + d.dz * 5, this.seed + 506) * 0.45;
        const r = 0.07 + hash2(x + d.dz * 7, z + d.dx * 11, this.seed + 507) * 0.05;
        add(
          x + 0.5 + d.dx * 0.52, y + 0.5 + (hash2(x, z, this.seed + 508) - 0.5) * 0.3, z + 0.5 + d.dz * 0.52,
          h, r, d.rot[0], d.rot[1], d.rot[2]
        );
      }
    }
    if (!mats.length) return;

    const mesh = new THREE.InstancedMesh(this.crystalGeo, this.crystalMaterial, mats.length);
    for (let i = 0; i < mats.length; i++) mesh.setMatrixAt(i, mats[i]);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = false;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.crystalMeshes.set(key, mesh);
  }

  buildChunkGeometry(cx, cz) {
    const pos = [], nor = [], uvs = [], cols = [], ind = [];
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    let vcount = 0;
    const atlas = this.atlas;

    for (let y = 0; y < SY; y++) {
      for (let z = z0; z < z0 + CHUNK; z++) {
        for (let x = x0; x < x0 + CHUNK; x++) {
          const id = this.get(x, y, z);
          if (!id) continue;
          const def = BLOCKS[id];
          if (!def) continue;
          const tintRGB = this.blockTint(def);
          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const nx = x + face.n[0], ny = y + face.n[1], nz = z + face.n[2];
            if (this.isSolid(nx, ny, nz)) continue;

            let tile = def.tiles.all;
            if (!tile) {
              if (face.t === 'top') tile = def.tiles.top;
              else if (face.t === 'bottom') tile = def.tiles.bottom;
              else tile = def.tiles.side;
            }
            const uv = atlas.uv(tile || 'stone');
            const tint = 0.94 + ((hash2(x, z + y * 17, this.seed + 3) * 10) | 0) * 0.012;

            // ambient occlusion, per corner
            const axis = face.n[0] !== 0 ? 0 : face.n[1] !== 0 ? 1 : 2;
            const t1 = (axis + 1) % 3, t2 = (axis + 2) % 3;
            const bs = [x + face.n[0], y + face.n[1], z + face.n[2]];

            for (let ci = 0; ci < 4; ci++) {
              const c = face.corners[ci];
              pos.push(x + c[0], y + c[1], z + c[2]);
              nor.push(face.n[0], face.n[1], face.n[2]);

              const su = c[t1] === 1 ? 1 : -1;
              const sv = c[t2] === 1 ? 1 : -1;
              const p1 = bs.slice(); p1[t1] += su;
              const p2 = bs.slice(); p2[t2] += sv;
              const p3 = bs.slice(); p3[t1] += su; p3[t2] += sv;
              const s1 = this.isSolid(p1[0], p1[1], p1[2]) ? 1 : 0;
              const s2 = this.isSolid(p2[0], p2[1], p2[2]) ? 1 : 0;
              const s3 = this.isSolid(p3[0], p3[1], p3[2]) ? 1 : 0;
              const ao = (s1 && s2) ? 0 : 3 - (s1 + s2 + s3);
              const light = AO_BRIGHT[ao] * face.shade * tint;
              cols.push(light * tintRGB[0], light * tintRGB[1], light * tintRGB[2]);

              if (ci === 0) uvs.push(uv[0], uv[1]);
              else if (ci === 1) uvs.push(uv[2], uv[1]);
              else if (ci === 2) uvs.push(uv[2], uv[3]);
              else uvs.push(uv[0], uv[3]);
            }
            ind.push(vcount, vcount + 1, vcount + 2, vcount, vcount + 2, vcount + 3);
            vcount += 4;
          }
        }
      }
    }

    if (!ind.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(ind), 1));
    g.computeBoundingSphere();
    return g;
  }

  rebuildDirty(max = 3) {
    let n = 0;
    for (const key of this.dirty) {
      const [cx, cz] = key.split(',').map(Number);
      this.rebuildChunk(cx, cz);
      this.dirty.delete(key);
      if (++n >= max) break;
    }
  }

  /* ---------------- queries ---------------- */
  raycast(origin, dir, maxDist = 64) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = Math.sign(dir.x), stepY = Math.sign(dir.y), stepZ = Math.sign(dir.z);
    const invX = dir.x !== 0 ? 1 / Math.abs(dir.x) : Infinity;
    const invY = dir.y !== 0 ? 1 / Math.abs(dir.y) : Infinity;
    const invZ = dir.z !== 0 ? 1 / Math.abs(dir.z) : Infinity;
    let tMaxX = dir.x === 0 ? Infinity : ((stepX > 0 ? x + 1 - origin.x : origin.x - x) * invX);
    let tMaxY = dir.y === 0 ? Infinity : ((stepY > 0 ? y + 1 - origin.y : origin.y - y) * invY);
    let tMaxZ = dir.z === 0 ? Infinity : ((stepZ > 0 ? z + 1 - origin.z : origin.z - z) * invZ);
    let nx = 0, ny = 0, nz = 0;
    let t = 0;

    if (this.isSolid(x, y, z)) return { x, y, z, nx: 0, ny: 1, nz: 0, dist: 0, id: this.get(x, y, z) };

    while (t <= maxDist) {
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += invX; nx = -stepX; ny = 0; nz = 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += invY; nx = 0; ny = -stepY; nz = 0;
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += invZ; nx = 0; ny = 0; nz = -stepZ;
      }
      if (t > maxDist) break;
      const id = this.get(x, y, z);
      if (id) return { x, y, z, nx, ny, nz, dist: t, id };
    }
    return null;
  }

  aabbSolid(minX, minY, minZ, maxX, maxY, maxZ) {
    const x0 = Math.floor(minX + 1e-5), x1 = Math.floor(maxX - 1e-5);
    const y0 = Math.floor(minY + 1e-5), y1 = Math.floor(maxY - 1e-5);
    const z0 = Math.floor(minZ + 1e-5), z1 = Math.floor(maxZ - 1e-5);
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++)
          if (this.isSolid(x, y, z)) return true;
    if (this.fenceAt) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          if (x < 0 || x >= SX || z < 0 || z >= SZ) continue;
          const base = this.fenceAt[x + z * SX];
          if (base >= 0 && maxY > base + 0.1 && minY < base + 1.5) return true;
        }
      }
    }
    return false;
  }

  /* ---------------- minimap ---------------- */
  makeMapCanvas() {
    if (this._mapCanvas) return this._mapCanvas;
    const c = document.createElement('canvas');
    c.width = SX; c.height = SZ;
    const g = c.getContext('2d');
    const img = g.createImageData(SX, SZ);
    const d = img.data;
    for (let z = 0; z < SZ; z++) {
      for (let x = 0; x < SX; x++) {
        const h = this.heights[x + z * SX];
        const i = (x + z * SX) * 4;
        if (h < 0) { d[i + 3] = 0; continue; }
        const top = this.get(x, h, z) || B.STONE;
        const hex = parseInt((BLOCKS[top]?.color || '#777').slice(1), 16);
        let r = (hex >> 16) & 255, gg = (hex >> 8) & 255, b = hex & 255;
        const shade = 0.62 + clamp((h - 10) / 40, 0, 1) * 0.5;
        const n = 0.9 + hash2(x, z, this.seed + 91) * 0.2;
        r = clamp(r * shade * n, 0, 255);
        gg = clamp(gg * shade * n, 0, 255);
        b = clamp(b * shade * n, 0, 255);
        d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    this._mapCanvas = c;
    return c;
  }

  dispose() {
    for (const m of this.chunkMeshes.values()) m.geometry.dispose();
    this.chunkMeshes.clear();
    for (const m of this.crystalMeshes.values()) {
      this.group.remove(m);
      m.dispose();
    }
    this.crystalMeshes.clear();
    if (this.crystalGeo) { this.crystalGeo.dispose(); this.crystalGeo = null; }
    if (this.crystalMaterial) { this.crystalMaterial.dispose(); this.crystalMaterial = null; }
    if (this.material) this.material.dispose();
    if (this.fenceGroup) {
      const geos = new Set();
      const mats = new Set();
      this.fenceGroup.traverse(o => {
        if (o.geometry) geos.add(o.geometry);
        if (o.material) mats.add(o.material);
      });
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      this.group.remove(this.fenceGroup);
      this.fenceGroup = null;
    }
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}
