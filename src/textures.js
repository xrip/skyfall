import * as THREE from '../vendor/three.module.js';

// ------------------------------------------------------------
//  Procedural pixel-art texture atlas (no external assets)
// ------------------------------------------------------------

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));
const rgb = (c) => `rgb(${clamp255(c[0])},${clamp255(c[1])},${clamp255(c[2])})`;
const shade = (c, d) => [c[0] + d, c[1] + d, c[2] + d];

function fillNoise(g, rng, base, spread, alpha = 1) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = (rng() - 0.5) * spread;
      g.globalAlpha = alpha;
      g.fillStyle = rgb(shade(base, d));
      g.fillRect(x, y, 1, 1);
    }
  }
  g.globalAlpha = 1;
}

function speck(g, rng, base, count, spread, size = 1) {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rng() * 16), y = Math.floor(rng() * 16);
    g.fillStyle = rgb(shade(base, (rng() - 0.5) * spread));
    g.fillRect(x, y, size, size);
  }
}

const TILE_PAINTERS = {
  dirt(g, rng) {
    fillNoise(g, rng, [122, 90, 61], 30);
    speck(g, rng, [96, 70, 46], 26, 18);
    speck(g, rng, [150, 114, 80], 16, 18);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = 'rgba(70,49,31,.5)';
      g.fillRect(Math.floor(rng() * 15), Math.floor(rng() * 15), 2, 1);
    }
  },

  grass_top(g, rng) {
    fillNoise(g, rng, [113, 165, 73], 34);
    speck(g, rng, [85, 135, 53], 30, 20);
    speck(g, rng, [138, 190, 92], 20, 16);
    for (let i = 0; i < 9; i++) {
      const x = Math.floor(rng() * 16), y = Math.floor(rng() * 16);
      g.fillStyle = `rgba(${70 + rng() * 30 | 0},${120 + rng() * 40 | 0},45,.55)`;
      g.fillRect(x, y, 1, 2);
    }
  },

  grass_side(g, rng) {
    fillNoise(g, rng, [122, 90, 61], 26);
    speck(g, rng, [96, 70, 46], 20, 16);
    for (let x = 0; x < 16; x++) {
      const h = 3 + Math.floor(rng() * 3);
      for (let y = 0; y < h; y++) {
        const d = (rng() - 0.5) * 26;
        g.fillStyle = rgb(shade([99, 150, 62], d));
        g.fillRect(x, y, 1, 1);
      }
      if (rng() > 0.55) {
        g.fillStyle = rgb(shade([88, 138, 55], (rng() - 0.5) * 20));
        g.fillRect(x, 2, 1, 1);
      }
    }
  },

  stone(g, rng) {
    fillNoise(g, rng, [139, 145, 151], 26);
    speck(g, rng, [112, 118, 126], 30, 16);
    speck(g, rng, [164, 170, 176], 22, 14);
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(rng() * 13) + 1, y = Math.floor(rng() * 13) + 1;
      g.fillStyle = 'rgba(87,93,102,.55)';
      g.fillRect(x, y, 1 + Math.floor(rng() * 3), 1);
      g.fillRect(x, y, 1, 1 + Math.floor(rng() * 3));
    }
  },

  basalt(g, rng) {
    fillNoise(g, rng, [64, 62, 72], 18);
    speck(g, rng, [44, 42, 52], 34, 12);
    speck(g, rng, [88, 86, 98], 18, 10);
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(rng() * 14) + 1;
      const y = Math.floor(rng() * 10) + 1;
      g.fillStyle = 'rgba(24,22,30,.7)';
      g.fillRect(x, y, 1, 3 + Math.floor(rng() * 4));
      g.fillStyle = 'rgba(120,116,130,.25)';
      g.fillRect(x + 1, y, 1, 2 + Math.floor(rng() * 3));
    }
  },

  magma(g, rng) {
    g.fillStyle = 'rgb(58,30,26)';
    g.fillRect(0, 0, 16, 16);
    fillNoise(g, rng, [74, 38, 30], 16);
    for (let i = 0; i < 7; i++) {
      const x = Math.floor(rng() * 13) + 1, y = Math.floor(rng() * 13) + 1;
      const w = 1 + Math.floor(rng() * 3);
      g.fillStyle = rng() > 0.45 ? 'rgb(255,138,46)' : 'rgb(255,196,80)';
      g.fillRect(x, y, w, 1);
      g.fillRect(x + w, y + 1, 1, 1 + Math.floor(rng() * 3));
      g.fillStyle = 'rgba(255,230,150,.55)';
      g.fillRect(x, y, 1, 1);
    }
    speck(g, rng, [30, 22, 24], 18, 10);
  },

  red_brick(g, rng) {
    g.fillStyle = 'rgb(63,28,24)';
    g.fillRect(0, 0, 16, 16);
    const brickC = [170, 62, 48];
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 0 : 8;
      for (let col = 0; col < 2; col++) {
        const x = col * 8 + off, y = row * 4;
        g.fillStyle = rgb(shade(brickC, (rng() - 0.5) * 20));
        g.fillRect(x + 1, y + 1, 7, 3);
        g.fillStyle = 'rgba(255,160,130,.28)';
        g.fillRect(x + 1, y + 1, 7, 1);
        g.fillStyle = 'rgba(40,14,10,.55)';
        g.fillRect(x + 1, y + 3, 7, 1);
      }
    }
    speck(g, rng, [120, 44, 34], 16, 10);
  },

  hay(g, rng) {
    fillNoise(g, rng, [196, 158, 58], 22);
    for (let y = 0; y < 16; y += 3) {
      g.fillStyle = 'rgba(120,88,26,.45)';
      g.fillRect(0, y, 16, 1);
    }
    for (let i = 0; i < 38; i++) {
      const x = Math.floor(rng() * 15);
      const y = Math.floor(rng() * 15);
      g.fillStyle = rng() > 0.5 ? 'rgba(232,198,92,.55)' : 'rgba(134,96,30,.5)';
      g.fillRect(x, y, 1, 2 + Math.floor(rng() * 3));
    }
  },

  wire(g, rng) {
    g.fillStyle = 'rgb(58,55,52)';
    g.fillRect(0, 0, 16, 16);
    speck(g, rng, [88, 86, 82], 24, 16);
    g.strokeStyle = 'rgba(190,198,206,.75)';
    g.lineWidth = 1;
    for (let i = -4; i < 20; i += 5) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 12, 16); g.stroke();
      g.beginPath(); g.moveTo(i + 12, 0); g.lineTo(i, 16); g.stroke();
    }
    for (const [x, y] of [[3, 3], [12, 4], [6, 11], [13, 12]]) {
      g.fillStyle = '#d7e1ea';
      g.fillRect(x, y, 2, 2);
    }
  },

  brick(g, rng) {
    g.fillStyle = 'rgb(78,84,93)';
    g.fillRect(0, 0, 16, 16);
    const brickC = [166, 171, 180];
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 0 : 8;
      for (let col = 0; col < 2; col++) {
        const x = col * 8 + off;
        const y = row * 4;
        g.fillStyle = rgb(shade(brickC, (rng() - 0.5) * 16));
        g.fillRect(x + 1, y + 1, 7, 3);
        g.fillStyle = 'rgba(190,196,205,.35)';
        g.fillRect(x + 1, y + 1, 7, 1);
        g.fillStyle = 'rgba(45,50,58,.5)';
        g.fillRect(x + 1, y + 3, 7, 1);
      }
    }
    speck(g, rng, [120, 126, 136], 14, 10);
  },

  log_side(g, rng) {
    fillNoise(g, rng, [120, 85, 48], 22);
    for (let x = 0; x < 16; x++) {
      if (rng() > 0.55) {
        const h = 4 + Math.floor(rng() * 12);
        const y = Math.floor(rng() * (16 - h));
        g.fillStyle = `rgba(${70 + rng() * 20 | 0},${48 + rng() * 16 | 0},28,.6)`;
        g.fillRect(x, y, 1, h);
      }
    }
    for (let i = 0; i < 3; i++) {
      const x = 1 + Math.floor(rng() * 13), y = 2 + Math.floor(rng() * 12);
      g.fillStyle = 'rgb(82,58,34)';
      g.fillRect(x, y, 2, 2);
      g.fillStyle = 'rgb(152,113,69)';
      g.fillRect(x, y, 1, 1);
    }
  },

  log_top(g, rng) {
    fillNoise(g, rng, [161, 127, 79], 18);
    const cx = 7.5, cy = 7.5;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > 7.2) {
          g.fillStyle = rgb(shade([104, 74, 41], (rng() - 0.5) * 16));
          g.fillRect(x, y, 1, 1);
        } else if (Math.floor(d) % 2 === 0) {
          g.fillStyle = rgb(shade([134, 101, 60], (rng() - 0.5) * 14));
          g.fillRect(x, y, 1, 1);
        }
      }
    }
    g.fillStyle = 'rgb(88,64,38)';
    g.fillRect(7, 7, 2, 2);
  },

  planks(g, rng) {
    const base = [185, 138, 82];
    fillNoise(g, rng, base, 20);
    for (let row = 0; row < 4; row++) {
      const y = row * 4;
      g.fillStyle = 'rgba(92,63,34,.85)';
      g.fillRect(0, y + 3, 16, 1);
      g.fillStyle = 'rgba(216,172,112,.35)';
      g.fillRect(0, y, 16, 1);
      const joint = (row * 5 + 3) % 16;
      g.fillStyle = 'rgba(92,63,34,.7)';
      g.fillRect(joint, y, 1, 3);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = `rgba(${125 + rng() * 30 | 0},${90 + rng() * 20 | 0},50,.35)`;
        g.fillRect(Math.floor(rng() * 13), y + 1 + Math.floor(rng() * 2), 3 + Math.floor(rng() * 3), 1);
      }
    }
  },

  metal(g, rng) {
    fillNoise(g, rng, [143, 163, 184], 20);
    for (let y = 0; y < 16; y += 8) {
      for (let x = 0; x < 16; x += 8) {
        g.fillStyle = 'rgba(61,76,93,.85)';
        g.fillRect(x, y, 1, 1);
        g.fillStyle = 'rgba(178,197,214,.3)';
        g.fillRect(x + 1, y + 1, 6, 1);
      }
    }
    g.fillStyle = 'rgba(55,70,86,.9)';
    g.fillRect(0, 7, 16, 1);
    g.fillRect(0, 15, 16, 1);
    g.fillRect(7, 0, 1, 16);
    // rivets
    for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13], [5, 5], [10, 10]]) {
      g.fillStyle = 'rgb(184,203,219)';
      g.fillRect(x, y, 1, 1);
      g.fillStyle = 'rgba(40,54,68,.8)';
      g.fillRect(x + 1, y + 1, 1, 1);
    }
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = 'rgba(205,220,232,.18)';
      g.beginPath();
      const x = rng() * 12 | 0, y = rng() * 12 | 0;
      g.moveTo(x, y); g.lineTo(x + 3, y + 3); g.stroke();
    }
    speck(g, rng, [150, 168, 186], 12, 12);
  },

  sand(g, rng) {
    fillNoise(g, rng, [219, 199, 143], 18);
    speck(g, rng, [196, 174, 118], 34, 14);
    speck(g, rng, [238, 222, 172], 22, 12);
    for (let i = 0; i < 5; i++) {
      g.fillStyle = 'rgba(176,153,99,.5)';
      g.fillRect(Math.floor(rng() * 15), Math.floor(rng() * 15), 2, 1);
    }
  },

  obsidian(g, rng) {
    fillNoise(g, rng, [33, 27, 48], 16);
    speck(g, rng, [19, 15, 29], 30, 10);
    speck(g, rng, [75, 55, 101], 22, 26);
    speck(g, rng, [108, 80, 140], 8, 22);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = 'rgba(130,104,176,.35)';
      g.fillRect(Math.floor(rng() * 14), Math.floor(rng() * 14), 1 + Math.floor(rng() * 2), 1);
    }
  },

  leaves(g, rng) {
    fillNoise(g, rng, [64, 114, 50], 26);
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(rng() * 15), y = Math.floor(rng() * 15);
      const s = 1 + Math.floor(rng() * 2);
      g.fillStyle = rgb(shade([52, 99, 41], (rng() - 0.5) * 30));
      g.fillRect(x, y, s, s);
    }
    for (let i = 0; i < 12; i++) {
      g.fillStyle = 'rgba(118,176,77,.55)';
      g.fillRect(Math.floor(rng() * 15), Math.floor(rng() * 15), 1, 1);
    }
    for (let i = 0; i < 4; i++) {
      g.fillStyle = 'rgba(23,50,24,.65)';
      g.fillRect(Math.floor(rng() * 15), Math.floor(rng() * 15), 2, 2);
    }
  },

  rust(g, rng) {
    fillNoise(g, rng, [132, 83, 55], 28);
    speck(g, rng, [92, 56, 38], 26, 14);
    speck(g, rng, [183, 111, 57], 22, 22);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = 'rgba(72,45,32,.7)';
      g.fillRect(Math.floor(rng() * 14), Math.floor(rng() * 14), 1 + Math.floor(rng() * 2), 1);
    }
    g.fillStyle = 'rgba(56,66,74,.5)';
    g.fillRect(3, 4, 1, 6);
    g.fillRect(11, 8, 1, 5);
  },
};

const TILE_ORDER = [
  'dirt', 'grass_top', 'grass_side', 'stone', 'brick', 'log_top', 'log_side',
  'planks', 'metal', 'sand', 'obsidian', 'leaves', 'rust', 'basalt', 'magma',
  'red_brick', 'hay', 'wire',
];

export function createAtlas() {
  const T = 16, COLS = 8, ROWS = 4;
  const canvas = document.createElement('canvas');
  canvas.width = COLS * T;
  canvas.height = ROWS * T;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;

  const index = {};
  const rng = mulberry32(0xC0FFEE);

  TILE_ORDER.forEach((name, i) => {
    index[name] = i;
    const tile = document.createElement('canvas');
    tile.width = T; tile.height = T;
    const tg = tile.getContext('2d');
    (TILE_PAINTERS[name] || TILE_PAINTERS.stone)(tg, rng);
    const col = i % COLS, row = Math.floor(i / COLS);
    g.drawImage(tile, col * T, row * T);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const inset = 0.0008;
  function uv(name) {
    const i = index[name] ?? 0;
    const col = i % COLS, row = Math.floor(i / COLS);
    const u0 = col / COLS + inset;
    const u1 = (col + 1) / COLS - inset;
    const v1 = 1 - row / ROWS - inset;
    const v0 = 1 - (row + 1) / ROWS + inset;
    return [u0, v0, u1, v1];
  }

  return { texture, canvas, index, uv };
}

// ------------------------------------------------------------
//  Sprite helpers
// ------------------------------------------------------------

export function makeGlowTexture(inner = '255,228,160', outer = '255,150,50', size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${inner},1)`);
  grad.addColorStop(0.22, `rgba(${inner},.8)`);
  grad.addColorStop(0.5, `rgba(${outer},.28)`);
  grad.addColorStop(1, `rgba(${outer},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeSunTexture() {
  return makeGlowTexture('255,250,230', '255,190,110', 256);
}

export function makeMoonTexture(size = 160) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = size * 0.48;
  const cx = size / 2, cy = size / 2;
  const halo = g.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
  halo.addColorStop(0, 'rgba(255,255,255,0)');
  halo.addColorStop(0.85, 'rgba(200,220,255,.18)');
  halo.addColorStop(1, 'rgba(200,220,255,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, size, size);
  g.fillStyle = 'rgb(232,238,248)';
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  const craters = [
    [0.32, 0.36, 0.14], [0.58, 0.28, 0.09], [0.66, 0.58, 0.16],
    [0.38, 0.66, 0.1], [0.5, 0.47, 0.06], [0.22, 0.55, 0.07],
  ];
  for (const [ux, uy, ur] of craters) {
    g.fillStyle = 'rgba(150,164,188,.5)';
    g.beginPath();
    g.arc(cx + (ux - 0.5) * r * 1.7, cy + (uy - 0.5) * r * 1.7, r * ur, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(190,204,228,.35)';
    g.beginPath();
    g.arc(cx + (ux - 0.5) * r * 1.7 - r * 0.02, cy + (uy - 0.5) * r * 1.7 - r * 0.02, r * ur * 0.7, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeFlashTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.translate(32, 32);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, 30);
  grad.addColorStop(0, 'rgba(255,255,230,1)');
  grad.addColorStop(0.35, 'rgba(255,205,110,.9)');
  grad.addColorStop(1, 'rgba(255,140,40,0)');
  g.fillStyle = grad;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = i % 2 === 0 ? 30 : 12;
    g[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export { mulberry32 };
