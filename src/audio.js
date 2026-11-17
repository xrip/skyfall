// Tiny procedural sound engine (WebAudio, zero assets)
export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.noiseBuf = null;
    this.ambient = null;
    this.started = false;
    this._lastMine = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 22;
    comp.ratio.value = 5;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    this.master.connect(comp).connect(this.ctx.destination);

    // white noise buffer
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  startAmbient() {
    if (!this.ctx || this.started) return;
    this.started = true;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.Q.value = 0.6;
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 90;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.035;
    src.connect(hp).connect(lp).connect(gain).connect(this.master);
    src.start();

    // slow wind swell
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();

    // distant airy tone
    const air = this.ctx.createOscillator();
    air.type = 'sine';
    air.frequency.value = 168;
    const airGain = this.ctx.createGain();
    airGain.gain.value = 0.008;
    const airLfo = this.ctx.createOscillator();
    airLfo.frequency.value = 0.11;
    const airLfoGain = this.ctx.createGain();
    airLfoGain.gain.value = 0.006;
    airLfo.connect(airLfoGain).connect(airGain.gain);
    air.connect(airGain).connect(this.master);
    air.start(); airLfo.start();

    this.ambient = { src, gain, lfo };
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }

  _t() { return this.ctx.currentTime; }

  noise({ dur = 0.15, gain = 0.35, type = 'bandpass', freq = 900, q = 0.8, attack = 0.002, pan = 0, rate = 1 }) {
    if (!this.ctx || this.muted) return;
    const t = this._t();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = rate;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = src.connect(f).connect(g);
    if (pan !== 0 && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      node = node.connect(p);
    }
    node.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  tone(freq = 440, dur = 0.1, { type = 'sine', gain = 0.2, slide = 0, attack = 0.004, pan = 0, delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t = this._t() + delay;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o.connect(g);
    if (pan !== 0 && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      node = node.connect(p);
    }
    node.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /* ---------- weapons ---------- */
  shot(kind) {
    if (!this.ctx) return;
    if (kind === 'pistol') {
      this.noise({ dur: 0.14, gain: 0.42, freq: 1500, q: 0.7 });
      this.tone(120, 0.12, { type: 'triangle', gain: 0.34, slide: 45 });
    } else if (kind === 'smg') {
      this.noise({ dur: 0.075, gain: 0.3, freq: 2100, q: 0.9 });
      this.tone(160, 0.06, { type: 'square', gain: 0.18, slide: 60 });
    } else if (kind === 'shotgun') {
      this.noise({ dur: 0.34, gain: 0.55, freq: 780, q: 0.6 });
      this.tone(78, 0.32, { type: 'triangle', gain: 0.5, slide: 32 });
      this.noise({ dur: 0.5, gain: 0.12, freq: 320, q: 0.4 });
    } else if (kind === 'ak') {
      this.noise({ dur: 0.13, gain: 0.4, freq: 1350, q: 0.7 });
      this.tone(104, 0.14, { type: 'sawtooth', gain: 0.3, slide: 44 });
      this.noise({ dur: 0.3, gain: 0.1, freq: 420, q: 0.5 });
    } else if (kind === 'sniper') {
      this.noise({ dur: 0.4, gain: 0.6, freq: 1500, q: 0.5 });
      this.tone(64, 0.45, { type: 'sawtooth', gain: 0.5, slide: 26 });
      this.noise({ dur: 0.7, gain: 0.16, freq: 260, q: 0.35 });
    } else if (kind === 'minigun') {
      this.noise({ dur: 0.06, gain: 0.26, freq: 2400, q: 1.1 });
      this.tone(140, 0.05, { type: 'square', gain: 0.16, slide: 70 });
    } else if (kind === 'laser') {
      this.tone(1400, 0.14, { type: 'sawtooth', gain: 0.18, slide: 420 });
      this.tone(2100, 0.08, { type: 'sine', gain: 0.1, delay: 0.02 });
      this.noise({ dur: 0.08, gain: 0.12, freq: 3400, q: 1.2 });
    } else if (kind === 'plasma') {
      this.tone(220, 0.22, { type: 'triangle', gain: 0.3, slide: 70 });
      this.noise({ dur: 0.18, gain: 0.24, freq: 900, q: 0.8 });
      this.tone(680, 0.08, { type: 'sine', gain: 0.1, delay: 0.04 });
    } else {
      this.noise({ dur: 0.19, gain: 0.45, freq: 1100, q: 0.6, rate: 0.85 });
      this.tone(100, 0.17, { type: 'sawtooth', gain: 0.26, slide: 38 });
    }
  }
  dryFire() { this.tone(240, 0.04, { type: 'square', gain: 0.08 }); this.noise({ dur: 0.04, gain: 0.12, freq: 3000 }); }
  meleeSwing() {
    this.noise({ dur: 0.13, gain: 0.15, freq: 900, q: 1.1, type: 'bandpass' });
    this.tone(230, 0.09, { type: 'triangle', gain: 0.05, slide: 120 });
  }
  reloadClick() { this.tone(720, 0.035, { type: 'square', gain: 0.09 }); this.noise({ dur: 0.05, gain: 0.09, freq: 2400 }); }
  reloadDone() { this.tone(980, 0.05, { type: 'square', gain: 0.12 }); this.tone(1320, 0.06, { type: 'square', gain: 0.09, delay: 0.05 }); }
  hit(head) {
    if (head) {
      this.tone(1750, 0.05, { type: 'square', gain: 0.16 });
      this.tone(2300, 0.07, { type: 'square', gain: 0.1, delay: 0.03 });
    } else {
      this.tone(1050, 0.04, { type: 'square', gain: 0.1 });
    }
  }
  kill() {
    this.tone(300, 0.18, { type: 'sawtooth', gain: 0.13, slide: 90 });
    this.noise({ dur: 0.25, gain: 0.15, freq: 600 });
  }
  enemyShot() {
    this.tone(880, 0.22, { type: 'sawtooth', gain: 0.12, slide: 220 });
    this.noise({ dur: 0.12, gain: 0.1, freq: 3000 });
  }

  /* ---------- world ---------- */
  mine(mat) {
    if (!this.ctx) return;
    const now = this._t();
    if (now - this._lastMine < 0.09) return;
    this._lastMine = now;
    const f = mat === 'metal' ? 2600 : mat === 'stone' ? 1500 : 900;
    this.noise({ dur: 0.07, gain: 0.12, freq: f, q: 1.4 });
  }
  breakBlock(mat) {
    const f = mat === 'metal' ? 900 : mat === 'stone' ? 520 : 320;
    this.noise({ dur: 0.22, gain: 0.3, freq: f, q: 0.7, type: 'lowpass' });
    this.tone(mat === 'metal' ? 210 : 110, 0.12, { type: 'triangle', gain: 0.15, slide: 55 });
  }
  place(mat) {
    const f = mat === 'metal' ? 700 : mat === 'stone' ? 420 : 260;
    this.noise({ dur: 0.1, gain: 0.22, freq: f, q: 1 });
    this.tone(f * 0.7, 0.07, { type: 'triangle', gain: 0.12 });
  }
  chest() {
    this.tone(440, 0.09, { type: 'triangle', gain: 0.16 });
    this.tone(554, 0.09, { type: 'triangle', gain: 0.14, delay: 0.07 });
    this.tone(659, 0.12, { type: 'triangle', gain: 0.15, delay: 0.14 });
    this.tone(880, 0.2, { type: 'sine', gain: 0.1, delay: 0.21 });
  }
  pickup() { this.tone(1200, 0.05, { type: 'sine', gain: 0.1 }); this.tone(1600, 0.06, { type: 'sine', gain: 0.07, delay: 0.04 }); }
  hurt() {
    this.noise({ dur: 0.3, gain: 0.3, freq: 260, q: 0.7, type: 'lowpass' });
    this.tone(90, 0.22, { type: 'triangle', gain: 0.26, slide: 52 });
  }
  heal() { this.tone(520, 0.18, { type: 'sine', gain: 0.14, slide: 780 }); this.tone(780, 0.22, { type: 'sine', gain: 0.08, delay: 0.08 }); }
  jump() { this.noise({ dur: 0.08, gain: 0.08, freq: 500 }); }
  land() { this.noise({ dur: 0.1, gain: 0.14, freq: 200, type: 'lowpass' }); }
  waveHorn() {
    this.tone(58, 1.1, { type: 'sawtooth', gain: 0.24, slide: 44, attack: 0.08 });
    this.tone(87, 1.0, { type: 'triangle', gain: 0.12, slide: 66, delay: 0.05 });
    this.noise({ dur: 1.2, gain: 0.08, freq: 300, type: 'lowpass' });
  }
  waveClear() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.32, { type: 'triangle', gain: 0.12, delay: i * 0.1 }));
  }
  victory() {
    [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.6, { type: 'sine', gain: 0.12, delay: i * 0.14 }));
    this.noise({ dur: 1.6, gain: 0.06, freq: 800, type: 'lowpass' });
  }
  death() {
    this.tone(220, 1.2, { type: 'sawtooth', gain: 0.22, slide: 40 });
    this.noise({ dur: 1.4, gain: 0.2, freq: 200, type: 'lowpass' });
  }
  bossRoar() {
    this.tone(44, 1.3, { type: 'sawtooth', gain: 0.3, slide: 30, attack: 0.1 });
    this.tone(66, 1.2, { type: 'square', gain: 0.12, slide: 42, delay: 0.08 });
    this.noise({ dur: 1.4, gain: 0.12, freq: 180, type: 'lowpass' });
  }
  spawn() {
    this.tone(70, 0.5, { type: 'sawtooth', gain: 0.12, slide: 160 });
    this.noise({ dur: 0.5, gain: 0.1, freq: 400 });
  }
  deny() { this.tone(180, 0.12, { type: 'square', gain: 0.1 }); }
}
