// Bullet Heaven - Vampire Survivors style arcade game
// Survive endless waves, level up, and get stronger!

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

// Game state
let player, cursors, enemies, projectiles, xpOrbs, obstacles, weaponChests, upgradeChests, magnets, graphics;
let areaDamageCircle = null;
let gameOver = false, levelingUp = false, selectingWeapon = false, startScreen = true, showStats = false, paused = false;
let gameTime = 0, shootTimer = 0, spawnTimer = 0, regenTimer = 0;
let waveTimer = 0, bossTimer = 0;
let nextWaveTime = 60000, nextBossTime = 120000;
let warningActive = false;
let scene;

// Menu selection state
let selectedIndex = 0;
let menuOptions = [];
let menuKeys = [];

// Upgrade level tracking
let upgradeLevels = {};

// Enemy types configuration
const enemyTypes = [
  { name: 'green', color: 0x00ff00, hpMult: 1.0, speedMult: 1.0, damageMult: 1.0, xp: 5, dropChance: 0.02, unlockTime: 0 },
  { name: 'blue', color: 0x0088ff, hpMult: 1.5, speedMult: 0.95, damageMult: 1.2, xp: 8, dropChance: 0.03, unlockTime: 20000 },
  { name: 'cyan', color: 0x00ffff, hpMult: 2.0, speedMult: 1.05, damageMult: 1.4, xp: 10, dropChance: 0.035, unlockTime: 40000 },
  { name: 'yellow', color: 0xffff00, hpMult: 2.5, speedMult: 0.9, damageMult: 1.6, xp: 15, dropChance: 0.04, unlockTime: 60000 },
  { name: 'orange', color: 0xff8800, hpMult: 3.0, speedMult: 1.1, damageMult: 1.8, xp: 20, dropChance: 0.045, unlockTime: 90000 },
  { name: 'red', color: 0xff0000, hpMult: 4.0, speedMult: 0.85, damageMult: 2.0, xp: 25, dropChance: 0.05, unlockTime: 120000 },
  { name: 'purple', color: 0xff00ff, hpMult: 5.0, speedMult: 1.15, damageMult: 2.5, xp: 35, dropChance: 0.055, unlockTime: 150000 }
];

let unlockedTypes = [];

// Weapon system
const weaponTypes = [
  {
    id: 'projectile',
    name: 'Proyectiles',
    desc: 'Dispara automáticamente al enemigo más cercano',
    unlocked: false,
    count: 1,
    fireRate: 500,
    damage: 10,
    penetration: 0
  },
  {
    id: 'orbitingBall',
    name: 'Bola Orbital',
    desc: 'Bola que gira alrededor del jugador y daña enemigos',
    unlocked: false,
    count: 2,
    rotSpeed: 2,
    radius: 80,
    ballRadius: 8,
    damage: 15
  },
  {
    id: 'areaDamage',
    name: 'Área de Daño',
    desc: 'Daña continuamente a enemigos cercanos',
    unlocked: false,
    radius: 150,
    dps: 10,
    tickRate: 500,
    lastTick: 0
  },
  {
    id: 'boomerang',
    name: 'Boomerangs',
    desc: 'Boomerangs que retornan tras alcanzar objetivo',
    unlocked: false,
    count: 2,
    damage: 12,
    speed: 350,
    returnSpeed: 250,
    maxDistance: 300,
    size: 1
  }
];

// Character selection
const characters = [
  {
    id: 'banana',
    name: 'Bananza',
    desc: 'Boomerangs retornantes',
    weapon: 'boomerang',
    texture: 'player',
    emoji: '🍌',
    passiveType: 'damage',
    passiveValue: 1.05,
    passiveDesc: '+5% Weapon Damage/nivel'
  },
  {
    id: 'jellyfish',
    name: 'Medusin',
    desc: 'Daño por área',
    weapon: 'areaDamage',
    texture: 'player_jellyfish',
    emoji: '🎐',
    passiveType: 'regen',
    passiveValue: 5,
    passiveDesc: '+5 HP Regen/nivel'
  },
  {
    id: 'orb',
    name: 'Lab Studio',
    desc: 'Bolas orbitales',
    weapon: 'orbitingBall',
    texture: 'player_orb',
    emoji: '🔮',
    passiveType: 'crit',
    passiveValue: 0.02,
    passiveDesc: '+2% Crit Chance/nivel'
  },
  {
    id: 'bullettrain',
    name: 'Tren Bala',
    desc: 'Disparos rápidos',
    weapon: 'projectile',
    texture: 'player_bullettrain',
    emoji: '🚄',
    passiveType: 'speed',
    passiveValue: 1.03,
    passiveDesc: '+3% Velocidad/nivel'
  }
];

let selectedCharacter = null;

let orbitingBalls = [];
let orbitAngle = 0;

let boomerangs = [];
let availableBoomerangs = 0;
let boomerangShootTimer = 0;

// Player stats
let stats = {
  hp: 100,
  maxHp: 100,
  speed: 150,
  knockback: 100,
  hpRegen: 0,
  xpMultiplier: 1.0,
  lootChance: 1.0,
  critChance: 0.05,
  critDamage: 1.5,
  xp: 0,
  level: 1,
  xpToNext: 10,
  enemiesKilled: 0
};

// Difficulty scaling
let difficulty = {
  spawnRate: 2000,
  enemyHp: 20,
  enemyDamage: 10,
  enemySpeed: 80
};

// UI elements
let ui = {};
let statsPanel = null;
let wasPausedBeforeStats = false;

// Helper to get weapon by id
function getWeapon(id) {
  return weaponTypes.find(w => w.id === id);
}

// Upgrade options (organized by category)
const playerUpgrades = [
  { id: 'speed', name: 'Speed', desc: '+15% Move Speed', icon: '👟', maxLevel: 8, apply: () => { stats.speed *= 1.15; upgradeLevels['speed'] = (upgradeLevels['speed'] || 0) + 1; } },
  { id: 'maxhp', name: 'Max HP', desc: '+20 Max HP', icon: '❤️', maxLevel: 10, apply: () => { stats.maxHp += 20; stats.hp += 20; upgradeLevels['maxhp'] = (upgradeLevels['maxhp'] || 0) + 1; } },
  { id: 'knockback', name: 'Knockback', desc: '+30% Enemy Pushback', icon: '💨', maxLevel: 6, apply: () => { stats.knockback *= 1.3; upgradeLevels['knockback'] = (upgradeLevels['knockback'] || 0) + 1; } },
  { id: 'hpregen', name: 'HP Regen', desc: '+10 HP/min', icon: '💚', maxLevel: 10, apply: () => { stats.hpRegen += 10; upgradeLevels['hpregen'] = (upgradeLevels['hpregen'] || 0) + 1; } },
  { id: 'xpboost', name: 'XP Boost', desc: '+50% XP Gain', icon: '⭐', maxLevel: 8, apply: () => { stats.xpMultiplier += 0.5; upgradeLevels['xpboost'] = (upgradeLevels['xpboost'] || 0) + 1; } },
  { id: 'loot', name: 'Luck', desc: '+50% Chest Drop Rate', icon: '🍀', maxLevel: 10, apply: () => { stats.lootChance += 0.5; upgradeLevels['loot'] = (upgradeLevels['loot'] || 0) + 1; } },
  { id: 'critchance', name: 'Crit Chance', desc: '+5% Crit Probability', icon: '🎯', maxLevel: 10, apply: () => { stats.critChance += 0.05; upgradeLevels['critchance'] = (upgradeLevels['critchance'] || 0) + 1; } },
  { id: 'critdamage', name: 'Crit Damage', desc: '+25% Crit Multiplier', icon: '💢', maxLevel: 10, apply: () => { stats.critDamage += 0.25; upgradeLevels['critdamage'] = (upgradeLevels['critdamage'] || 0) + 1; } }
];

const projectileUpgrades = [
  { id: 'multishot', name: 'Multi Shot', desc: '+1 Projectile', icon: '🔫', weaponId: 'projectile', maxLevel: 10, apply: () => { getWeapon('projectile').count++; upgradeLevels['multishot'] = (upgradeLevels['multishot'] || 0) + 1; } },
  { id: 'firerate', name: 'Fire Rate', desc: '-15% Fire Delay', icon: '⚡', weaponId: 'projectile', maxLevel: 8, apply: () => { getWeapon('projectile').fireRate = Math.max(150, getWeapon('projectile').fireRate * 0.85); upgradeLevels['firerate'] = (upgradeLevels['firerate'] || 0) + 1; } },
  { id: 'projdamage', name: 'Projectile Damage', desc: '+5 Damage', icon: '🗡️', weaponId: 'projectile', maxLevel: 10, apply: () => { getWeapon('projectile').damage += 5; upgradeLevels['projdamage'] = (upgradeLevels['projdamage'] || 0) + 1; } },
  { id: 'penetration', name: 'Penetration', desc: '+1 Enemy Pierced', icon: '⚔️', weaponId: 'projectile', maxLevel: 5, apply: () => { getWeapon('projectile').penetration++; upgradeLevels['penetration'] = (upgradeLevels['penetration'] || 0) + 1; } }
];

const orbitingBallUpgrades = [
  { id: 'moreballs', name: 'More Balls', desc: '+1 Orbiting Ball', icon: '⚪', weaponId: 'orbitingBall', maxLevel: 10, apply: () => { getWeapon('orbitingBall').count++; upgradeLevels['moreballs'] = (upgradeLevels['moreballs'] || 0) + 1; } },
  { id: 'rotspeed', name: 'Rotation Speed', desc: '+0.5 Rotation Speed', icon: '🌀', weaponId: 'orbitingBall', maxLevel: 10, apply: () => { getWeapon('orbitingBall').rotSpeed += 0.5; upgradeLevels['rotspeed'] = (upgradeLevels['rotspeed'] || 0) + 1; } },
  { id: 'ballsize', name: 'Ball Size', desc: '+2 Ball Radius', icon: '⭕', weaponId: 'orbitingBall', maxLevel: 8, apply: () => { getWeapon('orbitingBall').ballRadius += 2; upgradeLevels['ballsize'] = (upgradeLevels['ballsize'] || 0) + 1; } },
  { id: 'balldamage', name: 'Ball Damage', desc: '+8 Ball Damage', icon: '💥', weaponId: 'orbitingBall', maxLevel: 10, apply: () => { getWeapon('orbitingBall').damage += 8; upgradeLevels['balldamage'] = (upgradeLevels['balldamage'] || 0) + 1; } }
];

const areaDamageUpgrades = [
  { id: 'arearadius', name: 'Area Radius', desc: '+30 Area Range', icon: '🔴', weaponId: 'areaDamage', maxLevel: 5, apply: () => { getWeapon('areaDamage').radius += 30; upgradeLevels['arearadius'] = (upgradeLevels['arearadius'] || 0) + 1; } },
  { id: 'areadps', name: 'Area DPS', desc: '+3 Damage/Second', icon: '🔥', weaponId: 'areaDamage', maxLevel: 10, apply: () => { getWeapon('areaDamage').dps += 3; upgradeLevels['areadps'] = (upgradeLevels['areadps'] || 0) + 1; } },
  { id: 'areatickrate', name: 'Tick Speed', desc: '-15% Pulse Delay', icon: '⚡', weaponId: 'areaDamage', maxLevel: 8, apply: () => { getWeapon('areaDamage').tickRate = Math.max(150, getWeapon('areaDamage').tickRate * 0.85); upgradeLevels['areatickrate'] = (upgradeLevels['areatickrate'] || 0) + 1; } }
];

const boomerangUpgrades = [
  { id: 'boomerangdamage', name: 'Boomerang Damage', desc: '+8 Damage', icon: '💥', weaponId: 'boomerang', maxLevel: 10, apply: () => { getWeapon('boomerang').damage += 8; upgradeLevels['boomerangdamage'] = (upgradeLevels['boomerangdamage'] || 0) + 1; } },
  { id: 'boomerangsize', name: 'Boomerang Size', desc: '+30% Size', icon: '📏', weaponId: 'boomerang', maxLevel: 8, apply: () => { getWeapon('boomerang').size += 0.3; upgradeLevels['boomerangsize'] = (upgradeLevels['boomerangsize'] || 0) + 1; } },
  { id: 'boomerangspeed', name: 'Boomerang Speed', desc: '+15% Speed', icon: '💨', weaponId: 'boomerang', maxLevel: 8, apply: () => { getWeapon('boomerang').speed *= 1.15; getWeapon('boomerang').returnSpeed *= 1.15; upgradeLevels['boomerangspeed'] = (upgradeLevels['boomerangspeed'] || 0) + 1; } },
  { id: 'boomerangcount', name: 'More Boomerangs', desc: '+1 Boomerang', icon: '🪃', weaponId: 'boomerang', maxLevel: 5, apply: () => { getWeapon('boomerang').count++; availableBoomerangs++; upgradeLevels['boomerangcount'] = (upgradeLevels['boomerangcount'] || 0) + 1; } }
];

// Rare upgrades (more powerful versions)
const rareUpgrades = [
  { id: 'rare_tripleshot', name: 'Triple Shot', desc: '+3 Projectiles', icon: '🔫🔫', weaponId: 'projectile', maxLevel: 2, apply: () => { getWeapon('projectile').count += 3; upgradeLevels['rare_tripleshot'] = (upgradeLevels['rare_tripleshot'] || 0) + 1; } },
  { id: 'rare_rapidfire', name: 'Rapid Fire', desc: '-40% Fire Delay', icon: '⚡⚡', weaponId: 'projectile', maxLevel: 3, apply: () => { getWeapon('projectile').fireRate = Math.max(100, getWeapon('projectile').fireRate * 0.6); upgradeLevels['rare_rapidfire'] = (upgradeLevels['rare_rapidfire'] || 0) + 1; } },
  { id: 'rare_massdmg', name: 'Massive Damage', desc: '+30 Projectile Damage', icon: '🗡️🗡️', weaponId: 'projectile', maxLevel: 3, apply: () => { getWeapon('projectile').damage += 30; upgradeLevels['rare_massdmg'] = (upgradeLevels['rare_massdmg'] || 0) + 1; } },
  { id: 'rare_doubleballs', name: 'Double Balls', desc: '+2 Orbiting Balls', icon: '⚪⚪', weaponId: 'orbitingBall', maxLevel: 2, apply: () => { getWeapon('orbitingBall').count += 2; upgradeLevels['rare_doubleballs'] = (upgradeLevels['rare_doubleballs'] || 0) + 1; } },
  { id: 'rare_megaballdmg', name: 'Mega Ball Damage', desc: '+25 Ball Damage', icon: '💥💥', weaponId: 'orbitingBall', maxLevel: 3, apply: () => { getWeapon('orbitingBall').damage += 25; upgradeLevels['rare_megaballdmg'] = (upgradeLevels['rare_megaballdmg'] || 0) + 1; } },
  { id: 'rare_hugearea', name: 'Huge Area', desc: '+100 Area Range', icon: '🔴🔴', weaponId: 'areaDamage', maxLevel: 2, apply: () => { getWeapon('areaDamage').radius += 100; upgradeLevels['rare_hugearea'] = (upgradeLevels['rare_hugearea'] || 0) + 1; } },
  { id: 'rare_devastdps', name: 'Devastating DPS', desc: '+15 Damage/Second', icon: '🔥🔥', weaponId: 'areaDamage', maxLevel: 3, apply: () => { getWeapon('areaDamage').dps += 15; upgradeLevels['rare_devastdps'] = (upgradeLevels['rare_devastdps'] || 0) + 1; } }
];

function preload() {
  // Create simple textures programmatically
  const g = this.add.graphics();

  // Player texture (banana shape)
  g.fillStyle(0xffff00, 1);
  g.fillEllipse(16, 16, 10, 24);
  g.fillStyle(0xffdd00, 1);
  g.fillEllipse(18, 16, 6, 20);
  g.fillStyle(0x885500, 1);
  g.fillRect(14, 4, 4, 6);
  g.generateTexture('player', 32, 32);
  g.clear();

  // Medusa/Jellyfish texture
  g.fillStyle(0xff88dd, 1); // Pink body
  g.fillCircle(16, 12, 10); // Head/body
  // Tentacles
  g.fillStyle(0xff88dd, 0.7);
  g.fillRect(8, 18, 3, 12);
  g.fillRect(13, 20, 3, 10);
  g.fillRect(18, 19, 3, 11);
  // Eyes
  g.fillStyle(0x000000, 1);
  g.fillCircle(12, 11, 2);
  g.fillCircle(20, 11, 2);
  g.generateTexture('player_jellyfish', 32, 32);
  g.clear();

  // Orbe texture (half purple, half blue)
  g.fillStyle(0xcc00ff, 1); // Purple left half
  g.slice(16, 16, 12, Phaser.Math.DegToRad(90), Phaser.Math.DegToRad(270), false);
  g.fillPath();
  g.fillStyle(0x0088ff, 1); // Blue right half
  g.slice(16, 16, 12, Phaser.Math.DegToRad(270), Phaser.Math.DegToRad(90), false);
  g.fillPath();
  // Dividing line
  g.lineStyle(2, 0xffffff, 1);
  g.lineBetween(16, 4, 16, 28);
  // Center glow
  g.fillStyle(0xffffff, 0.8);
  g.fillCircle(16, 16, 4);
  g.generateTexture('player_orb', 32, 32);
  g.clear();

  // Bullet Train texture
  g.fillStyle(0xe0e0e0, 1); // Silver body
  g.fillRoundedRect(6, 10, 20, 12, 3);
  g.fillStyle(0xffffff, 1); // White front
  g.fillTriangle(4, 16, 10, 12, 10, 20);
  g.fillStyle(0x0088ff, 1); // Blue stripe
  g.fillRect(8, 15, 18, 2);
  g.fillStyle(0xff0000, 1); // Red stripe
  g.fillRect(8, 18, 18, 2);
  // Windows
  g.fillStyle(0x4444ff, 0.7);
  g.fillRect(12, 13, 3, 3);
  g.fillRect(17, 13, 3, 3);
  g.fillRect(22, 13, 3, 3);
  g.generateTexture('player_bullettrain', 32, 32);
  g.clear();

  // Boomerang texture
  g.lineStyle(0);
  g.fillStyle(0xffaa00, 1); // Orange
  g.beginPath();
  g.moveTo(8, 12);
  g.lineTo(8, 4);
  g.lineTo(12, 8);
  g.lineTo(12, 12);
  g.closePath();
  g.fillPath();
  g.beginPath();
  g.moveTo(12, 12);
  g.lineTo(20, 12);
  g.lineTo(16, 8);
  g.lineTo(12, 8);
  g.closePath();
  g.fillPath();
  // Outline
  g.lineStyle(2, 0x884400, 1);
  g.strokeRect(8, 4, 4, 8);
  g.strokeRect(12, 8, 8, 4);
  g.generateTexture('boomerang', 16, 16);
  g.clear();

  // Enemy textures (one for each type) - different shapes
  enemyTypes.forEach(type => {
    // Normal enemy
    g.fillStyle(type.color, 1);
    if (type.name === 'green') {
      // Triangle
      g.fillTriangle(10, 2, 2, 18, 18, 18);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(7, 10, 2);
      g.fillCircle(13, 10, 2);
    } else if (type.name === 'blue') {
      // Diamond
      g.fillTriangle(10, 2, 2, 10, 10, 18);
      g.fillTriangle(10, 2, 18, 10, 10, 18);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(8, 8, 2);
      g.fillCircle(12, 8, 2);
    } else if (type.name === 'cyan') {
      // Pentagon-ish
      g.fillCircle(10, 10, 9);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(7, 9, 2);
      g.fillCircle(13, 9, 2);
      g.fillStyle(type.color, 0.7);
      g.fillCircle(10, 6, 3);
    } else if (type.name === 'yellow') {
      // Square
      g.fillRect(3, 3, 14, 14);
      g.fillStyle(0x000000, 1);
      g.fillCircle(7, 8, 2);
      g.fillCircle(13, 8, 2);
      g.fillRect(6, 13, 8, 2);
    } else if (type.name === 'orange') {
      // Star-like
      g.fillCircle(10, 10, 9);
      g.fillTriangle(10, 1, 7, 8, 13, 8);
      g.fillTriangle(10, 19, 7, 12, 13, 12);
      g.fillTriangle(1, 10, 8, 7, 8, 13);
      g.fillTriangle(19, 10, 12, 7, 12, 13);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(7, 8, 2);
      g.fillCircle(13, 8, 2);
    } else if (type.name === 'red') {
      // Hexagon-ish with horns
      g.fillCircle(10, 10, 9);
      g.fillTriangle(3, 5, 5, 2, 7, 5);
      g.fillTriangle(17, 5, 15, 2, 13, 5);
      g.fillStyle(0xff0000, 1);
      g.fillCircle(7, 9, 2);
      g.fillCircle(13, 9, 2);
      g.fillRect(7, 14, 6, 2);
    } else if (type.name === 'purple') {
      // Alien-like
      g.fillRect(4, 6, 12, 10);
      g.fillCircle(6, 6, 3);
      g.fillCircle(14, 6, 3);
      g.fillStyle(0x00ff00, 1);
      g.fillCircle(7, 10, 3);
      g.fillCircle(13, 10, 3);
      g.fillStyle(0x000000, 1);
      g.fillCircle(7, 10, 2);
      g.fillCircle(13, 10, 2);
    }
    g.generateTexture(`enemy_${type.name}`, 20, 20);
    g.clear();

    // Boss texture (3x size) - similar shapes scaled up
    g.fillStyle(type.color, 1);
    if (type.name === 'green') {
      g.fillTriangle(30, 6, 6, 54, 54, 54);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(21, 30, 6);
      g.fillCircle(39, 30, 6);
    } else if (type.name === 'blue') {
      g.fillTriangle(30, 6, 6, 30, 30, 54);
      g.fillTriangle(30, 6, 54, 30, 30, 54);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(24, 24, 6);
      g.fillCircle(36, 24, 6);
    } else if (type.name === 'cyan') {
      g.fillCircle(30, 30, 27);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(21, 27, 6);
      g.fillCircle(39, 27, 6);
      g.fillStyle(type.color, 0.7);
      g.fillCircle(30, 18, 9);
    } else if (type.name === 'yellow') {
      g.fillRect(9, 9, 42, 42);
      g.fillStyle(0x000000, 1);
      g.fillCircle(21, 24, 6);
      g.fillCircle(39, 24, 6);
      g.fillRect(18, 39, 24, 6);
    } else if (type.name === 'orange') {
      g.fillCircle(30, 30, 27);
      g.fillTriangle(30, 3, 21, 24, 39, 24);
      g.fillTriangle(30, 57, 21, 36, 39, 36);
      g.fillTriangle(3, 30, 24, 21, 24, 39);
      g.fillTriangle(57, 30, 36, 21, 36, 39);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(21, 24, 6);
      g.fillCircle(39, 24, 6);
    } else if (type.name === 'red') {
      g.fillCircle(30, 30, 27);
      g.fillTriangle(9, 15, 15, 6, 21, 15);
      g.fillTriangle(51, 15, 45, 6, 39, 15);
      g.fillStyle(0xff0000, 1);
      g.fillCircle(21, 27, 6);
      g.fillCircle(39, 27, 6);
      g.fillRect(21, 42, 18, 6);
    } else if (type.name === 'purple') {
      g.fillRect(12, 18, 36, 30);
      g.fillCircle(18, 18, 9);
      g.fillCircle(42, 18, 9);
      g.fillStyle(0x00ff00, 1);
      g.fillCircle(21, 30, 9);
      g.fillCircle(39, 30, 9);
      g.fillStyle(0x000000, 1);
      g.fillCircle(21, 30, 6);
      g.fillCircle(39, 30, 6);
    }
    g.generateTexture(`boss_${type.name}`, 60, 60);
    g.clear();
  });

  // Projectile texture (orange circle)
  g.fillStyle(0xff8800, 1);
  g.fillCircle(4, 4, 4);
  g.generateTexture('projectile', 8, 8);
  g.clear();

  // XP orb texture (cyan circle)
  g.fillStyle(0x00ffff, 1);
  g.fillCircle(5, 5, 5);
  g.generateTexture('xp', 10, 10);
  g.clear();

  // Obstacle texture (gray rock)
  g.fillStyle(0x555555, 1);
  g.fillCircle(20, 20, 20);
  g.fillStyle(0x777777, 0.5);
  g.fillCircle(15, 15, 10);
  g.generateTexture('obstacle', 40, 40);
  g.clear();

  // Weapon chest texture (golden chest)
  g.fillStyle(0xffaa00, 1);
  g.fillRect(3, 8, 14, 12);
  g.fillStyle(0xffdd00, 1);
  g.fillRect(6, 5, 8, 8);
  g.lineStyle(2, 0xffffff, 1);
  g.strokeRect(3, 8, 14, 12);
  g.generateTexture('chest', 20, 20);
  g.clear();

  // Upgrade chest texture (green/emerald chest)
  g.fillStyle(0x00aa44, 1);
  g.fillRect(3, 8, 14, 12);
  g.fillStyle(0x00ff66, 1);
  g.fillRect(6, 5, 8, 8);
  g.lineStyle(2, 0xffffff, 1);
  g.strokeRect(3, 8, 14, 12);
  g.generateTexture('upgradeChest', 20, 20);
  g.clear();

  // Magnet texture (horseshoe magnet)
  g.fillStyle(0xff0000, 1);
  g.fillRect(2, 2, 5, 16);
  g.fillRect(2, 14, 16, 4);
  g.fillStyle(0x0088ff, 1);
  g.fillRect(13, 2, 5, 16);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(10, 10, 3);
  g.generateTexture('magnet', 20, 20);
  g.clear();

  // Orbiting ball texture (white ball with glow)
  g.fillStyle(0xffffff, 1);
  g.fillCircle(8, 8, 8);
  g.fillStyle(0xffffaa, 0.5);
  g.fillCircle(8, 8, 6);
  g.generateTexture('orbitingBall', 16, 16);
  g.clear();

  g.destroy();
}

function create() {
  scene = this;
  graphics = this.add.graphics();

  // Create starfield background with parallax
  const starLayers = [
    { count: 50, size: 1, alpha: 0.4, scrollFactor: 0.2 },
    { count: 40, size: 1.5, alpha: 0.6, scrollFactor: 0.5 },
    { count: 30, size: 2, alpha: 0.8, scrollFactor: 0.8 }
  ];

  starLayers.forEach((layer, i) => {
    const stars = this.add.graphics();
    stars.fillStyle(0xffffff, layer.alpha);
    for (let j = 0; j < layer.count; j++) {
      const x = Math.random() * 2400;
      const y = Math.random() * 1800;
      stars.fillCircle(x, y, layer.size);
    }
    stars.setScrollFactor(layer.scrollFactor);
    stars.setDepth(-10 + i);
  });

  // Expand world bounds (3x larger than screen)
  this.physics.world.setBounds(0, 0, 2400, 1800);

  // Initialize unlocked types with first type
  unlockedTypes = [enemyTypes[0]];

  // Create physics groups
  enemies = this.physics.add.group();
  projectiles = this.physics.add.group();
  xpOrbs = this.physics.add.group();
  weaponChests = this.physics.add.group();
  upgradeChests = this.physics.add.group();
  magnets = this.physics.add.group();
  obstacles = this.physics.add.staticGroup();

  // Spawn obstacles randomly across map
  for (let i = 0; i < 80; i++) {
    const x = 100 + Math.random() * 2200;
    const y = 100 + Math.random() * 1600;
    const obs = obstacles.create(x, y, 'obstacle');
    obs.setCircle(20);
  }

  // Create player at center of world
  player = this.physics.add.image(1200, 900, 'player');
  player.setCollideWorldBounds(true);
  player.body.setCircle(16);

  // Camera follows player
  this.cameras.main.startFollow(player);
  this.cameras.main.setBounds(0, 0, 2400, 1800);

  // Input
  cursors = this.input.keyboard.createCursorKeys();

  // Collisions
  this.physics.add.overlap(projectiles, enemies, hitEnemy, null, this);
  this.physics.add.overlap(player, enemies, hitPlayer, null, this);
  this.physics.add.overlap(player, xpOrbs, collectXP, null, this);
  this.physics.add.overlap(player, weaponChests, collectChest, null, this);
  this.physics.add.overlap(player, upgradeChests, collectUpgradeChest, null, this);
  this.physics.add.overlap(player, magnets, collectMagnet, null, this);

  // Enemy-to-enemy collisions (they push each other)
  this.physics.add.collider(enemies, enemies);

  // Obstacle collisions
  this.physics.add.collider(player, obstacles);
  this.physics.add.collider(enemies, obstacles);
  this.physics.add.collider(projectiles, obstacles);

  // Create UI
  createUI(this);

  // Keyboard for restart
  const rKey = this.input.keyboard.addKey('R');
  rKey.on('down', () => {
    if (!startScreen) restartGame();
  });

  // Keyboard for pause
  const pKey = this.input.keyboard.addKey('P');
  let pauseOverlay = null;
  let pauseText = null;
  let pauseHint = null;
  pKey.on('down', () => {
    if (!gameOver && !startScreen && !levelingUp && !selectingWeapon && !showStats) {
      paused = !paused;
      if (paused) {
        scene.physics.pause();
        playTone(scene, 600, 0.1);
        // Show pause overlay
        pauseOverlay = scene.add.graphics();
        pauseOverlay.fillStyle(0x000000, 0.7);
        pauseOverlay.fillRect(0, 0, 800, 600);
        pauseOverlay.setScrollFactor(0);
        pauseOverlay.setDepth(200);
        pauseText = scene.add.text(400, 300, 'PAUSED', {
          fontSize: '64px',
          fontFamily: 'Arial',
          color: '#ffff00',
          stroke: '#000000',
          strokeThickness: 8
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
        pauseHint = scene.add.text(400, 370, 'Press [P] to resume', {
          fontSize: '24px',
          fontFamily: 'Arial',
          color: '#ffffff'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(201);
      } else {
        scene.physics.resume();
        playTone(scene, 800, 0.1);
        // Remove pause overlay
        if (pauseOverlay) pauseOverlay.destroy();
        if (pauseText) pauseText.destroy();
        if (pauseHint) pauseHint.destroy();
      }
    }
  });

  // Keyboard for stats panel
  const sKey = this.input.keyboard.addKey('S');
  sKey.on('down', () => {
    if (!gameOver && !startScreen) toggleStatsPanel();
  });

  // Pause physics until weapon is selected
  this.physics.pause();

  // Show start screen
  showStartScreen();

  // Start sound
  playTone(this, 440, 0.1);
}

function update(_time, delta) {
  if (gameOver || levelingUp || selectingWeapon || startScreen || showStats || paused) return;

  gameTime += delta;
  shootTimer += delta;
  spawnTimer += delta;
  regenTimer += delta;

  // HP Regeneration (every 1 second)
  if (regenTimer >= 1000 && stats.hpRegen > 0) {
    regenTimer = 0;
    const healAmount = stats.hpRegen / 60;
    stats.hp = Math.min(stats.maxHp, stats.hp + healAmount);
  }

  // Player movement
  player.body.setVelocity(0, 0);
  let moving = false;

  if (cursors.left.isDown) {
    player.body.setVelocityX(-stats.speed);
    moving = true;
  }
  if (cursors.right.isDown) {
    player.body.setVelocityX(stats.speed);
    moving = true;
  }
  if (cursors.up.isDown) {
    player.body.setVelocityY(-stats.speed);
    moving = true;
  }
  if (cursors.down.isDown) {
    player.body.setVelocityY(stats.speed);
    moving = true;
  }

  // Normalize diagonal movement
  if (moving && player.body.velocity.x !== 0 && player.body.velocity.y !== 0) {
    player.body.velocity.normalize().scale(stats.speed);
  }

  // Auto shoot (projectile weapon)
  const projectileWeapon = getWeapon('projectile');
  if (projectileWeapon.unlocked && shootTimer >= projectileWeapon.fireRate) {
    shootTimer = 0;
    shoot();
  }

  // Auto shoot (boomerang weapon)
  const boomerangWeapon = getWeapon('boomerang');
  if (boomerangWeapon.unlocked) {
    boomerangShootTimer += delta;
    if (boomerangShootTimer >= 200 && availableBoomerangs > 0) {
      boomerangShootTimer = 0;
      shootBoomerang();
    }
  }

  // Spawn enemies
  if (spawnTimer >= difficulty.spawnRate) {
    spawnTimer = 0;
    spawnEnemy();
  }

  // Unlock new enemy types based on time
  updateUnlockedTypes();

  // Scale difficulty every 30 seconds
  if (Math.floor(gameTime / 30000) > Math.floor((gameTime - delta) / 30000)) {
    difficulty.spawnRate = Math.max(500, difficulty.spawnRate * 0.9);
    difficulty.enemyHp *= 1.15;
    difficulty.enemyDamage *= 1.1;
    difficulty.enemySpeed = Math.min(120, difficulty.enemySpeed * 1.05);
  }

  // Wave system (every 60 seconds)
  waveTimer += delta;
  if (waveTimer >= nextWaveTime - 3000 && waveTimer < nextWaveTime && !warningActive) {
    showWarning('⚠️ WAVE INCOMING!', 0xffff00);
    playTone(scene, 600, 0.3);
  }
  if (waveTimer >= nextWaveTime) {
    waveTimer = 0;
    spawnWave();
  }

  // Boss system (every 120 seconds)
  bossTimer += delta;
  if (bossTimer >= nextBossTime - 5000 && bossTimer < nextBossTime && !warningActive) {
    showWarning('🔥 BOSS APPROACHING!', 0xff0000);
    playTone(scene, 150, 0.5);
  }
  if (bossTimer >= nextBossTime) {
    bossTimer = 0;
    spawnBoss();
  }

  // Move enemies toward player
  enemies.children.entries.forEach(enemy => {
    if (!enemy.active) return;

    // Skip movement update if enemy is in knockback
    const knockbackUntil = enemy.getData('knockbackUntil') || 0;
    if (gameTime < knockbackUntil) {
      return;
    }

    const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
    const speed = enemy.getData('speed');
    enemy.body.setVelocity(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );
  });

  // Move magnetized XP orbs toward player
  xpOrbs.children.entries.forEach(orb => {
    if (orb.active && orb.getData('magnetized')) {
      const angle = Phaser.Math.Angle.Between(orb.x, orb.y, player.x, player.y);
      const speed = 300; // Attraction speed
      orb.body.setVelocity(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
      );
    }
  });

  // Update orbiting balls
  updateOrbitingBalls(delta);

  // Update area damage
  updateAreaDamage(delta);

  // Update boomerangs
  updateBoomerangs(delta);

  // Update UI
  updateUI();

  // Draw UI bars
  drawUIBars();
}

function shoot() {
  const target = findClosestEnemy();
  if (!target) return;

  const weapon = getWeapon('projectile');
  playTone(scene, 880, 0.05);

  // Calculate angles for multiple projectiles
  const baseAngle = Phaser.Math.Angle.Between(player.x, player.y, target.x, target.y);
  const spread = weapon.count > 1 ? 0.3 : 0;
  const startOffset = -(weapon.count - 1) * spread / 2;

  for (let i = 0; i < weapon.count; i++) {
    const angle = baseAngle + startOffset + i * spread;
    const vx = Math.cos(angle) * 300;
    const vy = Math.sin(angle) * 300;

    // Create using the group (important!)
    const proj = projectiles.create(player.x, player.y, 'projectile');
    proj.body.setCircle(4);
    proj.body.setVelocity(vx, vy);
    proj.setData('damage', weapon.damage);
    proj.setData('penetration', weapon.penetration);
    proj.setData('hits', 0);

    // Auto-destroy after 2 seconds
    scene.time.delayedCall(2000, () => {
      if (proj && proj.active) proj.destroy();
    });
  }
}

function findClosestEnemy() {
  let closest = null;
  let minDist = Infinity;

  enemies.children.entries.forEach(enemy => {
    if (!enemy.active) return;
    const dist = Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y);
    if (dist < minDist) {
      minDist = dist;
      closest = enemy;
    }
  });

  return closest;
}

function spawnEnemy() {
  const side = Math.floor(Math.random() * 4);
  let x, y;

  // Spawn relative to player position, outside camera view
  const px = player.x;
  const py = player.y;

  if (side === 0) { x = px + (Math.random() - 0.5) * 800; y = py - 350; }
  else if (side === 1) { x = px + (Math.random() - 0.5) * 800; y = py + 350; }
  else if (side === 2) { x = px - 450; y = py + (Math.random() - 0.5) * 600; }
  else { x = px + 450; y = py + (Math.random() - 0.5) * 600; }

  // Keep within world bounds
  x = Math.max(20, Math.min(2380, x));
  y = Math.max(20, Math.min(1780, y));

  // Select random enemy type from unlocked types
  const type = unlockedTypes[Math.floor(Math.random() * unlockedTypes.length)];

  // Create using the group with appropriate texture
  const enemy = enemies.create(x, y, `enemy_${type.name}`);
  enemy.body.setCircle(10);

  // Apply type multipliers to difficulty base stats
  enemy.setData('hp', difficulty.enemyHp * type.hpMult);
  enemy.setData('speed', difficulty.enemySpeed * type.speedMult);
  enemy.setData('damage', difficulty.enemyDamage * type.damageMult);
  enemy.setData('xpValue', type.xp);
  enemy.setData('dropChance', type.dropChance);
  enemy.setData('knockbackUntil', 0);
}

function hitEnemy(proj, enemy) {
  if (!enemy.active || !proj.active) return;

  let projDamage = proj.getData('damage') || 10;
  const projPenetration = proj.getData('penetration') || 0;
  const projHits = proj.getData('hits') || 0;

  // Check for critical hit
  const isCrit = Math.random() < stats.critChance;
  if (isCrit) {
    projDamage *= stats.critDamage;
  }

  // Apply damage to enemy
  const hp = enemy.getData('hp') - projDamage;
  enemy.setData('hp', hp);

  // Apply damage feedback (visual + knockback)
  applyDamageFeedback(enemy, proj.x, proj.y, isCrit);

  // Increment projectile hit count
  proj.setData('hits', projHits + 1);

  // Destroy projectile if it has reached its penetration limit
  if (projHits >= projPenetration) {
    proj.destroy();
  }

  if (hp <= 0) {
    playTone(scene, 660, 0.1);
    const xpValue = enemy.getData('xpValue') || 5;
    const isBoss = enemy.getData('isBoss');
    const dropChance = enemy.getData('dropChance') || 0;
    dropXP(enemy.x, enemy.y, xpValue);

    // Bosses drop weapon chests and magnets
    if (isBoss) {
      dropChest(enemy.x, enemy.y);
      dropMagnet(enemy.x + 40, enemy.y); // Offset slightly so they don't overlap
    } else {
      // Normal enemies have a chance to drop upgrade chests
      const finalDropChance = dropChance * stats.lootChance;
      if (Math.random() < finalDropChance) {
        dropUpgradeChest(enemy.x, enemy.y);
      }

      // Small chance to drop magnet
      const magnetDropChance = 0.015; // 1.5% chance
      if (Math.random() < magnetDropChance * stats.lootChance) {
        dropMagnet(enemy.x, enemy.y);
      }
    }

    enemy.destroy();
    stats.enemiesKilled++;
  }
}

function hitPlayer(_playerObj, enemy) {
  if (!enemy.active) return;

  // Check cooldown (prevent damage every frame)
  const lastHit = enemy.getData('lastHitTime') || 0;
  if (gameTime - lastHit < 500) return; // 500ms cooldown per enemy

  const damage = enemy.getData('damage') || difficulty.enemyDamage;
  stats.hp -= damage;
  playTone(scene, 220, 0.15);
  enemy.setData('lastHitTime', gameTime);

  if (stats.hp <= 0) {
    endGame();
  }
}

function dropXP(x, y, xpValue) {
  // Create using the group
  const orb = xpOrbs.create(x, y, 'xp');
  orb.body.setCircle(5);
  orb.setData('xpValue', xpValue);
  // XP orbs stay forever until collected
}

function collectXP(_playerObj, orb) {
  if (!orb.active) return;
  const baseXpValue = orb.getData('xpValue') || 5;
  orb.destroy();
  const xpValue = baseXpValue * stats.xpMultiplier;
  stats.xp += xpValue;

  if (stats.xp >= stats.xpToNext) {
    levelUp();
  }
}

function dropChest(x, y) {
  const chest = weaponChests.create(x, y, 'chest');
  chest.body.setCircle(10);
  // Chest stays in place (immovable)
  chest.body.setImmovable(true);
  chest.body.setAllowGravity(false);
}

function collectChest(_playerObj, chest) {
  if (!chest.active) return;
  chest.destroy();
  playTone(scene, 1500, 0.3);

  // Check if there are weapons to unlock
  const lockedWeapons = weaponTypes.filter(w => !w.unlocked && !w.id.startsWith('placeholder'));

  if (lockedWeapons.length > 0) {
    showWeaponSelector(lockedWeapons);
  } else {
    // All weapons unlocked, show rare upgrade menu
    showRareUpgradeMenu();
  }
}

function dropUpgradeChest(x, y) {
  const chest = upgradeChests.create(x, y, 'upgradeChest');
  chest.body.setCircle(10);
  // Chest stays in place (immovable)
  chest.body.setImmovable(true);
  chest.body.setAllowGravity(false);
}

function collectUpgradeChest(_playerObj, chest) {
  if (!chest.active) return;
  chest.destroy();
  playTone(scene, 1200, 0.2);

  // Build available upgrades pool
  let availableUpgrades = [...playerUpgrades];

  // Add weapon-specific upgrades if unlocked
  if (getWeapon('projectile').unlocked) {
    availableUpgrades.push(...projectileUpgrades);
  }
  if (getWeapon('orbitingBall').unlocked) {
    availableUpgrades.push(...orbitingBallUpgrades);
  }
  if (getWeapon('areaDamage').unlocked) {
    availableUpgrades.push(...areaDamageUpgrades);
  }
  if (getWeapon('boomerang').unlocked) {
    availableUpgrades.push(...boomerangUpgrades);
  }

  // Filter out maxed upgrades
  availableUpgrades = availableUpgrades.filter(u =>
    (upgradeLevels[u.id] || 0) < u.maxLevel
  );

  // Show selection menu if upgrades available
  if (availableUpgrades.length > 0) {
    showUpgradeChestMenu(availableUpgrades);
  }
}

function dropMagnet(x, y) {
  const magnet = magnets.create(x, y, 'magnet');
  magnet.body.setCircle(10);
  // Magnet stays in place (immovable)
  magnet.body.setImmovable(true);
  magnet.body.setAllowGravity(false);
}

function collectMagnet(_playerObj, magnet) {
  if (!magnet.active) return;
  magnet.destroy();
  playTone(scene, 1500, 0.3);

  // Magnetize all existing XP orbs
  xpOrbs.children.entries.forEach(orb => {
    if (orb.active) {
      orb.setData('magnetized', true);
    }
  });
}

function showUpgradeChestMenu(availableUpgrades) {
  selectingWeapon = true;
  scene.physics.pause();

  // Semi-transparent overlay
  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0.85);
  overlay.fillRect(0, 0, 800, 600);
  overlay.setScrollFactor(0);
  overlay.setDepth(100);

  // Title (green/emerald theme to match chest)
  const title = scene.add.text(400, 100, '💎 UPGRADE CHEST! 💎', {
    fontSize: '48px',
    fontFamily: 'Arial',
    color: '#00ff66',
    stroke: '#000000',
    strokeThickness: 6
  }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

  // Shuffle and pick 3 upgrades
  const shuffled = [...availableUpgrades].sort(() => Math.random() - 0.5).slice(0, 3);

  // Reset menu state
  selectedIndex = 0;
  menuOptions = [];

  const selectUpgrade = (upgrade) => {
    upgrade.apply();
    playTone(scene, 1400, 0.15);

    // Clean up menu
    overlay.destroy();
    title.destroy();
    scene.children.list.filter(c => c.depth >= 100).forEach(c => c.destroy());

    // Remove keyboard listeners
    menuKeys.forEach(k => k.removeAllListeners());
    menuKeys = [];

    // Resume physics
    scene.physics.resume();
    selectingWeapon = false;
  };

  const updateSelection = () => {
    menuOptions.forEach((option, i) => {
      const isSelected = i === selectedIndex;
      option.btn.clear();
      option.btn.fillStyle(isSelected ? 0x005533 : 0x003322, 1);
      option.btn.fillRoundedRect(option.x - 90, option.y - 80, 180, 160, 10);
      option.btn.lineStyle(3, isSelected ? 0xffff00 : 0x00ff66, 1);
      option.btn.strokeRoundedRect(option.x - 90, option.y - 80, 180, 160, 10);
    });
  };

  shuffled.forEach((upgrade, i) => {
    const x = 150 + i * 250;
    const y = 300;

    // Button background (green theme)
    const btn = scene.add.graphics();
    btn.fillStyle(0x003322, 1);
    btn.fillRoundedRect(x - 90, y - 80, 180, 160, 10);
    btn.lineStyle(3, 0x00ff66, 1);
    btn.strokeRoundedRect(x - 90, y - 80, 180, 160, 10);
    btn.setScrollFactor(0);
    btn.setDepth(101);
    btn.setInteractive(new Phaser.Geom.Rectangle(x - 90, y - 80, 180, 160), Phaser.Geom.Rectangle.Contains);

    // Icon
    scene.add.text(x, y - 30, upgrade.icon, {
      fontSize: '48px'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102);

    // Name
    scene.add.text(x, y + 20, upgrade.name, {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#00ff66'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102);

    // Description
    scene.add.text(x, y + 50, upgrade.desc, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#aaffcc'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102);

    // Store option reference
    menuOptions.push({ btn, upgrade, x, y });

    // Click handler
    btn.on('pointerdown', () => selectUpgrade(upgrade));

    // Hover effect
    btn.on('pointerover', () => {
      selectedIndex = i;
      updateSelection();
    });
  });

  // Initial selection highlight
  updateSelection();

  // Keyboard controls
  const leftKey = scene.input.keyboard.addKey('LEFT');
  const rightKey = scene.input.keyboard.addKey('RIGHT');
  const enterKey = scene.input.keyboard.addKey('ENTER');

  leftKey.on('down', () => {
    selectedIndex = (selectedIndex - 1 + menuOptions.length) % menuOptions.length;
    updateSelection();
    playTone(scene, 800, 0.05);
  });

  rightKey.on('down', () => {
    selectedIndex = (selectedIndex + 1) % menuOptions.length;
    updateSelection();
    playTone(scene, 800, 0.05);
  });

  enterKey.on('down', () => {
    selectUpgrade(menuOptions[selectedIndex].upgrade);
  });

  menuKeys.push(leftKey, rightKey, enterKey);
}

function levelUp() {
  levelingUp = true;
  stats.level++;
  stats.xp -= stats.xpToNext;
  stats.xpToNext = Math.floor(stats.xpToNext * 1.2);

  // Apply character passive ability
  if (selectedCharacter) {
    const passive = selectedCharacter.passiveType;
    const value = selectedCharacter.passiveValue;

    if (passive === 'damage') {
      // Banana: +5% weapon damage
      const weapon = getWeapon(selectedCharacter.weapon);
      if (weapon) weapon.damage = Math.floor(weapon.damage * value);
    } else if (passive === 'regen') {
      // Medusa: +5 HP regen
      stats.hpRegen += value;
    } else if (passive === 'crit') {
      // Orbe: +2% crit chance
      stats.critChance = Math.min(1, stats.critChance + value);
    } else if (passive === 'speed') {
      // Tren Bala: +3% speed
      stats.speed = Math.floor(stats.speed * value);
    }
  }

  // Pause physics
  scene.physics.pause();

  playTone(scene, 1200, 0.2);

  showUpgradeMenu();
}

function showUpgradeMenu() {
  // Build available upgrades pool
  let availableUpgrades = [...playerUpgrades];

  // Add projectile upgrades if unlocked
  if (getWeapon('projectile').unlocked) {
    availableUpgrades.push(...projectileUpgrades);
  }

  // Add orbiting ball upgrades if unlocked
  if (getWeapon('orbitingBall').unlocked) {
    availableUpgrades.push(...orbitingBallUpgrades);
  }

  // Add area damage upgrades if unlocked
  if (getWeapon('areaDamage').unlocked) {
    availableUpgrades.push(...areaDamageUpgrades);
  }

  // Add boomerang upgrades if unlocked
  if (getWeapon('boomerang').unlocked) {
    availableUpgrades.push(...boomerangUpgrades);
  }

  // Filter out upgrades that have reached max level
  availableUpgrades = availableUpgrades.filter(u =>
    (upgradeLevels[u.id] || 0) < u.maxLevel
  );

  // Semi-transparent overlay
  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0.85);
  overlay.fillRect(0, 0, 800, 600);
  overlay.setScrollFactor(0);
  overlay.setDepth(100);

  // Title
  const title = scene.add.text(400, 100, 'LEVEL UP!', {
    fontSize: '48px',
    fontFamily: 'Arial',
    color: '#ffff00',
    stroke: '#000000',
    strokeThickness: 6
  }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

  // Shuffle and pick 3 upgrades
  const shuffled = [...availableUpgrades].sort(() => Math.random() - 0.5).slice(0, 3);

  // Reset menu state
  selectedIndex = 0;
  menuOptions = [];

  const selectUpgrade = (upgrade) => {
    upgrade.apply();
    playTone(scene, 1000, 0.1);

    // Clean up menu
    overlay.destroy();
    title.destroy();
    scene.children.list.filter(c => c.depth >= 100).forEach(c => c.destroy());

    // Remove keyboard listeners
    menuKeys.forEach(k => k.removeAllListeners());
    menuKeys = [];

    // Resume physics
    scene.physics.resume();
    levelingUp = false;
  };

  const updateSelection = () => {
    menuOptions.forEach((option, i) => {
      const isSelected = i === selectedIndex;
      option.btn.clear();
      option.btn.fillStyle(isSelected ? 0x555555 : 0x333333, 1);
      option.btn.fillRoundedRect(option.x - 90, option.y - 80, 180, 160, 10);
      option.btn.lineStyle(3, isSelected ? 0xffff00 : 0x00ff00, 1);
      option.btn.strokeRoundedRect(option.x - 90, option.y - 80, 180, 160, 10);
    });
  };

  shuffled.forEach((upgrade, i) => {
    const x = 150 + i * 250;
    const y = 300;

    // Button background
    const btn = scene.add.graphics();
    btn.fillStyle(0x333333, 1);
    btn.fillRoundedRect(x - 90, y - 80, 180, 160, 10);
    btn.lineStyle(3, 0x00ff00, 1);
    btn.strokeRoundedRect(x - 90, y - 80, 180, 160, 10);
    btn.setScrollFactor(0);
    btn.setDepth(101);
    btn.setInteractive(new Phaser.Geom.Rectangle(x - 90, y - 80, 180, 160), Phaser.Geom.Rectangle.Contains);

    // Icon
    scene.add.text(x, y - 30, upgrade.icon, {
      fontSize: '48px'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102);

    // Name
    scene.add.text(x, y + 20, upgrade.name, {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102);

    // Description
    scene.add.text(x, y + 50, upgrade.desc, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#cccccc'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102);

    // Store option reference
    menuOptions.push({ btn, upgrade, x, y });

    // Click handler
    btn.on('pointerdown', () => selectUpgrade(upgrade));

    // Hover effect
    btn.on('pointerover', () => {
      selectedIndex = i;
      updateSelection();
    });
  });

  // Initial selection highlight
  updateSelection();

  // Keyboard controls
  const leftKey = scene.input.keyboard.addKey('LEFT');
  const rightKey = scene.input.keyboard.addKey('RIGHT');
  const enterKey = scene.input.keyboard.addKey('ENTER');

  leftKey.on('down', () => {
    selectedIndex = (selectedIndex - 1 + menuOptions.length) % menuOptions.length;
    updateSelection();
    playTone(scene, 800, 0.05);
  });

  rightKey.on('down', () => {
    selectedIndex = (selectedIndex + 1) % menuOptions.length;
    updateSelection();
    playTone(scene, 800, 0.05);
  });

  enterKey.on('down', () => {
    selectUpgrade(menuOptions[selectedIndex].upgrade);
  });

  menuKeys.push(leftKey, rightKey, enterKey);
}

function showWeaponSelector(weapons) {
  selectingWeapon = true;
  scene.physics.pause();

  // Semi-transparent overlay
  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0.85);
  overlay.fillRect(0, 0, 800, 600);
  overlay.setScrollFactor(0);
  overlay.setDepth(100);

  // Title
  const title = scene.add.text(400, 80, '⚔️ CHOOSE A WEAPON ⚔️', {
    fontSize: '40px',
    fontFamily: 'Arial',
    color: '#ffaa00',
    stroke: '#000000',
    strokeThickness: 6
  }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

  // Reset menu state
  selectedIndex = 0;
  menuOptions = [];

  const selectWeapon = (weapon) => {
    weapon.unlocked = true;
    playTone(scene, 1500, 0.2);

    // Initialize weapon
    if (weapon.id === 'orbitingBall') {
      initOrbitingBalls();
    } else if (weapon.id === 'areaDamage') {
      initAreaDamage();
    } else if (weapon.id === 'boomerang') {
      initBoomerangWeapon();
    }

    // Clean up menu
    overlay.destroy();
    title.destroy();
    scene.children.list.filter(c => c.depth >= 100).forEach(c => c.destroy());

    // Remove keyboard listeners
    menuKeys.forEach(k => k.removeAllListeners());
    menuKeys = [];

    // Resume
    scene.physics.resume();
    selectingWeapon = false;
  };

  const updateSelection = () => {
    menuOptions.forEach((option, i) => {
      const isSelected = i === selectedIndex;
      option.btn.clear();
      option.btn.fillStyle(isSelected ? 0x555555 : 0x333333, 1);
      option.btn.fillRoundedRect(option.x - 90, option.y - 100, 180, 200, 10);
      option.btn.lineStyle(3, isSelected ? 0xffff00 : 0xffaa00, 1);
      option.btn.strokeRoundedRect(option.x - 90, option.y - 100, 180, 200, 10);
    });
  };

  // Show available weapons
  weapons.forEach((weapon, i) => {
    const x = 200 + i * 200;
    const y = 300;

    // Button background
    const btn = scene.add.graphics();
    btn.fillStyle(0x333333, 1);
    btn.fillRoundedRect(x - 90, y - 100, 180, 200, 10);
    btn.lineStyle(3, 0xffaa00, 1);
    btn.strokeRoundedRect(x - 90, y - 100, 180, 200, 10);
    btn.setScrollFactor(0);
    btn.setDepth(101);
    btn.setInteractive(new Phaser.Geom.Rectangle(x - 90, y - 100, 180, 200), Phaser.Geom.Rectangle.Contains);

    // Weapon name
    scene.add.text(x, y - 40, weapon.name, {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold',
      wordWrap: { width: 160, useAdvancedWrap: true }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102);

    // Description
    scene.add.text(x, y + 20, weapon.desc, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#cccccc',
      wordWrap: { width: 160, useAdvancedWrap: true },
      align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102);

    // Store option reference
    menuOptions.push({ btn, weapon, x, y });

    // Click handler
    btn.on('pointerdown', () => selectWeapon(weapon));

    // Hover effect
    btn.on('pointerover', () => {
      selectedIndex = i;
      updateSelection();
    });
  });

  // Initial selection highlight
  updateSelection();

  // Keyboard controls
  const leftKey = scene.input.keyboard.addKey('LEFT');
  const rightKey = scene.input.keyboard.addKey('RIGHT');
  const enterKey = scene.input.keyboard.addKey('ENTER');

  leftKey.on('down', () => {
    selectedIndex = (selectedIndex - 1 + menuOptions.length) % menuOptions.length;
    updateSelection();
    playTone(scene, 800, 0.05);
  });

  rightKey.on('down', () => {
    selectedIndex = (selectedIndex + 1) % menuOptions.length;
    updateSelection();
    playTone(scene, 800, 0.05);
  });

  enterKey.on('down', () => {
    selectWeapon(menuOptions[selectedIndex].weapon);
  });

  menuKeys.push(leftKey, rightKey, enterKey);
}

function showRareUpgradeMenu() {
  selectingWeapon = true;
  scene.physics.pause();

  // Filter rare upgrades to only unlocked weapons and not maxed
  const available = rareUpgrades.filter(u => {
    if (!u.weaponId) return true; // Player upgrades
    const isUnlocked = getWeapon(u.weaponId).unlocked;
    const notMaxed = (upgradeLevels[u.id] || 0) < u.maxLevel;
    return isUnlocked && notMaxed;
  });

  // Semi-transparent overlay
  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0.85);
  overlay.fillRect(0, 0, 800, 600);
  overlay.setScrollFactor(0);
  overlay.setDepth(100);

  // Title
  const title = scene.add.text(400, 100, '✨ RARE UPGRADE! ✨', {
    fontSize: '48px',
    fontFamily: 'Arial',
    color: '#ff00ff',
    stroke: '#000000',
    strokeThickness: 6
  }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

  // Shuffle and pick 3 rare upgrades
  const shuffled = [...available].sort(() => Math.random() - 0.5).slice(0, 3);

  // Reset menu state
  selectedIndex = 0;
  menuOptions = [];

  const selectUpgrade = (upgrade) => {
    upgrade.apply();
    playTone(scene, 1800, 0.1);

    // Clean up menu
    overlay.destroy();
    title.destroy();
    scene.children.list.filter(c => c.depth >= 100).forEach(c => c.destroy());

    // Remove keyboard listeners
    menuKeys.forEach(k => k.removeAllListeners());
    menuKeys = [];

    // Resume
    scene.physics.resume();
    selectingWeapon = false;
  };

  const updateSelection = () => {
    menuOptions.forEach((option, i) => {
      const isSelected = i === selectedIndex;
      option.btn.clear();
      option.btn.fillStyle(isSelected ? 0x550055 : 0x330033, 1);
      option.btn.fillRoundedRect(option.x - 90, option.y - 80, 180, 160, 10);
      option.btn.lineStyle(3, isSelected ? 0xffff00 : 0xff00ff, 1);
      option.btn.strokeRoundedRect(option.x - 90, option.y - 80, 180, 160, 10);
    });
  };

  shuffled.forEach((upgrade, i) => {
    const x = 150 + i * 250;
    const y = 300;

    // Button background (purple tint)
    const btn = scene.add.graphics();
    btn.fillStyle(0x330033, 1);
    btn.fillRoundedRect(x - 90, y - 80, 180, 160, 10);
    btn.lineStyle(3, 0xff00ff, 1);
    btn.strokeRoundedRect(x - 90, y - 80, 180, 160, 10);
    btn.setScrollFactor(0);
    btn.setDepth(101);
    btn.setInteractive(new Phaser.Geom.Rectangle(x - 90, y - 80, 180, 160), Phaser.Geom.Rectangle.Contains);

    // Icon
    scene.add.text(x, y - 30, upgrade.icon, {
      fontSize: '48px'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102);

    // Name
    scene.add.text(x, y + 20, upgrade.name, {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#ff00ff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102);

    // Description
    scene.add.text(x, y + 50, upgrade.desc, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ffaaff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102);

    // Store option reference
    menuOptions.push({ btn, upgrade, x, y });

    // Click handler
    btn.on('pointerdown', () => selectUpgrade(upgrade));

    // Hover effect
    btn.on('pointerover', () => {
      selectedIndex = i;
      updateSelection();
    });
  });

  // Initial selection highlight
  updateSelection();

  // Keyboard controls
  const leftKey = scene.input.keyboard.addKey('LEFT');
  const rightKey = scene.input.keyboard.addKey('RIGHT');
  const enterKey = scene.input.keyboard.addKey('ENTER');

  leftKey.on('down', () => {
    selectedIndex = (selectedIndex - 1 + menuOptions.length) % menuOptions.length;
    updateSelection();
    playTone(scene, 800, 0.05);
  });

  rightKey.on('down', () => {
    selectedIndex = (selectedIndex + 1) % menuOptions.length;
    updateSelection();
    playTone(scene, 800, 0.05);
  });

  enterKey.on('down', () => {
    selectUpgrade(menuOptions[selectedIndex].upgrade);
  });

  menuKeys.push(leftKey, rightKey, enterKey);
}

function showStartScreen() {
  // Semi-transparent overlay
  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0.9);
  overlay.fillRect(0, 0, 800, 600);
  overlay.setScrollFactor(0);
  overlay.setDepth(100);

  // Title
  const title = scene.add.text(400, 80, 'BULLET HEAVEN', {
    fontSize: '48px',
    fontFamily: 'Arial',
    color: '#ffff00',
    stroke: '#000000',
    strokeThickness: 6
  }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

  // Subtitle
  scene.add.text(400, 140, 'Choose your character', {
    fontSize: '24px',
    fontFamily: 'Arial',
    color: '#ffffff'
  }).setOrigin(0.5).setScrollFactor(0).setDepth(101);

  // Reset menu state
  selectedIndex = 0;
  menuOptions = [];

  const selectCharacter = (character) => {
    playTone(scene, 1500, 0.2);

    // Set selected character
    selectedCharacter = character;

    // Change player texture
    player.setTexture(character.texture);

    // Get and unlock character's weapon
    const weapon = weaponTypes.find(w => w.id === character.weapon);
    if (weapon) {
      weapon.unlocked = true;

      // Initialize weapon if needed
      if (weapon.id === 'orbitingBall') {
        initOrbitingBalls();
      } else if (weapon.id === 'areaDamage') {
        initAreaDamage();
      } else if (weapon.id === 'boomerang') {
        initBoomerangWeapon();
      }
    }

    // Clean up menu
    overlay.destroy();
    title.destroy();
    scene.children.list.filter(c => c.depth >= 100).forEach(c => c.destroy());

    // Remove keyboard listeners
    menuKeys.forEach(k => k.removeAllListeners());
    menuKeys = [];

    // Resume physics and start game
    scene.physics.resume();
    startScreen = false;
  };

  const updateSelection = () => {
    menuOptions.forEach((option, i) => {
      const isSelected = i === selectedIndex;
      option.btn.clear();
      option.btn.fillStyle(isSelected ? 0x555555 : 0x222222, 1);
      option.btn.fillRoundedRect(option.x - 90, option.y - 100, 180, 200, 10);
      option.btn.lineStyle(4, isSelected ? 0xffff00 : 0x666666, 1);
      option.btn.strokeRoundedRect(option.x - 90, option.y - 100, 180, 200, 10);
    });
  };

  // Show characters
  characters.forEach((character, i) => {
    const x = 100 + i * 200;
    const y = 350;

    // Button background
    const btn = scene.add.graphics();
    btn.fillStyle(0x222222, 1);
    btn.fillRoundedRect(x - 90, y - 100, 180, 200, 10);
    btn.lineStyle(4, 0x666666, 1);
    btn.strokeRoundedRect(x - 90, y - 100, 180, 200, 10);
    btn.setScrollFactor(0);
    btn.setDepth(101);
    btn.setInteractive(new Phaser.Geom.Rectangle(x - 90, y - 100, 180, 200), Phaser.Geom.Rectangle.Contains);

    // Character sprite
    const sprite = scene.add.sprite(x, y - 40, character.texture);
    sprite.setScale(2);
    sprite.setScrollFactor(0);
    sprite.setDepth(102);

    // Character name
    scene.add.text(x, y + 20, character.name, {
      fontSize: '22px',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102);

    // Description
    scene.add.text(x, y + 50, character.desc, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#cccccc',
      wordWrap: { width: 160, useAdvancedWrap: true },
      align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102);

    // Passive ability
    scene.add.text(x, y + 75, character.passiveDesc, {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#00ff88',
      wordWrap: { width: 160, useAdvancedWrap: true },
      align: 'center'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(102);

    // Store option reference
    menuOptions.push({ btn, character, x, y });

    // Click handler
    btn.on('pointerdown', () => selectCharacter(character));

    // Hover effect
    btn.on('pointerover', () => {
      selectedIndex = i;
      updateSelection();
    });
  });

  // Initial selection highlight
  updateSelection();

  // Keyboard controls
  const leftKey = scene.input.keyboard.addKey('LEFT');
  const rightKey = scene.input.keyboard.addKey('RIGHT');
  const enterKey = scene.input.keyboard.addKey('ENTER');

  leftKey.on('down', () => {
    selectedIndex = (selectedIndex - 1 + menuOptions.length) % menuOptions.length;
    updateSelection();
    playTone(scene, 800, 0.05);
  });

  rightKey.on('down', () => {
    selectedIndex = (selectedIndex + 1) % menuOptions.length;
    updateSelection();
    playTone(scene, 800, 0.05);
  });

  enterKey.on('down', () => {
    selectCharacter(menuOptions[selectedIndex].character);
  });

  menuKeys.push(leftKey, rightKey, enterKey);
}

function createUI() {
  // HP Bar label
  ui.hpText = scene.add.text(10, 10, 'HP:', {
    fontSize: '16px',
    fontFamily: 'Arial',
    color: '#ffffff'
  }).setScrollFactor(0);

  // XP Bar label
  ui.xpText = scene.add.text(300, 10, 'XP:', {
    fontSize: '16px',
    fontFamily: 'Arial',
    color: '#ffffff'
  }).setScrollFactor(0);

  // Level
  ui.levelText = scene.add.text(550, 10, 'Level: 1', {
    fontSize: '16px',
    fontFamily: 'Arial',
    color: '#ffff00'
  }).setScrollFactor(0);

  // Timer
  ui.timeText = scene.add.text(700, 10, '0:00', {
    fontSize: '16px',
    fontFamily: 'Arial',
    color: '#00ffff'
  }).setScrollFactor(0);

  // Stats indicator
  ui.statsHint = scene.add.text(580, 580, '[S] Stats  [P] Pause  [R] Restart', {
    fontSize: '14px',
    fontFamily: 'Arial',
    color: '#888888'
  }).setScrollFactor(0).setDepth(10);
}

function updateUI() {
  ui.levelText.setText(`Level: ${stats.level}`);

  const minutes = Math.floor(gameTime / 60000);
  const seconds = Math.floor((gameTime % 60000) / 1000);
  ui.timeText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`);

  // Update weapon indicators
  let weaponX = 10;
  let weaponY = 40;

  // Clear old indicators
  if (ui.weaponIndicators) {
    ui.weaponIndicators.forEach(ind => ind.destroy());
  }
  ui.weaponIndicators = [];

  // Show unlocked weapons
  weaponTypes.forEach(weapon => {
    if (weapon.unlocked && !weapon.id.startsWith('placeholder')) {
      const icon = scene.add.text(weaponX, weaponY, weapon.name.charAt(0), {
        fontSize: '16px',
        fontFamily: 'Arial',
        color: '#ffaa00',
        backgroundColor: '#333333',
        padding: { x: 6, y: 4 }
      }).setScrollFactor(0);
      ui.weaponIndicators.push(icon);
      weaponX += 30;
    }
  });
}

function drawUIBars() {
  graphics.clear();
  graphics.setScrollFactor(0);

  // HP Bar background
  graphics.fillStyle(0x440000, 1);
  graphics.fillRect(50, 10, 200, 20);

  // HP Bar foreground
  graphics.fillStyle(0xff0000, 1);
  graphics.fillRect(50, 10, 200 * (stats.hp / stats.maxHp), 20);

  // HP Bar border
  graphics.lineStyle(2, 0xffffff, 1);
  graphics.strokeRect(50, 10, 200, 20);

  // XP Bar background
  graphics.fillStyle(0x004444, 1);
  graphics.fillRect(330, 10, 180, 20);

  // XP Bar foreground
  graphics.fillStyle(0x00ffff, 1);
  graphics.fillRect(330, 10, 180 * (stats.xp / stats.xpToNext), 20);

  // XP Bar border
  graphics.lineStyle(2, 0xffffff, 1);
  graphics.strokeRect(330, 10, 180, 20);

  // Find active boss
  let boss = null;
  enemies.children.entries.forEach(enemy => {
    if (enemy.active && enemy.getData('isBoss')) {
      boss = enemy;
    }
  });

  // Draw boss HP bar at top center
  if (boss) {
    const hp = boss.getData('hp');
    const maxHp = boss.getData('maxHp');
    const barWidth = 600;
    const barHeight = 25;
    const x = 100;
    const y = 50;

    // Destroy old boss texts if they exist
    if (ui.bossLabelText) ui.bossLabelText.destroy();
    if (ui.bossHpText) ui.bossHpText.destroy();

    // Boss label
    graphics.fillStyle(0xffffff, 1);
    ui.bossLabelText = scene.add.text(400, 40, '⚔️ BOSS ⚔️', {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#ff0000',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

    // Background
    graphics.fillStyle(0x440000, 1);
    graphics.fillRect(x, y, barWidth, barHeight);

    // Foreground
    graphics.fillStyle(0xff0000, 1);
    graphics.fillRect(x, y, barWidth * (hp / maxHp), barHeight);

    // Border
    graphics.lineStyle(3, 0xffff00, 1);
    graphics.strokeRect(x, y, barWidth, barHeight);

    // HP text
    graphics.fillStyle(0xffffff, 1);
    ui.bossHpText = scene.add.text(400, 62, `${Math.ceil(hp)} / ${Math.ceil(maxHp)}`, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
  } else {
    // Destroy boss texts when no boss
    if (ui.bossLabelText) {
      ui.bossLabelText.destroy();
      ui.bossLabelText = null;
    }
    if (ui.bossHpText) {
      ui.bossHpText.destroy();
      ui.bossHpText = null;
    }
  }
}

function endGame() {
  gameOver = true;
  playTone(scene, 150, 0.5);

  // Overlay
  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0.8);
  overlay.fillRect(0, 0, 800, 600);
  overlay.setScrollFactor(0);

  // Game Over text
  scene.add.text(400, 200, 'GAME OVER', {
    fontSize: '64px',
    fontFamily: 'Arial',
    color: '#ff0000',
    stroke: '#000000',
    strokeThickness: 8
  }).setOrigin(0.5).setScrollFactor(0);

  // Stats
  const minutes = Math.floor(gameTime / 60000);
  const seconds = Math.floor((gameTime % 60000) / 1000);

  scene.add.text(400, 300, `Time Survived: ${minutes}:${seconds.toString().padStart(2, '0')}`, {
    fontSize: '28px',
    fontFamily: 'Arial',
    color: '#00ffff'
  }).setOrigin(0.5).setScrollFactor(0);

  scene.add.text(400, 350, `Level Reached: ${stats.level}`, {
    fontSize: '28px',
    fontFamily: 'Arial',
    color: '#ffff00'
  }).setOrigin(0.5).setScrollFactor(0);

  scene.add.text(400, 400, `Enemies Killed: ${stats.enemiesKilled}`, {
    fontSize: '28px',
    fontFamily: 'Arial',
    color: '#00ff00'
  }).setOrigin(0.5).setScrollFactor(0);

  // Restart text
  const restartText = scene.add.text(400, 500, 'Press R to Restart', {
    fontSize: '24px',
    fontFamily: 'Arial',
    color: '#ffffff'
  }).setOrigin(0.5).setScrollFactor(0);

  // Blink animation
  scene.tweens.add({
    targets: restartText,
    alpha: 0.3,
    duration: 600,
    yoyo: true,
    repeat: -1
  });
}

function restartGame() {
  // Reset state
  gameOver = false;
  levelingUp = false;
  selectingWeapon = false;
  startScreen = true;
  paused = false;
  gameTime = 0;
  shootTimer = 0;
  spawnTimer = 0;
  regenTimer = 0;
  waveTimer = 0;
  bossTimer = 0;
  warningActive = false;

  // Reset upgrade levels
  upgradeLevels = {};

  // Reset weapons (all locked, player will choose one)
  weaponTypes.forEach(weapon => {
    if (weapon.id === 'projectile') {
      weapon.unlocked = false;
      weapon.count = 1;
      weapon.fireRate = 500;
      weapon.damage = 10;
      weapon.penetration = 0;
    } else if (weapon.id === 'orbitingBall') {
      weapon.unlocked = false;
      weapon.count = 2;
      weapon.rotSpeed = 2;
      weapon.radius = 80;
      weapon.ballRadius = 8;
      weapon.damage = 15;
    } else if (weapon.id === 'areaDamage') {
      weapon.unlocked = false;
      weapon.radius = 150;
      weapon.dps = 10;
      weapon.tickRate = 500;
      weapon.lastTick = 0;
    } else {
      weapon.unlocked = false;
    }
  });

  // Clear orbiting balls
  orbitingBalls.forEach(ball => ball && ball.destroy());
  orbitingBalls = [];
  orbitAngle = 0;

  stats = {
    hp: 100,
    maxHp: 100,
    speed: 150,
    knockback: 100,
    hpRegen: 0,
    xpMultiplier: 1.0,
    lootChance: 1.0,
    xp: 0,
    level: 1,
    xpToNext: 10,
    enemiesKilled: 0
  };

  difficulty = {
    spawnRate: 2000,
    enemyHp: 20,
    enemyDamage: 10,
    enemySpeed: 80
  };

  scene.scene.restart();
}

function updateUnlockedTypes() {
  enemyTypes.forEach(type => {
    if (gameTime >= type.unlockTime && !unlockedTypes.includes(type)) {
      unlockedTypes.push(type);
    }
  });
}

function spawnWave() {
  warningActive = false;
  playTone(scene, 800, 0.2);

  // Spawn 15-20 enemies in a circle around player
  const count = 15 + Math.floor(Math.random() * 6);
  const angleStep = (Math.PI * 2) / count;

  for (let i = 0; i < count; i++) {
    const angle = i * angleStep;
    const distance = 400;
    let x = player.x + Math.cos(angle) * distance;
    let y = player.y + Math.sin(angle) * distance;

    // Keep within world bounds
    x = Math.max(20, Math.min(2380, x));
    y = Math.max(20, Math.min(1780, y));

    // Select random type from unlocked
    const type = unlockedTypes[Math.floor(Math.random() * unlockedTypes.length)];

    const enemy = enemies.create(x, y, `enemy_${type.name}`);
    enemy.body.setCircle(10);
    enemy.setData('hp', difficulty.enemyHp * type.hpMult * 1.5);
    enemy.setData('speed', difficulty.enemySpeed * type.speedMult);
    enemy.setData('damage', difficulty.enemyDamage * type.damageMult);
    enemy.setData('xpValue', type.xp);
    enemy.setData('knockbackUntil', 0);
  }
}

function spawnBoss() {
  warningActive = false;
  playTone(scene, 100, 0.4);

  // Select highest unlocked type for boss
  const type = unlockedTypes[unlockedTypes.length - 1];

  // Spawn boss from random direction relative to player
  const side = Math.floor(Math.random() * 4);
  let x, y;

  if (side === 0) { x = player.x; y = player.y - 400; }
  else if (side === 1) { x = player.x; y = player.y + 400; }
  else if (side === 2) { x = player.x - 500; y = player.y; }
  else { x = player.x + 500; y = player.y; }

  // Keep within world bounds
  x = Math.max(50, Math.min(2350, x));
  y = Math.max(50, Math.min(1750, y));

  const boss = enemies.create(x, y, `boss_${type.name}`);
  boss.body.setCircle(30);
  boss.setData('hp', difficulty.enemyHp * type.hpMult * 10);
  boss.setData('maxHp', difficulty.enemyHp * type.hpMult * 10);
  boss.setData('speed', difficulty.enemySpeed * type.speedMult * 0.7);
  boss.setData('damage', difficulty.enemyDamage * type.damageMult * 2);
  boss.setData('xpValue', type.xp * 10);
  boss.setData('isBoss', true);
  boss.setData('knockbackUntil', 0);
}

function showWarning(text, color) {
  warningActive = true;

  // Create warning overlay
  const warning = scene.add.graphics();
  warning.fillStyle(color, 0.3);
  warning.fillRect(0, 250, 800, 100);
  warning.setScrollFactor(0);
  warning.setDepth(50);

  // Warning text
  const warningText = scene.add.text(400, 300, text, {
    fontSize: '48px',
    fontFamily: 'Arial',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 6
  }).setOrigin(0.5).setScrollFactor(0).setDepth(51);

  // Flash animation
  scene.tweens.add({
    targets: [warning, warningText],
    alpha: 0,
    duration: 500,
    delay: 2500,
    onComplete: () => {
      warning.destroy();
      warningText.destroy();
    }
  });

  scene.tweens.add({
    targets: [warning, warningText],
    alpha: 0.3,
    duration: 300,
    yoyo: true,
    repeat: 4
  });
}

function initOrbitingBalls() {
  // Clear existing balls
  orbitingBalls.forEach(ball => ball.destroy());
  orbitingBalls = [];
  orbitAngle = 0;

  // Create initial balls
  const weapon = getWeapon('orbitingBall');
  for (let i = 0; i < weapon.count; i++) {
    const ball = scene.physics.add.image(player.x, player.y, 'orbitingBall');

    // Update both hitbox and visual size
    const scale = weapon.ballRadius / 8; // 8 is base radius
    ball.setScale(scale);
    ball.body.setCircle(weapon.ballRadius);

    ball.setData('lastHitTime', {});
    orbitingBalls.push(ball);
  }

  // Set up overlap (not collider, so balls don't block)
  scene.physics.add.overlap(orbitingBalls, enemies, hitEnemyWithBall, null, scene);
}

function updateOrbitingBalls(delta) {
  const weapon = getWeapon('orbitingBall');
  if (!weapon.unlocked) return;

  // Add/remove balls if count changed
  if (orbitingBalls.length < weapon.count) {
    for (let i = orbitingBalls.length; i < weapon.count; i++) {
      const ball = scene.physics.add.image(player.x, player.y, 'orbitingBall');

      // Update both hitbox and visual size
      const scale = weapon.ballRadius / 8; // 8 is base radius
      ball.setScale(scale);
      ball.body.setCircle(weapon.ballRadius);

      ball.setData('lastHitTime', {});
      orbitingBalls.push(ball);
      scene.physics.add.overlap([ball], enemies, hitEnemyWithBall, null, scene);
    }
  }

  // Update ball size if changed (both visual and hitbox)
  const scale = weapon.ballRadius / 8; // 8 is base radius
  orbitingBalls.forEach((ball) => {
    if (!ball || !ball.active) return;
    ball.setScale(scale);
    ball.body.setCircle(weapon.ballRadius);
  });

  // Update angle
  orbitAngle += (weapon.rotSpeed * delta) / 1000;

  // Update ball positions
  orbitingBalls.forEach((ball, i) => {
    if (!ball || !ball.active) return;
    const angleOffset = (Math.PI * 2 / weapon.count) * i;
    const angle = orbitAngle + angleOffset;
    ball.x = player.x + Math.cos(angle) * weapon.radius;
    ball.y = player.y + Math.sin(angle) * weapon.radius;
  });
}

function hitEnemyWithBall(ball, enemy) {
  if (!enemy.active || !ball.active) return;

  const weapon = getWeapon('orbitingBall');
  const now = Date.now();
  const lastHitTimes = ball.getData('lastHitTime');
  const enemyId = enemy.getData('id') || enemy.body.id;

  // Cooldown: 200ms per enemy
  if (lastHitTimes[enemyId] && now - lastHitTimes[enemyId] < 200) {
    return;
  }

  lastHitTimes[enemyId] = now;
  ball.setData('lastHitTime', lastHitTimes);

  // Check for critical hit
  const isCrit = Math.random() < stats.critChance;
  let damage = weapon.damage;
  if (isCrit) {
    damage *= stats.critDamage;
  }

  // Apply damage
  const hp = enemy.getData('hp') - damage;
  enemy.setData('hp', hp);

  // Apply damage feedback (visual + knockback)
  applyDamageFeedback(enemy, ball.x, ball.y, isCrit);

  playTone(scene, 1100, 0.05);

  if (hp <= 0) {
    const xpValue = enemy.getData('xpValue') || 5;
    const isBoss = enemy.getData('isBoss');
    const dropChance = enemy.getData('dropChance') || 0;
    dropXP(enemy.x, enemy.y, xpValue);

    if (isBoss) {
      dropChest(enemy.x, enemy.y);
    } else {
      // Normal enemies have a chance to drop upgrade chests
      const finalDropChance = dropChance * stats.lootChance;
      if (Math.random() < finalDropChance) {
        dropUpgradeChest(enemy.x, enemy.y);
      }
    }

    enemy.destroy();
    stats.enemiesKilled++;
  }
}

function initAreaDamage() {
  // Create visual circle
  if (areaDamageCircle) areaDamageCircle.destroy();

  areaDamageCircle = scene.add.graphics();
  areaDamageCircle.setDepth(-1);
}

function updateAreaDamage(delta) {
  const weapon = getWeapon('areaDamage');
  if (!weapon.unlocked) return;

  // Update visual circle position
  if (areaDamageCircle) {
    areaDamageCircle.clear();
    areaDamageCircle.lineStyle(2, 0xffaa00, 0.5);
    areaDamageCircle.fillStyle(0xffaa00, 0.15);
    areaDamageCircle.fillCircle(player.x, player.y, weapon.radius);
    areaDamageCircle.strokeCircle(player.x, player.y, weapon.radius);
  }

  // Damage tick
  weapon.lastTick += delta;
  if (weapon.lastTick >= weapon.tickRate) {
    weapon.lastTick = 0;

    let hitAnyEnemy = false;

    // Find enemies in range
    enemies.children.entries.forEach(enemy => {
      if (!enemy.active) return;
      const dist = Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y);
      if (dist <= weapon.radius) {
        hitAnyEnemy = true;

        // Check for critical hit
        const isCrit = Math.random() < stats.critChance;
        let damage = weapon.dps;
        if (isCrit) {
          damage *= stats.critDamage;
        }

        // Apply damage
        const hp = enemy.getData('hp') - damage;
        enemy.setData('hp', hp);

        // Apply damage feedback (visual + knockback)
        applyDamageFeedback(enemy, player.x, player.y, isCrit);

        if (hp <= 0) {
          playTone(scene, 660, 0.1);
          const xpValue = enemy.getData('xpValue') || 5;
          const isBoss = enemy.getData('isBoss');
          const dropChance = enemy.getData('dropChance') || 0;
          dropXP(enemy.x, enemy.y, xpValue);

          if (isBoss) {
            dropChest(enemy.x, enemy.y);
          } else {
            // Normal enemies have a chance to drop upgrade chests
            const finalDropChance = dropChance * stats.lootChance;
            if (Math.random() < finalDropChance) {
              dropUpgradeChest(enemy.x, enemy.y);
            }
          }

          enemy.destroy();
          stats.enemiesKilled++;
        }
      }
    });

    // Play damage sound once per tick if any enemy was hit
    if (hitAnyEnemy) {
      playTone(scene, 300, 0.06);
    }
  }
}

function initBoomerangWeapon() {
  const weapon = getWeapon('boomerang');
  availableBoomerangs = weapon.count;
  boomerangs = [];
}

function shootBoomerang() {
  const weapon = getWeapon('boomerang');
  if (!weapon.unlocked || availableBoomerangs <= 0) return;

  const target = findClosestEnemy();
  if (!target) return;

  // Calculate angle toward target
  const angle = Phaser.Math.Angle.Between(player.x, player.y, target.x, target.y);
  const vx = Math.cos(angle) * weapon.speed;
  const vy = Math.sin(angle) * weapon.speed;

  // Create boomerang sprite
  const boom = scene.physics.add.sprite(player.x, player.y, 'boomerang');
  boom.setScale(weapon.size);
  boom.body.setCircle(8 * weapon.size);
  boom.body.setVelocity(vx, vy);

  // Set data
  boom.setData('state', 'outbound');
  boom.setData('startX', player.x);
  boom.setData('startY', player.y);
  boom.setData('distanceTraveled', 0);
  boom.setData('lastHitTimes', {});
  boom.setData('rotation', 0);

  boomerangs.push(boom);
  availableBoomerangs--;

  // Setup collision
  scene.physics.add.overlap(boom, enemies, hitEnemyWithBoomerang, null, scene);
  scene.physics.add.overlap(boom, player, collectBoomerang, null, scene);

  playTone(scene, 1200, 0.1);
}

function updateBoomerangs(delta) {
  const weapon = getWeapon('boomerang');
  if (!weapon.unlocked) return;

  boomerangs.forEach((boom, index) => {
    if (!boom || !boom.active) {
      boomerangs.splice(index, 1);
      return;
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
      if (dist >= weapon.maxDistance) {
        boom.setData('state', 'returning');

        // Start returning to player
        const angleToPlayer = Phaser.Math.Angle.Between(boom.x, boom.y, player.x, player.y);
        boom.body.setVelocity(
          Math.cos(angleToPlayer) * weapon.returnSpeed,
          Math.sin(angleToPlayer) * weapon.returnSpeed
        );
      }
    } else if (state === 'returning') {
      // Check distance to player
      const distToPlayer = Phaser.Math.Distance.Between(boom.x, boom.y, player.x, player.y);

      // Collect if close enough (within 30 pixels)
      if (distToPlayer < 30) {
        // Remove from array
        boomerangs.splice(index, 1);
        // Destroy sprite
        boom.destroy();
        // Recharge
        availableBoomerangs++;
        playTone(scene, 1500, 0.1);
        return;
      }

      // Update direction to player (homing)
      const angleToPlayer = Phaser.Math.Angle.Between(boom.x, boom.y, player.x, player.y);
      boom.body.setVelocity(
        Math.cos(angleToPlayer) * weapon.returnSpeed,
        Math.sin(angleToPlayer) * weapon.returnSpeed
      );
    }
  });
}

function hitEnemyWithBoomerang(boom, enemy) {
  if (!boom.active || !enemy.active) return;

  const weapon = getWeapon('boomerang');
  const now = Date.now();
  const lastHitTimes = boom.getData('lastHitTimes');
  const enemyId = enemy.getData('id') || enemy.body.id;

  // Cooldown: 200ms per enemy
  if (lastHitTimes[enemyId] && now - lastHitTimes[enemyId] < 200) {
    return;
  }

  lastHitTimes[enemyId] = now;
  boom.setData('lastHitTimes', lastHitTimes);

  // Check for critical hit
  const isCrit = Math.random() < stats.critChance;
  let damage = weapon.damage;
  if (isCrit) {
    damage *= stats.critDamage;
  }

  // Apply damage
  const hp = enemy.getData('hp') - damage;
  enemy.setData('hp', hp);

  // Apply damage feedback
  applyDamageFeedback(enemy, boom.x, boom.y, isCrit);

  playTone(scene, 1000, 0.05);

  if (hp <= 0) {
    const xpValue = enemy.getData('xpValue') || 5;
    const isBoss = enemy.getData('isBoss');
    const dropChance = enemy.getData('dropChance') || 0;
    dropXP(enemy.x, enemy.y, xpValue);

    if (isBoss) {
      dropChest(enemy.x, enemy.y);
      dropMagnet(enemy.x + 40, enemy.y);
    } else {
      const finalDropChance = dropChance * stats.lootChance;
      if (Math.random() < finalDropChance) {
        dropUpgradeChest(enemy.x, enemy.y);
      }

      const magnetDropChance = 0.015;
      if (Math.random() < magnetDropChance * stats.lootChance) {
        dropMagnet(enemy.x, enemy.y);
      }
    }

    enemy.destroy();
    stats.enemiesKilled++;
  }
}

function collectBoomerang(_playerObj, boom) {
  if (!boom.active) return;
  if (boom.getData('state') !== 'returning') return;

  // Remove from array
  const index = boomerangs.indexOf(boom);
  if (index > -1) {
    boomerangs.splice(index, 1);
  }

  // Destroy sprite
  boom.destroy();

  // Recharge
  availableBoomerangs++;

  playTone(scene, 1500, 0.1);
}

function applyDamageFeedback(enemy, sourceX, sourceY, isCrit = false) {
  if (!enemy.active) return;

  // Apply tint based on crit (yellow for crit, red for normal)
  if (isCrit) {
    enemy.setTintFill(0xffff00);
    // Scale up briefly for crit
    const originalScale = enemy.scaleX;
    enemy.setScale(originalScale * 1.3);
    scene.time.delayedCall(100, () => {
      if (enemy && enemy.active) {
        enemy.clearTint();
        enemy.setScale(originalScale);
      }
    });
  } else {
    enemy.setTintFill(0xff0000);
    scene.time.delayedCall(100, () => {
      if (enemy && enemy.active) {
        enemy.clearTint();
      }
    });
  }

  // Calculate knockback direction (away from source)
  const angle = Phaser.Math.Angle.Between(sourceX, sourceY, enemy.x, enemy.y);
  const knockbackForce = isCrit ? stats.knockback * 1.5 : stats.knockback;

  // Set knockback state (enemy won't update velocity for 150ms)
  enemy.setData('knockbackUntil', gameTime + 150);

  // Apply knockback velocity (replace current velocity)
  enemy.body.setVelocity(
    Math.cos(angle) * knockbackForce,
    Math.sin(angle) * knockbackForce
  );
}

function toggleStatsPanel() {
  showStats = !showStats;

  if (showStats) {
    // Opening stats panel
    // Save if game was already paused (levelingUp or selectingWeapon)
    wasPausedBeforeStats = levelingUp || selectingWeapon;

    // Pause the game
    scene.physics.pause();

    // Create the panel
    createStatsPanel();
  } else if (statsPanel) {
    // Closing stats panel
    statsPanel.forEach(el => el.destroy());
    statsPanel = null;

    // Resume game only if it wasn't paused before (no active menus)
    if (!wasPausedBeforeStats && !levelingUp && !selectingWeapon) {
      scene.physics.resume();
    }
  }
}

function createStatsPanel() {
  if (statsPanel) {
    statsPanel.forEach(el => el.destroy());
  }

  statsPanel = [];

  // Background overlay
  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.85);
  bg.fillRoundedRect(50, 50, 700, 500, 10);
  bg.lineStyle(3, 0xffaa00, 1);
  bg.strokeRoundedRect(50, 50, 700, 500, 10);
  bg.setScrollFactor(0);
  bg.setDepth(150);
  statsPanel.push(bg);

  // Title
  const title = scene.add.text(400, 75, 'STATS [S to close]', {
    fontSize: '28px',
    fontFamily: 'Arial',
    color: '#ffaa00',
    fontStyle: 'bold'
  }).setOrigin(0.5).setScrollFactor(0).setDepth(151);
  statsPanel.push(title);

  // Player Stats
  let y = 120;
  const addStat = (label, value, color = '#ffffff') => {
    const t = scene.add.text(80, y, `${label}: ${value}`, {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: color
    }).setScrollFactor(0).setDepth(151);
    statsPanel.push(t);
    y += 25;
  };

  // Character info
  if (selectedCharacter) {
    addStat(`Character: ${selectedCharacter.name}`, '', '#ffff00');
  }

  addStat('HP', `${Math.floor(stats.hp)}/${stats.maxHp}`, '#ff6666');
  addStat('Speed', Math.floor(stats.speed), '#66ff66');
  addStat('Knockback', Math.floor(stats.knockback), '#66ccff');
  addStat('HP Regen', `${stats.hpRegen}/min`, '#88ff88');
  addStat('XP Multiplier', `${stats.xpMultiplier.toFixed(1)}x`, '#ffff66');
  addStat('Luck', `${stats.lootChance.toFixed(1)}x`, '#66ffcc');
  addStat('Crit Chance', `${(stats.critChance * 100).toFixed(0)}%`, '#ff88ff');
  addStat('Crit Damage', `${stats.critDamage.toFixed(2)}x`, '#ff66ff');
  addStat('Level', stats.level, '#aaaaff');
  addStat('Enemies Killed', stats.enemiesKilled, '#ffaa66');

  // Weapons Section
  y += 10;
  const weaponsTitle = scene.add.text(80, y, 'WEAPONS:', {
    fontSize: '20px',
    fontFamily: 'Arial',
    color: '#ffaa00',
    fontStyle: 'bold'
  }).setScrollFactor(0).setDepth(151);
  statsPanel.push(weaponsTitle);
  y += 30;

  // Show each unlocked weapon
  weaponTypes.forEach(weapon => {
    if (weapon.unlocked) {
      const wTitle = scene.add.text(100, y, weapon.name, {
        fontSize: '18px',
        fontFamily: 'Arial',
        color: '#ffdd00',
        fontStyle: 'bold'
      }).setScrollFactor(0).setDepth(151);
      statsPanel.push(wTitle);
      y += 22;

      if (weapon.id === 'projectile') {
        const w = scene.add.text(120, y, `Count: ${weapon.count} | Fire Rate: ${weapon.fireRate}ms | Damage: ${weapon.damage} | Penetration: ${weapon.penetration}`, {
          fontSize: '14px',
          fontFamily: 'Arial',
          color: '#cccccc'
        }).setScrollFactor(0).setDepth(151);
        statsPanel.push(w);
        y += 20;
      } else if (weapon.id === 'orbitingBall') {
        const w = scene.add.text(120, y, `Count: ${weapon.count} | Rot Speed: ${weapon.rotSpeed} | Radius: ${weapon.radius} | Ball Size: ${weapon.ballRadius} | Damage: ${weapon.damage}`, {
          fontSize: '14px',
          fontFamily: 'Arial',
          color: '#cccccc'
        }).setScrollFactor(0).setDepth(151);
        statsPanel.push(w);
        y += 20;
      } else if (weapon.id === 'areaDamage') {
        const w = scene.add.text(120, y, `Radius: ${weapon.radius} | DPS: ${weapon.dps} | Tick Rate: ${weapon.tickRate}ms`, {
          fontSize: '14px',
          fontFamily: 'Arial',
          color: '#cccccc'
        }).setScrollFactor(0).setDepth(151);
        statsPanel.push(w);
        y += 20;
      } else if (weapon.id === 'boomerang') {
        const w = scene.add.text(120, y, `Available: ${availableBoomerangs}/${weapon.count} | Damage: ${weapon.damage} | Speed: ${Math.floor(weapon.speed)} | Range: ${weapon.maxDistance} | Size: ${weapon.size.toFixed(1)}x`, {
          fontSize: '14px',
          fontFamily: 'Arial',
          color: '#cccccc'
        }).setScrollFactor(0).setDepth(151);
        statsPanel.push(w);
        y += 20;
      }
      y += 5;
    }
  });
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
