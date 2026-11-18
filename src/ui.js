import { BLOCKS, INVENTORY_BLOCKS, SLOT, WEAPONS, SHOP, ALIEN_SHOP, ARMOR, ARMOR_SETS, ARMOR_SLOTS, WEAPON_PARTS, WEAPON_PAINTS, WEAPON_UPGRADE } from './config.js';

const $ = (id) => document.getElementById(id);

function drawWeaponIcon(ctx, key) {
  const c = WEAPONS[key];
  if (!c) return;
  const accent = '#' + c.accent.toString(16).padStart(6, '0');
  const body = '#' + c.color.toString(16).padStart(6, '0');
  ctx.save();
  ctx.translate(16, 16);
  if (key === 'pistol') {
    ctx.fillStyle = body; ctx.fillRect(-12, -5, 22, 9);
    ctx.fillStyle = '#1b2028'; ctx.fillRect(-2, 4, 9, 11); ctx.fillRect(7, -4, 6, 4);
    ctx.fillStyle = accent; ctx.fillRect(-9, -3, 12, 2);
  } else if (key === 'smg') {
    ctx.fillStyle = body; ctx.fillRect(-14, -4, 26, 8);
    ctx.fillStyle = '#1b2028'; ctx.fillRect(-4, 4, 7, 11); ctx.fillRect(8, 3, 8, 4);
    ctx.fillStyle = accent; ctx.fillRect(-10, -2, 14, 2);
    ctx.fillStyle = '#39424e'; ctx.fillRect(12, -3, 8, 5);
  } else if (key === 'shotgun') {
    ctx.fillStyle = '#6d4b30'; ctx.fillRect(-14, 0, 28, 5);
    ctx.fillStyle = body; ctx.fillRect(-16, -5, 26, 4);
    ctx.fillStyle = '#3a2b1f'; ctx.fillRect(9, -2, 10, 8);
    ctx.fillStyle = accent; ctx.fillRect(-6, -4, 8, 2);
  } else if (key === 'rifle') {
    ctx.fillStyle = body; ctx.fillRect(-17, -3, 30, 6);
    ctx.fillStyle = '#1b2028'; ctx.fillRect(-19, -4, 8, 8); ctx.fillRect(3, 3, 8, 8);
    ctx.fillStyle = '#2c3540'; ctx.fillRect(-4, -8, 12, 4);
    ctx.fillStyle = accent; ctx.fillRect(8, -2, 8, 2);
  } else if (key === 'ak') {
    ctx.fillStyle = body; ctx.fillRect(-15, -3, 28, 6);
    ctx.fillStyle = '#7a4f2c'; ctx.fillRect(-18, -2, 8, 7); ctx.fillRect(-8, 1, 7, 4);
    ctx.fillStyle = '#1b2028'; ctx.fillRect(0, 3, 7, 11);
    ctx.fillStyle = '#4a3620'; ctx.fillRect(-1, 8, 6, 7);
    ctx.fillStyle = accent; ctx.fillRect(-5, -2, 10, 2);
  } else if (key === 'sniper') {
    ctx.fillStyle = body; ctx.fillRect(-19, -2, 36, 4);
    ctx.fillStyle = '#2c3540'; ctx.fillRect(-6, -9, 15, 4);
    ctx.fillStyle = '#1b2028'; ctx.fillRect(-8, -10, 3, 6); ctx.fillRect(8, -10, 3, 6);
    ctx.fillStyle = '#3a4452'; ctx.fillRect(-19, -1, 7, 8);
    ctx.fillStyle = accent; ctx.fillRect(11, -1, 7, 1);
  } else if (key === 'minigun') {
    ctx.fillStyle = body; ctx.fillRect(-12, -6, 18, 12);
    ctx.fillStyle = '#3a424d'; ctx.fillRect(-4, -4, 18, 8);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i % 2 ? '#8a939e' : '#5c636d';
      ctx.fillRect(9, -4 + i * 3, 12, 2);
    }
    ctx.fillStyle = '#4a4f38'; ctx.fillRect(-15, 2, 8, 7);
    ctx.fillStyle = accent; ctx.fillRect(-8, -7, 12, 2);
  } else if (key === 'laser') {
    ctx.fillStyle = body; ctx.fillRect(-15, -4, 28, 8);
    ctx.fillStyle = '#1b2028'; ctx.fillRect(-17, -3, 6, 9);
    ctx.fillStyle = '#2c3540'; ctx.fillRect(0, -9, 6, 5); ctx.fillRect(9, -9, 6, 5);
    ctx.fillStyle = accent; ctx.fillRect(-6, -2, 21, 2);
    ctx.fillStyle = '#ffd6ff'; ctx.fillRect(12, -1, 7, 2);
  } else if (key === 'plasma') {
    ctx.fillStyle = body; ctx.fillRect(-13, -6, 22, 12);
    ctx.fillStyle = '#1b2028'; ctx.fillRect(-16, -4, 6, 10);
    ctx.fillStyle = accent; ctx.fillRect(-1, -8, 9, 9);
    ctx.fillStyle = '#d8ffe8'; ctx.fillRect(2, -5, 3, 3);
    ctx.fillStyle = '#39424e'; ctx.fillRect(7, 3, 8, 6);
    ctx.fillStyle = accent; ctx.fillRect(9, -3, 10, 2);
  } else if (c.bossOnly) {
    ctx.fillStyle = body;
    ctx.fillRect(-18, -4, 32, 8);
    ctx.fillStyle = '#1b2028';
    ctx.fillRect(-6, 4, 8, 11);
    ctx.fillRect(10, 2, 8, 4);
    ctx.fillStyle = accent;
    ctx.fillRect(-2, -9, 10, 10);
    ctx.fillRect(14, -2, 8, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(1, -6, 3, 3);
  } else if (key === 'knife') {
    ctx.fillStyle = '#c7d2de';
    ctx.beginPath(); ctx.moveTo(-13, 2); ctx.lineTo(11, -4); ctx.lineTo(12, 1); ctx.lineTo(-13, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#eaf3fb'; ctx.fillRect(-9, 0, 16, 1.5);
    ctx.fillStyle = '#6a727d'; ctx.fillRect(10, -5, 3, 8);
    ctx.fillStyle = '#2c2119'; ctx.fillRect(13, -1, 9, 4);
  } else if (key === 'bat') {
    ctx.save(); ctx.rotate(-0.5);
    ctx.fillStyle = '#4a3320'; ctx.fillRect(-16, -2, 10, 4);
    ctx.fillStyle = body; ctx.fillRect(-8, -3, 16, 6);
    ctx.fillStyle = '#b07a45'; ctx.fillRect(6, -4, 10, 8);
    ctx.fillStyle = '#6a4528'; ctx.fillRect(15, -4, 3, 8);
    ctx.fillStyle = '#c7d2de'; ctx.fillRect(8, -4, 1, 3); ctx.fillRect(12, 1, 1, 3);
    ctx.restore();
  } else if (key === 'axe') {
    ctx.save(); ctx.rotate(0.7);
    ctx.fillStyle = '#8a5a33'; ctx.fillRect(-2, -14, 4, 28);
    ctx.fillStyle = '#6b727d'; ctx.fillRect(-13, -15, 14, 9);
    ctx.fillStyle = '#c7d2de'; ctx.fillRect(-15, -15, 4, 9);
    ctx.fillStyle = accent; ctx.fillRect(0, -13, 2, 24);
    ctx.restore();
  } else if (key === 'sword') {
    ctx.save(); ctx.rotate(0.75);
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.moveTo(-2, -16); ctx.lineTo(2, -16); ctx.lineTo(3, 6); ctx.lineTo(-3, 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = accent; ctx.fillRect(-1, -14, 2, 18);
    ctx.fillStyle = '#c9a24a'; ctx.fillRect(-9, 6, 18, 3);
    ctx.fillStyle = '#3a2414'; ctx.fillRect(-2, 9, 4, 8);
    ctx.fillStyle = '#ffd24a'; ctx.fillRect(-3, 17, 6, 3);
    ctx.restore();
  } else if (key === 'sledge') {
    ctx.save(); ctx.rotate(0.7);
    ctx.fillStyle = '#8a5a33'; ctx.fillRect(-2, -10, 4, 26);
    ctx.fillStyle = '#6b727d'; ctx.fillRect(-12, -16, 24, 9);
    ctx.fillStyle = '#c7d2de'; ctx.fillRect(-14, -16, 4, 9); ctx.fillRect(10, -16, 4, 9);
    ctx.fillStyle = '#ffd24a'; ctx.fillRect(-6, -8, 12, 2);
    ctx.restore();
  }
  ctx.restore();
}

function drawPickaxeIcon(ctx) {
  ctx.save();
  ctx.translate(16, 17);
  ctx.rotate(0.65);
  ctx.fillStyle = '#8a5a33';
  ctx.fillRect(-3, -10, 6, 24);
  ctx.fillStyle = '#c3cfda';
  ctx.fillRect(-13, -12, 26, 5);
  ctx.fillStyle = '#eef4fb';
  ctx.fillRect(-13, -12, 5, 5);
  ctx.fillRect(8, -12, 5, 5);
  ctx.restore();
}

function drawMedkitIcon(ctx) {
  ctx.fillStyle = '#e8edf4';
  ctx.fillRect(4, 8, 24, 19);
  ctx.fillStyle = '#ff5468';
  ctx.fillRect(13, 11, 6, 13);
  ctx.fillRect(9, 15, 14, 5);
  ctx.fillStyle = '#9aa6b4';
  ctx.fillRect(12, 5, 8, 5);
}

function drawAmmoIcon(ctx) {
  ctx.fillStyle = '#8d99a9';
  ctx.fillRect(4, 12, 24, 13);
  ctx.fillStyle = '#ffb144';
  ctx.fillRect(7, 14, 18, 3);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? '#ffd98a' : '#ffb144';
    ctx.fillRect(7 + i * 5, 5, 3, 9);
  }
}

function drawArmorIcon(ctx) {
  ctx.save();
  ctx.translate(16, 16);
  ctx.fillStyle = '#4aa8ff';
  ctx.beginPath();
  ctx.moveTo(0, -13); ctx.lineTo(11, -8); ctx.lineTo(9, 7); ctx.lineTo(0, 14);
  ctx.lineTo(-9, 7); ctx.lineTo(-11, -8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8ef0ff';
  ctx.beginPath();
  ctx.moveTo(0, -9); ctx.lineTo(7, -5); ctx.lineTo(5, 5); ctx.lineTo(0, 9);
  ctx.lineTo(-5, 5); ctx.lineTo(-7, -5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1a3454';
  ctx.fillRect(-4, -2, 8, 3);
  ctx.restore();
}

function drawArmorPieceIcon(ctx, set, slot) {
  const cfg = ARMOR_SETS[set];
  if (!cfg) return;
  const body = '#' + cfg.color.toString(16).padStart(6, '0');
  const accent = '#' + cfg.accent.toString(16).padStart(6, '0');
  const dark = 'rgba(0,0,0,.42)';
  ctx.save();
  ctx.translate(16, 16);
  if (slot === 'helmet') {
    ctx.fillStyle = body;
    ctx.fillRect(-11, -10, 22, 14);
    ctx.fillRect(-9, 4, 18, 6);
    ctx.fillStyle = dark;
    ctx.fillRect(-8, -3, 16, 5);
    ctx.fillStyle = accent;
    ctx.fillRect(-11, -11, 22, 2);
    ctx.fillRect(-2, 10, 4, 4);
  } else if (slot === 'chest') {
    ctx.fillStyle = body;
    ctx.fillRect(-7, -10, 14, 22);
    ctx.fillRect(-13, -9, 6, 9);
    ctx.fillRect(7, -9, 6, 9);
    ctx.fillStyle = accent;
    ctx.fillRect(-7, -10, 14, 2);
    ctx.fillRect(-2, -7, 4, 17);
    ctx.fillStyle = dark;
    ctx.fillRect(-7, 8, 14, 4);
  } else {
    ctx.fillStyle = body;
    ctx.fillRect(-9, -11, 7, 23);
    ctx.fillRect(2, -11, 7, 23);
    ctx.fillStyle = accent;
    ctx.fillRect(-9, -11, 7, 2);
    ctx.fillRect(2, -11, 7, 2);
    ctx.fillStyle = dark;
    ctx.fillRect(-9, 7, 7, 4);
    ctx.fillRect(2, 7, 7, 4);
  }
  ctx.restore();
}

export class UI {
  constructor(game) {
    this.game = game;
    this.barsEl = $('enemy-bars');
    this.textsEl = $('float-texts');
    this.hotbarEl = $('hotbar');
    this.hud = $('hud');
    this.healthFill = $('health-fill');
    this.healthBar = document.querySelector('#health-box .h-bar');
    this.healthText = $('health-text');
    this.killsText = $('kills-text');
    this.armorFill = $('armor-fill');
    this.armorText = $('armor-text');
    this.drText = $('dr-text');
    this.setText = $('set-text');
    this.zoneLine = $('zone-line');
    this.zoneName = $('zone-name');
    this.zoneHint = $('zone-hint');
    this.zoneOverlay = $('zone-overlay');
    this.hazardWarning = $('hazard-warning');
    this.invArmor = $('inv-armor');
    this.invArmorSlots = $('inv-armor-slots');
    this.invDr = $('inv-dr');
    this.coinText = $('coin-text');
    this.shop = $('shop');
    this.shopItems = $('shop-items');
    this.shopCoins = $('shop-coins');
    this.bench = $('bench');
    this.benchWeapons = $('bench-weapons');
    this.benchName = $('bench-name');
    this.benchType = $('bench-type');
    this.benchLevel = $('bench-level');
    this.benchStats = $('bench-stats');
    this.benchParts = $('bench-parts');
    this.benchPartsHint = $('bench-parts-hint');
    this.benchPaints = $('bench-paints');
    this.benchUpgrade = $('bench-upgrade');
    this.benchCoins = $('bench-coins');
    this.alienItems = $('alien-items');
    this.alienCoins = $('alien-coins');
    this.ammoMag = $('ammo-mag');
    this.ammoRes = $('ammo-res');
    this.weaponName = $('weapon-name');
    this.weaponType = $('weapon-type');
    this.reloadHint = $('reload-hint');
    this.waveTitle = $('wave-title');
    this.waveSub = $('wave-sub');
    this.waveTimer = $('wave-timer');
    this.waveKicker = $('wave-kicker');
    this.waveBox = $('wave-box');
    this.bossBox = $('boss-box');
    this.bossFill = $('boss-fill');
    this.bossName = $('boss-name');
    this.minimap = $('minimap');
    this.mctx = this.minimap.getContext('2d');
    this.chestCount = $('chest-count');
    this.compass = $('compass-hint');
    this.feedEl = $('loot-feed');
    this.promptEl = $('prompt');
    this.bannerEl = $('banner');
    this.bannerKicker = $('banner-kicker');
    this.bannerTitle = $('banner-title');
    this.bannerSub = $('banner-sub');
    this.dmg = $('dmg-vignette');
    this.heal = $('heal-vignette');
    this.lowHp = $('low-hp');
    this.muzzleEl = $('muzzle-flash');
    this.ring = $('mine-ring');
    this.crosshair = $('crosshair');
    this.hit = $('hitmarker');
    this.help = $('help');
    this.hints = $('hints');
    this.friendBox = $('friend-box');
    this.friendName = $('friend-name');
    this.friendHp = $('friend-hp');
    this.friendFill = $('friend-fill');
    this.inv = $('inventory');
    this.invHotbar = $('inv-hotbar');
    this.invBlocks = $('inv-blocks');
    this.invWeapons = $('inv-weapons');
    this.invCons = $('inv-cons');
    this.invAmmo = $('inv-ammo');
    this.invHint = $('inv-hint');
    this.invRemote = $('inv-remote');
    this.slotEls = [];
    this.mapTimer = 0;
    this.bannerTimer = null;
    this.feedCount = 0;
    this.buildHotbar();
  }

  buildHotbar() {
    this.hotbarEl.innerHTML = '';
    this.slotEls = [];
    for (let i = 0; i < 9; i++) {
      const d = document.createElement('div');
      d.className = 'slot';
      d.innerHTML = `<span class="num">${i + 1}</span><canvas width="32" height="32"></canvas><span class="cnt"></span><span class="weapon-tag"></span>`;
      this.hotbarEl.appendChild(d);
      this.slotEls.push({
        el: d, canvas: d.querySelector('canvas'),
        ctx: d.querySelector('canvas').getContext('2d'),
        cnt: d.querySelector('.cnt'), tag: d.querySelector('.weapon-tag'),
        iconKey: '',
      });
    }
  }

  drawBlockIcon(ctx, id) {
    const atlas = this.game.world.atlas;
    const def = BLOCKS[id];
    if (!def || !atlas) return;
    const tile = def.tiles.all || def.tiles.side;
    const i = atlas.index[tile];
    const T = 16;
    const col = i % 8, row = Math.floor(i / 8);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 32, 32);
    ctx.drawImage(atlas.canvas, col * T, row * T, T, T, 0, 0, 32, 32);
    // subtle 3d edge
    const grd = ctx.createLinearGradient(0, 0, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,.16)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0)');
    grd.addColorStop(1, 'rgba(0,0,0,.3)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 32, 32);
    ctx.strokeStyle = 'rgba(0,0,0,.35)';
    ctx.strokeRect(0.5, 0.5, 31, 31);
  }

  updateHotbar(player) {
    for (let i = 0; i < 9; i++) {
      const s = this.slotEls[i];
      let key = '';
      let count = '';
      let tag = '';
      let empty = false;
      if (i === SLOT.PICKAXE) {
        key = 'pickaxe';
        tag = 'КИРКА';
      } else if (i >= SLOT.BLOCK0 && i <= SLOT.BLOCK4) {
        const id = player.hotbarBlocks[i - SLOT.BLOCK0];
        if (id) {
          key = 'block' + id;
          count = player.infiniteBlocks ? '∞' : String(player.blocks[id] || 0);
          empty = !(player.blocks[id] > 0);
        } else {
          key = 'emptyBlock';
          count = '';
          tag = 'ПУСТО';
          empty = true;
        }
      } else if (i === SLOT.PRIMARY || i === SLOT.SECONDARY) {
        const w = i === SLOT.PRIMARY ? player.slots.primary : player.slots.secondary;
        if (w) {
          key = 'weapon:' + w;
          tag = WEAPONS[w].name;
          count = WEAPONS[w].melee ? '' : String(player.mag[w] ?? 0);
        } else {
          key = 'emptyWeapon';
          tag = '—';
          empty = true;
        }
      } else if (i === SLOT.MEDKIT) {
        key = 'medkit';
        count = String(player.medkits);
        tag = 'АПТЕЧКА';
        empty = player.medkits <= 0;
      }
      s.el.classList.toggle('active', player.slot === i);
      s.el.classList.toggle('empty', empty);
      s.cnt.textContent = count;
      s.tag.textContent = tag;
      if (s.iconKey !== key) {
        s.iconKey = key;
        s.ctx.clearRect(0, 0, 32, 32);
        if (key === 'pickaxe') drawPickaxeIcon(s.ctx);
        else if (key.startsWith('block')) this.drawBlockIcon(s.ctx, Number(key.slice(5)));
        else if (key.startsWith('weapon:')) drawWeaponIcon(s.ctx, key.slice(7));
        else if (key === 'medkit') drawMedkitIcon(s.ctx);
        else if (key === 'emptyBlock') {
          s.ctx.strokeStyle = 'rgba(255,255,255,.18)';
          s.ctx.lineWidth = 1.5;
          s.ctx.setLineDash([3, 3]);
          s.ctx.strokeRect(5.5, 5.5, 21, 21);
          s.ctx.setLineDash([]);
          s.ctx.fillStyle = 'rgba(255,255,255,.28)';
          s.ctx.fillRect(14.5, 9, 3, 14);
          s.ctx.fillRect(9, 14.5, 14, 3);
        } else {
          s.ctx.fillStyle = 'rgba(255,255,255,.12)';
          s.ctx.font = 'bold 16px monospace';
          s.ctx.textAlign = 'center';
          s.ctx.fillText('·', 16, 21);
        }
      }
    }
  }

  updateHealth(player) {
    const hp = Math.ceil(player.hp);
    const kills = this.game.kills;
    const armor = Math.ceil(player.armor || 0);
    const dr = Math.round((player.armorReduction || 0) * 100);
    const hasArmor = Object.values(player.armorEquip || {}).some(Boolean);
    const setName = player.equippedSet ? ARMOR_SETS[player.equippedSet].full : hasArmor ? 'МИКС' : 'НЕТ';
    if (this._lastHp === hp && this._lastKills === kills && this._lastArmor === armor &&
        this._lastDr === dr && this._lastSet === setName) return;
    this._lastHp = hp;
    this._lastKills = kills;
    this._lastArmor = armor;
    this._lastDr = dr;
    this._lastSet = setName;
    const pct = Math.max(0, player.hp / player.maxHp) * 100;
    this.healthFill.style.width = pct + '%';
    this.healthText.textContent = hp;
    this.healthBar.classList.toggle('low', pct <= 35);
    this.lowHp.style.opacity = pct <= 30 ? '1' : '0';
    this.killsText.textContent = kills;
    if (this.armorFill) {
      this.armorFill.style.width = Math.max(0, Math.min(100, (player.armor / (player.maxArmor || 100)) * 100)) + '%';
      this.armorText.textContent = armor;
    }
    if (this.drText) this.drText.textContent = dr + '%';
    if (this.setText) {
      this.setText.textContent = setName;
      this.setText.title = setName;
    }
  }

  updateCoins(coins) {
    if (!this.coinText) return;
    if (this._lastCoins === coins) return;
    this._lastCoins = coins;
    this.coinText.textContent = coins;
    if (this.shopCoins) this.shopCoins.textContent = coins;
    if (this.benchCoins) this.benchCoins.textContent = coins;
    if (this.alienCoins) this.alienCoins.textContent = coins;
  }

  setAmmo(player) {
    let sig;
    if (player.isWeaponSlot) {
      const key = player.weaponKey;
      sig = `w:${player.slot}:${key}:${player.mag[key]}:${player.reserve[key]}`;
    } else if (player.slot === SLOT.PICKAXE) {
      sig = 'pick';
    } else if (player.slot === SLOT.MEDKIT) {
      sig = `med:${player.medkits}`;
    } else {
      const id = player.hotbarBlocks[player.slot - SLOT.BLOCK0];
      sig = `blk:${player.slot}:${id}:${id ? player.blocks[id] : 0}`;
    }
    if (this._ammoSig === sig) return;
    this._ammoSig = sig;
    if (player.isWeaponSlot) {
      const cfg = player.weaponCfg;
      const key = player.weaponKey;
      this.weaponType.textContent = cfg.type;
      this.weaponName.textContent = cfg.name;
      if (cfg.melee) {
        this.ammoMag.textContent = '∞';
        this.ammoRes.textContent = 'без патронов';
      } else if (player.infiniteAmmo) {
        this.ammoMag.textContent = '∞';
        this.ammoRes.textContent = '/ ∞';
      } else {
        this.ammoMag.textContent = player.mag[key] ?? 0;
        this.ammoRes.textContent = '/ ' + (player.reserve[key] ?? 0);
      }
    } else if (player.slot === SLOT.PICKAXE) {
      this.weaponType.textContent = 'ИНСТРУМЕНТ';
      this.weaponName.textContent = 'КИРКА';
      this.ammoMag.textContent = '∞';
      this.ammoRes.textContent = '';
    } else if (player.slot === SLOT.MEDKIT) {
      this.weaponType.textContent = 'МЕДИЦИНА';
      this.weaponName.textContent = 'АПТЕЧКА';
      this.ammoMag.textContent = player.medkits;
      this.ammoRes.textContent = 'шт';
    } else {
      const id = player.hotbarBlocks[player.slot - SLOT.BLOCK0];
      if (!id) {
        this.weaponType.textContent = 'БЛОК';
        this.weaponName.textContent = 'ПУСТОЙ СЛОТ';
        this.ammoMag.textContent = '—';
        this.ammoRes.textContent = '';
        return;
      }
      this.weaponType.textContent = 'БЛОК';
      this.weaponName.textContent = (BLOCKS[id]?.name || '').toUpperCase();
      this.ammoMag.textContent = player.infiniteBlocks ? '∞' : (player.blocks[id] || 0);
      this.ammoRes.textContent = 'шт';
    }
  }

  showReload(on) { this.reloadHint.classList.toggle('hidden', !on); }

  setWave(kicker, title, sub, timeText, danger = false) {
    const sig = kicker + '|' + title + '|' + sub + '|' + timeText + '|' + danger;
    if (this._waveSig === sig) return;
    this._waveSig = sig;
    this.waveKicker.textContent = kicker;
    this.waveTitle.textContent = title;
    this.waveSub.textContent = sub;
    this.waveTimer.textContent = timeText;
    this.waveBox.classList.toggle('danger', danger);
  }

  banner(kicker, title, sub, danger = false, dur = 2800) {
    this.bannerKicker.textContent = kicker;
    this.bannerTitle.textContent = title;
    this.bannerSub.textContent = sub;
    this.bannerEl.classList.remove('hidden');
    this.bannerEl.classList.toggle('danger', danger);
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => this.bannerEl.classList.add('hidden'), dur);
  }

  feed(text, warn = false) {
    const d = document.createElement('div');
    d.className = 'loot-line' + (warn ? ' warn' : '');
    d.innerHTML = text;
    this.feedEl.appendChild(d);
    while (this.feedEl.children.length > 6) this.feedEl.removeChild(this.feedEl.firstChild);
    setTimeout(() => {
      d.style.transition = 'opacity .35s, transform .35s';
      d.style.opacity = '0';
      d.style.transform = 'translateX(-10px)';
      setTimeout(() => d.remove(), 360);
    }, 3800);
  }

  damageFlash(k = 0.6) {
    this.dmg.style.transition = 'none';
    this.dmg.style.opacity = String(Math.min(1, k));
    requestAnimationFrame(() => {
      this.dmg.style.transition = 'opacity .45s';
      this.dmg.style.opacity = '0';
    });
  }

  healFlash() {
    this.heal.style.transition = 'none';
    this.heal.style.opacity = '.65';
    requestAnimationFrame(() => {
      this.heal.style.transition = 'opacity .7s';
      this.heal.style.opacity = '0';
    });
  }

  muzzle() {
    this.muzzleEl.style.transition = 'none';
    this.muzzleEl.style.opacity = '.7';
    requestAnimationFrame(() => {
      this.muzzleEl.style.transition = 'opacity .09s';
      this.muzzleEl.style.opacity = '0';
    });
  }

  hitmarker(head = false) {
    this.hit.classList.add('show');
    this.hit.classList.toggle('head', head);
    clearTimeout(this._hitT);
    this._hitT = setTimeout(() => this.hit.classList.remove('show'), 90);
  }

  setMineProgress(p) {
    if (p <= 0.01) {
      if (this._mineShown) {
        this._mineShown = false;
        this._minePct = -1;
        this.ring.classList.remove('show');
      }
      return;
    }
    const pct = Math.min(100, Math.round(p * 100));
    if (this._minePct === pct) return;
    this._minePct = pct;
    this._mineShown = true;
    this.ring.classList.add('show');
    this.ring.style.setProperty('--p', pct + '%');
  }

  setPrompt(text) {
    if (!text) { this.promptEl.classList.add('hidden'); return; }
    this.promptEl.classList.remove('hidden');
    this.promptEl.querySelector('span').textContent = text;
  }

  showBoss(name, pct) {
    const w = Math.max(0, pct * 100);
    const sig = name + ':' + w.toFixed(1);
    if (this._bossSig === sig) return;
    this._bossSig = sig;
    this.bossBox.classList.remove('hidden');
    this.bossName.textContent = name;
    this.bossFill.style.width = w + '%';
  }
  hideBoss() {
    if (this._bossSig === 'hidden') return;
    this._bossSig = 'hidden';
    this.bossBox.classList.add('hidden');
  }

  updateChests(total, looted) {
    const sig = total + ':' + looted;
    if (this._chestSig === sig) return;
    this._chestSig = sig;
    this.chestCount.textContent = `${looted} / ${total}`;
  }

  updateCompass(text) {
    if (this._compassText === text) return;
    this._compassText = text;
    this.compass.innerHTML = text;
    this.compass.style.opacity = text ? '1' : '0';
  }

  showDamageText(x, y, text, cls = '') {
    const d = document.createElement('div');
    d.className = 'ftext ' + cls;
    d.textContent = text;
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    this.textsEl.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  renderInventory(player, targetIndex = 0) {
    if (!this.inv) return;
    const drawEmpty = (ctx) => {
      ctx.strokeStyle = 'rgba(255,255,255,.18)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(5.5, 5.5, 21, 21);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.fillRect(14.5, 9, 3, 14);
      ctx.fillRect(9, 14.5, 14, 3);
    };

    // mini hotbar
    this.invHotbar.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const d = document.createElement('div');
      d.className = 'inv-slot';
      d.innerHTML = `<span class="num">${i + 1}</span><canvas width="32" height="32"></canvas><span class="cnt"></span>`;
      const ctx = d.querySelector('canvas').getContext('2d');
      const cnt = d.querySelector('.cnt');
      let count = '';
      let draw = null;
      if (i === SLOT.PICKAXE) {
        draw = () => drawPickaxeIcon(ctx);
      } else if (i >= SLOT.BLOCK0 && i <= SLOT.BLOCK4) {
        const id = player.hotbarBlocks[i - SLOT.BLOCK0];
        d.dataset.invslot = String(i);
        d.classList.add('targetable');
        if (i - SLOT.BLOCK0 === targetIndex) d.classList.add('target');
        if (id) {
          draw = () => this.drawBlockIcon(ctx, id);
          count = player.infiniteBlocks ? '∞' : String(player.blocks[id] || 0);
          if (!(player.blocks[id] > 0)) d.classList.add('empty');
        } else {
          draw = () => drawEmpty(ctx);
          d.classList.add('empty');
          d.title = 'Пустой слот — выберите блок';
        }
      } else if (i === SLOT.PRIMARY || i === SLOT.SECONDARY) {
        const key = i === SLOT.PRIMARY ? player.slots.primary : player.slots.secondary;
        d.classList.add('locked');
          if (key) {
          draw = () => drawWeaponIcon(ctx, key);
          count = WEAPONS[key].melee ? '' : player.infiniteAmmo ? '∞' : String(player.mag[key] ?? '');
        } else {
          draw = () => drawEmpty(ctx);
          d.classList.add('empty');
        }
      } else if (i === SLOT.MEDKIT) {
        d.classList.add('locked');
        draw = () => drawMedkitIcon(ctx);
        count = String(player.medkits);
        if (!(player.medkits > 0)) d.classList.add('empty');
      }
      if (draw) draw();
      cnt.textContent = count;
      this.invHotbar.appendChild(d);
    }

    const targetId = player.hotbarBlocks[targetIndex];
    this.invHint.innerHTML = `Слот <b>${targetIndex + 2}</b>: <span>${targetId ? BLOCKS[targetId].name : 'пусто'}</span> — выберите блок из списка ниже.`;

    // blocks
    this.invBlocks.innerHTML = '';
    const sourceIds = player.infiniteBlocks ? Object.keys(BLOCKS).map(Number) : INVENTORY_BLOCKS;
    const ids = sourceIds.filter(id => player.infiniteBlocks || (player.blocks[id] || 0) > 0 || player.hotbarBlocks.includes(id));
    if (!ids.length) {
      this.invBlocks.innerHTML = '<div class="inv-empty">Пока нет блоков. Ломайте блоки киркой.</div>';
    }
    for (const id of ids) {
      const count = player.blocks[id] || 0;
      const d = document.createElement('div');
      const badgeIndex = player.hotbarBlocks.indexOf(id);
      d.className = 'inv-item' + (count <= 0 && !player.infiniteBlocks ? ' empty' : '');
      d.dataset.block = String(id);
      d.innerHTML = `<canvas width="32" height="32"></canvas>
        <span class="iname"><b>${BLOCKS[id].name}</b><span>${player.infiniteBlocks ? '∞' : count > 0 ? count + ' шт.' : 'закончились'}</span></span>
        ${badgeIndex >= 0 ? `<span class="badge">${badgeIndex + 2}</span>` : ''}`;
      this.drawBlockIcon(d.querySelector('canvas').getContext('2d'), id);
      this.invBlocks.appendChild(d);
    }

    this.renderArmor(player);

    // weapons
    this.invWeapons.innerHTML = '';
    const wkeys = Object.keys(WEAPONS).filter(k => player.owned[k]);
    if (!wkeys.length) this.invWeapons.innerHTML = '<div class="inv-empty">Оружия нет.</div>';
    for (const key of wkeys) {
      const cfg = WEAPONS[key];
      const d = document.createElement('div');
      d.className = 'inv-weapon';
      const info = cfg.melee
        ? `${cfg.type} · урон ${cfg.dmg} · ближний бой`
        : player.infiniteAmmo
          ? `${cfg.type} · ∞ / ∞`
          : `${cfg.type} · ${player.mag[key] ?? 0} / ${player.reserve[key] ?? 0}`;
      d.innerHTML = `<canvas width="32" height="32"></canvas>
        <span class="wtext"><b>${cfg.name}</b><span>${info}</span></span>`;
      drawWeaponIcon(d.querySelector('canvas').getContext('2d'), key);
      for (const slot of [SLOT.PRIMARY, SLOT.SECONDARY]) {
        const b = document.createElement('button');
        b.className = 'wslot-btn';
        b.textContent = String(slot - SLOT.PRIMARY + 7);
        b.dataset.weapon = key;
        b.dataset.wslot = String(slot);
        const equipped = slot === SLOT.PRIMARY ? player.slots.primary === key : player.slots.secondary === key;
        if (equipped) b.classList.add('active');
        b.title = equipped ? 'Уже экипировано' : `Экипировать в слот ${slot - SLOT.PRIMARY + 7}`;
        d.appendChild(b);
      }
      this.invWeapons.appendChild(d);
    }

    // consumables
    this.invCons.innerHTML = '';
    const med = document.createElement('div');
    med.className = 'inv-item' + (player.medkits > 0 ? '' : ' empty');
    med.innerHTML = `<canvas width="32" height="32"></canvas>
      <span class="iname"><b>Аптечка</b><span>${player.medkits} шт. · слот 9</span></span>`;
    drawMedkitIcon(med.querySelector('canvas').getContext('2d'));
    this.invCons.appendChild(med);

    if (player.bossScrolls > 0 || player.sandbox) {
      const infinite = player.sandbox || player.bossScrolls === Infinity;
      const scroll = document.createElement('div');
      scroll.className = 'inv-item';
      scroll.innerHTML = `<canvas width="32" height="32"></canvas>
        <span class="iname"><b>Свиток перемещения</b><span>${infinite ? '∞ · клавиша T' : `${player.bossScrolls} шт. · T`}</span></span>`;
      const sc = scroll.querySelector('canvas').getContext('2d');
      sc.fillStyle = '#f0e2b8';
      sc.fillRect(9, 8, 14, 16);
      sc.fillStyle = '#7a4f2c';
      sc.fillRect(7, 5, 18, 3);
      sc.fillRect(7, 24, 18, 3);
      sc.fillStyle = '#ffb144';
      sc.fillRect(14, 14, 4, 4);
      this.invCons.appendChild(scroll);
    }

    // ammo
    this.invAmmo.innerHTML = '';
    for (const key of wkeys) {
      const cfg = WEAPONS[key];
      if (cfg.melee) continue;
      const row = document.createElement('div');
      row.innerHTML = `<span>${cfg.name}</span><b>${player.infiniteAmmo ? '∞' : `${player.reserve[key] ?? 0} + ${player.mag[key] ?? 0}`}</b>`;
      this.invAmmo.appendChild(row);
    }
    if (!this.invAmmo.children.length) this.invAmmo.innerHTML = '<div class="inv-empty">—</div>';
  }

  renderArmor(player) {
    if (!this.invArmor) return;
    const dr = player.armorTotalDr ? player.armorTotalDr() : Math.round((player.armorReduction || 0) * 100);
    if (this.invDr) this.invDr.textContent = dr + '%';

    this.invArmorSlots.innerHTML = '';
    for (const slot of Object.keys(ARMOR_SLOTS)) {
      const key = player.armorEquip[slot];
      const box = document.createElement('div');
      box.className = 'inv-aslot' + (key ? ' filled' : '');
      let name = '—';
      let pieceDr = '';
      if (key) {
        const [set] = key.split(':');
        const cfg = ARMOR_SETS[set];
        if (cfg) {
          name = cfg.full;
          pieceDr = `+${cfg.dr[slot] || 0}%`;
        }
      }
      box.innerHTML = `<span class="alabel">${ARMOR_SLOTS[slot].name}</span>
        <span class="aset">${name}</span>
        <span class="adr">${pieceDr}</span>`;
      this.invArmorSlots.appendChild(box);
    }

    this.invArmor.innerHTML = '';
    const keys = Object.keys(player.armorOwned).filter(k => (player.armorOwned[k] || 0) > 0);
    if (!keys.length) {
      this.invArmor.innerHTML = '<div class="inv-empty">Броня пока не выпадала. Ищите части с мобов и в сундуках.</div>';
      return;
    }
    const roman = ['', 'I', 'II', 'III', 'IV', 'V'];
    keys.sort((a, b) => {
      const ea = player.isArmorEquipped(a) ? 1 : 0;
      const eb = player.isArmorEquipped(b) ? 1 : 0;
      if (ea !== eb) return eb - ea;
      const ca = ARMOR_SETS[a.split(':')[0]];
      const cb = ARMOR_SETS[b.split(':')[0]];
      return (cb?.rarity || 0) - (ca?.rarity || 0);
    });
    for (const key of keys) {
      const [set, slot] = key.split(':');
      const cfg = ARMOR_SETS[set];
      if (!cfg) continue;
      const equipped = player.isArmorEquipped(key);
      const count = player.armorOwned[key];
      const d = document.createElement('div');
      d.className = 'inv-item' + (equipped ? ' equipped' : '');
      d.dataset.armor = key;
      d.title = equipped ? 'Снять броню' : 'Надеть броню';
      d.innerHTML = `<canvas width="32" height="32"></canvas>
        <span class="iname"><b>${ARMOR_SLOTS[slot].name} · ${cfg.name}</b>
        <span>+${cfg.dr[slot] || 0}% защиты · редкость ${roman[cfg.rarity] || cfg.rarity}${count > 1 ? ` · x${count}` : ''}</span></span>
        <span class="dr">${equipped ? 'СНЯТЬ' : 'НАДЕТЬ'}</span>`;
      drawArmorPieceIcon(d.querySelector('canvas').getContext('2d'), set, slot);
      this.invArmor.appendChild(d);
    }
  }

  renderShop(player) {
    if (!this.shopItems) return;
    this.shopItems.innerHTML = '';
    this.shopCoins.textContent = player.coins;
    const addCard = (key, name, desc, price, icon, opts = {}) => {
      const d = document.createElement('div');
      d.className = 'shop-item' + (opts.owned ? ' owned' : '');
      const soldOut = opts.owned || opts.maxed || player.coins < price;
      d.innerHTML = `<canvas width="32" height="32"></canvas>
        <span class="sinfo"><b>${name}</b><span>${desc}</span></span>
        <span class="price">◈ ${price}</span>
        <button class="buy-btn" data-shop="${key}" ${soldOut ? 'disabled' : ''}>${opts.owned ? 'ЕСТЬ' : opts.maxed ? 'МАКС.' : 'КУПИТЬ'}</button>`;
      const ctx = d.querySelector('canvas').getContext('2d');
      if (icon === 'ammo') drawAmmoIcon(ctx);
      else if (icon === 'medkit') drawMedkitIcon(ctx);
      else if (icon === 'armor') drawArmorIcon(ctx);
      else drawWeaponIcon(ctx, icon);
      this.shopItems.appendChild(d);
    };

    addCard('ammo', SHOP.ammo.name, SHOP.ammo.desc, SHOP.ammo.price, 'ammo');
    addCard('medkit', SHOP.medkit.name, SHOP.medkit.desc, SHOP.medkit.price, 'medkit', { maxed: player.medkits >= 9 });
    addCard('armor', SHOP.armor.name,
      `Щит ${Math.round(player.armor)} / ${player.maxArmor}. Поглощает ${Math.round(ARMOR.absorb * 100)}% урона`,
      SHOP.armor.price, 'armor', { maxed: player.armor >= player.maxArmor });
    for (const [key, entry] of Object.entries(SHOP.weapons)) {
      const cfg = WEAPONS[key];
      const owned = !!player.owned[key];
      const desc = cfg.melee
        ? `${cfg.type} · урон ${cfg.dmg} · дальность ${cfg.range} · без патронов`
        : `${cfg.type} · урон ${cfg.dmg}${cfg.pellets > 1 ? '×' + cfg.pellets : ''} · магазин ${cfg.mag}`;
      addCard(`weapon:${key}`, cfg.name, desc, entry.price, key, { owned });
    }
  }

  renderAlienShop(player) {
    if (!this.alienItems) return;
    this.alienItems.innerHTML = '';
    if (this.alienCoins) this.alienCoins.textContent = player.coins;
    for (const [key, entry] of Object.entries(ALIEN_SHOP)) {
      const cfg = WEAPONS[key];
      if (!cfg) continue;
      const owned = !!player.owned[key];
      const d = document.createElement('div');
      d.className = 'shop-item' + (owned ? ' owned' : '');
      const soldOut = owned || player.coins < entry.price;
      d.innerHTML = `<canvas width="32" height="32"></canvas>
        <span class="sinfo"><b>${cfg.name}</b><span>${cfg.type} · урон ${cfg.dmg} · магазин ${cfg.mag}</span></span>
        <span class="price">◈ ${entry.price}</span>
        <button class="buy-btn" data-alien="${key}" ${soldOut ? 'disabled' : ''}>${owned ? 'ЕСТЬ' : 'КУПИТЬ'}</button>`;
      drawWeaponIcon(d.querySelector('canvas').getContext('2d'), key);
      this.alienItems.appendChild(d);
    }
  }

  renderBench(player, key) {
    if (!this.benchWeapons) return;
    if (!key || !WEAPONS[key]) key = player.slots.primary || 'pistol';
    const base = WEAPONS[key];
    const cfg = player.getEffectiveWeapon ? player.getEffectiveWeapon(key) : base;
    const melee = !!base.melee;
    this.benchCoins.textContent = player.coins;

    this.benchWeapons.innerHTML = '';
    const keys = Object.keys(WEAPONS).filter(k => player.owned[k]);
    for (const k of keys) {
      const d = document.createElement('button');
      d.className = 'bench-witem' + (k === key ? ' active' : '');
      d.dataset.benchWeapon = k;
      d.innerHTML = `<canvas width="32" height="32"></canvas><span>${WEAPONS[k].name}</span>`;
      drawWeaponIcon(d.querySelector('canvas').getContext('2d'), k);
      this.benchWeapons.appendChild(d);
    }

    this.benchName.textContent = base.name;
    this.benchType.textContent = base.type;
    const lvl = player.weaponUpgradeLevel ? player.weaponUpgradeLevel(key) : 0;
    this.benchLevel.textContent = `${lvl} / ${WEAPON_UPGRADE.maxLevel}`;

    const stat = (label, value) => `<div class="bench-stat"><span>${label}</span><b>${value}</b></div>`;
    this.benchStats.innerHTML = melee
      ? stat('УРОН', cfg.dmg) + stat('ДАЛЬНОСТЬ', cfg.range) + stat('УРОВЕНЬ', lvl)
      : stat('УРОН', cfg.dmg) + stat('МАГАЗИН', cfg.mag) + stat('ДАЛЬНОСТЬ', cfg.range) +
        stat('РАЗБРОС', (cfg.spread * 1000).toFixed(1)) + stat('ПЕРЕЗАРЯДКА', cfg.reload.toFixed(2)) + stat('ПРИЦЕЛ', cfg.zoom ? '×' + cfg.zoom.toFixed(2) : '—');

    this.benchParts.innerHTML = '';
    const totalParts = Object.values(player.weaponParts || {}).reduce((a, b) => a + b, 0);
    if (this.benchPartsHint) this.benchPartsHint.textContent = `в инвентаре: ${totalParts}`;
    if (melee) {
      this.benchParts.innerHTML = '<div class="inv-empty">Для ближнего боя части не используются. Можно красить и улучшать.</div>';
    } else {
      for (const [id, part] of Object.entries(WEAPON_PARTS)) {
        const count = player.partCount ? player.partCount(id) : 0;
        const attached = player.hasWeaponAttachment ? player.hasWeaponAttachment(key, id) : false;
        const d = document.createElement('button');
        d.className = 'bench-part' + (attached ? ' attached' : '') + (!count && !attached ? ' empty' : '');
        d.dataset.benchPart = id;
        d.innerHTML = `<b>${part.name}</b><span>${part.desc}</span>
          <span class="count">${attached ? 'СНЯТЬ' : count > 0 ? '× ' + count : 'НЕТ'}</span>`;
        this.benchParts.appendChild(d);
      }
    }

    this.benchPaints.innerHTML = '';
    for (const paint of WEAPON_PAINTS) {
      const active = (player.weaponPaint[key] || 'stock') === paint.id;
      const d = document.createElement('button');
      d.className = 'bench-paint' + (active ? ' active' : '');
      d.dataset.benchPaint = paint.id;
      d.title = `${paint.name}${paint.price ? ' · ◈ ' + paint.price : ' · бесплатно'}`;
      const sw = paint.color != null ? '#' + paint.color.toString(16).padStart(6, '0') : '#8a9099';
      d.innerHTML = `<i style="--sw:${sw}"></i><small>${paint.price || '0'}</small>`;
      this.benchPaints.appendChild(d);
    }

    const cost = player.weaponUpgradeCost ? player.weaponUpgradeCost(key) : null;
    this.benchUpgrade.textContent = cost === null ? 'МАКС. УРОВЕНЬ' : `УЛУЧШИТЬ · ◈ ${cost}`;
    this.benchUpgrade.disabled = cost === null || player.coins < cost;
  }

  setHudVisible(v) { this.hud.classList.toggle('hidden', !v); }

  setZone(name, hint = '', cls = '') {
    const sig = name + '|' + hint + '|' + cls;
    if (this._zoneSig === sig) return;
    this._zoneSig = sig;
    if (this.zoneName) this.zoneName.textContent = name;
    if (this.zoneHint) this.zoneHint.textContent = hint;
    if (this.zoneLine) this.zoneLine.className = 'zone-line' + (cls ? ' ' + cls : '');
    if (this.zoneOverlay) this.zoneOverlay.className = cls || '';
  }

  setHazard(text, cls = '') {
    if (!this.hazardWarning) return;
    const sig = (text || '') + '|' + cls;
    if (this._hazardSig === sig) return;
    this._hazardSig = sig;
    this.hazardWarning.textContent = text || '';
    this.hazardWarning.className = text ? cls : 'hidden';
  }

  setFriend(name, hp, maxHp, alive, connected = true) {
    if (!this.friendBox) return;
    if (!connected) {
      if (this._friendSig !== 'off') { this._friendSig = 'off'; this.friendBox.classList.add('hidden'); }
      return;
    }
    const hpR = Math.max(0, Math.round(hp));
    const sig = `${name}|${hpR}|${alive}`;
    if (this._friendSig === sig) return;
    this._friendSig = sig;
    this.friendBox.classList.remove('hidden');
    this.friendName.textContent = name;
    this.friendHp.textContent = alive ? String(hpR) : 'DOWN';
    this.friendFill.style.width = alive ? Math.max(0, Math.min(100, (hp / (maxHp || 100)) * 100)) + '%' : '0%';
    this.friendBox.classList.toggle('down', !alive);
  }

  hideFriend() {
    this._friendSig = 'off';
    this.friendBox?.classList.add('hidden');
  }

  toggleHelp(force) {
    const show = force !== undefined ? force : this.help.classList.contains('hidden');
    this.help.classList.toggle('hidden', !show);
    if (show && document.pointerLockElement) document.exitPointerLock();
    return show;
  }

  updateMinimap(player, dt) {
    this.mapTimer += dt;
    if (this.mapTimer < 0.12) return;
    this.mapTimer = 0;
    const ctx = this.mctx;
    const S = 220;
    const sx = S / this.game.world.SX;
    const sz = S / this.game.world.SZ;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#0a1018';
    ctx.fillRect(0, 0, S, S);
    const map = this.game.world.makeMapCanvas();
    ctx.globalAlpha = 0.9;
    ctx.drawImage(map, 0, 0, S, S);
    ctx.globalAlpha = 1;

    // outpost markers
    for (const s of this.game.world.sites) {
      const x = s.x * sx, y = s.z * sz;
      ctx.fillStyle = 'rgba(220,235,255,.28)';
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }

    // chests
    const t = this.game.time;
    for (const c of this.game.chests) {
      if (c.data.looted) continue;
      const x = (c.data.x + 0.5) * sx, y = (c.data.z + 0.5) * sz;
      const pulse = 0.5 + Math.abs(Math.sin(t * 2.2)) * 0.5;
      ctx.strokeStyle = `rgba(255,197,90,${0.35 + pulse * 0.25})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y, 4 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffc85a';
      ctx.fillRect(x - 1.6, y - 1.6, 3.2, 3.2);
    }

    // airship
    if (this.game.world?.airship) {
      const a = this.game.world.airship;
      const x = a.x * sx, y = a.z * sz;
      ctx.strokeStyle = 'rgba(142,240,255,.8)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(x, y, 7, 3.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#8ef0ff';
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }

    // alien trader
    if (this.game.alien) {
      const ap = this.game.alien.pos;
      const x = ap.x * sx, y = ap.z * sz;
      ctx.fillStyle = '#8affd0';
      ctx.beginPath();
      ctx.ellipse(x, y, 5.5, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2c4a46';
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }

    // merchant
    if (this.game.merchant) {
      const x = this.game.merchant.pos.x * sx, y = this.game.merchant.pos.z * sz;
      const pulse = 0.5 + Math.abs(Math.sin(t * 2.6)) * 0.5;
      ctx.strokeStyle = `rgba(255,210,74,${0.4 + pulse * 0.35})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 5 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(-2.6, -2.6, 5.2, 5.2);
      ctx.fillStyle = '#8e5bff';
      ctx.fillRect(-1.2, -1.2, 2.4, 2.4);
      ctx.restore();
    }

    // mobs
    for (const m of this.game.mobs) {
      if (m.dead) continue;
      const x = m.pos.x * sx, y = m.pos.z * sz;
      ctx.fillStyle = m.cfg.boss ? '#ff2d55' : m.cfg.flying ? '#ff9a55' : '#ff5468';
      ctx.beginPath();
      ctx.arc(x, y, m.cfg.boss ? 3.4 : 2.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // pickups
    for (const p of this.game.pickups) {
      ctx.fillStyle = p.kind === 'medkit' ? '#6ee79a' : p.kind === 'coin' ? '#ffd24a' : '#8ef0ff';
      ctx.fillRect(p.pos.x * sx - 1, p.pos.z * sz - 1, 2, 2);
    }

    // view cone + player
    const px = player.pos.x * sx, py = player.pos.z * sz;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-player.yaw);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 26);
    grad.addColorStop(0, 'rgba(255,255,255,.24)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 26, -Math.PI / 2 - 0.52, -Math.PI / 2 + 0.52);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6.5);
    ctx.lineTo(4.2, 5);
    ctx.lineTo(0, 2.6);
    ctx.lineTo(-4.2, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();

    // ring
    ctx.strokeStyle = 'rgba(255,177,68,.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 3, 0, Math.PI * 2);
    ctx.stroke();
  }
}
