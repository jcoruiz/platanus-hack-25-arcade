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
let s; // scene

// Music system: bgm=sequencer state, bgmInt=scheduler interval, bgmB=current beat, bgmT=next note time, musicOn=music toggle
let bgm = null, bgmInt = null, bgmB = 0, bgmT = 0, musicOn = true;

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
const AC = 'active', SSF = 'setScrollFactor', SD = 'setDepth', DS = 'destroy', SO = 'setOrigin';
// Repeated UI strings (for minification)
const SPC = 'SPACE', LVL_TXT = 'Level: ', COIN_TXT = 'Coins: ';

// Arcade Controls: P1U/P1D/P1L/P1R(Joy), P1A(Select), START1(Pause)
// Local test keys: WASD/Arrows(move), U/Space(select), P/Enter(pause)
// Deep clone helper (used 4x in code)

const dc = o => JSON.parse(JSON.stringify(o));

// Graphics factory functions (g=graphics reference)
const INST = 'Joy:Move [A]Select [START]Pause [ESC]Back [M]Music';
let g; // graphics
const fs = (c, a = 1) => g.fillStyle(c, a);
const gt = (...a) => (g.generateTexture(...a), g.clear());
const ls = (w, c, a = 1) => g.lineStyle(w, c, a);
// Ultra-short shape factories
const fc = (...a) => g.fillCircle(...a);
const fr = (...a) => g.fillRect(...a);
const ft = (...a) => g.fillTriangle(...a);
const sr = (...a) => g.strokeRect(...a);
const lt = (...a) => g.lineTo(...a);
const fp = () => g.fillPath();

// Enemy type array indices: 0=name, 1=color, 2=hpMult, 3=speedMult, 4=damageMult, 5=xp, 6=coins, 7=dropRate, 8=unlockTime, 9=recipe
const EN = 0, EC = 1, EH = 2, ES = 3, ED = 4, EX = 5, ECN = 6, EDR = 7, EU = 8, ER = 9;
// Shape library for procedural enemy textures
const shp = [
  s => ft(10 * s, 2 * s, 2 * s, 18 * s, 18 * s, 18 * s), // 0: triangle
  s => { ft(10 * s, 2 * s, 2 * s, 10 * s, 10 * s, 18 * s); ft(10 * s, 2 * s, 18 * s, 10 * s, 10 * s, 18 * s); }, // 1: double triangle
  s => { fs(C.W, 1); fc(7 * s, 10 * s, 2 * s); fc(13 * s, 10 * s, 2 * s); }, // 2: eyes y=10
  s => { fs(C.W, 1); fc(8 * s, 8 * s, 2 * s); fc(12 * s, 8 * s, 2 * s); }, // 3: eyes b-type
  s => { fs(C.W, 1); fc(7 * s, 9 * s, 2 * s); fc(13 * s, 9 * s, 2 * s); }, // 4: eyes y=9
  s => { fs(C.W, 1); fc(7 * s, 8 * s, 2 * s); fc(13 * s, 8 * s, 2 * s); }, // 5: eyes y=8
  s => fc(10 * s, 10 * s, 9 * s), // 6: large circle
  (s, c) => { fs(c, 1); fc(10 * s, 6 * s, 3 * s); }, // 7: hat (needs color)
  s => fr(3 * s, 3 * s, 14 * s, 14 * s), // 8: square
  s => fs(C.B, 1), // 9: black fill
  s => fr(6 * s, 13 * s, 8 * s, 2 * s), // 10: mouth bar
  (s, c) => { fs(c, 1); ft(10 * s, 1 * s, 7 * s, 8 * s, 13 * s, 8 * s); ft(10 * s, 19 * s, 7 * s, 12 * s, 13 * s, 12 * s); ft(1 * s, 10 * s, 8 * s, 7 * s, 8 * s, 13 * s); ft(19 * s, 10 * s, 12 * s, 7 * s, 12 * s, 13 * s); }, // 11: 4 spikes
  (s, c) => { fs(c, 1); ft(3 * s, 5 * s, 5 * s, 2 * s, 7 * s, 5 * s); ft(17 * s, 5 * s, 15 * s, 2 * s, 13 * s, 5 * s); }, // 12: horns
  s => fs(C.R, 1), // 13: red fill
  s => fr(7 * s, 14 * s, 6 * s, 2 * s), // 14: red mouth
  s => fr(4 * s, 6 * s, 12 * s, 10 * s), // 15: body rect
  s => { fc(6 * s, 6 * s, 3 * s); fc(14 * s, 6 * s, 3 * s); }, // 16: side circles
  (s, c) => { fs(c, 1); fc(7 * s, 10 * s, 3 * s); fc(13 * s, 10 * s, 3 * s); } // 17: colored eye circles
];
// Enemy types as arrays for compression (with recipes)
const enemyTypes = [
  ['g', C.G, 1, .5, 1, 5, 1, .02, 0, [0, 2]], // tri + eyes
  ['b', 0x0088ff, 1.5, .55, 1.2, 8, 2, .03, 60000, [1, 3]], // double-tri + b-eyes
  ['c', C.Cy, 2, 1.6, 1.4, 10, 2, .035, 120000, [6, 4, { f: 7, p: [C.B] }]], // circle + eyes + black hat
  ['y', C.Y, 2.5, .65, 1.6, 15, 3, .04, 180000, [8, 9, 5, 10]], // square + black + eyes + mouth
  ['o', C.O, 3, .7, 1.8, 20, 3, .045, 240000, [6, { f: 11, p: [0x0088ff] }, 5]], // circle + blue spikes + eyes
  ['r', C.R, 4, .8, 2, 25, 4, .05, 300000, [6, { f: 12, p: [C.Y] }, 13, 4, 14]], // circle + yellow horns + red + eyes + mouth
  ['p', C.P, 5, .9, 2.5, 35, 5, .055, 360000, [15, 16, { f: 17, p: [C.G] }, { f: 17, p: [C.B] }, 2]], // body + circles + green eyes + blue eyes + white eyes
  ['d', 0xff3300, 6, 1, 3, 45, 6, .06, 420000, [6, { f: 12, p: [C.Cy] }, { f: 11, p: [C.Cy] }, 13, 4, 14]], // demon: circle + cyan horns + cyan spikes + red fill + eyes + mouth
  ['s', 0xffaa00, 7, 1.1, 3.5, 55, 7, .065, 480000, [{ f: 11, p: [C.P] }, 6, 2]], // star: purple spikes + circle + eyes
  ['z', 0x00ff88, 8, 1.2, 4, 70, 8, .07, 540000, [8, { f: 12, p: [C.R] }, 13, 5, 14, { f: 7, p: [C.R] }]], // zombie: square + red horns + red fill + eyes + mouth + red hat
  ['v', C.B, 10, 1.3, 5, 100, 10, .08, 600000, [8, 9, { f: 12, p: [C.R] }, { f: 11, p: [C.Cy] }, { f: 17, p: [C.R] }]],
  ['n', C.W, 12, 1.4, 6, 150, 12, .09, 630000, [6, 1, { f: 11, p: [C.Y] }, { f: 17, p: [C.Cy] }, { f: 7, p: [C.P] }]]
];

let unlockedTypes = [];

const iwt = [ // initial weapon types
  // Weapon types: i=id, n=name, d=desc, u=unlocked
  // Projectile: c=count, f=fireRate, m=damage, e=penetration
  { i: 'p', n: 'Projectiles', d: 'Shoots nearest', icon: '🔫', u: false, c: 1, f: 500, m: 10, e: 0 },
  // Orbit Ball: c=count, r=rotSpeed, a=radius, b=ballRadius, m=damage
  { i: 'o', n: 'Orbit Ball', d: 'Defensive orbit', icon: '⚪', u: false, c: 4, r: 2, a: 80, b: 8, m: 15 },
  // Area DMG: a=radius, p=dps, t=tickRate, l=lastTick
  { i: 'a', n: 'Area DMG', d: 'Area damage', icon: '🔴', u: false, a: 75, p: 10, t: 500, l: 0 },
  // Boomerang: c=count, m=damage, s=speed, w=returnSpeed, x=maxDistance, z=size
  { i: 'b', n: 'Boomerang', d: 'Returns', icon: '🪃', u: false, c: 2, m: 12, s: 350, w: 250, x: 150, z: 1 }
];

let weaponTypes = dc(iwt);

const c = [
  {
    n: 'Bananza', // name
    d: 'Bananas', // description
    w: 'b', // weapon
    t: 'p_b', // texture
    pt: 1, // passiveType: damage
    pv: 1.05, // passiveValue
    pD: '+5% Daño/niv' // passiveDescription
  },
  {
    n: 'Medusin',
    d: 'Area Damage',
    w: 'a',
    t: 'p_j',
    pt: 2, // passiveType: regen
    pv: 5, // passiveValue
    pD: '+5 HP/niv' // passiveDescription
  },
  {
    n: 'Ball',
    d: 'Orbs',
    w: 'o',
    t: 'p_o',
    pt: 3, // passiveType: crit
    pv: 0.02, // passiveValue
    pD: '+2% Crit/niv' // passiveDescription
  },
  {
    n: 'Train',
    d: 'Fast shoots',
    w: 'p',
    t: 'p_t',
    pt: 4, // passiveType: speed
    pv: 1.03, // passiveValue
    pD: '+3% Vel/niv' // passiveDescription
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
  mR: 50, // magnetRadius - pickup attraction radius
  xp: 0,
  c: 0, // coins
  lv: 1, // level
  xN: 10, // xpToNext
  k: 0 // enKilled - enemies killed
};

let stats = dc(inS);

let inD = { // initial difficulty
  sR: 500, // spawnRate
  eH: 20, // enemyHp
  eD: 10, // enemyDamage
  eS: 60 // enemySpeed
};

let difficulty = { ...inD };

let ui = { bossData: [] };

// getWeapon
function gtW(id) {
  return weaponTypes.find(w => w.i === id);
}

// Upgrade factory: t=type (0=add,1=mult,2=multMin), w=weaponId
const u = (id, n, d, ic, ml, t, prop, val, min, w) => ({
  id, name: n, desc: d, icon: ic, maxLevel: ml, weaponId: w,
  apply: () => {
    const tgt = w ? gtW(w) : stats;
    if (t === 0) tgt[prop] += val;
    else if (t === 1) tgt[prop] *= val;
    else tgt[prop] = Math.max(min, tgt[prop] * val);
    ul[id] = (ul[id] || 0) + 1;
  }
});

let ml = 20; // maxLevel upgrades
const pUpgrades = [
  u('hr', 'HP Regen', '+10 HP/min', '💚', ml, 0, 'hpRegen', 10),
  { id: 'hp', name: 'Max HP', desc: '+20 Max HP', icon: '❤️', maxLevel: ml, apply: () => { stats.mH += 20; stats.hp += 20; ul.hp = (ul.hp || 0) + 1 } }, // maxHp
  u('s', 'Speed', '+15% Move', '👟', ml, 1, 'sp', 1.15), // speed
  u('kb', 'Knockback', '+30% Enemy', '💨', ml, 1, 'kb', 1.3), // knockback
  u('xp', 'XP Boost', '+0.5x XP', '⭐', ml, 0, 'xpMultiplier', 0.5),
  u('l', 'Luck', '+3% Chest', '🍀', ml, 0, 'lootChance', 0.03),
  u('cc', 'Crit Chance', '+5% Crit', '🎯', ml, 0, 'critChance', 0.05),
  u('cd', 'Crit Damage', '+25% Crit', '💢', ml, 0, 'critDamage', 0.25)
];

const projectileUpgrades = [
  u('ms', 'Multi Shot', '+1 Projectile', '🔫', ml, 0, 'c', 1, 0, 'p'),
  u('fr', 'Fire Rate', '-15% Fire', '⚡', ml, 2, 'f', 0.85, 150, 'p'),
  u('pd', 'Projectile Damage', '+5 Damage', '🗡️', ml, 0, 'm', 5, 0, 'p'),
  u('pn', 'Penetration', '+1 Enemy', '⚔️', ml, 0, 'e', 1, 0, 'p')
];

const orbitingBallUpgrades = [
  u('mb', 'More Balls', '+1 Orb', '⚪', ml, 0, 'c', 1, 0, 'o'),
  u('rs', 'Rotation Speed', '+0.5 Rot', '🌀', ml, 0, 'r', 0.5, 0, 'o'),
  u('bs', 'Ball Size', '+2 Radius', '⭕', ml, 0, 'b', 2, 0, 'o'),
  u('bd', 'Ball Damage', '+8 Damage', '💥', ml, 0, 'm', 8, 0, 'o')
];

const areaDamageUpgrades = [
  u('ar', 'Area Radius', '+15 Range', '🔴', ml, 0, 'a', 15, 0, 'a'),
  u('ad', 'Area DPS', '+3 DPS', '🔥', ml, 0, 'p', 3, 0, 'a'),
  u('at', 'Tick Speed', '-15% Delay', '⚡', ml, 2, 't', 0.85, 150, 'a')
];

const boomerangUpgrades = [
  u('bg', 'Boom Damage', '+8 Damage', '💥', ml, 0, 'm', 8, 0, 'b'),
  u('bz', 'Boom Size', '+30% Size', '📏', ml, 0, 'z', 0.3, 0, 'b'),
  { id: 'bv', name: 'Boom Speed', desc: '+15% Speed', icon: '💨', weaponId: 'b', maxLevel: ml, apply: () => { const w = gtW('b'); w.s = w.w *= 1.15; ul.bv = (ul.bv || 0) + 1 } },
  { id: 'bc', name: 'More Booms', desc: '+1 Boom', icon: '🔄', weaponId: 'b', maxLevel: ml, apply: () => { gtW('b').c++; avB++; ul.bc = (ul.bc || 0) + 1 } }
];

// Helper: create text with common properties
function mkTxt(x, y, t, l, d = 101) { return s.add.text(x, y, t, l)[SO](0.5)[SSF](0)[SD](d); }

// mkChromaticTxt: Create chromatic aberration effect (red/cyan offset + shake/pulse animations)
function mkChromaticTxt(x, y, txt, fontSize, baseDepth) {
  const t1 = mkTxt(x - 4, y - 2, txt, { [F]: fontSize, [FF]: A, [CO]: '#f04', [STR]: '#f04', [STT]: 3 }, baseDepth);
  const t2 = mkTxt(x + 4, y + 2, txt, { [F]: fontSize, [FF]: A, [CO]: '#0ff', [STR]: '#0ff', [STT]: 3 }, baseDepth + 1);
  const t3 = mkTxt(x, y, txt, { [F]: fontSize, [FF]: A, [CO]: CS.W, [STR]: CS.W, [STT]: 3 }, baseDepth + 2);
  return {
    texts: [t1, t2, t3], tweens: [
      s.tweens.add({ targets: [t1, t2, t3], rotation: .035, x: '+=2', duration: 1e3, yoyo: !0, repeat: -1, ease: 'Sine.easeInOut' }),
      s.tweens.add({ targets: t3, scaleX: 1.03, scaleY: 1.03, alpha: .92, duration: 1500, yoyo: !0, repeat: -1, ease: 'Cubic.easeInOut' })
    ]
  };
}

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
    hnED(enemy);
    return true;
  }
  return false;
}

// spnDP: Spawn death particle explosion on enemy kill
function spnDP(x, y, color) {
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

// hnED: Handle enemy death, drops (XP, coins, chests), and particle effects
function hnED(e) {
  const xp = e.getData('xpValue') || 5;
  const cn = e.getData('coinValue') || 1;
  const iB = e.getData('isBoss');
  const dc = e.getData('dropChance') || 0;
  const color = e.getData('enemyColor') || C.W;

  spnDP(e.x, e.y, color);

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

// genBT: Generate boss texture (60x60 HD) using recipe system with 3x scaling
function genBT(type) {
  const key = `boss_${type[EN]}`;
  if (s.textures.exists(key)) return key;

  g = s.add.graphics();
  fs(type[EC], 1);
  type[ER].forEach(r => typeof r === 'number' ? shp[r](3) : shp[r.f](3, ...r.p.length ? r.p : [type[EC]]));

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

// genNeb: Generate procedural nebula background texture using Perlin noise
function genNeb() {
  // Remove old texture if exists
  if (s.textures.exists('nebulaNoise')) {
    s.textures.remove('nebulaNoise');
  }
  const w = 900, h = 700;
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

  // Create sprite with nebula texture (positioned for screen center with parallax)
  const nebula = s.add.image(400, 300, 'nebulaNoise');
  nebula.displayWidth = 1100;
  nebula.displayHeight = 800;
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
  fp();
  fs(0x0088ff, 1); // Blue right half
  g.slice(16, 16, 12, Phaser.Math.DegToRad(270), Phaser.Math.DegToRad(90), false);
  fp();
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

  // Enemy textures (procedural using recipes)
  enemyTypes.forEach(t => {
    fs(t[EC], 1);
    t[ER].forEach(r => typeof r === 'number' ? shp[r](1) : shp[r.f](1, ...r.p.length ? r.p : [t[EC]]));
    gt(`enemy_${t[EN]}`, 20, 20);
  });

  // Generic orb texture with glow (white for tinting)
  fs(C.W, 0.3);
  fc(6, 6, 7);
  fs(C.W, 1);
  fc(6, 6, 4);
  gt('orb', 12, 12);

  // Grid dot texture (tiny point with glow for tinting)
  fs(C.W, 0.5);
  fc(3, 3, 2.5);
  fs(C.W, 1);
  fc(3, 3, 1.5);
  gt('gd', 6, 6);

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

  // Generate 10 asteroid texture variations using Perlin noise
  for (let v = 0; v < 10; v++) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 40;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, 40, 40);
    const ox = Math.random() * 1000;
    const oy = Math.random() * 1000;

    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 40; x++) {
        const dx = x - 20;
        const dy = y - 20;
        const distFromCenter = Math.sqrt(dx * dx + dy * dy);

        if (distFromCenter <= 20) {
          let n = perlin((x + ox) / 12, (y + oy) / 12);
          n = (n + 1) / 2;
          const baseGray = 60 + n * 80;
          const i = (y * 40 + x) * 4;
          imgData.data[i] = baseGray * 0.95;
          imgData.data[i + 1] = baseGray * 0.85;
          imgData.data[i + 2] = baseGray * 1.05;
          imgData.data[i + 3] = 255;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    this.textures.addCanvas(`asteroid${v}`, canvas);
  }

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
    mv: { // Movement (polling) - supports both keyboard and arcade
      w: k('W'),
      a: k('A'),
      s: k('S'),
      d: k('D'),
      // Arcade joystick codes
      p1u: k('P1U'),
      p1d: k('P1D'),
      p1l: k('P1L'),
      p1r: k('P1R')
    },
    mn: { // Menu navigation (events)
      e: k(SPC),
      x: k('ESC'),
      // Arcade button A for selection
      p1a: k('P1A')
    },
    ac: { // Actions (events)
      p: k('P'),
      r: k('R'),
      m: k('M'),
      // Arcade START button for pause/restart
      start: k('START1')
    }
  };

  // Create background (preserved across restarts at depth < 0)
  const rnd = (min, max) => min + Math.random() * (max - min);
  const nc = [0x00ffff, 0xff00ff, 0xffff00];

  // Generate Perlin noise nebula background
  genNeb();

  // Cyberpunk neon grid background with parallax
  [[200, 0x00ffff, 0.3, 0.2], [120, 0xff00ff, 0.5, 0.5], [80, 0xffff00, 0.4, 0.8]].forEach(([sp, c, a, sf], i) => {
    g = this.add.graphics().lineStyle(1, c, a);
    for (let x = 0; x <= 2400; x += sp) g.lineBetween(x, 0, x, 1800);
    for (let y = 0; y <= 1800; y += sp) g.lineBetween(0, y, 2400, y);
    g.setScrollFactor(sf)[SD](-10 + i);
  });

  // Animated Tron-style dots on grids (~130 total)
  [[600, 0x00ffff, 0.2, 25], [360, 0xff00ff, 0.5, 45], [240, 0xffff00, 0.8, 60]].forEach(([sp, c, sf, cnt], gi) => {
    for (let j = 0; j < cnt; j++) {
      const isH = Math.random() < 0.5; // 50% horizontal, 50% vertical
      const line = ~~(rnd(0, 2400) / sp) * sp; // snap to grid line
      const startPos = rnd(0, isH ? 2400 : 1800);
      const d = this.add.image(isH ? startPos : line, isH ? line : startPos, 'gd').setTint(c).setAlpha(0.6 + rnd(0, 0.3)).setScrollFactor(sf)[SD](-10 + gi);
      const spd = 15 + rnd(0, 25); // 15-40 px/sec
      const dur = ((isH ? 2400 : 1800) / spd) * 1000;
      this.tweens.add({ targets: d, [isH ? 'x' : 'y']: isH ? 2400 : 1800, duration: dur, repeat: -1, ease: 'Linear', onRepeat: () => { d[isH ? 'x' : 'y'] = 0; } });
    }
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
  this.time.delayedCall(0, shwMM);
  playTone(this, 440, 0.1);
}

// Initialize gameplay elements (called when starting game, not on load)
function initGameplay() {
  // Clean up existing gameplay objects if they exist (fixes ESC from char select bug)
  if (p) { p.destroy(); p = null; }
  if (en) { en.clear(true, true); }
  if (pr) { pr.clear(true, true); }
  if (xo) { xo.clear(true, true); }
  if (co) { co.clear(true, true); }
  if (wc) { wc.clear(true, true); }
  if (uc) { uc.clear(true, true); }
  if (mg) { mg.clear(true, true); }
  if (hd) { hd.clear(true, true); }
  if (ob) { ob.clear(true, true); }
  if (idleTween) { idleTween.remove(); idleTween = null; }
  if (adc) { adc.destroy(); adc = null; }
  boomerangs = [];
  orbitingBalls = [];

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
    ob.create(100 + Math.random() * 2200, 100 + Math.random() * 1600, 'asteroid' + ~~(Math.random() * 10)).setCircle(20);
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
  crtUI();

  // Keyboard for restart (using central keys + arcade START button)
  const restartHandler = () => { if (!startScreen) restartGame(); };
  keys.ac.r.on('down', restartHandler);
  keys.ac.start.on('down', restartHandler);  // Arcade START button also restarts

  // Keyboard for pause (using central keys + arcade START button)
  let pauseOverlay = null, pauseTexts = null, pauseTweens = null, pauseHint = null;
  const pauseHandler = () => {
    if (!gameOver && !startScreen && !levelingUp && !selectingWeapon) {
      paused = !paused;
      if (paused) {
        s.physics.pause();
        playTone(s, 600, 0.1);
        pauseOverlay = s.add.graphics();
        pauseOverlay.fillStyle(C.B, 0.7).fillRect(0, 0, 800, 600)[SSF](0)[SD](200);

        // Chromatic aberration effect for PAUSED text
        const { texts, tweens } = mkChromaticTxt(400, 300, 'PAUSED', '72px', 200);
        pauseTexts = texts;
        pauseTweens = tweens;
        pauseHint = mkTxt(400, 370, 'Press [P] or [START] to resume', { [F]: '24px', [FF]: A, [CO]: CS.W }, 203);
      } else {
        s.physics.resume();
        playTone(s, 800, 0.1);
        pauseOverlay?.[DS]();
        if (pauseTweens) { pauseTweens.forEach(t => t.stop()); pauseTweens = null; }
        if (pauseTexts) { pauseTexts.forEach(t => t[DS]()); pauseTexts = null; }
        pauseHint?.[DS]();
      }
    }
  };
  keys.ac.p.on('down', pauseHandler);
  keys.ac.start.on('down', pauseHandler);  // Arcade START button also pauses

  // Keyboard for music toggle (using central keys)
  keys.ac.m.on('down', () => {
    musicOn = !musicOn;
    playTone(s, musicOn ? 1200 : 600, 0.1);

    if (musicOn) {
      startMusic();
    } else {
      stopMusic();
    }

    // Show feedback
    const msg = mkTxt(400, 500, musicOn ? '🔊 MUSIC ON' : '🔇 MUSIC OFF', { [F]: '24px', [FF]: A, [CO]: musicOn ? CS.G : CS.R, [STR]: CS.B, [STT]: 4 }, 150);
    s.tweens.add({ targets: msg, alpha: 0, duration: 1500, onComplete: () => msg[DS]() });
  });
}

function update(_time, delta) {
  if (gameOver || levelingUp || selectingWeapon || startScreen || paused || mainMenu) return;
  if (!p || !p.body) return; // Safety check for player initialization

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

  // Player movement (supports both keyboard WASD and arcade joystick)
  p.body.setVelocity(0, 0);
  let moving = false;

  if (wasd.a.isDown || keys.mv.p1l.isDown) {
    p.body.setVelocityX(-stats.sp); // speed
    moving = true;
  }
  if (wasd.d.isDown || keys.mv.p1r.isDown) {
    p.body.setVelocityX(stats.sp); // speed
    moving = true;
  }
  if (wasd.w.isDown || keys.mv.p1u.isDown) {
    p.body.setVelocityY(-stats.sp); // speed
    moving = true;
  }
  if (wasd.s.isDown || keys.mv.p1d.isDown) {
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
  const projectileWeapon = gtW('p');
  if (projectileWeapon.u && shootTimer >= projectileWeapon.f) {
    shootTimer = 0;
    shoot();
  }

  // Auto shoot (boomerang weapon)
  const boomerangWeapon = gtW('b');
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
    difficulty.eH *= 1.1; // enemyHp
    difficulty.eD *= 1.1; // enemyDamage
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

  // Auto-magnetize items within player radius
  const magnetRadiusSq = stats.mR * stats.mR;
  const mag = g => g.children.entries.forEach(o => { if (o[AC] && !o.getData('magnetized')) { const dx = o.x - p.x, dy = o.y - p.y; if (dx * dx + dy * dy <= magnetRadiusSq) o.setData('magnetized', true) } });
  mag(xo); mag(co);

  // Update orbiting balls
  updOrbBalls(delta);

  // Update area damage
  updAreaDmg(delta);

  // Update boomerangs
  updBooms(delta);

  // Update UI
  updUI();

  // Draw UI bars
  drwUI();
}

function shoot() {
  const target = findClosestEnemy();
  if (!target) return;

  const weapon = gtW('p');
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

  const enemy = en.create(x, y, `enemy_${type[EN]}`);
  enemy.setScale(scale);
  enemy.body.setCircle(4 * scale);
  enemy.setCollideWorldBounds(true);
  enemy.setData('hp', difficulty.eH * type[EH] * hpMult); // enemyHp
  enemy.setData('speed', difficulty.eS * type[ES]); // enemySpeed
  enemy.setData('damage', difficulty.eD * type[ED]); // enemyDamage
  enemy.setData('xpValue', type[EX]);
  enemy.setData('coinValue', type[ECN]);
  enemy.setData('dropChance', type[EDR]);
  enemy.setData('enemyColor', type[EC]);
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
  s.cameras.main.shake(100, 0.01);
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
    drwUI();
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
    shwWS(lockedWeapons);
  } else {
    // All weapons unlocked, show 5 normal upgrades
    selectingWeapon = true;
    s.physics.pause();
    showMultipleNormalUpgrades(5);
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
  shwUM('selectingWeapon');
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
      const weapon = gtW(selCh.w);
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

  shwUM('levelingUp');
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
  mkTxt(720, 30, COIN_TXT + stats.c, { [F]: '18px', [FF]: A, [CO]: CS.Go }, 102);

  // Hero sprite with HD texture and purple border
  const heroTex = genHT(selCh.t, true);
  const heroSprite = s.add.sprite(78, 110, heroTex)[SSF](0)[SD](102);

  // Smooth rotation animation
  const rotationTween = s.tweens.add({
    targets: heroSprite,
    angle: 8,
    duration: 1500,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });

  const heroBorder = mkGr(102);
  heroBorder.lineStyle(3, C.P, 1).strokeRect(30, 62, 96, 96);

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
    const iconTxt = s.add.text(x, y, upg.icon, { [F]: '22px' })[SO](0.5)[SSF](0)[SD](102);
    if (!isUpgraded) iconTxt.setTint(0x666666);

    // Level number (only if upgraded)
    if (isUpgraded) {
      mkTxt(x + 12, y + 12, lv.toString(), { [F]: '12px', [FF]: A, [CO]: CS.W }, 102);
    }
  });

  // Weapons section (4 columns, always visible)
  const allWeapons = weaponTypes.map(w => ({ i: w.i, ic: w.icon, tex: w.i === 'o' ? 'o' : w.i === 'b' ? 'b' : 'orb' }));
  allWeapons.forEach((w, i) => {
    const x = 30 + i * 190;
    const y = 175;
    const isUnlocked = gtW(w.i).u;

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
        const uIcon = s.add.text(ux, uy, upg.icon, { [F]: '18px' })[SO](0.5)[SSF](0)[SD](102);
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

// Lightweight selector (options array + optional reroll)
function showSelector(opts, fullPool, hasRr, onSel, headerText = '▸ Choose:') {
  cleanupMenu();
  renderStatsPanel();
  mkTxt(400, 320, headerText, { [F]: '16px', [FF]: A, [CO]: CS.Cy }, 102);

  sI = 0;
  m = [];
  const y = 360;
  let rrBtn = null, rrCost = 10;

  // Reroll button
  if (hasRr) {
    rrBtn = mkGr(101);
    mkTxt(400, 550, `REROLL (${rrCost} Coins)`, { [F]: '18px', [FF]: A, [CO]: stats.c >= rrCost ? CS.Go : '#666' }, 102);
  }

  const renderOpts = (items) => {
    items.forEach((it, i) => {
      const x = 150 + i * 250;
      const btn = mkGr(101);
      btn.fillStyle(C.VG, 1).fillRoundedRect(x - 80, y - 10, 160, 110, 8).lineStyle(3, C.G, 1).strokeRoundedRect(x - 80, y - 10, 160, 110, 8);
      const icon = mkTxt(x, y + 30, it.icon || it.n[0], { [F]: '40px' }, 102);
      const name = mkTxt(x, y + 70, it.name || it.n, { [F]: '16px', [FF]: A, [CO]: CS.W }, 102);
      const desc = mkTxt(x, y + 90, it.desc || it.d, { [F]: '12px', [FF]: A, [CO]: CS.LG }, 102);
      m.push({ btn, it, x, icon, name, desc, iconTween: null });
    });
  };

  const updSel = () => {
    if (pulseTween) { pulseTween.stop(); pulseTween = null; }
    if (pulseOverlay) { pulseOverlay.destroy(); pulseOverlay = null; }

    m.forEach((o, i) => {
      const sel = i === sI;

      // Stop previous icon animation
      if (o.iconTween) { o.iconTween.stop(); o.iconTween = null; }
      o.icon.setScale(1).setAngle(0);

      o.btn.clear();

      if (sel) {
        // Multiple glow layers (hero selector style)
        const a = 0.4;
        o.btn.fillStyle(C.P, a * 0.5).fillRoundedRect(o.x - 85, y - 15, 170, 120, 8);
        o.btn.fillStyle(C.Cy, a * 0.5).fillRoundedRect(o.x - 88, y - 18, 176, 126, 8);
        o.btn.fillStyle(C.P, 0.6).fillRoundedRect(o.x - 77, y - 7, 154, 104, 8).lineStyle(4, C.P, 0.8).strokeRoundedRect(o.x - 77, y - 7, 154, 104, 8);
        o.btn.fillStyle(C.Cy, 0.6).fillRoundedRect(o.x - 82, y - 12, 164, 114, 8).lineStyle(4, C.Cy, 0.8).strokeRoundedRect(o.x - 82, y - 12, 164, 114, 8);
        // Main box with gradient
        o.btn.fillGradientStyle(C.P, C.P, C.B, C.B, 0.75).fillRoundedRect(o.x - 80, y - 10, 160, 110, 8);
        o.btn.lineStyle(4, C.W, 1).strokeRoundedRect(o.x - 80, y - 10, 160, 110, 8);

        // Pulsing overlay
        pulseOverlay = mkGr(103);
        pulseOverlay.fillStyle(C.P, 0.3).fillRoundedRect(o.x - 80, y - 10, 160, 110, 8);
        pulseTween = s.tweens.add({ targets: pulseOverlay, alpha: { from: 0.3, to: 0.6 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        // Animate icon
        o.iconTween = s.tweens.add({
          targets: o.icon,
          scale: { from: 1.0, to: 1.15 },
          angle: { from: -5, to: 5 },
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      } else {
        // Not selected: subtle gradient
        o.btn.fillGradientStyle(C.P, C.P, C.B, C.B, 0.35).fillRoundedRect(o.x - 80, y - 10, 160, 110, 8);
        o.btn.lineStyle(3, C.P, 0.5).strokeRoundedRect(o.x - 80, y - 10, 160, 110, 8);
      }
    });

    if (hasRr && rrBtn) {
      const canRr = stats.c >= rrCost;
      const rrSel = sI === opts.length;
      rrBtn.clear().fillStyle(rrSel ? (canRr ? 0x776600 : 0x444444) : (canRr ? 0x554400 : C.VG), 1).fillRoundedRect(260, 528, 280, 45, 8);
      rrBtn.lineStyle(3, rrSel ? C.Y : (canRr ? CS.Go : C.DB), 1).strokeRoundedRect(260, 528, 280, 45, 8);
    }
  };

  renderOpts(opts);
  updSel();

  // Navigation
  const goL = () => {
    if (!hasRr || sI < opts.length) {
      sI = (sI - 1 + opts.length) % opts.length;
      updSel();
      playTone(s, 800, 0.05);
    }
  };

  const goR = () => {
    if (!hasRr || sI < opts.length) {
      sI = (sI + 1) % opts.length;
      updSel();
      playTone(s, 800, 0.05);
    }
  };

  keys.mv.a.on('down', goL);
  keys.mv.d.on('down', goR);
  keys.mv.p1l.on('down', goL);  // Arcade left
  keys.mv.p1r.on('down', goR);  // Arcade right
  menuKeys.push(keys.mv.a, keys.mv.d, keys.mv.p1l, keys.mv.p1r);

  if (hasRr) {
    const goU = () => {
      if (sI === opts.length) { sI = opts.length - 1; updSel(); playTone(s, 800, 0.05); }
    };
    const goD = () => {
      if (sI < opts.length) { sI = opts.length; updSel(); playTone(s, 800, 0.05); }
    };
    keys.mv.w.on('down', goU);
    keys.mv.s.on('down', goD);
    keys.mv.p1u.on('down', goU);  // Arcade up
    keys.mv.p1d.on('down', goD);  // Arcade down
    menuKeys.push(keys.mv.w, keys.mv.s, keys.mv.p1u, keys.mv.p1d);
  }

  const selectAction = () => {
    if (hasRr && sI === opts.length) {
      if (stats.c < rrCost) return;
      stats.c -= rrCost;
      playTone(s, 1400, 0.1);
      m.forEach(o => o.btn[DS]());
      s.children.list.filter(c => c.depth === 102 && c.text && c.y >= 380 && c.y <= 460).forEach(c => c[DS]());
      const newOpts = [...fullPool].sort(r).slice(0, 3);
      m = [];
      sI = 0;
      renderOpts(newOpts);
      updSel();
      s.children.list.filter(c => c.depth === 102 && c.text && c.text.includes('Coins')).forEach(c => c.setText(COIN_TXT + stats.c));
    } else onSel(m[sI].it);
  };

  keys.mn.e.on('down', selectAction);
  keys.mn.p1a.on('down', selectAction);  // Arcade button A for selection

  menuKeys.push(keys.mn.e, keys.mn.p1a);
}

// Core function: show normal upgrades selector (reusable)
function showNormalUpgradesCore(onSelectCallback, onNoUpgradesCallback, extraHeaderTxt = null) {
  cleanupMenu();

  // Get all available upgrades
  let availableUpgrades = [...pUpgrades];
  if (gtW('p').u) availableUpgrades.push(...projectileUpgrades);
  if (gtW('o').u) availableUpgrades.push(...orbitingBallUpgrades);
  if (gtW('a').u) availableUpgrades.push(...areaDamageUpgrades);
  if (gtW('b').u) availableUpgrades.push(...boomerangUpgrades);
  availableUpgrades = availableUpgrades.filter(u => (ul[u.id] || 0) < u.maxLevel);

  // Handle no upgrades available
  if (availableUpgrades.length === 0) {
    const hpReward = 20;
    stats.hp = Math.min(stats.mH, stats.hp + hpReward);
    playTone(s, 1500, 0.2);
    const msg = mkTxt(400, 300, `¡MAX LEVEL!\n+${hpReward} HP`, { [F]: '10px', [FF]: A, [CO]: CS.Go, [STR]: CS.R, [STT]: 3, [FST]: 'bold' }, 150);
    s.tweens.add({ targets: msg, y: 250, alpha: 0, duration: 800, onComplete: () => msg[DS]() });
    onNoUpgradesCallback();
    return;
  }

  // Build dynamic header (counter + choose prompt)
  const header = extraHeaderTxt ? `▸ Choose: ${extraHeaderTxt}` : '▸ Choose:';

  // Show 3 random options with reroll
  const shuffled = [...availableUpgrades].sort(r).slice(0, 3);
  showSelector(shuffled, availableUpgrades, true, (u) => {
    u.apply();
    playTone(s, 1000, 0.1);
    onSelectCallback(u);
  }, header);
}

// shwUM: Show upgrade menu (level up - choose upgrade or weapon)
function shwUM(stateVar = 'levelingUp') {
  showNormalUpgradesCore(
    // onSelect: close menu and resume
    () => {
      cleanupMenu();
      s.physics.resume();
      if (stateVar === 'levelingUp') levelingUp = false;
      else if (stateVar === 'selectingWeapon') selectingWeapon = false;
    },
    // onNoUpgrades: resume and clear state
    () => {
      s.physics.resume();
      if (stateVar === 'levelingUp') levelingUp = false;
      else if (stateVar === 'selectingWeapon') selectingWeapon = false;
    }
  );
}

function showMultipleNormalUpgrades(remaining) {
  showNormalUpgradesCore(
    // onSelect: recurse or close
    () => {
      if (remaining > 1) {
        showMultipleNormalUpgrades(remaining - 1);
      } else {
        cleanupMenu();
        s.physics.resume();
        selectingWeapon = false;
      }
    },
    // onNoUpgrades: close menu
    () => {
      s.physics.resume();
      selectingWeapon = false;
    },
    // Show counter
    `${remaining} upgrade${remaining > 1 ? 's' : ''} remaining`
  );
}

// shwWS: Show weapon selector (first unlock - choose initial weapon)
function shwWS(weapons) {
  if (gameOver || levelingUp || selectingWeapon || startScreen || paused) return;

  selectingWeapon = true;
  s.physics.pause();

  showSelector(weapons, weapons, false, (w) => {
    w.u = true;
    playTone(s, 1500, 0.2);
    if (w.i === 'o') initOrbBalls();
    else if (w.i === 'a') initAreaDamage();
    else if (w.i === 'b') initBoom();
    cleanupMenu();
    s.physics.resume();
    selectingWeapon = false;
  });
}

// Helper: glitch text triple-layer effect (reusable)
const gt3 = (x, y, txt, sz, d) => [
  s.add.text(x - 2, y - 1, txt, { [F]: sz, [FF]: A, [CO]: '#ff00ff', [FST]: 'bold' })[SO](0.5)[SSF](0)[SD](d),
  s.add.text(x + 2, y + 1, txt, { [F]: sz, [FF]: A, [CO]: CS.Cy, [FST]: 'bold' })[SO](0.5)[SSF](0)[SD](d),
  s.add.text(x, y, txt, { [F]: sz, [FF]: A, [CO]: CS.W, [FST]: 'bold' })[SO](0.5)[SSF](0)[SD](d + 1)
];

// shwMM: Show main menu (START, CREDITS, LEADERBOARD options)
function shwMM() {
  // Clean any previous menu first
  cleanupMenu();

  // Dark background with transparency to show background
  s.add.graphics().fillStyle(C.B, 0.4).fillRect(0, 0, 800, 600)[SSF](0)[SD](100);

  let tlt = '50K Survivors';
  mkChromaticTxt(400, 100, tlt, '80px', 100);

  // Version text
  mkTxt(750, 580, 'V1.20', { [F]: '14px', [FF]: A, [CO]: '#666666' }, 102);

  // Credits
  mkTxt(400, 580, 'Game by: Johnny Olivares', { [F]: '12px', [FF]: A, [CO]: '#555555' }, 102);

  // Control instructions
  mkTxt(400, 540, INST, { [F]: '14px', [FF]: A, [CO]: '#00aaaa' }, 101);

  sI = 0;
  const opts = [
    { y: 320, txt: 'START GAME', fn: () => { mainMenu = false; shwSS(); } },
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
      o.texts.push(s.add.text(400, o.y, o.txt, { [F]: '32px', [FF]: A, [CO]: '#00aaaa' })[SO](0.5)[SSF](0)[SD](101));
    }
  };

  opts.forEach((_, i) => dr(i));

  // Keyboard navigation handlers
  const gu = () => { sI = (sI - 1 + opts.length) % opts.length; opts.forEach((_, i) => dr(i)); playTone(s, 800, 0.05); };
  const gd = () => { sI = (sI + 1) % opts.length; opts.forEach((_, i) => dr(i)); playTone(s, 800, 0.05); };
  const ge = () => { playTone(s, 1200, 0.15); cleanupMenu(); opts[sI].fn(); };

  // Attach listeners to central keys (both keyboard and arcade)
  keys.mv.w.on('down', gu);
  keys.mv.s.on('down', gd);
  keys.mv.p1u.on('down', gu);  // Arcade up
  keys.mv.p1d.on('down', gd);  // Arcade down
  keys.mn.e.on('down', ge);
  keys.mn.p1a.on('down', ge);  // Arcade button A for selection

  // Track keys for cleanup (references only)
  menuKeys.push(keys.mv.w, keys.mv.s, keys.mv.p1u, keys.mv.p1d, keys.mn.e, keys.mn.p1a);
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
      s.add.text(200, y, i + 1, t)[SO](0.5)[SSF](0)[SD](151);
      s.add.text(350, y, e.name, t)[SO](0.5)[SSF](0)[SD](151);
      s.add.text(550, y, e.kills, t)[SO](0.5)[SSF](0)[SD](151);
    });
  }

  mkTxt(400, 540, 'SPC:Back', { [F]: '16px', [FF]: A, [CO]: CS.LG }, 151);

  const ek = s.input.keyboard.addKey(SPC);
  ek.on('down', () => {
    playTone(s, 1000, 0.15);
    cleanupMenu(150);
    shwMM();
  });
  menuKeys.push(ek);
}

// Generate HD hero textures (optimized)
// genHT: Generate hero texture (HD quality for character select)
function genHT(t, sel) {
  const k = `${t}_hd${sel ? '_s' : ''}`;
  if (s.textures.exists(k)) return k;
  g = s.add.graphics();
  // d=scale factor (2.5=normal, 3.5=selected), m=multiplier helper (shadows global m[] array - safe here)
  const d = sel ? 3.5 : 2.5, m = v => v * d;

  if (t === 'p_b') {
    fs(C.Y, 1).fillEllipse(m(16), m(16), m(10), m(24));
    fs(0xffdd00, 1).fillEllipse(m(18), m(16), m(6), m(20));
    fs(0x885500, 1); fr(m(14), m(4), m(4), m(6));
  } else if (t === 'p_j') {
    fs(0xff88dd, 1); fc(m(16), m(12), m(10));
    fs(0xff88dd, 0.7); fr(m(8), m(18), m(3), m(12)); fr(m(13), m(20), m(3), m(10)); fr(m(18), m(19), m(3), m(11));
    fs(C.B, 1); fc(m(12), m(11), m(2)); fc(m(20), m(11), m(2));
  } else if (t === 'p_o') {
    fs(0xcc00ff, 1).slice(m(16), m(16), m(12), 1.57, 4.71, 0); fp();
    fs(0x0088ff, 1).slice(m(16), m(16), m(12), 4.71, 1.57, 0); fp();
    ls(m(2), C.W, 1).lineBetween(m(16), m(4), m(16), m(28));
    fs(C.W, 0.8); fc(m(16), m(16), m(4));
  } else {
    fs(0xe0e0e0, 1).fillRoundedRect(m(6), m(10), m(20), m(12), m(3));
    fs(C.W, 1); ft(m(4), m(16), m(10), m(12), m(10), m(20));
    fs(0x0088ff, 1); fr(m(8), m(15), m(18), m(2));
    fs(C.R, 1); fr(m(8), m(18), m(18), m(2));
    fs(0x4444ff, 0.7); fr(m(12), m(13), m(3), m(3)); fr(m(17), m(13), m(3), m(3)); fr(m(22), m(13), m(3), m(3));
  }

  g.generateTexture(k, 32 * d, 32 * d);
  g.destroy();
  return k;
}

// shwSS: Show start screen (character selection)
function shwSS() {
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
      fs(C.P, a * 0.5).fillRoundedRect(x - 100, y - 150, 200, 300, 10);
      fs(C.Cy, a * 0.5).fillRoundedRect(x - 105, y - 155, 210, 310, 10);
      fs(C.P, 0.6).fillRoundedRect(x - 87, y - 137, 180, 280, 10).lineStyle(5, C.P, 0.8).strokeRoundedRect(x - 87, y - 137, 180, 280, 10);
      fs(C.Cy, 0.6).fillRoundedRect(x - 93, y - 143, 180, 280, 10).lineStyle(5, C.Cy, 0.8).strokeRoundedRect(x - 93, y - 143, 180, 280, 10);
      g.fillGradientStyle(gc, gc, C.B, C.B, 0.75).fillRoundedRect(cx, cy, 180, 280, 10).lineStyle(5, C.W, 1).strokeRoundedRect(cx, cy, 180, 280, 10);
    } else {
      g.fillGradientStyle(gc, gc, C.B, C.B, 0.35).fillRoundedRect(cx, cy, 180, 280, 10).lineStyle(3, gc, 0.5).strokeRoundedRect(cx, cy, 180, 280, 10);
    }
  };

  const sel = (ch) => {
    playTone(s, 1500, 0.2);
    selCh = ch;
    initGameplay();
    p.setTexture(ch.t);
    const w = weaponTypes.find(w => w.i === ch.w);
    if (w) {
      w.u = true;
      if (w.i === 'o') initOrbBalls();
      else if (w.i === 'a') initAreaDamage();
      else if (w.i === 'b') initBoom();
    }
    cleanupMenu();
    startScreen = false;
    s.physics.resume();
    startMusic(); // Start techno music loop
  };

  let glowPulse = 0.4;
  const upd = (shake) => {
    m.forEach((o, i) => {
      const d = i === sI;
      const shakeX = shake ? r() * 4 : 0;
      const shakeY = shake ? r() * 4 : 0;

      dc(o.btn, o.x + shakeX, o.y + shakeY, d, i, glowPulse);

      const hdTex = genHT(o.ch.t, d);
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
        o.texts.push(...gt3(o.x + shakeX, o.y + 83 + shakeY, o.ch.n, '22px', 102));

        // Weapon and passive (bright)
        o.texts.push(s.add.text(o.x + shakeX, o.y + 108 + shakeY, o.ch.d, { [F]: '14px', [FF]: A, [CO]: CS.Cy })[SO](0.5)[SSF](0)[SD](102));
        o.texts.push(s.add.text(o.x + shakeX, o.y + 128 + shakeY, o.ch.pD, { [F]: '12px', [FF]: A, [CO]: '#ff00ff' })[SO](0.5)[SSF](0)[SD](102));
      } else {
        // Unselected: Simple colored text
        const col = ['#ffff00', '#ff00ff', CS.Cy, '#00ff00'][i];
        o.texts.push(s.add.text(o.x, o.y + 83, o.ch.n, { [F]: '18px', [FF]: A, [CO]: col, [FST]: 'bold' })[SO](0.5)[SSF](0)[SD](102));
        o.texts.push(s.add.text(o.x, o.y + 108, o.ch.d, { [F]: '12px', [FF]: A, [CO]: col })[SO](0.5)[SSF](0)[SD](102));
        o.texts.push(s.add.text(o.x, o.y + 128, o.ch.pD, { [F]: '10px', [FF]: A, [CO]: col })[SO](0.5)[SSF](0)[SD](102));
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

  c.forEach((ch, i) => {
    const x = 100 + i * 200;
    const y = 260;
    const btn = mkGr(101);

    // Generate high-res texture (non-selected) and create sprite at scale 1.0
    const hdTexture = genHT(ch.t, false);
    const heroSprite = s.add.sprite(x, y - 50, hdTexture).setScale(1)[SSF](0)[SD](102);

    m.push({ btn, ch: ch, x, y, sprite: heroSprite, texts: [], particles: null });
  });

  // Initial draw
  upd(false);

  mkTxt(400, 540, INST, { [F]: '14px', [FF]: A, [CO]: '#00aaaa' }, 101);

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
  keys.mn.e.on('down', () => sel(m[sI].ch));
  keys.mn.x.on('down', () => {
    playTone(s, 1000, 0.15);
    startScreen = !(mainMenu = true);
    cleanupMenu();
    shwMM();
  });

  // Track keys for cleanup (references only)
  menuKeys.push(keys.mv.a, keys.mv.d, keys.mn.e, keys.mn.x);
}

// crtUI: Create UI text elements at game start
function crtUI() {
  const txt = (x, y, t, c, sz = '16px', d = 99) => {
    const el = s.add.text(x, y, t, { [F]: sz, [FF]: A, [CO]: c })[SSF](0);
    return d ? el[SD](d) : el;
  };
  ui.hpText = txt(10, 10, 'HP:', CS.W);
  ui.xpText = txt(300, 10, 'XP:', CS.W);
  ui.levelText = txt(550, 10, LVL_TXT + '1', CS.Y);
  ui.coinsText = txt(650, 10, COIN_TXT + '0', CS.Go);
  ui.timeText = txt(740, 10, '0:00', CS.Cy);
}

// updUI: Update UI text elements (level, coins, time)
function updUI() {
  ui.levelText.setText(LVL_TXT + stats.lv); // level
  ui.coinsText.setText(COIN_TXT + stats.c);

  const minutes = ~~(gameTime / 60000);
  const seconds = ~~((gameTime % 60000) / 1000);
  ui.timeText.setText(`${minutes}:${('0' + seconds).slice(-2)}`);
}

// drwUI: Draw UI bars (HP, XP, boss bars) - called every frame
function drwUI() {
  gr.clear()[SSF](0)[SD](99);

  // Panel contenedor superior - fondo oscuro semi-transparente
  gr.fillStyle(C.B, 0.6).fillRect(0, 0, 800, 40);
  // Bordes del panel - magenta exterior, cyan interior
  gr.lineStyle(2, C.P, 0.8).strokeRect(1, 1, 798, 38);
  gr.lineStyle(1, C.Cy, 0.6).strokeRect(3, 3, 794, 34);

  // Helper: draw bar with glow, progress fill, highlight, and triple borders
  const bar = (x, y, w, h, v, m, bg, fg, br, bw) => {
    const pw = w * (v / m); // Progress width
    // Outer glow + background
    gr.fillStyle(fg, .2).fillRect(x - 2, y - 2, w + 4, h + 4);
    gr.fillStyle(bg, .8).fillRect(x, y, w, h);
    // Foreground progress + inner highlight
    gr.fillStyle(fg, 1).fillRect(x, y, pw, h);
    pw > 2 && gr.fillStyle(C.W, .3).fillRect(x + 1, y + 1, pw - 2, h * .4);
    // Triple border (outer glow, main, inner)
    gr.lineStyle(bw + 1, fg, .4).strokeRect(x - 1, y - 1, w + 2, h + 2);
    gr.lineStyle(bw, br, 1).strokeRect(x, y, w, h);
    gr.lineStyle(1, C.W, .5).strokeRect(x + 1, y + 1, w - 2, h - 2);
  };

  bar(50, 10, 200, 20, stats.hp, stats.mH, C.DR, C.R, C.W, 2);
  bar(330, 10, 180, 20, stats.xp, stats.xN, 0x004444, C.Cy, C.W, 2);

  // Boss bars: find active bosses, render bars, cleanup dead ones
  const bs = [];
  en.children.entries.forEach(e => e[AC] && e.getData('isBoss') && bs.push(e));
  const rd = [];
  if (bs.length) {
    const w = 600 / bs.length;
    bs.forEach((b, i) => {
      const hp = b.getData('hp'), mh = b.getData('maxHp'), x = 100 + i * w, xc = x + w / 2;
      let u = ui.bossData.find(d => d.enemy === b);
      if (!u) ui.bossData.push(u = { enemy: b, hpText: null, lastHp: null });
      if (!u.hpText || u.lastHp !== hp) {
        u.hpText?.[DS]();
        u.hpText = mkTxt(xc, 62, `${~~hp}/${~~mh}`, { [F]: '14px', [FF]: A, [CO]: CS.W, [STR]: CS.B, [STT]: 3 }, 99);
        u.lastHp = hp;
      }
      bar(x, 50, w - 10, 25, hp, mh, C.DR, C.R, C.Y, 3);
      rd.push(b);
    });
  }
  ui.bossData = ui.bossData.filter(u => { if (!rd.includes(u.enemy)) { u.hpText?.[DS](); return !1 } return !0 });
}

function endGame() {
  gameOver = true;
  stopMusic(); // Stop techno music
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
  const levelText = mkTxt(400, 350, LVL_TXT + stats.lv, { [F]: '28px', [FF]: A, [CO]: CS.Y }); // level
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
  // Stop music first
  stopMusic();

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
  weaponTypes = dc(iwt);
  orbitingBalls = boomerangs = [];
  adc?.[DS]();
  adc = null;
  // Destroy and recreate graphics object to prevent memory leak
  if (gr) { gr.destroy(); gr = null; }
  gr = s.add.graphics();
  unlockedTypes = [enemyTypes[0]];
  stats = dc(inS);
  difficulty = { ...inD };

  // Don't call initGameplay() here - it will be called when user selects character
  s.physics.pause();
  shwMM();
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
  entries.push({ name: name.trim(), kills });
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
  // Chromatic aberration title
  const hsTxt = qualForLb(stats.k) ? 'NEW HIGH SCORE!' : 'ENTER YOUR NAME';
  mkChromaticTxt(400, 80, hsTxt, '48px', 151);
  mkTxt(400, 150, `Kills: ${stats.k}`, { [F]: '24px', [FF]: A, [CO]: CS.G }, 151);
  mkTxt(400, 180, LVL_TXT + stats.lv + `  Time: ${mins}:${('0' + secs).slice(-2)}`, { [F]: '20px', [FF]: A, [CO]: CS.W }, 151); // level

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
  mkTxt(400, 380, 'WS:Letter AD:Move SPC:OK', { [F]: '18px', [FF]: A, [CO]: '#aaaaaa' }, 151);
  mkTxt(400, 410, 'SPC:Submit', { [F]: '18px', [FF]: A, [CO]: '#ffaa00' }, 151);

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
  mkTxt(400, 550, 'R:Restart', { [F]: '24px', [FF]: A, [CO]: CS.W }, 151);
}

function updUnlockTypes() {
  enemyTypes.forEach(type => {
    if (gameTime >= type[EU] && !unlockedTypes.includes(type)) {
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

  const bossTexKey = genBT(type);
  x = Math.max(30, Math.min(2370, x));
  y = Math.max(30, Math.min(1770, y));
  const boss = en.create(x, y, bossTexKey);
  boss.body.setCircle(30);
  boss.setCollideWorldBounds(true);
  const bhp = difficulty.eH * type[EH] * 10; // enemyHp
  boss.setData('hp', bhp);
  boss.setData('maxHp', bhp);
  boss.setData('speed', difficulty.eS * type[ES] * 0.7); // enemySpeed
  boss.setData('damage', difficulty.eD * type[ED] * 2); // enemyDamage
  boss.setData('xpValue', type[EX] * 10);
  boss.setData('coinValue', type[ECN] * 10);
  boss.setData('dropChance', type[EDR]);
  boss.setData('enemyColor', type[EC]);
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
  const weapon = gtW('o');
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
  const weapon = gtW('o');
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
  const weapon = gtW('o');
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
  adc[SD](-50); // Above all background elements but below gameplay entities
}

function updAreaDmg(delta) {
  const weapon = gtW('a');
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
  const weapon = gtW('b');
  avB = weapon.c;
  boomerangs = [];
}

function shootBoomerang() {
  const weapon = gtW('b');
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
  const weapon = gtW('b');
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
  const weapon = gtW('b');
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
    // Show "CRIT!" popup above enemy (using world coordinates, not UI coordinates)
    const critText = s.add.text(enemy.x, enemy.y - 30, 'CRIT!', { [F]: '10px', [FF]: A, [CO]: CS.Go, [STR]: CS.R, [STT]: 3, [FST]: 'bold' })[SO](0.5)[SD](105);
    s.tweens.add({ targets: critText, y: enemy.y - 60, alpha: 0, duration: 800, onComplete: () => critText[DS]() });
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

// Techno Music System - Procedural 140 BPM loop
// Patterns: bp=bass, sp=synth chords (note offsets from root)
const bp = [1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0]; // 16-step bass pattern
const sp = [[0, 7, 12], [0, 3, 7], [0, 5, 9], [0, 7, 12]]; // Em, C, Am, Em chord progression
const sn = [64, 60, 57, 64]; // Root notes: E, C, A, E (MIDI)

// Kick drum with punch (FM synthesis + pitch bend)
function playKick(ctx, time) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();

  osc.connect(gain);
  gain.connect(comp);
  comp.connect(ctx.destination);

  // Pitch bend for punch: 50Hz -> 35Hz
  osc.frequency.setValueAtTime(50, time);
  osc.frequency.exponentialRampToValueAtTime(35, time + 0.05);
  osc.type = 'sine';

  // Aggressive ADSR envelope
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(0.5, time + 0.001); // Instant attack
  gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15); // Fast decay

  // Compression for punch
  comp.threshold.setValueAtTime(-10, time);
  comp.ratio.setValueAtTime(12, time);

  osc.start(time);
  osc.stop(time + 0.2);
}

// Bassline (square wave + resonant filter)
function playBass(ctx, time, noteIndex) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  // Note sequence: E1, G1, A1, C2
  const notes = [41.2, 49, 55, 65.4]; // Hz
  osc.frequency.value = notes[noteIndex % 4];
  osc.type = 'square';

  // Resonant low-pass filter
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(800, time);
  filter.Q.value = 8;

  // Plucky envelope
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(0.15, time + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

  osc.start(time);
  osc.stop(time + 0.12);
}

// Hi-hat (white noise + high-pass filter)
function playHiHat(ctx, time, open) {
  const bufferSize = 2048;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  // Generate white noise
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  noise.buffer = buffer;
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  // High-pass filter
  filter.type = 'highpass';
  filter.frequency.value = open ? 8000 : 10000;

  // Envelope (open vs closed)
  const duration = open ? 0.15 : 0.05;
  const volume = open ? 0.08 : 0.05;

  gain.gain.setValueAtTime(volume, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

  noise.start(time);
  noise.stop(time + duration);
}

// Clap/Snare (pink noise + multi-transient)
function playClap(ctx, time) {
  // Create 3 layered transients for realistic clap
  for (let i = 0; i < 3; i++) {
    const bufferSize = 2048;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Pink noise (filtered white noise)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let j = 0; j < bufferSize; j++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[j] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      data[j] *= 0.11;
      b6 = white * 0.115926;
    }

    const noise = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    noise.buffer = buffer;
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    // Band-pass filter around 2kHz
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 1;

    // Envelope for this layer
    const layerTime = time + (i * 0.03);
    gain.gain.setValueAtTime(0.15, layerTime);
    gain.gain.exponentialRampToValueAtTime(0.01, layerTime + 0.12);

    noise.start(layerTime);
    noise.stop(layerTime + 0.12);
  }
}

// Synth pad (detuned saw waves + chorus effect)
function playSynth(ctx, time, chordIndex) {
  const rootNote = sn[chordIndex % 4]; // MIDI note
  const offsets = sp[chordIndex % 4]; // Chord intervals

  // Create 3 notes per chord, each with 2 detuned oscillators
  offsets.forEach((offset, idx) => {
    const midiNote = rootNote + offset;
    const freq = 440 * Math.pow(2, (midiNote - 69) / 12); // MIDI to Hz

    // Two detuned oscillators for chorus
    for (let detune of [-7, 7]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.value = freq;
      osc.detune.value = detune; // ±7 cents
      osc.type = 'sawtooth';

      // Low-pass filter with LFO (wobble)
      filter.type = 'lowpass';
      const wobble = Math.sin(time * Math.PI * 0.5) * 300 + 1200;
      filter.frequency.setValueAtTime(wobble, time);
      filter.Q.value = 2;

      // Pad envelope (slow attack, long release)
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.04, time + 0.3); // Slow attack
      gain.gain.setValueAtTime(0.04, time + 3.5);
      gain.gain.linearRampToValueAtTime(0, time + 4); // Fade at end of chord

      osc.start(time);
      osc.stop(time + 4);
    }
  });
}

// Main music scheduler (called every 25ms)
function scheduleMusicNotes() {
  if (!bgm || paused || gameOver || startScreen || mainMenu) return;

  const ctx = bgm;
  const lookahead = 0.1; // Schedule 100ms ahead
  const beatDuration = 60 / 140; // 140 BPM = 0.4286s per beat

  // Initialize timing on first call
  if (bgmT === 0) bgmT = ctx.currentTime;

  // Schedule all notes within lookahead window
  while (bgmT < ctx.currentTime + lookahead) {
    const beat = bgmB % 32; // 32 beats per loop (8 bars of 4/4)

    // KICK: 4-on-the-floor (every beat)
    if (beat % 4 === 0 || beat % 4 === 1 || beat % 4 === 2 || beat % 4 === 3) {
      playKick(ctx, bgmT);
    }

    // CLAP: On beats 2 and 4 of each bar
    if (beat % 8 === 4) {
      playClap(ctx, bgmT);
    }

    // BASS: Follow 16-step pattern (plays on 16th-note grid)
    const bassStep = (beat * 2) % 16; // Convert beat to 16th note
    if (bp[bassStep]) {
      playBass(ctx, bgmT, Math.floor(beat / 8)); // Change note every 2 bars
    }

    // HI-HATS: 16th notes (4 per beat)
    for (let i = 0; i < 4; i++) {
      const hhatTime = bgmT + (i * beatDuration / 4);
      const isOpen = (i === 3 && beat % 2 === 1); // Open on off-beats
      playHiHat(ctx, hhatTime, isOpen);
    }

    // SYNTH: Change chord every 2 bars (8 beats)
    if (beat % 8 === 0) {
      playSynth(ctx, bgmT, Math.floor(beat / 8));
    }

    // Advance to next beat
    bgmT += beatDuration;
    bgmB = (bgmB + 1) % 32; // Loop after 32 beats
  }
}

// Start music system
function startMusic() {
  if (bgm || !s || !musicOn) return;
  bgm = s.sound.context;
  bgmB = 0;
  bgmT = 0;
  if (bgmInt) clearInterval(bgmInt);
  bgmInt = setInterval(scheduleMusicNotes, 25); // High-precision scheduling
}

// Stop music system
function stopMusic() {
  if (bgmInt) clearInterval(bgmInt);
  bgmInt = null;
  bgm = null;
  bgmB = 0;
  bgmT = 0;
}
