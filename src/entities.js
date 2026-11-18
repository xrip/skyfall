import * as THREE from '../vendor/three.module.js';
import { MOBS, BLOCKS, ARMOR_SETS } from './config.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const SPH = new THREE.SphereGeometry(1, 10, 8);
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}
function glowing(color) {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false });
}
function box(parent, w, h, d, x, y, z, mat, cast = true) {
  const m = new THREE.Mesh(BOX, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = false;
  parent.add(m);
  return m;
}
function limb(parent, w, h, d, x, y, mat) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, 0);
  parent.add(pivot);
  box(pivot, w, h, d, 0, -h / 2, 0, mat);
  return pivot;
}

const MOB_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
const MOB_GLOW_MAT = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
const _euler = new THREE.Euler(0, 0, 0, 'XYZ');
const _rotM = new THREE.Matrix4();

function mergedBoxes(parts) {
  if (!parts || !parts.length) return null;
  const pos = [], nor = [], col = [], idx = [];
  let offset = 0;
  for (const p of parts) {
    const g = new THREE.BoxGeometry(p.w, p.h, p.d);
    if (p.rot) {
      _euler.set(p.rot[0] || 0, p.rot[1] || 0, p.rot[2] || 0, 'XYZ');
      _rotM.makeRotationFromEuler(_euler);
      g.applyMatrix4(_rotM);
    }
    g.translate(p.x || 0, p.y || 0, p.z || 0);
    const pa = g.attributes.position, na = g.attributes.normal, ia = g.index;
    const c = new THREE.Color(p.c);
    for (let i = 0; i < pa.count; i++) {
      pos.push(pa.getX(i), pa.getY(i), pa.getZ(i));
      nor.push(na.getX(i), na.getY(i), na.getZ(i));
      col.push(c.r, c.g, c.b);
    }
    for (let i = 0; i < ia.count; i++) idx.push(ia.getX(i) + offset);
    offset += pa.count;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

const MOB_MODEL_CACHE = {};

function getMobModel(type) {
  if (MOB_MODEL_CACHE[type]) return MOB_MODEL_CACHE[type];
  const cfg = MOBS[type];
  const dark = 0x2a2f2a;
  const eye = type === 'flyer' ? 0xff4d4d : type === 'boss' ? 0x8ef0ff : 0xffb144;
  const P = (w, h, d, x, y, z, c, rot) => ({ w, h, d, x, y, z, c, rot });
  const spec = { static: [], glow: [], limbs: {}, extras: [] };

  if (type === 'grunt') {
    spec.static.push(
      P(0.62, 0.66, 0.36, 0, 1.12, 0, cfg.body),
      P(0.5, 0.2, 0.08, 0, 1.2, 0.2, 0x3b4638),
      P(0.42, 0.38, 0.4, 0, 1.68, 0.02, cfg.head),
      P(0.1, 0.24, 0.1, -0.15, 1.94, 0, dark),
      P(0.1, 0.24, 0.1, 0.15, 1.94, 0, dark),
    );
    spec.glow.push(
      P(0.07, 0.07, 0.04, -0.11, 1.72, 0.22, eye),
      P(0.07, 0.07, 0.04, 0.11, 1.72, 0.22, eye),
    );
    spec.limbs.legL = { x: -0.17, y: 0.72, parts: [P(0.22, 0.68, 0.24, 0, -0.34, 0, dark)] };
    spec.limbs.legR = { x: 0.17, y: 0.72, parts: [P(0.22, 0.68, 0.24, 0, -0.34, 0, dark)] };
    spec.limbs.armL = { x: -0.41, y: 1.41, parts: [P(0.19, 0.58, 0.2, 0, -0.29, 0, cfg.body)] };
    spec.limbs.armR = { x: 0.41, y: 1.41, parts: [P(0.19, 0.58, 0.2, 0, -0.29, 0, cfg.body)] };
  } else if (type === 'brute') {
    spec.static.push(
      P(1.02, 0.9, 0.56, 0, 1.5, 0, cfg.body),
      P(1.22, 0.28, 0.66, 0, 1.95, 0, 0x402c27),
      P(0.3, 0.36, 0.3, -0.62, 2.0, 0.02, 0x6b4a3d),
      P(0.3, 0.36, 0.3, 0.62, 2.0, 0.02, 0x6b4a3d),
      P(0.5, 0.46, 0.48, 0, 2.28, 0.02, cfg.head),
      P(0.16, 0.32, 0.16, -0.24, 2.62, 0, dark),
      P(0.16, 0.32, 0.16, 0.24, 2.62, 0, dark),
    );
    spec.glow.push(
      P(0.1, 0.1, 0.05, -0.13, 2.34, 0.26, eye),
      P(0.1, 0.1, 0.05, 0.13, 2.34, 0.26, eye),
    );
    spec.limbs.legL = { x: -0.28, y: 0.9, parts: [P(0.32, 0.86, 0.32, 0, -0.43, 0, dark)] };
    spec.limbs.legR = { x: 0.28, y: 0.9, parts: [P(0.32, 0.86, 0.32, 0, -0.43, 0, dark)] };
    spec.limbs.armL = { x: -0.68, y: 1.74, parts: [P(0.3, 0.82, 0.32, 0, -0.41, 0, cfg.body)] };
    spec.limbs.armR = { x: 0.68, y: 1.74, parts: [P(0.3, 0.82, 0.32, 0, -0.41, 0, cfg.body)] };
  } else if (type === 'skeleton') {
    const bone = cfg.body, skull = cfg.head, darkBone = 0x9a9485;
    spec.static.push(
      P(0.36, 0.5, 0.24, 0, 1.2, 0, bone),
      P(0.12, 0.62, 0.12, 0, 1.24, -0.03, darkBone),
      P(0.5, 0.06, 0.26, 0, 1.42, 0, bone),
      P(0.46, 0.06, 0.26, 0, 1.28, 0, bone),
      P(0.42, 0.06, 0.24, 0, 1.14, 0, bone),
      P(0.08, 0.18, 0.08, 0, 1.52, 0, darkBone),
      P(0.34, 0.34, 0.34, 0, 1.76, 0.03, skull),
      P(0.22, 0.09, 0.22, 0, 1.57, 0.09, skull),
      P(0.09, 0.09, 0.04, -0.08, 1.79, 0.21, 0x1c1f22),
      P(0.09, 0.09, 0.04, 0.08, 1.79, 0.21, 0x1c1f22),
    );
    spec.glow.push(
      P(0.055, 0.055, 0.03, -0.08, 1.79, 0.235, 0x8ef0ff),
      P(0.055, 0.055, 0.03, 0.08, 1.79, 0.235, 0x8ef0ff),
    );
    spec.limbs.legL = { x: -0.14, y: 0.78, parts: [P(0.14, 0.78, 0.16, 0, -0.39, 0, bone)] };
    spec.limbs.legR = { x: 0.14, y: 0.78, parts: [P(0.14, 0.78, 0.16, 0, -0.39, 0, bone)] };
    spec.limbs.armL = { x: -0.32, y: 1.48, parts: [P(0.1, 0.6, 0.12, 0, -0.3, 0, bone)] };
    spec.limbs.armR = { x: 0.32, y: 1.48, parts: [
      P(0.1, 0.6, 0.12, 0, -0.3, 0, bone),
      P(0.05, 0.68, 0.06, 0.1, -0.38, 0.06, 0x6b4a2f, [0, 0, 0.12]),
      P(0.03, 0.03, 0.42, 0.14, -0.7, 0.18, 0xd9d4c8),
    ] };
  } else if (type === 'demon') {
    const skin = cfg.body, head = cfg.head, dark = 0x250f18, wing = 0x3a1622, horn = 0x22151d;
    spec.static.push(
      P(0.62, 0.7, 0.38, 0, 1.3, 0, skin),
      P(0.72, 0.18, 0.46, 0, 1.56, 0, dark),
      P(0.44, 0.42, 0.42, 0, 1.98, 0.02, head),
      P(0.1, 0.34, 0.1, -0.18, 2.3, 0, horn, [0, 0, 0.18]),
      P(0.1, 0.34, 0.1, 0.18, 2.3, 0, horn, [0, 0, -0.18]),
      P(0.08, 0.16, 0.08, -0.25, 2.48, 0, horn),
      P(0.08, 0.16, 0.08, 0.25, 2.48, 0, horn),
      P(0.08, 0.72, 0.58, -0.56, 1.64, -0.3, wing, [0, 0, 0.35]),
      P(0.08, 0.72, 0.58, 0.56, 1.64, -0.3, wing, [0, 0, -0.35]),
      P(0.14, 0.14, 0.5, 0, 1.12, -0.28, dark, [0.35, 0, 0]),
      P(0.16, 0.28, 0.16, -0.48, 1.88, 0, horn),
      P(0.16, 0.28, 0.16, 0.48, 1.88, 0, horn),
      P(0.3, 0.24, 0.1, 0, 1.33, 0.22, 0x7a1f2c),
    );
    spec.glow.push(
      P(0.09, 0.09, 0.04, -0.12, 2.02, 0.23, 0xff6a2c),
      P(0.09, 0.09, 0.04, 0.12, 2.02, 0.23, 0xff6a2c),
      P(0.18, 0.18, 0.06, 0, 1.35, 0.23, 0xff4d2e),
    );
    spec.limbs.legL = { x: -0.19, y: 0.84, parts: [P(0.24, 0.8, 0.26, 0, -0.4, 0, 0x321520)] };
    spec.limbs.legR = { x: 0.19, y: 0.84, parts: [P(0.24, 0.8, 0.26, 0, -0.4, 0, 0x321520)] };
    spec.limbs.armL = { x: -0.46, y: 1.64, parts: [
      P(0.2, 0.74, 0.22, 0, -0.37, 0, skin),
      P(0.12, 0.14, 0.12, 0, -0.76, 0.05, horn),
    ] };
    spec.limbs.armR = { x: 0.46, y: 1.64, parts: [
      P(0.2, 0.74, 0.22, 0, -0.37, 0, skin),
      P(0.12, 0.14, 0.12, 0, -0.76, 0.05, horn),
    ] };
  } else if (type === 'gargoyle') {
    const stone = cfg.body, head = cfg.head, dark = 0x3d3a35, wing = 0x4c4944;
    spec.static.push(
      P(0.78, 0.5, 0.72, 0, 0.55, 0, stone),
      P(0.5, 0.36, 0.46, 0, 0.95, 0.16, head),
      P(0.1, 0.3, 0.1, -0.22, 1.2, 0.12, dark, [0, 0, 0.2]),
      P(0.1, 0.3, 0.1, 0.22, 1.2, 0.12, dark, [0, 0, -0.2]),
      P(0.12, 0.2, 0.12, -0.3, 0.12, 0.25, dark),
      P(0.12, 0.2, 0.12, 0.3, 0.12, 0.25, dark),
      P(0.6, 0.12, 0.4, 0, 0.05, 0.1, dark),
      P(0.12, 0.14, 0.5, 0, 0.42, -0.5, dark, [0.3, 0, 0]),
      P(0.1, 0.18, 0.1, -0.44, 0.35, 0.32, dark),
      P(0.1, 0.18, 0.1, 0.44, 0.35, 0.32, dark),
    );
    spec.glow.push(
      P(0.12, 0.09, 0.05, -0.13, 0.99, 0.38, 0x8ef0ff),
      P(0.12, 0.09, 0.05, 0.13, 0.99, 0.38, 0x8ef0ff),
    );
    spec.limbs.wingL = { x: -0.3, y: 0.75, parts: [
      P(0.55, 0.08, 0.72, -0.28, 0, -0.18, wing),
      P(0.07, 0.07, 0.62, -0.1, 0, -0.12, stone),
      P(0.24, 0.06, 0.56, -0.52, -0.1, -0.28, dark),
    ] };
    spec.limbs.wingR = { x: 0.3, y: 0.75, parts: [
      P(0.55, 0.08, 0.72, 0.28, 0, -0.18, wing),
      P(0.07, 0.07, 0.62, 0.1, 0, -0.12, stone),
      P(0.24, 0.06, 0.56, 0.52, -0.1, -0.28, dark),
    ] };
  } else if (type === 'troll') {
    const skin = cfg.body, head = cfg.head, dark = 0x343a2b, moss = 0x6c7f3b, tusk = 0xe2d9c2;
    spec.static.push(
      P(1.15, 1.05, 0.62, 0, 1.85, 0, skin),
      P(1.35, 0.3, 0.74, 0, 2.45, 0, dark),
      P(0.64, 0.24, 0.2, 0, 2.1, 0.37, 0x5d6a3c),
      P(0.58, 0.5, 0.55, 0, 2.92, 0.02, head),
      P(0.2, 0.2, 0.5, -0.42, 2.9, 0, skin),
      P(0.2, 0.2, 0.5, 0.42, 2.9, 0, skin),
      P(0.1, 0.24, 0.1, -0.17, 2.7, 0.3, tusk),
      P(0.1, 0.24, 0.1, 0.17, 2.7, 0.3, tusk),
      P(0.3, 0.2, 0.5, 0, 2.55, -0.33, moss),
      P(0.18, 0.18, 0.1, 0, 3.25, 0.02, dark),
    );
    spec.glow.push(
      P(0.09, 0.08, 0.04, -0.14, 2.98, 0.3, 0xffb144),
      P(0.09, 0.08, 0.04, 0.14, 2.98, 0.3, 0xffb144),
    );
    spec.limbs.legL = { x: -0.35, y: 1.12, parts: [P(0.4, 1.06, 0.42, 0, -0.53, 0, skin)] };
    spec.limbs.legR = { x: 0.35, y: 1.12, parts: [P(0.4, 1.06, 0.42, 0, -0.53, 0, skin)] };
    spec.limbs.armL = { x: -0.72, y: 2.2, parts: [P(0.4, 1.02, 0.44, 0, -0.51, 0, skin)] };
    spec.limbs.armR = { x: 0.72, y: 2.2, parts: [
      P(0.4, 1.02, 0.44, 0, -0.51, 0, skin),
      P(0.22, 0.82, 0.22, 0.02, -1.14, 0.14, 0x6b4a2f),
      P(0.46, 0.36, 0.46, 0.02, -1.58, 0.14, 0x5a5a55),
    ] };
  } else if (type === 'flyer') {
    spec.static.push(
      P(0.62, 0.38, 0.66, 0, 0.42, 0, cfg.body),
      P(0.38, 0.24, 0.3, 0, 0.68, 0.14, cfg.head),
      P(0.16, 0.1, 0.5, -0.4, 0.5, 0, dark),
      P(0.16, 0.1, 0.5, 0.4, 0.5, 0, dark),
      P(0.1, 0.26, 0.1, -0.46, 0.72, -0.1, dark),
      P(0.1, 0.26, 0.1, 0.46, 0.72, -0.1, dark),
      P(0.3, 0.12, 0.3, 0, 0.16, 0, 0x2c2935),
    );
    spec.glow.push(P(0.16, 0.16, 0.06, 0, 0.7, 0.32, eye));
    spec.extras.push(
      { name: 'rotorL', x: -0.42, y: 0.82, z: -0.06, parts: [P(0.7, 0.03, 0.12, 0, 0, 0, 0x8d99a9)] },
      { name: 'rotorR', x: 0.42, y: 0.82, z: -0.06, parts: [P(0.7, 0.03, 0.12, 0, 0, 0, 0x8d99a9)] },
    );
  } else if (type === 'boss') {
    spec.static.push(
      P(1.5, 1.24, 0.82, 0, 1.95, 0, cfg.body),
      P(1.7, 0.34, 0.94, 0, 2.55, 0, 0x211f2d),
      P(0.4, 0.46, 0.4, -0.92, 2.62, 0, 0x3d3552),
      P(0.4, 0.46, 0.4, 0.92, 2.62, 0, 0x3d3552),
      P(0.64, 0.58, 0.6, 0, 3.08, 0.02, cfg.head),
      P(0.14, 0.5, 0.14, -0.38, 3.5, 0, 0xc9b88f),
      P(0.14, 0.5, 0.14, 0.38, 3.5, 0, 0xc9b88f),
      P(0.09, 0.3, 0.09, -0.5, 3.72, 0, 0xc9b88f),
      P(0.09, 0.3, 0.09, 0.5, 3.72, 0, 0xc9b88f),
    );
    spec.glow.push(
      P(0.34, 0.34, 0.16, 0, 2.0, 0.44, eye),
      P(0.12, 0.1, 0.06, -0.16, 3.12, 0.3, eye),
      P(0.12, 0.1, 0.06, 0.16, 3.12, 0.3, eye),
    );
    spec.limbs.legL = { x: -0.45, y: 1.33, parts: [P(0.5, 1.32, 0.5, 0, -0.66, 0, dark)] };
    spec.limbs.legR = { x: 0.45, y: 1.33, parts: [P(0.5, 1.32, 0.5, 0, -0.66, 0, dark)] };
    spec.limbs.armL = { x: -0.98, y: 2.5, parts: [P(0.42, 1.12, 0.46, 0, -0.56, 0, cfg.body)] };
    spec.limbs.armR = { x: 0.98, y: 2.5, parts: [P(0.42, 1.12, 0.46, 0, -0.56, 0, cfg.body)] };
  }

  const model = {
    staticGeo: mergedBoxes(spec.static),
    glowGeo: mergedBoxes(spec.glow),
    limbs: {},
    extras: [],
  };
  for (const name of Object.keys(spec.limbs)) {
    const l = spec.limbs[name];
    model.limbs[name] = { x: l.x, y: l.y, geo: mergedBoxes(l.parts) };
  }
  for (const ex of spec.extras) {
    model.extras.push({ name: ex.name, x: ex.x, y: ex.y, z: ex.z, geo: mergedBoxes(ex.parts) });
  }
  MOB_MODEL_CACHE[type] = model;
  return model;
}

// ============================================================
//  MOB
// ============================================================
export class Mob {
  constructor(game, type, pos) {
    this.game = game;
    this.type = type;
    const base = MOBS[type];
    const diff = game.difficultyCfg || { hp: 1, dmg: 1, speed: 1 };
    this.cfg = {
      ...base,
      hp: Math.max(1, Math.round(base.hp * (diff.hp ?? 1))),
      dmg: Math.max(1, Math.round(base.dmg * (diff.dmg ?? 1))),
      speed: base.speed * (diff.speed ?? 1),
    };
    this.id = ++game.nextEntityId;
    this.pos = new THREE.Vector3(pos.x, pos.y, pos.z);
    this.vel = new THREE.Vector3();
    this.hp = this.cfg.hp;
    this.maxHp = this.cfg.hp;
    this.dead = false;
    this.yaw = 0;
    this.attackCd = 0.6 + Math.random() * 0.5;
    this.attackWind = 0;
    this.breakCd = 0;
    this.breakProgress = 0;
    this.breakKey = null;
    this.hitFlash = 0;
    this.phase = Math.random() * 10;
    this.grounded = false;
    this.stuck = 0;
    this.blockedTime = 0;
    this.rockCd = 3 + Math.random() * 2;
    this.enraged = false;
    this.slamCd = 5;
    this.spawnedAdds = false;
    this.animTime = 0;
    this.lastHitBy = 'host';
    this.target = null;
    this.netTarget = null;
    this.netYaw = 0;
    this.netReady = false;
    this.pendingCast = false;
    this.blockedByVoid = false;

    // AI state: сторона обхода, фланг и таймер решения
    this.aiSide = Math.random() < 0.5 ? 1 : -1;
    this.aiTurn = 0;
    this.aiAngle = null;
    this.flank = ((this.id * 2.399963) % (Math.PI * 2)) - Math.PI;

    const model = getMobModel(type);
    this.group = new THREE.Group();
    this.parts = {};
    const staticMesh = new THREE.Mesh(model.staticGeo, MOB_MAT);
    staticMesh.castShadow = true;
    staticMesh.receiveShadow = false;
    this.group.add(staticMesh);
    if (model.glowGeo) {
      const glowMesh = new THREE.Mesh(model.glowGeo, MOB_GLOW_MAT);
      glowMesh.castShadow = false;
      this.group.add(glowMesh);
    }
    for (const name of Object.keys(model.limbs)) {
      const L = model.limbs[name];
      const pivot = new THREE.Group();
      pivot.position.set(L.x, L.y, 0);
      const mesh = new THREE.Mesh(L.geo, MOB_MAT);
      mesh.castShadow = true;
      pivot.add(mesh);
      this.group.add(pivot);
      this.parts[name] = pivot;
    }
    for (const ex of model.extras) {
      const mesh = new THREE.Mesh(ex.geo, MOB_MAT);
      mesh.position.set(ex.x, ex.y, ex.z);
      mesh.castShadow = false;
      this.group.add(mesh);
      this.parts[ex.name] = mesh;
    }
    this.group.position.copy(this.pos);
    game.scene.add(this.group);

    // hit flash shell
    this.shell = new THREE.Mesh(
      new THREE.BoxGeometry(this.cfg.radius * 2.2, this.cfg.height * 0.94, this.cfg.radius * 2.2),
      new THREE.MeshBasicMaterial({
        color: 0xff5544, transparent: true, opacity: 0,
        depthWrite: false, blending: THREE.AdditiveBlending,
      })
    );
    this.shell.position.set(0, this.cfg.height * 0.5, 0);
    this.shell.visible = false;
    this.group.add(this.shell);

    // health bar
    this.bar = document.createElement('div');
    this.bar.className = 'ebar' + (this.cfg.boss ? ' boss' : '');
    this.bar.innerHTML = (this.cfg.boss ? '<span class="ebname">ТИТАН</span>' : '') + '<i></i>';
    this.barFill = this.bar.querySelector('i');
    game.ui.barsEl.appendChild(this.bar);
    this.bar.style.opacity = '0';
  }

  get headY() { return this.pos.y + this.cfg.height; }

  collidesAt(x, y, z) {
    const r = this.cfg.radius;
    return this.game.world.aabbSolid(x - r, y + 0.04, z - r, x + r, y + this.cfg.height, z + r);
  }

  ensureFreeSpot() {
    if (!this.collidesAt(this.pos.x, this.pos.y, this.pos.z)) return true;
    const bx = this.pos.x, by = this.pos.y, bz = this.pos.z;
    for (let r = 1; r <= 4; r++) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const x = bx + Math.cos(a) * r;
        const z = bz + Math.sin(a) * r;
        for (const dy of [0, 1, 2, 3]) {
          const y = by + dy;
          if (this.collidesAt(x, y, z)) continue;
          if (!this.cfg.flying) {
            const rr = this.cfg.radius;
            const support = this.game.world.aabbSolid(x - rr, y - 0.5, z - rr, x + rr, y - 0.02, z + rr);
            if (!support) continue;
          }
          this.pos.set(x, y, z);
          return true;
        }
      }
    }
    this.pos.y = by + 4;
    return false;
  }

  probeFree(dx, dz, extra = 0.4) {
    const r = this.cfg.radius + extra;
    const x = this.pos.x + dx * r;
    const z = this.pos.z + dz * r;
    if (this.collidesAt(x, this.pos.y + 0.05, z)) return false;
    if (this.collidesAt(x, this.pos.y + Math.min(1.1, this.cfg.height * 0.65), z)) return false;
    return true;
  }

  // Выбираем угол обхода: сначала та же сторона, чтобы моб не дёргался
  // между двумя «равно свободными» направлениями.
  pickDetour(dirX, dirZ) {
    const cands = [];
    for (const a of [0.45, 0.85, 1.3, 1.75]) cands.push(a * this.aiSide, -a * this.aiSide);
    let best = null;
    let bestScore = -2;
    for (const ang of cands) {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const nx = dirX * ca - dirZ * sa;
      const nz = dirX * sa + dirZ * ca;
      if (!this.probeFree(nx, nz, 0.45)) continue;
      if (!this.probeFree(nx, nz, 1.35)) continue;
      let score = nx * dirX + nz * dirZ;
      score -= Math.abs(ang) * 0.07;
      if (Math.sign(ang) !== this.aiSide) score -= 0.3;
      if (score > bestScore) { bestScore = score; best = ang; }
    }
    return best;
  }

  // Упреждение: целимся туда, где цель будет через время полёта снаряда.
  predictAim(target, from, speed) {
    const to = target.pos.clone();
    to.y += 1.15;
    const v = target.vel;
    if (v) {
      const dist = from.distanceTo(to);
      const t = Math.min(1.0, dist / Math.max(6, speed)) * 0.6;
      to.x += v.x * t;
      to.z += v.z * t;
      to.y += Math.max(-2.5, Math.min(2.5, v.y * t * 0.4));
    }
    return to;
  }

  tryBreakBlock(dt, dirX, dirZ, distH, target) {
    const cfg = this.cfg;
    if (!cfg.breaksBlocks || distH > 6.5) return;
    this.breakCd = Math.max(0, this.breakCd - dt);
    if (this.breakCd > 0) return;
    const w = this.game.world;
    const probes = [
      [cfg.radius + 0.55, 0.35], [cfg.radius + 0.95, 0.35],
      [cfg.radius + 0.55, 1.15], [cfg.radius + 0.95, 1.15],
      [cfg.radius + 0.55, Math.min(2.1, cfg.height - 0.2)],
    ];
    let best = null;
    for (const [dist, oy] of probes) {
      const bx = Math.floor(this.pos.x + dirX * dist);
      const by = Math.floor(this.pos.y + oy);
      const bz = Math.floor(this.pos.z + dirZ * dist);
      if (!w.isSolid(bx, by, bz)) continue;
      best = { bx, by, bz };
      break;
    }
    if (!best) { this.breakProgress = 0; this.breakKey = null; return; }
    const key = best.bx + ',' + best.by + ',' + best.bz;
    if (this.breakKey !== key) {
      this.breakKey = key;
      this.breakProgress = 0;
    }
    this.breakProgress += dt;
    if (this.breakProgress < (cfg.breakTime || 2.4)) return;

    const id = w.get(best.bx, best.by, best.bz);
    w.setBlock(best.bx, best.by, best.bz, 0);
    this.game.onBlockEdited?.(best.bx, best.by, best.bz, 0);
    this.game.effects?.spawn(best.bx + 0.5, best.by + 0.5, best.bz + 0.5, 0x8a5a3e, 10, {
      speed: 1.8, up: 1.6, size: 0.08, life: 0.9,
    });
    this.game.sound.breakBlock('stone');
    this.breakProgress = 0;
    this.breakKey = null;
    this.breakCd = 0.45;
  }

  movePhysics(dt) {
    const world = this.game.world;
    // X
    this.pos.x += this.vel.x * dt;
    if (this.collidesAt(this.pos.x, this.pos.y, this.pos.z)) {
      this.pos.x -= this.vel.x * dt;
      if (this.grounded) {
        const old = this.pos.y;
        this.pos.y += 1.02;
        this.pos.x += this.vel.x * dt;
        if (this.collidesAt(this.pos.x, this.pos.y, this.pos.z)) {
          this.pos.x -= this.vel.x * dt;
          this.pos.y = old;
        }
      }
      this.vel.x = 0;
    }
    // Z
    this.pos.z += this.vel.z * dt;
    if (this.collidesAt(this.pos.x, this.pos.y, this.pos.z)) {
      this.pos.z -= this.vel.z * dt;
      if (this.grounded) {
        const old = this.pos.y;
        this.pos.y += 1.02;
        this.pos.z += this.vel.z * dt;
        if (this.collidesAt(this.pos.x, this.pos.y, this.pos.z)) {
          this.pos.z -= this.vel.z * dt;
          this.pos.y = old;
        }
      }
      this.vel.z = 0;
    }
    // Y
    this.vel.y -= 24 * dt;
    this.pos.y += this.vel.y * dt;
    if (this.collidesAt(this.pos.x, this.pos.y, this.pos.z)) {
      this.pos.y -= this.vel.y * dt;
      if (this.vel.y < 0) this.grounded = true;
      this.vel.y = 0;
    } else {
      this.grounded = false;
    }
    if (this.grounded && this.vel.y <= 0) {
      this.vel.y = Math.max(this.vel.y, -0.1);
    }
    if (this.pos.y < -14) this.voidDeath();
    if (this.pos.y > 76) this.pos.y = 76;
  }

  update(dt) {
    if (this.dead) return;
    const game = this.game;
    this.animTime += dt;
    this.attackCd -= dt;
    this.rockCd -= dt;
    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      this.shell.material.opacity = Math.max(0, this.hitFlash * 6);
      this.shell.visible = this.shell.material.opacity > 0.01;
    }

    const target = this.pickTarget();
    this.target = target;
    if (!target || !target.alive) {
      this.attackWind = 0;
      this.pendingCast = false;
      this.vel.x *= Math.exp(-5 * dt);
      this.vel.z *= Math.exp(-5 * dt);
      if (!this.cfg.flying) this.movePhysics(dt);
      this.animate(dt, 0);
      this.group.position.copy(this.pos);
      this.group.rotation.y = this.yaw;
      return;
    }

    const px = target.pos.x, py = target.pos.y, pz = target.pos.z;
    const dx = px - this.pos.x, dz = pz - this.pos.z;
    const distH = Math.hypot(dx, dz) || 0.001;
    const dirX = dx / distH, dirZ = dz / distH;
    this.yaw = Math.atan2(dx, dz);

    if (this.cfg.flying) this.updateFlyer(dt, dirX, dirZ, distH, target);
    else this.updateWalker(dt, dirX, dirZ, distH, py, target);

    // start a melee or ranged attack
    if (!this.cfg.flying && this.attackWind <= 0 && this.attackCd <= 0) {
      const dy = Math.abs(py - this.pos.y);
      const inMelee = !this.blockedByVoid && distH <= this.cfg.range + 0.15 && dy < 2.2;
      if (inMelee) {
        this.attackCd = this.cfg.attackCd;
        this.attackWind = 0.28;
        this.pendingCast = false;
        game.sound.tone(120, 0.12, { type: 'sawtooth', gain: 0.12, slide: 60 });
      } else if (this.cfg.caster && distH <= this.cfg.castRange && dy < 4.5) {
        this.attackCd = this.cfg.castCd ?? this.cfg.attackCd;
        this.attackWind = 0.38;
        this.pendingCast = true;
        game.sound.tone(160, 0.16, { type: 'triangle', gain: 0.09, slide: 110 });
      }
    }

    // resolve the windup
    if (this.attackWind > 0) {
      this.attackWind -= dt;
      if (this.attackWind <= 0) {
        if (this.pendingCast) {
          this.pendingCast = false;
          this.fireCast();
        } else {
          const t = this.target;
          if (t && t.alive) {
            const d2 = Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z);
            if (d2 <= this.cfg.range + 0.5 && Math.abs(t.pos.y - this.pos.y) < 2.4) {
              game.damageTarget(t, this.cfg.dmg, this.pos, this.cfg.name);
            }
          }
        }
      }
    }

    // boss special
    if (this.cfg.boss) {
      this.slamCd -= dt;
      if (this.slamCd <= 0 && distH < 11) {
        this.slamCd = 7.5;
        game.bossSlam(this);
      }
      if (!this.spawnedAdds && this.hp < this.maxHp * 0.5) {
        this.spawnedAdds = true;
        game.spawnAdds(this.pos, 4);
      }
    }

    this.animate(dt, distH);
    this.group.position.copy(this.pos);
    const walkAmt = Math.min(1, Math.hypot(this.vel.x, this.vel.z) / 2.6);
    this.group.position.y = this.pos.y + (this.cfg.flying
      ? Math.sin(this.animTime * 2.4 + this.phase) * 0.05
      : Math.abs(Math.sin(this.phase)) * 0.03 * walkAmt);
    this.group.rotation.y = this.yaw;
  }

  pickTarget() {
    const targets = this.game.getMobTargets ? this.game.getMobTargets() : [{ pos: this.game.player.pos, alive: this.game.player.alive, remote: false }];
    let best = null, bestD = Infinity;
    for (const t of targets) {
      if (!t.alive) continue;
      const d = Math.hypot(t.pos.x - this.pos.x, t.pos.z - this.pos.z) + (t.remote ? 0.35 : 0);
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  }

  updateWalker(dt, dirX, dirZ, distH, py, target) {
    const cfg = this.cfg;
    const speed = cfg.speed * (this.enraged ? 1.35 : 1);
    let mx = 0, mz = 0;
    const stopAt = cfg.stopRange ?? cfg.range * 0.86;
    const keepAt = cfg.keepDistance ?? cfg.range * 0.55;
    const forwardFree = this.probeFree(dirX, dirZ, 0.35);
    const aheadFree = this.probeFree(dirX, dirZ, 1.45);

    this.aiTurn = Math.max(0, this.aiTurn - dt);
    if (forwardFree && aheadFree) this.aiAngle = null;

    if (!forwardFree && this.attackWind <= 0) {
      this.tryBreakBlock(dt, dirX, dirZ, distH, target);
    } else if (forwardFree) {
      this.breakProgress = 0;
      this.breakKey = null;
    }

    if (this.attackWind <= 0) {
      if (distH > stopAt) {
        if (forwardFree && aheadFree) {
          let ax = dirX, az = dirZ;
          // фланг: подходим по дуге, чтобы не выстраиваться в очередь
          if (!cfg.caster) {
            const off = Math.sin(this.flank) * 0.55;
            const ca = Math.cos(off), sa = Math.sin(off);
            const fx = dirX * ca - dirZ * sa;
            const fz = dirX * sa + dirZ * ca;
            if (this.probeFree(fx, fz, 0.35)) { ax = fx; az = fz; }
          }
          mx = ax * speed; mz = az * speed;
        } else {
          // обход: решение принимается не каждый кадр, а раз в 0.4–0.65 с,
          // иначе мобы дёргаются между двумя свободными сторонами
          if (this.aiTurn <= 0) {
            const ang = this.pickDetour(dirX, dirZ);
            if (ang === null) {
              this.aiSide = -this.aiSide;
              this.aiAngle = null;
            } else {
              this.aiAngle = ang;
            }
            this.aiTurn = 0.4 + Math.random() * 0.25;
          }
          if (this.aiAngle !== null) {
            const ca = Math.cos(this.aiAngle), sa = Math.sin(this.aiAngle);
            const nx = dirX * ca - dirZ * sa;
            const nz = dirX * sa + dirZ * ca;
            mx = nx * speed; mz = nz * speed;
          } else {
            // зажали со всех сторон — давим стену, её сломает tryBreakBlock
            mx = dirX * speed * 0.18; mz = dirZ * speed * 0.18;
          }
        }
      } else if (distH < keepAt) {
        mx = -dirX * speed * (cfg.caster ? 0.7 : 0.3);
        mz = -dirZ * speed * (cfg.caster ? 0.7 : 0.3);
      }
    } else {
      // во время замаха не замираем, а продолжаем давить
      mx = dirX * speed * 0.35;
      mz = dirZ * speed * 0.35;
    }

    // separation
    for (const other of this.game.mobs) {
      if (other === this || other.dead) continue;
      const ox = this.pos.x - other.pos.x, oz = this.pos.z - other.pos.z;
      const d = Math.hypot(ox, oz);
      const min = this.cfg.radius + other.cfg.radius + 0.15;
      if (d > 0.001 && d < min) {
        const f = (1 - d / min) * speed * 1.7;
        mx += (ox / d) * f; mz += (oz / d) * f;
      }
    }

    // void / edge check (do not walk off the island)
    let blockedByVoid = false;
    const moveLen = Math.hypot(mx, mz);
    const mdx = moveLen > 0.001 ? mx / moveLen : dirX;
    const mdz = moveLen > 0.001 ? mz / moveLen : dirZ;
    if (!this.airshipMob && this.grounded && moveLen > 0.2) {
      const look = 0.9 + this.cfg.radius;
      const ax = this.pos.x + mdx * look, az = this.pos.z + mdz * look;
      const gh = this.game.world.groundHeight(ax, az);
      if (gh < 0 || gh < this.pos.y - 2.6) {
        const gh2 = this.game.world.groundHeight(this.pos.x + mdx * 2.6, this.pos.z + mdz * 2.6);
        if (gh2 > 0 && gh2 > this.pos.y - 2.5) {
          this.vel.y = 7.4;
        } else {
          blockedByVoid = true;
          mx = 0; mz = 0;
        }
      }
    }
    this.blockedByVoid = blockedByVoid;

    // step / wall jump
    if (this.grounded && (Math.abs(mx) + Math.abs(mz) > 0.2)) {
      const ax = this.pos.x + mdx * (this.cfg.radius + 0.35);
      const az = this.pos.z + mdz * (this.cfg.radius + 0.35);
      if (this.collidesAt(ax, this.pos.y + 0.15, az)) this.vel.y = 7.4;
    }

    const k = 1 - Math.exp(-9 * dt);
    this.vel.x += (mx - this.vel.x) * k;
    this.vel.z += (mz - this.vel.z) * k;
    this.movePhysics(dt);

    // ranged pressure if a melee-only mob cannot reach the player
    const wantMove = Math.abs(mx) + Math.abs(mz) > 0.2;
    const reallyStuck = wantMove && Math.hypot(this.vel.x, this.vel.z) < 0.55 && distH > cfg.range + 1.5;
    this.blockedTime = reallyStuck ? this.blockedTime + dt : Math.max(0, this.blockedTime - dt * 2);
    if (blockedByVoid && distH > 6 && this.rockCd <= 0 && distH > (cfg.castRange ?? 0) + 1) {
      this.rockCd = 2.6 + Math.random() * 1.4;
      this.game.throwRock(this, this.cfg.dmg * 0.7);
      this.attackWind = 0.01;
    } else if (!cfg.caster && this.blockedTime > 2.6 && this.rockCd <= 0) {
      this.rockCd = 3.2 + Math.random() * 1.6;
      this.blockedTime = 0;
      this.game.throwRock(this, this.cfg.dmg * 0.65);
      this.attackWind = 0.01;
    }
  }

  fireCast() {
    const target = this.target;
    if (!target || !target.alive) return;
    const cfg = this.cfg;
    const from = this.pos.clone();
    from.y += cfg.height * 0.72;
    const to = this.predictAim(target, from, cfg.projSpeed ?? 17);
    const dir = to.sub(from).normalize();
    if (cfg.projBig) dir.y += 0.16;
    dir.normalize();
    this.game.spawnEnemyProjectile(
      from, dir, cfg.projSpeed ?? 17, cfg.projDmg ?? cfg.dmg,
      !!cfg.projBig, cfg.projColor ?? 0xffb060
    );
    this.game.effects.flash(from.x, from.y, from.z, cfg.projColor ?? 0xffb060, cfg.projBig ? 0.9 : 0.6);
  }

  updateFlyer(dt, dirX, dirZ, distH, target) {
    const cfg = this.cfg;
    const hover = cfg.hoverHeight ?? 4.2;
    const desiredY = target.pos.y + hover + Math.sin(this.animTime * 0.9 + this.phase) * 0.7;
    let mx = 0, mz = 0;
    const keep = cfg.keepRange ?? 10;
    const minR = cfg.minRange ?? 5.5;
    if (distH > keep) { mx = dirX * cfg.speed; mz = dirZ * cfg.speed; }
    else if (distH < minR) { mx = -dirX * cfg.speed * 0.8; mz = -dirZ * cfg.speed * 0.8; }
    else {
      mx = -dirZ * cfg.speed * 0.45;
      mz = dirX * cfg.speed * 0.45;
    }
    let my = (desiredY - this.pos.y) * 1.6;
    my = Math.max(-cfg.speed, Math.min(cfg.speed, my));

    const k = 1 - Math.exp(-4.5 * dt);
    this.vel.x += (mx - this.vel.x) * k;
    this.vel.z += (mz - this.vel.z) * k;
    this.vel.y += (my - this.vel.y) * k;
    this.pos.addScaledVector(this.vel, dt);

    // don't hover inside blocks
    const h = Math.max(0.9, this.cfg.height);
    for (let i = 0; i < 3; i++) {
      if (!this.game.world.aabbSolid(this.pos.x - 0.35, this.pos.y, this.pos.z - 0.35, this.pos.x + 0.35, this.pos.y + h, this.pos.z + 0.35)) break;
      this.pos.y += 0.4;
    }
    if (this.pos.y < 4) this.pos.y = 4;
    if (this.pos.y > 72) this.pos.y = 72;

    const d = Math.hypot(target.pos.x - this.pos.x, target.pos.z - this.pos.z);
    if (this.attackCd <= 0 && d < (cfg.castRange ?? 19)) {
      this.attackCd = cfg.attackCd;
      const from = this.pos.clone().add(new THREE.Vector3(0, h * 0.55, 0));
      const to = this.predictAim(target, from, cfg.projSpeed ?? 17);
      const aim = to.sub(from).normalize();
      this.game.spawnEnemyProjectile(
        from,
        aim, cfg.projSpeed ?? 17, cfg.projDmg ?? cfg.dmg,
        !!cfg.projBig, cfg.projColor ?? 0xffb060
      );
      this.game.effects.flash(this.pos.x, this.pos.y + h * 0.5, this.pos.z, cfg.projColor ?? 0xff6a4d, 0.8);
      this.game.sound.enemyShot();
    }
  }

  animate(dt, distH) {
    const speed = Math.hypot(this.vel.x, this.vel.z);
    const walk = Math.min(1, speed / 2.6);
    this.phase += dt * (4 + speed * 1.6);
    const s = Math.sin(this.phase);
    if (this.cfg.flying) {
      if (this.parts.rotorL) this.parts.rotorL.rotation.y += dt * (34 + speed * 3);
      if (this.parts.rotorR) this.parts.rotorR.rotation.y -= dt * (34 + speed * 3);
      if (this.parts.wingL) this.parts.wingL.rotation.z = 0.3 + Math.sin(this.animTime * 5.2) * 0.35;
      if (this.parts.wingR) this.parts.wingR.rotation.z = -0.3 - Math.sin(this.animTime * 5.2) * 0.35;
      this.group.position.y = this.pos.y + Math.sin(this.animTime * 2.4 + this.phase) * 0.05;
      return;
    }
    if (this.parts.legL) this.parts.legL.rotation.x = s * 0.6 * walk;
    if (this.parts.legR) this.parts.legR.rotation.x = -s * 0.6 * walk;
    let armSwing = -s * 0.5 * walk;
    if (this.attackWind > 0) armSwing = -1.6;
    if (this.parts.armL) this.parts.armL.rotation.x = armSwing;
    if (this.parts.armR) this.parts.armR.rotation.x = -armSwing;
    const bob = Math.abs(Math.sin(this.phase)) * 0.03 * walk;
    this.group.position.y = this.pos.y + bob;
  }

  takeDamage(dmg, hit, headshot, by = null) {
    if (this.dead) return;
    if (by) this.lastHitBy = by;
    this.hp -= dmg;
    this.hitFlash = 0.1;
    this.shell.material.opacity = 0.7;
    this.shell.visible = true;
    this.enraged = true;
    setTimeout(() => { this.enraged = false; }, 1600);

    if (hit) this.game.effects.bloodBurst(hit.x, hit.y, hit.z, this.type === 'flyer' ? 0xffb060 : 0x77e06a, headshot ? 12 : 7);
    if (this.hp <= 0) {
      this.die();
    } else {
      this.barFill.style.width = Math.max(0, (this.hp / this.maxHp) * 100) + '%';
    }
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.game.onMobDeath(this);
    this.dispose();
  }

  voidDeath() {
    if (this.dead) return;
    this.dead = true;
    this.game.onMobDeath(this, true);
    this.dispose();
  }

  syncBar(camera, w, h) {
    if (!this.bar) return;
    const show = !this.dead && (this.cfg.boss ? false : (this.hp < this.maxHp || this.game.waveActive));
    if (!show) { this.bar.style.opacity = '0'; return; }
    _v.set(this.pos.x, this.pos.y + this.cfg.height + 0.38, this.pos.z).project(camera);
    const dist = camera.position.distanceTo(_v2.set(this.pos.x, this.pos.y + 1, this.pos.z));
    if (_v.z > 1 || dist > 32) { this.bar.style.opacity = '0'; return; }
    const x = (_v.x * 0.5 + 0.5) * w;
    const y = (-_v.y * 0.5 + 0.5) * h;
    this.bar.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px)`;
    this.bar.style.opacity = String(Math.min(1, (32 - dist) / 10) * 0.95);
  }

  /* ----------- guest-side snapshot playback ----------- */
  applyNet(data) {
    // [id, type, x, y, z, hp, maxHp, yaw]
    if (!this.netTarget) this.netTarget = new THREE.Vector3();
    this.netTarget.set(data[2], data[3], data[4]);
    this.netYaw = data[7] || 0;
    const hp = data[5];
    if (hp !== this.hp) {
      this.hp = hp;
      if (this.barFill) this.barFill.style.width = Math.max(0, (hp / this.maxHp) * 100) + '%';
    }
    if (!this.netReady) {
      this.pos.copy(this.netTarget);
      this.netReady = true;
      this.group.position.copy(this.pos);
    }
  }

  updateNet(dt) {
    if (this.dead || !this.netReady) return;
    this.animTime += dt;
    const prevX = this.pos.x, prevZ = this.pos.z;
    const k = 1 - Math.exp(-11 * dt);
    this.pos.lerp(this.netTarget, k);
    const moved = Math.hypot(this.pos.x - prevX, this.pos.z - prevZ);
    const speed = moved / Math.max(dt, 0.001);
    const walk = Math.min(1, speed / 2.6);
    this.phase += dt * (4 + Math.min(6, speed) * 1.6);
    const s = Math.sin(this.phase);
    if (this.cfg.flying) {
      if (this.parts.rotorL) this.parts.rotorL.rotation.y += dt * 34;
      if (this.parts.rotorR) this.parts.rotorR.rotation.y -= dt * 34;
      if (this.parts.wingL) this.parts.wingL.rotation.z = 0.3 + Math.sin(this.animTime * 5.2) * 0.35;
      if (this.parts.wingR) this.parts.wingR.rotation.z = -0.3 - Math.sin(this.animTime * 5.2) * 0.35;
    } else {
      if (this.parts.legL) this.parts.legL.rotation.x = s * 0.6 * walk;
      if (this.parts.legR) this.parts.legR.rotation.x = -s * 0.6 * walk;
      if (this.parts.armL) this.parts.armL.rotation.x = -s * 0.5 * walk;
      if (this.parts.armR) this.parts.armR.rotation.x = s * 0.5 * walk;
    }
    const targetYaw = this.netYaw;
    let d = targetYaw - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.yaw += d * Math.min(1, dt * 9);
    this.group.position.copy(this.pos);
    if (this.cfg.flying) this.group.position.y += Math.sin(this.animTime * 2.4) * 0.05;
    this.group.rotation.y = this.yaw;
  }

  dispose() {
    this.game.scene.remove(this.group);
    this.shell.geometry.dispose();
    this.shell.material.dispose();
    if (this.bar && this.bar.parentNode) this.bar.parentNode.removeChild(this.bar);
    this.bar = null;
  }
}

// ============================================================
//  REMOTE PLAYER AVATAR (co-op)
// ============================================================
function makeNameTexture(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = '700 30px "Cascadia Mono", Consolas, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(6,10,16,.9)';
  g.strokeText(text, 128, 33);
  g.fillStyle = '#ffb144';
  g.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class PlayerAvatar {
  constructor(game, label = 'ДРУГ') {
    this.game = game;
    this.mats = [];
    this.group = new THREE.Group();
    const M = (c) => { const m = lambert(c); this.mats.push(m); return m; };
    const suit = M(0xd08a3e);
    const dark = M(0x2b3039);
    const skin = M(0xc99a6b);
    const visor = glowing(0x8ef0ff);

    this.legL = limb(this.group, 0.24, 0.76, 0.26, -0.17, 0.8, dark);
    this.legR = limb(this.group, 0.24, 0.76, 0.26, 0.17, 0.8, dark);
    box(this.group, 0.62, 0.72, 0.36, 0, 1.18, 0, suit);
    box(this.group, 0.66, 0.22, 0.4, 0, 1.5, 0, M(0x3b4350));
    this.armL = limb(this.group, 0.19, 0.62, 0.2, -0.42, 1.46, suit);
    this.armR = limb(this.group, 0.19, 0.62, 0.2, 0.42, 1.46, suit);
    box(this.group, 0.42, 0.4, 0.4, 0, 1.74, 0, skin);
    box(this.group, 0.34, 0.12, 0.06, 0, 1.78, 0.21, visor, false);
    // backpack
    box(this.group, 0.4, 0.44, 0.16, 0, 1.25, -0.26, dark);
    // sidearm
    const gun = box(this.armR, 0.1, 0.1, 0.3, 0, -0.55, 0.12, M(0x4a525e));
    gun.rotation.x = -0.25;

    this.nameTex = makeNameTexture(label);
    this.nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.nameTex, transparent: true, depthWrite: false, depthTest: false, opacity: 0.95,
    }));
    this.nameSprite.position.set(0, 2.46, 0);
    this.nameSprite.scale.set(1.7, 0.42, 1);
    this.nameSprite.renderOrder = 25;
    this.group.add(this.nameSprite);

    game.scene.add(this.group);
    this.group.visible = false;
    this.target = new THREE.Vector3();
    this.ready = false;
    this.yaw = 0;
    this.alive = true;
    this.phase = 0;
    this.animTime = 0;
  }

  setState(x, y, z, yaw, alive) {
    if (!this.ready) {
      this.target.set(x, y, z);
      this.group.position.copy(this.target);
      this.ready = true;
      this.group.visible = true;
    } else {
      this.target.set(x, y, z);
    }
    this.yaw = yaw;
    this.alive = alive;
    this.group.visible = true;
  }

  update(dt) {
    if (!this.ready) return;
    this.animTime += dt;
    const prevX = this.group.position.x, prevZ = this.group.position.z;
    const k = 1 - Math.exp(-10 * dt);
    this.group.position.lerp(this.target, k);
    const speed = Math.hypot(this.group.position.x - prevX, this.group.position.z - prevZ) / Math.max(dt, 0.001);
    const walk = Math.min(1, speed / 2.8);
    this.phase += dt * (4 + speed * 1.7);
    const s = Math.sin(this.phase);
    if (this.legL) this.legL.rotation.x = this.alive ? s * 0.55 * walk : 0;
    if (this.legR) this.legR.rotation.x = this.alive ? -s * 0.55 * walk : 0;
    if (this.armL) this.armL.rotation.x = this.alive ? -s * 0.45 * walk : -1.2;
    if (this.armR) this.armR.rotation.x = this.alive ? s * 0.45 * walk : -1.2;
    let d = this.yaw - this.group.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.group.rotation.y += d * Math.min(1, dt * 10);
    this.group.rotation.z = this.alive ? 0 : 1.25;
    if (!this.alive) this.group.position.y = this.target.y + 0.15;
    const cam = this.game.camera.position;
    const dist = Math.hypot(cam.x - this.group.position.x, cam.z - this.group.position.z);
    this.group.visible = this.ready && dist > 1.15;
    this.nameSprite.visible = this.game.state === 'playing' && this.group.visible;
  }

  dispose() {
    this.game.scene.remove(this.group);
    for (const m of this.mats) m.dispose();
    this.nameTex.dispose();
    this.nameSprite.material.dispose();
  }
}

// ============================================================
//  CHEST
// ============================================================
let beamTexture = null;
function getBeamTexture() {
  if (beamTexture) return beamTexture;
  const c = document.createElement('canvas');
  c.width = 16; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 128, 0, 0);
  grad.addColorStop(0, 'rgba(255,190,80,0)');
  grad.addColorStop(0.18, 'rgba(255,190,80,.55)');
  grad.addColorStop(0.7, 'rgba(255,220,140,.22)');
  grad.addColorStop(1, 'rgba(255,235,190,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 128);
  // vertical streaks
  for (let i = 0; i < 6; i++) {
    g.fillStyle = 'rgba(255,240,200,.14)';
    g.fillRect(Math.random() * 16 | 0, 20 + Math.random() * 80 | 0, 1, 10 + Math.random() * 30 | 0);
  }
  beamTexture = new THREE.CanvasTexture(c);
  beamTexture.colorSpace = THREE.SRGBColorSpace;
  return beamTexture;
}

const CHEST_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
let CHEST_GEOS = null;
function getChestGeos() {
  if (CHEST_GEOS) return CHEST_GEOS;
  const C = (w, h, d, x, y, z, c) => ({ w, h, d, x, y, z, c });
  CHEST_GEOS = {
    base: mergedBoxes([
      C(0.9, 0.52, 0.66, 0, 0.26, 0, 0x9a6a3d),
      C(0.075, 0.54, 0.7, -0.29, 0.26, 0, 0x8c8170),
      C(0.075, 0.54, 0.7, 0.29, 0.26, 0, 0x8c8170),
      C(0.92, 0.06, 0.68, 0, 0.5, 0, 0x5a3a21),
      C(0.94, 0.1, 0.7, 0, 0.42, 0, 0x8c8170),
    ]),
    lid: mergedBoxes([
      C(0.92, 0.24, 0.68, 0, 0.12, 0.33, 0x9a6a3d),
      C(0.96, 0.08, 0.72, 0, 0.16, 0.33, 0x8c8170),
      C(0.14, 0.18, 0.08, 0, 0.02, 0.66, 0xffc860),
    ]),
  };
  return CHEST_GEOS;
}

export class Chest {
  constructor(game, data) {
    this.game = game;
    this.data = data;
    this.tier = data.tier;
    this.group = new THREE.Group();
    this.group.position.set(data.x + 0.5, data.y, data.z + 0.5);
    game.scene.add(this.group);

    const geos = getChestGeos();
    const base = new THREE.Mesh(geos.base, CHEST_MAT);
    base.castShadow = true;
    this.group.add(base);

    const lid = new THREE.Group();
    lid.position.set(0, 0.52, -0.33);
    this.lid = lid;
    this.group.add(lid);
    const lidMesh = new THREE.Mesh(geos.lid, CHEST_MAT);
    lidMesh.castShadow = true;
    lid.add(lidMesh);

    // marker beam: single camera-facing glow column
    const beamMat = new THREE.SpriteMaterial({
      map: getBeamTexture(), color: 0xffc860, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    });
    this.beamMat = beamMat;
    this.beam = new THREE.Sprite(beamMat);
    this.beam.position.y = 5.3;
    this.beam.scale.set(1.5, 11, 1);
    this.beam.renderOrder = 15;
    this.group.add(this.beam);

    // glow sprite
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const cg = c.getContext('2d');
    const gr = cg.createRadialGradient(32, 32, 0, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,235,180,.9)');
    gr.addColorStop(0.35, 'rgba(255,190,90,.35)');
    gr.addColorStop(1, 'rgba(255,160,40,0)');
    cg.fillStyle = gr; cg.fillRect(0, 0, 64, 64);
    const glowTex = new THREE.CanvasTexture(c);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, opacity: 0.9,
    }));
    this.glow.position.y = 0.6;
    this.glow.scale.setScalar(1.6);
    this.glow.renderOrder = 16;
    this.group.add(this.glow);

    this.openT = 0;
    this.openTarget = 0;
    this.time = Math.random() * 10;
  }

  open() {
    this.data.looted = true;
    this.openTarget = -1.65;
    this.game.sound.chest();
    this.game.effects.spawn(this.data.x + 0.5, this.data.y + 0.7, this.data.z + 0.5, 0xffcf6b, 20, { speed: 2.5, up: 3.5, size: 0.08, life: 1.1, solid: false });
  }

  markLootedQuiet() {
    this.data.looted = true;
    this.openTarget = -1.65;
    this.openT = -1.65;
    this.lid.rotation.x = -1.65;
    this.beamMat.opacity = 0;
    this.beam.visible = false;
    this.glow.visible = false;
  }

  resetLoot() {
    this.data.looted = false;
    this.openT = 0;
    this.openTarget = 0;
    this.lid.rotation.x = 0;
    this.beam.visible = true;
    this.glow.visible = true;
    this.beamMat.opacity = 0.55;
    this.glow.material.opacity = 0.9;
    this.time = Math.random() * 10;
  }

  update(dt) {
    this.time += dt;
    if (this.data.looted) {
      this.openT += (this.openTarget - this.openT) * Math.min(1, dt * 9);
      this.lid.rotation.x = this.openT;
      this.beamMat.opacity = Math.max(0, this.beamMat.opacity - dt * 1.4);
      this.glow.material.opacity = Math.max(0, this.glow.material.opacity - dt * 1.5);
      if (this.beamMat.opacity <= 0.01) {
        this.beam.visible = false;
        this.glow.visible = false;
      }
    } else {
      const p = 0.5 + Math.sin(this.time * 2.2) * 0.5;
      this.glow.scale.setScalar(1.35 + p * 0.45);
      this.glow.material.opacity = 0.65 + p * 0.3;
      this.beamMat.opacity = 0.35 + p * 0.25;
    }
  }

  dispose() {
    this.game.scene.remove(this.group);
    this.beamMat.dispose();
    this.glow.material.map?.dispose();
    this.glow.material.dispose();
  }
}

// ============================================================
//  ENEMY PROJECTILE
// ============================================================
export class Projectile {
  constructor(game, pos, dir, speed, dmg, big = false, color = 0xffb060) {
    this.game = game;
    this.pos = pos.clone();
    this.vel = dir.clone().normalize().multiplyScalar(speed);
    this.dmg = dmg;
    this.life = 5;
    this.dead = false;
    this.radius = big ? 0.32 : 0.17;
    this.color = color;
    const tex = game.projectileTex;
    this.mesh = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.mesh.scale.setScalar(big ? 1.4 : 0.7);
    this.mesh.position.copy(pos);
    game.scene.add(this.mesh);
    this.trail = 0;
  }

  update(dt) {
    if (this.dead) return;
    this.life -= dt;
    if (this.life <= 0) return this.explode(false);
    this.vel.y -= 2.4 * dt;
    this.pos.addScaledVector(this.vel, dt);
    this.mesh.position.copy(this.pos);
    this.trail -= dt;
    if (this.trail <= 0) {
      this.trail = 0.045;
      this.game.effects.spawn(this.pos.x, this.pos.y, this.pos.z, this.color, 1, { speed: 0.4, up: 0.2, size: 0.12, life: 0.35, solid: false });
    }
    const w = this.game.world;
    if (w.isSolid(Math.floor(this.pos.x), Math.floor(this.pos.y), Math.floor(this.pos.z))) {
      return this.explode(false);
    }
    const p = this.game.player;
    if (p.alive) {
      const dx = this.pos.x - p.pos.x, dz = this.pos.z - p.pos.z;
      if (Math.hypot(dx, dz) < 0.55 + this.radius && this.pos.y > p.pos.y + 0.1 && this.pos.y < p.pos.y + 1.85) {
        this.game.damagePlayer(this.dmg, this.pos, 'ОСА');
        return this.explode(true);
      }
    }
  }

  explode(hitPlayer) {
    if (this.dead) return;
    this.dead = true;
    this.game.scene.remove(this.mesh);
    this.mesh.material.dispose();
    if (!hitPlayer) {
      this.game.effects.sparks(this.pos.x, this.pos.y, this.pos.z, 0xffb060, 8);
      this.game.effects.flash(this.pos.x, this.pos.y, this.pos.z, 0xff7a44, 0.55);
    }
    this.game.removeProjectile(this);
  }
}

// ============================================================
//  PICKUP
// ============================================================
export class Pickup {
  constructor(game, pos, kind, amount, meta = null) {
    this.game = game;
    this.kind = kind;
    this.amount = amount;
    this.meta = meta;
    this.baseY = pos.y;
    this.pos = pos.clone();
    this.dead = false;
    this.time = Math.random() * 6;

    const g = new THREE.Group();
    if (kind === 'armor' && meta) {
      const cfg = ARMOR_SETS[meta.set] || { color: 0x8a9099, accent: 0xffb144 };
      const body = new THREE.MeshLambertMaterial({ color: cfg.color });
      const trim = new THREE.MeshBasicMaterial({ color: cfg.accent, toneMapped: false });
      const dark = new THREE.MeshLambertMaterial({ color: 0x20252d });
      const add = (w, h, d, x, y, z, mat) => {
        const m = new THREE.Mesh(BOX, mat);
        m.scale.set(w, h, d);
        m.position.set(x, y, z);
        g.add(m);
        return m;
      };
      if (meta.slot === 'helmet') {
        add(0.3, 0.22, 0.3, 0, 0.02, 0, body);
        add(0.26, 0.08, 0.05, 0, 0.01, 0.16, dark);
        add(0.32, 0.035, 0.31, 0, 0.13, 0, trim);
        add(0.06, 0.12, 0.24, 0, 0.2, -0.02, trim);
      } else if (meta.slot === 'chest') {
        add(0.36, 0.34, 0.2, 0, 0.02, 0, body);
        add(0.12, 0.14, 0.18, -0.23, 0.06, 0, body);
        add(0.12, 0.14, 0.18, 0.23, 0.06, 0, body);
        add(0.05, 0.36, 0.21, 0, 0.02, 0, trim);
        add(0.36, 0.05, 0.21, 0, -0.14, 0, trim);
      } else {
        add(0.13, 0.3, 0.14, -0.085, 0, 0, body);
        add(0.13, 0.3, 0.14, 0.085, 0, 0, body);
        add(0.32, 0.06, 0.15, 0, 0.14, 0, trim);
        add(0.13, 0.07, 0.15, -0.085, -0.17, 0, dark);
        add(0.13, 0.07, 0.15, 0.085, -0.17, 0, dark);
      }
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: game.projectileTex, color: cfg.accent, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glow.scale.setScalar(1.15);
      g.add(glow);
    } else if (kind === 'coin') {
      const coinGeo = new THREE.CylinderGeometry(0.17, 0.17, 0.055, 14);
      const coin = new THREE.Mesh(coinGeo, new THREE.MeshBasicMaterial({ color: 0xffd24a, toneMapped: false }));
      coin.rotation.x = Math.PI / 2;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.022, 14), new THREE.MeshBasicMaterial({ color: 0xffa62e, toneMapped: false }));
      rim.rotation.x = Math.PI / 2;
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: game.projectileTex, color: 0xffd24a, transparent: true, opacity: 0.75,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glow.scale.setScalar(0.75);
      g.add(coin, rim, glow);
    } else if (kind === 'medkit') {
      const m1 = new THREE.Mesh(BOX, new THREE.MeshLambertMaterial({ color: 0xe8edf4 }));
      m1.scale.set(0.34, 0.24, 0.24);
      const m2 = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: 0xff5468 }));
      m2.scale.set(0.24, 0.07, 0.26);
      const m3 = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: 0xff5468 }));
      m3.scale.set(0.08, 0.24, 0.26);
      g.add(m1, m2, m3);
    } else if (kind === 'ammo') {
      const m1 = new THREE.Mesh(BOX, new THREE.MeshLambertMaterial({ color: 0x9aa6b4 }));
      m1.scale.set(0.36, 0.22, 0.26);
      const m2 = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: 0xffb144 }));
      m2.scale.set(0.3, 0.05, 0.3);
      m2.position.y = 0.13;
      g.add(m1, m2);
    } else {
      const color = kind === 'obsidian' ? 0x3a2b52 : kind === 'metal' ? 0x8fa4b8 : 0xb98a52;
      const m = new THREE.Mesh(BOX, new THREE.MeshLambertMaterial({ color }));
      m.scale.set(0.34, 0.34, 0.34);
      g.add(m);
    }
    this.group = g;
    this.group.position.copy(pos);
    game.scene.add(this.group);

    this.ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.4, 20),
      new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.5, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.ringMesh.rotation.x = -Math.PI / 2;
    this.ringMesh.position.copy(pos);
    game.scene.add(this.ringMesh);
  }

  update(dt) {
    if (this.dead) return;
    this.time += dt;
    const y = this.baseY + 0.4 + Math.sin(this.time * 3) * 0.12;
    this.group.position.set(this.pos.x, y, this.pos.z);
    this.group.rotation.y += dt * 1.8;
    this.ringMesh.position.set(this.pos.x, this.pos.y + 0.06, this.pos.z);
    this.ringMesh.rotation.z += dt * 1.4;
    this.ringMesh.material.opacity = 0.3 + Math.abs(Math.sin(this.time * 2)) * 0.3;
    const p = this.game.player;
    if (p.alive && Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) < 1.5 && Math.abs(p.pos.y + 0.9 - y) < 1.6) {
      this.game.collectPickup(this);
    }
  }

  dispose() {
    this.game.scene.remove(this.group);
    this.game.scene.remove(this.ringMesh);
    this.group.traverse(o => {
      if (o.isMesh && o.geometry !== BOX) o.geometry.dispose?.();
      if (o.material) o.material.dispose?.();
    });
    this.ringMesh.geometry.dispose();
    this.ringMesh.material.dispose();
  }
}

// ============================================================
//  MERCHANT — ПИЖОНЧИК
// ============================================================
export class Merchant {
  constructor(game, pos) {
    this.game = game;
    this.pos = new THREE.Vector3(pos.x, pos.y, pos.z);
    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    game.scene.add(this.group);

    this.mats = [];
    const M = (c) => { const m = lambert(c); this.mats.push(m); return m; };
    const G = (c) => { const m = glowing(c); this.mats.push(m); return m; };
    const suit = M(0x5c2f8f);
    const dark = M(0x261b35);
    const shirt = M(0xf0e8dc);
    const skin = M(0xc79a6f);
    const gold = G(0xffd24a);
    const hat = M(0x342042);

    // counter
    box(this.group, 1.7, 0.68, 0.55, 0, 0.34, 0.8, M(0x6a4528));
    box(this.group, 1.76, 0.07, 0.61, 0, 0.71, 0.8, gold, false);
    box(this.group, 0.5, 0.12, 0.3, -0.45, 0.78, 0.8, M(0x8a5a33));
    box(this.group, 0.3, 0.2, 0.3, 0.5, 0.82, 0.8, M(0xb08a3c));
    // legs
    box(this.group, 0.22, 0.8, 0.25, -0.16, 0.4, 0, dark);
    box(this.group, 0.22, 0.8, 0.25, 0.16, 0.4, 0, dark);
    // torso
    box(this.group, 0.6, 0.75, 0.35, 0, 1.18, 0, suit);
    box(this.group, 0.26, 0.5, 0.04, 0, 1.23, 0.2, shirt);
    box(this.group, 0.14, 0.07, 0.05, 0, 1.43, 0.22, M(0xa52b3a));
    // gold chain
    box(this.group, 0.34, 0.035, 0.035, 0, 1.37, 0.21, gold, false);
    box(this.group, 0.08, 0.12, 0.035, 0, 1.31, 0.22, gold, false);
    // arms
    box(this.group, 0.18, 0.62, 0.22, -0.42, 1.25, 0, suit);
    box(this.group, 0.18, 0.62, 0.22, 0.42, 1.25, 0, suit);
    // head, glasses, hat
    box(this.group, 0.4, 0.38, 0.38, 0, 1.78, 0, skin);
    box(this.group, 0.34, 0.08, 0.06, 0, 1.82, 0.2, M(0x17171b));
    box(this.group, 0.52, 0.06, 0.5, 0, 1.98, 0, hat);
    box(this.group, 0.34, 0.3, 0.34, 0, 2.15, 0, hat);
    // cane
    box(this.group, 0.04, 0.9, 0.04, 0.53, 0.48, 0.18, M(0x3c2414));
    box(this.group, 0.16, 0.1, 0.1, 0.53, 0.95, 0.18, gold, false);

    // floating coin
    this.coin = new THREE.Group();
    this.coin.position.set(0, 3.15, 0);
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.06, 14),
      new THREE.MeshBasicMaterial({ color: 0xffd24a, toneMapped: false })
    );
    disc.rotation.x = Math.PI / 2;
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.025, 14),
      new THREE.MeshBasicMaterial({ color: 0xffa62e, toneMapped: false })
    );
    rim.rotation.x = Math.PI / 2;
    this.coin.add(disc, rim);
    this.group.add(this.coin);

    // marker beam
    this.beamMat = new THREE.SpriteMaterial({
      map: getBeamTexture(), color: 0xffd24a, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    });
    this.beam = new THREE.Sprite(this.beamMat);
    this.beam.position.y = 6.4;
    this.beam.scale.set(1.35, 12, 1);
    this.beam.renderOrder = 15;
    this.group.add(this.beam);

    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: game.projectileTex, color: 0xffd24a, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    }));
    this.glow.position.y = 2.3;
    this.glow.scale.setScalar(1.5);
    this.glow.renderOrder = 16;
    this.group.add(this.glow);

    this.nameTex = makeNameTexture('ПИЖОНЧИК');
    this.nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.nameTex, transparent: true, depthWrite: false, depthTest: false, opacity: 0.95,
    }));
    this.nameSprite.position.set(0, 2.72, 0);
    this.nameSprite.scale.set(2.0, 0.5, 1);
    this.nameSprite.renderOrder = 25;
    this.group.add(this.nameSprite);

    this.time = Math.random() * 10;
  }

  update(dt) {
    this.time += dt;
    this.coin.rotation.y += dt * 1.7;
    this.coin.position.y = 3.15 + Math.sin(this.time * 2.4) * 0.1;
    this.beamMat.opacity = 0.35 + Math.abs(Math.sin(this.time * 1.8)) * 0.25;
    this.glow.material.opacity = 0.22 + Math.abs(Math.sin(this.time * 2.1)) * 0.18;
    this.nameSprite.visible = this.game.state === 'playing' || this.game.state === 'inventory' || this.game.state === 'paused';
  }

  dispose() {
    this.game.scene.remove(this.group);
    for (const m of this.mats) m.dispose();
    this.nameTex.dispose();
    this.nameSprite.material.dispose();
    this.beamMat.dispose();
    this.glow.material.dispose();
    this.coin.traverse(o => {
      if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
    });
  }
}

// ============================================================
//  GUNSMITH BENCH
// ============================================================
export class GunsmithBench {
  constructor(game, pos) {
    this.game = game;
    this.pos = new THREE.Vector3(pos.x, pos.y, pos.z);
    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    game.scene.add(this.group);

    this.mats = [];
    const M = (c) => { const m = lambert(c); this.mats.push(m); return m; };
    const G = (c) => { const m = glowing(c); this.mats.push(m); return m; };
    const wood = M(0x6a4528), metal = M(0x7b8ea3), dark = M(0x2c3540);
    const cyan = G(0x8ef0ff), orange = G(0xffb144);

    box(this.group, 2.1, 0.78, 0.95, 0, 0.39, 0, wood);
    box(this.group, 2.18, 0.08, 1.02, 0, 0.81, 0, metal);
    box(this.group, 2.18, 0.05, 1.02, 0, 0.74, 0, dark);
    for (const x of [-0.78, 0.78]) {
      box(this.group, 0.14, 0.78, 0.9, x, 0.39, 0, dark);
    }
    box(this.group, 0.38, 0.24, 0.32, -0.68, 0.98, 0.16, metal);
    box(this.group, 0.18, 0.12, 0.42, -0.68, 1.02, -0.02, dark);
    box(this.group, 0.52, 0.22, 0.34, 0.62, 0.97, 0.2, M(0x3f4a55));
    box(this.group, 0.5, 0.04, 0.32, 0.62, 1.1, 0.2, orange, false);
    box(this.group, 0.56, 0.1, 0.4, 0.1, 0.92, 0.25, M(0x4c5663));
    box(this.group, 0.08, 0.62, 0.08, -0.2, 1.16, -0.28, metal);
    box(this.group, 0.5, 0.08, 0.12, 0.05, 1.47, -0.28, dark);
    box(this.group, 0.62, 0.055, 0.05, 0.22, 1.42, -0.28, cyan, false);
    box(this.group, 0.3, 0.08, 0.3, 0.78, 1.46, -0.24, dark);
    box(this.group, 0.2, 0.24, 0.2, 0.78, 1.6, -0.24, cyan, false);

    this.beamMat = new THREE.SpriteMaterial({
      map: getBeamTexture(), color: 0x8ef0ff, transparent: true, opacity: 0.38,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    });
    this.beam = new THREE.Sprite(this.beamMat);
    this.beam.position.y = 5.2;
    this.beam.scale.set(1.2, 9, 1);
    this.beam.renderOrder = 15;
    this.group.add(this.beam);

    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: game.projectileTex, color: 0x8ef0ff, transparent: true, opacity: 0.38,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    }));
    this.glow.position.y = 1.1;
    this.glow.scale.setScalar(1.5);
    this.glow.renderOrder = 16;
    this.group.add(this.glow);

    this.nameTex = makeNameTexture('СТОЛ ОРУЖЕЙНИКА');
    this.nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.nameTex, transparent: true, depthWrite: false, depthTest: false, opacity: 0.95,
    }));
    this.nameSprite.position.set(0, 2.3, 0);
    this.nameSprite.scale.set(2.5, 0.62, 1);
    this.nameSprite.renderOrder = 25;
    this.group.add(this.nameSprite);
    this.time = Math.random() * 10;
  }

  update(dt) {
    this.time += dt;
    this.beamMat.opacity = 0.24 + Math.abs(Math.sin(this.time * 1.7)) * 0.18;
    this.glow.material.opacity = 0.22 + Math.abs(Math.sin(this.time * 2.1)) * 0.16;
    const p = this.game.player;
    const near = p && Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z) < 5;
    this.nameSprite.visible = !near && (this.game.state === 'playing' || this.game.state === 'inventory' ||
      this.game.state === 'paused' || this.game.state === 'bench');
  }

  dispose() {
    this.game.scene.remove(this.group);
    for (const m of this.mats) m.dispose();
    this.nameTex.dispose();
    this.nameSprite.material.dispose();
    this.beamMat.dispose();
    this.glow.material.dispose();
  }
}

// ============================================================
//  ALIEN TRADER — after wave 2
// ============================================================
export class AlienMerchant {
  constructor(game, pos) {
    this.game = game;
    this.pos = new THREE.Vector3(pos.x, pos.y, pos.z);
    this.group = new THREE.Group();
    this.group.position.copy(this.pos);
    game.scene.add(this.group);

    this.mats = [];
    const M = (c) => { const m = lambert(c); this.mats.push(m); return m; };
    const G = (c) => { const m = glowing(c); this.mats.push(m); return m; };

    const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.5, 0.42, 14), M(0x6f7a86));
    hull.position.y = 0.38;
    hull.rotation.y = Math.PI / 14;
    this.group.add(hull);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.55, 0.12, 14), G(0x8affd0));
    rim.position.y = 0.38;
    rim.rotation.y = Math.PI / 14;
    this.group.add(rim);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0x2c4a46));
    dome.position.y = 0.58;
    this.group.add(dome);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(BOX, M(0x3f4a55));
      leg.scale.set(0.16, 0.5, 0.16);
      leg.position.set(Math.cos(a) * 1.7, 0.1, Math.sin(a) * 1.7);
      this.group.add(leg);
    }
    const skin = M(0x6fbf5a), dark = M(0x1a2418), suit = M(0x3a4a55);
    box(this.group, 0.17, 0.4, 0.24, 0, 0.88, 0.12, suit);
    box(this.group, 0.34, 0.36, 0.32, 0, 1.22, 0.12, skin);
    box(this.group, 0.12, 0.18, 0.05, -0.07, 1.25, 0.29, dark);
    box(this.group, 0.12, 0.18, 0.05, 0.07, 1.25, 0.29, dark);
    box(this.group, 0.14, 0.12, 0.06, 0, 1.05, 0.28, dark);
    box(this.group, 0.25, 0.08, 0.1, 0, 1.4, 0.11, G(0x8affd0), false);

    this.beamMat = new THREE.SpriteMaterial({
      map: getBeamTexture(), color: 0x8affd0, transparent: true, opacity: 0.45,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    });
    this.beam = new THREE.Sprite(this.beamMat);
    this.beam.position.y = 5.6;
    this.beam.scale.set(2.2, 11, 1);
    this.beam.renderOrder = 15;
    this.group.add(this.beam);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: game.projectileTex, color: 0x8affd0, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    }));
    this.glow.position.y = 0.9;
    this.glow.scale.setScalar(2.6);
    this.glow.renderOrder = 16;
    this.group.add(this.glow);

    this.nameTex = makeNameTexture('ПРИШЕЛЕЦ');
    this.nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.nameTex, transparent: true, depthWrite: false, depthTest: false, opacity: 0.95,
    }));
    this.nameSprite.position.set(0, 2.4, 0);
    this.nameSprite.scale.set(2.2, 0.55, 1);
    this.nameSprite.renderOrder = 25;
    this.group.add(this.nameSprite);
    this.time = Math.random() * 10;
  }

  update(dt) {
    this.time += dt;
    this.group.rotation.y += dt * 0.25;
    this.group.position.y = this.pos.y + Math.sin(this.time * 1.4) * 0.06;
    this.beamMat.opacity = 0.28 + Math.abs(Math.sin(this.time * 2.3)) * 0.24;
    this.glow.material.opacity = 0.28 + Math.abs(Math.sin(this.time * 2.8)) * 0.2;
    this.nameSprite.visible = this.game.state === 'playing' || this.game.state === 'inventory' ||
      this.game.state === 'paused' || this.game.state === 'alien';
  }

  dispose() {
    this.game.scene.remove(this.group);
    for (const m of this.mats) m.dispose();
    this.nameTex.dispose();
    this.nameSprite.material.dispose();
    this.beamMat.dispose();
    this.glow.material.dispose();
    this.group.traverse(o => {
      if (o.isMesh && o.geometry !== BOX) o.geometry.dispose();
    });
  }
}
