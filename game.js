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
let player, cursors, enemies, projectiles, xpOrbs, graphics;
let gameOver = false, levelingUp = false;
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

// Player stats
let stats = {
  hp: 100,
  maxHp: 100,
  speed: 150,
  damage: 10,
  fireRate: 500,
  projectileCount: 1,
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

// Upgrade options
const upgrades = [
  { name: 'Damage', desc: '+20% Damage', icon: '🗡️', apply: () => stats.damage *= 1.2 },
  { name: 'Fire Rate', desc: '-15% Fire Delay', icon: '⚡', apply: () => stats.fireRate *= 0.85 },
  { name: 'Speed', desc: '+15% Move Speed', icon: '👟', apply: () => stats.speed *= 1.15 },
  { name: 'Max HP', desc: '+20 Max HP', icon: '❤️', apply: () => { stats.maxHp += 20; stats.hp += 20; } },
  { name: 'Multi Shot', desc: '+1 Projectile', icon: '🔫', apply: () => stats.projectileCount++ }
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

  g.destroy();
}

function create() {
  scene = this;
  graphics = this.add.graphics();

  // Initialize unlocked types with first type
  unlockedTypes = [enemyTypes[0]];

  // Create physics groups
  enemies = this.physics.add.group();
  projectiles = this.physics.add.group();
  xpOrbs = this.physics.add.group();

  // Create player
  player = this.physics.add.image(400, 300, 'player');
  player.setCollideWorldBounds(true);
  player.body.setCircle(12);

  // Input
  cursors = this.input.keyboard.createCursorKeys();

  // Collisions
  this.physics.add.overlap(projectiles, enemies, hitEnemy, null, this);
  this.physics.add.overlap(player, enemies, hitPlayer, null, this);
  this.physics.add.overlap(player, xpOrbs, collectXP, null, this);

  // Enemy-to-enemy collisions (they push each other)
  this.physics.add.collider(enemies, enemies);

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
  if (gameOver || levelingUp) return;

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

  // Auto shoot
  if (shootTimer >= stats.fireRate) {
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
    const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
    const speed = enemy.getData('speed');
    enemy.body.setVelocity(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );
  });

  // Update UI
  updateUI();

  // Draw UI bars
  drawUIBars();
}

function shoot() {
  const target = findClosestEnemy();
  if (!target) return;

  playTone(scene, 880, 0.05);

  // Calculate angles for multiple projectiles
  const baseAngle = Phaser.Math.Angle.Between(player.x, player.y, target.x, target.y);
  const spread = stats.projectileCount > 1 ? 0.3 : 0;
  const startOffset = -(stats.projectileCount - 1) * spread / 2;

  for (let i = 0; i < stats.projectileCount; i++) {
    const angle = baseAngle + startOffset + i * spread;
    const vx = Math.cos(angle) * 300;
    const vy = Math.sin(angle) * 300;

    // Create using the group (important!)
    const proj = projectiles.create(player.x, player.y, 'projectile');
    proj.body.setCircle(4);
    proj.body.setVelocity(vx, vy);

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

  if (side === 0) { x = Math.random() * 800; y = -20; }
  else if (side === 1) { x = Math.random() * 800; y = 620; }
  else if (side === 2) { x = -20; y = Math.random() * 600; }
  else { x = 820; y = Math.random() * 600; }

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
}

function hitEnemy(proj, enemy) {
  if (!enemy.active || !proj.active) return;

  proj.destroy();

  const hp = enemy.getData('hp') - stats.damage;
  enemy.setData('hp', hp);

  if (hp <= 0) {
    playTone(scene, 660, 0.1);
    const xpValue = enemy.getData('xpValue') || 5;
    dropXP(enemy.x, enemy.y, xpValue);
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
  // Semi-transparent overlay
  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0.85);
  overlay.fillRect(0, 0, 800, 600);
  overlay.setDepth(100);

  // Title
  const title = scene.add.text(400, 100, 'LEVEL UP!', {
    fontSize: '48px',
    fontFamily: 'Arial',
    color: '#ffff00',
    stroke: '#000000',
    strokeThickness: 6
  }).setOrigin(0.5).setDepth(101);

  // Shuffle and pick 3 upgrades
  const shuffled = [...upgrades].sort(() => Math.random() - 0.5).slice(0, 3);

  shuffled.forEach((upgrade, i) => {
    const x = 150 + i * 250;
    const y = 300;

    // Button background
    const btn = scene.add.graphics();
    btn.fillStyle(0x333333, 1);
    btn.fillRoundedRect(x - 90, y - 80, 180, 160, 10);
    btn.lineStyle(3, 0x00ff00, 1);
    btn.strokeRoundedRect(x - 90, y - 80, 180, 160, 10);
    btn.setDepth(101);
    btn.setInteractive(new Phaser.Geom.Rectangle(x - 90, y - 80, 180, 160), Phaser.Geom.Rectangle.Contains);

    // Icon
    scene.add.text(x, y - 30, upgrade.icon, {
      fontSize: '48px'
    }).setOrigin(0.5).setDepth(102);

    // Name
    scene.add.text(x, y + 20, upgrade.name, {
      fontSize: '20px',
      fontFamily: 'Arial',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(102);

    // Description
    scene.add.text(x, y + 50, upgrade.desc, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#cccccc'
    }).setOrigin(0.5).setDepth(102);

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

function createUI() {
  // HP Bar label
  ui.hpText = scene.add.text(10, 10, 'HP:', {
    fontSize: '16px',
    fontFamily: 'Arial',
    color: '#ffffff'
  });

  // XP Bar label
  ui.xpText = scene.add.text(300, 10, 'XP:', {
    fontSize: '16px',
    fontFamily: 'Arial',
    color: '#ffffff'
  });

  // Level
  ui.levelText = scene.add.text(550, 10, 'Level: 1', {
    fontSize: '16px',
    fontFamily: 'Arial',
    color: '#ffff00'
  });

  // Timer
  ui.timeText = scene.add.text(700, 10, '0:00', {
    fontSize: '16px',
    fontFamily: 'Arial',
    color: '#00ffff'
  });
}

function updateUI() {
  ui.levelText.setText(`Level: ${stats.level}`);

  const minutes = Math.floor(gameTime / 60000);
  const seconds = Math.floor((gameTime % 60000) / 1000);
  ui.timeText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`);
}

function drawUIBars() {
  graphics.clear();

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
    }).setOrigin(0.5).setDepth(200);

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
    }).setOrigin(0.5).setDepth(200);
  }

  // Draw enemy HP bars (smaller for regular enemies)
  enemies.children.entries.forEach(enemy => {
    if (!enemy.active || enemy.getData('isBoss')) return;
    const hp = enemy.getData('hp');
    const maxHp = enemy.getData('maxHp');
    const barWidth = 20;
    const barHeight = 3;
    const x = enemy.x - barWidth / 2;
    const y = enemy.y - 20;

    graphics.fillStyle(0x440000, 1);
    graphics.fillRect(x, y, barWidth, barHeight);
    graphics.fillStyle(0xff0000, 1);
    graphics.fillRect(x, y, barWidth * (hp / maxHp), barHeight);
  });
}

function endGame() {
  gameOver = true;
  playTone(scene, 150, 0.5);

  // Overlay
  const overlay = scene.add.graphics();
  overlay.fillStyle(0x000000, 0.8);
  overlay.fillRect(0, 0, 800, 600);

  // Game Over text
  scene.add.text(400, 200, 'GAME OVER', {
    fontSize: '64px',
    fontFamily: 'Arial',
    color: '#ff0000',
    stroke: '#000000',
    strokeThickness: 8
  }).setOrigin(0.5);

  // Stats
  const minutes = Math.floor(gameTime / 60000);
  const seconds = Math.floor((gameTime % 60000) / 1000);

  scene.add.text(400, 300, `Time Survived: ${minutes}:${seconds.toString().padStart(2, '0')}`, {
    fontSize: '28px',
    fontFamily: 'Arial',
    color: '#00ffff'
  }).setOrigin(0.5);

  scene.add.text(400, 350, `Level Reached: ${stats.level}`, {
    fontSize: '28px',
    fontFamily: 'Arial',
    color: '#ffff00'
  }).setOrigin(0.5);

  scene.add.text(400, 400, `Enemies Killed: ${stats.enemiesKilled}`, {
    fontSize: '28px',
    fontFamily: 'Arial',
    color: '#00ff00'
  }).setOrigin(0.5);

  // Restart text
  const restartText = scene.add.text(400, 500, 'Press R to Restart', {
    fontSize: '24px',
    fontFamily: 'Arial',
    color: '#ffffff'
  }).setOrigin(0.5);

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
  gameTime = 0;
  shootTimer = 0;
  spawnTimer = 0;
  waveTimer = 0;
  bossTimer = 0;
  warningActive = false;

  stats = {
    hp: 100,
    maxHp: 100,
    speed: 150,
    damage: 10,
    fireRate: 500,
    projectileCount: 1,
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

  // Spawn 15-20 enemies
  const count = 15 + Math.floor(Math.random() * 6);
  const angleStep = (Math.PI * 2) / count;

  for (let i = 0; i < count; i++) {
    const angle = i * angleStep;
    const distance = 400;
    const x = 400 + Math.cos(angle) * distance;
    const y = 300 + Math.sin(angle) * distance;

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
  }
}

function spawnBoss() {
  warningActive = false;
  playTone(scene, 100, 0.4);

  // Select highest unlocked type for boss
  const type = unlockedTypes[unlockedTypes.length - 1];

  // Spawn boss from random edge
  const side = Math.floor(Math.random() * 4);
  let x, y;

  if (side === 0) { x = 400; y = -50; }
  else if (side === 1) { x = 400; y = 650; }
  else if (side === 2) { x = -50; y = 300; }
  else { x = 850; y = 300; }

  const boss = enemies.create(x, y, `boss_${type.name}`);
  boss.body.setCircle(30);
  boss.setData('hp', difficulty.enemyHp * type.hpMult * 10);
  boss.setData('maxHp', difficulty.enemyHp * type.hpMult * 10);
  boss.setData('speed', difficulty.enemySpeed * type.speedMult * 0.7);
  boss.setData('damage', difficulty.enemyDamage * type.damageMult * 2);
  boss.setData('xpValue', type.xp * 10);
  boss.setData('type', type.name);
  boss.setData('isBoss', true);
}

function showWarning(text, color) {
  warningActive = true;

  // Create warning overlay
  const warning = scene.add.graphics();
  warning.fillStyle(color, 0.3);
  warning.fillRect(0, 250, 800, 100);
  warning.setDepth(50);

  // Warning text
  const warningText = scene.add.text(400, 300, text, {
    fontSize: '48px',
    fontFamily: 'Arial',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 6
  }).setOrigin(0.5).setDepth(51);

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
