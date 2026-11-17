import * as THREE from '../vendor/three.module.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export class Effects {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.MAX = 700;
    this.items = new Array(this.MAX).fill(null).map(() => ({
      alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
      life: 0, maxLife: 1, size: 0.1, solid: true,
    }));
    this.cursor = 0;

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial();
    this.mesh = new THREE.InstancedMesh(geo, mat, this.MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = this.MAX;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.color = new THREE.Color(0xffffff);
    for (let i = 0; i < this.MAX; i++) {
      _m.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, _m);
      this.mesh.setColorAt(i, this.color);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    scene.add(this.mesh);

    this.tracers = [];
    this.flashes = [];
    this.rings = [];
    this.timer = 0;
    this._tracerGeo = new THREE.CylinderGeometry(1, 1, 1, 4, 1, true);
    this._flashTex = null;
  }

  spawn(x, y, z, color, count = 8, opt = {}) {
    const speed = opt.speed ?? 3.2;
    const up = opt.up ?? 2.5;
    const size = opt.size ?? 0.1;
    const life = opt.life ?? 0.9;
    const solid = opt.solid !== false;
    const spread = opt.spread ?? 1;
    this.color.set(color);
    for (let n = 0; n < count; n++) {
      const idx = this.cursor;
      const p = this.items[idx];
      this.cursor = (this.cursor + 1) % this.MAX;
      p.alive = true;
      p.x = x + (Math.random() - 0.5) * 0.5 * spread;
      p.y = y + (Math.random() - 0.5) * 0.5 * spread;
      p.z = z + (Math.random() - 0.5) * 0.5 * spread;
      p.vx = (Math.random() - 0.5) * speed * 2;
      p.vy = Math.random() * up + up * 0.2;
      p.vz = (Math.random() - 0.5) * speed * 2;
      p.life = p.maxLife = life * (0.6 + Math.random() * 0.7);
      p.size = size * (0.55 + Math.random() * 0.9);
      p.solid = solid;
      this.mesh.setColorAt(idx, this.color);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  blockBurst(x, y, z, blockColor, count = 10) {
    this.spawn(x + 0.5, y + 0.5, z + 0.5, blockColor, count, { speed: 2.6, up: 2.4, size: 0.115, life: 1.0 });
  }

  bloodBurst(x, y, z, color = 0x6fdc5a, count = 8) {
    this.spawn(x, y, z, color, count, { speed: 3.0, up: 2.6, size: 0.085, life: 0.7, solid: false });
  }

  sparks(x, y, z, color = 0xffc46b, count = 6) {
    this.spawn(x, y, z, color, count, { speed: 4.5, up: 2.0, size: 0.05, life: 0.35, solid: false });
  }

  tracer(a, b, color = 0xffe2a0, width = 0.012) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 0.01) return;
    const mesh = new THREE.Mesh(
      this._tracerGeo,
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.85,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(_up, dir.normalize());
    mesh.scale.set(width, len, width);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    this.tracers.push({ mesh, t: 0, dur: 0.075 });
  }

  flash(x, y, z, color = 0xffd27a, size = 0.55) {
    if (!this._flashTex) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30);
      gr.addColorStop(0, 'rgba(255,255,240,1)');
      gr.addColorStop(0.3, 'rgba(255,220,150,.85)');
      gr.addColorStop(1, 'rgba(255,150,50,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      this._flashTex = new THREE.CanvasTexture(c);
    }
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this._flashTex, color, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
    }));
    spr.position.set(x, y, z);
    spr.scale.setScalar(size);
    spr.renderOrder = 20;
    this.scene.add(spr);
    this.flashes.push({ spr, t: 0, dur: 0.09 });
  }

  ring(x, y, z, color = 0xff7a4d, maxRadius = 7, dur = 0.65) {
    const geo = new THREE.RingGeometry(0.72, 0.82, 48);
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y + 0.12, z);
    mesh.scale.setScalar(0.4);
    this.scene.add(mesh);
    this.rings.push({ mesh, t: 0, dur, maxRadius });
  }

  update(dt) {
    // particles
    let changed = false;
    for (let i = 0; i < this.MAX; i++) {
      const p = this.items[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        _m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, _m);
        changed = true;
        continue;
      }
      p.vy -= 16 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.solid && this.world) {
        const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
        if (this.world.isSolid(bx, by, bz)) {
          p.y = by + 1.02;
          p.vy = Math.abs(p.vy) * 0.28;
          p.vx *= 0.55; p.vz *= 0.55;
          if (Math.abs(p.vy) < 0.4) p.vy = 0.2;
        }
        if (p.y < -10) { p.alive = false; _m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, _m); changed = true; continue; }
      }
      const fade = Math.min(1, p.life / 0.22);
      _p.set(p.x, p.y, p.z);
      _s.setScalar(p.size * fade);
      _m.compose(_p, _q.identity(), _s);
      this.mesh.setMatrixAt(i, _m);
      changed = true;
    }
    if (changed) this.mesh.instanceMatrix.needsUpdate = true;

    // tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.t += dt;
      const k = 1 - t.t / t.dur;
      if (k <= 0) {
        this.scene.remove(t.mesh);
        t.mesh.material.dispose();
        this.tracers.splice(i, 1);
      } else {
        t.mesh.material.opacity = 0.85 * k;
        t.mesh.scale.x = t.mesh.scale.z = 0.012 * k;
      }
    }
    // flashes
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t += dt;
      const k = 1 - f.t / f.dur;
      if (k <= 0) {
        this.scene.remove(f.spr);
        f.spr.material.dispose();
        this.flashes.splice(i, 1);
      } else {
        f.spr.material.opacity = k;
        f.spr.scale.setScalar(0.5 + (1 - k) * 0.4);
      }
    }
    // rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const k = r.t / r.dur;
      if (k >= 1) {
        this.scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        this.rings.splice(i, 1);
      } else {
        r.mesh.scale.setScalar(0.4 + k * r.maxRadius);
        r.mesh.material.opacity = 0.9 * (1 - k);
      }
    }
  }

  clear() {
    for (const p of this.items) p.alive = false;
    for (let i = 0; i < this.MAX; i++) {
      _m.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, _m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    for (const t of this.tracers) { this.scene.remove(t.mesh); t.mesh.material.dispose(); }
    this.tracers.length = 0;
    for (const f of this.flashes) { this.scene.remove(f.spr); f.spr.material.dispose(); }
    this.flashes.length = 0;
    for (const r of this.rings) { this.scene.remove(r.mesh); r.mesh.geometry.dispose(); r.mesh.material.dispose(); }
    this.rings.length = 0;
  }
}
