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
let player, cursors, enemies, projectiles, xpOrbs, obstacles, weaponChests, graphics;
let areaDamageCircle = null;
let gameOver = false, levelingUp = false, selectingWeapon = false;
let gameTime = 0, shootTimer = 0, spawnTimer = 0;
let waveTimer = 0, bossTimer = 0;
let nextWaveTime = 60000, nextBossTime = 120000;
let warningActive = false;
let scene;

// Enemy types configuration
const enemyTypes = [
  { name: 'green', color: 0x00ff00, hpMult: 1.0, speedMult: 1.0, damageMult: 1.0, xp: 5, unlockTime: 0 },
  { name: 'blue', color: 0x0088ff, hpMult: 1.5, speedMult: 0.95, damageMult: 1.2, xp: 8, unlockTime: 20000 },
  { name: 'cyan', color: 0x00ffff, hpMult: 2.0, speedMult: 1.05, damageMult: 1.4, xp: 10, unlockTime: 40000 },
  { name: 'yellow', color: 0xffff00, hpMult: 2.5, speedMult: 0.9, damageMult: 1.6, xp: 15, unlockTime: 60000 },
  { name: 'orange', color: 0xff8800, hpMult: 3.0, speedMult: 1.1, damageMult: 1.8, xp: 20, unlockTime: 90000 },
  { name: 'red', color: 0xff0000, hpMult: 4.0, speedMult: 0.85, damageMult: 2.0, xp: 25, unlockTime: 120000 },
  { name: 'purple', color: 0xff00ff, hpMult: 5.0, speedMult: 1.15, damageMult: 2.5, xp: 35, unlockTime: 150000 }
];

let unlockedTypes = [];

// Weapon system
const weaponTypes = [
  {
    id: 'projectile',
    name: 'Proyectiles',
    desc: 'Dispara automáticamente al enemigo más cercano',
    unlocked: true,
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
    count: 1,
    rotSpeed: 2,
    radius: 80,
    damage: 15
  },
  {
    id: 'areaDamage',
    name: 'Área de Daño',
    desc: 'Daña continuamente a enemigos cercanos',
    unlocked: false,
    radius: 150,
    dps: 5,
    tickRate: 500,
    lastTick: 0
  },
  {
    id: 'placeholder1',
    name: 'Arma Futura 1',
    desc: 'Por desbloquear...',
    unlocked: false
  },
  {
    id: 'placeholder2',
    name: 'Arma Futura 2',
    desc: 'Por desbloquear...',
    unlocked: false
  }
];

let orbitingBalls = [];
let orbitAngle = 0;

// Player stats
let stats = {
  hp: 100,
  maxHp: 100,
  speed: 150,
  knockback: 100,
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

// Helper to get weapon by id
function getWeapon(id) {
  return weaponTypes.find(w => w.id === id);
}

// Upgrade options (organized by category)
const playerUpgrades = [
  { name: 'Speed', desc: '+15% Move Speed', icon: '👟', apply: () => stats.speed *= 1.15 },
  { name: 'Max HP', desc: '+20 Max HP', icon: '❤️', apply: () => { stats.maxHp += 20; stats.hp += 20; } },
  { name: 'Knockback', desc: '+30% Enemy Pushback', icon: '💨', apply: () => stats.knockback *= 1.3 }
];

const projectileUpgrades = [
  { name: 'Multi Shot', desc: '+1 Projectile', icon: '🔫', weaponId: 'projectile', apply: () => getWeapon('projectile').count++ },
  { name: 'Fire Rate', desc: '-100ms Fire Delay', icon: '⚡', weaponId: 'projectile', apply: () => getWeapon('projectile').fireRate = Math.max(200, getWeapon('projectile').fireRate - 100) },
  { name: 'Projectile Damage', desc: '+5 Damage', icon: '🗡️', weaponId: 'projectile', apply: () => getWeapon('projectile').damage += 5 },
  { name: 'Penetration', desc: '+1 Enemy Pierced', icon: '⚔️', weaponId: 'projectile', apply: () => getWeapon('projectile').penetration++ }
];

const orbitingBallUpgrades = [
  { name: 'More Balls', desc: '+1 Orbiting Ball', icon: '⚪', weaponId: 'orbitingBall', apply: () => getWeapon('orbitingBall').count++ },
  { name: 'Rotation Speed', desc: '+0.5 Rotation Speed', icon: '🌀', weaponId: 'orbitingBall', apply: () => getWeapon('orbitingBall').rotSpeed += 0.5 },
  { name: 'Orbit Radius', desc: '+20 Orbit Distance', icon: '🔵', weaponId: 'orbitingBall', apply: () => getWeapon('orbitingBall').radius += 20 },
  { name: 'Ball Damage', desc: '+8 Ball Damage', icon: '💥', weaponId: 'orbitingBall', apply: () => getWeapon('orbitingBall').damage += 8 }
];

const areaDamageUpgrades = [
  { name: 'Area Radius', desc: '+30 Area Range', icon: '🔴', weaponId: 'areaDamage', apply: () => getWeapon('areaDamage').radius += 30 },
  { name: 'Area DPS', desc: '+3 Damage/Second', icon: '🔥', weaponId: 'areaDamage', apply: () => getWeapon('areaDamage').dps += 3 }
];

// Rare upgrades (more powerful versions)
const rareUpgrades = [
  { name: 'Triple Shot', desc: '+3 Projectiles', icon: '🔫🔫', weaponId: 'projectile', apply: () => getWeapon('projectile').count += 3 },
  { name: 'Rapid Fire', desc: '-200ms Fire Delay', icon: '⚡⚡', weaponId: 'projectile', apply: () => getWeapon('projectile').fireRate = Math.max(100, getWeapon('projectile').fireRate - 200) },
  { name: 'Massive Damage', desc: '+30 Projectile Damage', icon: '🗡️🗡️', weaponId: 'projectile', apply: () => getWeapon('projectile').damage += 30 },
  { name: 'Double Balls', desc: '+2 Orbiting Balls', icon: '⚪⚪', weaponId: 'orbitingBall', apply: () => getWeapon('orbitingBall').count += 2 },
  { name: 'Mega Ball Damage', desc: '+25 Ball Damage', icon: '💥💥', weaponId: 'orbitingBall', apply: () => getWeapon('orbitingBall').damage += 25 },
  { name: 'Huge Area', desc: '+100 Area Range', icon: '🔴🔴', weaponId: 'areaDamage', apply: () => getWeapon('areaDamage').radius += 100 },
  { name: 'Devastating DPS', desc: '+15 Damage/Second', icon: '🔥🔥', weaponId: 'areaDamage', apply: () => getWeapon('areaDamage').dps += 15 }
];

function preload() {
  // Create simple textures programmatically
  const g = this.add.graphics();

  // Player texture (green circle)
  g.fillStyle(0x00ff00, 1);
  g.fillCircle(12, 12, 12);
  g.generateTexture('player', 24, 24);
  g.clear();

  // Enemy textures (one for each type)
  enemyTypes.forEach(type => {
    g.fillStyle(type.color, 1);
    g.fillCircle(10, 10, 10);
    g.generateTexture(`enemy_${type.name}`, 20, 20);
    g.clear();

    // Boss texture (3x size)
    g.fillStyle(type.color, 1);
    g.fillCircle(30, 30, 30);
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

  // Expand world bounds (3x larger than screen)
  this.physics.world.setBounds(0, 0, 2400, 1800);

  // Initialize unlocked types with first type
  unlockedTypes = [enemyTypes[0]];

  // Create physics groups
  enemies = this.physics.add.group();
  projectiles = this.physics.add.group();
  xpOrbs = this.physics.add.group();
  weaponChests = this.physics.add.group();
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
  player.body.setCircle(12);

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
    if (gameOver) restartGame();
  });

  // Start sound
  playTone(this, 440, 0.1);
}

function update(_time, delta) {
  if (gameOver || levelingUp || selectingWeapon) return;

  gameTime += delta;
  shootTimer += delta;
  spawnTimer += delta;

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

  // Update orbiting balls
  updateOrbitingBalls(delta);

  // Update area damage
  updateAreaDamage(delta);

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
  enemy.setData('maxHp', difficulty.enemyHp * type.hpMult);
  enemy.setData('speed', difficulty.enemySpeed * type.speedMult);
  enemy.setData('damage', difficulty.enemyDamage * type.damageMult);
  enemy.setData('xpValue', type.xp);
  enemy.setData('type', type.name);
  enemy.setData('knockbackUntil', 0);
}

function hitEnemy(proj, enemy) {
  if (!enemy.active || !proj.active) return;

  const projDamage = proj.getData('damage') || 10;
  const projPenetration = proj.getData('penetration') || 0;
  const projHits = proj.getData('hits') || 0;

  // Apply damage to enemy
  const hp = enemy.getData('hp') - projDamage;
  enemy.setData('hp', hp);

  // Apply damage feedback (visual + knockback)
  applyDamageFeedback(enemy, proj.x, proj.y);

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
    dropXP(enemy.x, enemy.y, xpValue);

    // Bosses drop weapon chests
    if (isBoss) {
      dropChest(enemy.x, enemy.y);
    }

    enemy.destroy();
    stats.enemiesKilled++;
  }
}

function hitPlayer(_playerObj, enemy) {
  if (!enemy.active) return;

  const damage = enemy.getData('damage') || difficulty.enemyDamage;
  stats.hp -= damage;
  playTone(scene, 220, 0.15);
  enemy.destroy();

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
  const xpValue = orb.getData('xpValue') || 5;
  orb.destroy();
  stats.xp += xpValue;

  if (stats.xp >= stats.xpToNext) {
    levelUp();
  }
}

function dropChest(x, y) {
  const chest = weaponChests.create(x, y, 'chest');
  chest.body.setCircle(10);
  // Chest bounces slightly
  chest.setVelocity((Math.random() - 0.5) * 100, -150);
  chest.setBounce(0.5);
  chest.setCollideWorldBounds(true);
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

function levelUp() {
  levelingUp = true;
  stats.level++;
  stats.xp -= stats.xpToNext;
  stats.xpToNext = Math.floor(stats.xpToNext * 1.2);

  // Pause physics
  scene.physics.pause();

  playTone(scene, 1200, 0.2);

  showUpgradeMenu();
}

function showUpgradeMenu() {
  // Build available upgrades pool
  let availableUpgrades = [...playerUpgrades];

  // Always include projectile upgrades (always unlocked)
  availableUpgrades.push(...projectileUpgrades);

  // Add orbiting ball upgrades if unlocked
  if (getWeapon('orbitingBall').unlocked) {
    availableUpgrades.push(...orbitingBallUpgrades);
  }

  // Add area damage upgrades if unlocked
  if (getWeapon('areaDamage').unlocked) {
    availableUpgrades.push(...areaDamageUpgrades);
  }

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

    // Click handler
    btn.on('pointerdown', () => {
      upgrade.apply();
      playTone(scene, 1000, 0.1);

      // Clean up menu
      overlay.destroy();
      title.destroy();
      scene.children.list.filter(c => c.depth >= 100).forEach(c => c.destroy());

      // Resume physics
      scene.physics.resume();

      levelingUp = false;
    });

    // Hover effect
    btn.on('pointerover', () => {
      btn.clear();
      btn.fillStyle(0x444444, 1);
      btn.fillRoundedRect(x - 90, y - 80, 180, 160, 10);
      btn.lineStyle(3, 0x00ff00, 1);
      btn.strokeRoundedRect(x - 90, y - 80, 180, 160, 10);
    });

    btn.on('pointerout', () => {
      btn.clear();
      btn.fillStyle(0x333333, 1);
      btn.fillRoundedRect(x - 90, y - 80, 180, 160, 10);
      btn.lineStyle(3, 0x00ff00, 1);
      btn.strokeRoundedRect(x - 90, y - 80, 180, 160, 10);
    });
  });
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

    // Click handler
    btn.on('pointerdown', () => {
      weapon.unlocked = true;
      playTone(scene, 1500, 0.2);

      // Initialize weapon
      if (weapon.id === 'orbitingBall') {
        initOrbitingBalls();
      } else if (weapon.id === 'areaDamage') {
        initAreaDamage();
      }

      // Clean up menu
      overlay.destroy();
      title.destroy();
      scene.children.list.filter(c => c.depth >= 100).forEach(c => c.destroy());

      // Resume
      scene.physics.resume();
      selectingWeapon = false;
    });

    // Hover effect
    btn.on('pointerover', () => {
      btn.clear();
      btn.fillStyle(0x444444, 1);
      btn.fillRoundedRect(x - 90, y - 100, 180, 200, 10);
      btn.lineStyle(3, 0xffaa00, 1);
      btn.strokeRoundedRect(x - 90, y - 100, 180, 200, 10);
    });

    btn.on('pointerout', () => {
      btn.clear();
      btn.fillStyle(0x333333, 1);
      btn.fillRoundedRect(x - 90, y - 100, 180, 200, 10);
      btn.lineStyle(3, 0xffaa00, 1);
      btn.strokeRoundedRect(x - 90, y - 100, 180, 200, 10);
    });
  });
}

function showRareUpgradeMenu() {
  selectingWeapon = true;
  scene.physics.pause();

  // Filter rare upgrades to only unlocked weapons
  const available = rareUpgrades.filter(u => {
    if (!u.weaponId) return true; // Player upgrades
    return getWeapon(u.weaponId).unlocked;
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

    // Click handler
    btn.on('pointerdown', () => {
      upgrade.apply();
      playTone(scene, 1800, 0.1);

      // Clean up menu
      overlay.destroy();
      title.destroy();
      scene.children.list.filter(c => c.depth >= 100).forEach(c => c.destroy());

      // Resume
      scene.physics.resume();
      selectingWeapon = false;
    });

    // Hover effect
    btn.on('pointerover', () => {
      btn.clear();
      btn.fillStyle(0x440044, 1);
      btn.fillRoundedRect(x - 90, y - 80, 180, 160, 10);
      btn.lineStyle(3, 0xff00ff, 1);
      btn.strokeRoundedRect(x - 90, y - 80, 180, 160, 10);
    });

    btn.on('pointerout', () => {
      btn.clear();
      btn.fillStyle(0x330033, 1);
      btn.fillRoundedRect(x - 90, y - 80, 180, 160, 10);
      btn.lineStyle(3, 0xff00ff, 1);
      btn.strokeRoundedRect(x - 90, y - 80, 180, 160, 10);
    });
  });
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

    // Boss label
    graphics.fillStyle(0xffffff, 1);
    scene.add.text(400, 40, '⚔️ BOSS ⚔️', {
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
    scene.add.text(400, 62, `${Math.ceil(hp)} / ${Math.ceil(maxHp)}`, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200);
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
  gameTime = 0;
  shootTimer = 0;
  spawnTimer = 0;
  waveTimer = 0;
  bossTimer = 0;
  warningActive = false;

  // Reset weapons
  weaponTypes.forEach(weapon => {
    if (weapon.id === 'projectile') {
      weapon.unlocked = true;
      weapon.count = 1;
      weapon.fireRate = 500;
      weapon.damage = 10;
      weapon.penetration = 0;
    } else if (weapon.id === 'orbitingBall') {
      weapon.unlocked = false;
      weapon.count = 1;
      weapon.rotSpeed = 2;
      weapon.radius = 80;
      weapon.damage = 15;
    } else if (weapon.id === 'areaDamage') {
      weapon.unlocked = false;
      weapon.radius = 150;
      weapon.dps = 5;
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
    enemy.setData('maxHp', difficulty.enemyHp * type.hpMult * 1.5);
    enemy.setData('speed', difficulty.enemySpeed * type.speedMult);
    enemy.setData('damage', difficulty.enemyDamage * type.damageMult);
    enemy.setData('xpValue', type.xp);
    enemy.setData('type', type.name);
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
  boss.setData('type', type.name);
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
    ball.body.setCircle(8);
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
      ball.body.setCircle(8);
      ball.setData('lastHitTime', {});
      orbitingBalls.push(ball);
      scene.physics.add.overlap([ball], enemies, hitEnemyWithBall, null, scene);
    }
  }

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

  // Apply damage
  const hp = enemy.getData('hp') - weapon.damage;
  enemy.setData('hp', hp);

  // Apply damage feedback (visual + knockback)
  applyDamageFeedback(enemy, ball.x, ball.y);

  playTone(scene, 1100, 0.05);

  if (hp <= 0) {
    const xpValue = enemy.getData('xpValue') || 5;
    const isBoss = enemy.getData('isBoss');
    dropXP(enemy.x, enemy.y, xpValue);

    if (isBoss) {
      dropChest(enemy.x, enemy.y);
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

    // Find enemies in range
    enemies.children.entries.forEach(enemy => {
      if (!enemy.active) return;
      const dist = Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y);
      if (dist <= weapon.radius) {
        // Apply damage
        const hp = enemy.getData('hp') - weapon.dps;
        enemy.setData('hp', hp);

        // Apply visual feedback only (no knockback for area damage)
        applyVisualFeedback(enemy);

        if (hp <= 0) {
          playTone(scene, 660, 0.1);
          const xpValue = enemy.getData('xpValue') || 5;
          const isBoss = enemy.getData('isBoss');
          dropXP(enemy.x, enemy.y, xpValue);

          if (isBoss) {
            dropChest(enemy.x, enemy.y);
          }

          enemy.destroy();
          stats.enemiesKilled++;
        }
      }
    });
  }
}

function applyVisualFeedback(enemy) {
  if (!enemy.active) return;

  // Apply red tint fill (completely fills sprite with red, more visible)
  enemy.setTintFill(0xff0000);

  // Restore original appearance after 100ms
  scene.time.delayedCall(100, () => {
    if (enemy && enemy.active) {
      enemy.clearTint();
    }
  });
}

function applyDamageFeedback(enemy, sourceX, sourceY) {
  if (!enemy.active) return;

  // Apply visual feedback
  applyVisualFeedback(enemy);

  // Calculate knockback direction (away from source)
  const angle = Phaser.Math.Angle.Between(sourceX, sourceY, enemy.x, enemy.y);
  const knockbackForce = stats.knockback;

  // Set knockback state (enemy won't update velocity for 150ms)
  enemy.setData('knockbackUntil', gameTime + 150);

  // Apply knockback velocity (replace current velocity)
  enemy.body.setVelocity(
    Math.cos(angle) * knockbackForce,
    Math.sin(angle) * knockbackForce
  );
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
