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
let scene;

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
  xpToNext: 10
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

  // Enemy texture (red circle)
  g.fillStyle(0xff0000, 1);
  g.fillCircle(10, 10, 10);
  g.generateTexture('enemy', 20, 20);
  g.clear();

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

function update(time, delta) {
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

  // Scale difficulty every 30 seconds
  if (Math.floor(gameTime / 30000) > Math.floor((gameTime - delta) / 30000)) {
    difficulty.spawnRate = Math.max(500, difficulty.spawnRate * 0.9);
    difficulty.enemyHp *= 1.15;
    difficulty.enemyDamage *= 1.1;
    difficulty.enemySpeed = Math.min(120, difficulty.enemySpeed * 1.05);
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

  // Create using the group
  const enemy = enemies.create(x, y, 'enemy');
  enemy.body.setCircle(10);
  enemy.setData('hp', difficulty.enemyHp);
  enemy.setData('maxHp', difficulty.enemyHp);
  enemy.setData('speed', difficulty.enemySpeed);
}

function hitEnemy(proj, enemy) {
  if (!enemy.active || !proj.active) return;

  proj.destroy();

  const hp = enemy.getData('hp') - stats.damage;
  enemy.setData('hp', hp);

  if (hp <= 0) {
    playTone(scene, 660, 0.1);
    dropXP(enemy.x, enemy.y);
    enemy.destroy();
  }
}

function hitPlayer(playerObj, enemy) {
  if (!enemy.active) return;

  stats.hp -= difficulty.enemyDamage;
  playTone(scene, 220, 0.15);
  enemy.destroy();

  if (stats.hp <= 0) {
    endGame();
  }
}

function dropXP(x, y) {
  // Create using the group
  const orb = xpOrbs.create(x, y, 'xp');
  orb.body.setCircle(5);
  // XP orbs stay forever until collected
}

function collectXP(playerObj, orb) {
  if (!orb.active) return;
  orb.destroy();
  stats.xp += 5;

  if (stats.xp >= stats.xpToNext) {
    levelUp();
  }
}

function levelUp() {
  levelingUp = true;
  stats.level++;
  stats.xp -= stats.xpToNext;
  stats.xpToNext = Math.floor(stats.xpToNext * 1.2);

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

  // Draw enemy HP bars
  enemies.children.entries.forEach(enemy => {
    if (!enemy.active) return;
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

  scene.add.text(400, 400, `Enemies Killed: ${Math.floor(stats.xp / 5)}`, {
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

  stats = {
    hp: 100,
    maxHp: 100,
    speed: 150,
    damage: 10,
    fireRate: 500,
    projectileCount: 1,
    xp: 0,
    level: 1,
    xpToNext: 10
  };

  difficulty = {
    spawnRate: 2000,
    enemyHp: 20,
    enemyDamage: 10,
    enemySpeed: 80
  };

  scene.scene.restart();
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
