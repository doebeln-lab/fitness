const WORLD_SIZE = 2200;
const PLAYER_RADIUS = 18;
const ENEMY_RADIUS = 17;
const WALL_SIZE = 70;
const WALL_COST = 15;
const BULLET_DAMAGE = 28;
const ZONE_DAMAGE_PER_SECOND = 8;

const lootColors = {
  material: '#32f5c8',
  shield: '#4b82ff',
  medkit: '#ff5f8f',
};

const app = document.querySelector('#root');
app.innerHTML = `<main class="shell">
  <section class="hudPanel intro">
    <div>
      <p class="eyebrow">Stormforge Arena · spielbarer Browser-Prototyp</p>
      <h1>Looten, bauen, kämpfen, Zone überleben.</h1>
      <p>Eigenständiger Battle-Royale-Blockout ohne fremde Markenassets. Klicke ins Spielfeld und starte direkt mit Bewegung, Combat, Loot, Wandbau und schrumpfender Zone.</p>
    </div>
    <div class="controls">
      <strong>Steuerung</strong>
      <span>WASD bewegen</span><span>Shift sprinten</span><span>Strg ducken</span><span>Leertaste dash/jump</span><span>Maus zielen</span><span>Klick schießen</span><span>B Wand bauen</span><span>R Neustart</span>
    </div>
  </section>
  <section class="gameWrap">
    <canvas id="arena" width="1120" height="700" tabindex="0" aria-label="Spielbarer Stormforge Arena Prototyp"></canvas>
    <aside class="stats" id="stats"></aside>
  </section>
</main>`;

const canvas = document.querySelector('#arena');
const context = canvas.getContext('2d');
const stats = document.querySelector('#stats');
const keys = new Set();
const mouse = { x: canvas.width / 2, y: canvas.height / 2, down: false };

let game;
let lastFrame = performance.now();
let shootCooldown = 0;

function createGame() {
  return {
    status: 'playing',
    message: 'Überlebe als letzter Runner.',
    time: 0,
    camera: { x: 0, y: 0 },
    player: { x: 0, y: 0, health: 100, shield: 35, materials: 45, eliminations: 0, dashCooldown: 0 },
    walls: [
      { x: -260, y: -180, hp: 120 },
      { x: 330, y: 130, hp: 120 },
    ],
    bullets: [],
    particles: [],
    loot: spawnLoot(),
    enemies: spawnEnemies(),
    zone: { x: 0, y: 0, radius: 980, targetRadius: 980, nextShrink: 18, phase: 1 },
  };
}

function spawnLoot() {
  return Array.from({ length: 28 }, (_, index) => ({
    x: randomWorld(),
    y: randomWorld(),
    type: index % 7 === 0 ? 'medkit' : index % 5 === 0 ? 'shield' : 'material',
    amount: index % 7 === 0 ? 25 : index % 5 === 0 ? 20 : 20 + Math.floor(Math.random() * 25),
  }));
}

function spawnEnemies() {
  return Array.from({ length: 7 }, (_, index) => {
    const angle = (Math.PI * 2 * index) / 7;
    return {
      x: Math.cos(angle) * (360 + Math.random() * 620),
      y: Math.sin(angle) * (360 + Math.random() * 620),
      health: 65,
      shield: 20,
      cooldown: 0.5 + Math.random(),
      wander: Math.random() * Math.PI * 2,
    };
  });
}

function randomWorld() {
  return Math.random() * WORLD_SIZE - WORLD_SIZE / 2;
}

function update(delta) {
  if (game.status !== 'playing') return;

  game.time += delta;
  shootCooldown = Math.max(0, shootCooldown - delta);
  game.player.dashCooldown = Math.max(0, game.player.dashCooldown - delta);
  updatePlayer(delta);
  updateZone(delta);
  updateEnemies(delta);
  updateBullets(delta);
  updateLoot();
  updateParticles(delta);
  checkWinState();
}

function updatePlayer(delta) {
  const player = game.player;
  const direction = vectorFromKeys();
  const isSprinting = keys.has('Shift');
  const isCrouching = keys.has('Control');
  const speed = isCrouching ? 135 : isSprinting ? 285 : 205;

  player.x += direction.x * speed * delta;
  player.y += direction.y * speed * delta;

  if (keys.has(' ') && player.dashCooldown === 0) {
    player.x += direction.x * 105;
    player.y += direction.y * 105;
    player.dashCooldown = 1.1;
    burst(player.x, player.y, '#ffcf5a', 10);
  }

  player.x = clamp(player.x, -WORLD_SIZE / 2, WORLD_SIZE / 2);
  player.y = clamp(player.y, -WORLD_SIZE / 2, WORLD_SIZE / 2);
  game.camera.x = player.x - canvas.width / 2;
  game.camera.y = player.y - canvas.height / 2;

  if (distance(player, game.zone) > game.zone.radius) {
    applyDamage(player, ZONE_DAMAGE_PER_SECOND * delta);
    game.message = 'Du bist außerhalb der Zone!';
  }

  if (mouse.down) shootFrom(player, screenToWorld(mouse), 'player');
}

function vectorFromKeys() {
  const vector = { x: 0, y: 0 };
  if (keys.has('w') || keys.has('ArrowUp')) vector.y -= 1;
  if (keys.has('s') || keys.has('ArrowDown')) vector.y += 1;
  if (keys.has('a') || keys.has('ArrowLeft')) vector.x -= 1;
  if (keys.has('d') || keys.has('ArrowRight')) vector.x += 1;
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function updateZone(delta) {
  const zone = game.zone;
  zone.nextShrink -= delta;
  if (zone.nextShrink <= 0) {
    zone.phase += 1;
    zone.targetRadius = Math.max(190, zone.targetRadius - 180);
    zone.x += (Math.random() - 0.5) * 220;
    zone.y += (Math.random() - 0.5) * 220;
    zone.nextShrink = 16;
    game.message = `Zone Phase ${zone.phase}: Kreis schrumpft!`;
  }
  zone.radius += (zone.targetRadius - zone.radius) * Math.min(1, delta * 0.55);
}

function updateEnemies(delta) {
  for (const enemy of game.enemies) {
    enemy.cooldown -= delta;
    const toPlayer = { x: game.player.x - enemy.x, y: game.player.y - enemy.y };
    const playerDistance = Math.hypot(toPlayer.x, toPlayer.y);
    const seesPlayer = playerDistance < 620 && hasLineOfSight(enemy, game.player);

    if (seesPlayer) {
      const moveDirection = normalize(toPlayer);
      const preferredDistance = playerDistance < 260 ? -1 : 1;
      enemy.x += moveDirection.x * preferredDistance * 110 * delta;
      enemy.y += moveDirection.y * preferredDistance * 110 * delta;
      if (enemy.cooldown <= 0) {
        shootFrom(enemy, game.player, 'enemy');
        enemy.cooldown = 0.85 + Math.random() * 0.45;
      }
    } else {
      enemy.wander += (Math.random() - 0.5) * delta * 2;
      enemy.x += Math.cos(enemy.wander) * 70 * delta;
      enemy.y += Math.sin(enemy.wander) * 70 * delta;
    }

    enemy.x = clamp(enemy.x, -WORLD_SIZE / 2, WORLD_SIZE / 2);
    enemy.y = clamp(enemy.y, -WORLD_SIZE / 2, WORLD_SIZE / 2);
    if (distance(enemy, game.zone) > game.zone.radius) applyDamage(enemy, ZONE_DAMAGE_PER_SECOND * delta * 0.8);
  }

  game.enemies = game.enemies.filter((enemy) => enemy.health > 0);
}

function shootFrom(origin, target, owner) {
  if (owner === 'player' && shootCooldown > 0) return;
  if (owner === 'player') shootCooldown = 0.16;
  const direction = normalize({ x: target.x - origin.x, y: target.y - origin.y });
  game.bullets.push({ x: origin.x, y: origin.y, vx: direction.x * 840, vy: direction.y * 840, owner, life: 0.9 });
}

function updateBullets(delta) {
  for (const bullet of game.bullets) {
    bullet.x += bullet.vx * delta;
    bullet.y += bullet.vy * delta;
    bullet.life -= delta;

    const wall = game.walls.find((piece) => Math.abs(piece.x - bullet.x) < WALL_SIZE / 2 && Math.abs(piece.y - bullet.y) < WALL_SIZE / 2);
    if (wall) {
      wall.hp -= BULLET_DAMAGE;
      bullet.life = 0;
      burst(bullet.x, bullet.y, '#cfe5ff', 6);
      continue;
    }

    if (bullet.owner === 'player') {
      const enemy = game.enemies.find((bot) => distance(bot, bullet) < ENEMY_RADIUS + 5);
      if (enemy) {
        applyDamage(enemy, BULLET_DAMAGE);
        bullet.life = 0;
        burst(enemy.x, enemy.y, '#ff5f8f', 8);
        if (enemy.health <= 0) {
          game.player.eliminations += 1;
          game.player.materials += 25;
          game.message = 'Bot eliminiert: +25 Material.';
        }
      }
    } else if (distance(game.player, bullet) < PLAYER_RADIUS + 5) {
      applyDamage(game.player, 15);
      bullet.life = 0;
      burst(game.player.x, game.player.y, '#ffcf5a', 8);
    }
  }

  game.walls = game.walls.filter((piece) => piece.hp > 0);
  game.bullets = game.bullets.filter((bullet) => bullet.life > 0);
}

function updateLoot() {
  game.loot = game.loot.filter((item) => {
    if (distance(item, game.player) > 34) return true;
    if (item.type === 'material') game.player.materials += item.amount;
    if (item.type === 'shield') game.player.shield = clamp(game.player.shield + item.amount, 0, 100);
    if (item.type === 'medkit') game.player.health = clamp(game.player.health + item.amount, 0, 100);
    game.message = `Loot aufgenommen: ${item.type} +${item.amount}`;
    burst(item.x, item.y, lootColors[item.type], 10);
    return false;
  });
}

function updateParticles(delta) {
  for (const particle of game.particles) {
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.life -= delta;
  }
  game.particles = game.particles.filter((particle) => particle.life > 0);
}

function applyDamage(target, amount) {
  const shieldDamage = Math.min(target.shield || 0, amount);
  target.shield = Math.max(0, (target.shield || 0) - shieldDamage);
  target.health -= amount - shieldDamage;
  if (target === game.player && target.health <= 0) {
    game.status = 'lost';
    game.message = 'Eliminiert. Drücke R für einen Neustart.';
  }
}

function placeWall() {
  if (game.status !== 'playing') return;
  if (game.player.materials < WALL_COST) {
    game.message = 'Nicht genug Material für eine Wand.';
    return;
  }
  const aim = screenToWorld(mouse);
  const angle = Math.atan2(aim.y - game.player.y, aim.x - game.player.x);
  const position = {
    x: snap(game.player.x + Math.cos(angle) * 115, WALL_SIZE),
    y: snap(game.player.y + Math.sin(angle) * 115, WALL_SIZE),
  };
  const blocked = game.walls.some((piece) => Math.abs(piece.x - position.x) < WALL_SIZE && Math.abs(piece.y - position.y) < WALL_SIZE);
  if (blocked) {
    game.message = 'Bauplatz blockiert.';
    return;
  }
  game.walls.push({ x: position.x, y: position.y, hp: 150 });
  game.player.materials -= WALL_COST;
  game.message = `Wand platziert (-${WALL_COST} Material).`;
  burst(position.x, position.y, '#32f5c8', 12);
}

function checkWinState() {
  if (game.enemies.length === 0 && game.status === 'playing') {
    game.status = 'won';
    game.message = 'Victory! Alle Bots eliminiert. Drücke R für eine neue Runde.';
  }
}

function draw() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawWorld();
  drawZone();
  drawLoot();
  drawWalls();
  drawBullets();
  drawActors();
  drawParticles();
  drawCrosshair();
  drawOverlay();
  renderStats();
}

function drawWorld() {
  context.save();
  context.translate(-game.camera.x, -game.camera.y);
  context.fillStyle = '#102139';
  context.fillRect(-WORLD_SIZE / 2, -WORLD_SIZE / 2, WORLD_SIZE, WORLD_SIZE);
  context.strokeStyle = 'rgba(207,229,255,0.08)';
  context.lineWidth = 1;
  for (let x = -WORLD_SIZE / 2; x <= WORLD_SIZE / 2; x += WALL_SIZE) {
    line(x, -WORLD_SIZE / 2, x, WORLD_SIZE / 2);
  }
  for (let y = -WORLD_SIZE / 2; y <= WORLD_SIZE / 2; y += WALL_SIZE) {
    line(-WORLD_SIZE / 2, y, WORLD_SIZE / 2, y);
  }
  context.restore();
}

function drawZone() {
  context.save();
  context.translate(-game.camera.x, -game.camera.y);
  context.fillStyle = 'rgba(82, 50, 145, 0.45)';
  context.fillRect(-WORLD_SIZE / 2, -WORLD_SIZE / 2, WORLD_SIZE, WORLD_SIZE);
  context.globalCompositeOperation = 'destination-out';
  context.beginPath();
  context.arc(game.zone.x, game.zone.y, game.zone.radius, 0, Math.PI * 2);
  context.fill();
  context.globalCompositeOperation = 'source-over';
  context.strokeStyle = '#a985ff';
  context.lineWidth = 5;
  context.beginPath();
  context.arc(game.zone.x, game.zone.y, game.zone.radius, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawLoot() {
  for (const item of game.loot) {
    const point = worldToScreen(item);
    context.fillStyle = lootColors[item.type];
    context.beginPath();
    context.roundRect(point.x - 9, point.y - 9, 18, 18, 5);
    context.fill();
  }
}

function drawWalls() {
  for (const wall of game.walls) {
    const point = worldToScreen(wall);
    context.fillStyle = '#7b8798';
    context.fillRect(point.x - WALL_SIZE / 2, point.y - WALL_SIZE / 2, WALL_SIZE, WALL_SIZE);
    context.fillStyle = '#32f5c8';
    context.fillRect(point.x - WALL_SIZE / 2, point.y - WALL_SIZE / 2 - 8, WALL_SIZE * (wall.hp / 150), 5);
  }
}

function drawBullets() {
  for (const bullet of game.bullets) {
    const point = worldToScreen(bullet);
    context.fillStyle = bullet.owner === 'player' ? '#ffcf5a' : '#ff5f8f';
    context.beginPath();
    context.arc(point.x, point.y, 4, 0, Math.PI * 2);
    context.fill();
  }
}

function drawActors() {
  drawActor(game.player, PLAYER_RADIUS, '#32f5c8', screenToWorld(mouse));
  for (const enemy of game.enemies) drawActor(enemy, ENEMY_RADIUS, '#ff5f8f', game.player);
}

function drawActor(actor, radius, color, target) {
  const point = worldToScreen(actor);
  context.fillStyle = color;
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fill();
  const aim = normalize({ x: target.x - actor.x, y: target.y - actor.y });
  context.strokeStyle = '#ffffff';
  context.lineWidth = 4;
  line(point.x, point.y, point.x + aim.x * radius * 1.6, point.y + aim.y * radius * 1.6);
}

function drawParticles() {
  for (const particle of game.particles) {
    const point = worldToScreen(particle);
    context.globalAlpha = Math.max(0, particle.life);
    context.fillStyle = particle.color;
    context.fillRect(point.x - 2, point.y - 2, 4, 4);
    context.globalAlpha = 1;
  }
}

function drawCrosshair() {
  context.strokeStyle = '#ffffff';
  context.lineWidth = 2;
  line(mouse.x - 9, mouse.y, mouse.x + 9, mouse.y);
  line(mouse.x, mouse.y - 9, mouse.x, mouse.y + 9);
}

function drawOverlay() {
  if (game.status === 'playing') return;
  context.fillStyle = 'rgba(7, 16, 30, 0.74)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#ffffff';
  context.font = '800 44px Inter, sans-serif';
  context.textAlign = 'center';
  context.fillText(game.status === 'won' ? 'VICTORY' : 'ELIMINIERT', canvas.width / 2, canvas.height / 2 - 18);
  context.font = '700 18px Inter, sans-serif';
  context.fillText(game.message, canvas.width / 2, canvas.height / 2 + 24);
  context.textAlign = 'left';
}

function renderStats() {
  const player = game.player;
  stats.innerHTML = `
    <div><span>Health</span><strong>${Math.max(0, Math.ceil(player.health))}</strong></div>
    <div><span>Shield</span><strong>${Math.ceil(player.shield)}</strong></div>
    <div><span>Material</span><strong>${player.materials}</strong></div>
    <div><span>Bots übrig</span><strong>${game.enemies.length}</strong></div>
    <div><span>Zone</span><strong>${Math.ceil(game.zone.nextShrink)}s</strong></div>
    <p>${game.message}</p>`;
}

function burst(x, y, color, count) {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    game.particles.push({ x, y, vx: Math.cos(angle) * 120, vy: Math.sin(angle) * 120, color, life: 0.5 + Math.random() * 0.3 });
  }
}

function hasLineOfSight(from, to) {
  return !game.walls.some((wall) => lineIntersectsRect(from, to, wall));
}

function lineIntersectsRect(from, to, rect) {
  const left = rect.x - WALL_SIZE / 2;
  const right = rect.x + WALL_SIZE / 2;
  const top = rect.y - WALL_SIZE / 2;
  const bottom = rect.y + WALL_SIZE / 2;
  return lineIntersectsLine(from, to, { x: left, y: top }, { x: right, y: top })
    || lineIntersectsLine(from, to, { x: right, y: top }, { x: right, y: bottom })
    || lineIntersectsLine(from, to, { x: right, y: bottom }, { x: left, y: bottom })
    || lineIntersectsLine(from, to, { x: left, y: bottom }, { x: left, y: top });
}

function lineIntersectsLine(a, b, c, d) {
  const denominator = ((d.y - c.y) * (b.x - a.x)) - ((d.x - c.x) * (b.y - a.y));
  if (denominator === 0) return false;
  const ua = (((d.x - c.x) * (a.y - c.y)) - ((d.y - c.y) * (a.x - c.x))) / denominator;
  const ub = (((b.x - a.x) * (a.y - c.y)) - ((b.y - a.y) * (a.x - c.x))) / denominator;
  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}

function worldToScreen(point) {
  return { x: point.x - game.camera.x, y: point.y - game.camera.y };
}

function screenToWorld(point) {
  return { x: point.x + game.camera.x, y: point.y + game.camera.y };
}

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function snap(value, size) {
  return Math.round(value / size) * size;
}

function line(x1, y1, x2, y2) {
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
}

function loop(now) {
  const delta = Math.min(0.033, (now - lastFrame) / 1000);
  lastFrame = now;
  update(delta);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (event) => {
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) event.preventDefault();
  keys.add(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  if (event.key.toLowerCase() === 'b') placeWall();
  if (event.key.toLowerCase() === 'r') game = createGame();
});

window.addEventListener('keyup', (event) => keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key));
canvas.addEventListener('mousemove', (event) => {
  const bounds = canvas.getBoundingClientRect();
  mouse.x = (event.clientX - bounds.left) * (canvas.width / bounds.width);
  mouse.y = (event.clientY - bounds.top) * (canvas.height / bounds.height);
});
canvas.addEventListener('mousedown', () => { mouse.down = true; canvas.focus(); });
window.addEventListener('mouseup', () => { mouse.down = false; });
canvas.addEventListener('contextmenu', (event) => event.preventDefault());

if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, width, height, radius) {
    this.beginPath();
    this.moveTo(x + radius, y);
    this.arcTo(x + width, y, x + width, y + height, radius);
    this.arcTo(x + width, y + height, x, y + height, radius);
    this.arcTo(x, y + height, x, y, radius);
    this.arcTo(x, y, x + width, y, radius);
    this.closePath();
    return this;
  };
}

game = createGame();
requestAnimationFrame(loop);
