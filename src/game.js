import * as THREE from '../vendor/three.module.js';
import {
  B, BLOCKS, SLOT, WEAPONS, MOBS, WAVES, LOOT, SHOP, COIN_VALUE,
  CHEST_COUNT, PLAYER, ISLAND_CENTER, ARMOR_SETS, ARMOR_SLOTS, ARMOR_SET_ORDER, ARMOR_DROP,
  HAZARD, ZONE, ZONE_NAMES,
  RUN_MODES, ENDLESS, DIFFICULTIES, DIFFICULTY_BY_ID,
  WEAPON_PARTS, WEAPON_PAINTS, WEAPON_UPGRADE, AIRSHIP, LOOT_REFRESH, ALIEN_SHOP, BOSS_ORDER,
} from './config.js';
import { createAtlas, makeGlowTexture, makeSunTexture, makeMoonTexture } from './textures.js';
import { World, worldStyleFor } from './world.js';
import { Effects } from './effects.js';
import { Sound } from './audio.js';
import { Player } from './player.js';
import { Mob, Chest, Projectile, Pickup, PlayerAvatar, Merchant, GunsmithBench, AlienMerchant } from './entities.js';
import { UI } from './ui.js';
import { Net } from './net.js';
import { loadTurn, saveTurn } from './rtc.js';

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const fmt = (s) => {
  s = Math.max(0, Math.ceil(s));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};

const SUN_DIR = new THREE.Vector3(0.55, 0.78, 0.34).normalize();
const MOON_DIR = new THREE.Vector3(-0.5, 0.62, -0.42).normalize();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _q = new THREE.Quaternion();

function rayAABB(o, d, min, max) {
  let tmin = 0, tmax = 1e9;
  for (let a = 0; a < 3; a++) {
    const oa = a === 0 ? o.x : a === 1 ? o.y : o.z;
    const da = a === 0 ? d.x : a === 1 ? d.y : d.z;
    const lo = a === 0 ? min.x : a === 1 ? min.y : min.z;
    const hi = a === 0 ? max.x : a === 1 ? max.y : max.z;
    if (Math.abs(da) < 1e-7) {
      if (oa < lo || oa > hi) return null;
    } else {
      let t1 = (lo - oa) / da, t2 = (hi - oa) / da;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

export class Game {
  constructor() {
    this.canvas = $('game');
    const dpr = window.devicePixelRatio || 1;
    const budget = 2_200_000;
    const resCap = Math.sqrt(budget / Math.max(1, window.innerWidth * window.innerHeight));
    this.basePixelRatio = Math.max(0.5, Math.min(dpr, 1.35, resCap));
    this.renderScale = 1;
    this.perf = { acc: 0, frames: 0, timer: 0, lowStreak: 0, lowered: false };
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: this.basePixelRatio <= 1.15, powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(this.basePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0xcfe4f5, 1);
    this.shadowFrame = 0;
    this.shadowDirty = true;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xd2e5f6, 160, 520);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.05, 950);
    this.camera.rotation.order = 'YXZ';

    this.viewScene = new THREE.Scene();
    this.viewCamera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.01, 6);
    this.viewScene.add(this.viewCamera);
    this.viewScene.add(new THREE.AmbientLight(0xffffff, 0.95));
    const vl = new THREE.DirectionalLight(0xfff3dc, 1.05);
    vl.position.set(1.4, 2.4, 1.2);
    this.viewScene.add(vl);
    const vl2 = new THREE.DirectionalLight(0x9ecfff, 0.4);
    vl2.position.set(-2, 0.5, 1.5);
    this.viewScene.add(vl2);

    this.time = 0;
    this.last = performance.now();
    this.state = 'menu';
    this.runActive = false;
    this.needWorldReset = false;
    this.ended = false;
    this.helpOpen = false;
    this.sensitivity = 0.0022;
    this.kills = 0;
    this.chestsLooted = 0;
    this.runTime = 0;
    this.waveIndex = -1;
    this.phase = 'prep';
    this.phaseTime = 0;
    this.waveElapsed = 0;
    this.spawnQueue = [];
    this.spawnIndex = 0;
    this.bossMob = null;
    this.selectedMode = 'campaign';
    this.selectedDifficulty = 'normal';
    this.runMode = 'campaign';
    this.difficultyId = 'normal';
    this.difficultyCfg = DIFFICULTY_BY_ID.normal;
    this.endlessIndex = 0;
    this.dying = false;
    this.nextEntityId = 0;
    this.mobs = [];
    this.chests = [];
    this.pickups = [];
    this.projectiles = [];
    this.worldLights = [];
    this.clouds = [];
    this.compassTimer = 0;
    this.helpTimer = 0;
    this.input = { keys: {}, jumpPressed: false };
    this.frame = 0;

    this.net = new Net(this);
    this.netRole = null;
    this.peerJoined = false;
    this.remote = { pos: new THREE.Vector3(), yaw: 0, hp: 100, alive: true, ready: false };
    this.avatar = null;
    this.netSnapTimer = 0;
    this.netPosTimer = 0;
    this.lastSnap = null;
    this.respawnTimer = 0;
    this.coopWipeSent = false;
    this.lobbyCode = null;
    this.guestPhaseTime = 0;
    this.waveActive = false;
    this.inventoryOpen = false;
    this.remoteInventory = false;
    this.remoteModalKind = 'inventory';
    this.shopOpen = false;
    this.nearMerchant = false;
    this.merchant = null;
    this.benches = [];
    this.benchOpen = false;
    this.nearBench = null;
    this.activeBench = null;
    this.selectedBenchWeapon = null;
    this.alien = null;
    this.nearAlien = false;
    this.alienShopOpen = false;
    this.airshipRaided = false;
    this.lootTimer = LOOT_REFRESH;
    this.invTarget = 0;
    this.barTimer = 0;
    this.zoneTimer = 0;
    this.radTick = 0;
    this.magmaTick = 0;
    this.wireTick = 0;
    this.zoneParticleTimer = 0;
    this.zoneFeedCd = 0;
    this.currentZone = ZONE.NORMAL;

    this.createSky();
    this.createClouds();
    this.createDistantIslands();
    this.atlas = createAtlas();
    this.seed = (Math.random() * 1e9) | 0;
    this.createWorld(this.seed);
    this.effects = new Effects(this.scene, this.world);
    this.projectileTex = makeGlowTexture('255,235,170', '255,120,50');
    this.sound = new Sound();
    this.ui = new UI(this);
    this.player = new Player(this);
    this.createChests();
    this.spawnPlayer();
    this.placeMerchant();
    this.placeBenches();
    this.ui.setHudVisible(false);
    this.bindEvents();
    this.updateHotbar();
    this.updateHealth();
    this.updateAmmo();
    this.ui.updateChests(CHEST_COUNT, 0);
    this.ui.setWave('СБОР', 'ПОДГОТОВКА', 'Соберите лут и постройте укрепления', '00:46', false);
    this.camera.position.set(ISLAND_CENTER.x + 190, 104, ISLAND_CENTER.z + 190);
    this.camera.lookAt(ISLAND_CENTER.x, 32, ISLAND_CENTER.z);
    this.camera.fov = 58;
    this.camera.updateProjectionMatrix();

    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
    });

    $('loading').classList.add('hidden');
    window.game = this;
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  /* ================= world & scene ================= */
  createWorld(seed, edits = null) {
    this.seed = seed;
    if (this.world) {
      this.world.dispose();
      this.world = null;
    }
    this.world = new World(seed);
    this.world.generate(this.atlas);
    this.applyAtmosphere(this.world.skyTheme, this.world.palette);
    if (edits) {
      for (const e of edits) {
        if (!Array.isArray(e) || e.length < 4) continue;
        this.world.setBlock(e[0], e[1], e[2], e[3], true);
      }
    }
    this.world.initRenderer(this.scene);
    if (this.effects) this.effects.world = this.world;
    this.createWorldLights();
  }

  createWorldLights() {
    for (const wl of this.worldLights) {
      if (wl.light) this.scene.remove(wl.light);
      this.scene.remove(wl.sprite);
      wl.sprite.material.dispose();
    }
    this.worldLights = [];
    this.world.lights.forEach((data, index) => {
      let light = null;
      if (index < 4) {
        light = new THREE.PointLight(data.color, data.intensity * 4.5, 16, 2);
        light.position.set(data.x, data.y, data.z);
        this.scene.add(light);
      }
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGlowTexture('255,230,180', '255,150,60'),
        color: data.color, transparent: true, opacity: index < 4 ? 0.5 : 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      sprite.position.set(data.x, data.y, data.z);
      sprite.scale.setScalar(index < 4 ? 2.4 : 1.8);
      this.scene.add(sprite);
      this.worldLights.push({ light, sprite, base: data.intensity * 4.5, phase: Math.random() * 10 });
    });
  }

  createSky() {
    const geo = new THREE.SphereGeometry(720, 32, 20);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x2f6fbf) },
        mid: { value: new THREE.Color(0xa8d3ef) },
        low: { value: new THREE.Color(0xe7f1fa) },
      },
      vertexShader: `
        varying vec3 vPos;
        void main(){
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        varying vec3 vPos;
        uniform vec3 top; uniform vec3 mid; uniform vec3 low;
        void main(){
          float h = normalize(vPos).y;
          vec3 c = mix(mid, top, smoothstep(0.02, 0.72, h));
          c = mix(low, c, smoothstep(-0.18, 0.03, h));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    const sunMat = new THREE.SpriteMaterial({
      map: makeSunTexture(), transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    this.sun = new THREE.Sprite(sunMat);
    this.sun.scale.setScalar(105);
    this.scene.add(this.sun);

    const moonMat = new THREE.SpriteMaterial({
      map: makeMoonTexture(), transparent: true, opacity: 0.96,
      depthWrite: false, fog: false,
    });
    this.moon = new THREE.Sprite(moonMat);
    this.moon.scale.setScalar(78);
    this.moon.visible = false;
    this.scene.add(this.moon);

    // stars
    const starCount = 760;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const y = -0.15 + Math.random() * 1.13;
      const r = Math.sqrt(Math.max(0.02, 1 - y * y));
      starPos[i * 3] = Math.cos(a) * r * 640;
      starPos[i * 3 + 1] = y * 640;
      starPos[i * 3 + 2] = Math.sin(a) * r * 640;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({
      map: makeGlowTexture('255,255,255', '170,190,255', 32),
      color: 0xffffff, size: 3.2, sizeAttenuation: false,
      transparent: true, opacity: 0.9, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false,
    });
    this.stars = new THREE.Points(starGeo, starMat);
    this.stars.renderOrder = -9;
    this.stars.frustumCulled = false;
    this.stars.visible = false;
    this.scene.add(this.stars);

    this.meteors = [];
    this.meteorTimer = 2.5;

    this.hemi = new THREE.HemisphereLight(0xd4eaff, 0x7d6c52, 1.55);
    this.scene.add(this.hemi);

    this.sunLight = new THREE.DirectionalLight(0xfff0d2, 2.7);
    this.sunLight.position.set(ISLAND_CENTER.x + 64, 136, ISLAND_CENTER.z + 42);
    this.sunLight.target.position.set(ISLAND_CENTER.x, 36, ISLAND_CENTER.z);
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    const sc = this.sunLight.shadow.camera;
    sc.left = -72; sc.right = 72; sc.top = 72; sc.bottom = -72;
    sc.near = 1; sc.far = 280;
    this.sunLight.shadow.bias = -0.0008;
    this.sunLight.shadow.normalBias = 0.035;

    this.muzzleLight = new THREE.PointLight(0xffc36b, 0, 14, 2);
    this.scene.add(this.muzzleLight);
  }

  applyAtmosphere(theme = this.world?.skyTheme, palette = this.world?.palette) {
    if (!theme) return;
    this.theme = theme;
    this.palette = palette;
    const u = this.sky.material.uniforms;
    u.top.value.setHex(theme.top);
    u.mid.value.setHex(theme.mid);
    u.low.value.setHex(theme.low);
    this.scene.fog.color.setHex(theme.fog);
    this.scene.fog.near = theme.fogNear ?? 160;
    this.scene.fog.far = theme.fogFar ?? 520;
    this.baseFogColor = new THREE.Color(theme.fog);
    this.zoneFogColor = this.baseFogColor.clone();

    this.sun.visible = !!theme.sun;
    this.sun.material.color.setHex(theme.sunColor ?? 0xffd27a);
    this.sun.scale.setScalar(theme.sunSize ?? 105);
    this.moon.visible = !!theme.moon;
    this.moon.material.color.setHex(theme.moonColor ?? 0xdfe9ff);
    this.stars.visible = !!theme.stars;
    this.meteorsEnabled = !!theme.meteors;

    this.hemi.color.setHex(theme.hemiSky);
    this.hemi.groundColor.setHex(theme.hemiGround);
    this.hemi.intensity = theme.hemiIntensity ?? 1.55;
    this.sunLight.color.setHex(theme.light);
    this.sunLight.intensity = theme.lightIntensity ?? 2.7;

    if (this.cloudMat) {
      this.cloudMat.color.setHex(theme.cloud ?? 0xffffff);
      this.cloudMat.emissive.setHex(theme.cloudEmissive ?? 0xbcd2e6);
      this.cloudMat.opacity = theme.cloudOpacity ?? 0.9;
    }
    if (this.meteors) {
      for (const m of this.meteors) {
        this.scene.remove(m.line);
        if (m.head) this.scene.remove(m.head);
        m.line.geometry.dispose();
        m.line.material.dispose();
        if (m.head) m.head.material.dispose();
      }
      this.meteors = [];
    }
    this.meteorTimer = this.meteorsEnabled ? 0.6 : 0;
  }

  createClouds() {
    const mat = new THREE.MeshLambertMaterial({
      color: 0xffffff, emissive: 0xbcd2e6, emissiveIntensity: 0.35,
      transparent: true, opacity: 0.9,
    });
    this.cloudMat = mat;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group();
      const n = 2 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(geo, mat);
        m.scale.set(rand(8, 18), rand(2.4, 4.4), rand(6, 14));
        m.position.set(rand(-10, 10), rand(-1, 1.6), rand(-8, 8));
        g.add(m);
      }
      g.position.set(ISLAND_CENTER.x + rand(-260, 260), rand(120, 165), ISLAND_CENTER.z + rand(-260, 260));
      this.scene.add(g);
      this.clouds.push({ group: g, speed: rand(0.5, 1.5) });
    }
  }

  createDistantIslands() {
    const stone = new THREE.MeshLambertMaterial({ color: 0x7c7569 });
    const grass = new THREE.MeshLambertMaterial({ color: 0x6f9a4c });
    const darkStone = new THREE.MeshLambertMaterial({ color: 0x5e5850 });
    const leaf = new THREE.MeshLambertMaterial({ color: 0x3f7133 });
    const trunk = new THREE.MeshLambertMaterial({ color: 0x6a4a2c });
    const geo = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      const a = (i / 8) * Math.PI * 2 + rand(-0.2, 0.2);
      const r = rand(210, 390);
      const y = rand(2, 90);
      g.position.set(ISLAND_CENTER.x + Math.cos(a) * r, y, ISLAND_CENTER.z + Math.sin(a) * r);
      g.rotation.y = rand(0, Math.PI);
      const w = rand(7, 20), d = rand(7, 18), dp = rand(8, 26);
      const layers = 2 + Math.floor(rand(0, 3));
      for (let l = 0; l < layers; l++) {
        const s = 1 - l / layers;
        const m = new THREE.Mesh(geo, l === 0 ? grass : (l % 2 ? stone : darkStone));
        m.scale.set(w * s, 2.2, d * s);
        m.position.set(rand(-1, 1), -l * 2.1, rand(-1, 1));
        g.add(m);
      }
      // hanging tip
      const tip = new THREE.Mesh(geo, darkStone);
      tip.scale.set(w * 0.16, dp * 0.5, d * 0.16);
      tip.position.y = -layers * 2.1 - dp * 0.25;
      g.add(tip);
      if (i % 2 === 0) {
        const t = new THREE.Mesh(geo, trunk);
        t.scale.set(1.2, 5, 1.2);
        t.position.set(rand(-2, 2), 3.4, rand(-2, 2));
        g.add(t);
        const c = new THREE.Mesh(geo, leaf);
        c.scale.set(6, 3, 6);
        c.position.set(t.position.x, 6.5, t.position.z);
        g.add(c);
      }
      this.scene.add(g);
    }
  }

  createChests() {
    for (const c of this.chests) c.dispose();
    this.chests = [];
    for (const data of this.world.chests) {
      data.looted = false;
      this.chests.push(new Chest(this, data));
    }
  }

  spawnPlayer() {
    const x = ISLAND_CENTER.x + (this.netRole === 'guest' ? -0.5 : 0.5);
    const z = ISLAND_CENTER.z + (this.netRole === 'guest' ? -1.5 : 0.5);
    let y = this.world.groundHeight(x, z);
    if (y < 0) y = 38;
    this.player.spawnAt({ x, y: y + 0.05, z });
    this.player.yaw = 0;
    this.player.pitch = 0;
    this.player.updateCamera(0.016);
    this.ui.updateHealth(this.player);
    this.ui.updateCoins(this.player.coins);
    this.ui.updateHotbar(this.player);
    this.ui.setAmmo(this.player);
  }

  placeMerchant() {
    if (this.merchant) {
      this.merchant.dispose();
      this.merchant = null;
    }
    if (!this.world) return;
    const spot = this.world.findMerchantSpot(this.seed);
    this.merchant = new Merchant(this, spot);
  }

  placeBenches() {
    for (const b of this.benches) b.dispose();
    this.benches = [];
    if (!this.world) return;
    const a = this.world.airship;
    if (a?.bench) {
      this.benches.push(new GunsmithBench(this, { x: a.bench.x + 0.5, y: a.bench.y, z: a.bench.z + 0.5 }));
    }
  }

  spawnAliens() {
    if (this.alien || this.runMode === 'sandbox') return;
    const spot = this.world.findMerchantSpot(this.seed + 7331);
    this.spawnAlienAt(spot);
    this.ui.banner('ПРИШЕЛЬЦЫ', 'ТОРГОВЕЦ ПРИЗЕМЛИЛСЯ', 'Лазерная пушка и плазмоган · 333 монеты', false, 4600);
    this.ui.feed('<b>Пришелец</b> · отмечен на миникарте', true);
    this.sound.tone(660, 0.2, { type: 'sine', gain: 0.1, slide: 990 });
    if (this.netRole === 'host' && this.peerJoined) {
      this.net.send({ t: 'event', kind: 'alien', p: [spot.x, spot.y, spot.z] });
    }
  }

  spawnAlienAt(spot) {
    if (this.alien) this.alien.dispose();
    this.alien = new AlienMerchant(this, spot);
    this.effects.ring(spot.x, spot.y + 0.1, spot.z, 0x8affd0, 9, 0.9);
    this.effects.flash(spot.x, spot.y + 2.5, spot.z, 0x8affd0, 1.4);
  }

  clearAlien() {
    if (this.alien) {
      this.alien.dispose();
      this.alien = null;
    }
    this.nearAlien = false;
    this.alienShopOpen = false;
  }

  clearEntities() {
    this.clearAlien();
    for (const m of this.mobs) m.dispose();
    this.mobs = [];
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh);
      p.mesh.material?.dispose();
    }
    this.projectiles = [];
    for (const p of this.pickups) p.dispose();
    this.pickups = [];
    if (this.effects) this.effects.clear();
    this.bossMob = null;
    this.ui?.hideBoss();
    for (const m of this.mobs) if (m.bar) m.bar.remove();
  }

  regenerateWorld() {
    this.clearEntities();
    this.needWorldReset = false;
    const prevPalette = this.world?.palette?.name;
    const prevTheme = this.world?.skyTheme?.id;
    let seed = (Math.random() * 1e9) | 0;
    for (let i = 0; i < 32; i++) {
      const st = worldStyleFor(seed);
      if (st.palette.name !== prevPalette || st.skyTheme.id !== prevTheme) break;
      seed = (Math.random() * 1e9) | 0;
    }
    this.createWorld(seed);
    this.createChests();
    this.spawnPlayer();
    this.placeMerchant();
    this.placeBenches();
  }

  /* ================= run lifecycle ================= */
  selectMode(mode) {
    if (!RUN_MODES[mode]) return;
    this.selectedMode = mode;
    this.needWorldReset = true;
    this.refreshSetupUi();
    this.sound.tone(520, 0.05, { type: 'square', gain: 0.05 });
  }

  selectDifficulty(id) {
    if (!DIFFICULTY_BY_ID[id]) return;
    this.selectedDifficulty = id;
    this.needWorldReset = true;
    this.refreshSetupUi();
    this.sound.tone(520, 0.05, { type: 'square', gain: 0.05 });
  }

  refreshSetupUi() {
    for (const el of document.querySelectorAll('[data-mode]')) {
      el.classList.toggle('active', el.dataset.mode === this.selectedMode);
    }
    for (const el of document.querySelectorAll('[data-difficulty]')) {
      el.classList.toggle('active', el.dataset.difficulty === this.selectedDifficulty);
    }
    const mode = RUN_MODES[this.selectedMode];
    const diff = DIFFICULTY_BY_ID[this.selectedDifficulty];
    const label = document.getElementById('play-label');
    const sub = document.getElementById('play-sub');
    const tag = document.getElementById('menu-tagline');
    if (label) label.textContent = this.selectedMode === 'sandbox' ? 'ПЕСОЧНИЦА' : 'В БОЙ';
    if (sub) sub.textContent = this.selectedMode === 'sandbox'
      ? 'всё открыто · без ограничений'
      : `${mode.short.toLowerCase()} · ${diff.name.toLowerCase()}`;
    if (tag) tag.textContent = mode.tagline;
  }

  beginRun() {
    if (this.dungeonActive) this.exitDungeon(true);
    this.sound.init();
    this.sound.resume();
    this.sound.startAmbient();
    if (this.needWorldReset) {
      $('loading').classList.remove('hidden');
      this.regenerateWorld();
    }
    $('loading').classList.add('hidden');
    this.runMode = this.selectedMode;
    this.difficultyId = this.selectedDifficulty;
    this.difficultyCfg = DIFFICULTY_BY_ID[this.difficultyId] || DIFFICULTY_BY_ID.normal;
    this.resetRun();
    this.state = 'playing';
    this.runActive = true;
    this.ended = false;
    this.dying = false;
    this.ui.setHudVisible(true);
    $('btn-again').disabled = false;
    $('btn-again').textContent = 'ЕЩЁ РАЗ';
    $('menu').classList.add('hidden');
    $('coop').classList.add('hidden');
    $('pause').classList.add('hidden');
    $('end').classList.add('hidden');
    if (!this.netRole) this.ui.hideFriend();
    this.ui.toggleHelp(false);
    const modeCfg = RUN_MODES[this.runMode];
    const bannerSub = this.runMode === 'endless'
      ? 'Стройте остров · атака каждые 4 минуты'
      : this.runMode === 'sandbox'
        ? 'Все оружие · бесконечные блоки и патроны'
        : 'Соберите лут · постройте укрепления';
    this.ui.banner(modeCfg ? modeCfg.name : 'ПОДГОТОВКА', 'ОСТРОВ В ВАШЕМ РАСПОРЯЖЕНИИ', bannerSub, false, 4600);
    this.sound.tone(392, 0.4, { type: 'sine', gain: 0.09 });
    this.sound.tone(523, 0.5, { type: 'sine', gain: 0.07, delay: 0.15 });
    if (this.world?.palette) {
      this.ui.feed(`<b>${this.world.palette.name}</b> · ${this.world.skyTheme.name}`);
    }
    if (this.netRole === 'host' && this.peerJoined) {
      this.sendWelcome();
      this.ui.feed('<b>Друг в игре</b> · удачной охоты');
    }
    this.requestLock();
  }

  resetRun() {
    this.clearEntities();
    this.createChests();
    this.effects.clear();
    this.kills = 0;
    this.chestsLooted = 0;
    this.runTime = 0;
    this.lootTimer = LOOT_REFRESH;
    this.airshipRaided = false;
    this.waveIndex = this.runMode === 'endless' ? 0 : -1;
    this.endlessIndex = 0;
    if (this.runMode === 'sandbox') {
      this.phase = 'sandbox';
      this.phaseTime = 0;
      this.sandboxTimer = 2.5;
    } else if (this.runMode === 'endless') {
      this.phase = 'endlessPrep';
      this.phaseTime = ENDLESS.firstDelay;
    } else {
      this.phase = 'prep';
      this.phaseTime = WAVES[0].prep;
    }
    this.waveElapsed = 0;
    this.spawnQueue = [];
    this.spawnIndex = 0;
    this.bossMob = null;
    this._bossKey = null;
    this.waveTitle = '';
    this.dungeonActive = false;
    this.dungeonBoss = null;
    this.dungeonPortal = null;
    this.dungeonPortalMesh = null;
    this.islandSave = null;
    this.ended = false;
    this.dying = false;
    this.respawnTimer = 0;
    this.coopWipeSent = false;
    this.netSnapTimer = 0;
    this.netPosTimer = 0;
    this.waveActive = false;
    this.resetInventoryUi();
    this.remote.alive = true;
    this.remote.ready = false;
    if (this.avatar) this.avatar.group.visible = false;
    this.player.reset();
    if (this.runMode === 'sandbox') this.player.grantSandbox();
    this.spawnPlayer();
    this.updateScrollHint();
    this.ui.updateChests(CHEST_COUNT, 0);
    this.ui.updateHealth(this.player);
    this.ui.updateHotbar(this.player);
    this.ui.setAmmo(this.player);
    this.ui.setPrompt(null);
    this.ui.showReload(false);
    this.ui.setMineProgress(0);
    this.ui.hideBoss();
    this.ui.updateCompass('');
    if (this.runMode === 'sandbox') {
      this.ui.setWave('ПЕСОЧНИЦА', 'ВОЛНЫ БЕСКОНЕЧНЫ', 'Стройте, стреляйте, выживайте', '∞', false);
      const first = ['grunt', 'grunt', 'skeleton', 'flyer', 'demon'];
      for (let i = 0; i < 4; i++) this.spawnMob(first[i], this.sandboxSpawnPoint(18, 30));
    } else if (this.runMode === 'endless') {
      this.ui.setWave('АТАКА 1', 'ПОДГОТОВКА', 'Стройте остров · первая атака через 4 минуты', fmt(this.phaseTime), false);
    }
    this.ui.feedEl.innerHTML = '';
    this.compass = '';
    $('banner').classList.add('hidden');
    this.input.keys = {};
    this.input.jumpPressed = false;
  }

  // Финальный босс выбирается по seed: у хоста и гостя он совпадает.
  bossKey() {
    if (this._bossKey) return this._bossKey;
    let h = ((this.seed >>> 0) ^ 0x9e3779b9) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    this._bossKey = BOSS_ORDER[((h ^ (h >>> 16)) >>> 0) % BOSS_ORDER.length];
    return this._bossKey;
  }

  waveTitleFor(i = this.waveIndex) {
    const w = WAVES[i];
    if (!w) return '';
    if (w.bossWave) {
      const boss = MOBS[this.bossKey()];
      return boss ? `${w.title} · ${boss.name}` : w.title;
    }
    return w.title;
  }

  startWave(i) {
    this.waveIndex = i;
    this.phase = 'wave';
    this.waveElapsed = 0;
    this.spawnIndex = 0;
    const w = WAVES[i];
    const q = [];
    let bossName = w.title;
    if (w.bossWave) {
      const key = this.bossKey();
      const boss = MOBS[key];
      const [m1, m2] = boss.minions;
      for (let k = 0; k < 7; k++) {
        q.push({ type: m1, t: k * 2.1 });
        q.push({ type: m2, t: 1.05 + k * 2.1 });
      }
      q.push({ type: key, t: 19 });
      bossName = boss.name;
    } else {
      for (const g of w.groups) {
        for (let k = 0; k < g.count; k++) {
          q.push({ type: g.type, t: (g.delay || 0) + k * g.gap });
        }
      }
    }
    q.sort((a, b) => a.t - b.t);
    this.waveTitle = this.waveTitleFor(i);
    this.spawnQueue = q;
    this.waveActive = true;
    this.sound.waveHorn();
    const name = w.bossWave ? bossName : (w.title.includes('·') ? w.title.split('·')[1].trim() : w.title);
    this.ui.banner(`ШТУРМ ${i + 1} / ${WAVES.length}`, name, w.sub, true, 3600);
    this.ui.setWave(`ШТУРМ ${i + 1} / ${WAVES.length}`, this.waveTitle, 'Врагов осталось', String(q.length), false);
    if (this.netRole === 'host' && this.peerJoined) this.net.send({ t: 'event', kind: 'wave', i });
  }

  startEndlessGroup() {
    this.waveIndex = this.endlessIndex;
    this.phase = 'wave';
    this.waveElapsed = 0;
    this.spawnIndex = 0;
    const size = Math.min(ENDLESS.maxGroup, ENDLESS.minGroup + Math.floor(Math.random() * (ENDLESS.maxGroup - ENDLESS.minGroup + 1)));
    const pool = this.endlessMobPool(this.endlessIndex);
    const q = [];
    for (let i = 0; i < size; i++) {
      let roll = Math.random() * pool.reduce((a, p) => a + p[1], 0);
      let type = pool[0][0];
      for (const [t, w] of pool) {
        if (roll < w) { type = t; break; }
        roll -= w;
      }
      q.push({ type, t: i * rand(0.35, 0.85) });
    }
    q.sort((a, b) => a.t - b.t);
    this.spawnQueue = q;
    this.waveActive = true;
    this.sound.waveHorn();
    this.ui.banner(`АТАКА ${this.endlessIndex + 1}`, `ГРУППА ИЗ ${size}`, 'Держите оборону · остров ваш', true, 3600);
    this.ui.setWave(`АТАКА ${this.endlessIndex + 1}`, 'ВРАГИ ИДУТ', 'Осталось', String(size), false);
    if (this.netRole === 'host' && this.peerJoined) {
      this.net.send({ t: 'event', kind: 'endless', i: this.endlessIndex, size });
    }
  }

  endlessMobPool(n) {
    const pool = [['grunt', 5]];
    if (n >= 0) pool.push(['skeleton', 2]);
    if (n >= 1) pool.push(['flyer', 2]);
    if (n >= 2) pool.push(['demon', 2]);
    if (n >= 3) pool.push(['gargoyle', 1.6]);
    if (n >= 5) pool.push(['brute', 1.3]);
    if (n >= 7) pool.push(['troll', 0.7]);
    if (n >= 10 && n % 5 === 0) pool.push(['boss', 0.25]);
    return pool;
  }

  clearWave() {
    if (this.runMode === 'endless') {
      this.waveActive = false;
      this.endlessIndex++;
      this.waveIndex = this.endlessIndex;
      this.phase = 'endlessPrep';
      this.phaseTime = ENDLESS.interval;
      this.sound.waveClear();
      this.ui.banner('АТАКА ОТБИТА', 'ПЕРЕДЫШКА', 'Следующая группа через 4 минуты', false, 3000);
      this.player.heal(15);
      this.player.addAmmoAll(0.35);
      this.ui.feed('<b>+15 HP</b> · передышка');
      this.ui.feed('<b>Боезапас пополнен</b>');
      this.updateHotbar();
      this.updateAmmo();
      if (this.netRole === 'host' && this.peerJoined) this.net.send({ t: 'event', kind: 'clear', mode: 'endless' });
      if (this.endlessIndex === 2) this.spawnAliens();
      return;
    }
    this.waveActive = false;
    if (this.waveIndex >= WAVES.length - 1) {
      if (this.ended) return;
      this.ended = true;
      this.ui.banner('ОСТРОВ ЦЕЛ', 'ПОСЛЕДНЯЯ ВОЛНА ОТБИТА', 'Титан пал. Небо снова тихое.', false, 4200);
      this.sound.waveClear();
      this.sound.victory();
      if (this.netRole === 'host' && this.peerJoined) this.net.send({ t: 'event', kind: 'clear', final: true });
      setTimeout(() => { if (this.state === 'playing') this.endRun(true); }, 2200);
      return;
    }
    this.phase = 'break';
    this.phaseTime = WAVES[this.waveIndex].between;
    this.ui.banner('ВОЛНА ОТБИТА', 'ПЕРЕДЫШКА', 'Пополните боезапас и заделайте бреши', false, 3000);
    this.sound.waveClear();
    this.player.heal(15);
    this.player.addAmmoAll(0.35);
    this.ui.feed('<b>+15 HP</b> · передышка');
    this.ui.feed('<b>Боезапас пополнен</b>');
    this.updateHotbar();
    this.updateAmmo();
    if (this.netRole === 'host' && this.peerJoined) this.net.send({ t: 'event', kind: 'clear' });
    if (this.waveIndex === 1) this.spawnAliens();
  }

  endRun(victory) {
    if (this.state === 'menu') return;
    if (this.dungeonActive) this.exitDungeon(true);
    this.resetInventoryUi();
    if (this.netRole === 'host' && this.peerJoined) {
      this.net.send({ t: victory ? 'victory' : 'defeat' });
    }
    this.state = victory ? 'victory' : 'defeat';
    this.runActive = false;
    this.needWorldReset = true;
    this.dying = false;
    this.player.primaryDown = false;
    this.player.secondaryDown = false;
    this.player.aiming = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.ui.setPrompt(null);
    this.ui.toggleHelp(false);
    const end = $('end');
    end.classList.remove('victory', 'defeat');
    end.classList.add(victory ? 'victory' : 'defeat');
    end.classList.remove('hidden');
    if (this.runMode === 'endless') {
      $('end-kicker').textContent = 'БЕСКОНЕЧНЫЙ РЕЖИМ';
      $('end-title').textContent = 'ОСТРОВ ПАЛ';
      $('end-sub').textContent = `Вы отбили ${this.endlessIndex} атак. В следующий раз продержитесь дольше.`;
      $('stat-waves-label').textContent = 'АТАКИ';
      $('stat-waves').textContent = String(this.endlessIndex);
    } else {
      $('end-kicker').textContent = victory ? 'ОПЕРАЦИЯ ЗАВЕРШЕНА' : 'СИГНАЛ ПОТЕРЯН';
      $('end-title').textContent = victory ? 'ОСТРОВ ВЫСТОЯЛ' : 'ОСТРОВ ПАЛ';
      $('end-sub').textContent = victory
        ? 'Три волны. Разбитые укрепления. И вы всё ещё дышите.'
        : 'Волны оказались сильнее. В следующий раз — больше стен и больше патронов.';
      $('stat-waves-label').textContent = 'ВОЛНЫ';
      $('stat-waves').textContent = `${victory ? 3 : Math.max(0, this.waveIndex + (this.phase === 'wave' ? 1 : 0))} / 3`;
    }
    $('stat-kills').textContent = String(this.kills);
    $('stat-chests').textContent = `${this.chestsLooted} / ${CHEST_COUNT}`;
    $('stat-blocks').textContent = `${this.player.stats.placed} / ${this.player.stats.mined}`;
    const acc = this.player.stats.shots > 0 ? Math.min(100, Math.round((this.player.stats.hits / this.player.stats.shots) * 100)) : 0;
    $('stat-acc').textContent = acc + '%';
    $('stat-time').textContent = fmt(this.runTime);
    const again = $('btn-again');
    again.disabled = this.netRole === 'guest';
    again.textContent = this.netRole === 'guest' ? 'ЖДЁМ ХОЗЯИНА' : 'ЕЩЁ РАЗ';
    this.ui.setHudVisible(true);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.player.primaryDown = false;
    this.player.secondaryDown = false;
    this.player.aiming = false;
    $('btn-restart').style.display = this.netRole === 'guest' ? 'none' : '';
    $('pause').classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.ui.toggleHelp(false);
    $('pause').classList.add('hidden');
    this.state = 'playing';
    this.player.primaryDown = false;
    this.player.secondaryDown = false;
    this.requestLock();
    this.sound.resume();
  }

  toMenu() {
    if (this.dungeonActive) this.exitDungeon(true);
    this.resetInventoryUi();
    if (this.netRole) {
      this.net.close();
      this.netRole = null;
      this.peerJoined = false;
      this.lobbyCode = null;
      this.removeAvatar();
      this.ui.hideFriend();
      $('btn-host-room').disabled = false;
      $('btn-join-room').disabled = false;
      $('host-info').classList.add('hidden');
    }
    this.state = 'menu';
    this.runActive = false;
    this.needWorldReset = true;
    this.clearEntities();
    this.player.primaryDown = false;
    this.player.secondaryDown = false;
    this.player.aiming = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.ui.toggleHelp(false);
    this.ui.setHudVisible(false);
    $('pause').classList.add('hidden');
    $('end').classList.add('hidden');
    $('menu').classList.remove('hidden');
    this.ui.setPrompt(null);
    this.camera.fov = 58;
    this.camera.updateProjectionMatrix();
  }

  requestLock() {
    const p = this.canvas.requestPointerLock?.();
    if (p && p.catch) p.catch(() => {});
  }

  /* ================= inventory ================= */
  openInventory() {
    if (this.inventoryOpen) return;
    if (this.state !== 'playing' && this.state !== 'inventory') return;
    if (!this.player.alive) return;
    this.inventoryOpen = true;
    this.state = 'inventory';
    this.player.primaryDown = false;
    this.player.secondaryDown = false;
    this.player.aiming = false;
    this.player.mining = null;
    this.player.mineProg = 0;
    this.ui.setMineProgress(0);
    this.ui.toggleHelp(false);
    let target = -1;
    if (this.player.slot >= SLOT.BLOCK0 && this.player.slot <= SLOT.BLOCK4) {
      target = this.player.slot - SLOT.BLOCK0;
    } else {
      for (let i = 0; i < 5; i++) {
        if (!this.player.hotbarBlocks[i]) { target = i; break; }
      }
    }
    if (target < 0) target = 0;
    this.invTarget = target;
    this.ui.renderInventory(this.player, this.invTarget);
    $('inventory').classList.remove('hidden');
    $('inv-remote').classList.add('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.netRole && this.peerJoined) this.net.send({ t: 'inv', open: true });
    this.sound.resume();
    this.sound.tone(520, 0.06, { type: 'triangle', gain: 0.06 });
  }

  closeInventory() {
    if (!this.inventoryOpen) return;
    this.inventoryOpen = false;
    $('inventory').classList.add('hidden');
    if (this.netRole && this.peerJoined) this.net.send({ t: 'inv', open: false });
    if (this.remoteInventory) {
      $('inv-remote').classList.remove('hidden');
      this.state = 'inventory';
    } else {
      $('inv-remote').classList.add('hidden');
      this.state = 'playing';
      this.player.primaryDown = false;
      this.player.secondaryDown = false;
      this.requestLock();
      this.sound.resume();
    }
  }

  onRemoteInventory(open, kind = 'inventory') {
    if (this.state === 'menu' || this.state === 'victory' || this.state === 'defeat') return;
    this.remoteInventory = !!open;
    this.remoteModalKind = kind;
    if (open) {
      if (this.state === 'playing') {
        this.state = 'inventory';
        this.player.primaryDown = false;
        this.player.secondaryDown = false;
        this.player.aiming = false;
      }
      const isShop = kind === 'shop';
      const isBench = kind === 'bench';
      const isAlien = kind === 'alien';
      const eyebrow = $('inv-remote-eyebrow');
      const title = $('inv-remote-title');
      const sub = $('inv-remote-sub');
      if (eyebrow) eyebrow.textContent = isShop ? 'ТОРГОВЛЯ · СЕТЕВАЯ ИГРА' : isBench ? 'ВЕРСТАК · СЕТЕВАЯ ИГРА' : isAlien ? 'ПРИШЕЛЕЦ · СЕТЕВАЯ ИГРА' : 'ПАУЗА · СЕТЕВАЯ ИГРА';
      if (title) title.textContent = isShop ? 'НАПАРНИК У ПИЖОНЧИКА' : isBench ? 'НАПАРНИК У СТОЛА' : isAlien ? 'НАПАРНИК У ПРИШЕЛЬЦА' : 'НАПАРНИК В ИНВЕНТАРЕ';
      if (sub) sub.innerHTML = isShop
        ? 'Друг закупается у Пижончика. Нажмите <b>I</b>, чтобы открыть свой инвентарь.'
        : isBench
          ? 'Друг возится с оружием. Нажмите <b>I</b>, чтобы открыть свой инвентарь.'
          : isAlien
            ? 'Друг торгуется с пришельцем. Нажмите <b>I</b>, чтобы открыть свой инвентарь.'
            : 'Игра приостановлена для обоих. Нажмите <b>I</b>, чтобы открыть свой инвентарь.';
      if (!this.inventoryOpen && !this.shopOpen && !this.benchOpen && !this.alienShopOpen) $('inv-remote').classList.remove('hidden');
    } else {
      if (!this.inventoryOpen && !this.shopOpen && !this.benchOpen && !this.alienShopOpen) {
        $('inv-remote').classList.add('hidden');
        if (this.state === 'inventory' || this.state === 'shop' || this.state === 'bench' || this.state === 'alien') {
          this.state = 'playing';
          this.player.primaryDown = false;
          this.player.secondaryDown = false;
          this.requestLock();
          if (!document.pointerLockElement) this.ui.feed('Кликните по экрану, чтобы вернуть мышь');
        }
      }
    }
  }

  onInventoryClick(e) {
    if (!this.inventoryOpen) return;
    const close = e.target.closest('#inv-close');
    if (close) { this.closeInventory(); return; }
    const armorEl = e.target.closest('[data-armor]');
    if (armorEl) {
      const key = armorEl.dataset.armor;
      if (this.player.toggleArmor(key)) {
        const slot = key.split(':')[1];
        const [set] = key.split(':');
        const nowOn = this.player.isArmorEquipped(key);
        this.ui.feed(nowOn
          ? `<b>${ARMOR_SETS[set].full}</b> · ${ARMOR_SLOTS[slot].name.toLowerCase()} надет`
          : `<b>${ARMOR_SETS[set].full}</b> · ${ARMOR_SLOTS[slot].name.toLowerCase()} снят`);
        this.sound.tone(nowOn ? 700 : 420, 0.06, { type: 'square', gain: 0.06 });
        this.ui.renderInventory(this.player, this.invTarget);
        this.updateHealth();
      } else {
        this.sound.deny();
      }
      return;
    }
    const slotEl = e.target.closest('[data-invslot]');
    if (slotEl) {
      const s = Number(slotEl.dataset.invslot);
      if (s >= SLOT.BLOCK0 && s <= SLOT.BLOCK4) {
        this.invTarget = s - SLOT.BLOCK0;
        this.ui.renderInventory(this.player, this.invTarget);
        this.sound.tone(660, 0.035, { type: 'square', gain: 0.04 });
      }
      return;
    }
    const blockEl = e.target.closest('[data-block]');
    if (blockEl) {
      const id = Number(blockEl.dataset.block);
      if (this.player.assignBlockToSlot(this.invTarget, id)) {
        this.sound.pickup();
        this.updateHotbar();
        this.ui.renderInventory(this.player, this.invTarget);
      } else {
        this.sound.deny();
      }
      return;
    }
    const wEl = e.target.closest('[data-wslot]');
    if (wEl) {
      const key = wEl.dataset.weapon;
      const slot = Number(wEl.dataset.wslot);
      if (this.player.equipWeapon(key, slot)) {
        this.sound.tone(720, 0.05, { type: 'square', gain: 0.07 });
        this.updateHotbar();
        this.ui.renderInventory(this.player, this.invTarget);
      } else {
        this.sound.deny();
      }
    }
  }

  resetInventoryUi() {
    this.inventoryOpen = false;
    this.shopOpen = false;
    this.benchOpen = false;
    this.alienShopOpen = false;
    this.activeBench = null;
    this.nearBench = null;
    this.nearAlien = false;
    this.remoteInventory = false;
    this.nearMerchant = false;
    $('inventory').classList.add('hidden');
    $('inv-remote').classList.add('hidden');
    $('shop').classList.add('hidden');
    $('bench').classList.add('hidden');
    $('alien').classList.add('hidden');
    this.ui?.setHazard?.('');
    this.ui?.setZone?.(ZONE_NAMES[0], '—', '');
  }

  /* ================= co-op lobby & networking ================= */
  openCoop() {
    $('coop').classList.remove('hidden');
    $('join-status').textContent = '';
    $('join-status').className = 'coop-status';
    $('room-input').value = '';
    $('btn-join-room').disabled = false;
    $('btn-host-room').textContent = 'СОЗДАТЬ КОМНАТУ';
    this.fillTurnFields();
    if (this.netRole === 'host' && this.lobbyCode) {
      $('host-info').classList.remove('hidden');
      $('room-code').textContent = this.lobbyCode;
      $('btn-host-room').disabled = true;
      this.setCoopStatus('host-status', this.peerJoined ? 'Друг подключён. Можно начинать.' : 'Комната открыта. Ждём друга…', this.peerJoined ? 'ok' : '');
    } else {
      $('host-info').classList.add('hidden');
      $('btn-host-room').disabled = false;
    }
    this.ui.toggleHelp(false);
  }

  closeCoop() {
    $('coop').classList.add('hidden');
    if (this.net.connected && !this.runActive) {
      this.net.close();
      this.netRole = null;
      this.peerJoined = false;
      this.lobbyCode = null;
      this.removeAvatar();
      this.ui.hideFriend();
      $('btn-host-room').disabled = false;
      $('btn-host-room').textContent = 'СОЗДАТЬ КОМНАТУ';
      $('btn-join-room').disabled = false;
      $('host-info').classList.add('hidden');
    }
  }

  setCoopStatus(id, text, cls = '') {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'coop-status' + (cls ? ' ' + cls : '');
  }

  fillTurnFields() {
    const turn = loadTurn();
    $('turn-url').value = turn ? turn.urls.join(',') : '';
    $('turn-user').value = turn ? turn.username || '' : '';
    $('turn-pass').value = turn ? turn.credential || '' : '';
    this.setCoopStatus('turn-status', turn ? 'TURN задан — используется при соединении.' : '', turn ? 'ok' : '');
  }

  saveTurnSettings() {
    const urls = ($('turn-url').value || '').trim();
    if (!urls) {
      this.setCoopStatus('turn-status', 'Укажите адрес TURN, например turn:host:3478', 'err');
      return;
    }
    saveTurn({
      urls,
      username: ($('turn-user').value || '').trim(),
      credential: $('turn-pass').value || '',
    });
    this.setCoopStatus('turn-status', 'Сохранено. Применится к следующему соединению.', 'ok');
  }

  clearTurnSettings() {
    saveTurn(null);
    this.fillTurnFields();
    this.setCoopStatus('turn-status', 'TURN отключён — используется только STUN.');
  }

  createRoom() {
    this.sound.init();
    this.sound.resume();
    this.netRole = null;
    this.setCoopStatus('host-status', 'Создаём комнату…');
    $('btn-host-room').disabled = true;
    this.net.hostRoom();
  }

  startHostRun() {
    if (this.netRole !== 'host') return;
    $('coop').classList.add('hidden');
    this.beginRun();
  }

  joinRoom() {
    const code = ($('room-input').value || '').trim().toUpperCase();
    if (code.length < 4) {
      this.setCoopStatus('join-status', 'Введите 4-символьный код', 'err');
      return;
    }
    this.sound.init();
    this.sound.resume();
    this.setCoopStatus('join-status', 'Ищем комнату…');
    $('btn-join-room').disabled = true;
    this.net.joinRoom(code);
  }

  onNetOpen() {
    this.setCoopStatus('host-status', 'Соединение установлено');
  }

  onHosted(code) {
    this.netRole = 'host';
    this.lobbyCode = code;
    $('host-info').classList.remove('hidden');
    $('room-code').textContent = code;
    $('btn-host-room').disabled = true;
    $('btn-host-room').textContent = 'КОМНАТА СОЗДАНА';
    this.setCoopStatus('host-status', 'Комната открыта. Ждём друга…');
  }

  onJoined(code) {
    this.netRole = 'guest';
    this.lobbyCode = code;
    this.setCoopStatus('join-status', 'Подключено. Ждём старта хозяина…', 'ok');
    this.ui.setHudVisible(false);
  }

  onPeerJoined() {
    this.peerJoined = true;
    this.setCoopStatus('host-status', 'Друг подключён. Можно начинать.', 'ok');
    this.ui.feed('<b>Друг подключился</b>');
    if (this.runActive) {
      this.sendWelcome();
      if (this.inventoryOpen) this.net.send({ t: 'inv', open: true });
      this.ui.feed('<b>Друг в игре</b> · удачной охоты');
    }
  }

  onPeerLeft(msg) {
    this.peerJoined = false;
    this.ui.setFriend('', 0, 100, false, false);
    this.removeAvatar();
    this.resetInventoryUi();
    if ((this.state === 'inventory' || this.state === 'shop' || this.state === 'bench' || this.state === 'alien') && !this.inventoryOpen && !this.shopOpen && !this.benchOpen && !this.alienShopOpen) {
      this.state = 'playing';
      this.requestLock();
    }
    if (this.netRole === 'host') this.setCoopStatus('host-status', 'Друг отключился. Ждём нового…');
    if (this.netRole === 'guest') {
      this.ui.feed('Хозяин покинул игру', true);
      this.netRole = null;
      this.net.close();
      this.toMenu();
      this.openCoop();
      this.setCoopStatus('join-status', 'Хозяин закрыл комнату', 'err');
      return;
    }
    if (this.state === 'playing') {
      this.ui.feed('<b>Друг отключился</b> · продолжайте в одиночку', true);
    }
  }

  onNetError(msg) {
    this.setCoopStatus('host-status', msg, 'err');
    this.setCoopStatus('join-status', msg, 'err');
    if (!this.runActive) {
      $('btn-host-room').disabled = false;
      $('btn-host-room').textContent = 'СОЗДАТЬ КОМНАТУ';
      $('btn-join-room').disabled = false;
    } else {
      this.ui.feed(msg, true);
    }
  }

  onNetClose() {
    this.peerJoined = false;
    this.ui.hideFriend();
    this.removeAvatar();
    this.resetInventoryUi();
    if ((this.state === 'inventory' || this.state === 'shop' || this.state === 'bench' || this.state === 'alien') && !this.inventoryOpen && !this.shopOpen && !this.benchOpen && !this.alienShopOpen) {
      this.state = 'playing';
      this.requestLock();
    }
    $('btn-host-room').disabled = false;
    $('btn-join-room').disabled = false;
    if (this.netRole === 'guest') {
      this.netRole = null;
      if (this.runActive) {
        this.toMenu();
        this.openCoop();
        this.setCoopStatus('join-status', 'Связь с хозяином потеряна', 'err');
      }
    } else if (this.netRole === 'host') {
      this.ui.feed('Сетевое соединение закрыто', true);
      this.netRole = null;
      this.lobbyCode = null;
    }
  }

  removeAvatar() {
    if (this.avatar) {
      this.avatar.dispose();
      this.avatar = null;
    }
    this.remote.ready = false;
  }

  sendWelcome() {
    if (!this.net.peer || this.netRole !== 'host') return;
    if (!this.avatar) this.avatar = new PlayerAvatar(this, 'ДРУГ');
    const edits = [];
    for (const [key, id] of this.world.edits) {
      const [x, y, z] = key.split(',').map(Number);
      edits.push([x, y, z, id]);
    }
    const mobs = this.mobs.filter(m => !m.dead).map(m => [
      m.id, m.type, +m.pos.x.toFixed(2), +m.pos.y.toFixed(2), +m.pos.z.toFixed(2),
      Math.round(m.hp), m.maxHp, +m.yaw.toFixed(3),
    ]);
    const looted = [];
    this.chests.forEach((c, i) => { if (c.data.looted) looted.push(i); });
    this.net.send({
      t: 'welcome',
      seed: this.seed,
      mode: this.runMode,
      difficulty: this.difficultyId,
      edits,
      mobs,
      pickups: this.pickups.filter(p => !p.dead).map(p => ({ k: p.kind, a: p.amount, p: [+p.pos.x.toFixed(2), +p.pos.y.toFixed(2), +p.pos.z.toFixed(2)], s: p.meta?.set || null, sl: p.meta?.slot || null })),
      chests: looted,
      chestsLooted: this.chestsLooted,
      phase: this.phase,
      waveIndex: this.waveIndex,
      phaseTime: this.phaseTime,
      remaining: this.mobs.length + Math.max(0, this.spawnQueue.length - this.spawnIndex),
      player: [
        +this.player.pos.x.toFixed(2), +this.player.pos.y.toFixed(2), +this.player.pos.z.toFixed(2),
        +this.player.yaw.toFixed(3), Math.round(this.player.hp), this.player.alive,
      ],
      state: this.state,
      alien: this.alien ? [+this.alien.pos.x.toFixed(2), +this.alien.pos.y.toFixed(2), +this.alien.pos.z.toFixed(2)] : null,
      dungeon: this.dungeonActive ? this.dungeonSeed : null,
    });
    if (this.remote.ready) {
      this.avatar.setState(this.remote.pos.x, this.remote.pos.y, this.remote.pos.z, this.remote.yaw, this.remote.alive);
    }
    this.ui.setFriend('ДРУГ', this.remote.hp, 100, this.remote.alive, true);
  }

  startGuestRun(msg) {
    this.netRole = 'guest';
    this.peerJoined = true;
    this.runMode = RUN_MODES[msg.mode] ? msg.mode : 'campaign';
    this.selectedMode = this.runMode;
    this.difficultyId = DIFFICULTY_BY_ID[msg.difficulty] ? msg.difficulty : 'normal';
    this.selectedDifficulty = this.difficultyId;
    this.difficultyCfg = DIFFICULTY_BY_ID[this.difficultyId] || DIFFICULTY_BY_ID.normal;
    this.endlessIndex = 0;
    this.resetInventoryUi();
    this.state = 'playing';
    this.runActive = true;
    this.ended = false;
    this.dying = false;
    this.respawnTimer = 0;
    this.needWorldReset = false;
    this.clearEntities();
    this.effects.clear();
    $('menu').classList.add('hidden');
    $('coop').classList.add('hidden');
    $('pause').classList.add('hidden');
    $('end').classList.add('hidden');
    $('loading').classList.add('hidden');
    this.ui.toggleHelp(false);
    this.ui.setHudVisible(true);
    this.ui.feedEl.innerHTML = '';
    this.createWorld(msg.seed, msg.edits);
    this._bossKey = null;
    this.waveTitle = '';
    this.createChests();
    for (const idx of msg.chests || []) {
      if (this.chests[idx]) this.chests[idx].markLootedQuiet();
    }
    this.chestsLooted = msg.chestsLooted || (msg.chests || []).length;
    this.kills = 0;
    this.runTime = 0;
    this.player.reset();
    if (this.runMode === 'sandbox') this.player.grantSandbox();
    this.spawnPlayer();
    this.placeMerchant();
    this.placeBenches();
    if (Array.isArray(msg.alien)) this.spawnAlienAt({ x: msg.alien[0], y: msg.alien[1], z: msg.alien[2] });
    this.phase = msg.phase || 'prep';
    this.waveIndex = msg.waveIndex ?? -1;
    this.phaseTime = msg.phaseTime || 0;
    this.waveActive = this.phase === 'wave';
    this.spawnQueue = [];
    this.spawnIndex = 0;
    this.bossMob = null;
    this.mobs = [];
    for (const m of msg.mobs || []) this.spawnNetMob(m);
    for (const p of msg.pickups || []) {
      if (Array.isArray(p.p)) this.spawnPickup(new THREE.Vector3(p.p[0], p.p[1], p.p[2]), p.k, p.a || 1, p.s ? { set: p.s, slot: p.sl } : null);
    }
    this.remote.ready = false;
    if (this.avatar) { this.avatar.dispose(); this.avatar = null; }
    this.avatar = new PlayerAvatar(this, 'ХОЗЯИН');
    if (msg.player) this.setHostAvatar(msg.player);
    this.ui.updateChests(CHEST_COUNT, this.chestsLooted);
    this.ui.updateHealth(this.player);
    this.ui.updateHotbar(this.player);
    this.ui.setAmmo(this.player);
    this.ui.hideBoss();
    this.ui.updateCompass('');
    this.updateGuestHud();
    this.ui.banner('КООПЕРАТИВ', 'ВЫ НА ОСТРОВЕ',
      'Держитесь вместе · кликните по экрану, чтобы захватить мышь', false, 5000);
    this.sound.resume();
    this.sound.startAmbient();
    this.netPosTimer = 0;
    this.lastSnap = null;
    this.input.keys = {};
    this.input.jumpPressed = false;
    if (msg.dungeon != null) this.enterDungeon(msg.dungeon, true);
    this.requestLock();
  }

  setHostAvatar(p) {
    if (!this.avatar) this.avatar = new PlayerAvatar(this, 'ХОЗЯИН');
    this.avatar.setState(p[0], p[1], p[2], p[3], p[5] !== false);
    this.remote.ready = true;
    this.remote.hp = p[4] ?? 100;
    this.remote.alive = p[5] !== false;
    this.ui.setFriend('ХОЗЯИН', this.remote.hp, 100, this.remote.alive, true);
  }

  spawnNetMob(d) {
    const mob = new Mob(this, d[1], { x: d[2], y: d[3], z: d[4] });
    mob.id = d[0];
    this.nextEntityId = Math.max(this.nextEntityId, d[0]);
    mob.applyNet(d);
    this.mobs.push(mob);
    if (mob.cfg.boss) {
      this.bossMob = mob;
      if (this.dungeonActive) this.dungeonBoss = mob;
      this.ui.showBoss(mob.cfg.name, Math.max(0, mob.hp / mob.maxHp));
    }
    return mob;
  }

  applySnapshot(msg) {
    this.lastSnap = msg;
    if (msg.player) this.setHostAvatar(msg.player);
    const seen = new Set();
    for (const d of msg.mobs || []) {
      seen.add(d[0]);
      let mob = this.mobs.find(m => m.id === d[0]);
      if (!mob) mob = this.spawnNetMob(d);
      else mob.applyNet(d);
    }
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const mob = this.mobs[i];
      if (seen.has(mob.id)) continue;
      mob.dead = true;
      if (mob === this.bossMob) { this.bossMob = null; this.ui.hideBoss(); }
      mob.dispose();
      this.mobs.splice(i, 1);
    }
    if (msg.phase) {
      this.phase = msg.phase;
      this.waveIndex = msg.waveIndex;
      this.phaseTime = msg.phaseTime;
      this.waveActive = msg.phase === 'wave';
    }
    if (typeof msg.chestsLooted === 'number') {
      this.chestsLooted = Math.max(this.chestsLooted, msg.chestsLooted);
      this.ui.updateChests(CHEST_COUNT, this.chestsLooted);
    }
    if (typeof msg.remaining === 'number') this.guestRemaining = msg.remaining;
    this.updateGuestHud();
  }

  updateGuestHud() {
    if (this.runMode === 'sandbox') {
      this.ui.setWave('ПЕСОЧНИЦА', 'ВОЛНЫ БЕСКОНЕЧНЫ',
        `Врагов на острове: ${this.guestRemaining ?? this.mobs.length}`, '∞', false);
      return;
    }
    if (this.runMode === 'endless') {
      if (this.phase === 'endlessPrep') {
        this.ui.setWave(`АТАКА ${(this.waveIndex ?? 0) + 1}`, 'ДО НАПАДЕНИЯ',
          this.phaseTime < 15 ? 'Группа на подходе' : 'Стройте и готовьтесь',
          fmt(this.phaseTime), this.phaseTime < 15);
      } else if (this.phase === 'wave') {
        this.ui.setWave(`АТАКА ${(this.waveIndex ?? 0) + 1}`, 'ГРУППА ВРАГОВ', 'Осталось',
          String(this.guestRemaining ?? this.mobs.length), false);
      }
      return;
    }
    if (this.phase === 'prep') {
      this.ui.setWave('ФАЗА СБОРА', 'ПОДГОТОВКА',
        this.phaseTime < 10 ? 'Волна на подходе' : 'Соберите лут и постройте укрепления',
        fmt(this.phaseTime), this.phaseTime < 10);
    } else if (this.phase === 'wave') {
      this.ui.setWave(`ШТУРМ ${this.waveIndex + 1} / ${WAVES.length}`,
        this.waveTitleFor(this.waveIndex), 'Врагов осталось',
        String(this.guestRemaining ?? this.mobs.length), false);
    } else if (this.phase === 'break') {
      this.ui.setWave('ПЕРЕДЫШКА', 'СЛЕДУЮЩАЯ ВОЛНА', 'Укрепите позиции', fmt(this.phaseTime), true);
    }
  }

  sendSnapshot() {
    if (this.netRole !== 'host' || !this.peerJoined) return;
    const mobs = this.mobs.filter(m => !m.dead).map(m => [
      m.id, m.type, +m.pos.x.toFixed(2), +m.pos.y.toFixed(2), +m.pos.z.toFixed(2),
      Math.round(m.hp), m.maxHp, +m.yaw.toFixed(3),
    ]);
    this.net.send({
      t: 'snap',
      mobs,
      player: [
        +this.player.pos.x.toFixed(2), +this.player.pos.y.toFixed(2), +this.player.pos.z.toFixed(2),
        +this.player.yaw.toFixed(3), Math.round(this.player.hp), this.player.alive,
      ],
      phase: this.phase,
      waveIndex: this.waveIndex,
      phaseTime: +this.phaseTime.toFixed(2),
      remaining: this.mobs.length + Math.max(0, this.spawnQueue.length - this.spawnIndex),
      chestsLooted: this.chestsLooted,
      alive: this.player.alive,
    });
  }

  updateNet(dt) {
    if (this.netRole === 'host') {
      if (this.peerJoined) {
        this.netSnapTimer -= dt;
        if (this.netSnapTimer <= 0) {
          this.netSnapTimer = 0.09;
          this.sendSnapshot();
        }
        this.ui.setFriend('ДРУГ', this.remote.hp, 100, this.remote.alive, true);
      }
      if (this.avatar) this.avatar.update(dt);
      if (this.respawnTimer > 0) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) this.respawnLocal();
      }
    } else if (this.netRole === 'guest') {
      this.netPosTimer -= dt;
      if (this.netPosTimer <= 0) {
        this.netPosTimer = 0.06;
        this.net.send({
          t: 'pos',
          p: [+this.player.pos.x.toFixed(2), +this.player.pos.y.toFixed(2), +this.player.pos.z.toFixed(2)],
          yaw: +this.player.yaw.toFixed(3),
          pitch: +this.player.pitch.toFixed(3),
          hp: Math.round(this.player.hp),
          alive: this.player.alive,
        });
      }
      if (this.avatar) this.avatar.update(dt);
      if (this.remote.ready) this.ui.setFriend('ХОЗЯИН', this.remote.hp, 100, this.remote.alive, true);
      if (this.respawnTimer > 0) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) this.respawnLocal();
      }
    }
  }

  onNetMessage(msg) {
    if (!msg || !msg.t) return;
    if (msg.t === 'inv') {
      this.onRemoteInventory(!!msg.open, msg.kind === 'shop' ? 'shop' : msg.kind === 'bench' ? 'bench' : msg.kind === 'alien' ? 'alien' : 'inventory');
      return;
    }
    if (this.netRole === 'host') {
      if (msg.t === 'pos') {
        if (!Array.isArray(msg.p)) return;
        this.remote.pos.set(msg.p[0], msg.p[1], msg.p[2]);
        this.remote.yaw = msg.yaw || 0;
        this.remote.hp = msg.hp ?? 100;
        const wasAlive = this.remote.alive;
        this.remote.alive = msg.alive !== false;
        this.remote.ready = true;
        if (this.avatar) this.avatar.setState(msg.p[0], msg.p[1], msg.p[2], msg.yaw || 0, this.remote.alive);
        this.ui.setFriend('ДРУГ', this.remote.hp, 100, this.remote.alive, true);
        if (wasAlive && !this.remote.alive && !this.player.alive) this.coopWipe();
        return;
      }
      if (msg.t === 'hit') {
        const mob = this.mobs.find(m => m.id === msg.id);
        if (mob && !mob.dead) {
          const p = new THREE.Vector3(mob.pos.x, mob.pos.y + mob.cfg.height * 0.6, mob.pos.z);
          mob.lastHitBy = 'guest';
          mob.takeDamage(msg.dmg, p, !!msg.head, 'guest');
          this.effects.bloodBurst(p.x, p.y, p.z, 0x77e06a, msg.head ? 10 : 5);
        }
        return;
      }
      if (msg.t === 'block') {
        this.applyBlockFromNet(msg.x, msg.y, msg.z, msg.id);
        return;
      }
      if (msg.t === 'chestOpened') {
        const chest = this.chests[msg.i];
        if (chest && !chest.data.looted) {
          chest.markLootedQuiet();
          this.chestsLooted++;
          this.ui.updateChests(CHEST_COUNT, this.chestsLooted);
          this.ui.feed('Друг забрал лут из сундука');
        }
        return;
      }
      if (msg.t === 'dead') {
        this.remote.alive = false;
        if (this.avatar) this.avatar.setState(this.remote.pos.x, this.remote.pos.y, this.remote.pos.z, this.remote.yaw, false);
        this.ui.setFriend('ДРУГ', 0, 100, false, true);
        if (!this.player.alive) this.coopWipe();
        return;
      }
      if (msg.t === 'respawn') {
        this.remote.alive = true;
        if (Array.isArray(msg.p)) this.remote.pos.set(msg.p[0], msg.p[1], msg.p[2]);
        this.remote.ready = true;
        if (this.avatar) this.avatar.setState(this.remote.pos.x, this.remote.pos.y, this.remote.pos.z, this.remote.yaw, true);
        this.ui.setFriend('ДРУГ', this.remote.hp || 60, 100, true, true);
        return;
      }
      if (msg.t === 'ready') {
        this.sendWelcome();
        return;
      }
      return;
    }

    if (this.netRole === 'guest') {
      if (msg.t === 'welcome') {
        this.startGuestRun(msg);
        return;
      }
      if (msg.t === 'snap') {
        this.applySnapshot(msg);
        return;
      }
      if (msg.t === 'hurt') {
        if (this.state === 'playing' && this.player.alive) {
          const from = Array.isArray(msg.from) ? new THREE.Vector3(msg.from[0], msg.from[1], msg.from[2]) : null;
          this.damagePlayer(msg.dmg || 10, from, msg.name || 'УДАР');
        }
        return;
      }
      if (msg.t === 'proj') {
        if (Array.isArray(msg.p) && Array.isArray(msg.d)) {
          const from = new THREE.Vector3(msg.p[0], msg.p[1], msg.p[2]);
          const dir = new THREE.Vector3(msg.d[0], msg.d[1], msg.d[2]);
          this.spawnEnemyProjectile(from, dir, msg.sp || 15, msg.dmg || 10, !!msg.big, msg.c ?? 0xffb060);
        }
        return;
      }
      if (msg.t === 'block') {
        this.applyBlockFromNet(msg.x, msg.y, msg.z, msg.id);
        return;
      }
      if (msg.t === 'chestLooted') {
        const chest = this.chests[msg.i];
        if (chest && !chest.data.looted) {
          chest.markLootedQuiet();
          this.chestsLooted++;
          this.ui.updateChests(CHEST_COUNT, this.chestsLooted);
          this.ui.feed('Хозяин забрал лут из сундука');
        }
        return;
      }
      if (msg.t === 'mobDied') {
        this.removeNetMob(msg.id, msg.by, msg.voided);
        return;
      }
      if (msg.t === 'pickup') {
        if (Array.isArray(msg.p)) {
          this.spawnPickup(new THREE.Vector3(msg.p[0], msg.p[1], msg.p[2]), msg.kind, msg.amount || 1, msg.set ? { set: msg.set, slot: msg.slot } : null);
        }
        return;
      }
      if (msg.t === 'event') {
        this.handleNetEvent(msg);
        return;
      }
      if (msg.t === 'victory') {
        this.ui.feed('<b>ОСТРОВ ВЫСТОЯЛ</b>');
        if (this.state === 'playing') this.endRun(true);
        return;
      }
      if (msg.t === 'defeat') {
        if (this.state === 'playing') this.endRun(false);
        return;
      }
      if (msg.t === 'wipe') {
        this.ui.banner('ГРУППА ПОТЕРЯНА', 'ОБА БОЙЦА ПАЛИ', 'Остров остался без защитников', true, 2400);
        return;
      }
    }
  }

  handleNetEvent(msg) {
    if (msg.kind === 'endless') {
      this.sound.waveHorn();
      this.ui.banner(`АТАКА ${msg.i + 1}`, `ГРУППА ИЗ ${msg.size || 8}`, 'Держите оборону · остров ваш', true, 3600);
    } else if (msg.kind === 'wave') {
      this.sound.waveHorn();
      const w = WAVES[msg.i];
      const name = w && w.title.includes('·') ? w.title.split('·')[1].trim() : (w ? w.title : 'ВОЛНА');
      this.ui.banner(`ШТУРМ ${msg.i + 1} / ${WAVES.length}`, name, w ? w.sub : '', true, 3600);
    } else if (msg.kind === 'clear') {
      this.sound.waveClear();
      if (msg.mode === 'endless') {
        this.ui.banner('АТАКА ОТБИТА', 'ПЕРЕДЫШКА', 'Следующая группа через 4 минуты', false, 3000);
      } else {
        this.ui.banner('ВОЛНА ОТБИТА', 'ПЕРЕДЫШКА', 'Пополните боезапас и заделайте бреши', false, 3000);
      }
      this.player.heal(15);
      this.player.addAmmoAll(0.35);
      this.updateHotbar();
      this.updateAmmo();
      this.ui.feed('<b>+15 HP</b> · передышка');
    } else if (msg.kind === 'boss') {
      this.sound.bossRoar();
      this.ui.banner('УГРОЗА', msg.name || 'БОСС', msg.sub || 'Земля дрожит. Не стойте на месте.', true, 4200);
    } else if (msg.kind === 'dungeon' && msg.seed != null) {
      this.enterDungeon(msg.seed, true);
    } else if (msg.kind === 'dungeonClear') {
      this.spawnDungeonReward();
      this.ui.banner('ЛОГОВО ЗАЧИЩЕНО', 'ПОРТАЛ ОТКРЫТ', 'Заберите награду и уходите', false, 4400);
    } else if (msg.kind === 'dungeonExit') {
      this.exitDungeon(true);
    } else if (msg.kind === 'dungeonExitReq') {
      if (this.netRole === 'host') this.exitDungeon();
    } else if (msg.kind === 'slam') {
      this.sound.bossRoar();
      this.effects.ring(msg.x, msg.y + 0.1, msg.z, 0xff5a3d, 11, 0.8);
    } else if (msg.kind === 'loot') {
      this.refreshChests(true);
    } else if (msg.kind === 'airship') {
      this.sound.waveHorn();
      this.ui.banner('ОБЛАВА', 'ДИРИЖАБЛЬ ЗАХВАЧЕН', 'Зачистите палубу и заберите лут', true, 4200);
    } else if (msg.kind === 'alien' && Array.isArray(msg.p)) {
      this.spawnAlienAt({ x: msg.p[0], y: msg.p[1], z: msg.p[2] });
      this.sound.tone(660, 0.2, { type: 'sine', gain: 0.1, slide: 990 });
      this.ui.banner('ПРИШЕЛЬЦЫ', 'ТОРГОВЕЦ ПРИЗЕМЛИЛСЯ', 'Лазерная пушка и плазмоган · 333 монеты', false, 4600);
    } else if (msg.kind === 'friendDown') {
      this.ui.feed('<b>Хозяин упал</b> · прикройте его', true);
    } else if (msg.kind === 'friendUp') {
      this.ui.feed('Хозяин снова в строю');
    }
  }

  removeNetMob(id, by, voided) {
    const i = this.mobs.findIndex(m => m.id === id);
    if (i < 0) return;
    const mob = this.mobs[i];
    mob.dead = true;
    if (mob === this.bossMob) { this.bossMob = null; this.ui.hideBoss(); }
    if (!voided && by === 'guest') {
      this.kills++;
      this.sound.kill();
      this.ui.updateHealth(this.player);
      this.ui.feed(`<b>+${mob.cfg.name}</b> уничтожен`);
    }
    this.effects.bloodBurst(mob.pos.x, mob.pos.y + mob.cfg.height * 0.5, mob.pos.z, 0x6fdc5a, mob.cfg.boss ? 40 : 14);
    mob.dispose();
    this.mobs.splice(i, 1);
  }

  applyBlockFromNet(x, y, z, id) {
    if (!this.world.inBounds(x, y, z)) return;
    this.world.setBlock(x, y, z, id);
  }

  onBlockEdited(x, y, z, id) {
    if (this.netRole === 'host' && this.peerJoined) {
      this.net.send({ t: 'block', x, y, z, id });
    } else if (this.netRole === 'guest') {
      this.net.send({ t: 'block', x, y, z, id });
    }
  }

  getMobTargets() {
    const list = [{ pos: this.player.pos, vel: this.player.vel, alive: this.player.alive, remote: false }];
    if (this.netRole === 'host' && this.peerJoined && this.remote.ready) {
      list.push({ pos: this.remote.pos, alive: this.remote.alive, remote: true });
    }
    return list;
  }

  damageTarget(target, amount, source, name) {
    if (!target) return;
    if (target.remote) this.hurtRemote(amount, source, name);
    else this.damagePlayer(amount, source, name);
  }

  hurtRemote(amount, source, name) {
    if (this.netRole !== 'host' || !this.peerJoined) return;
    this.net.send({
      t: 'hurt',
      dmg: amount,
      from: source ? [source.x, source.y, source.z] : null,
      name,
    });
  }

  coopWipe() {
    if (this.netRole !== 'host' || this.coopWipeSent) return;
    this.coopWipeSent = true;
    this.net.send({ t: 'wipe' });
    this.ui.banner('ГРУППА ПОТЕРЯНА', 'ОБА БОЙЦА ПАЛИ', 'Остров остался без защитников', true, 2400);
    setTimeout(() => {
      if (this.state === 'playing') this.endRun(false);
    }, 1500);
  }

  beginRespawn() {
    this.dying = true;
    this.respawnTimer = 6;
    this.player.primaryDown = false;
    this.player.secondaryDown = false;
    this.player.aiming = false;
    this.sound.death();
    this.ui.banner('СИГНАЛ ПОТЕРЯН', 'ВОЗРОЖДЕНИЕ ЧЕРЕЗ 6 С',
      this.netRole === 'guest' ? 'Хозяин ещё держится' : 'Друг ещё держится', true, 4200);
    this.ui.setPrompt(null);
    if (this.netRole === 'guest') {
      this.net.send({ t: 'dead' });
    } else if (this.netRole === 'host') {
      if (this.remote.ready && !this.remote.alive) this.coopWipe();
      else if (this.peerJoined) this.net.send({ t: 'event', kind: 'friendDown' });
    }
  }

  respawnLocal() {
    if (!this.dying) return;
    const x = ISLAND_CENTER.x + (this.netRole === 'guest' ? -0.5 : 0.5);
    const z = ISLAND_CENTER.z + (this.netRole === 'guest' ? -1.5 : 0.5);
    let y = this.world.groundHeight(x, z);
    if (y < 0) y = 38;
    this.player.pos.set(x, y + 0.05, z);
    this.player.vel.set(0, 0, 0);
    this.player.hp = Math.max(60, Math.round(this.player.maxHp * 0.6));
    this.player.alive = true;
    this.player.invuln = 4;
    this.player.pitch = 0;
    this.player.yaw = 0;
    this.player.lastDamage = this.time;
    this.player.primaryDown = false;
    this.player.secondaryDown = false;
    this.player.aiming = false;
    this.player.updateCamera(0.016);
    this.dying = false;
    this.respawnTimer = 0;
    this.coopWipeSent = false;
    this.ui.updateHealth(this.player);
    this.ui.banner('СНОВА В СТРОЮ', 'ВОЗРОЖДЕНИЕ', '60 HP · берегите голову', false, 2400);
    this.ui.feed('Неуязвимость 4 с');
    this.sound.heal();
    if (this.netRole === 'guest') {
      this.net.send({
        t: 'respawn',
        p: [+this.player.pos.x.toFixed(2), +this.player.pos.y.toFixed(2), +this.player.pos.z.toFixed(2)],
      });
    } else if (this.netRole === 'host') {
      this.ui.feed('Вы снова в строю');
    }
  }

  /* ================= waves ================= */
  pickSpawnPoint() {
    const pts = this.world.spawnPoints;
    const far = pts.filter(p => Math.hypot(p.x - this.player.pos.x, p.z - this.player.pos.z) > 20);
    const list = far.length ? far : pts;
    return list[Math.floor(Math.random() * list.length)];
  }

  spawnMob(type, at = null) {
    const p = at || this.pickSpawnPoint();
    const cfg = MOBS[type];
    const y = cfg.flying ? p.y + rand(6, 9) : p.y + 0.1;
    const mob = new Mob(this, type, { x: p.x + rand(-1.6, 1.6), y, z: p.z + rand(-1.6, 1.6) });
    mob.ensureFreeSpot();
    mob.group.position.copy(mob.pos);
    this.mobs.push(mob);
    this.effects.spawn(mob.pos.x, mob.pos.y + 0.8, mob.pos.z, cfg.boss ? 0x8ef0ff : 0xff6a7a, cfg.boss ? 50 : 26, {
      speed: 3.4, up: 5, size: 0.09, life: 1.3, solid: false,
    });
    this.effects.ring(mob.pos.x, mob.pos.y, mob.pos.z, cfg.boss ? 0x8ef0ff : 0xff5468, cfg.boss ? 9 : 4, 0.7);
    this.sound.spawn();
    if (cfg.boss) {
      this.bossMob = mob;
      this.ui.banner('УГРОЗА', cfg.name, cfg.subtitle || 'Земля дрожит. Не стойте на месте.', true, 4200);
      this.sound.bossRoar();
      this.ui.showBoss(cfg.name, 1);
      if (this.netRole === 'host' && this.peerJoined) this.net.send({ t: 'event', kind: 'boss', name: cfg.name, sub: cfg.subtitle || '' });
    }
  }

  // В песочнице враги появляются кольцом вокруг игрока, а не на краю острова.
  sandboxSpawnPoint(minR = 22, maxR = 38) {
    const p = this.player.pos;
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = minR + Math.random() * (maxR - minR);
      const x = p.x + Math.cos(a) * r;
      const z = p.z + Math.sin(a) * r;
      const y = this.world.groundHeight(x, z);
      if (y > 0 && Math.abs(y - p.y) < 14) return { x: x + 0.5, y: y + 0.1, z: z + 0.5 };
    }
    return this.pickSpawnPoint();
  }

  spawnAdds(pos, count, type = 'grunt') {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const x = pos.x + Math.cos(a) * 3.2;
      const z = pos.z + Math.sin(a) * 3.2;
      let y = this.world.groundHeight(x, z);
      if (y < 0) y = pos.y;
      const mob = new Mob(this, type, { x, y: y + 0.1, z });
      mob.ensureFreeSpot();
      mob.group.position.copy(mob.pos);
      this.mobs.push(mob);
      this.effects.spawn(x, y + 1, z, 0xff6a7a, 14, { speed: 2, up: 3, size: 0.08, life: 0.9 });
      this.sound.spawn();
    }
    this.ui.feed('<b>БОСС ПРИЗЫВАЕТ ПОДМОГУ</b>', true);
  }

  throwRock(mob, dmg) {
    const from = mob.pos.clone();
    from.y += mob.cfg.height * 0.75;
    const targetPos = mob.target && mob.target.pos ? mob.target.pos : this.player.pos;
    const to = targetPos.clone();
    to.y += 1.1;
    const dir = to.sub(from).normalize();
    dir.y += 0.2;
    dir.normalize();
    this.spawnEnemyProjectile(from, dir, 15.5, dmg, true);
    this.sound.tone(180, 0.18, { type: 'square', gain: 0.09, slide: 90 });
  }

  spawnEnemyProjectile(pos, dir, speed, dmg, big, color = 0xffb060) {
    const p = new Projectile(this, pos, dir, speed, dmg, big, color);
    this.projectiles.push(p);
    if (this.netRole === 'host' && this.peerJoined) {
      this.net.send({
        t: 'proj',
        p: [+pos.x.toFixed(2), +pos.y.toFixed(2), +pos.z.toFixed(2)],
        d: [+dir.x.toFixed(4), +dir.y.toFixed(4), +dir.z.toFixed(4)],
        sp: speed, dmg, big: !!big, c: color,
      });
    }
  }

  removeProjectile(p) {
    const i = this.projectiles.indexOf(p);
    if (i >= 0) this.projectiles.splice(i, 1);
  }

  bossSlam(boss) {
    const rad = boss.cfg.slamRadius ?? 9.5;
    const dmg = boss.cfg.slamDamage ?? 30;
    this.effects.ring(boss.pos.x, boss.pos.y + 0.1, boss.pos.z, 0xff5a3d, rad + 1.5, 0.8);
    this.effects.spawn(boss.pos.x, boss.pos.y + 0.4, boss.pos.z, 0xffa060, 30, {
      speed: 6, up: 3, size: 0.12, life: 0.9,
    });
    this.sound.bossRoar();
    if (this.netRole === 'host' && this.peerJoined) {
      this.net.send({ t: 'event', kind: 'slam', x: +boss.pos.x.toFixed(2), y: +boss.pos.y.toFixed(2), z: +boss.pos.z.toFixed(2) });
    }
    const d = Math.hypot(this.player.pos.x - boss.pos.x, this.player.pos.z - boss.pos.z);
    if (d < rad && Math.abs(this.player.pos.y - boss.pos.y) < 4 && this.player.alive) {
      this.damagePlayer(dmg, boss.pos, 'УДАРНАЯ ВОЛНА');
      this.player.vel.y = Math.max(this.player.vel.y, 5);
    }
    if (this.netRole === 'host' && this.peerJoined && this.remote.ready && this.remote.alive) {
      const rd = Math.hypot(this.remote.pos.x - boss.pos.x, this.remote.pos.z - boss.pos.z);
      if (rd < rad && Math.abs(this.remote.pos.y - boss.pos.y) < 4) {
        this.hurtRemote(dmg, boss.pos, 'УДАРНАЯ ВОЛНА');
      }
    }
  }

  updateWaves(dt) {
    this.waveActive = this.phase === 'wave';
    if (this.runMode === 'sandbox') {
      this.updateSandbox(dt);
      return;
    }
    if (this.runMode === 'endless') {
      if (this.phase === 'endlessPrep') {
        this.phaseTime -= dt;
        this.ui.setWave(`АТАКА ${this.endlessIndex + 1}`, 'ДО НАПАДЕНИЯ',
          this.phaseTime < 15 ? 'Группа на подходе' : 'Стройте и готовьтесь',
          fmt(this.phaseTime), this.phaseTime < 15);
        if (this.phaseTime <= 0) this.startEndlessGroup();
      } else if (this.phase === 'wave') {
        this.waveElapsed += dt;
        while (this.spawnIndex < this.spawnQueue.length && this.waveElapsed >= this.spawnQueue[this.spawnIndex].t) {
          this.spawnMob(this.spawnQueue[this.spawnIndex].type);
          this.spawnIndex++;
        }
        if (this.spawnIndex >= this.spawnQueue.length && this.mobs.length === 0) {
          this.clearWave();
        } else {
          const remaining = this.mobs.length + (this.spawnQueue.length - this.spawnIndex);
          this.ui.setWave(`АТАКА ${this.waveIndex + 1}`, 'ГРУППА ВРАГОВ', 'Осталось', String(remaining), false);
        }
      }
      return;
    }
    if (this.phase === 'prep') {
      this.phaseTime -= dt;
      this.ui.setWave('ФАЗА СБОРА', 'ПОДГОТОВКА',
        this.phaseTime < 10 ? 'Волна на подходе' : 'Соберите лут и постройте укрепления',
        fmt(this.phaseTime), this.phaseTime < 10);
      if (this.phaseTime <= 0) this.startWave(0);
    } else if (this.phase === 'break') {
      this.phaseTime -= dt;
      this.ui.setWave('ПЕРЕДЫШКА', 'СЛЕДУЮЩАЯ ВОЛНА',
        'Укрепите позиции', fmt(this.phaseTime), true);
      if (this.phaseTime <= 0) this.startWave(this.waveIndex + 1);
    } else if (this.phase === 'wave') {
      this.waveElapsed += dt;
      while (this.spawnIndex < this.spawnQueue.length && this.waveElapsed >= this.spawnQueue[this.spawnIndex].t) {
        this.spawnMob(this.spawnQueue[this.spawnIndex].type);
        this.spawnIndex++;
      }
      if (this.spawnIndex >= this.spawnQueue.length && this.mobs.length === 0) {
        this.clearWave();
      } else {
        const remaining = this.mobs.length + (this.spawnQueue.length - this.spawnIndex);
        this.ui.setWave(`ШТУРМ ${this.waveIndex + 1} / ${WAVES.length}`,
          this.waveTitleFor(this.waveIndex), 'Врагов осталось', String(remaining), false);
      }
    }
  }

  updateSandbox(dt) {
    this.sandboxTimer = Math.max(0, (this.sandboxTimer || 0) - dt);
    const cap = 9;
    if (this.sandboxTimer <= 0 && this.mobs.length < cap) {
      this.sandboxTimer = 3.2 + Math.random() * 2.4;
      const pool = ['grunt', 'grunt', 'skeleton', 'flyer', 'demon', 'gargoyle', 'brute'];
      if (this.mobs.length === 0) pool.push('troll', 'troll');
      this.spawnMob(pool[(Math.random() * pool.length) | 0], this.sandboxSpawnPoint());
    }
    this.ui.setWave('ПЕСОЧНИЦА', 'ВОЛНЫ БЕСКОНЕЧНЫ', `Врагов на острове: ${this.mobs.length}`, '∞', false);
  }

  updateLootRefresh(dt) {
    if (this.netRole === 'guest') return;
    this.lootTimer -= dt;
    if (this.lootTimer > 0) return;
    this.lootTimer = LOOT_REFRESH;
    this.refreshChests(false);
  }

  refreshChests(fromNet = false) {
    for (const c of this.chests) c.resetLoot();
    this.chestsLooted = 0;
    this.ui.updateChests(CHEST_COUNT, 0);
    this.sound.chest();
    this.ui.banner('НОВЫЙ ЛУТ', 'СУНДУКИ ОБНОВЛЕНЫ', 'Через 5 минут появится следующая партия', false, 3400);
    this.ui.feed('<b>Сундуки обновлены</b> · новый лут');
    if (!fromNet && this.netRole === 'host' && this.peerJoined) {
      this.net.send({ t: 'event', kind: 'loot' });
    }
  }

  /* ================= combat ================= */
  shoot(cfg, player) {
    if (cfg.melee) return this.meleeSwing(cfg, player);
    const origin = new THREE.Vector3(player.pos.x, player.pos.y + PLAYER.eye, player.pos.z);
    const baseDir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));
    const muzzle = player.getMuzzleWorld();
    const hits = new Map();
    let anyHit = false, anyHead = false;
    const spread = cfg.spread * (player.aiming ? 0.45 : 1) + player.bloom;
    const rayEnd = new THREE.Vector3();

    for (let i = 0; i < cfg.pellets; i++) {
      const dir = this.applySpread(baseDir, spread);
      const mHit = this.raycastMobs(origin, dir, cfg.range);
      const bHit = this.world.raycast(origin, dir, cfg.range);
      let end;
      if (mHit && (!bHit || mHit.dist < bHit.dist)) {
        end = mHit.point;
        const key = mHit.mob;
        const ent = hits.get(key) || { dmg: 0, head: false, point: mHit.point.clone() };
        ent.dmg += cfg.dmg * (mHit.headshot ? 2 : 1);
        ent.head = ent.head || mHit.headshot;
        ent.point.copy(mHit.point);
        hits.set(key, ent);
        anyHit = true;
        if (mHit.headshot) anyHead = true;
        this.effects.bloodBurst(mHit.point.x, mHit.point.y, mHit.point.z, mHit.mob.type === 'flyer' ? 0xffb060 : 0x77e06a, 5);
      } else if (bHit) {
        end = origin.clone().addScaledVector(dir, bHit.dist);
        const def = BLOCKS[bHit.id];
        const color = def ? parseInt(def.color.slice(1), 16) : 0xaaaaaa;
        this.effects.sparks(end.x, end.y, end.z, color, 3);
        this.effects.spawn(end.x, end.y, end.z, color, 3, { speed: 1.6, up: 1.2, size: 0.06, life: 0.5 });
      } else {
        end = rayEnd.copy(origin).addScaledVector(dir, cfg.range).clone();
      }
      this.effects.tracer(muzzle, end, cfg.key === 'rifle' ? 0xbfe9ff : cfg.key === 'laser' ? 0xff66ff : cfg.key === 'plasma' ? 0x8affd0 : 0xffdf9a, 0.011);
    }

    this.effects.flash(muzzle.x, muzzle.y, muzzle.z, 0xffd27a, 0.6);
    this.muzzleLight.position.copy(origin);
    this.muzzleLight.intensity = 13;
    this.muzzleLight.color.setHex(cfg.key === 'rifle' ? 0xbfe9ff : cfg.key === 'laser' ? 0xff66ff : cfg.key === 'plasma' ? 0x8affd0 : 0xffc36b);

    if (hits.size) {
      for (const [mob, ent] of hits) {
        if (mob.dead) continue;
        const point = ent.point;
        player.stats.hits++;
        if (this.netRole === 'guest') {
          this.net.send({ t: 'hit', id: mob.id, dmg: Math.round(ent.dmg), head: ent.head });
          this.ui.showDamageTextFromWorld(point, Math.round(ent.dmg), ent.head);
        } else {
          mob.takeDamage(ent.dmg, point, ent.head, 'host');
          if (!mob.dead) this.ui.showDamageTextFromWorld(point, Math.round(ent.dmg), ent.head);
        }
      }
      this.ui.hitmarker(anyHead);
      this.sound.hit(anyHead);
    }
  }

  meleeSwing(cfg, player) {
    const reach = cfg.range ?? 2.6;
    const arc = cfg.arc ?? 1.3;
    const fx = -Math.sin(player.yaw);
    const fz = -Math.cos(player.yaw);
    const eyeY = player.pos.y + 1.0;
    const slashColor = cfg.accent ?? 0xd7e1ea;
    const point = new THREE.Vector3();
    const hits = [];

    for (const mob of this.mobs) {
      if (mob.dead) continue;
      const dx = mob.pos.x - player.pos.x;
      const dz = mob.pos.z - player.pos.z;
      const flat = Math.hypot(dx, dz);
      const dist = flat - mob.cfg.radius;
      if (dist > reach) continue;
      if (Math.abs(mob.pos.y + mob.cfg.height * 0.5 - eyeY) > 2.3) continue;
      const dot = (dx * fx + dz * fz) / (flat || 1);
      if (dot < Math.cos(arc * 0.5)) continue;
      point.set(mob.pos.x, mob.pos.y + mob.cfg.height * 0.55, mob.pos.z);
      hits.push({ mob, point: point.clone() });
    }

    // spark arc in front of the player
    for (let i = 0; i < 10; i++) {
      const a = player.yaw + rand(-arc * 0.5, arc * 0.5);
      const ox = -Math.sin(a), oz = -Math.cos(a);
      const r = rand(0.7, reach * 0.9);
      this.effects.spawn(
        player.pos.x + ox * r, eyeY + rand(-0.35, 0.45), player.pos.z + oz * r,
        slashColor, 1, { speed: 1.2, up: 0.4, size: 0.05, life: 0.28, solid: false }
      );
    }
    this.effects.flash(player.pos.x + fx * 1.1, eyeY, player.pos.z + fz * 1.1, slashColor, 0.5);
    if (hits.length) this.effects.ring(player.pos.x, player.pos.y + 0.1, player.pos.z, slashColor, reach, 0.24);

    for (const { mob, point: hp } of hits) {
      if (mob.dead) continue;
      player.stats.hits++;
      if (this.netRole === 'guest') {
        this.net.send({ t: 'hit', id: mob.id, dmg: Math.round(cfg.dmg), head: false });
        this.ui.showDamageTextFromWorld(hp, Math.round(cfg.dmg), false);
      } else {
        mob.takeDamage(cfg.dmg, hp, false, 'host');
        if (!mob.dead) this.ui.showDamageTextFromWorld(hp, Math.round(cfg.dmg), false);
      }
      this.effects.bloodBurst(hp.x, hp.y, hp.z, mob.type === 'skeleton' ? 0xd9d4c8 : 0x77e06a, 8);
      const kx = mob.pos.x - player.pos.x;
      const kz = mob.pos.z - player.pos.z;
      const kl = Math.hypot(kx, kz) || 1;
      const kb = cfg.knockback ?? 3;
      mob.vel.x += (kx / kl) * kb;
      mob.vel.z += (kz / kl) * kb;
      if (mob.grounded) mob.vel.y = Math.max(mob.vel.y, kb * 0.35);
    }

    if (hits.length) {
      this.ui.hitmarker(false);
      this.sound.hit(false);
    }
  }

  applySpread(dir, spread) {
    if (spread <= 0) return dir.clone();
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
    if (right.lengthSq() < 1e-5) right.set(1, 0, 0);
    right.normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();
    const ang = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * spread;
    return dir.clone().addScaledVector(right, Math.cos(ang) * r).addScaledVector(up, Math.sin(ang) * r).normalize();
  }

  raycastMobs(origin, dir, maxDist) {
    let best = null;
    for (const mob of this.mobs) {
      if (mob.dead) continue;
      const r = mob.cfg.radius;
      const min = { x: mob.pos.x - r, y: mob.pos.y, z: mob.pos.z - r };
      const max = { x: mob.pos.x + r, y: mob.pos.y + mob.cfg.height, z: mob.pos.z + r };
      const t = rayAABB(origin, dir, min, max);
      if (t === null || t < 0 || t > maxDist) continue;
      if (!best || t < best.dist) {
        const point = origin.clone().addScaledVector(dir, t);
        best = {
          mob, dist: t, point,
          headshot: point.y > mob.pos.y + mob.cfg.height * 0.78,
        };
      }
    }
    return best;
  }

  damagePlayer(amount, source, name) {
    if (!this.player.alive || this.state !== 'playing') return;
    if (this.player.invuln > 0) return;
    if (source) {
      const dx = this.player.pos.x - source.x;
      const dz = this.player.pos.z - source.z;
      const d = Math.hypot(dx, dz) || 1;
      this.player.vel.x += (dx / d) * 1.8;
      this.player.vel.z += (dz / d) * 1.8;
    }
    this.player.damage(amount, source, name);
    this.player.lastDamage = this.time;
  }

  onPlayerDeath() {
    if (this.state !== 'playing') return;
    if (this.dungeonActive && this.world?.dungeon) {
      const s = this.world.dungeon.start;
      this.player.alive = true;
      this.player.pos.set(s.x, s.y, s.z);
      this.player.hp = this.player.maxHp;
      this.player.vel.set(0, 0, 0);
      this.player.invuln = 3;
      this.ui.feed('<b>ПОДЗЕМЕЛЬЕ</b> · возврат ко входу');
      this.updateHealth();
      return;
    }
    if (this.runMode === 'sandbox') {
      this.player.alive = true;
      this.spawnPlayer();
      this.player.invuln = 2;
      this.ui.feed('<b>ПЕСОЧНИЦА</b> · возврат на площадь');
      return;
    }
    if (this.netRole) {
      this.beginRespawn();
      return;
    }
    this.dying = true;
    this.player.primaryDown = false;
    this.player.secondaryDown = false;
    this.player.aiming = false;
    this.sound.death();
    this.ui.setPrompt(null);
    this.ui.banner('СИГНАЛ ПОТЕРЯН', 'ВЫ ПОГИБЛИ', 'Остров остался без защитника', true, 2200);
    setTimeout(() => {
      if (this.state === 'playing' && this.dying) this.endRun(false);
    }, 1800);
  }

  onMobDeath(mob, voided = false) {
    const i = this.mobs.indexOf(mob);
    if (i >= 0) this.mobs.splice(i, 1);
    if (!voided) {
      this.kills++;
      this.sound.kill();
    }
    if (this.netRole === 'host' && this.peerJoined) {
      this.net.send({ t: 'mobDied', id: mob.id, by: mob.lastHitBy || 'host', voided });
    }
    this.ui.updateHealth(this.player);
    if (mob === this.bossMob) {
      this.bossMob = null;
      this.ui.hideBoss();
      this.ui.banner(mob.cfg.name, 'БОСС ПОВЕРЖЕН', 'Добивайте оставшихся', false, 3200);
      this.sound.waveClear();
    }
    if (mob === this.dungeonBoss) {
      this.dungeonBoss = null;
      this.completeDungeon();
    }
    if (!voided) {
      const value = Math.max(1, Math.round(((COIN_VALUE[mob.type] || 2) + Math.floor(Math.random() * 3)) * (this.difficultyCfg?.coins || 1)));
      const cp = mob.pos.clone();
      cp.y += 0.25;
      this.spawnPickup(cp, 'coin', value);
      this.effects.bloodBurst(mob.pos.x, mob.pos.y + mob.cfg.height * 0.5, mob.pos.z, 0x6fdc5a, mob.cfg.boss ? 40 : 16);
      this.effects.spawn(mob.pos.x, mob.pos.y + 0.4, mob.pos.z, 0x445544, 10, { speed: 2.2, up: 2, size: 0.1, life: 1.1 });
      this.maybeDrop(mob);
      this.maybeDropArmor(mob);
    } else {
      this.ui.feed('Враг сорвался в пустоту');
    }
  }

  armorBiasFor(mob) {
    if (mob.cfg.boss) return 3;
    if (mob.type === 'troll') return 2;
    if (mob.type === 'brute' || mob.type === 'gargoyle' || mob.type === 'demon') return 1;
    return 0;
  }

  armorDropChance(mob) {
    if (mob.cfg.boss) return 1;
    const table = {
      grunt: 0.07, skeleton: 0.11, flyer: 0.11,
      demon: 0.18, gargoyle: 0.2, brute: 0.34, troll: 0.8,
    };
    return table[mob.type] ?? 0.12;
  }

  rollArmorPiece(bias = 0) {
    const row = ARMOR_DROP.weights[Math.max(0, Math.min(3, bias))] || ARMOR_DROP.weights[0];
    let r = Math.random();
    let idx = row.length - 1;
    for (let i = 0; i < row.length; i++) {
      if (r < row[i]) { idx = i; break; }
      r -= row[i];
    }
    const slots = Object.keys(ARMOR_SLOTS);
    return {
      set: ARMOR_SET_ORDER[idx],
      slot: slots[Math.floor(Math.random() * slots.length)],
    };
  }

  maybeDropArmor(mob) {
    const chance = Math.min(1, this.armorDropChance(mob) * (this.difficultyCfg?.drop || 1));
    if (Math.random() > chance) return;
    const piece = this.rollArmorPiece(this.armorBiasFor(mob));
    const p = mob.pos.clone();
    p.y += 0.35;
    this.spawnPickup(p, 'armor', 1, piece);
    const cfg = ARMOR_SETS[piece.set];
    if (cfg) this.effects.flash(p.x, p.y + 0.4, p.z, cfg.accent, cfg.rarity >= 4 ? 1.1 : 0.7);
  }

  maybeDrop(mob) {
    const p = mob.pos.clone();
    p.y += 0.2;
    if (mob.cfg.boss) {
      this.spawnPickup(p, 'medkit', 2);
      this.spawnPickup(p.clone().add(new THREE.Vector3(1.2, 0, 0)), 'ammo', 1);
      this.spawnPickup(p.clone().add(new THREE.Vector3(-1.2, 0, 0)), 'obsidian', 1);
      return;
    }
    const r = Math.random();
    if (r < 0.15) this.spawnPickup(p, 'ammo', 1);
    else if (r < 0.22) this.spawnPickup(p, 'medkit', 1);
    else if (r < 0.34) this.spawnPickup(p, Math.random() < 0.5 ? 'metal' : 'planks', 1);
  }

  spawnPickup(pos, kind, amount, meta = null) {
    this.pickups.push(new Pickup(this, pos, kind, amount, meta));
    if (this.netRole === 'host' && this.peerJoined) {
      this.net.send({
        t: 'pickup', kind, amount,
        p: [+pos.x.toFixed(2), +pos.y.toFixed(2), +pos.z.toFixed(2)],
        set: meta?.set || null, slot: meta?.slot || null,
      });
    }
  }

  collectPickup(pickup) {
    if (pickup.dead) return;
    pickup.dead = true;
    pickup.dispose();
    const i = this.pickups.indexOf(pickup);
    if (i >= 0) this.pickups.splice(i, 1);
    if (pickup.kind === 'armor') {
      const meta = pickup.meta;
      const got = meta && this.player.addArmorPiece(meta.set, meta.slot);
      if (got) {
        const cfg = ARMOR_SETS[got.set];
        const dr = cfg?.dr?.[got.slot] || 0;
        this.ui.feed(`<b>+ ${got.name}</b> · +${dr}% защиты`);
        this.sound.chest();
        this.effects.flash(pickup.pos.x, pickup.pos.y + 0.5, pickup.pos.z, cfg?.accent ?? 0x8ef0ff, 0.9);
      }
    } else if (pickup.kind === 'coin') {
      this.player.addCoins(pickup.amount);
      this.ui.feed(`<b>+${pickup.amount} монет</b>`);
    } else if (pickup.kind === 'ammo') {
      this.player.addAmmoAll(0.3 * pickup.amount);
      this.ui.feed('<b>+ Боезапас</b>');
    } else if (pickup.kind === 'medkit') {
      this.player.addMedkits(pickup.amount);
      this.ui.feed(`<b>+${pickup.amount} аптечка</b>`);
    } else if (pickup.kind === 'scroll') {
      this.player.bossScrolls = (this.player.bossScrolls || 0) + 1;
      this.ui.feed('<b>СВИТОК ПЕРЕМЕЩЕНИЯ</b> · клавиша T — в логово босса');
      this.updateScrollHint();
    } else {
      const map = { stone: B.STONE, planks: B.PLANKS, metal: B.METAL, obsidian: B.OBSIDIAN };
      const id = map[pickup.kind] || B.STONE;
      const n = 4 * pickup.amount;
      this.player.addBlocks(id, n);
      this.ui.feed(`<b>+${n} ${BLOCKS[id].name}</b>`);
    }
    this.sound.pickup();
    this.updateHotbar();
    this.updateAmmo();
  }

  /* ================= chests ================= */
  lootChest(chest) {
    if (!chest || chest.data.looted) return;
    if (chest.data.reward) { this.lootDungeonChest(chest); return; }
    chest.open();
    this.chestsLooted++;
    const tier = chest.tier;
    const t = LOOT[tier];
    const lines = [];
    const player = this.player;

    const ammoLines = player.addAmmoAll(rand(t.ammo[0], t.ammo[1]));
    if (ammoLines.length) lines.push(ammoLines[0].replace('·', '<span style="color:#8b9bb4">·</span>'));

    const coinAmt = Math.round(rand(...(tier === 3 ? [24, 45] : tier === 2 ? [14, 28] : [8, 18])));
    player.addCoins(coinAmt);
    lines.push(`<b>+${coinAmt} монет</b>`);

    const blockAmt = Math.round(rand(t.blocks[0], t.blocks[1]));
    const stone = Math.round(blockAmt * 0.45);
    const planks = Math.round(blockAmt * 0.4);
    const brick = blockAmt - stone - planks;
    player.addBlocks(B.STONE, stone);
    player.addBlocks(B.PLANKS, planks);
    player.addBlocks(B.BRICK, brick);
    lines.push(`<b>+${blockAmt}</b> блоков: камень ${stone} · доски ${planks} · кирпич ${brick}`);

    if (tier === 3 || Math.random() < t.metal) {
      const m = tier === 3 ? 45 : Math.round(rand(12, 26));
      player.addBlocks(B.METAL, m);
      lines.push(`<b>+${m}</b> стальных блоков`);
    }
    if (Math.random() < t.obsidian) {
      const o = tier === 3 ? 40 : Math.round(rand(8, 18));
      player.addBlocks(B.OBSIDIAN, o);
      lines.push(`<b>+${o}</b> обсидиана`);
    }
    const med = Math.round(t.medkit + Math.random() * 0.6);
    const medTotal = chest.data.starter ? Math.max(1, med) : med;
    if (medTotal > 0) {
      player.addMedkits(medTotal);
      lines.push(`<b>+${medTotal} аптечка</b>`);
    }

    const starterNeed = chest.data.starter && !player.owned.smg && !player.owned.shotgun && !player.owned.rifle;
    let weaponKey = null;
    if (starterNeed) weaponKey = 'smg';
    else if (Math.random() < t.weapon[0]) {
      const list = t.weapon[1];
      weaponKey = list[Math.floor(Math.random() * list.length)];
    }
    const newBlocks = [B.BRICK, B.METAL, B.OBSIDIAN].filter(id => (player.blocks[id] || 0) > 0 && !player.hotbarBlocks.includes(id));
    if (newBlocks.length) lines.push('<b>Новые блоки в инвентаре</b> · клавиша I');
    if (weaponKey) {
      const wl = player.giveWeapon(weaponKey);
      if (wl) lines.push(`<b>ОРУЖИЕ:</b> ${wl}`);
    }

    // rare firepower if the player only has a pistol late in the run
    if (!weaponKey && tier >= 2 && !player.owned.rifle && this.chestsLooted >= 4 && Math.random() < 0.5) {
      const wl = player.giveWeapon('rifle');
      if (wl) lines.push(`<b>ОРУЖИЕ:</b> ${wl}`);
    }

    // armour piece
    const armorChance = tier === 3 ? 1 : tier === 2 ? 0.7 : 0.4;
    if (Math.random() < armorChance) {
      const piece = this.rollArmorPiece(tier === 3 ? 3 : tier === 2 ? 1 : 0);
      const got = player.addArmorPiece(piece.set, piece.slot);
      if (got) {
        const acfg = ARMOR_SETS[got.set];
        lines.push(`<b>+ ${got.name}</b> · +${acfg.dr[got.slot]}% защиты`);
      }
    }

    // weapon part
    const partChance = tier === 3 ? 1 : tier === 2 ? 0.55 : 0.3;
    if (Math.random() < partChance) {
      const partIds = Object.keys(WEAPON_PARTS);
      const pid = partIds[Math.floor(Math.random() * partIds.length)];
      player.addWeaponPart(pid, tier === 3 ? 2 : 1);
      lines.push(`<b>+ ЧАСТЬ: ${WEAPON_PARTS[pid].name}</b>${tier === 3 ? ' ×2' : ''}`);
    }

    for (const line of lines) this.ui.feed(line);

    // 2% — свиток перемещения в логово босса
    if (Math.random() < 0.02) {
      const sp = new THREE.Vector3(chest.data.x + 0.5, chest.data.y + 1.2, chest.data.z + 0.5);
      this.spawnPickup(sp, 'scroll', 1);
      this.ui.feed('<b>СВИТОК ПЕРЕМЕЩЕНИЯ</b> · клавиша T — в логово босса');
      this.updateScrollHint();
    }

    this.ui.updateChests(CHEST_COUNT, this.chestsLooted);
    this.updateHotbar();
    this.updateAmmo();
    this.effects.spawn(chest.data.x + 0.5, chest.data.y + 0.8, chest.data.z + 0.5, 0xffd27a, 26, {
      speed: 2.6, up: 4, size: 0.07, life: 1.2, solid: false,
    });
    this.effects.flash(chest.data.x + 0.5, chest.data.y + 0.8, chest.data.z + 0.5, 0xffc860, 1.4);
    const chestIndex = this.chests.indexOf(chest);
    if (chestIndex >= 0) {
      if (this.netRole === 'host' && this.peerJoined) {
        this.net.send({ t: 'chestLooted', i: chestIndex });
      } else if (this.netRole === 'guest') {
        this.net.send({ t: 'chestOpened', i: chestIndex });
      }
    }
  }

  /* ================= подземелье босса ================= */
  updateScrollHint() {
    const chip = $('scroll-chip');
    if (!chip) return;
    const n = this.player.bossScrolls || 0;
    if (n > 0 && !this.dungeonActive) {
      chip.innerHTML = `СВИТОК ПЕРЕМЕЩЕНИЯ ×${n} · <b>T</b>`;
      chip.classList.remove('hidden');
    } else {
      chip.classList.add('hidden');
    }
  }

  useBossScroll() {
    if (this.dungeonActive) return;
    if (!this.player.alive) return;
    if (!(this.player.bossScrolls > 0)) {
      this.ui.feed('Нет свитка перемещения', true);
      return;
    }
    this.player.bossScrolls--;
    this.updateScrollHint();
    this.enterDungeon();
  }

  pickDungeonBoss(seed) {
    let h = ((seed >>> 0) ^ 0x27d4eb2f) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
    return BOSS_ORDER[((h ^ (h >>> 16)) >>> 0) % BOSS_ORDER.length];
  }

  dungeonTheme(base) {
    return {
      ...(base || {}),
      top: 0x0d070b, mid: 0x160b11, low: 0x241118, fog: 0x120a0e,
      light: 0xff9a6a, lightIntensity: 0.95,
      hemiSky: 0x5a3d4a, hemiGround: 0x140c10, hemiIntensity: 0.9,
      sun: false, moon: false, stars: false, meteors: false,
      cloud: 0x1a0e14, cloudEmissive: 0x0d070b, cloudOpacity: 0.2,
      zoneVolcano: 0x7a5a4a, zoneRad: 0x5a7a4a,
    };
  }

  setIslandVisible(v) {
    const toggle = (o) => { if (o && o.group) o.group.visible = v; };
    for (const m of this.mobs) toggle(m);
    for (const c of this.chests) toggle(c);
    for (const p of this.pickups) toggle(p);
    for (const p of this.projectiles) if (p.mesh) p.mesh.visible = v;
    toggle(this.merchant);
    toggle(this.alien);
    for (const b of this.benches) toggle(b);
    toggle(this.avatar);
  }

  enterDungeon(seed = null, fromNet = false) {
    if (this.dungeonActive || !this.world) return;
    const runSeed = seed == null ? ((Math.random() * 1e9) | 0) : seed;
    this.dungeonSeed = runSeed;
    this.dungeonBossKey = this.pickDungeonBoss(runSeed);

    this.islandSave = {
      world: this.world,
      theme: this.theme,
      palette: this.palette,
      pos: this.player.pos.clone(),
      yaw: this.player.yaw,
      pitch: this.player.pitch,
      mobs: this.mobs,
      chests: this.chests,
      pickups: this.pickups,
      projectiles: this.projectiles,
      bossMob: this.bossMob,
      phase: this.phase,
      waveIndex: this.waveIndex,
      phaseTime: this.phaseTime,
      spawnQueue: this.spawnQueue,
      spawnIndex: this.spawnIndex,
      waveElapsed: this.waveElapsed,
      waveActive: this.waveActive,
      guestRemaining: this.guestRemaining,
      lootTimer: this.lootTimer,
    };
    const save = this.islandSave;
    if (this.world) this.world.group.visible = false;
    this.setIslandVisible(false);

    this.mobs = [];
    this.chests = [];
    this.pickups = [];
    this.projectiles = [];
    this.bossMob = null;
    this.dungeonBoss = null;
    this.dungeonPortal = null;
    this.dungeonPortalMesh = null;
    this.effects.clear();

    const world = new World(runSeed);
    world.generateDungeon(runSeed, this.atlas);
    world.initRenderer(this.scene);
    world.group.visible = true;
    this.world = world;
    this.dungeonActive = true;
    if (this.effects) this.effects.world = world;
    this.createWorldLights();
    this.applyAtmosphere(this.dungeonTheme(save.theme), world.palette);

    const d = world.dungeon;
    this.player.pos.set(d.start.x, d.start.y, d.start.z);
    this.player.vel.set(0, 0, 0);
    this.player.invuln = 2;
    this.dungeonExitMesh = null;
    this.dungeonExitPad = null;
    this.spawnExitPad(new THREE.Vector3(d.start.x, d.start.y, d.start.z - 2.6));
    this.ui.setHudVisible(true);
    this.ui.hideBoss();
    this.ui.setPrompt(null);
    this.ui.setZone('ПОДЗЕМЕЛЬЕ', 'логово босса', 'volcano');
    this.ui.updateCompass('');
    $('minimap-wrap').classList.add('hidden');
    $('chest-counter').classList.add('hidden');
    this.updateScrollHint();

    if (!fromNet && this.netRole === 'host' && this.peerJoined) {
      this.net.send({ t: 'event', kind: 'dungeon', seed: runSeed });
    }
    if (this.netRole !== 'guest') {
      const mins = MOBS[this.dungeonBossKey].minions;
      for (let i = 0; i < d.spawns.length; i++) {
        const p = d.spawns[i];
        this.spawnMob(mins[i % 2], { x: p.x, y: p.y, z: p.z });
      }
    }
    this.ui.banner('ПОДЗЕМЕЛЬЕ', MOBS[this.dungeonBossKey].title, 'Прихвостни на пути. Найдите логово.', true, 4400);
    this.sound.bossRoar();
    this.updateHealth();
  }

  exitDungeon(fromNet = false) {
    if (!this.dungeonActive) return;
    if (!fromNet && this.netRole === 'guest') {
      this.net.send({ t: 'event', kind: 'dungeonExitReq' });
      return;
    }
    const save = this.islandSave;
    if (!save) return;

    for (const m of this.mobs.slice()) m.dispose();
    this.mobs.length = 0;
    for (const p of this.pickups.slice()) p.dispose();
    this.pickups.length = 0;
    for (const c of this.chests.slice()) c.dispose();
    this.chests.length = 0;
    this.projectiles.length = 0;
    if (this.dungeonPortalMesh) {
      this.scene.remove(this.dungeonPortalMesh);
      this.dungeonPortalMesh = null;
    }
    if (this.dungeonExitMesh) {
      this.scene.remove(this.dungeonExitMesh);
      this.dungeonExitMesh = null;
    }
    this.dungeonExitPad = null;
    this.effects.clear();

    this.world.group.visible = false;
    this.world.dispose();
    this.world = save.world;
    this.world.group.visible = true;
    this.mobs = save.mobs;
    this.chests = save.chests;
    this.pickups = save.pickups;
    this.projectiles = save.projectiles;
    this.bossMob = save.bossMob;
    this.phase = save.phase;
    this.waveIndex = save.waveIndex;
    this.phaseTime = save.phaseTime;
    this.spawnQueue = save.spawnQueue;
    this.spawnIndex = save.spawnIndex;
    this.waveElapsed = save.waveElapsed;
    this.waveActive = save.waveActive;
    this.guestRemaining = save.guestRemaining;
    this.lootTimer = save.lootTimer;
    this.setIslandVisible(true);
    this.player.pos.copy(save.pos);
    this.player.yaw = save.yaw;
    this.player.pitch = save.pitch;
    this.player.vel.set(0, 0, 0);
    this.player.invuln = 2.5;
    this.player.updateCamera(0.016);
    this.applyAtmosphere(save.theme, save.palette);
    this.effects.world = this.world;
    this.createWorldLights();
    this.dungeonActive = false;
    this.dungeonBoss = null;
    this.dungeonPortal = null;
    this.islandSave = null;
    this.nearPortal = false;
    this.ui.hideBoss();
    if (this.bossMob) this.ui.showBoss(this.bossMob.cfg.name, Math.max(0, this.bossMob.hp / this.bossMob.maxHp));
    $('minimap-wrap').classList.remove('hidden');
    $('chest-counter').classList.remove('hidden');
    this.ui.updateChests(CHEST_COUNT, this.chestsLooted);
    this.updateScrollHint();
    this.ui.setHazard('');
    this.ui.banner('ВОЗВРАЩЕНИЕ', 'ОСТРОВ', 'Вы вернулись из логова', false, 2600);
    if (!fromNet && this.netRole === 'host' && this.peerJoined) {
      this.net.send({ t: 'event', kind: 'dungeonExit' });
    }
  }

  updateDungeon(dt) {
    const cfg = MOBS[this.dungeonBossKey];
    if (!this.dungeonBoss && !this.dungeonPortal && this.netRole !== 'guest') {
      const b = this.world.dungeon.boss;
      const d = Math.hypot(this.player.pos.x - b.x, this.player.pos.z - b.z);
      if (d < 15) this.spawnDungeonBoss();
    }
    if (this.dungeonPortalMesh) {
      this.dungeonPortalMesh.rotation.y += dt * 0.9;
      this.dungeonPortalMesh.position.y = this.dungeonPortalBaseY + Math.sin(this.time * 2) * 0.12;
    }
    if (this.dungeonBoss) {
      this.ui.setWave('ПОДЗЕМЕЛЬЕ', `БОСС: ${cfg.name}`, 'Убейте его', '', true);
    } else if (this.dungeonPortal) {
      this.ui.setWave('ПОДЗЕМЕЛЬЕ', 'ПОРТАЛ ОТКРЫТ', 'Заберите награду и уходите', '', false);
    } else {
      this.ui.setWave('ПОДЗЕМЕЛЬЕ', `ЛОГОВО: ${cfg.name}`, `Прихвостней: ${this.mobs.length}`, '', true);
    }
  }

  spawnDungeonBoss() {
    if (this.dungeonBoss) return;
    const b = this.world.dungeon.boss;
    this.spawnMob(this.dungeonBossKey, { x: b.x, y: b.y, z: b.z });
    const mob = this.mobs[this.mobs.length - 1];
    if (!mob || mob.type !== this.dungeonBossKey) return;
    this.dungeonBoss = mob;
    this.bossMob = mob;
  }

  completeDungeon() {
    if (this.dungeonPortal) return;
    if (this.netRole === 'guest') return;
    this.spawnDungeonReward();
    this.ui.banner('ЛОГОВО ЗАЧИЩЕНО', 'ПОРТАЛ ОТКРЫТ', 'Заберите награду и возвращайтесь', false, 4400);
    this.sound.waveClear();
    if (this.netRole === 'host' && this.peerJoined) {
      this.net.send({ t: 'event', kind: 'dungeonClear' });
    }
  }

  spawnDungeonReward() {
    if (this.dungeonPortal) return;
    const d = this.world.dungeon;
    const bossKey = this.dungeonBossKey;
    const spots = d.chests;
    this.chests.push(new Chest(this, { tier: 3, x: spots[0].x, y: spots[0].y, z: spots[0].z, looted: false, reward: 'coins' }));
    this.chests.push(new Chest(this, { tier: 3, x: spots[1].x, y: spots[1].y, z: spots[1].z, looted: false, reward: 'coins' }));
    this.chests.push(new Chest(this, { tier: 3, x: spots[2].x, y: spots[2].y, z: spots[2].z, looted: false, reward: 'weapon', bossKey }));
    this.spawnPickup(new THREE.Vector3(d.boss.x, d.boss.y + 0.8, d.boss.z), 'coin', 60);
    this.dungeonPortal = { pos: new THREE.Vector3(d.portal.x, d.portal.y, d.portal.z) };
    this.spawnPortalMesh(d.portal);
  }

  spawnPortalMesh(p) {
    if (this.dungeonPortalMesh) return;
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.15, 0.13, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0x8ef0ff, toneMapped: false })
    );
    g.add(ring);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.projectileTex, color: 0x8ef0ff, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.setScalar(3.2);
    g.add(glow);
    g.position.set(p.x, p.y + 1.4, p.z);
    this.scene.add(g);
    this.dungeonPortalMesh = g;
    this.dungeonPortalBaseY = p.y + 1.4;
    this.effects.ring(p.x, p.y + 0.1, p.z, 0x8ef0ff, 3.2, 0.9);
    this.sound.waveHorn();
  }

  // запасной выход у входа: из подземелья можно уйти в любой момент
  spawnExitPad(p) {
    if (this.dungeonExitMesh) return;
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.09, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0x8affd0, toneMapped: false })
    );
    g.add(ring);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.projectileTex, color: 0x8affd0, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.setScalar(2.4);
    g.add(glow);
    g.position.set(p.x, p.y + 1.2, p.z);
    this.scene.add(g);
    this.dungeonExitMesh = g;
    this.dungeonExitPad = { pos: p.clone() };
  }

  lootDungeonChest(chest) {
    if (!chest || chest.data.looted) return;
    chest.open();
    const player = this.player;
    if (chest.data.reward === 'weapon') {
      const key = MOBS[chest.data.bossKey]?.weapon || 'crusher';
      const wl = player.giveWeapon(key);
      const cfg = WEAPONS[key];
      this.ui.banner('РЕЛИКВИЯ', cfg ? cfg.name : 'ОРУЖИЕ БОССА', 'Только из подземелья', false, 4400);
      this.ui.feed(`<b>ОРУЖИЕ БОССА:</b> ${wl || key}`);
      this.sound.waveClear();
    } else {
      const coins = 90 + Math.floor(Math.random() * 70);
      player.addCoins(coins);
      player.addAmmoAll(0.8);
      player.addMedkits(2);
      this.ui.feed(`<b>+${coins} монет</b> · боезапас · 2 аптечки`);
    }
    this.ui.updateChests(this.chests.length, this.chests.filter((c) => c.data.looted).length);
    this.updateHotbar();
    this.updateAmmo();
    this.updateHealth();
    this.effects.spawn(chest.data.x + 0.5, chest.data.y + 0.8, chest.data.z + 0.5, 0xffd27a, 26, {
      speed: 2.6, up: 4, size: 0.07, life: 1.2, solid: false,
    });
  }

  updateChestInteraction() {
    this.nearPortal = false;
    if (this.dungeonActive) {
      const pads = [];
      if (this.dungeonExitPad) pads.push({ p: this.dungeonExitPad.pos, label: 'Вернуться на остров' });
      if (this.dungeonPortal) pads.push({ p: this.dungeonPortal.pos, label: 'Портал на остров' });
      for (const pad of pads) {
        const d = Math.hypot(pad.p.x - this.player.pos.x, pad.p.z - this.player.pos.z);
        if (d < 3.2 && Math.abs(pad.p.y - this.player.pos.y) < 3.2) {
          this.nearPortal = true;
          this.nearChest = null;
          this.ui.setPrompt(pad.label);
          return;
        }
      }
    }
    let best = null, bestD = 3.4;
    const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.yaw);

    // the dandy has priority — he is the only one you can trade with
    let merchantNear = false;
    if (this.merchant) {
      const mp = this.merchant.pos;
      const dx = mp.x - this.player.pos.x;
      const dz = mp.z - this.player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 4.0 && Math.abs(mp.y - this.player.pos.y) < 3.2) {
        merchantNear = true;
      }
    }
    this.nearMerchant = merchantNear;

    let bench = null, benchD = 3.6;
    for (const b of this.benches) {
      const d = Math.hypot(b.pos.x - this.player.pos.x, b.pos.z - this.player.pos.z);
      if (d < benchD && Math.abs(b.pos.y - this.player.pos.y) < 3.2) {
        bench = b;
        benchD = d;
      }
    }
    this.nearBench = bench;
    if (bench) {
      this.nearChest = null;
      this.ui.setPrompt('Стол оружейника');
      return;
    }

    let alienNear = false;
    if (this.alien) {
      const ap = this.alien.pos;
      const d = Math.hypot(ap.x - this.player.pos.x, ap.z - this.player.pos.z);
      if (d < 4.2 && Math.abs(ap.y - this.player.pos.y) < 3.2) alienNear = true;
    }
    this.nearAlien = alienNear;
    if (alienNear) {
      this.nearChest = null;
      this.ui.setPrompt('Пришелец — торговля');
      return;
    }

    if (merchantNear) {
      this.nearChest = null;
      this.ui.setPrompt('Пижончик — магазин');
      return;
    }

    for (const c of this.chests) {
      if (c.data.looted) continue;
      const dx = c.data.x + 0.5 - this.player.pos.x;
      const dz = c.data.z + 0.5 - this.player.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > bestD) continue;
      if (Math.abs(c.data.y - this.player.pos.y) > 2.4) continue;
      const dot = (dx * fwd.x + dz * fwd.z) / (d || 1);
      if (dot < 0.15) continue;
      best = c; bestD = d;
    }
    this.nearChest = best;
    this.ui.setPrompt(best ? 'Открыть сундук' : null);
  }

  interact() {
    if (this.nearPortal) { this.exitDungeon(); return; }
    if (this.nearBench) { this.openBench(this.nearBench); return; }
    if (this.nearAlien) { this.openAlienShop(); return; }
    if (this.nearMerchant) { this.openShop(); return; }
    if (this.nearChest) this.lootChest(this.nearChest);
  }

  /* ================= gunsmith bench ================= */
  openBench(bench) {
    if (this.benchOpen) return;
    if (this.state !== 'playing' && this.state !== 'bench') return;
    if (!this.player.alive) return;
    this.benchOpen = true;
    this.activeBench = bench;
    this.state = 'bench';
    this.player.primaryDown = false;
    this.player.secondaryDown = false;
    this.player.aiming = false;
    this.player.mining = null;
    this.player.mineProg = 0;
    this.ui.setMineProgress(0);
    this.ui.toggleHelp(false);
    const keys = Object.keys(WEAPONS).filter(k => this.player.owned[k] && !WEAPONS[k].melee);
    this.selectedBenchWeapon = this.player.slots.primary && this.player.owned[this.player.slots.primary]
      ? this.player.slots.primary
      : (keys[0] || 'pistol');
    this.ui.renderBench(this.player, this.selectedBenchWeapon);
    this.ui.updateCoins(this.player.coins);
    $('bench').classList.remove('hidden');
    $('inv-remote').classList.add('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.netRole && this.peerJoined) this.net.send({ t: 'inv', open: true, kind: 'bench' });
    this.sound.resume();
    this.sound.tone(540, 0.07, { type: 'square', gain: 0.05 });
  }

  closeBench() {
    if (!this.benchOpen) return;
    this.benchOpen = false;
    this.activeBench = null;
    $('bench').classList.add('hidden');
    if (this.netRole && this.peerJoined) this.net.send({ t: 'inv', open: false, kind: 'bench' });
    if (this.remoteInventory) {
      $('inv-remote').classList.remove('hidden');
      this.state = 'inventory';
    } else {
      $('inv-remote').classList.add('hidden');
      this.state = 'playing';
      this.player.primaryDown = false;
      this.player.secondaryDown = false;
      this.requestLock();
      this.sound.resume();
    }
  }

  onBenchClick(e) {
    if (!this.benchOpen) return;
    if (e.target.closest('#bench-close')) { this.closeBench(); return; }
    const player = this.player;
    const wEl = e.target.closest('[data-bench-weapon]');
    if (wEl) {
      this.selectedBenchWeapon = wEl.dataset.benchWeapon;
      this.ui.renderBench(player, this.selectedBenchWeapon);
      this.sound.tone(560, 0.04, { type: 'square', gain: 0.04 });
      return;
    }
    const key = this.selectedBenchWeapon;
    if (!key || !WEAPONS[key]) return;
    const partEl = e.target.closest('[data-bench-part]');
    if (partEl) {
      const on = player.toggleWeaponAttachment(key, partEl.dataset.benchPart);
      if (on === null) { this.sound.deny(); return; }
      this.sound.tone(on ? 780 : 460, 0.05, { type: 'square', gain: 0.05 });
      this.updateAmmo();
      this.ui.renderBench(player, key);
      return;
    }
    const paintEl = e.target.closest('[data-bench-paint]');
    if (paintEl) {
      const paint = WEAPON_PAINTS.find(p => p.id === paintEl.dataset.benchPaint);
      if (!paint) return;
      if (player.weaponPaint[key] === paint.id) return;
      if (paint.price > 0 && !player.spendCoins(paint.price)) { this.sound.deny(); this.ui.feed('Не хватает монет', true); return; }
      player.setWeaponPaint(key, paint.id);
      this.sound.pickup();
      this.ui.feed(`<b>${WEAPONS[key].name}</b> · окрашено: ${paint.name}`);
      this.ui.renderBench(player, key);
      return;
    }
    if (e.target.closest('[data-bench-upgrade]')) {
      const cost = player.weaponUpgradeCost(key);
      if (cost === null) { this.sound.deny(); return; }
      if (!player.spendCoins(cost)) { this.sound.deny(); this.ui.feed('Не хватает монет', true); return; }
      player.upgradeWeapon(key);
      this.sound.reloadDone();
      this.ui.feed(`<b>${WEAPONS[key].name}</b> · улучшение ${player.weaponUpgradeLevel(key)} / ${WEAPON_UPGRADE.maxLevel}`);
      this.ui.renderBench(player, key);
    }
  }

  /* ================= shop ================= */
  openShop() {
    if (this.shopOpen) return;
    if (this.state !== 'playing' && this.state !== 'shop') return;
    if (!this.player.alive) return;
    this.shopOpen = true;
    this.state = 'shop';
    this.player.primaryDown = false;
    this.player.secondaryDown = false;
    this.player.aiming = false;
    this.player.mining = null;
    this.player.mineProg = 0;
    this.ui.setMineProgress(0);
    this.ui.toggleHelp(false);
    this.ui.renderShop(this.player);
    this.ui.updateCoins(this.player.coins);
    $('shop').classList.remove('hidden');
    $('inv-remote').classList.add('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.netRole && this.peerJoined) this.net.send({ t: 'inv', open: true, kind: 'shop' });
    this.sound.resume();
    this.sound.tone(620, 0.08, { type: 'triangle', gain: 0.06 });
  }

  closeShop() {
    if (!this.shopOpen) return;
    this.shopOpen = false;
    $('shop').classList.add('hidden');
    if (this.netRole && this.peerJoined) this.net.send({ t: 'inv', open: false, kind: 'shop' });
    if (this.remoteInventory) {
      $('inv-remote').classList.remove('hidden');
      this.state = 'inventory';
    } else {
      $('inv-remote').classList.add('hidden');
      this.state = 'playing';
      this.player.primaryDown = false;
      this.player.secondaryDown = false;
      this.requestLock();
      this.sound.resume();
    }
  }

  openAlienShop() {
    if (this.alienShopOpen) return;
    if (this.state !== 'playing' && this.state !== 'alien') return;
    if (!this.player.alive || !this.alien) return;
    this.alienShopOpen = true;
    this.state = 'alien';
    this.player.primaryDown = false;
    this.player.secondaryDown = false;
    this.player.aiming = false;
    this.player.mining = null;
    this.player.mineProg = 0;
    this.ui.setMineProgress(0);
    this.ui.toggleHelp(false);
    this.ui.renderAlienShop(this.player);
    this.ui.updateCoins(this.player.coins);
    $('alien').classList.remove('hidden');
    $('inv-remote').classList.add('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.netRole && this.peerJoined) this.net.send({ t: 'inv', open: true, kind: 'alien' });
    this.sound.resume();
    this.sound.tone(880, 0.12, { type: 'sine', gain: 0.06, slide: 1200 });
  }

  closeAlienShop() {
    if (!this.alienShopOpen) return;
    this.alienShopOpen = false;
    $('alien').classList.add('hidden');
    if (this.netRole && this.peerJoined) this.net.send({ t: 'inv', open: false, kind: 'alien' });
    if (this.remoteInventory) {
      $('inv-remote').classList.remove('hidden');
      this.state = 'inventory';
    } else {
      $('inv-remote').classList.add('hidden');
      this.state = 'playing';
      this.player.primaryDown = false;
      this.player.secondaryDown = false;
      this.requestLock();
      this.sound.resume();
    }
  }

  onAlienClick(e) {
    if (!this.alienShopOpen) return;
    if (e.target.closest('#alien-close')) { this.closeAlienShop(); return; }
    const btn = e.target.closest('[data-alien]');
    if (btn && !btn.disabled) this.buyAlienItem(btn.dataset.alien);
  }

  buyAlienItem(key) {
    const entry = ALIEN_SHOP[key];
    if (!entry || !this.alienShopOpen) return;
    const p = this.player;
    if (p.owned[key]) return this.sound.deny();
    if (!p.spendCoins(entry.price)) {
      this.sound.deny();
      this.ui.feed('Не хватает монет для пришельца', true);
      return;
    }
    p.giveWeapon(key);
    this.sound.waveClear();
    this.ui.feed(`<b>ОРУЖИЕ: ${WEAPONS[key].name}</b> · куплено у пришельца`);
    this.updateHotbar();
    this.updateAmmo();
    this.ui.renderAlienShop(p);
  }

  onShopClick(e) {
    if (!this.shopOpen) return;
    if (e.target.closest('#shop-close')) { this.closeShop(); return; }
    const btn = e.target.closest('[data-shop]');
    if (btn && !btn.disabled) this.buyShopItem(btn.dataset.shop);
  }

  buyShopItem(key) {
    const player = this.player;
    if (!this.shopOpen) return;
    const deny = () => { this.sound.deny(); this.ui.feed('Не хватает монет', true); };

    if (key === 'ammo') {
      if (!player.spendCoins(SHOP.ammo.price)) return deny();
      player.addAmmoAll(1.0);
      this.ui.feed('<b>+ Боезапас</b> · куплено у Пижончика');
      this.sound.pickup();
    } else if (key === 'medkit') {
      if (player.medkits >= 9) return this.sound.deny();
      if (!player.spendCoins(SHOP.medkit.price)) return deny();
      player.addMedkits(1);
      this.ui.feed('<b>+1 аптечка</b> · куплено у Пижончика');
      this.sound.pickup();
    } else if (key === 'armor') {
      if (player.armor >= player.maxArmor) return this.sound.deny();
      if (!player.spendCoins(SHOP.armor.price)) return deny();
      player.addArmor(SHOP.armor.amount);
      this.ui.feed(`<b>+${SHOP.armor.amount} брони</b> · куплено у Пижончика`);
      this.sound.pickup();
    } else if (key.startsWith('weapon:')) {
      const id = key.slice(7);
      const entry = SHOP.weapons[id];
      if (!entry) return;
      if (player.owned[id]) return this.sound.deny();
      if (!player.spendCoins(entry.price)) return deny();
      player.giveWeapon(id);
      this.ui.feed(`<b>ОРУЖИЕ: ${WEAPONS[id].name}</b> · куплено у Пижончика`);
      if (player.slots.secondary && player.slots.primary !== id && player.slots.secondary !== id) {
        this.ui.feed('Слоты 7–8 заняты · экипируйте новинку в инвентаре (I)');
      }
      this.updateHotbar();
      this.sound.reloadDone();
      this.sound.tone(880, 0.1, { type: 'triangle', gain: 0.07, slide: 320 });
    } else {
      return;
    }
    this.updateAmmo();
    this.updateHealth();
    this.ui.renderShop(this.player);
  }

  /* ================= helpers / HUD ================= */
  updateHealth() { this.ui.updateHealth(this.player); }
  updateAmmo() { this.ui.setAmmo(this.player); }
  updateHotbar() { this.ui.updateHotbar(this.player); this.ui.setAmmo(this.player); }
  selectSlot(i, silent = false) { this.player.selectSlot(i, silent); }

  updateSelection(hit) {
    if (!this.selection) {
      const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
      const mat = new THREE.LineBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.85 });
      this.selection = new THREE.LineSegments(geo, mat);
      this.selection.renderOrder = 5;
      this.scene.add(this.selection);
      const gm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.26, depthWrite: false });
      this.ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), gm);
      this.ghost.visible = false;
      this.scene.add(this.ghost);
    }
    if (!hit) {
      this.selection.visible = false;
      this.ghost.visible = false;
      return;
    }
    this.selection.visible = true;
    this.selection.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    this.selection.material.color.setHex(hit.id === 0 ? 0xff5468 : 0xffc860);

    const isBlock = this.player.slot >= SLOT.BLOCK0 && this.player.slot <= SLOT.BLOCK4;
    if (isBlock) {
      const id = this.player.hotbarBlocks[this.player.slot - SLOT.BLOCK0];
      if (!id) { this.ghost.visible = false; return; }
      const p = { x: hit.x + hit.nx, y: hit.y + hit.ny, z: hit.z + hit.nz };
      const blocked = this.world.isSolid(p.x, p.y, p.z) || p.y < 0;
      if (!blocked && this.player.blocks[id] > 0) {
        this.ghost.visible = true;
        this.ghost.position.set(p.x + 0.5, p.y + 0.5, p.z + 0.5);
        this.ghost.material.color.set(BLOCKS[id].color);
      } else {
        this.ghost.visible = false;
      }
    } else {
      this.ghost.visible = false;
    }
  }

  checkAirshipRaid() {
    if (this.runMode === 'sandbox' || this.airshipRaided) return;
    if (this.netRole === 'guest') return;
    const a = this.world?.airship;
    if (!a) return;
    const near = (pos) => {
      const d = Math.hypot(pos.x - a.x, pos.z - a.z);
      return d < AIRSHIP.raidRadius && Math.abs(pos.y - (a.deckY + 2)) < 14;
    };
    let entered = near(this.player.pos);
    if (!entered && this.netRole === 'host' && this.peerJoined && this.remote.ready) {
      entered = near(this.remote.pos);
    }
    if (!entered) return;
    this.airshipRaided = true;
    const extra = this.difficultyId === 'nightmare' ? 5 : this.difficultyId === 'hard' ? 3 : 0;
    const count = AIRSHIP.raidMobs + extra;
    const pool = this.endlessMobPool(6);
    const { x0, x1, z0, z1 } = a.bounds;
    for (let i = 0; i < count; i++) {
      let roll = Math.random() * pool.reduce((sum, p) => sum + p[1], 0);
      let type = pool[0][0];
      for (const [t, w] of pool) {
        if (roll < w) { type = t; break; }
        roll -= w;
      }
      const mob = new Mob(this, type, {
        x: rand(x0 + 2.5, x1 - 0.5),
        y: a.deckY + 1.05,
        z: rand(z0 + 2.5, z1 - 0.5),
      });
      mob.airshipMob = true;
      mob.yaw = Math.PI;
      mob.ensureFreeSpot();
      mob.group.position.copy(mob.pos);
      this.mobs.push(mob);
    }
    this.sound.waveHorn();
    this.ui.banner('ОБЛАВА', 'ДИРИЖАБЛЬ ЗАХВАЧЕН', 'Зачистите палубу и заберите лут', true, 4200);
    this.ui.feed('<b>ОБЛАВА</b> · дирижабль кишит врагами', true);
    if (this.netRole === 'host' && this.peerJoined) {
      this.net.send({ t: 'event', kind: 'airship' });
    }
  }

  updateHazards(dt) {
    const p = this.player;
    if (!p.alive) { this.ui.setHazard(''); return; }
    if (this.dungeonActive) { this.ui.setHazard(''); return; }
    const bx = Math.floor(p.pos.x), bz = Math.floor(p.pos.z);
    const zone = this.world.zoneAt(bx, bz);
    this.currentZone = zone;

    let hazmat = 0;
    for (const slot of ['helmet', 'chest', 'legs']) {
      if ((p.armorEquip[slot] || '').startsWith('hazmat:')) hazmat++;
    }
    const hazmatPct = hazmat / 3;

    const belowId = this.world.get(Math.floor(p.pos.x), Math.floor(p.pos.y - 0.08), Math.floor(p.pos.z));
    const onMagma = p.onGround && BLOCKS[belowId]?.hazard === 'magma';
    const onWire = p.onGround && BLOCKS[belowId]?.hazard === 'wire';
    const inRad = zone === ZONE.RADIATION;
    const inVol = zone === ZONE.VOLCANO;

    let warning = '';
    let warningCls = '';
    if (onMagma) {
      warning = 'МАГМА · ЖЖЁТ';
      warningCls = 'magma';
    } else if (onWire) {
      warning = 'КОЛЮЧАЯ ПРОВОЛОКА · РЕЖЕТ';
      warningCls = 'magma';
    } else if (inRad) {
      warning = hazmat >= 3
        ? 'РАДИАЦИЯ · СЕТ ХИМЗАЩИТЫ'
        : `РАДИАЦИЯ · ХИМЗАЩИТА ${hazmat}/3`;
      if (hazmat >= 3) warning = '';
    }
    this.ui.setHazard(warning, warningCls);

    const hint = inRad
      ? (hazmat >= 3 ? 'защита 100%' : `химзащита ${hazmat}/3`)
      : inVol ? 'магма и базальт' : '—';
    this.ui.setZone(ZONE_NAMES[zone], hint, inRad ? 'radiation' : inVol ? 'volcano' : '');

    if (this.baseFogColor) {
      const hex = inRad ? this.theme?.zoneRad : inVol ? this.theme?.zoneVolcano : this.theme?.fog;
      if (hex !== undefined) {
        this.zoneFogColor.setHex(hex);
        // вулкан только подкрашивает воздух, а не заливает экран красным
        if (inVol) this.zoneFogColor.lerp(this.baseFogColor, 0.55);
      }
    }

    this.zoneFeedCd = Math.max(0, this.zoneFeedCd - dt);
    this.triggerZoneHint(zone, hazmat, onMagma);

    // radiation damage
    if (inRad && hazmat < 3) {
      this.radTick += dt;
      while (this.radTick >= HAZARD.tick) {
        this.radTick -= HAZARD.tick;
        const dmg = HAZARD.radiationDps * HAZARD.tick * (1 - hazmatPct);
        p.damage(dmg, null, 'РАДИАЦИЯ');
      }
    } else {
      this.radTick = 0;
    }

    // magma damage
    if (onMagma) {
      this.magmaTick += dt;
      while (this.magmaTick >= HAZARD.tick) {
        this.magmaTick -= HAZARD.tick;
        p.damage(HAZARD.magmaDps * HAZARD.tick, null, 'МАГМА');
        this.effects.sparks(p.pos.x, p.pos.y + 0.2, p.pos.z, 0xff7a2a, 4);
      }
    } else {
      this.magmaTick = 0;
    }

    // barbed wire damage
    if (onWire) {
      this.wireTick += dt;
      while (this.wireTick >= HAZARD.tick) {
        this.wireTick -= HAZARD.tick;
        p.damage(8 * HAZARD.tick, null, 'ПРОВОЛОКА');
        this.effects.sparks(p.pos.x, p.pos.y + 0.3, p.pos.z, 0xd7e1ea, 4);
      }
    } else {
      this.wireTick = 0;
    }

    // ambient particles for dangerous zones
    if (inRad || inVol) {
      this.zoneParticleTimer -= dt;
      if (this.zoneParticleTimer <= 0) {
        this.zoneParticleTimer = inRad ? 0.06 : 0.09;
        const color = inRad ? 0x8aff6a : 0xff8a3a;
        this.effects.spawn(
          p.pos.x + rand(-7, 7), p.pos.y + rand(0.2, 4.2), p.pos.z + rand(-7, 7),
          color, 1, { speed: 0.35, up: rand(0.1, 0.6), size: 0.065, life: 1.5, solid: false }
        );
      }
    }
  }

  triggerZoneHint(zone, hazmat, onMagma) {
    if (onMagma && this.zoneFeedCd <= 0) {
      this.ui.feed('<b>МАГМА</b> · не стойте на ней', true);
      this.zoneFeedCd = 5;
      return;
    }
    if (zone === ZONE.RADIATION && hazmat < 3 && this.zoneFeedCd <= 0) {
      this.ui.feed(`<b>РАДИАЦИЯ</b> · наденьте сет химзащиты (${hazmat}/3)`, true);
      this.zoneFeedCd = 9;
      return;
    }
    if (zone === ZONE.VOLCANO && this.zoneFeedCd <= 0) {
      this.ui.feed('<b>ВУЛКАНИЧЕСКАЯ ЗОНА</b> · берегитесь магмы', true);
      this.zoneFeedCd = 12;
    }
  }

  updateCompass() {
    let best = null, bestD = 1e9;
    if (this.phase === 'wave' && this.mobs.length) {
      for (const m of this.mobs) {
        const d = Math.hypot(m.pos.x - this.player.pos.x, m.pos.z - this.player.pos.z);
        if (d < bestD) { bestD = d; best = m.pos; }
      }
      if (best) {
        this.ui.updateCompass(`БЛИЖАЙШИЙ ВРАГ · <b>${Math.round(bestD)} М</b> ${this.arrowFor(best)}`);
        return;
      }
    }
    for (const c of this.chests) {
      if (c.data.looted) continue;
      const d = Math.hypot(c.data.x - this.player.pos.x, c.data.z - this.player.pos.z);
      if (d < bestD) { bestD = d; best = c.data; }
    }
    if (best) {
      this.ui.updateCompass(`БЛИЖАЙШИЙ СУНДУК · <b>${Math.round(bestD)} М</b> ${this.arrowFor(best)}`);
    } else {
      this.ui.updateCompass('');
    }
  }

  arrowFor(pos) {
    const dx = pos.x - this.player.pos.x;
    const dz = pos.z - this.player.pos.z;
    const fwdX = -Math.sin(this.player.yaw), fwdZ = -Math.cos(this.player.yaw);
    const len = Math.hypot(dx, dz) || 1;
    const tx = dx / len, tz = dz / len;
    const cross = fwdX * tz - fwdZ * tx;
    const dot = fwdX * tx + fwdZ * tz;
    const ang = Math.atan2(cross, dot);
    return `<span style="display:inline-block;transform:rotate(${ang}rad);color:#ffb144;font-size:13px">↑</span>`;
  }

  updateBossUI() {
    if (this.bossMob && !this.bossMob.dead) {
      this.ui.showBoss(this.bossMob.cfg.name, Math.max(0, this.bossMob.hp / this.bossMob.maxHp));
    } else if (!this.bossMob) {
      this.ui.hideBoss();
    }
  }

  updateWorldLights(dt) {
    for (const wl of this.worldLights) {
      const f = 0.8 + Math.sin(this.time * 6 + wl.phase) * 0.12 + Math.sin(this.time * 17 + wl.phase) * 0.06;
      if (wl.light) wl.light.intensity = wl.base * f;
      wl.sprite.material.opacity = 0.35 + f * 0.18;
    }
    if (this.muzzleLight.intensity > 0) {
      this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 90);
    }
  }

  updateSky(dt) {
    this.sky.position.copy(this.camera.position);
    this.sun.position.copy(this.camera.position).addScaledVector(SUN_DIR, 620);
    this.moon.position.copy(this.camera.position).addScaledVector(MOON_DIR, 620);
    this.stars.position.copy(this.camera.position);
    this.stars.rotation.y += dt * 0.0045;
    const focus = this.state === 'menu' ? { x: ISLAND_CENTER.x, y: 36, z: ISLAND_CENTER.z } : this.player.pos;
    this.sunLight.position.set(focus.x + 64, focus.y + 104, focus.z + 42);
    this.sunLight.target.position.set(focus.x, focus.y, focus.z);
    this.sunLight.target.updateMatrixWorld();
    for (const c of this.clouds) {
      c.group.position.x += c.speed * dt;
      if (c.group.position.x > ISLAND_CENTER.x + 300) c.group.position.x = ISLAND_CENTER.x - 300;
    }
    this.updateMeteors(dt);
    this.updateZoneFog(dt);
  }

  updateZoneFog(dt) {
    if (!this.baseFogColor) return;
    const target = this.zoneFogColor || this.baseFogColor;
    this.scene.fog.color.lerp(target, 1 - Math.exp(-dt * 1.6));
  }

  spawnMeteor() {
    const cam = this.camera.position;
    const a = Math.random() * Math.PI * 2;
    const start = new THREE.Vector3(
      cam.x + Math.cos(a) * (200 + Math.random() * 140),
      cam.y + 120 + Math.random() * 120,
      cam.z + Math.sin(a) * (200 + Math.random() * 140)
    );
    const dir = new THREE.Vector3(-Math.cos(a) * 0.55, -1, -Math.sin(a) * 0.55).normalize();
    const len = 16 + Math.random() * 14;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      dir.clone().multiplyScalar(len),
    ]);
    const mat = new THREE.LineBasicMaterial({
      color: Math.random() < 0.3 ? 0xbfe9ff : 0xffedb0,
      transparent: true, opacity: 1, blending: THREE.AdditiveBlending,
      depthWrite: false, fog: false,
    });
    const line = new THREE.Line(geo, mat);
    line.position.copy(start);
    line.renderOrder = -8;
    this.scene.add(line);
    const headMat = new THREE.SpriteMaterial({
      map: makeGlowTexture('255,250,220', '255,180,90', 64),
      color: 0xfff0c0, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    });
    const head = new THREE.Sprite(headMat);
    head.position.copy(start);
    head.scale.setScalar(7 + Math.random() * 5);
    head.renderOrder = -8;
    this.scene.add(head);
    this.meteors.push({ line, head, dir, life: 1.4, max: 1.4, speed: 220 + Math.random() * 120 });
  }

  updateMeteors(dt) {
    if (!this.meteors) return;
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.life -= dt;
      m.line.position.addScaledVector(m.dir, m.speed * dt);
      m.head.position.copy(m.line.position);
      const a = Math.max(0, m.life / m.max);
      m.line.material.opacity = a;
      m.head.material.opacity = a;
      if (m.life <= 0) {
        this.scene.remove(m.line);
        this.scene.remove(m.head);
        m.line.geometry.dispose();
        m.line.material.dispose();
        m.head.material.dispose();
        this.meteors.splice(i, 1);
      }
    }
    if (this.meteorsEnabled) {
      this.meteorTimer -= dt;
      if (this.meteorTimer <= 0) {
        this.meteorTimer = 0.9 + Math.random() * 2.6;
        if (this.meteors.length < 6) this.spawnMeteor();
      }
    }
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const budget = 2_200_000;
    const resCap = Math.sqrt(budget / Math.max(1, w * h));
    this.basePixelRatio = Math.max(0.5, Math.min(dpr, 1.35, resCap));
    this.renderer.setPixelRatio(this.basePixelRatio * this.renderScale);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.viewCamera.aspect = w / h;
    this.viewCamera.updateProjectionMatrix();
  }

  /* ================= input ================= */
  bindEvents() {
    $('btn-play').addEventListener('click', () => this.beginRun());
    for (const el of document.querySelectorAll('[data-mode]')) {
      el.addEventListener('click', () => this.selectMode(el.dataset.mode));
    }
    for (const el of document.querySelectorAll('[data-difficulty]')) {
      el.addEventListener('click', () => this.selectDifficulty(el.dataset.difficulty));
    }
    this.refreshSetupUi();
    $('btn-coop').addEventListener('click', () => this.openCoop());
    $('btn-host-room').addEventListener('click', () => this.createRoom());
    $('btn-host-start').addEventListener('click', () => this.startHostRun());
    $('btn-join-room').addEventListener('click', () => this.joinRoom());
    $('btn-coop-close').addEventListener('click', () => this.closeCoop());
    $('btn-turn-save').addEventListener('click', () => this.saveTurnSettings());
    $('btn-turn-clear').addEventListener('click', () => this.clearTurnSettings());
    $('room-input').addEventListener('keydown', (e) => {
      if (e.code === 'Enter') this.joinRoom();
      e.stopPropagation();
    });
    $('btn-help-menu').addEventListener('click', () => this.ui.toggleHelp(true));
    $('btn-resume').addEventListener('click', () => this.resume());
    $('btn-restart').addEventListener('click', () => {
      this.needWorldReset = true;
      this.beginRun();
    });
    $('btn-menu').addEventListener('click', () => this.toMenu());
    $('btn-again').addEventListener('click', () => {
      this.needWorldReset = true;
      this.beginRun();
    });
    $('btn-end-menu').addEventListener('click', () => this.toMenu());
    $('help-close').addEventListener('click', () => {
      this.ui.toggleHelp(false);
    });
    $('inv-close').addEventListener('click', () => this.closeInventory());
    $('inventory').addEventListener('click', (e) => this.onInventoryClick(e));
    $('shop').addEventListener('click', (e) => this.onShopClick(e));
    $('shop-close').addEventListener('click', () => this.closeShop());
    $('bench').addEventListener('click', (e) => this.onBenchClick(e));
    $('bench-close').addEventListener('click', () => this.closeBench());
    $('alien').addEventListener('click', (e) => this.onAlienClick(e));
    $('alien-close').addEventListener('click', () => this.closeAlienShop());

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => {
      this.input.keys[e.code] = false;
    });
    window.addEventListener('blur', () => {
      this.input.keys = {};
    });

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === this.canvas) {
        if (this.state === 'paused') {
          this.state = 'playing';
          $('pause').classList.add('hidden');
        }
      } else if (this.state === 'playing' && this.runActive) {
        this.pause();
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (this.state !== 'playing') return;
      if (document.pointerLockElement !== this.canvas) { this.requestLock(); return; }
      if (e.button === 0) this.player.onPrimaryPress();
      else if (e.button === 2) this.player.onSecondaryPress();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.player.onPrimaryRelease();
      else if (e.button === 2) this.player.onSecondaryRelease();
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.canvas && this.state === 'playing' && this.player.alive) {
        this.player.mouseMove(e.movementX || 0, e.movementY || 0, this.sensitivity);
      }
    });
    this.canvas.addEventListener('wheel', (e) => {
      if (this.state !== 'playing') return;
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      this.player.cycleSlot(dir);
    }, { passive: false });
  }

  onKeyDown(e) {
    if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    this.input.keys[e.code] = true;
    if (e.repeat) return;
    if (e.code === 'Space') this.input.jumpPressed = true;

    if (this.state === 'menu') {
      if (e.code === 'KeyH') this.ui.toggleHelp();
      return;
    }
    if (this.state === 'alien') {
      if (e.code === 'Escape' || e.code === 'KeyI') this.closeAlienShop();
      return;
    }
    if (this.state === 'bench') {
      if (e.code === 'Escape' || e.code === 'KeyI') this.closeBench();
      return;
    }
    if (this.state === 'shop') {
      if (e.code === 'Escape' || e.code === 'KeyI') this.closeShop();
      return;
    }
    if (this.state === 'inventory') {
      if (e.code === 'KeyI') {
        if (this.inventoryOpen) this.closeInventory();
        else this.openInventory();
      } else if (e.code === 'Escape' && this.inventoryOpen) {
        this.closeInventory();
      }
      return;
    }
    if (this.state === 'paused' || this.state === 'victory' || this.state === 'defeat') {
      if (e.code === 'KeyH') this.ui.toggleHelp();
      return;
    }
    if (this.state !== 'playing') return;

    if (e.code === 'KeyH') { this.ui.toggleHelp(true); this.pause(); return; }
    if (e.code === 'KeyI') { this.openInventory(); return; }
    if (e.code === 'KeyM') {
      this.sound.setMuted(!this.sound.muted);
      this.ui.feed(this.sound.muted ? 'Звук выключен' : 'Звук включён');
      return;
    }
    if (e.code === 'KeyR' && this.player.isWeaponSlot) { this.player.startReload(); return; }
    if (e.code === 'KeyE') { this.interact(); return; }
    if (e.code === 'KeyT') { this.useBossScroll(); return; }
    if (e.code === 'KeyQ') { this.player.cycleWeapon(); return; }
    if (e.code === 'Enter' && this.phase === 'prep' && this.phaseTime > 2) {
      this.phaseTime = 1.2;
      this.ui.feed('Волна начата досрочно');
      return;
    }
    const m = /^Digit([1-9])$/.exec(e.code);
    if (m) this.player.selectSlot(Number(m[1]) - 1);
  }

  /* ================= loop ================= */
  loop(now) {
    requestAnimationFrame(this.loop);
    let rawDt = (now - this.last) / 1000;
    this.last = now;
    if (!isFinite(rawDt) || rawDt < 0) rawDt = 0.016;
    const dt = Math.min(rawDt, 0.05);
    this.time += dt;
    this.frame++;
    if (this.merchant) this.merchant.update(dt);
    if (this.alien) this.alien.update(dt);
    for (const b of this.benches) b.update(dt);

    if (this.state === 'menu') {
      const t = this.time * 0.035;
      this.camera.position.set(
        ISLAND_CENTER.x + Math.cos(t) * 178,
        100 + Math.sin(this.time * 0.13) * 9,
        ISLAND_CENTER.z + Math.sin(t) * 178
      );
      this.camera.lookAt(ISLAND_CENTER.x, 30, ISLAND_CENTER.z);
      this.camera.fov = 58;
      this.camera.updateProjectionMatrix();
      for (const c of this.chests) c.update(dt);
      this.updateSky(dt);
      this.updateWorldLights(dt);
      this.effects.update(dt * 0.6);
    } else if (this.state === 'playing') {
      this.runTime += dt;
      this.player.update(dt, this.input);
      this.updateHazards(dt);
      if (!this.dungeonActive) this.checkAirshipRaid();
      for (let i = this.mobs.length - 1; i >= 0; i--) {
        const m = this.mobs[i];
        if (!m.dead) {
          if (this.netRole === 'guest') m.updateNet(dt);
          else m.update(dt);
        }
      }
      for (let i = this.projectiles.length - 1; i >= 0; i--) {
        const p = this.projectiles[i];
        if (!p.dead) p.update(dt);
      }
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const p = this.pickups[i];
        if (!p.dead) p.update(dt);
      }
      for (const c of this.chests) c.update(dt);
      this.world.rebuildDirty(3);
      this.effects.update(dt);
      if (this.dungeonActive) {
        this.updateDungeon(dt);
      } else if (this.netRole !== 'guest') this.updateWaves(dt);
      else {
        this.phaseTime = Math.max(0, this.phaseTime - dt);
        this.updateGuestHud();
      }
      if (!this.dungeonActive) this.updateLootRefresh(dt);
      this.updateChestInteraction();
      this.updateBossUI();
      this.updateWorldLights(dt);
      this.updateSky(dt);
      this.updateHealth();
      this.ui.setMineProgress(this.player.mining ? this.player.mineProg : 0);
      if (!this.dungeonActive) {
        this.ui.updateMinimap(this.player, dt);
        this.compassTimer -= dt;
        if (this.compassTimer <= 0) {
          this.compassTimer = 0.22;
          this.updateCompass();
        }
      }
      this.updateNet(dt);
      const w = window.innerWidth, h = window.innerHeight;
      this.barTimer -= dt;
      if (this.barTimer <= 0) {
        this.barTimer = 0.06;
        for (const m of this.mobs) if (!m.dead) m.syncBar(this.camera, w, h);
      }
      if (this.netRole === null && !this.player.alive && !this.dying) {
        this.dying = true;
        this.sound.death();
        this.ui.banner('СИГНАЛ ПОТЕРЯН', 'ВЫ ПОГИБЛИ', 'Остров остался без защитника', true, 2200);
        setTimeout(() => {
          if (this.state === 'playing' && this.dying) this.endRun(false);
        }, 1800);
      }
    } else if (this.state === 'paused' || this.state === 'victory' || this.state === 'defeat') {
      this.updateSky(dt);
      this.updateWorldLights(dt);
    } else if (this.state === 'inventory' || this.state === 'shop' || this.state === 'bench' || this.state === 'alien') {
      this.updateSky(dt);
      this.updateWorldLights(dt);
    }

    for (const m of this.mobs) if (!m.dead) m.group.position.needsUpdate = false;

    // adaptive quality: lower resolution, then shadows, if the frame rate stays low
    if (this.state === 'playing' && !document.hidden) {
      this.perf.acc += rawDt;
      this.perf.frames++;
      this.perf.timer += rawDt;
      if (this.perf.timer > 1.6) {
        const fps = this.perf.frames / Math.max(0.001, this.perf.acc);
        this.perf.acc = 0;
        this.perf.frames = 0;
        this.perf.timer = 0;
        if (this.runTime > 2.5 && fps < 45) this.perf.lowStreak++;
        else this.perf.lowStreak = Math.max(0, this.perf.lowStreak - 1);
        if (this.perf.lowStreak >= 2) {
          this.perf.lowStreak = 0;
          if (this.renderScale > 0.58) {
            this.renderScale = Math.max(0.58, this.renderScale - 0.12);
            this.applyRenderScale();
            if (!this.perf.lowered) {
              this.perf.lowered = true;
              this.ui.feed('Качество снижено для плавности');
            }
          } else if (this.sunLight.castShadow) {
            this.renderer.shadowMap.enabled = false;
            this.sunLight.castShadow = false;
            this.ui.feed('Тени отключены для плавности');
          }
        }
      }
    }

    this.shadowFrame++;
    if (this.sunLight.castShadow) {
      this.renderer.shadowMap.needsUpdate = this.shadowDirty || (this.shadowFrame % 2 === 0);
      this.shadowDirty = false;
    } else {
      this.renderer.shadowMap.needsUpdate = false;
    }

    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    if (this.state === 'playing' || this.state === 'paused') {
      this.renderer.clearDepth();
      this.renderer.render(this.viewScene, this.viewCamera);
    }
  }

  applyRenderScale() {
    this.renderer.setPixelRatio(this.basePixelRatio * this.renderScale);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.viewCamera.aspect = this.camera.aspect;
    this.viewCamera.updateProjectionMatrix();
  }
}

// helpers on UI for world-space damage text
UI.prototype.showDamageTextFromWorld = function (worldPos, amount, head) {
  _v.copy(worldPos).project(this.game.camera);
  if (_v.z > 1 || _v.z < -1) return;
  const w = window.innerWidth, h = window.innerHeight;
  const x = (_v.x * 0.5 + 0.5) * w;
  const y = (-_v.y * 0.5 + 0.5) * h;
  this.showDamageText(x + rand(-8, 8), y - 10, String(amount), head ? 'crit' : '');
};
