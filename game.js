const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  backgroundColor: '#0a0a0a',
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  },
  scene: { preload, create, update }
};

new Phaser.Game(config);

// Global vars: p=player, wasd=WASD keys, en=enemies, pr=projectiles, xo=xpOrbs, co=coins, ob=obstacles, wc=weaponChests, uc=upgradeChests, mg=magnets, hd=healthDrops, gr=graphics
let p, wasd, en, pr, xo, co, ob, wc, uc, mg, hd, gr;
// keys=central keyboard registry (mv=movement, mn=menu, ac=actions)
let keys;
// adc=areaDamageCircle, idleTween=player idle animation
let adc = null, idleTween = null;
let gameOver = false, levelingUp = false, selectingWeapon = false, startScreen = true, paused = false, mainMenu = true;
let gameTime = 0, shootTimer = 0, spawnTimer = 0, regenTimer = 0;
let waveTimer = 0, bossTimer = 0;
let nextWaveTime = 30000, nextBossTime = 60000;
let warnAct = false;
let hyperModeActive = false;
let lastOrbSize = 0; // Track orbit ball size to avoid unnecessary updates
let lastAreaRadius = 0; // Track area damage radius to avoid unnecessary style updates
let s;

let sI = 0; // selectedIndex
let m = []; // menu items
let menuKeys = [];
let pulseTween = null;
let pulseOverlay = null;
// ul=upgradedLevels
let ul = {};
let lbData = [];

// Color constants (numeric for Phaser Graphics)
const C = { W: 0xffffff, B: 0x000000, Y: 0xffff00, R: 0xff0000, G: 0x00ff00, Cy: 0x00ffff, O: 0xff8800, P: 0xff00ff, Gr: 0xaaaaaa, Gy: 0x888888, DG: 0x666666, VG: 0x333333, DD: 0x222222, DB: 0x555555, DR: 0x440000 };
// Color constants (string for text)
const CS = { W: '#ffffff', B: '#000000', Y: '#ffff00', R: '#ff0000', G: '#00ff00', Cy: '#00ffff', Gy: '#888888', LG: '#cccccc', Go: '#FFD700', Si: '#C0C0C0', Br: '#CD7F32' };
// Style property shortcuts
const F = 'fontSize', FF = 'fontFamily', A = 'Arial', CO = 'color', STR = 'stroke', STT = 'strokeThickness', FST = 'fontStyle';
// Common strings
const AC = 'active', SSF = 'setScrollFactor', SD = 'setDepth', DS = 'destroy';
// Graphics factory functions (g=graphics reference)
let g;
const fs = (c, a = 1) => g.fillStyle(c, a);
const gt = (k, w, h) => (g.generateTexture(k, w, h), g.clear());
const ls = (w, c, a = 1) => g.lineStyle(w, c, a);
// Ultra-short shape factories (max 3 chars)
const fc = (x, y, r) => g.fillCircle(x, y, r);
const fr = (x, y, w, h) => g.fillRect(x, y, w, h);
const ft = (...a) => g.fillTriangle(...a);
const sr = (x, y, w, h) => g.strokeRect(x, y, w, h);
const lt = (x, y) => g.lineTo(x, y);
const fp = () => g.fillPath();

// Enemy types: n=name, c=color, h=hpMult, s=speedMult, d=damageMult, x=xp, cn=coins, r=dropRate, u=unlockTime
const enemyTypes = [
  { n: 'g', c: C.G, h: 1.0, s: 0.5, d: 1.0, x: 5, cn: 1, r: 0.02, u: 0 },
  { n: 'b', c: 0x0088ff, h: 1.5, s: 0.55, d: 1.2, x: 8, cn: 2, r: 0.03, u: 60000 },
  { n: 'c', c: C.Cy, h: 2.0, s: 1.6, d: 1.4, x: 10, cn: 2, r: 0.035, u: 120000 },
  { n: 'y', c: C.Y, h: 2.5, s: 0.65, d: 1.6, x: 15, cn: 3, r: 0.04, u: 180000 },
  { n: 'o', c: C.O, h: 3.0, s: 0.7, d: 1.8, x: 20, cn: 3, r: 0.045, u: 240000 },
  { n: 'r', c: C.R, h: 4.0, s: 0.8, d: 2.0, x: 25, cn: 4, r: 0.05, u: 300000 },
  { n: 'p', c: C.P, h: 5.0, s: 0.9, d: 2.5, x: 35, cn: 5, r: 0.055, u: 360000 }
];

let unlockedTypes = [];

const iwt = [ // initial weapon types
  // Weapon types: i=id, n=name, d=desc, u=unlocked
  // Projectile: c=count, f=fireRate, m=damage, e=penetration
  { i: 'p', n: 'Projectiles', d: 'Shoots nearest', u: false, c: 1, f: 500, m: 10, e: 0 },
  // Orbit Ball: c=count, r=rotSpeed, a=radius, b=ballRadius, m=damage
  { i: 'o', n: 'Orbit Ball', d: 'Defensive orbit', u: false, c: 2, r: 2, a: 80, b: 8, m: 15 },
  // Area DMG: a=radius, p=dps, t=tickRate, l=lastTick
  { i: 'a', n: 'Area DMG', d: 'Area damage', u: false, a: 75, p: 10, t: 500, l: 0 },
  // Boomerang: c=count, m=damage, s=speed, w=returnSpeed, x=maxDistance, z=size
  { i: 'b', n: 'Boomerang', d: 'Returns', u: false, c: 2, m: 12, s: 350, w: 250, x: 150, z: 1 }
];

let weaponTypes = JSON.parse(JSON.stringify(iwt));

const characters = [
  {
    name: 'Bananza',
    desc: 'Bananas',
    weapon: 'b',
    texture: 'p_b',
    pt: 1, // passiveType: damage
    pv: 1.05, // passiveValue
    passiveDesc: '+5% Daño/niv'
  },
  {
    name: 'Medusin',
    desc: 'Area Damage',
    weapon: 'a',
    texture: 'p_j',
    pt: 2, // passiveType: regen
    pv: 5, // passiveValue
    passiveDesc: '+5 HP/niv'
  },
  {
    name: 'Orb',
    desc: 'Orbs',
    weapon: 'o',
    texture: 'p_o',
    pt: 3, // passiveType: crit
    pv: 0.02, // passiveValue
    passiveDesc: '+2% Crit/niv'
  },
  {
    name: 'Train',
    desc: 'Fast shoots',
    weapon: 'p',
    texture: 'p_t',
    pt: 4, // passiveType: speed
    pv: 1.03, // passiveValue
    passiveDesc: '+3% Vel/niv'
  }
];

let selCh = null;

let orbitingBalls = [];
let orbitAngle = 0;

let boomerangs = [];
let avB = 0;
let bTmr = 0;

const inS = { // initial stats
  hp: 100,
  mH: 100, // maxHp
  sp: 150, // speed
  kb: 10, // knockback
  hR: 0, // hpRegen
  xM: 1.0, // xpMultiplier
  lC: 1.0, // lootChance
  cC: 0.05, // critChance
  cD: 1.5, // critDamage
  xp: 0,
  c: 0, // coins
  lv: 1, // level
  xN: 10, // xpToNext
  k: 0 // enKilled - enemies killed
};

let stats = JSON.parse(JSON.stringify(inS));

let inD = { // initial difficulty
  sR: 500, // spawnRate
  eH: 20, // enemyHp
  eD: 10, // enemyDamage
  eS: 60 // enemySpeed
};

let difficulty = { ...inD };

let ui = { bossData: [] };

function getWeapon(id) {
  return weaponTypes.find(w => w.i === id);
}

// Upgrade factory: t=type (0=add,1=mult,2=multMin), w=weaponId
const u = (id, n, d, ic, ml, t, prop, val, min, w) => ({
  id, name: n, desc: d, icon: ic, maxLevel: ml, weaponId: w,
  apply: () => {
    const tgt = w ? getWeapon(w) : stats;
    if (t === 0) tgt[prop] += val;
    else if (t === 1) tgt[prop] *= val;
    else tgt[prop] = Math.max(min, tgt[prop] * val);
    ul[id] = (ul[id] || 0) + 1;
  }
});

const pUpgrades = [
  u('s', 'Speed', '+15% Move', '👟', 8, 1, 'sp', 1.15), // speed
  { id: 'hp', name: 'Max HP', desc: '+20 Max HP', icon: '❤️', maxLevel: 10, apply: () => { stats.mH += 20; stats.hp += 20; ul.hp = (ul.hp || 0) + 1 } }, // maxHp
  u('kb', 'Knockback', '+30% Enemy', '💨', 6, 1, 'kb', 1.3), // knockback
  u('hr', 'HP Regen', '+10 HP/min', '💚', 10, 0, 'hpRegen', 10),
  u('xp', 'XP Boost', '+0.5x XP', '⭐', 8, 0, 'xpMultiplier', 0.5),
  u('l', 'Luck', '+3% Chest', '🍀', 10, 0, 'lootChance', 0.03),
  u('cc', 'Crit Chance', '+5% Crit', '🎯', 10, 0, 'critChance', 0.05),
  u('cd', 'Crit Damage', '+25% Crit', '💢', 10, 0, 'critDamage', 0.25)
];

const projectileUpgrades = [
  u('ms', 'Multi Shot', '+1 Projectile', '🔫', 10, 0, 'c', 1, 0, 'p'),
  u('fr', 'Fire Rate', '-15% Fire', '⚡', 8, 2, 'f', 0.85, 150, 'p'),
  u('pd', 'Projectile Damage', '+5 Damage', '🗡️', 10, 0, 'm', 5, 0, 'p'),
  u('pn', 'Penetration', '+1 Enemy', '⚔️', 5, 0, 'e', 1, 0, 'p')
];

const orbitingBallUpgrades = [
  u('mb', 'More Balls', '+1 Orb', '⚪', 10, 0, 'c', 1, 0, 'o'),
  u('rs', 'Rotation Speed', '+0.5 Rot', '🌀', 10, 0, 'r', 0.5, 0, 'o'),
  u('bs', 'Ball Size', '+2 Radius', '⭕', 8, 0, 'b', 2, 0, 'o'),
  u('bd', 'Ball Damage', '+8 Damage', '💥', 10, 0, 'm', 8, 0, 'o')
];

const areaDamageUpgrades = [
  u('ar', 'Area Radius', '+15 Range', '🔴', 5, 0, 'a', 15, 0, 'a'),
  u('ad', 'Area DPS', '+3 DPS', '🔥', 10, 0, 'p', 3, 0, 'a'),
  u('at', 'Tick Speed', '-15% Delay', '⚡', 8, 2, 't', 0.85, 150, 'a')
];

const boomerangUpgrades = [
  u('bg', 'Boom Damage', '+8 Damage', '💥', 10, 0, 'm', 8, 0, 'b'),
  u('bz', 'Boom Size', '+30% Size', '📏', 8, 0, 'z', 0.3, 0, 'b'),
  { id: 'bv', name: 'Boom Speed', desc: '+15% Speed', icon: '💨', weaponId: 'b', maxLevel: 8, apply: () => { const w = getWeapon('b'); w.s = w.w *= 1.15; ul.bv = (ul.bv || 0) + 1 } },
  { id: 'bc', name: 'More Booms', desc: '+1 Boom', icon: '🔄', weaponId: 'b', maxLevel: 5, apply: () => { getWeapon('b').c++; avB++; ul.bc = (ul.bc || 0) + 1 } }
];

const rareUpgrades = [
  u('r1', 'Triple Shot', '+3 Proj', '🔫', 2, 0, 'c', 3, 0, 'p'),
  u('r2', 'Rapid Fire', '-40% Fire', '⚡', 3, 2, 'f', 0.6, 100, 'p'),
  u('r3', 'Massive Dmg', '+30 Dmg', '🗡️', 3, 0, 'm', 30, 0, 'p'),
  u('r4', 'Double Balls', '+2 Orbs', '⚪', 2, 0, 'c', 2, 0, 'o'),
  u('r5', 'Mega Ball Dmg', '+25 Dmg', '💥', 3, 0, 'm', 25, 0, 'o'),
  u('r6', 'Huge Area', '+100 Range', '🔴', 2, 0, 'a', 100, 0, 'a'),
  u('r7', 'Devastating DPS', '+15 DPS', '🔥', 3, 0, 'p', 15, 0, 'a')
];

// Helper: create text with common properties
function mkTxt(x, y, t, l, d = 101) { return s.add.text(x, y, t, l).setOrigin(0.5)[SSF](0)[SD](d); }

// Helper: random centering
const r = () => Math.random() - 0.5;

// Helper: create graphics with scroll/depth
const mkGr = (d) => s.add.graphics()[SSF](0)[SD](d);

// Helper: cleanup menu elements
function cleanupMenu(minDepth = 100) {
  s.children.list.filter(c => c.depth >= minDepth).forEach(c => c[DS]());
  menuKeys.forEach(k => k.removeAllListeners());
  menuKeys = [];
  if (pulseTween) { pulseTween.stop(); pulseTween = null; }
  if (pulseOverlay) { pulseOverlay = null; }
}

// Helper: process damage with crit and feedback
function procDmg(enemy, srcX, srcY, baseDmg) {
  if (!enemy[AC]) return false;
  const isCrit = Math.random() < stats.cC; // critChance
  const dmg = isCrit ? baseDmg * stats.cD : baseDmg; // critDamage
  const hp = enemy.getData('hp') - dmg;
  enemy.setData('hp', hp);
  applyDmgFb(enemy, srcX, srcY, isCrit);
  if (hp <= 0) {
    playTone(s, 660, 0.1);
    enemy.body.enable = false;
    handleEnemyDeath(enemy);
    return true;
  }
  return false;
}

// Helper: spawn death particle explosion
function spawnDeathParticles(x, y, color) {
  const emitter = s.add.particles(x, y, 'orb', {
    speed: { min: 30, max: 80 },
    angle: { min: 0, max: 360 },
    scale: { start: 1.0, end: 0 },
    lifespan: 300,
    quantity: 1,
    tint: color
  });
  s.time.delayedCall(400, () => emitter.destroy());
}

// Helper: handle enemy death and drops
function handleEnemyDeath(e) {
  const xp = e.getData('xpValue') || 5;
  const cn = e.getData('coinValue') || 1;
  const iB = e.getData('isBoss');
  const dc = e.getData('dropChance') || 0;
  const color = e.getData('enemyColor') || C.W;

  spawnDeathParticles(e.x, e.y, color);

  dropXP(e.x, e.y, xp);
  if (Math.random() < 0.25) dropCoin(e.x, e.y, cn);
  if (iB) { dropChest(e.x, e.y); dropMagnet(e.x + 40, e.y); }
  else {
    if (Math.random() < dc * stats.lC) dropUpgCh(e.x, e.y); // lootChance
    if (Math.random() < 0.015 * stats.lC) dropMagnet(e.x, e.y);
    if (Math.random() < 0.015 * stats.lC) dropHealthHeal(e.x, e.y);
  }
  e[DS]();
  stats.k++; // enemies killed
}

// Generate high-res boss texture (60x60) to avoid pixelation when scaled
function generateBossTexture(type) {
  const key = `boss_${type.n}`;

  // Return if already cached
  if (s.textures.exists(key)) return key;

  g = s.add.graphics();
  const c = 3; // Scale factor (20x20 -> 60x60)

  // Helper functions scaled 3x
  const ey = (x1, y1, x2, y2) => {
    fs(C.W, 1).fillCircle(x1 * c, y1 * c, 2 * c).fillCircle(x2 * c, y2 * c, 2 * c);
  };
  const tri = (x1, y1, x2, y2, x3, y3) => g.fillTriangle(x1 * c, y1 * c, x2 * c, y2 * c, x3 * c, y3 * c);
  const circ = (x, y, rad) => g.fillCircle(x * c, y * c, rad * c);
  const rect = (x, y, w, h) => g.fillRect(x * c, y * c, w * c, h * c);

  fs(type.c, 1);

  // Draw based on enemy type (same logic as preload)
  if (type.n === 'g') { tri(10, 2, 2, 18, 18, 18); ey(7, 10, 13, 10); }
  else if (type.n === 'b') { tri(10, 2, 2, 10, 10, 18); tri(10, 2, 18, 10, 10, 18); ey(8, 8, 12, 8); }
  else if (type.n === 'c') { circ(10, 10, 9); ey(7, 9, 13, 9); fs(type.c, 0.7); circ(10, 6, 3); }
  else if (type.n === 'y') { rect(3, 3, 14, 14); fs(C.B, 1); ey(7, 8, 13, 8); rect(6, 13, 8, 2); }
  else if (type.n === 'o') { circ(10, 10, 9); tri(10, 1, 7, 8, 13, 8); tri(10, 19, 7, 12, 13, 12); tri(1, 10, 8, 7, 8, 13); tri(19, 10, 12, 7, 12, 13); ey(7, 8, 13, 8); }
  else if (type.n === 'r') { circ(10, 10, 9); tri(3, 5, 5, 2, 7, 5); tri(17, 5, 15, 2, 13, 5); fs(C.R, 1); ey(7, 9, 13, 9); rect(7, 14, 6, 2); }
  else if (type.n === 'p') { rect(4, 6, 12, 10); circ(6, 6, 3); circ(14, 6, 3); fs(C.G, 1); circ(7, 10, 3); circ(13, 10, 3); fs(C.B, 1); ey(7, 10, 13, 10); }

  g.generateTexture(key, 60, 60);
  g.destroy();

  return key;
}

// Perlin Noise implementation for nebula generation
let perm = [];
for (let i = 0; i < 256; i++) perm[i] = i;
perm.sort(r);
for (let i = 0; i < 256; i++) perm[256 + i] = perm[i];
const grad = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];

// Fade function for smooth interpolation
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);

// Linear interpolation
const lerp = (a, b, t) => a + t * (b - a);

// Gradient dot product
function grad2(hash, x, y) {
  const g = grad[hash & 7];
  return g[0] * x + g[1] * y;
}

// Perlin noise 2D
function perlin(x, y) {
  const X = x | 0 & 255;
  const Y = y | 0 & 255;
  x -= x | 0;
  y -= y | 0;
  const u = fade(x);
  const v = fade(y);

  const a = perm[X] + Y;
  const b = perm[X + 1] + Y;

  return lerp(
    lerp(grad2(perm[a], x, y), grad2(perm[b], x - 1, y), u),
    lerp(grad2(perm[a + 1], x, y - 1), grad2(perm[b + 1], x - 1, y - 1), u),
    v
  );
}

// Generate procedural nebula texture
function generateNebula() {
  // Remove old texture if exists
  if (s.textures.exists('nebulaNoise')) {
    s.textures.remove('nebulaNoise');
  }
  const w = 2400, h = 1800;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Color gradient stops: [position, r, g, b, alpha]
  const colors = [
    [0.0, 0, 0, 0, 0],           // Transparent black
    [0.2, 0x33, 0x22, 0x66, 60], // Dark purple
    [0.4, 0x66, 0x00, 0xCC, 120], // Medium purple
    [0.6, 0x99, 0x00, 0xFF, 180], // Bright purple
    [0.8, 0xDD, 0x00, 0xFF, 220], // Neon purple
    [1.0, 0xFF, 0x00, 0xFF, 255]  // Magenta core
  ];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Fractal Brownian Motion (4 octaves)
      let n = 0;
      n += perlin(x / 480, y / 480) * 1.0;
      n += perlin(x / 240, y / 240) * 0.5;
      n += perlin(x / 120, y / 120) * 0.25;
      n += perlin(x / 60, y / 60) * 0.125;
      n = (n + 1.875) / 3.75; // Normalize to 0-1

      // Clamp n to [0, 1]
      n = Math.max(0, Math.min(1, n));

      // Find which two color stops to interpolate between
      let c1, c2, t;
      for (let j = 0; j < colors.length - 1; j++) {
        if (n >= colors[j][0] && n <= colors[j + 1][0]) {
          c1 = colors[j];
          c2 = colors[j + 1];
          // Calculate interpolation factor within this segment
          t = (n - c1[0]) / (c2[0] - c1[0]);
          break;
        }
      }

      const i = (y * w + x) * 4;

      // Interpolate RGB and alpha
      data[i] = lerp(c1[1], c2[1], t);     // R
      data[i + 1] = lerp(c1[2], c2[2], t); // G
      data[i + 2] = lerp(c1[3], c2[3], t); // B
      data[i + 3] = lerp(c1[4], c2[4], t); // A
    }
  }

  ctx.putImageData(imgData, 0, 0);
  s.textures.addCanvas('nebulaNoise', canvas);

  // Create sprite with nebula texture (full resolution, no scaling)
  const nebula = s.add.image(1200, 900, 'nebulaNoise');
  nebula.setScrollFactor(0.05);
  nebula[SD](-20);
}

function preload() {
  // Create simple textures programmatically
  g = this.add.graphics();

  // Player texture (banana shape)
  fs(C.Y, 1);
  g.fillEllipse(16, 16, 10, 24);
  fs(0xffdd00, 1);
  g.fillEllipse(18, 16, 6, 20);
  fs(0x885500, 1);
  fr(14, 4, 4, 6);
  gt('p_b', 32, 32);

  // Medusa/Jellyfish texture
  fs(0xff88dd, 1); // Pink body
  fc(16, 12, 10); // Head/body
  // Tentacles
  fs(0xff88dd, 0.7);
  fr(8, 18, 3, 12);
  fr(13, 20, 3, 10);
  fr(18, 19, 3, 11);
  // Eyes
  fs(C.B, 1);
  fc(12, 11, 2);
  fc(20, 11, 2);
  gt('p_j', 32, 32);

  // Orbe texture (half purple, half blue)
  fs(0xcc00ff, 1); // Purple left half
  g.slice(16, 16, 12, Phaser.Math.DegToRad(90), Phaser.Math.DegToRad(270), false);
  g.fillPath();
  fs(0x0088ff, 1); // Blue right half
  g.slice(16, 16, 12, Phaser.Math.DegToRad(270), Phaser.Math.DegToRad(90), false);
  g.fillPath();
  // Dividing line
  ls(2, C.W, 1);
  g.lineBetween(16, 4, 16, 28);
  // Center glow
  fs(C.W, 0.8);
  fc(16, 16, 4);
  gt('p_o', 32, 32);

  // Bullet Train texture
  fs(0xe0e0e0, 1); // Silver body
  g.fillRoundedRect(6, 10, 20, 12, 3);
  fs(C.W, 1); // White front
  ft(4, 16, 10, 12, 10, 20);
  fs(0x0088ff, 1); // Blue stripe
  fr(8, 15, 18, 2);
  fs(C.R, 1); // Red stripe
  fr(8, 18, 18, 2);
  // Windows
  fs(0x4444ff, 0.7);
  fr(12, 13, 3, 3);
  fr(17, 13, 3, 3);
  fr(22, 13, 3, 3);
  gt('p_t', 32, 32);

  // Boomerang texture
  ls(0);
  fs(0xffaa00, 1); // Orange
  g.beginPath();
  g.moveTo(8, 12);
  lt(8, 4);
  lt(12, 8);
  lt(12, 12);
  g.closePath();
  fp();
  g.beginPath();
  g.moveTo(12, 12);
  lt(20, 12);
  lt(16, 8);
  lt(12, 8);
  g.closePath();
  fp();
  // Outline
  ls(2, 0x884400, 1);
  sr(8, 4, 4, 8);
  sr(12, 8, 8, 4);
  gt('b', 16, 16);

  // Enemy textures (one for each type) - different shapes
  const ey = (x1, y1, x2, y2) => { fs(C.W, 1).fillCircle(x1, y1, 2).fillCircle(x2, y2, 2); };
  const dm = {
    g: () => { ft(10, 2, 2, 18, 18, 18); ey(7, 10, 13, 10); },
    b: () => { ft(10, 2, 2, 10, 10, 18); ft(10, 2, 18, 10, 10, 18); ey(8, 8, 12, 8); },
    c: (col) => { fc(10, 10, 9); ey(7, 9, 13, 9); fs(col, 0.7); fc(10, 6, 3); },
    y: () => { fr(3, 3, 14, 14); fs(C.B, 1); ey(7, 8, 13, 8); fr(6, 13, 8, 2); },
    o: () => { fc(10, 10, 9); ft(10, 1, 7, 8, 13, 8); ft(10, 19, 7, 12, 13, 12); ft(1, 10, 8, 7, 8, 13); ft(19, 10, 12, 7, 12, 13); ey(7, 8, 13, 8); },
    r: () => { fc(10, 10, 9); ft(3, 5, 5, 2, 7, 5); ft(17, 5, 15, 2, 13, 5); fs(C.R, 1); ey(7, 9, 13, 9); fr(7, 14, 6, 2); },
    p: () => { fr(4, 6, 12, 10); fc(6, 6, 3); fc(14, 6, 3); fs(C.G, 1); fc(7, 10, 3); fc(13, 10, 3); fs(C.B, 1); ey(7, 10, 13, 10); }
  };
  enemyTypes.forEach(t => { fs(t.c, 1); dm[t.n](t.c); gt(`enemy_${t.n}`, 20, 20); });

  // Generic orb texture with glow (white for tinting)
  fs(C.W, 0.3);
  fc(6, 6, 7);
  fs(C.W, 1);
  fc(6, 6, 4);
  gt('orb', 12, 12);

  // Health drop texture (red medical cross)
  fs(C.W, 1);
  fc(10, 10, 10);
  fs(C.R, 1);
  fr(8, 4, 4, 12);
  fr(4, 8, 12, 4);
  ls(2, C.W, 1);
  sr(8, 4, 4, 12);
  sr(4, 8, 12, 4);
  gt('healthDrop', 20, 20);

  // Obstacle texture (gray rock)
  fs(C.DB, 1);
  fc(20, 20, 20);
  fs(0x777777, 0.5);
  fc(15, 15, 10);
  gt('obstacle', 40, 40);

  // Generic chest texture (white for tinting)
  fs(0xcccccc, 1);
  fr(3, 8, 14, 12);
  fs(C.W, 1);
  fr(6, 5, 8, 8);
  ls(2, C.W, 1);
  sr(3, 8, 14, 12);
  gt('chest', 20, 20);

  // Magnet texture (horseshoe magnet)
  fs(C.R, 1);
  fr(2, 2, 5, 16);
  fr(2, 14, 16, 4);
  fs(0x0088ff, 1);
  fr(13, 2, 5, 16);
  fs(C.W, 1);
  fc(10, 10, 3);
  gt('magnet', 20, 20);

  // Orbiting ball texture (white ball with glow)
  fs(C.W, 1);
  fc(8, 8, 8);
  fs(0xffffaa, 0.5);
  fc(8, 8, 6);
  gt('o', 16, 16);

  g[DS]();
}

function create() {
  s = this;
  gr = this.add.graphics();

  // Input: Central key registry (initialized early for menus)
  const k = key => this.input.keyboard.addKey(key);
  keys = {
    mv: { // Movement (polling)
      w: k('W'),
      a: k('A'),
      s: k('S'),
      d: k('D')
    },
    mn: { // Menu navigation (events)
      e: k('SPACE'),
      x: k('ESC')
    },
    ac: { // Actions (events)
      p: k('P'),
      r: k('R')
    }
  };

  // Create background (preserved across restarts at depth < 0)
  const rnd = (min, max) => min + Math.random() * (max - min);
  const nc = [0x00ffff, 0xff00ff, 0xffff00];

  // Generate Perlin noise nebula background
  generateNebula();

  // Cyberpunk neon grid background with parallax
  [[200, 0x00ffff, 0.3, 0.2], [120, 0xff00ff, 0.5, 0.5], [80, 0xffff00, 0.4, 0.8]].forEach(([sp, c, a, sf], i) => {
    g = this.add.graphics().lineStyle(1, c, a);
    for (let x = 0; x <= 2400; x += sp) g.lineBetween(x, 0, x, 1800);
    for (let y = 0; y <= 1800; y += sp) g.lineBetween(0, y, 2400, y);
    fs(C.W, a * 1.5);
    for (let x = 0; x <= 2400; x += sp) for (let y = 0; y <= 1800; y += sp) fc(x, y, 2 - i * 0.5);
    g.setScrollFactor(sf)[SD](-10 + i);
  });

  // Scanlines effect
  const sl = this.add.graphics().lineStyle(1, C.W, 0.05);
  for (let y = 0; y < 600; y += 4) sl.lineBetween(0, y, 800, y);
  sl[SSF](0)[SD](-5);

  // Floating neon dots
  const dt = this.add.graphics();
  for (let j = 0; j < 25; j++) {
    dt.fillStyle(nc[~~(Math.random() * 3)], rnd(0.6, 1)).fillCircle(rnd(0, 2400), rnd(0, 1800), rnd(1, 3));
  }
  dt.setScrollFactor(0.6)[SD](-7);

  // Expand world bounds
  this.physics.world.setBounds(0, 0, 2400, 1800);
  this.physics.pause();
  this.time.delayedCall(0, showMainMenu);
  playTone(this, 440, 0.1);
}

// Initialize gameplay elements (called when starting game, not on load)
function initGameplay() {
  // Initialize unlocked types with first type
  unlockedTypes = [enemyTypes[0]];

  // Create physics groups
  const addGrp = () => s.physics.add.group();
  en = addGrp();
  pr = addGrp();
  xo = addGrp();
  co = addGrp();
  wc = addGrp();
  uc = addGrp();
  mg = addGrp();
  hd = addGrp();
  ob = s.physics.add.staticGroup();

  // Spawn obstacles randomly across map
  for (let i = 0; i < 80; i++) {
    ob.create(100 + Math.random() * 2200, 100 + Math.random() * 1600, 'obstacle').setCircle(20);
  }

  // Create player at center of world
  p = s.physics.add.image(1200, 900, 'p');
  p.setCollideWorldBounds(true);
  p.body.setCircle(16);

  // Idle animation for player
  idleTween = s.tweens.add({ targets: p, scaleX: 1.2, scaleY: 1.2, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', paused: true });

  // Camera follows player
  s.cameras.main.startFollow(p);
  s.cameras.main.setBounds(0, 0, 2400, 1800);

  // Backward compat for update() movement logic (keys already initialized in create())
  wasd = { w: keys.mv.w, a: keys.mv.a, s: keys.mv.s, d: keys.mv.d };

  // Collisions
  const ph = s.physics;
  const ov = (a, b, cb) => ph.add.overlap(a, b, cb, null, s);
  ov(pr, en, hitEnemy);
  ov(p, en, hitPlayer);
  ov(p, xo, collectXP);
  ov(p, co, collectCoin);
  ov(p, wc, collectChest);
  ov(p, uc, colUpgCh);
  ov(p, mg, collectMagnet);
  ov(p, hd, colHeal);
  ph.add.collider(en, en);
  ph.add.collider(p, ob);
  ph.add.collider(en, ob);
  ph.add.collider(pr, ob);

  // Create UI
  createUI(s);

  // Keyboard for restart (using central keys)
  keys.ac.r.on('down', () => { if (!startScreen) restartGame(); });

  // Keyboard for pause (using central keys)
  let pauseOverlay = null, pauseText = null, pauseHint = null;
  keys.ac.p.on('down', () => {
    if (!gameOver && !startScreen && !levelingUp && !selectingWeapon) {
      paused = !paused;
      if (paused) {
        s.physics.pause();
        playTone(s, 600, 0.1);
        pauseOverlay = s.add.graphics();
        pauseOverlay.fillStyle(C.B, 0.7).fillRect(0, 0, 800, 600)[SSF](0)[SD](200);
        pauseText = mkTxt(400, 300, 'PAUSED', { [F]: '64px', [FF]: A, [CO]: CS.Y, [STR]: CS.B, [STT]: 8 }, 201);
        pauseHint = mkTxt(400, 370, 'Press [P] to resume', { [F]: '24px', [FF]: A, [CO]: CS.W }, 201);
      } else {
        s.physics.resume();
        playTone(s, 800, 0.1);
        pauseOverlay?.[DS]();
        pauseText?.[DS]();
        pauseHint?.[DS]();
      }
    }
  });
}

function update(_time, delta) {
  if (gameOver || levelingUp || selectingWeapon || startScreen || paused || mainMenu) return;

  gameTime += delta;
  shootTimer += delta;
  spawnTimer += delta;
  regenTimer += delta;

  // HP Regeneration (every 1 second)
  if (regenTimer >= 1000 && stats.hR > 0) { // hpRegen
    regenTimer = 0;
    const healAmount = stats.hR / 60;
    stats.hp = Math.min(stats.mH, stats.hp + healAmount); // maxHp
  }

  // Player movement
  p.body.setVelocity(0, 0);
  let moving = false;

  if (wasd.a.isDown) {
    p.body.setVelocityX(-stats.sp); // speed
    moving = true;
  }
  if (wasd.d.isDown) {
    p.body.setVelocityX(stats.sp); // speed
    moving = true;
  }
  if (wasd.w.isDown) {
    p.body.setVelocityY(-stats.sp); // speed
    moving = true;
  }
  if (wasd.s.isDown) {
    p.body.setVelocityY(stats.sp); // speed
    moving = true;
  }

  // Normalize diagonal movement (only if at least one velocity component is non-zero)
  if (moving && (p.body.velocity.x !== 0 || p.body.velocity.y !== 0)) {
    p.body.velocity.normalize().scale(stats.sp); // speed
  }

  // Handle idle/movement animations
  if (!moving && idleTween && idleTween.paused) {
    idleTween.resume();
  } else if (moving && idleTween && !idleTween.paused) {
    idleTween.pause();
  }

  // Bounce animation when moving
  if (moving) {
    const bouncePhase = (gameTime % 400) / 400;
    p.setScale(1 + Math.sin(bouncePhase * Math.PI * 2) * 0.08);
  }

  // Rotate player based on movement direction
  if (p.body.velocity.x !== 0 || p.body.velocity.y !== 0) {
    const targetAngle = Math.atan2(p.body.velocity.y, p.body.velocity.x);
    const angleDiff = targetAngle - p.rotation;
    const shortestAngle = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
    p.rotation += shortestAngle * 0.15;
  }

  // Limit player velocity to prevent flying bug (max 500 units/sec)
  const maxVel = 500;
  const velMag = Math.sqrt(p.body.velocity.x ** 2 + p.body.velocity.y ** 2);
  if (velMag > maxVel) {
    const scale = maxVel / velMag;
    p.body.setVelocity(p.body.velocity.x * scale, p.body.velocity.y * scale);
  }

  // Auto shoot (projectile weapon)
  const projectileWeapon = getWeapon('p');
  if (projectileWeapon.u && shootTimer >= projectileWeapon.f) {
    shootTimer = 0;
    shoot();
  }

  // Auto shoot (boomerang weapon)
  const boomerangWeapon = getWeapon('b');
  if (boomerangWeapon.u) {
    bTmr += delta;
    if (bTmr >= 200 && avB > 0) {
      bTmr = 0;
      shootBoomerang();
    }
  }

  // Spawn en
  if (spawnTimer >= difficulty.sR) { // spawnRate
    spawnTimer = 0;
    spawnEnemy();
  }

  // Unlock new enemy types based on time
  updUnlockTypes();

  // Activate HYPER MODE at 10 minutes
  if (gameTime >= 600000 && !hyperModeActive) {
    hyperModeActive = true;
    // Detectar si coincide con boss spawn (bossTimer cerca de nextBossTime)
    const isBossTime = bossTimer >= nextBossTime - 1000;
    if (isBossTime) {
      showWarning('🔥💀 HYPER MODE + MEGA BOSS! 💀🔥', C.R);
    } else {
      showWarning('🔥💀 HYPER MODE ACTIVATED 💀🔥', C.R);
    }
    playTone(s, 50, 1.0);
  }

  // Scale difficulty every 30 seconds
  if (~~(gameTime / 30000) > ~~((gameTime - delta) / 30000)) {
    difficulty.sR = Math.max(500, difficulty.sR * 0.9); // spawnRate
    difficulty.eH *= 1.15; // enemyHp
    difficulty.eD *= 1.1; // enemyDamage
    difficulty.eS = Math.min(hyperModeActive ? 9999 : 120, difficulty.eS * 1.05); // enemySpeed
  }

  // HYPER scaling every 20 seconds (only after 10 minutes)
  if (hyperModeActive && ~~(gameTime / 20000) > ~~((gameTime - delta) / 20000)) {
    difficulty.sR = Math.max(50, difficulty.sR * 0.5); // spawnRate
    difficulty.eH *= 1.5; // enemyHp
    difficulty.eD *= 1.2; // enemyDamage
    difficulty.eS *= 1.1; // enemySpeed
  }

  // Wave system (every 60 seconds)
  waveTimer += delta;
  if (waveTimer >= nextWaveTime - 3000 && waveTimer < nextWaveTime && !warnAct) {
    showWarning('⚠️ WAVE INCOMING!', C.Y);
    playTone(s, 600, 0.3);
    warnAct = true;
  }
  if (waveTimer >= nextWaveTime) {
    waveTimer = 0;
    spawnWave();
  }

  // Boss system (every 120 seconds)
  bossTimer += delta;
  if (bossTimer >= nextBossTime - 5000 && bossTimer < nextBossTime && !warnAct) {
    // No mostrar warning de boss si HYPER MODE está a punto de activarse
    const isHyperModeTime = gameTime >= 595000 && gameTime < 600000;
    if (!isHyperModeTime) {
      showWarning('🔥 BOSS APPROACHING!', C.R);
      playTone(s, 150, 0.5);
      warnAct = true;
    }
  }
  if (bossTimer >= nextBossTime) {
    bossTimer = 0;
    spawnBoss();
  }

  // Move en toward p
  en.children.entries.forEach(enemy => {
    if (!enemy[AC]) return;

    // Skip movement update if enemy is in knockback
    const knockbackUntil = enemy.getData('knockbackUntil') || 0;
    if (gameTime < knockbackUntil) {
      return;
    }

    const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, p.x, p.y);
    const speed = enemy.getData('speed');
    enemy.body.setVelocity(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );
  });

  // Move magnetized XP orbs toward p
  xo.children.entries.forEach(orb => {
    if (orb[AC] && orb.getData('magnetized')) {
      const angle = Phaser.Math.Angle.Between(orb.x, orb.y, p.x, p.y);
      const speed = 300; // Attraction speed
      orb.body.setVelocity(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
      );
    }
  });

  // Move magnetized coins toward p
  co.children.entries.forEach(coin => {
    if (coin[AC] && coin.getData('magnetized')) {
      const angle = Phaser.Math.Angle.Between(coin.x, coin.y, p.x, p.y);
      const speed = 300; // Attraction speed
      coin.body.setVelocity(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
      );
    }
  });

  // Update orbiting balls
  updOrbBalls(delta);

  // Update area damage
  updAreaDmg(delta);

  // Update boomerangs
  updBooms(delta);

  // Update UI
  updateUI();

  // Draw UI bars
  drawUIBars();
}

function shoot() {
  const target = findClosestEnemy();
  if (!target) return;

  const weapon = getWeapon('p');
  playTone(s, 880, 0.05);

  // Calculate angles for multiple pr
  const baseAngle = Phaser.Math.Angle.Between(p.x, p.y, target.x, target.y);
  const spread = weapon.c > 1 ? 0.3 : 0;
  const startOffset = -(weapon.c - 1) * spread / 2;

  for (let i = 0; i < weapon.c; i++) {
    const angle = baseAngle + startOffset + i * spread;
    const vx = Math.cos(angle) * 300;
    const vy = Math.sin(angle) * 300;

    // Create using the group (important!)
    const proj = pr.create(p.x, p.y, 'orb');
    proj.setTint(C.O);
    proj.setScale(0.8);
    proj.body.setCircle(4);
    proj.body.setVelocity(vx, vy);
    proj.setData('damage', weapon.m);
    proj.setData('penetration', weapon.e);
    proj.setData('hits', 0);

    // Auto-destroy after 2 seconds
    s.time.delayedCall(2000, () => {
      if (proj && proj[AC]) proj[DS]();
    });
  }
}

function findClosestEnemy() {
  let closest = null;
  let minDist = Infinity;

  en.children.entries.forEach(enemy => {
    if (!enemy[AC]) return;
    const dist = Phaser.Math.Distance.Between(p.x, p.y, enemy.x, enemy.y);
    if (dist < minDist) {
      minDist = dist;
      closest = enemy;
    }
  });

  return closest;
}

// Helper: create enemy at position with multipliers
function createEn(type, x, y, hpMult = 1, scale = 1) {
  x = Math.max(20, Math.min(2380, x));
  y = Math.max(20, Math.min(1780, y));

  const enemy = en.create(x, y, `enemy_${type.n}`);
  enemy.setScale(scale);
  enemy.body.setCircle(4 * scale);
  enemy.setCollideWorldBounds(true);
  enemy.setData('hp', difficulty.eH * type.h * hpMult); // enemyHp
  enemy.setData('speed', difficulty.eS * type.s); // enemySpeed
  enemy.setData('damage', difficulty.eD * type.d); // enemyDamage
  enemy.setData('xpValue', type.x);
  enemy.setData('coinValue', type.cn);
  enemy.setData('dropChance', type.r);
  enemy.setData('enemyColor', type.c);
  enemy.setData('knockbackUntil', 0);
  enemy.setData('originalScale', scale);
  return enemy;
}

function spawnEnemy() {
  const side = ~~(Math.random() * 4);
  const px = p.x, py = p.y;
  let x, y;

  if (side === 0) { x = px + r() * 800; y = py - 350; }
  else if (side === 1) { x = px + r() * 800; y = py + 350; }
  else if (side === 2) { x = px - 450; y = py + r() * 600; }
  else { x = px + 450; y = py + r() * 600; }

  // Ensure spawn position is within world bounds to prevent clustering at edges
  x = Math.max(50, Math.min(2350, x));
  y = Math.max(50, Math.min(1750, y));

  const type = unlockedTypes[~~(Math.random() * unlockedTypes.length)];
  // Normal enemies use difficulty.enemyHp which scales with HYPER MODE and time
  // hpMult defaults to 1.0 (waves use 1.5x for extra difficulty)
  createEn(type, x, y);
}

function hitEnemy(proj, enemy) {
  if (!proj[AC]) return;
  const projDamage = proj.getData('damage') || 10;
  const projPenetration = proj.getData('penetration') || 0;
  const projHits = proj.getData('hits') || 0;

  procDmg(enemy, proj.x, proj.y, projDamage);
  const newHits = projHits + 1;
  proj.setData('hits', newHits);

  // Destroy if hits exceed penetration (penetration=0 means 1 hit, penetration=1 means 2 hits, etc)
  if (newHits > projPenetration) proj[DS]();
}

function hitPlayer(_pObj, enemy) {
  if (gameOver) return;
  if (!enemy[AC]) return;

  // Check cooldown (prevent damage every frame)
  const lastHit = enemy.getData('lastHitTime') || 0;
  if (gameTime - lastHit < 500) return; // 500ms cooldown per enemy

  const damage = enemy.getData('damage') || difficulty.eD; // enemyDamage
  stats.hp = Math.max(0, stats.hp - damage); // Ensure HP never goes negative
  playTone(s, 220, 0.15);
  enemy.setData('lastHitTime', gameTime);

  // Apply knockback to player (helps escape when surrounded)
  const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, p.x, p.y);
  const knockbackForce = 200; // Moderate knockback
  p.body.setVelocity(
    Math.cos(angle) * knockbackForce,
    Math.sin(angle) * knockbackForce
  );

  // Flash player red
  p.setTintFill(C.R);
  s.time.delayedCall(100, () => {
    if (p && p[AC]) p.clearTint();
  });

  if (stats.hp <= 0) {
    // Update UI one last time to show HP at 0
    drawUIBars();
    endGame();
  }
}

// Generic drop helper: grp, x, y, texture, radius, tint, dataKey, dataValue, immovable, tween
const drop = (g, x, y, t, r, tn, dk, dv, im, tw) => {
  const i = g.create(x, y, t);
  if (tn) i.setTint(tn);
  i.body.setCircle(r);
  if (dk) i.setData(dk, dv);
  if (im) { i.body.setImmovable(true); i.body.setAllowGravity(false); }
  if (tw) s.tweens.add({ targets: i, scale: 1.15, duration: 800, yoyo: true, repeat: -1 });
};

function dropXP(x, y, xpValue) { drop(xo, x, y, 'orb', 5, C.Cy, 'xpValue', xpValue, 0, 1); }

function collectXP(_pObj, orb) {
  if (!orb[AC]) return;
  const baseXpValue = orb.getData('xpValue') || 5;
  orb[DS]();
  const xpValue = baseXpValue * stats.xM; // xpMultiplier
  stats.xp += xpValue;

  if (stats.xp >= stats.xN) { // xpToNext
    levelUp();
  }
}

function dropCoin(x, y, coinValue) { drop(co, x, y, 'orb', 6, 0xFFD700, 'coinValue', coinValue, 0, 1); }

function dropHealthHeal(x, y) { drop(hd, x, y, 'healthDrop', 10, 0, 0, 0, 1); }

function collectCoin(_pObj, coin) {
  if (!coin[AC]) return;
  const coinValue = coin.getData('coinValue') || 1;
  coin[DS]();
  stats.c += coinValue; // coins
  playTone(s, 1800, 0.15);
}

function dropChest(x, y) { drop(wc, x, y, 'chest', 10, 0xffdd00, 0, 0, 1); }

function collectChest(_pObj, chest) {
  if (!chest[AC]) return;
  chest[DS]();
  playTone(s, 1500, 0.3);

  // Check if there are weapons to unlock
  const lockedWeapons = weaponTypes.filter(w => !w.u && !w.i.startsWith('placeholder'));

  if (lockedWeapons.length) {
    showWeaponSelector(lockedWeapons);
  } else {
    // All weapons unlocked, show rare upgrade menu
    showRareUpg();
  }
}

function dropUpgCh(x, y) { drop(uc, x, y, 'chest', 10, 0x00ff66, 0, 0, 1); }

function colUpgCh(_pObj, chest) {
  if (!chest[AC]) return;
  // Prevent multiple simultaneous menu states
  if (gameOver || levelingUp || selectingWeapon || startScreen || paused) return;

  chest[DS]();
  playTone(s, 1200, 0.2);

  selectingWeapon = true;
  s.physics.pause();
  showUpgradeMenu('selectingWeapon');
}

function dropMagnet(x, y) { drop(mg, x, y, 'magnet', 10, 0, 0, 0, 1); }

function collectMagnet(_pObj, magnet) {
  if (!magnet[AC]) return;
  magnet[DS]();
  playTone(s, 1500, 0.3);

  // Magnetize all existing XP orbs
  xo.children.entries.forEach(orb => {
    if (orb[AC]) {
      orb.setData('magnetized', true);
    }
  });

  // Magnetize all existing coins
  co.children.entries.forEach(coin => {
    if (coin[AC]) {
      coin.setData('magnetized', true);
    }
  });
}

function colHeal(_pObj, healDrop) {
  if (!healDrop[AC]) return;
  healDrop[DS]();
  stats.hp = Math.min(stats.mH, stats.hp + 30); // maxHp
  playTone(s, 900, 0.2);
}

function levelUp() {
  levelingUp = true;
  stats.lv++; // level
  stats.xp -= stats.xN;
  stats.xN = ~~(stats.xN * 1.2);

  // Apply character passive ability
  if (selCh) {
    const passive = selCh.pt;
    const value = selCh.pv;

    if (passive === 1) {// damage
      // Banana: +5% weapon damage (accumulated as float for precision)
      const weapon = getWeapon(selCh.weapon);
      if (weapon) weapon.m *= value;
    } else if (passive === 2) { // regen
      // Medusa: +5 HP regen
      stats.hR += value;
    } else if (passive === 3) { // crit
      // Orbe: +2% crit chance
      stats.cC = Math.min(1, stats.cC + value);
    } else if (passive === 4) { // speed
      // Tren Bala: +3% speed
      stats.sp = ~~(stats.sp * value); // speed
    }
  }

  // Pause physics
  s.physics.pause();

  playTone(s, 1200, 0.2);

  showUpgradeMenu('levelingUp');
}

// Helper: get ALL weapon upgrades for a weapon
function getAllWeaponUpgrades(wId) {
  if (wId === 'p') return projectileUpgrades;
  if (wId === 'o') return orbitingBallUpgrades;
  if (wId === 'a') return areaDamageUpgrades;
  if (wId === 'b') return boomerangUpgrades;
  return [];
}

// Helper: render stats panel (used in upgrade and weapon selection menus)
function renderStatsPanel() {
  // Overlay
  const ov = s.add.graphics();
  ov.fillStyle(C.B, 0.9).fillRect(0, 0, 800, 600)[SSF](0)[SD](100);

  // Top panel with neon purple border
  const topPanel = mkGr(101);
  topPanel.fillStyle(C.B, 0.95).fillRoundedRect(15, 15, 770, 270, 8);
  topPanel.lineStyle(3, C.P, 1).strokeRoundedRect(15, 15, 770, 270, 8);

  // Header text + Coins
  mkTxt(60, 30, `LEVEL ${stats.lv}`, { [F]: '20px', [FF]: A, [CO]: CS.Y }, 102); // level
  mkTxt(720, 30, `Coins: ${stats.c}`, { [F]: '18px', [FF]: A, [CO]: CS.Go }, 102);

  // Hero sprite with purple border
  s.add.sprite(70, 110, selCh.texture).setScale(3)[SSF](0)[SD](102);
  const heroBorder = mkGr(102);
  heroBorder.lineStyle(2, C.P, 1).strokeRect(34, 74, 72, 72);

  // Player stats (ALL 8 stats, always visible)
  pUpgrades.forEach((upg, i) => {
    const x = 260 + (i % 4) * 90;
    const y = 80 + ~~(i / 4) * 60;
    const lv = ul[upg.id] || 0;
    const isUpgraded = lv > 0;

    // Stat box
    const statBox = mkGr(101);
    statBox.fillStyle(isUpgraded ? C.VG : 0x222222, 1).fillRoundedRect(x - 20, y - 20, 40, 40, 4);
    statBox.lineStyle(2, isUpgraded ? C.Cy : 0x333333, 1).strokeRoundedRect(x - 20, y - 20, 40, 40, 4);

    // Icon (grayed if not upgraded)
    const iconTxt = s.add.text(x, y, upg.icon, { [F]: '22px' }).setOrigin(0.5)[SSF](0)[SD](102);
    if (!isUpgraded) iconTxt.setTint(0x666666);

    // Level number (only if upgraded)
    if (isUpgraded) {
      mkTxt(x + 12, y + 12, lv.toString(), { [F]: '12px', [FF]: A, [CO]: CS.W }, 102);
    }
  });

  // Weapons section (4 columns, always visible)
  const allWeapons = [{ i: 'p', ic: '🔫', tex: 'orb' }, { i: 'o', ic: '⚪', tex: 'o' }, { i: 'a', ic: '🔴', tex: 'orb' }, { i: 'b', ic: '🪃', tex: 'b' }];
  allWeapons.forEach((w, i) => {
    const x = 30 + i * 190;
    const y = 175;
    const isUnlocked = getWeapon(w.i).u;

    // Weapon panel
    const wpPanel = mkGr(101);
    if (isUnlocked) {
      wpPanel.fillStyle(C.DD, 1).fillRoundedRect(x, y, 170, 100, 6);
      wpPanel.lineStyle(2, C.O, 1).strokeRoundedRect(x, y, 170, 100, 6);

      // Weapon image
      const wpSprite = s.add.sprite(x + 37, y + 50, w.tex).setScale(2)[SSF](0)[SD](102);
      if (w.i === 'p') wpSprite.setTint(C.O);
      if (w.i === 'a') wpSprite.setTint(C.R);

      // Weapon upgrades grid (2x2, max 4)
      const wUpgs = getAllWeaponUpgrades(w.i);
      wUpgs.forEach((upg, j) => {
        const ux = x + 95 + (j % 2) * 45;
        const uy = y + 25 + ~~(j / 2) * 50;
        const lv = ul[upg.id] || 0;
        const isUp = lv > 0;

        // Upgrade icon box
        const ugBox = mkGr(101);
        ugBox.fillStyle(isUp ? C.VG : 0x222222, 1).fillRoundedRect(ux - 16, uy - 16, 32, 32, 3);
        ugBox.lineStyle(2, isUp ? C.Cy : 0x333333, 1).strokeRoundedRect(ux - 16, uy - 16, 32, 32, 3);

        // Icon
        const uIcon = s.add.text(ux, uy, upg.icon, { [F]: '18px' }).setOrigin(0.5)[SSF](0)[SD](102);
        if (!isUp) uIcon.setTint(0x666666);

        // Level (if upgraded)
        if (isUp) {
          mkTxt(ux + 10, uy + 10, lv.toString(), { [F]: '10px', [FF]: A, [CO]: CS.W }, 102);
        }
      });
    } else {
      // Locked weapon slot
      wpPanel.fillStyle(0x333333, 0.5).fillRoundedRect(x, y, 170, 100, 6);
      wpPanel.lineStyle(2, 0x666666, 1).strokeRoundedRect(x, y, 170, 100, 6);
      mkTxt(x + 85, y + 50, '?', { [F]: '48px', [FF]: A, [CO]: '#888' }, 102);
    }
  });
}

function showUpgradeMenu(stateVar = 'levelingUp') {
  // Clean any previous menu first
  cleanupMenu();

  // Build available upgrades pool
  let availableUpgrades = [...pUpgrades];
  if (getWeapon('p').u) availableUpgrades.push(...projectileUpgrades);
  if (getWeapon('o').u) availableUpgrades.push(...orbitingBallUpgrades);
  if (getWeapon('a').u) availableUpgrades.push(...areaDamageUpgrades);
  if (getWeapon('b').u) availableUpgrades.push(...boomerangUpgrades);
  availableUpgrades = availableUpgrades.filter(u => (ul[u.id] || 0) < u.maxLevel);

  // Check if no upgrades available (all maxed)
  if (availableUpgrades.length === 0) {
    const hpReward = 20;
    stats.hp = Math.min(stats.mH, stats.hp + hpReward); // maxHp
    playTone(s, 1500, 0.2);
    const msg = mkTxt(400, 300, `¡MAX LEVEL!\n+${hpReward} HP`, { [F]: '32px', [FF]: A, [CO]: CS.G, [STR]: CS.B, [STT]: 4 }, 150);
    s.tweens.add({ targets: msg, y: 250, alpha: 0, duration: 2000, onComplete: () => msg[DS]() });
    s.physics.resume();
    if (stateVar === 'levelingUp') levelingUp = false;
    else if (stateVar === 'selectingWeapon') selectingWeapon = false;
    return;
  }

  // Render stats panel
  renderStatsPanel();

  // Shuffle upgrades
  const shuffled = [...availableUpgrades].sort(r).slice(0, 3);
  sI = 0;
  m = [];

  // Choose upgrade section (adjusted position)
  const upgradeY = 360;
  mkTxt(400, 320, '▸ Choose Upgrade:', { [F]: '16px', [FF]: A, [CO]: CS.Cy }, 102);

  // Reroll vars (adjusted position)
  const rerollCost = 10;
  const rerollY = 550;
  const rerollBtn = mkGr(101);
  mkTxt(400, rerollY, `REROLL (${rerollCost} Coins)`, { [F]: '18px', [FF]: A, [CO]: stats.c >= rerollCost ? CS.Go : '#666' }, 102);

  const renderUpgradeOptions = (upgrades) => {
    upgrades.forEach((u, i) => {
      const x = 150 + i * 250;
      const btn = mkGr(101);
      btn.fillStyle(C.VG, 1).fillRoundedRect(x - 80, upgradeY - 10, 160, 110, 8).lineStyle(3, C.G, 1).strokeRoundedRect(x - 80, upgradeY - 10, 160, 110, 8);
      mkTxt(x, upgradeY + 30, u.icon, { [F]: '40px' }, 102);
      mkTxt(x, upgradeY + 70, u.name, { [F]: '16px', [FF]: A, [CO]: CS.W }, 102);
      mkTxt(x, upgradeY + 90, u.desc, { [F]: '12px', [FF]: A, [CO]: CS.LG }, 102);
      m.push({ btn, u, x, y: upgradeY + 40 });
    });
  };

  const doReroll = () => {
    if (stats.c < rerollCost) return;
    stats.c -= rerollCost;
    playTone(s, 1400, 0.1);
    m.forEach(opt => opt.btn[DS]());
    s.children.list.filter(c => c.depth === 102 && c.text && c.y >= 380 && c.y <= 460).forEach(c => c[DS]());
    const newShuffled = [...availableUpgrades].sort(r).slice(0, 3);
    m = [];
    sI = 0;
    renderUpgradeOptions(newShuffled);
    updateSelection();
    s.children.list.filter(c => c.depth === 102 && c.text && c.text.includes('Coins')).forEach(c => c.setText(`Coins: ${stats.c}`));
  };

  const selectUpgrade = (u) => {
    u.apply();
    playTone(s, 1000, 0.1);
    cleanupMenu();
    s.physics.resume();
    if (stateVar === 'levelingUp') levelingUp = false;
    else if (stateVar === 'selectingWeapon') selectingWeapon = false;
  };

  const updateSelection = () => {
    // Limpiar tween y overlay anteriores
    if (pulseTween) { pulseTween.stop(); pulseTween = null; }
    if (pulseOverlay) { pulseOverlay.destroy(); pulseOverlay = null; }

    m.forEach((opt, i) => {
      const sel = i === sI;
      opt.btn.clear().fillStyle(sel ? C.DB : C.VG, 1).fillRoundedRect(opt.x - 80, upgradeY - 10, 160, 110, 8);
      opt.btn.lineStyle(3, sel ? C.Y : C.G, 1).strokeRoundedRect(opt.x - 80, upgradeY - 10, 160, 110, 8);

      // Efecto de pulso para opción seleccionada
      if (sel) {
        pulseOverlay = mkGr(103);
        pulseOverlay.fillStyle(C.P, 0.3);
        pulseOverlay.fillRoundedRect(opt.x - 80, upgradeY - 10, 160, 110, 8);

        pulseTween = s.tweens.add({
          targets: pulseOverlay,
          alpha: { from: 0.3, to: 0.7 },
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }
    });
    const canRr = stats.c >= rerollCost;
    const rrSel = sI === 3;
    rerollBtn.clear().fillStyle(rrSel ? (canRr ? 0x776600 : 0x444444) : (canRr ? 0x554400 : C.VG), 1).fillRoundedRect(260, rerollY - 22, 280, 45, 8);
    rerollBtn.lineStyle(3, rrSel ? C.Y : (canRr ? CS.Go : C.DB), 1).strokeRoundedRect(260, rerollY - 22, 280, 45, 8);
  };

  renderUpgradeOptions(shuffled);
  updateSelection();

  // Keyboard navigation handlers
  const goLeft = () => {
    if (sI < 3) {
      sI = (sI - 1 + m.length) % m.length;
      updateSelection();
      playTone(s, 800, 0.05);
    }
  };

  const goRight = () => {
    if (sI < 3) {
      sI = (sI + 1) % m.length;
      updateSelection();
      playTone(s, 800, 0.05);
    }
  };

  const goUp = () => {
    if (sI === 3) {
      sI = m.length - 1;
      updateSelection();
      playTone(s, 800, 0.05);
    }
  };

  const goDown = () => {
    if (sI < 3) {
      sI = 3;
      updateSelection();
      playTone(s, 800, 0.05);
    }
  };

  // Attach listeners to central keys
  keys.mv.a.on('down', goLeft);
  keys.mv.d.on('down', goRight);
  keys.mv.w.on('down', goUp);
  keys.mv.s.on('down', goDown);

  keys.mn.e.on('down', () => {
    if (sI === 3) doReroll();
    else if (sI < 3) selectUpgrade(m[sI].u);
  });

  // Track keys for cleanup (references only)
  menuKeys.push(keys.mv.a, keys.mv.d, keys.mv.w, keys.mv.s, keys.mn.e);
}

function showWeaponSelector(weapons) {
  // Prevent multiple simultaneous menu states
  if (gameOver || levelingUp || selectingWeapon || startScreen || paused) return;

  selectingWeapon = true;
  s.physics.pause();

  // Clean any previous menu first
  cleanupMenu();

  // Render stats panel
  renderStatsPanel();

  // Reset menu state
  sI = 0;
  m = [];

  // Choose weapon section
  const weaponY = 360;
  mkTxt(400, 320, '▸ Choose Weapon:', { [F]: '16px', [FF]: A, [CO]: CS.Cy }, 102);

  const selectWeapon = (weapon) => {
    weapon.u = true;
    playTone(s, 1500, 0.2);

    // Initialize weapon
    if (weapon.i === 'o') {
      initOrbBalls();
    } else if (weapon.i === 'a') {
      initAreaDamage();
    } else if (weapon.i === 'b') {
      initBoom();
    }

    // Clean up menu
    cleanupMenu();

    // Resume
    s.physics.resume();
    selectingWeapon = false;
  };

  const updateSelection = () => {
    // Limpiar tween y overlay anteriores
    if (pulseTween) { pulseTween.stop(); pulseTween = null; }
    if (pulseOverlay) { pulseOverlay.destroy(); pulseOverlay = null; }

    m.forEach((option, i) => {
      const isSelected = i === sI;
      option.btn.clear();
      option.btn.fillStyle(isSelected ? C.DB : C.VG, 1);
      option.btn.fillRoundedRect(option.x - 90, weaponY - 10, 180, 200, 10);
      option.btn.lineStyle(3, isSelected ? C.Y : C.G, 1);
      option.btn.strokeRoundedRect(option.x - 90, weaponY - 10, 180, 200, 10);

      // Efecto de pulso para arma seleccionada
      if (isSelected) {
        pulseOverlay = mkGr(103);
        pulseOverlay.fillStyle(C.P, 0.3);
        pulseOverlay.fillRoundedRect(option.x - 90, weaponY - 10, 180, 200, 10);

        pulseTween = s.tweens.add({
          targets: pulseOverlay,
          alpha: { from: 0.3, to: 0.7 },
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }
    });
  };

  weapons.forEach((weapon, i) => {
    const x = 200 + i * 200;
    const btn = mkGr(101);
    btn.fillStyle(C.VG, 1).fillRoundedRect(x - 90, weaponY - 10, 180, 200, 10).lineStyle(3, C.G, 1).strokeRoundedRect(x - 90, weaponY - 10, 180, 200, 10);
    mkTxt(x, weaponY + 50, weapon.n, { [F]: '20px', [FF]: A, [CO]: CS.W, [FST]: 'bold' }, 102);
    mkTxt(x, weaponY + 110, weapon.d, { [F]: '14px', [FF]: A, [CO]: CS.LG }, 102);
    m.push({ btn, weapon, x });
  });

  // Initial selection highlight
  updateSelection();

  // Keyboard navigation handlers
  const goLeft = () => {
    sI = (sI - 1 + m.length) % m.length;
    updateSelection();
    playTone(s, 800, 0.05);
  };

  const goRight = () => {
    sI = (sI + 1) % m.length;
    updateSelection();
    playTone(s, 800, 0.05);
  };

  // Attach listeners to central keys
  keys.mv.a.on('down', goLeft);
  keys.mv.d.on('down', goRight);

  keys.mn.e.on('down', () => {
    selectWeapon(m[sI].weapon);
  });

  // Track keys for cleanup (references only)
  menuKeys.push(keys.mv.a, keys.mv.d, keys.mn.e);
}

function showRareUpg() {
  // Prevent multiple simultaneous menu states
  if (gameOver || levelingUp || selectingWeapon || startScreen || paused) return;

  selectingWeapon = true;
  s.physics.pause();

  // Clean any previous menu first
  cleanupMenu();

  // Filter rare upgrades to only unlocked weapons and not maxed
  const available = rareUpgrades.filter(u => {
    if (!u.weaponId) return true; // Player upgrades
    const isUnlocked = getWeapon(u.weaponId).u;
    const notMaxed = (ul[u.id] || 0) < u.maxLevel;
    return isUnlocked && notMaxed;
  });

  // Semi-transparent overlay
  const overlay = s.add.graphics();
  overlay.fillStyle(C.B, 0.85);
  overlay.fillRect(0, 0, 800, 600);
  overlay[SSF](0);
  overlay[SD](100);

  // Title
  mkTxt(400, 100, '✨ RARE UPGRADE! ✨', { [F]: '48px', [FF]: A, [CO]: '#ff00ff', [STR]: CS.B, [STT]: 6 });

  // Shuffle and pick 3 rare upgrades
  const shuffled = [...available].sort(r).slice(0, 3);

  // Reset menu state
  sI = 0;
  m = [];

  const selectUpgrade = (upgrade) => {
    upgrade.apply();
    playTone(s, 1800, 0.1);

    // Clean up menu
    cleanupMenu();

    // Resume
    s.physics.resume();
    selectingWeapon = false;
  };

  const updateSelection = () => {
    m.forEach((option, i) => {
      const isSelected = i === sI;
      option.btn.clear();
      option.btn.fillStyle(isSelected ? 0x550055 : 0x330033, 1);
      option.btn.fillRoundedRect(option.x - 90, option.y - 80, 180, 160, 10);
      option.btn.lineStyle(3, isSelected ? C.Y : C.P, 1);
      option.btn.strokeRoundedRect(option.x - 90, option.y - 80, 180, 160, 10);
    });
  };

  shuffled.forEach((upgrade, i) => {
    const x = 150 + i * 250;
    const y = 300;
    const btn = mkGr(101);
    btn.fillStyle(0x330033, 1).fillRoundedRect(x - 90, y - 80, 180, 160, 10).lineStyle(3, C.P, 1).strokeRoundedRect(x - 90, y - 80, 180, 160, 10);
    mkTxt(x, y - 30, upgrade.icon, { [F]: '48px' }, 102);
    mkTxt(x, y + 20, upgrade.name, { [F]: '18px', [FF]: A, [CO]: '#f0f', [FST]: 'bold' }, 102);
    mkTxt(x, y + 50, upgrade.desc, { [F]: '14px', [FF]: A, [CO]: '#faf' }, 102);
    m.push({ btn, upgrade, x, y });
  });

  // Initial selection highlight
  updateSelection();

  // Keyboard navigation handlers
  const goLeft = () => {
    sI = (sI - 1 + m.length) % m.length;
    updateSelection();
    playTone(s, 800, 0.05);
  };

  const goRight = () => {
    sI = (sI + 1) % m.length;
    updateSelection();
    playTone(s, 800, 0.05);
  };

  // Attach listeners to central keys
  keys.mv.a.on('down', goLeft);
  keys.mv.d.on('down', goRight);

  keys.mn.e.on('down', () => {
    selectUpgrade(m[sI].upgrade);
  });

  // Track keys for cleanup (references only)
  menuKeys.push(keys.mv.a, keys.mv.d, keys.mn.e);
}

// Helper: glitch text triple-layer effect (reusable)
const gt3 = (x, y, txt, sz, d) => [
  s.add.text(x - 2, y - 1, txt, { [F]: sz, [FF]: A, [CO]: '#ff00ff', [FST]: 'bold' }).setOrigin(0.5)[SSF](0)[SD](d),
  s.add.text(x + 2, y + 1, txt, { [F]: sz, [FF]: A, [CO]: CS.Cy, [FST]: 'bold' }).setOrigin(0.5)[SSF](0)[SD](d),
  s.add.text(x, y, txt, { [F]: sz, [FF]: A, [CO]: CS.W, [FST]: 'bold' }).setOrigin(0.5)[SSF](0)[SD](d + 1)
];

function showMainMenu() {
  // Clean any previous menu first
  cleanupMenu();

  // Dark background with transparency to show background
  s.add.graphics().fillStyle(C.B, 0.4).fillRect(0, 0, 800, 600)[SSF](0)[SD](100);

  // Hotline Miami style title with glitch effect (multiple layers)
  // Pink/magenta shadow layer
  mkTxt(403, 83, 'SURVIVE', { [F]: '72px', [FF]: A, [CO]: '#ff00ff', [STR]: '#ff00ff', [STT]: 3 }, 101);
  // Cyan main layer
  mkTxt(400, 80, 'SURVIVE', { [F]: '72px', [FF]: A, [CO]: CS.Cy, [STR]: CS.Cy, [STT]: 3 }, 102);
  // Subtitle in pink
  mkTxt(400, 150, 'THE GAME', { [F]: '24px', [FF]: A, [CO]: '#ff00ff', [STR]: CS.B, [STT]: 2 }, 102);

  // Version text
  mkTxt(750, 580, 'V1.13', { [F]: '14px', [FF]: A, [CO]: '#666666' }, 102);

  // Control instructions
  mkTxt(400, 540, 'WS: Move  SPACE: Select', { [F]: '14px', [FF]: A, [CO]: '#00aaaa' }, 101);

  sI = 0;
  const opts = [
    { y: 320, txt: 'START GAME', fn: () => { mainMenu = false; showStartScreen(); } },
    { y: 400, txt: 'LEADERBOARDS', fn: showFullLeaderboard }
  ];

  opts.forEach(o => o.texts = []);

  const dr = (i) => {
    const d = i === sI, o = opts[i];
    o.texts.forEach(t => t[DS]());
    o.texts = [];

    if (d) {
      o.texts.push(...gt3(400, o.y, o.txt, '40px', 101));
      if (pulseTween) { pulseTween.stop(); pulseTween = null; }
      pulseTween = s.tweens.add({ targets: o.texts[2], alpha: 0.7, duration: 400, yoyo: true, repeat: -1 });
    } else {
      o.texts.push(s.add.text(400, o.y, o.txt, { [F]: '32px', [FF]: A, [CO]: '#00aaaa' }).setOrigin(0.5)[SSF](0)[SD](101));
    }
  };

  opts.forEach((_, i) => dr(i));

  // Keyboard navigation handlers
  const gu = () => { sI = (sI - 1 + opts.length) % opts.length; opts.forEach((_, i) => dr(i)); playTone(s, 800, 0.05); };
  const gd = () => { sI = (sI + 1) % opts.length; opts.forEach((_, i) => dr(i)); playTone(s, 800, 0.05); };
  const ge = () => { playTone(s, 1200, 0.15); cleanupMenu(); opts[sI].fn(); };

  // Attach listeners to central keys
  keys.mv.w.on('down', gu);
  keys.mv.s.on('down', gd);
  keys.mn.e.on('down', ge);

  // Track keys for cleanup (references only)
  menuKeys.push(keys.mv.w, keys.mv.s, keys.mn.e);
}

function showFullLeaderboard() {
  s.add.graphics().fillStyle(C.B, 0.5).fillRect(0, 0, 800, 600)[SSF](0)[SD](150);
  mkTxt(400, 60, 'TOP 10 LEADERBOARD', { [F]: '40px', [FF]: A, [CO]: CS.Go, [STR]: CS.B, [STT]: 6 }, 151);
  mkTxt(200, 130, '#', { [F]: '20px', [FF]: A, [CO]: '#aaa' }, 151);
  mkTxt(350, 130, 'NAME', { [F]: '20px', [FF]: A, [CO]: '#aaa' }, 151);
  mkTxt(550, 130, 'KILLS', { [F]: '20px', [FF]: A, [CO]: '#aaa' }, 151);
  s.add.graphics().lineStyle(2, 0x444444, 1).lineBetween(150, 150, 650, 150)[SSF](0)[SD](151);

  const t10 = loadLeaderboard().slice(0, 10);
  if (!t10.length) {
    mkTxt(400, 300, 'No scores yet!', { [F]: '24px', [FF]: A, [CO]: CS.Gy }, 151);
  } else {
    t10.forEach((e, i) => {
      const y = 180 + i * 35;
      const c = [CS.Go, CS.Si, CS.Br][i] || CS.W;
      const t = { [F]: '18px', [FF]: A, [CO]: c, [FST]: 'bold' };
      s.add.text(200, y, i + 1, t).setOrigin(0.5)[SSF](0)[SD](151);
      s.add.text(350, y, e.name, t).setOrigin(0.5)[SSF](0)[SD](151);
      s.add.text(550, y, e.kills, t).setOrigin(0.5)[SSF](0)[SD](151);
    });
  }

  mkTxt(400, 540, 'SPACE to go back', { [F]: '16px', [FF]: A, [CO]: CS.LG }, 151);

  const ek = s.input.keyboard.addKey('SPACE');
  ek.on('down', () => {
    playTone(s, 1000, 0.15);
    cleanupMenu(150);
    showMainMenu();
  });
  menuKeys.push(ek);
}

// Generate HD hero textures (optimized)
function generateHeroTexture(t, sel) {
  const k = `${t}_hd${sel ? '_s' : ''}`;
  if (s.textures.exists(k)) return k;
  g = s.add.graphics();
  const d = sel ? 3.5 : 2.5, m = v => v * d;

  if (t === 'p_b') {
    fs(C.Y, 1).fillEllipse(m(16), m(16), m(10), m(24));
    fs(0xffdd00, 1).fillEllipse(m(18), m(16), m(6), m(20));
    fs(0x885500, 1).fillRect(m(14), m(4), m(4), m(6));
  } else if (t === 'p_j') {
    fs(0xff88dd, 1).fillCircle(m(16), m(12), m(10));
    fs(0xff88dd, 0.7).fillRect(m(8), m(18), m(3), m(12)).fillRect(m(13), m(20), m(3), m(10)).fillRect(m(18), m(19), m(3), m(11));
    fs(C.B, 1).fillCircle(m(12), m(11), m(2)).fillCircle(m(20), m(11), m(2));
  } else if (t === 'p_o') {
    fs(0xcc00ff, 1).slice(m(16), m(16), m(12), 1.57, 4.71, 0).fillPath();
    fs(0x0088ff, 1).slice(m(16), m(16), m(12), 4.71, 1.57, 0).fillPath();
    ls(m(2), C.W, 1).lineBetween(m(16), m(4), m(16), m(28));
    fs(C.W, 0.8).fillCircle(m(16), m(16), m(4));
  } else {
    fs(0xe0e0e0, 1).fillRoundedRect(m(6), m(10), m(20), m(12), m(3));
    fs(C.W, 1).fillTriangle(m(4), m(16), m(10), m(12), m(10), m(20));
    fs(0x0088ff, 1).fillRect(m(8), m(15), m(18), m(2));
    fs(C.R, 1).fillRect(m(8), m(18), m(18), m(2));
    fs(0x4444ff, 0.7).fillRect(m(12), m(13), m(3), m(3)).fillRect(m(17), m(13), m(3), m(3)).fillRect(m(22), m(13), m(3), m(3));
  }

  g.generateTexture(k, 32 * d, 32 * d);
  g.destroy();
  return k;
}

function showStartScreen() {
  // Clean any previous menu first
  cleanupMenu();

  // Dark overlay with transparency to show background
  s.add.graphics().fillStyle(C.B, 0.3).fillRect(0, 0, 800, 600)[SSF](0)[SD](100);

  // Scanlines VHS effect
  const scan = mkGr(104);
  scan.lineStyle(1, C.W, 0.03);
  for (let y = 0; y < 600; y += 3) scan.lineBetween(0, y, 800, y);

  // Title with glitch effect
  mkTxt(403, 43, 'CHOOSE CHARACTER', { [F]: '32px', [FF]: A, [CO]: '#ff00ff', [STR]: '#ff00ff', [STT]: 2 }, 101);
  mkTxt(400, 40, 'CHOOSE CHARACTER', { [F]: '32px', [FF]: A, [CO]: CS.Cy, [STR]: CS.Cy, [STT]: 2 }, 102);

  sI = 0;
  m = [];

  // Character gradient colors
  const gradients = [0xffff00, 0xff00ff, 0x00ffff, 0x00ff00]; // Banana, Medusa, Orb, Train

  // L4D2-style large card rendering with glitch + glow + gradient
  const dc = (g, x, y, d, i, ga) => {
    g.clear();
    const cx = x - 90, cy = y - 140, gc = gradients[i];
    if (d) {
      const a = ga || 0.4;
      fs(C.P, a * 0.3).fillRoundedRect(x - 100, y - 150, 200, 300, 10);
      fs(C.Cy, a * 0.3).fillRoundedRect(x - 105, y - 155, 210, 310, 10);
      fs(C.P, 0.4).fillRoundedRect(x - 87, y - 137, 180, 280, 10).lineStyle(5, C.P, 0.8).strokeRoundedRect(x - 87, y - 137, 180, 280, 10);
      fs(C.Cy, 0.4).fillRoundedRect(x - 93, y - 143, 180, 280, 10).lineStyle(5, C.Cy, 0.8).strokeRoundedRect(x - 93, y - 143, 180, 280, 10);
      g.fillGradientStyle(gc, gc, C.B, C.B, 0.3).fillRoundedRect(cx, cy, 180, 280, 10).lineStyle(5, C.W, 1).strokeRoundedRect(cx, cy, 180, 280, 10);
    } else {
      g.fillGradientStyle(gc, gc, C.B, C.B, 0.15).fillRoundedRect(cx, cy, 180, 280, 10).lineStyle(3, gc, 0.5).strokeRoundedRect(cx, cy, 180, 280, 10);
    }
  };

  const sel = (ch) => {
    playTone(s, 1500, 0.2);
    selCh = ch;
    initGameplay();
    p.setTexture(ch.texture);
    const w = weaponTypes.find(w => w.i === ch.weapon);
    if (w) {
      w.u = true;
      if (w.i === 'o') initOrbBalls();
      else if (w.i === 'a') initAreaDamage();
      else if (w.i === 'b') initBoom();
    }
    cleanupMenu();
    s.physics.resume();
    startScreen = false;
  };

  let glowPulse = 0.4;
  const upd = (shake) => {
    m.forEach((o, i) => {
      const d = i === sI;
      const shakeX = shake ? r() * 4 : 0;
      const shakeY = shake ? r() * 4 : 0;

      dc(o.btn, o.x + shakeX, o.y + shakeY, d, i, glowPulse);

      const hdTex = generateHeroTexture(o.character.texture, d);
      o.sprite.setTexture(hdTex);
      o.sprite.setPosition(o.x + shakeX, o.y - 50 + shakeY);
      o.sprite.setAngle(d ? Math.sin(Date.now() * 0.002) * 8 : 0); // Pronounced rotation

      // Remove old text
      if (o.texts) o.texts.forEach(t => t[DS]());
      o.texts = [];

      // Destroy old particles
      if (o.particles) { o.particles[DS](); o.particles = null; }

      if (d) {
        // Add particle sparks for selected card
        o.particles = s.add.particles(o.x, o.y, 'orb', {
          speed: { min: 20, max: 40 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.3, end: 0 },
          lifespan: 800,
          frequency: 100,
          tint: [C.Cy, C.P, C.W],
          blendMode: 'ADD'
        })[SSF](0)[SD](103);

        // Selected: Glitch text effect (triple layer)
        o.texts.push(...gt3(o.x + shakeX, o.y + 83 + shakeY, o.character.name, '22px', 102));

        // Weapon and passive (bright)
        o.texts.push(s.add.text(o.x + shakeX, o.y + 108 + shakeY, o.character.desc, { [F]: '14px', [FF]: A, [CO]: CS.Cy }).setOrigin(0.5)[SSF](0)[SD](102));
        o.texts.push(s.add.text(o.x + shakeX, o.y + 128 + shakeY, o.character.passiveDesc, { [F]: '12px', [FF]: A, [CO]: '#ff00ff' }).setOrigin(0.5)[SSF](0)[SD](102));
      } else {
        // Unselected: Simple colored text
        const col = ['#ffff00', '#ff00ff', CS.Cy, '#00ff00'][i];
        o.texts.push(s.add.text(o.x, o.y + 83, o.character.name, { [F]: '18px', [FF]: A, [CO]: col, [FST]: 'bold' }).setOrigin(0.5)[SSF](0)[SD](102));
        o.texts.push(s.add.text(o.x, o.y + 108, o.character.desc, { [F]: '12px', [FF]: A, [CO]: col }).setOrigin(0.5)[SSF](0)[SD](102));
        o.texts.push(s.add.text(o.x, o.y + 128, o.character.passiveDesc, { [F]: '10px', [FF]: A, [CO]: col }).setOrigin(0.5)[SSF](0)[SD](102));
      }
    });
  };

  // Glow pulse animation
  if (pulseTween) { pulseTween.stop(); pulseTween = null; }
  pulseTween = s.tweens.add({
    targets: { val: 0.4 },
    val: 0.8,
    duration: 600,
    yoyo: true,
    repeat: -1,
    onUpdate: (tw) => { glowPulse = tw.getValue(); if (startScreen) upd(false); }
  });

  characters.forEach((ch, i) => {
    const x = 100 + i * 200;
    const y = 260;
    const btn = mkGr(101);

    // Generate high-res texture (non-selected) and create sprite at scale 1.0
    const hdTexture = generateHeroTexture(ch.texture, false);
    const heroSprite = s.add.sprite(x, y - 50, hdTexture).setScale(1)[SSF](0)[SD](102);

    m.push({ btn, character: ch, x, y, sprite: heroSprite, texts: [], particles: null });
  });

  // Initial draw
  upd(false);

  mkTxt(400, 540, 'AD: Move  SPACE: Select  ESC: Back', { [F]: '14px', [FF]: A, [CO]: '#00aaaa' }, 101);

  // Keyboard navigation handlers
  const goLeft = () => {
    sI = (sI - 1 + m.length) % m.length;
    upd(true); // Shake on change
    s.time.delayedCall(50, () => upd(false)); // Reset shake
    playTone(s, 800, 0.05);
  };
  const goRight = () => {
    sI = (sI + 1) % m.length;
    upd(true); // Shake on change
    s.time.delayedCall(50, () => upd(false)); // Reset shake
    playTone(s, 800, 0.05);
  };

  // Attach listeners to central keys
  keys.mv.a.on('down', goLeft);
  keys.mv.d.on('down', goRight);
  keys.mn.e.on('down', () => sel(m[sI].character));
  keys.mn.x.on('down', () => {
    playTone(s, 1000, 0.15);
    startScreen = !(mainMenu = true);
    cleanupMenu();
    showMainMenu();
  });

  // Track keys for cleanup (references only)
  menuKeys.push(keys.mv.a, keys.mv.d, keys.mn.e, keys.mn.x);
}

function createUI() {
  const txt = (x, y, t, c, sz = '16px', d = 0) => {
    const el = s.add.text(x, y, t, { [F]: sz, [FF]: A, [CO]: c })[SSF](0);
    return d ? el[SD](d) : el;
  };
  ui.hpText = txt(10, 10, 'HP:', CS.W);
  ui.xpText = txt(300, 10, 'XP:', CS.W);
  ui.levelText = txt(550, 10, 'Level: 1', CS.Y);
  ui.coinsText = txt(650, 10, 'Coins: 0', CS.Go);
  ui.timeText = txt(740, 10, '0:00', CS.Cy);
  ui.statsHint = txt(580, 580, '[P]Pause [R]Retry', CS.Gy, '14px', 10);
}

function updateUI() {
  ui.levelText.setText(`Level: ${stats.lv}`); // level
  ui.coinsText.setText(`Coins: ${stats.c}`);

  const minutes = ~~(gameTime / 60000);
  const seconds = ~~((gameTime % 60000) / 1000);
  ui.timeText.setText(`${minutes}:${('0' + seconds).slice(-2)}`);
}

function drawUIBars() {
  gr.clear()[SSF](0)[SD](99);
  // Helper: draw bar (x, y, w, h, val, max, bgCol, fgCol, borderCol, borderW)
  const bar = (x, y, w, h, v, m, bg, fg, br, bw) => {
    gr.fillStyle(bg, 1).fillRect(x, y, w, h);
    gr.fillStyle(fg, 1).fillRect(x, y, w * (v / m), h);
    gr.lineStyle(bw, br, 1).strokeRect(x, y, w, h);
  };
  bar(50, 10, 200, 20, stats.hp, stats.mH, C.DR, C.R, C.W, 2); // maxHp
  bar(330, 10, 180, 20, stats.xp, stats.xN, 0x004444, C.Cy, C.W, 2);

  // Find all active bosses
  let bosses = [];
  en.children.entries.forEach(enemy => {
    if (enemy[AC] && enemy.getData('isBoss')) {
      bosses.push(enemy);
    }
  });

  // Track rendered bosses for cleanup
  const rendered = [];

  // Draw boss HP bars horizontally
  if (bosses.length) {
    const w = 600 / bosses.length; // Dynamic width per boss
    bosses.forEach((boss, i) => {
      const hp = boss.getData('hp'), maxHp = boss.getData('maxHp');
      const xStart = 100 + (i * w);
      const xCenter = xStart + (w / 2);

      // Find or create boss UI entry
      let bUI = ui.bossData.find(b => b.enemy === boss);
      if (!bUI) {
        bUI = { enemy: boss, hpText: null, lastHp: null };
        ui.bossData.push(bUI);
      }

      // Update HP text if changed
      if (!bUI.hpText || bUI.lastHp !== hp) {
        if (bUI.hpText) bUI.hpText[DS]();
        bUI.hpText = mkTxt(xCenter, 62, `${~~hp} / ${~~maxHp}`, { [F]: '14px', [FF]: A, [CO]: CS.W, [STR]: CS.B, [STT]: 3 }, 99);
        bUI.lastHp = hp;
      }

      // Draw HP bar
      bar(xStart, 50, w - 10, 25, hp, maxHp, C.DR, C.R, C.Y, 3);
      rendered.push(boss);
    });
  }

  // Cleanup dead boss UI
  ui.bossData = ui.bossData.filter(bUI => {
    if (!rendered.includes(bUI.enemy)) {
      if (bUI.hpText) bUI.hpText[DS]();
      return false;
    }
    return true;
  });
}

function endGame() {
  gameOver = true;
  playTone(s, 150, 0.5);

  // Overlay
  const overlay = s.add.graphics();
  overlay.fillStyle(C.B, 0.8);
  overlay.fillRect(0, 0, 800, 600);
  overlay[SSF](0);
  overlay[SD](100);

  // Game Over text
  const gameOverText = mkTxt(400, 200, 'GAME OVER', { [F]: '64px', [FF]: A, [CO]: CS.R, [STR]: CS.B, [STT]: 8 });

  // Stats
  const mins = ~~(gameTime / 60000), secs = ~~((gameTime % 60000) / 1000);
  const timeText = mkTxt(400, 300, `Time: ${mins}:${('0' + secs).slice(-2)}`, { [F]: '28px', [FF]: A, [CO]: CS.Cy });
  const levelText = mkTxt(400, 350, `Level: ${stats.lv}`, { [F]: '28px', [FF]: A, [CO]: CS.Y }); // level
  const killsText = mkTxt(400, 400, `Kills: ${stats.k}`, { [F]: '28px', [FF]: A, [CO]: CS.G });

  // After 2 seconds, transition to leaderboard flow
  s.time.delayedCall(2000, () => {
    // Clean up game over screen
    overlay[DS]();
    gameOverText[DS]();
    timeText[DS]();
    levelText[DS]();
    killsText[DS]();

    // Show leaderboard flow
    if (qualForLb(stats.k)) {
      showNameEntry();
    } else {
      showLeaderboard();
    }
  });
}

function restartGame() {
  // Stop tweens and reset to null for recreation in initGameplay()
  idleTween?.stop();
  idleTween = null;

  // Cancel all pending delayed callbacks
  s.time.removeAllEvents();
  s.tweens.killAll();

  // Cleanup action key listeners (P and R)
  keys.ac.p.removeAllListeners();
  keys.ac.r.removeAllListeners();

  // Cleanup: destroy all game objects with depth >= 0 (preserve background at depth < 0)
  s.children.list.filter(c => c.depth >= 0).forEach(c => c[DS]());

  // Clear physics groups
  if (en) [en, pr, xo, co, wc, uc, mg, hd, ob].forEach(g => g.clear(true, true));

  // Cleanup boss UI elements
  if (ui.bossData) {
    ui.bossData.forEach(bUI => {
      if (bUI.hpText) bUI.hpText[DS]();
    });
    ui.bossData = [];
  }

  // Reset state variables
  gameOver = levelingUp = selectingWeapon = paused = warnAct = hyperModeActive = false;
  startScreen = mainMenu = true;
  gameTime = shootTimer = spawnTimer = regenTimer = waveTimer = bossTimer = orbitAngle = avB = bTmr = lastOrbSize = lastAreaRadius = 0;
  ul = {};
  weaponTypes = JSON.parse(JSON.stringify(iwt));
  orbitingBalls = boomerangs = [];
  adc?.[DS]();
  adc = null;
  // Destroy and recreate graphics object to prevent memory leak
  if (gr) { gr.destroy(); gr = null; }
  gr = s.add.graphics();
  unlockedTypes = [enemyTypes[0]];
  stats = JSON.parse(JSON.stringify(inS));
  difficulty = { ...inD };

  // Don't call initGameplay() here - it will be called when user selects character
  s.physics.pause();
  showMainMenu();
}

// Leaderboard functions
function loadLeaderboard() {
  return lbData;
}

function saveLeaderboard(entries) {
  lbData = entries;
}

function addToLeaderboard(name, kills) {
  const entries = loadLeaderboard();
  entries.push({ name: name.trim(), kills, date: Date.now() });
  entries.sort((a, b) => b.kills - a.kills);
  const trimmed = entries.slice(0, 10);
  saveLeaderboard(trimmed);

  const position = trimmed.findIndex(e => e.kills === kills && e.name === name.trim());
  return position !== -1 ? position + 1 : null;
}

function qualForLb(kills) {
  const entries = loadLeaderboard();
  return entries.length < 10 || kills > entries[entries.length - 1].kills;
}

function showNameEntry() {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-. ';
  let name = ['', '', '', ' ', ' ', ' '];
  let cursorPos = 0;
  let charIndex = 0;

  // Overlay
  const overlay = s.add.graphics();
  overlay.fillStyle(C.B, 0.85);
  overlay.fillRect(0, 0, 800, 600);
  overlay[SSF](0);
  overlay[SD](150);

  // Title & Stats
  const mins = ~~(gameTime / 60000), secs = ~~((gameTime % 60000) / 1000);
  mkTxt(400, 80, qualForLb(stats.k) ? 'NEW HIGH SCORE!' : 'ENTER YOUR NAME', { [F]: '48px', [FF]: A, [CO]: CS.Y, [STR]: CS.B, [STT]: 6 }, 151);
  mkTxt(400, 150, `Kills: ${stats.k}`, { [F]: '24px', [FF]: A, [CO]: CS.G }, 151);
  mkTxt(400, 180, `Level: ${stats.lv}  Time: ${mins}:${('0' + secs).slice(-2)}`, { [F]: '20px', [FF]: A, [CO]: CS.W }, 151); // level

  // Name input boxes
  const boxesY = 280;
  const boxWidth = 60;
  const boxGap = 10;
  const startX = 400 - (6 * boxWidth + 5 * boxGap) / 2;

  const boxes = [];
  const letters = [];
  for (let i = 0; i < 6; i++) {
    const x = startX + i * (boxWidth + boxGap);
    const box = s.add.graphics();
    box[SSF](0)[SD](151);
    boxes.push(box);

    const letter = mkTxt(x + boxWidth / 2, boxesY + 30, name[i], { [F]: '40px', [FF]: A, [CO]: CS.W }, 152);
    letters.push(letter);
  }

  const updateBoxes = () => {
    boxes.forEach((box, i) => {
      box.clear();
      const x = startX + i * (boxWidth + boxGap);
      const isActive = i === cursorPos;
      box.lineStyle(3, isActive ? C.Y : C.G, 1);
      box.strokeRect(x, boxesY, boxWidth, 60);
      if (isActive) {
        box.fillStyle(C.Y, 0.2);
        box.fillRect(x, boxesY, boxWidth, 60);
      }
      letters[i].setText(name[i]);
      letters[i].setColor(i < cursorPos ? CS.G : (isActive ? CS.Y : CS.W));
    });
  };

  // Hints
  mkTxt(400, 380, 'WS: Letter  AD: Move  SPC: OK', { [F]: '18px', [FF]: A, [CO]: '#aaaaaa' }, 151);
  mkTxt(400, 410, 'Press SPACE to Submit Name', { [F]: '18px', [FF]: A, [CO]: '#ffaa00' }, 151);

  updateBoxes();

  // Input navigation handlers
  const changeLetter = (dir) => {
    charIndex = (charIndex + dir + CHARS.length) % CHARS.length;
    name[cursorPos] = CHARS[charIndex];
    updateBoxes();
    playTone(s, 800, 0.05);
  };

  const moveRight = () => {
    if (cursorPos < 5) {
      cursorPos++;
      charIndex = CHARS.indexOf(name[cursorPos]);
      updateBoxes();
      playTone(s, 900, 0.05);
    }
  };

  const moveLeft = () => {
    if (cursorPos > 0) {
      cursorPos--;
      charIndex = CHARS.indexOf(name[cursorPos]);
      updateBoxes();
      playTone(s, 700, 0.05);
    }
  };

  // Attach listeners to central keys
  keys.mv.w.on('down', () => changeLetter(1));
  keys.mv.s.on('down', () => changeLetter(-1));
  keys.mv.d.on('down', moveRight);
  keys.mv.a.on('down', moveLeft);

  const cleanup = () => {
    cleanupMenu(151);
    // Remove listeners from central keys
    keys.mv.w.removeAllListeners();
    keys.mv.s.removeAllListeners();
    keys.mv.a.removeAllListeners();
    keys.mv.d.removeAllListeners();
    keys.mn.e.removeAllListeners();
  };

  keys.mn.e.on('down', () => {
    const finalName = name.join('').trim();
    if (finalName.length) {
      cleanup();
      playTone(s, 1200, 0.2);
      const position = addToLeaderboard(finalName, stats.k);
      showLeaderboard(position);
    }
  });
}

function showLeaderboard(highlightPosition = null) {
  const entries = loadLeaderboard();

  // Overlay
  const overlay = s.add.graphics();
  overlay.fillStyle(C.B, 0.9);
  overlay.fillRect(0, 0, 800, 600);
  overlay[SSF](0);
  overlay[SD](150);

  // Title
  mkTxt(400, 60, '🏆 TOP 10 LEADERBOARD 🏆', { [F]: '40px', [FF]: A, [CO]: CS.Go, [STR]: CS.B, [STT]: 6 }, 151);

  // Header
  mkTxt(200, 130, '#', { [F]: '20px', [FF]: A, [CO]: '#aaaaaa' }, 151);
  mkTxt(350, 130, 'NAME', { [F]: '20px', [FF]: A, [CO]: '#aaaaaa' }, 151);
  mkTxt(550, 130, 'KILLS', { [F]: '20px', [FF]: A, [CO]: '#aaaaaa' }, 151);

  // Separator line
  const line = s.add.graphics();
  line.lineStyle(2, 0x444444, 1);
  line.lineBetween(150, 150, 650, 150);
  line[SSF](0)[SD](151);

  // Entries
  for (let i = 0; i < Math.min(10, entries.length); i++) {
    const entry = entries[i];
    const y = 180 + i * 35;
    const isHighlight = highlightPosition && (i + 1) === highlightPosition;

    // Highlight background
    if (isHighlight) {
      const highlight = s.add.graphics();
      highlight.fillStyle(C.Y, 0.2);
      highlight.fillRect(150, y - 15, 500, 30);
      highlight[SSF](0)[SD](150);
    }

    // Color by position
    let color = CS.W;
    if (i === 0) color = CS.Go; // Gold
    else if (i === 1) color = CS.Si; // Silver
    else if (i === 2) color = CS.Br; // Bronze
    if (isHighlight) color = CS.Y;

    mkTxt(200, y, `${i + 1}`, { [F]: '24px', [FF]: A, [CO]: color }, 151);
    mkTxt(350, y, entry.name, { [F]: '24px', [FF]: A, [CO]: color }, 151);
    mkTxt(550, y, `${entry.kills}`, { [F]: '24px', [FF]: A, [CO]: color }, 151);
  }

  // Empty message
  if (entries.length === 0) {
    mkTxt(400, 300, 'No scores yet!', { [F]: '32px', [FF]: A, [CO]: '#666666' }, 151);
  }

  // Hint
  mkTxt(400, 550, 'Press R', { [F]: '24px', [FF]: A, [CO]: CS.W }, 151);
}

function updUnlockTypes() {
  enemyTypes.forEach(type => {
    if (gameTime >= type.u && !unlockedTypes.includes(type)) {
      unlockedTypes.push(type);
    }
  });
}

function spawnWave() {
  warnAct = false;
  playTone(s, 800, 0.2);

  const count = 30 + ~~(Math.random() * 6);
  const angleStep = (Math.PI * 2) / count;

  for (let i = 0; i < count; i++) {
    const angle = i * angleStep;
    const x = p.x + Math.cos(angle) * 400;
    const y = p.y + Math.sin(angle) * 400;
    const type = unlockedTypes[~~(Math.random() * unlockedTypes.length)];
    createEn(type, x, y, 1.5);
  }
}

function spawnBoss() {
  warnAct = false;
  playTone(s, 100, 0.4);

  const type = unlockedTypes[unlockedTypes.length - 1];
  const side = ~~(Math.random() * 4);
  let x, y;

  if (side === 0) { x = p.x; y = p.y - 400; }
  else if (side === 1) { x = p.x; y = p.y + 400; }
  else if (side === 2) { x = p.x - 500; y = p.y; }
  else { x = p.x + 500; y = p.y; }

  const bossTexKey = generateBossTexture(type);
  x = Math.max(30, Math.min(2370, x));
  y = Math.max(30, Math.min(1770, y));
  const boss = en.create(x, y, bossTexKey);
  boss.body.setCircle(30);
  boss.setCollideWorldBounds(true);
  const bhp = difficulty.eH * type.h * 10; // enemyHp
  boss.setData('hp', bhp);
  boss.setData('maxHp', bhp);
  boss.setData('speed', difficulty.eS * type.s * 0.7); // enemySpeed
  boss.setData('damage', difficulty.eD * type.d * 2); // enemyDamage
  boss.setData('xpValue', type.x * 10);
  boss.setData('coinValue', type.cn * 10);
  boss.setData('dropChance', type.r);
  boss.setData('enemyColor', type.c);
  boss.setData('knockbackUntil', 0);
  boss.setData('isBoss', true);
  boss.setData('originalScale', 1.0);
}

function showWarning(text, color) {
  warnAct = true;

  // Create warning overlay
  const warning = s.add.graphics();
  warning.fillStyle(color, 0.3);
  warning.fillRect(0, 130, 800, 80);
  warning[SSF](0);
  warning[SD](50);

  // Warning text
  const warningText = mkTxt(400, 170, text, { [F]: '42px', [FF]: A, [CO]: CS.W, [STR]: CS.B, [STT]: 6 }, 51);

  // Flash animation
  s.tweens.add({
    targets: [warning, warningText],
    alpha: 0,
    duration: 500,
    delay: 2500,
    onComplete: () => {
      warning[DS]();
      warningText[DS]();
    }
  });

  s.tweens.add({
    targets: [warning, warningText],
    alpha: 0.3,
    duration: 300,
    yoyo: true,
    repeat: 4
  });
}

function initOrbBalls() {
  // Clear existing balls
  orbitingBalls.forEach(ball => ball[DS]());
  orbitingBalls = [];
  orbitAngle = 0;

  // Create initial balls
  const weapon = getWeapon('o');
  for (let i = 0; i < weapon.c; i++) {
    const ball = s.physics.add.image(p.x, p.y, 'o');

    // Update both hitbox and visual size
    const scale = weapon.b / 8; // 8 is base radius
    ball.setScale(scale);
    ball.body.setCircle(weapon.b);

    ball.setData('lastHitTime', {});
    orbitingBalls.push(ball);
  }

  // Set up overlap (not collider, so balls don't block)
  s.physics.add.overlap(orbitingBalls, en, hitEnBall, null, s);
}

function updOrbBalls(delta) {
  const weapon = getWeapon('o');
  if (!weapon.u) return;

  // Add/remove balls if count changed
  if (orbitingBalls.length < weapon.c) {
    for (let i = orbitingBalls.length; i < weapon.c; i++) {
      const ball = s.physics.add.image(p.x, p.y, 'o');

      // Update both hitbox and visual size
      const scale = weapon.b / 8; // 8 is base radius
      ball.setScale(scale);
      ball.body.setCircle(weapon.b);

      ball.setData('lastHitTime', {});
      orbitingBalls.push(ball);
      s.physics.add.overlap([ball], en, hitEnBall, null, s);
    }
  }

  // Update ball size only when weapon.b changes (avoid unnecessary updates every frame)
  if (weapon.b !== lastOrbSize) {
    lastOrbSize = weapon.b;
    const scale = weapon.b / 8; // 8 is base radius
    orbitingBalls.forEach((ball) => {
      if (!ball || !ball[AC]) return;
      ball.setScale(scale);
      ball.body.setCircle(weapon.b);
    });
  }

  // Update angle
  orbitAngle += (weapon.r * delta) / 1000;

  // Update ball positions
  orbitingBalls.forEach((ball, i) => {
    if (!ball || !ball[AC]) return;
    const angleOffset = (Math.PI * 2 / weapon.c) * i;
    const angle = orbitAngle + angleOffset;
    ball.x = p.x + Math.cos(angle) * weapon.a;
    ball.y = p.y + Math.sin(angle) * weapon.a;
  });
}

function hitEnBall(ball, enemy) {
  if (!ball[AC]) return;
  const weapon = getWeapon('o');
  const now = Date.now();
  const lastHitTimes = ball.getData('lastHitTime');
  const enemyId = enemy.getData('id') || enemy.body.id;

  if (lastHitTimes[enemyId] && now - lastHitTimes[enemyId] < 200) return;

  lastHitTimes[enemyId] = now;
  ball.setData('lastHitTime', lastHitTimes);
  playTone(s, 1100, 0.05);
  procDmg(enemy, ball.x, ball.y, weapon.m);
}

function initAreaDamage() {
  // Create visual circle
  if (adc) adc[DS]();

  adc = s.add.graphics();
  adc[SD](-10); // Above nebula background but below gameplay entities
}

function updAreaDmg(delta) {
  const weapon = getWeapon('a');
  if (!weapon.u) return;

  // Update visual circle position (only set styles when radius changes)
  if (adc) {
    adc.clear();
    if (weapon.a !== lastAreaRadius) {
      lastAreaRadius = weapon.a;
      adc.lineStyle(2, 0xffaa00, 0.8);
      adc.fillStyle(0xffaa00, 0.35);
    }
    adc.fillCircle(p.x, p.y, weapon.a);
    adc.strokeCircle(p.x, p.y, weapon.a);
  }

  // Damage tick
  weapon.l += delta;
  if (weapon.l >= weapon.t) {
    weapon.l = 0;
    let hitAnyEnemy = false;

    // Find en in range
    en.children.entries.forEach(enemy => {
      if (!enemy[AC]) return;
      const dist = Phaser.Math.Distance.Between(p.x, p.y, enemy.x, enemy.y);
      if (dist <= weapon.a) {
        hitAnyEnemy = true;
        procDmg(enemy, p.x, p.y, weapon.p);
      }
    });

    if (hitAnyEnemy) playTone(s, 300, 0.06);
  }
}

function initBoom() {
  const weapon = getWeapon('b');
  avB = weapon.c;
  boomerangs = [];
}

function shootBoomerang() {
  const weapon = getWeapon('b');
  if (!weapon.u || avB <= 0) return;

  const target = findClosestEnemy();
  if (!target) return;

  // Calculate angle toward target
  const angle = Phaser.Math.Angle.Between(p.x, p.y, target.x, target.y);
  const vx = Math.cos(angle) * weapon.s;
  const vy = Math.sin(angle) * weapon.s;

  // Create boomerang sprite
  const boom = s.physics.add.sprite(p.x, p.y, 'b');
  boom.setScale(weapon.z);
  boom.body.setCircle(8 * weapon.z);
  boom.body.setVelocity(vx, vy);

  // Set data
  boom.setData('state', 'outbound');
  boom.setData('startX', p.x);
  boom.setData('startY', p.y);
  boom.setData('distanceTraveled', 0);
  boom.setData('lastHitTimes', {});
  boom.setData('rotation', 0);

  boomerangs.push(boom);
  avB--;

  // Setup collision
  s.physics.add.overlap(boom, en, hitEnBoom, null, s);
  s.physics.add.overlap(boom, p, colBoom, null, s);

  playTone(s, 1200, 0.1);
}

function updBooms(delta) {
  const weapon = getWeapon('b');
  if (!weapon.u) return;

  // Filter out invalid boomerangs and process valid ones
  boomerangs = boomerangs.filter((boom) => {
    if (!boom || !boom[AC]) {
      return false; // Remove invalid boomerangs
    }

    const state = boom.getData('state');
    const startX = boom.getData('startX');
    const startY = boom.getData('startY');

    // Update rotation (spin effect)
    let rotation = boom.getData('rotation') + delta * 0.01;
    boom.setData('rotation', rotation);
    boom.setRotation(rotation);

    // Calculate distance from start
    const dist = Phaser.Math.Distance.Between(startX, startY, boom.x, boom.y);
    boom.setData('distanceTraveled', dist);

    if (state === 'outbound') {
      // Check if reached max distance
      if (dist >= weapon.x) {
        boom.setData('state', 'returning');

        // Start returning to p
        const angleToPlayer = Phaser.Math.Angle.Between(boom.x, boom.y, p.x, p.y);
        boom.body.setVelocity(
          Math.cos(angleToPlayer) * weapon.w,
          Math.sin(angleToPlayer) * weapon.w
        );
      }
    } else if (state === 'returning') {
      // Check distance to p
      const distToPlayer = Phaser.Math.Distance.Between(boom.x, boom.y, p.x, p.y);

      // Collect if close enough (within 30 pixels)
      if (distToPlayer < 30) {
        // Destroy sprite
        boom[DS]();
        // Recharge
        avB++;
        playTone(s, 1500, 0.1);
        return false; // Remove from array
      }

      // Update direction to p (homing)
      const angleToPlayer = Phaser.Math.Angle.Between(boom.x, boom.y, p.x, p.y);
      boom.body.setVelocity(
        Math.cos(angleToPlayer) * weapon.w,
        Math.sin(angleToPlayer) * weapon.w
      );
    }

    return true; // Keep this boomerang
  });
}

function hitEnBoom(boom, enemy) {
  if (!boom[AC]) return;
  const weapon = getWeapon('b');
  const now = Date.now();
  const lastHitTimes = boom.getData('lastHitTimes');
  const enemyId = enemy.getData('id') || enemy.body.id;

  if (lastHitTimes[enemyId] && now - lastHitTimes[enemyId] < 200) return;

  lastHitTimes[enemyId] = now;
  boom.setData('lastHitTimes', lastHitTimes);
  playTone(s, 1000, 0.05);
  procDmg(enemy, boom.x, boom.y, weapon.m);
}

function colBoom(_pObj, boom) {
  if (!boom[AC]) return;
  if (boom.getData('state') !== 'returning') return;

  // Remove from array
  const index = boomerangs.indexOf(boom);
  if (index > -1) {
    boomerangs.splice(index, 1);
  }

  // Destroy sprite
  boom[DS]();

  // Recharge
  avB++;

  playTone(s, 1500, 0.1);
}

function applyDmgFb(enemy, sourceX, sourceY, isCrit = false) {
  if (!enemy[AC]) return;

  // Apply tint based on crit (yellow for crit, red for normal)
  if (isCrit) {
    enemy.setTintFill(C.Y);
    // Scale up briefly for crit
    const originalScale = enemy.getData('originalScale') || 1;
    enemy.setScale(originalScale * 1.3);
    s.time.delayedCall(100, () => {
      if (enemy && enemy[AC]) {
        enemy.clearTint();
        enemy.setScale(originalScale);
      }
    });
  } else {
    enemy.setTintFill(C.R);
    s.time.delayedCall(100, () => {
      if (enemy && enemy[AC]) {
        enemy.clearTint();
      }
    });
  }

  // Calculate knockback direction (away from source)
  const angle = Phaser.Math.Angle.Between(sourceX, sourceY, enemy.x, enemy.y);
  const knockbackForce = isCrit ? stats.kb * 1.5 : stats.kb; // knockback

  // Estimate target position after knockback (velocity * time)
  const kbTime = 0.15; // 150ms
  const newX = enemy.x + Math.cos(angle) * knockbackForce * kbTime;
  const newY = enemy.y + Math.sin(angle) * knockbackForce * kbTime;

  // Check if target position would collide with obstacles
  let wouldCollide = false;
  ob.children.entries.forEach(obstacle => {
    const dist = Phaser.Math.Distance.Between(newX, newY, obstacle.x, obstacle.y);
    if (dist < 36) { // enemy radius (16) + obstacle radius (20)
      wouldCollide = true;
    }
  });

  // Only apply knockback if it won't trap enemy in obstacle
  if (!wouldCollide) {
    enemy.setData('knockbackUntil', gameTime + 150);
    enemy.body.setVelocity(
      Math.cos(angle) * knockbackForce,
      Math.sin(angle) * knockbackForce
    );
  }
}

function playTone(sceneRef, frequency, duration) {
  const ctx = sceneRef.sound.context;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.frequency.value = frequency;
  osc.type = 'square';

  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}
