import * as THREE from '../vendor/three.module.js';
import { PLAYER, BLOCKS, B, START_BLOCKS, SLOT, WEAPONS, ISLAND_CENTER, ARMOR, ARMOR_SETS, ARMOR_SLOTS, WEAPON_PAINTS, WEAPON_UPGRADE } from './config.js';
import { makeFlashTexture } from './textures.js';

const VGEO = new THREE.BoxGeometry(1, 1, 1);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

function vbox(parent, w, h, d, x, y, z, color, opts = {}) {
  const mat = new THREE.MeshLambertMaterial({ color });
  if (opts.emissive) mat.emissive = new THREE.Color(opts.emissive);
  const m = new THREE.Mesh(VGEO, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  if (opts.rot) m.rotation.set(opts.rot[0] || 0, opts.rot[1] || 0, opts.rot[2] || 0);
  parent.add(m);
  return m;
}

/* ------------------------------------------------------------
   First-person viewmodel (separate scene rendered on top)
------------------------------------------------------------ */
export class ViewModel {
  constructor(game) {
    this.game = game;
    this.scene = game.viewScene;
    this.camera = game.viewCamera;
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.holder = new THREE.Group();
    this.holder.scale.setScalar(0.8);
    this.root.add(this.holder);
    this.base = new THREE.Vector3(0.24, -0.2, -0.62);
    this.aimBase = new THREE.Vector3(0.015, -0.13, -0.52);
    this.weaponBase = null;
    this.weaponAimBase = null;
    this.holder.position.copy(this.base);
    this.current = null;
    this.mats = [];
    this.muzzle = new THREE.Object3D();
    this.holder.add(this.muzzle);
    this.time = 0;
    this.raise = 1;
    this.flashTime = 0;
    const fm = new THREE.MeshBasicMaterial({
      map: makeFlashTexture(), transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: false, opacity: 0,
    });
    this.flashSprite = new THREE.Sprite(fm);
    this.flashSprite.scale.setScalar(0.34);
    this.flashSprite.position.set(0, 0.01, -0.07);
    this.flashSprite.renderOrder = 30;
    this.holder.add(this.flashSprite);
  }

  clearModel() {
    if (this.current) {
      this.holder.remove(this.current);
      this.current.traverse(o => {
        if (o.isMesh) {
          o.material.dispose();
          if (o.geometry !== VGEO) o.geometry.dispose();
        }
      });
      this.current = null;
    }
    this.mats.length = 0;
  }

  buildFor(player) {
    this.clearModel();
    this.weaponBase = null;
    this.weaponAimBase = null;
    const g = new THREE.Group();
    this.current = g;
    this.holder.add(g);
    const slot = player.slot;
    if (slot === SLOT.PICKAXE) {
      // handle
      vbox(g, 0.038, 0.46, 0.038, 0, -0.12, 0.05, 0x8a5a33, { rot: [0.15, 0, 0.2] });
      vbox(g, 0.05, 0.12, 0.05, 0, -0.31, 0.08, 0x3a2a1c, { rot: [0.15, 0, 0.2] });
      // head
      vbox(g, 0.2, 0.06, 0.07, -0.02, 0.12, -0.02, 0xaab4c0, { rot: [0, 0, -0.16] });
      vbox(g, 0.1, 0.055, 0.075, -0.13, 0.12, -0.02, 0xd7e1ea, { rot: [0, 0, -0.16] });
      vbox(g, 0.1, 0.055, 0.075, 0.1, 0.12, -0.02, 0xd7e1ea, { rot: [0, 0, -0.16] });
      this.muzzle.position.set(0, 0.16, -0.1);
      this.holder.position.set(0.32, -0.3, -0.62);
    } else if (slot >= SLOT.BLOCK0 && slot <= SLOT.BLOCK4) {
      const id = player.hotbarBlocks[slot - SLOT.BLOCK0];
      if (!id) return;
      const cube = new THREE.Mesh(this.blockGeometry(id), this.game.world.material ? new THREE.MeshLambertMaterial({ map: this.game.world.atlas.texture }) : new THREE.MeshLambertMaterial({ color: BLOCKS[id].color }));
      cube.scale.setScalar(0.155);
      cube.rotation.set(0.2, 0.7, 0);
      g.add(cube);
      this.muzzle.position.set(0, 0.05, -0.15);
      this.holder.position.set(0.3, -0.25, -0.64);
    } else if (slot === SLOT.MEDKIT) {
      vbox(g, 0.3, 0.2, 0.1, 0, 0, 0, 0xe6ebf2);
      vbox(g, 0.18, 0.055, 0.105, 0, 0, 0.002, 0xff5468);
      vbox(g, 0.055, 0.18, 0.105, 0, 0, 0.002, 0xff5468);
      this.muzzle.position.set(0, 0, -0.2);
      this.holder.position.set(0.27, -0.23, -0.62);
    } else {
      const key = slot === SLOT.SECONDARY ? player.slots.secondary : player.slots.primary;
      const cfg = player.getEffectiveWeapon ? player.getEffectiveWeapon(key) : (WEAPONS[key] || WEAPONS.pistol);
      if (cfg.melee) {
        this.buildMelee(g, key, cfg);
        g.rotation.set(-0.12, 0.26, -0.42);
        g.scale.setScalar(0.82);
        this.weaponBase = new THREE.Vector3(0.27, -0.27, -0.7);
      } else {
        this.buildGun(g, key, cfg);
        if (key === 'ak' || key === 'sniper' || key === 'minigun') {
          g.rotation.set(-0.02, 0.18, 0.01);
          g.scale.setScalar(0.84);
          this.weaponBase = new THREE.Vector3(0.27, -0.27, -0.78);
          this.weaponAimBase = new THREE.Vector3(0.02, -0.16, -0.66);
        } else {
          this.holder.position.copy(this.base);
        }
      }
    }
    this.flashSprite.position.copy(this.muzzle.position);
    this.flashSprite.position.z -= 0.04;
    this.raise = 0;
  }

  blockGeometry(id) {
    const atlas = this.game.world.atlas;
    const def = BLOCKS[id];
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const uv = geo.attributes.uv;
    const tileNames = [
      def.tiles.all || def.tiles.side, def.tiles.all || def.tiles.side,
      def.tiles.all || def.tiles.top, def.tiles.all || def.tiles.bottom,
      def.tiles.all || def.tiles.side, def.tiles.all || def.tiles.side,
    ];
    for (let f = 0; f < 6; f++) {
      const [u0, v0, u1, v1] = atlas.uv(tileNames[f] || 'stone');
      for (let i = 0; i < 4; i++) {
        const k = f * 4 + i;
        uv.setXY(k, uv.getX(k) > 0.5 ? u1 : u0, uv.getY(k) > 0.5 ? v1 : v0);
      }
    }
    uv.needsUpdate = true;
    return geo;
  }

  buildGun(g, key, cfg) {
    const dark = 0x252c36;
    const mid = new THREE.Color(cfg.color).multiplyScalar(0.76).getHex();
    const accent = cfg.accent;
    const grip = 0x3a2c22;
    if (key === 'pistol') {
      vbox(g, 0.085, 0.095, 0.3, 0, 0.02, -0.12, mid);
      vbox(g, 0.07, 0.055, 0.28, 0, 0.085, -0.14, 0xb8c3d0);
      vbox(g, 0.075, 0.2, 0.1, 0, -0.13, 0.01, grip, { rot: [-0.18, 0, 0] });
      vbox(g, 0.02, 0.03, 0.1, 0, -0.05, -0.16, dark);
      vbox(g, 0.09, 0.02, 0.06, 0, 0.06, 0.015, accent);
      vbox(g, 0.032, 0.032, 0.07, 0, 0.035, -0.3, dark);
      // slide serrations and ejection port (left side faces the camera)
      for (let i = 0; i < 3; i++) vbox(g, 0.006, 0.038, 0.008, -0.041, 0.085, 0.01 + i * 0.022, dark);
      vbox(g, 0.006, 0.028, 0.075, -0.041, 0.087, -0.09, 0x171c23);
      vbox(g, 0.006, 0.02, 0.09, -0.044, 0.02, -0.11, 0x59636f);
      // front sight
      vbox(g, 0.016, 0.022, 0.016, 0, 0.122, -0.26, dark);
      // trigger guard
      vbox(g, 0.014, 0.02, 0.1, -0.035, -0.055, -0.02, dark);
      vbox(g, 0.014, 0.055, 0.016, -0.035, -0.03, -0.065, dark);
      // grip grooves
      vbox(g, 0.008, 0.13, 0.06, -0.043, -0.14, 0.02, 0x2c2119);
      this.muzzle.position.set(0, 0.04, -0.31);
    } else if (key === 'smg') {
      vbox(g, 0.1, 0.12, 0.42, 0, 0.01, -0.15, mid);
      vbox(g, 0.07, 0.06, 0.24, 0, 0.085, -0.24, dark);
      vbox(g, 0.085, 0.24, 0.1, 0, -0.15, -0.1, dark, { rot: [0.12, 0, 0] });
      vbox(g, 0.06, 0.24, 0.09, 0, -0.12, -0.24, 0x58606b, { rot: [0.35, 0, 0] });
      vbox(g, 0.05, 0.05, 0.2, 0, 0.02, -0.42, 0x3a424d);
      vbox(g, 0.03, 0.03, 0.08, 0, 0.01, -0.53, dark);
      vbox(g, 0.07, 0.02, 0.3, 0, 0.075, -0.16, accent);
      vbox(g, 0.08, 0.12, 0.12, 0, -0.05, 0.12, dark);
      this.muzzle.position.set(0, 0.01, -0.57);
    } else if (key === 'shotgun') {
      vbox(g, 0.09, 0.11, 0.52, 0, 0.01, -0.15, 0x6d4b30);
      vbox(g, 0.06, 0.06, 0.56, 0, 0.09, -0.18, mid);
      vbox(g, 0.07, 0.07, 0.54, 0, -0.02, -0.2, 0x3a2b1f);
      vbox(g, 0.085, 0.22, 0.09, 0, -0.14, 0.05, grip, { rot: [-0.25, 0, 0] });
      vbox(g, 0.14, 0.13, 0.13, 0, -0.16, -0.22, 0x7b5a3c, { rot: [-0.2, 0, 0] });
      vbox(g, 0.065, 0.065, 0.18, 0, 0.02, -0.5, dark);
      vbox(g, 0.075, 0.025, 0.12, 0, 0.095, -0.07, accent);
      this.muzzle.position.set(0, 0.02, -0.59);
    } else if (key === 'rifle') {
      vbox(g, 0.085, 0.1, 0.62, 0, 0.01, -0.12, mid);
      vbox(g, 0.1, 0.1, 0.2, 0, 0, 0.24, dark);
      vbox(g, 0.06, 0.06, 0.34, 0, 0.06, -0.36, 0x3a4452);
      vbox(g, 0.09, 0.08, 0.22, 0, 0.13, -0.12, 0x2c3540);
      vbox(g, 0.055, 0.055, 0.18, 0, 0.13, -0.28, 0x11161c);
      vbox(g, 0.075, 0.24, 0.1, 0, -0.15, -0.02, dark, { rot: [0.18, 0, 0] });
      vbox(g, 0.08, 0.09, 0.13, 0, -0.1, -0.22, 0x58606b, { rot: [0.32, 0, 0] });
      vbox(g, 0.05, 0.05, 0.24, 0, 0.01, -0.48, dark);
      vbox(g, 0.03, 0.03, 0.1, 0, 0.01, -0.64, 0x20262e);
      vbox(g, 0.06, 0.02, 0.28, 0, 0.075, 0.08, accent);
      vbox(g, 0.02, 0.05, 0.02, 0, 0.13, 0.24, accent);
      this.muzzle.position.set(0, 0.01, -0.7);
    } else if (key === 'ak') {
      // receiver + wooden furniture
      vbox(g, 0.09, 0.11, 0.44, 0, 0.01, -0.1, mid);
      vbox(g, 0.085, 0.1, 0.2, 0, 0.005, 0.19, 0x7a4f2c);
      vbox(g, 0.08, 0.08, 0.22, 0, 0.01, -0.32, 0x8a5a33);
      vbox(g, 0.075, 0.075, 0.24, 0, 0.07, -0.34, 0x4a3a2c);
      vbox(g, 0.07, 0.07, 0.2, 0, 0.015, -0.5, dark);
      vbox(g, 0.05, 0.05, 0.14, 0, 0.02, -0.63, 0x20262e);
      // curved magazine
      vbox(g, 0.065, 0.2, 0.11, 0, -0.15, -0.12, 0x5a4228, { rot: [0.3, 0, 0] });
      vbox(g, 0.06, 0.12, 0.09, 0, -0.25, -0.19, 0x4a3620, { rot: [0.5, 0, 0] });
      vbox(g, 0.08, 0.22, 0.09, 0, -0.14, 0.06, grip, { rot: [-0.2, 0, 0] });
      // rear sight + selector
      vbox(g, 0.05, 0.035, 0.05, 0, 0.085, -0.06, dark);
      vbox(g, 0.02, 0.06, 0.02, 0.05, 0.075, -0.24, accent);
      this.muzzle.position.set(0, 0.02, -0.7);
    } else if (key === 'sniper') {
      // long precision rifle
      vbox(g, 0.06, 0.078, 0.72, 0, 0.01, -0.16, mid);
      vbox(g, 0.045, 0.045, 0.44, 0, 0.02, -0.54, 0x3a4452);
      vbox(g, 0.032, 0.032, 0.2, 0, 0.02, -0.78, 0x2c3540);
      vbox(g, 0.085, 0.115, 0.2, 0, -0.01, 0.22, 0x4a5563);
      vbox(g, 0.055, 0.16, 0.08, 0, -0.11, 0.05, grip, { rot: [-0.22, 0, 0] });
      vbox(g, 0.065, 0.15, 0.08, 0, -0.11, -0.18, 0x4a3a2c, { rot: [0.25, 0, 0] });
      // scope
      vbox(g, 0.075, 0.075, 0.32, 0, 0.15, -0.2, 0x2f3944);
      vbox(g, 0.095, 0.095, 0.05, 0, 0.15, -0.36, 0x232b34);
      vbox(g, 0.095, 0.095, 0.05, 0, 0.15, -0.04, 0x232b34);
      vbox(g, 0.02, 0.055, 0.02, 0.05, 0.09, -0.16, accent);
      // bipod
      vbox(g, 0.02, 0.18, 0.02, -0.06, -0.09, -0.6, dark, { rot: [0, 0, 0.32] });
      vbox(g, 0.02, 0.18, 0.02, 0.06, -0.09, -0.6, dark, { rot: [0, 0, -0.32] });
      this.muzzle.position.set(0, 0.02, -0.88);
    } else if (key === 'minigun') {
      // bulky rotor housing
      vbox(g, 0.15, 0.15, 0.3, 0, 0.01, -0.06, mid);
      vbox(g, 0.19, 0.04, 0.2, 0, 0.09, -0.03, dark);
      // barrel cluster
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const bx = Math.cos(a) * 0.05, by = Math.sin(a) * 0.05;
        vbox(g, 0.026, 0.026, 0.62, bx, by + 0.01, -0.52, i % 2 ? 0x9aa3ae : 0x646c76);
      }
      vbox(g, 0.12, 0.12, 0.05, 0, 0.01, -0.24, 0x3a424d);
      vbox(g, 0.14, 0.14, 0.04, 0, 0.01, -0.82, 0x2c3540);
      // ammo box + feed chute
      vbox(g, 0.14, 0.15, 0.17, 0.05, -0.14, 0.05, 0x4a4f38);
      vbox(g, 0.05, 0.09, 0.14, 0.02, -0.05, -0.04, 0x6b6f4a, { rot: [0.3, 0, 0] });
      vbox(g, 0.055, 0.16, 0.085, 0, -0.13, 0.14, grip, { rot: [-0.18, 0, 0] });
      vbox(g, 0.07, 0.02, 0.18, 0, 0.105, -0.03, accent);
      this.muzzle.position.set(0, 0.01, -0.88);
    } else if (key === 'laser') {
      vbox(g, 0.07, 0.085, 0.56, 0, 0.01, -0.18, mid);
      vbox(g, 0.055, 0.055, 0.4, 0, 0.02, -0.58, 0x3a2a50);
      vbox(g, 0.03, 0.03, 0.18, 0, 0.02, -0.82, 0x1b1026);
      vbox(g, 0.09, 0.12, 0.16, 0, 0.01, 0.1, 0x2c1b3a);
      vbox(g, 0.06, 0.15, 0.08, 0, -0.12, 0.06, grip, { rot: [-0.18, 0, 0] });
      // glowing coils
      for (let i = 0; i < 3; i++) {
        vbox(g, 0.095, 0.035, 0.045, 0, 0.07, -0.3 - i * 0.1, accent, { rot: [0, 0, 0] });
      }
      vbox(g, 0.11, 0.06, 0.14, 0, 0.1, -0.12, 0x241832);
      vbox(g, 0.03, 0.05, 0.22, 0, 0.14, -0.3, accent);
      this.muzzle.position.set(0, 0.02, -0.9);
    } else if (key === 'plasma') {
      vbox(g, 0.15, 0.13, 0.42, 0, 0.01, -0.1, mid);
      vbox(g, 0.12, 0.12, 0.18, 0, 0.02, 0.16, 0x2a3540);
      vbox(g, 0.08, 0.08, 0.26, 0, 0.02, -0.4, 0x3a4a44);
      // glowing plasma chamber
      vbox(g, 0.2, 0.2, 0.2, 0, 0.11, -0.16, 0x24443c);
      vbox(g, 0.12, 0.12, 0.22, 0, 0.11, -0.16, accent);
      vbox(g, 0.06, 0.06, 0.06, 0.06, 0.17, -0.1, 0xd8ffe8);
      vbox(g, 0.18, 0.06, 0.22, 0, -0.06, -0.1, 0x39424e);
      vbox(g, 0.07, 0.17, 0.09, 0, -0.14, 0.12, grip, { rot: [-0.18, 0, 0] });
      vbox(g, 0.1, 0.02, 0.18, 0, 0.1, -0.42, accent);
      this.muzzle.position.set(0, 0.06, -0.54);
    }
    // gloved hand on the grip
    vbox(g, 0.105, 0.1, 0.115, 0.005, -0.19, 0.055, 0x343b45);
    vbox(g, 0.11, 0.028, 0.12, 0.005, -0.143, 0.055, 0x4a525e);
    this.holder.rotation.set(0.02, -0.06, 0);
  }

  buildMelee(g, key, cfg) {
    const hand = 0x343b45;
    const glove = 0x4a525e;
    const grip = 0x2c2119;
    const body = cfg?.color ?? 0xc7d2de;
    const accent = cfg?.accent ?? 0xffb144;
    if (key === 'knife') {
      vbox(g, 0.04, 0.19, 0.045, 0, -0.12, 0.02, grip);
      vbox(g, 0.085, 0.025, 0.05, 0, -0.02, 0.01, 0x6a727d);
      vbox(g, 0.042, 0.28, 0.025, 0, 0.14, 0, body);
      vbox(g, 0.012, 0.24, 0.006, -0.014, 0.13, -0.016, accent);
      vbox(g, 0.035, 0.05, 0.04, 0, -0.235, 0.03, 0x8a5a33);
      vbox(g, 0.07, 0.085, 0.075, 0.004, -0.1, 0.04, hand);
      vbox(g, 0.075, 0.024, 0.085, 0.004, -0.058, 0.04, glove);
    } else if (key === 'bat') {
      vbox(g, 0.05, 0.26, 0.05, 0, -0.19, 0.02, 0x4a3320);
      vbox(g, 0.068, 0.34, 0.068, 0, 0.06, 0, body);
      vbox(g, 0.09, 0.28, 0.09, 0, 0.28, 0, body);
      vbox(g, 0.095, 0.045, 0.095, 0, 0.44, 0, 0x6a4528);
      for (let i = 0; i < 3; i++) {
        vbox(g, 0.018, 0.018, 0.018, -0.038, 0.22 + i * 0.06, -0.03, accent);
      }
      vbox(g, 0.07, 0.085, 0.075, 0.004, -0.17, 0.03, hand);
      vbox(g, 0.075, 0.024, 0.085, 0.004, -0.128, 0.03, glove);
    } else if (key === 'sword') {
      vbox(g, 0.045, 0.2, 0.05, 0, -0.22, 0.02, 0x3a2414);
      vbox(g, 0.05, 0.16, 0.05, 0, -0.1, 0.02, 0x2c2119);
      vbox(g, 0.15, 0.028, 0.055, 0, 0.02, 0.01, 0xc9a24a);
      vbox(g, 0.05, 0.46, 0.028, 0, 0.27, 0, body);
      vbox(g, 0.014, 0.4, 0.006, 0, 0.26, -0.017, accent);
      vbox(g, 0.045, 0.045, 0.045, 0, -0.33, 0.02, 0xffd24a);
      vbox(g, 0.07, 0.085, 0.075, 0.004, -0.16, 0.03, hand);
      vbox(g, 0.075, 0.024, 0.085, 0.004, -0.118, 0.03, glove);
    } else if (key === 'axe') {
      vbox(g, 0.04, 0.62, 0.04, 0, -0.05, 0.02, 0x8a5a33);
      vbox(g, 0.042, 0.16, 0.042, 0, -0.34, 0.03, 0x5a3a21);
      vbox(g, 0.2, 0.17, 0.05, -0.08, 0.3, 0, body);
      vbox(g, 0.065, 0.21, 0.055, -0.2, 0.3, 0, accent);
      vbox(g, 0.05, 0.09, 0.055, 0.06, 0.3, 0, 0x3a424d);
      vbox(g, 0.07, 0.085, 0.075, 0.004, -0.2, 0.03, hand);
      vbox(g, 0.075, 0.024, 0.085, 0.004, -0.158, 0.03, glove);
    } else if (key === 'sledge') {
      vbox(g, 0.045, 0.66, 0.045, 0, -0.05, 0.02, 0x8a5a33);
      vbox(g, 0.048, 0.16, 0.048, 0, -0.36, 0.03, 0x4a3320);
      vbox(g, 0.27, 0.17, 0.14, -0.03, 0.31, 0, body);
      vbox(g, 0.05, 0.19, 0.15, -0.17, 0.31, 0, accent);
      vbox(g, 0.05, 0.045, 0.15, -0.03, 0.31, 0, 0xffd24a);
      vbox(g, 0.07, 0.085, 0.075, 0.004, -0.22, 0.03, hand);
      vbox(g, 0.075, 0.024, 0.085, 0.004, -0.178, 0.03, glove);
    }
    this.muzzle.position.set(0, 0.12, -0.4);
  }

  muzzleFlash() {
    this.flashTime = 0.055;
    this.flashSprite.material.opacity = 1;
    this.flashSprite.material.rotation = Math.random() * Math.PI;
    this.flashSprite.scale.setScalar(0.28 + Math.random() * 0.16);
  }

  update(dt, player) {
    this.time += dt;
    this.raise = Math.min(1, this.raise + dt * 6.5);
    const aiming = player.aiming;
    const target = aiming ? (this.weaponAimBase || this.aimBase) : (this.weaponBase || this.base);
    const speed = Math.hypot(player.vel.x, player.vel.z);
    const moving = speed > 0.6 && player.onGround;
    const bobAmt = moving ? 0.011 : 0.0025;
    const bobX = Math.sin(this.time * (moving ? 9.2 : 1.8)) * bobAmt;
    const bobY = Math.abs(Math.cos(this.time * (moving ? 9.2 : 1.8))) * bobAmt * 0.8;
    const swayX = clamp(player.swayX, -1.2, 1.2) * 0.022;
    const swayY = clamp(player.swayY, -1.2, 1.2) * 0.018;

    let px = target.x + bobX + swayX;
    let py = target.y + bobY + swayY;
    let pz = target.z;

    // recoil
    const rec = player.vmRecoil;
    pz += rec * 0.14;
    py += rec * 0.045;
    pz += (1 - this.raise) * 0.12;
    py -= (1 - this.raise) * 0.3;
    if (player.crouching) py -= 0.045;

    // reload dip
    if (player.reloading > 0) {
      const cfg = player.weaponCfg;
      const k = 1 - player.reloading / Math.max(0.01, cfg.reload);
      const s = Math.sin(Math.min(1, k) * Math.PI);
      py -= s * 0.2;
      px -= s * 0.05;
      this.holder.rotation.z = s * 0.6;
      this.holder.rotation.x = s * 0.4;
    } else if (player.mining && player.slot === SLOT.PICKAXE) {
      const sw = Math.sin(this.time * 20) * 0.22;
      this.holder.rotation.z = -0.25 + sw;
      this.holder.rotation.x = -0.15 + Math.cos(this.time * 20) * 0.12;
      py -= Math.abs(Math.sin(this.time * 20)) * 0.03;
    } else if (player.meleeAnim > 0) {
      const k = 1 - player.meleeAnim / Math.max(0.01, player.meleeDur);
      const s = Math.sin(Math.min(1, k) * Math.PI);
      this.holder.rotation.z = -0.12 - s * 0.9;
      this.holder.rotation.x = 0.1 + s * 0.72;
      px -= s * 0.06;
      py -= s * 0.05;
      pz -= s * 0.14;
    } else if (player.placeAnim > 0) {
      const s = player.placeAnim / 0.16;
      py -= s * 0.08;
      this.holder.rotation.x = s * 0.25;
    } else if (player.medkitAnim > 0) {
      const s = Math.sin((1 - player.medkitAnim / 0.5) * Math.PI);
      py += s * 0.1;
      this.holder.rotation.z = s * 0.5;
    } else {
      this.holder.rotation.z = damp(this.holder.rotation.z, 0, 10, dt);
      this.holder.rotation.x = damp(this.holder.rotation.x, 0.02, 10, dt);
    }

    if (player.sprinting && !aiming) {
      this.holder.rotation.y = damp(this.holder.rotation.y, -0.35, 8, dt);
      py -= 0.03;
    } else {
      this.holder.rotation.y = damp(this.holder.rotation.y, -0.06, 8, dt);
    }

    this.holder.position.set(px, py, pz);

    if (this.flashTime > 0) {
      this.flashTime -= dt;
      this.flashSprite.material.opacity = Math.max(0, this.flashTime / 0.055);
    } else {
      this.flashSprite.material.opacity = 0;
    }
  }

  dispose() { this.clearModel(); this.scene.remove(this.root); }
}

/* ------------------------------------------------------------
   Player
------------------------------------------------------------ */
export class Player {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3(ISLAND_CENTER.x + 0.5, 40, ISLAND_CENTER.z + 0.5);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.alive = true;
    this.hp = PLAYER.maxHp;
    this.maxHp = PLAYER.maxHp;
    this.lastDamage = 99;
    this.invuln = 0;
    this.regenTimer = 0;
    this.shake = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.bobT = 0;
    this.stepT = 0;
    this.sprinting = false;
    this.aiming = false;
    this.crouching = false;
    this.hitboxHeight = PLAYER.height;
    this.camEye = PLAYER.eye;
    this.sprintLatch = false;
    this.prevW = false;
    this.lastWTap = -9;

    // inventory
    this.slot = SLOT.PRIMARY;
    this.blocks = {};
    for (const k in BLOCKS) this.blocks[k] = 0;
    this.blocks[B.STONE] = 26;
    this.blocks[B.PLANKS] = 26;
    this.hotbarBlocks = START_BLOCKS.slice();
    this.medkits = 0;
    this.coins = 0;
    this.armor = 0;
    this.maxArmor = PLAYER.maxArmor;
    this.sandbox = false;
    this.infiniteAmmo = false;
    this.infiniteBlocks = false;
    this.armorOwned = {};
    this.armorEquip = { helmet: null, chest: null, legs: null };
    this.armorReduction = 0;
    this.equippedSet = null;
    this.slots = { primary: 'pistol', secondary: null };
    this.initArsenal();
    this.weaponParts = { scope: 0, suppressor: 0, extmag: 0 };
    this.weaponAttach = {};
    this.weaponPaint = {};
    this.weaponUpgrades = {};
    this.gearVersion = 0;
    this._cfgCache = {};
    this.fireCd = 0;
    this.reloading = 0;
    this.reloadKey = null;
    this.autoReload = 0;
    this.recoilPitch = 0;
    this.vmRecoil = 0;
    this.bloom = 0;
    this.mining = null;
    this.mineProg = 0;
    this.placeCd = 0;
    this.placeAnim = 0;
    this.medkitAnim = 0;
    this.meleeAnim = 0;
    this.meleeDur = 0.3;
    this.useCd = 0;
    this.hover = null;
    this.primaryDown = false;
    this.secondaryDown = false;
    this.stats = { mined: 0, placed: 0, shots: 0, hits: 0 };

    this.vm = new ViewModel(game);
    this.vm.buildFor(this);
  }

  get weaponKey() {
    return this.slot === SLOT.SECONDARY ? this.slots.secondary : this.slots.primary;
  }
  get weaponCfg() {
    return this.getEffectiveWeapon(this.weaponKey) || WEAPONS.pistol;
  }
  get isWeaponSlot() { return this.slot === SLOT.PRIMARY || this.slot === SLOT.SECONDARY; }

  getEffectiveWeapon(key) {
    const base = WEAPONS[key] || WEAPONS.pistol;
    const cache = this._cfgCache[key];
    if (cache && cache.v === this.gearVersion) return cache.cfg;
    const cfg = { ...base };
    const at = this.weaponAttach[key] || {};
    const lvl = Math.min(WEAPON_UPGRADE.maxLevel, this.weaponUpgrades[key] || 0);
    if (!base.melee) {
      if (at.extmag) {
        cfg.mag = Math.max(1, Math.round(base.mag * 1.6));
        cfg.reserveMax = Math.round(base.reserveMax * 1.25);
      }
      if (at.suppressor) {
        cfg.spread = base.spread * 0.7;
        cfg.kick = base.kick * 0.8;
      }
      if (at.scope) {
        cfg.zoom = (base.zoom || 1) * 1.45;
        cfg.range = base.range * 1.15;
      }
      cfg.reload = base.reload * (1 - WEAPON_UPGRADE.reloadStep * lvl);
    }
    cfg.dmg = Math.round(base.dmg * (1 + WEAPON_UPGRADE.damageStep * lvl));
    const paint = WEAPON_PAINTS.find(p => p.id === this.weaponPaint[key]);
    if (paint && paint.color != null) {
      cfg.color = paint.color;
      cfg.accent = paint.accent;
    }
    this._cfgCache[key] = { v: this.gearVersion, cfg };
    return cfg;
  }

  invalidateGear() {
    this.gearVersion++;
    this._cfgCache = {};
    if (this.isWeaponSlot) this.vm.buildFor(this);
  }

  addWeaponPart(id, n = 1) {
    if (!(id in this.weaponParts)) return 0;
    this.weaponParts[id] = Math.min(99, this.weaponParts[id] + n);
    return this.weaponParts[id];
  }

  partCount(id) { return this.weaponParts[id] || 0; }

  hasWeaponAttachment(key, id) {
    return !!this.weaponAttach[key]?.[id];
  }

  toggleWeaponAttachment(key, id) {
    const base = WEAPONS[key];
    if (!base || base.melee || !(id in this.weaponParts)) return null;
    const at = this.weaponAttach[key] || (this.weaponAttach[key] = {});
    if (at[id]) {
      at[id] = false;
      this.weaponParts[id]++;
    } else {
      if (this.weaponParts[id] <= 0) return null;
      this.weaponParts[id]--;
      at[id] = true;
    }
    if (id === 'extmag') {
      this.invalidateGear();
      const eff = this.getEffectiveWeapon(key);
      if (this.mag[key] > eff.mag) this.mag[key] = eff.mag;
    } else {
      this.invalidateGear();
    }
    return !!at[id];
  }

  setWeaponPaint(key, paintId) {
    if (!WEAPONS[key] || !WEAPON_PAINTS.some(p => p.id === paintId)) return false;
    this.weaponPaint[key] = paintId;
    this.invalidateGear();
    return true;
  }

  weaponUpgradeLevel(key) {
    return Math.min(WEAPON_UPGRADE.maxLevel, this.weaponUpgrades[key] || 0);
  }

  weaponUpgradeCost(key) {
    const lvl = this.weaponUpgradeLevel(key);
    if (lvl >= WEAPON_UPGRADE.maxLevel) return null;
    return WEAPON_UPGRADE.costs[lvl];
  }

  upgradeWeapon(key) {
    if (!WEAPONS[key]) return false;
    const lvl = this.weaponUpgradeLevel(key);
    if (lvl >= WEAPON_UPGRADE.maxLevel) return false;
    this.weaponUpgrades[key] = lvl + 1;
    this.invalidateGear();
    return true;
  }

  initArsenal() {
    this.slots = { primary: 'pistol', secondary: null };
    this.mag = {};
    this.reserve = {};
    this.owned = {};
    for (const key of Object.keys(WEAPONS)) {
      this.mag[key] = 0;
      this.reserve[key] = 0;
      this.owned[key] = false;
    }
    this.mag.pistol = WEAPONS.pistol.mag;
    this.reserve.pistol = 60;
    this.owned.pistol = true;
  }

  grantSandbox() {
    this.sandbox = true;
    this.infiniteAmmo = true;
    this.infiniteBlocks = true;
    for (const key of Object.keys(WEAPONS)) {
      const cfg = WEAPONS[key];
      this.owned[key] = true;
      if (!cfg.melee) {
        this.mag[key] = cfg.mag;
        this.reserve[key] = cfg.reserveMax;
      }
    }
    this.slots = { primary: 'sniper', secondary: 'minigun' };
    for (const k in BLOCKS) this.blocks[k] = 999;
    this.hotbarBlocks = [B.STONE, B.PLANKS, B.BRICK, B.METAL, B.OBSIDIAN];
    this.medkits = 9;
    this.slot = SLOT.PRIMARY;
    this.armor = this.maxArmor;
    this.vm.buildFor(this);
  }

  spawnAt(p) {
    this.pos.set(p.x, p.y, p.z);
    this.vel.set(0, 0, 0);
    this.hp = this.maxHp;
    this.alive = true;
    this.lastDamage = -99;
    this.invuln = 2.5;
    this.regenTimer = 0;
    this.pitch = 0;
    this.yaw = 0;
    this.crouching = false;
    this.hitboxHeight = PLAYER.height;
    this.camEye = PLAYER.eye;
    this.sprintLatch = false;
    this.prevW = false;
    this.slot = SLOT.PRIMARY;
    this.vm.buildFor(this);
    this.game.updateHotbar();
  }

  reset() {
    this.hp = this.maxHp;
    this.alive = true;
    this.lastDamage = -99;
    this.invuln = 2.5;
    this.regenTimer = 0;
    this.vel.set(0, 0, 0);
    this.shake = 0;
    this.crouching = false;
    this.hitboxHeight = PLAYER.height;
    this.camEye = PLAYER.eye;
    this.sprintLatch = false;
    this.prevW = false;
    this.lastWTap = -9;
    this.fireCd = 0;
    this.reloading = 0;
    this.reloadKey = null;
    this.autoReload = 0;
    this.bloom = 0;
    this.meleeAnim = 0;
    this.mining = null;
    this.mineProg = 0;
    this.medkits = 0;
    this.coins = 0;
    this.armor = 0;
    this.sandbox = false;
    this.infiniteAmmo = false;
    this.infiniteBlocks = false;
    this.armorOwned = {};
    this.armorEquip = { helmet: null, chest: null, legs: null };
    this.armorReduction = 0;
    this.equippedSet = null;
    this.slot = SLOT.PRIMARY;
    this.blocks = {};
    for (const k in BLOCKS) this.blocks[k] = 0;
    this.blocks[B.STONE] = 26;
    this.blocks[B.PLANKS] = 26;
    this.hotbarBlocks = START_BLOCKS.slice();
    this.slots = { primary: 'pistol', secondary: null };
    this.initArsenal();
    this.weaponParts = { scope: 0, suppressor: 0, extmag: 0 };
    this.weaponAttach = {};
    this.weaponPaint = {};
    this.weaponUpgrades = {};
    this.gearVersion = 0;
    this._cfgCache = {};
    this.stats = { mined: 0, placed: 0, shots: 0, hits: 0 };
    this.vm.buildFor(this);
  }

  addAmmoAll(mult = 1) {
    let lines = [];
    for (const key of Object.keys(WEAPONS)) {
      if (!this.owned[key]) continue;
      const cfg = WEAPONS[key];
      if (cfg.melee) continue;
      const add = Math.ceil((cfg.mag * 1.6 + cfg.reserveMax * 0.22) * mult);
      const before = this.reserve[key];
      this.reserve[key] = Math.min(cfg.reserveMax, this.reserve[key] + add);
      lines.push(`+${this.reserve[key] - before} патронов · ${cfg.name}`);
    }
    return lines;
  }

  giveWeapon(key) {
    const cfg = WEAPONS[key];
    if (!cfg) return null;
    const wasOwned = this.owned[key];
    this.owned[key] = true;
    if (!wasOwned) {
      if (!cfg.melee) {
        this.mag[key] = cfg.mag;
        this.reserve[key] = Math.max(this.reserve[key] || 0, Math.ceil(cfg.reserveMax * 0.55));
      }
      if (!this.slots.secondary) {
        this.slots.secondary = key;
        return `${cfg.name} · слот 8`;
      }
      return `${cfg.name} · в инвентаре (I)`;
    }
    if (cfg.melee) return `${cfg.name} · уже есть`;
    this.reserve[key] = Math.min(cfg.reserveMax, this.reserve[key] + Math.ceil(cfg.mag * 1.2));
    return `${cfg.name} · патроны`;
  }

  assignBlockToSlot(blockIndex, id) {
    if (blockIndex < 0 || blockIndex > 4) return false;
    if (!(id in this.blocks) || this.blocks[id] <= 0) return false;
    const prev = this.hotbarBlocks[blockIndex];
    if (prev === id) return false;
    const existing = this.hotbarBlocks.indexOf(id);
    this.hotbarBlocks[blockIndex] = id;
    if (existing >= 0 && existing !== blockIndex) {
      this.hotbarBlocks[existing] = prev;
      if (prev == null && this.slot === SLOT.BLOCK0 + existing) {
        this.slot = SLOT.BLOCK0 + blockIndex;
      }
    }
    if (this.slot >= SLOT.BLOCK0 && this.slot <= SLOT.BLOCK4) {
      this.vm.buildFor(this);
    }
    this.game.updateHotbar();
    return true;
  }

  equipWeapon(key, targetSlot) {
    if (!this.owned[key]) return false;
    if (targetSlot !== SLOT.PRIMARY && targetSlot !== SLOT.SECONDARY) return false;
    if (targetSlot === SLOT.PRIMARY) {
      if (this.slots.primary === key) return false;
      if (this.slots.secondary === key) {
        this.slots.secondary = this.slots.primary;
        this.slots.primary = key;
      } else {
        this.slots.primary = key;
      }
    } else {
      if (this.slots.secondary === key) return false;
      if (this.slots.primary === key) {
        if (!this.slots.secondary) {
          this.game.ui.feed('Сначала экипируйте второе оружие', true);
          return false;
        }
        this.slots.primary = this.slots.secondary;
        this.slots.secondary = key;
      } else {
        this.slots.secondary = key;
      }
    }
    if (this.slot === targetSlot && this.isWeaponSlot) this.vm.buildFor(this);
    this.game.updateHotbar();
    return true;
  }

  addBlocks(id, n) {
    if (!(id in this.blocks)) return;
    this.blocks[id] = Math.min(999, this.blocks[id] + n);
  }

  addMedkits(n) {
    this.medkits = Math.min(9, this.medkits + n);
  }

  selectSlot(i, silent = false) {
    if (i < 0 || i > 8) return;
    if ((i === SLOT.SECONDARY && !this.slots.secondary)) {
      if (!silent) this.game.sound.deny();
      return;
    }
    if (i !== this.slot && this.reloading > 0) {
      this.reloading = 0;
      this.reloadKey = null;
      this.game.ui.showReload(false);
    }
    if (i >= SLOT.BLOCK0 && i <= SLOT.BLOCK4 && !this.hotbarBlocks[i - SLOT.BLOCK0]) {
      if (!silent) {
        this.game.sound.deny();
        this.game.ui.feed('Пустой слот · I — инвентарь', true);
      }
      return;
    }
    this.slot = i;
    this.mining = null;
    this.mineProg = 0;
    if (this.isWeaponSlot) this.aiming = false;
    this.vm.buildFor(this);
    if (!silent) this.game.sound.tone(520, 0.035, { type: 'square', gain: 0.045 });
    this.game.updateHotbar();
  }

  cycleWeapon() {
    if (this.slots.secondary) {
      this.selectSlot(this.slot === SLOT.PRIMARY ? SLOT.SECONDARY : SLOT.PRIMARY);
    } else {
      this.selectSlot(SLOT.PRIMARY);
    }
  }

  slotAvailable(i) {
    if (i === SLOT.SECONDARY && !this.slots.secondary) return false;
    if (i >= SLOT.BLOCK0 && i <= SLOT.BLOCK4 && !this.hotbarBlocks[i - SLOT.BLOCK0]) return false;
    return true;
  }

  cycleSlot(dir) {
    let s = this.slot;
    for (let n = 0; n < 9; n++) {
      s = (s + dir + 9) % 9;
      if (this.slotAvailable(s)) {
        this.selectSlot(s);
        return;
      }
    }
  }

  getMuzzleWorld() {
    const v = new THREE.Vector3(0.3, -0.22, -0.85);
    const cam = this.game.camera;
    v.applyMatrix4(cam.matrixWorld);
    return v;
  }

  damage(amount, source, name) {
    if (this.sandbox) return;
    if (!this.alive || this.invuln > 0) return;
    const now = this.game.time;
    if (now - this.lastDamage < 0.1) return;
    this.lastDamage = now;
    let incoming = amount * (1 - (this.armorReduction || 0));
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, incoming * ARMOR.absorb);
      this.armor = Math.max(0, this.armor - absorbed);
      incoming -= absorbed;
    }
    this.hp -= incoming;
    this.regenTimer = 0;
    this.shake = Math.min(1.2, this.shake + 0.5 + amount * 0.012);
    this.game.sound.hurt();
    this.game.ui.damageFlash(Math.min(1, amount / 35 + 0.25));
    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
    this.game.updateHealth();
  }

  addCoins(n) {
    this.coins = Math.max(0, this.coins + n);
    this.game.ui.updateCoins(this.coins);
  }

  addArmor(n) {
    this.armor = Math.min(this.maxArmor, this.armor + n);
    this.game.updateHealth();
  }

  spendCoins(n) {
    if (this.coins < n) return false;
    this.coins -= n;
    this.game.ui.updateCoins(this.coins);
    return true;
  }

  /* ---------------- wearable armour ---------------- */
  armorPieceName(set, slot) {
    const cfg = ARMOR_SETS[set];
    if (!cfg) return '?';
    return `${ARMOR_SLOTS[slot]?.name || slot.toUpperCase()} · ${cfg.name}`;
  }

  addArmorPiece(set, slot) {
    if (!ARMOR_SETS[set] || !ARMOR_SETS[set].dr?.[slot]) return null;
    const key = `${set}:${slot}`;
    this.armorOwned[key] = (this.armorOwned[key] || 0) + 1;
    return { key, count: this.armorOwned[key], name: this.armorPieceName(set, slot), set, slot };
  }

  hasArmorPiece(key) {
    return (this.armorOwned[key] || 0) > 0;
  }

  armorSlotOf(key) {
    return key ? key.split(':')[1] : null;
  }

  isArmorEquipped(key) {
    const slot = this.armorSlotOf(key);
    return !!slot && this.armorEquip[slot] === key;
  }

  toggleArmor(key) {
    if (!this.hasArmorPiece(key)) return false;
    const [set, slot] = key.split(':');
    if (!ARMOR_SETS[set]?.dr?.[slot]) return false;
    if (this.armorEquip[slot] === key) {
      this.armorEquip[slot] = null;
    } else {
      this.armorEquip[slot] = key;
    }
    this.recalcArmor();
    return true;
  }

  recalcArmor() {
    let sum = 0;
    const sets = new Set();
    let pieces = 0;
    for (const slot of Object.keys(ARMOR_SLOTS)) {
      const key = this.armorEquip[slot];
      if (!key) continue;
      const [set] = key.split(':');
      const cfg = ARMOR_SETS[set];
      if (!cfg) continue;
      sum += cfg.dr[slot] || 0;
      sets.add(set);
      pieces++;
    }
    this.equippedSet = (pieces === 3 && sets.size === 1) ? [...sets][0] : null;
    if (this.equippedSet) sum += ARMOR_SETS[this.equippedSet].bonus || 0;
    this.armorReduction = Math.min(0.75, sum / 100);
    this.game.updateHealth();
  }

  armorTotalDr() {
    return Math.round((this.armorReduction || 0) * 100);
  }

  die() {
    if (!this.alive) return;
    this.alive = false;
    this.vel.set(0, 0, 0);
    this.aiming = false;
    this.primaryDown = false;
    this.secondaryDown = false;
    this.game.onPlayerDeath();
  }

  heal(n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
    this.game.ui.healFlash();
    this.game.sound.heal();
    this.game.updateHealth();
  }

  /* ------------- update ------------- */
  update(dt, input) {
    if (!this.alive) {
      this.vm.update(dt, this);
      return;
    }
    this.regenTimer += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.regenTimer > PLAYER.regenDelay && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + PLAYER.regenRate * dt);
      this.game.updateHealth();
    }
    if (this.game.time - this.lastDamage > 6) this.hp = Math.min(this.maxHp, this.hp + 0.6 * dt);

    this.fireCd = Math.max(0, this.fireCd - dt);
    this.placeCd = Math.max(0, this.placeCd - dt);
    this.placeAnim = Math.max(0, this.placeAnim - dt);
    this.medkitAnim = Math.max(0, this.medkitAnim - dt);
    this.meleeAnim = Math.max(0, this.meleeAnim - dt);
    this.useCd = Math.max(0, this.useCd - dt);
    this.bloom = Math.max(0, this.bloom - dt * 0.13);
    this.vmRecoil = Math.max(0, this.vmRecoil - dt * (this.vmRecoil > 0.5 ? 4.5 : 3.2));
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.swayX *= Math.exp(-dt * 12);
    this.swayY *= Math.exp(-dt * 12);

    // reload
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        this.finishReload();
      }
    }
    if (this.autoReload > 0) {
      this.autoReload -= dt;
      if (this.autoReload <= 0) this.startReload();
    }

    // movement
    const fwd = (input.keys.KeyW ? 1 : 0) - (input.keys.KeyS ? 1 : 0);
    const strafe = (input.keys.KeyD ? 1 : 0) - (input.keys.KeyA ? 1 : 0);
    const wish = new THREE.Vector3(
      -Math.sin(this.yaw) * fwd + Math.cos(this.yaw) * strafe,
      0,
      -Math.cos(this.yaw) * fwd - Math.sin(this.yaw) * strafe
    );
    if (wish.lengthSq() > 0) wish.normalize();
    const wantCrouch = !!(input.keys.ShiftLeft || input.keys.ShiftRight);
    this.updateCrouch(wantCrouch, dt);

    const wDown = !!input.keys.KeyW;
    if (wDown && !this.prevW) {
      if (this.game.time - this.lastWTap < 0.32) this.sprintLatch = true;
      this.lastWTap = this.game.time;
    }
    if (!wDown || this.crouching) this.sprintLatch = false;
    this.prevW = wDown;

    this.sprinting = wDown && fwd > 0 && this.sprintLatch && !this.crouching && !this.aiming;
    const speed = this.crouching ? PLAYER.crouch : this.sprinting ? PLAYER.sprint : PLAYER.walk;
    const accel = this.onGround ? 14 : 4;
    const k = 1 - Math.exp(-accel * dt);
    this.vel.x = lerp(this.vel.x, wish.x * speed, k);
    this.vel.z = lerp(this.vel.z, wish.z * speed, k);

    // jump
    if (input.jumpPressed) { this.jumpBuffer = 0.14; input.jumpPressed = false; }
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.coyote = this.onGround ? 0.1 : Math.max(0, this.coyote - dt);
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vel.y = PLAYER.jump;
      this.onGround = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.game.sound.jump();
    }

    // sneak edge guard: while crouched on the ground do not walk off ledges
    if (this.crouching && this.onGround && this.jumpBuffer <= 0) {
      const r = PLAYER.radius;
      const support = (x, z) => this.game.world.aabbSolid(
        x - r, this.pos.y - 0.55, z - r, x + r, this.pos.y - 0.06, z + r
      );
      if (Math.abs(this.vel.x) > 0.001) {
        const nx = this.pos.x + this.vel.x * dt;
        if (!support(nx, this.pos.z)) this.vel.x = 0;
      }
      if (Math.abs(this.vel.z) > 0.001) {
        const nz = this.pos.z + this.vel.z * dt;
        if (!support(this.pos.x, nz)) this.vel.z = 0;
      }
    }

    // physics
    this.vel.y -= PLAYER.gravity * dt;
    this.vel.y = Math.max(-40, this.vel.y);
    this.moveAxis('x', this.vel.x * dt);
    this.moveAxis('z', this.vel.z * dt);
    const wasGround = this.onGround;
    let dy = this.vel.y * dt;
    const steps = Math.max(1, Math.ceil(Math.abs(dy) / 0.35));
    const stepY = dy / steps;
    for (let i = 0; i < steps; i++) {
      this.moveAxis('y', stepY);
      if (this.vel.y === 0) break;
    }
    if (this.onGround && !wasGround && this.vel.y < -6) {
      this.game.sound.land();
      this.shake = Math.min(1, this.shake + 0.12);
    }
    this.onGround = this.game.world.aabbSolid(
      this.pos.x - PLAYER.radius, this.pos.y - 0.09, this.pos.z - PLAYER.radius,
      this.pos.x + PLAYER.radius, this.pos.y - 0.01, this.pos.z + PLAYER.radius
    ) && this.vel.y <= 0.01;
    if (this.onGround) this.vel.y = Math.max(this.vel.y, -1);

    if (this.pos.y < -22) this.die();
    if (this.pos.y > 76) { this.pos.y = 76; this.vel.y = Math.min(0, this.vel.y); }

    // footsteps
    const hspeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hspeed > 1) {
      this.stepT -= dt * hspeed;
      if (this.stepT <= 0) {
        this.stepT = 2.6;
        this.game.sound.noise({ dur: 0.055, gain: 0.035, freq: 240, type: 'lowpass' });
      }
      this.bobT += dt * (this.sprinting ? 12 : 8.5);
    } else {
      this.bobT += dt * 2;
    }

    // hover block
    this.updateHover();

    // weapons / tools
    if (this.slot === SLOT.PICKAXE) {
      if (this.primaryDown && this.hover) this.updateMining(dt);
      else { this.mining = null; this.mineProg = 0; }
    } else if (this.isWeaponSlot) {
      if (this.primaryDown && this.weaponCfg.auto) this.tryShoot();
      this.aiming = this.secondaryDown && !!this.weaponCfg.zoom;
    } else if (this.slot === SLOT.MEDKIT) {
      this.aiming = false;
    } else {
      this.aiming = false;
    }

    // placing
    if (this.secondaryDown && this.slot >= SLOT.BLOCK0 && this.slot <= SLOT.BLOCK4) {
      this.tryPlace();
    }

    this.vm.update(dt, this);
    this.updateCamera(dt);
  }

  moveAxis(axis, amount) {
    if (!amount) return;
    this.pos[axis] += amount;
    if (this.collides()) {
      this.pos[axis] -= amount;
      if (axis === 'y') {
        this.onGround = amount < 0;
      }
      this.vel[axis] = 0;
    }
  }

  collides() {
    return this.game.world.aabbSolid(
      this.pos.x - PLAYER.radius, this.pos.y + 0.001, this.pos.z - PLAYER.radius,
      this.pos.x + PLAYER.radius, this.pos.y + this.hitboxHeight, this.pos.z + PLAYER.radius
    );
  }

  canStandUp() {
    const r = PLAYER.radius * 0.98;
    return !this.game.world.aabbSolid(
      this.pos.x - r, this.pos.y + 0.02, this.pos.z - r,
      this.pos.x + r, this.pos.y + PLAYER.height, this.pos.z + r
    );
  }

  updateCrouch(wantCrouch, dt) {
    if (wantCrouch) {
      if (!this.crouching) {
        this.crouching = true;
        this.hitboxHeight = PLAYER.crouchHeight;
        this.sprintLatch = false;
      }
    } else if (this.crouching && this.canStandUp()) {
      this.crouching = false;
      this.hitboxHeight = PLAYER.height;
    }
    const target = this.crouching ? PLAYER.crouchEye : PLAYER.eye;
    this.camEye = lerp(this.camEye, target, 1 - Math.exp(-16 * dt));
  }

  updateCamera(dt) {
    const camera = this.game.camera;
    camera.rotation.order = 'YXZ';
    const hspeed = Math.hypot(this.vel.x, this.vel.z);
    const bob = this.onGround ? Math.sin(this.bobT) * 0.035 * Math.min(1, hspeed / 5) : 0;
    const bobSide = this.onGround ? Math.cos(this.bobT * 0.5) * 0.02 * Math.min(1, hspeed / 5) : 0;
    const shakeX = (Math.random() - 0.5) * this.shake * 0.02;
    const shakeY = (Math.random() - 0.5) * this.shake * 0.02;
    camera.position.set(
      this.pos.x + bobSide + shakeX,
      this.pos.y + this.camEye + bob + shakeY,
      this.pos.z
    );
    camera.rotation.x = this.pitch - this.shake * 0.004;
    camera.rotation.y = this.yaw;
    camera.rotation.z = this.shake * (Math.random() - 0.5) * 0.008;

    const targetFov = this.aiming ? 78 / (this.weaponCfg.zoom || 1) : (this.sprinting ? 81 : 78);
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov = damp(camera.fov, targetFov, 12, dt);
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
  }

  updateHover() {
    const cam = this.game.camera;
    const origin = cam.position;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const hit = this.game.world.raycast(origin, dir, PLAYER.reach);
    this.hover = hit;
    this.game.updateSelection(hit);
  }

  updateMining(dt) {
    const hit = this.hover;
    if (!hit) { this.mining = null; this.mineProg = 0; return; }
    if (!this.mining || this.mining.x !== hit.x || this.mining.y !== hit.y || this.mining.z !== hit.z) {
      this.mining = { x: hit.x, y: hit.y, z: hit.z, id: hit.id };
      this.mineProg = 0;
    }
    const def = BLOCKS[hit.id];
    const hardness = def ? def.hardness : 1;
    this.mineProg += dt / hardness;
    this.game.ui.setMineProgress(this.mineProg);
    if (Math.floor(this.mineProg * 8) !== Math.floor((this.mineProg - dt / hardness) * 8)) {
      this.game.sound.mine(hit.id === B.METAL || hit.id === B.RUST ? 'metal' : hit.id === B.STONE || hit.id === B.BRICK ? 'stone' : 'wood');
    }
    if (this.mineProg >= 1) {
      this.breakBlock(hit);
      this.mineProg = 0;
      this.mining = null;
    }
  }

  breakBlock(hit) {
    const def = BLOCKS[hit.id];
    if (!def) return;
    const w = this.game.world;
    w.setBlock(hit.x, hit.y, hit.z, 0);
    this.game.onBlockEdited?.(hit.x, hit.y, hit.z, 0);
    const col = parseInt(def.color.slice(1), 16);
    this.game.effects.blockBurst(hit.x, hit.y, hit.z, col, 12);
    this.game.sound.breakBlock(hit.id === B.METAL || hit.id === B.RUST ? 'metal' : hit.id === B.STONE || hit.id === B.BRICK ? 'stone' : 'wood');
    this.stats.mined++;
    let dropId = def.drop ?? hit.id;
    if (hit.id === B.GRASS) dropId = B.DIRT;
    if (dropId > B.RUST && !BLOCKS[dropId]?.collectible) dropId = 0;
    if (dropId && dropId in this.blocks) {
      const wasZero = this.blocks[dropId] === 0;
      this.blocks[dropId]++;
      const inBar = this.hotbarBlocks.includes(dropId);
      this.game.ui.feed(`+1 ${BLOCKS[dropId].name}${wasZero && !inBar ? ' · в инвентаре (I)' : ''}`, false);
      this.game.sound.pickup();
    }
    this.game.updateHotbar();
  }

  tryPlace() {
    if (this.placeCd > 0) return;
    const hit = this.hover;
    if (!hit) return;
    const slot = this.slot;
    const id = this.hotbarBlocks[slot - SLOT.BLOCK0];
    if (!id || !(this.blocks[id] > 0)) {
      if (this.placeCd <= 0) { this.game.sound.deny(); this.placeCd = 0.3; }
      return;
    }
    const x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
    if (y < 0 || y >= this.game.world.SY) return;
    if (this.game.world.isSolid(x, y, z)) return;
    // do not entomb the player
    const r = PLAYER.radius;
    if (x + 1 > this.pos.x - r && x < this.pos.x + r &&
        y + 1 > this.pos.y && y < this.pos.y + this.hitboxHeight &&
        z + 1 > this.pos.z - r && z < this.pos.z + r) {
      this.game.ui.feed('Здесь стоите вы', true);
      this.placeCd = 0.3;
      return;
    }
    for (const m of this.game.mobs) {
      if (m.dead) continue;
      if (x + 1 > m.pos.x - m.cfg.radius && x < m.pos.x + m.cfg.radius &&
          y + 1 > m.pos.y && y < m.pos.y + m.cfg.height &&
          z + 1 > m.pos.z - m.cfg.radius && z < m.pos.z + m.cfg.radius) {
        return;
      }
    }
    if (this.game.world.setBlock(x, y, z, id)) {
      this.game.onBlockEdited?.(x, y, z, id);
      if (!this.infiniteBlocks) this.blocks[id]--;
      this.stats.placed++;
      this.placeCd = 0.16;
      this.placeAnim = 0.16;
      this.game.sound.place(id === B.METAL ? 'metal' : id === B.STONE || id === B.BRICK ? 'stone' : 'wood');
      this.game.updateHotbar();
    }
  }

  tryShoot() {
    if (this.reloading > 0 || this.fireCd > 0) return;
    const key = this.weaponKey;
    const cfg = this.weaponCfg;
    if (!key || !cfg) return;
    if (cfg.melee) {
      this.fireCd = 60 / cfg.rpm;
      this.meleeDur = clamp(60 / cfg.rpm * 0.85, 0.2, 0.36);
      this.meleeAnim = this.meleeDur;
      this.stats.shots += 1;
      this.vmRecoil = Math.min(1, this.vmRecoil + 0.3);
      this.pitch = Math.min(1.45, this.pitch + cfg.kick * 0.3);
      this.shake = Math.min(0.7, this.shake + cfg.kick * 2.2);
      this.game.sound.meleeSwing();
      this.game.shoot(cfg, this);
      return;
    }
    if (this.mag[key] <= 0 && !this.infiniteAmmo) {
      if (this.reserve[key] > 0) this.startReload();
      else { this.game.sound.dryFire(); this.fireCd = 0.25; this.autoReload = 0; }
      return;
    }
    if (!this.infiniteAmmo) this.mag[key]--;
    this.fireCd = 60 / cfg.rpm;
    this.bloom = Math.min(0.025, this.bloom + cfg.spread * 0.55);
    this.stats.shots += cfg.pellets;
    this.vmRecoil = Math.min(1, this.vmRecoil + (cfg.key === 'shotgun' ? 1 : cfg.key === 'pistol' ? 0.55 : 0.35));
    this.pitch = Math.min(1.45, this.pitch + cfg.kick * 0.42);
    this.shake = Math.min(0.7, this.shake + cfg.kick * 2.6);
    this.vm.muzzleFlash();
    this.game.sound.shot(cfg.key);
    this.game.ui.muzzle();
    this.game.shoot(cfg, this);
    this.game.updateAmmo();
    if (this.mag[key] === 0) {
      if (this.reserve[key] > 0) this.autoReload = 0.25;
    }
  }

  startReload() {
    const key = this.weaponKey;
    if (!key || this.reloading > 0) return;
    const cfg = this.weaponCfg;
    if (cfg.melee || this.infiniteAmmo) return;
    if (this.mag[key] >= cfg.mag || this.reserve[key] <= 0) {
      if (this.mag[key] <= 0 && this.reserve[key] <= 0) this.game.sound.deny();
      return;
    }
    this.reloading = cfg.reload;
    this.reloadKey = key;
    this.autoReload = 0;
    this.game.sound.reloadClick();
    this.game.ui.showReload(true);
    setTimeout(() => { if (this.reloading > 0) this.game.sound.reloadClick(); }, cfg.reload * 400);
  }

  finishReload() {
    const key = this.reloadKey;
    this.reloading = 0;
    this.reloadKey = null;
    this.game.ui.showReload(false);
    if (!key) return;
    const cfg = this.getEffectiveWeapon(key);
    if (!cfg) return;
    const need = cfg.mag - this.mag[key];
    const take = Math.min(need, this.reserve[key]);
    this.mag[key] += take;
    this.reserve[key] -= take;
    this.game.sound.reloadDone();
    this.game.updateAmmo();
  }

  useMedkit() {
    if (this.useCd > 0) return;
    if (this.medkits <= 0) { this.game.sound.deny(); this.game.ui.feed('Нет аптечек', true); return; }
    if (this.hp >= this.maxHp) { this.game.sound.deny(); return; }
    this.medkits--;
    this.useCd = 0.9;
    this.medkitAnim = 0.5;
    this.heal(45);
    this.game.ui.feed('+45 HP · аптечка', false);
    this.game.updateHotbar();
  }

  onPrimaryPress() {
    if (!this.alive) return;
    this.primaryDown = true;
    if (this.slot === SLOT.MEDKIT) { this.useMedkit(); return; }
    if (this.isWeaponSlot) {
      if (!this.weaponCfg.auto) this.tryShoot();
      else this.tryShoot();
    }
  }

  onPrimaryRelease() { this.primaryDown = false; }

  onSecondaryPress() {
    if (!this.alive) return;
    this.secondaryDown = true;
    if (this.slot >= SLOT.BLOCK0 && this.slot <= SLOT.BLOCK4) this.tryPlace();
  }
  onSecondaryRelease() { this.secondaryDown = false; }

  mouseMove(dx, dy, sens) {
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    this.pitch = clamp(this.pitch, -1.48, 1.48);
    this.swayX = clamp(this.swayX + dx * 0.06, -1.5, 1.5);
    this.swayY = clamp(this.swayY + dy * 0.06, -1.5, 1.5);
  }
}
