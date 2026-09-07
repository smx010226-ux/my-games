const canvas = document.querySelector('#game-canvas');
const stage = document.querySelector('#game-stage');
const context = canvas.getContext('2d');
const scoreElement = document.querySelector('#score');
const livesElement = document.querySelector('#lives');
const bestScoreElement = document.querySelector('#best-score');
const startScreen = document.querySelector('#start-screen');
const gameOverScreen = document.querySelector('#game-over-screen');
const startButton = document.querySelector('#start-button');
const restartButton = document.querySelector('#restart-button');
const finalScoreElement = document.querySelector('#final-score');
const newRecordElement = document.querySelector('#new-record');

const bestScoreKey = 'asteroid-best-score';
const game = {
  width: 0, height: 0, lastTime: 0, elapsed: 0, score: 0, lives: 3,
  running: false, invincibleUntil: 0, spawnTimer: 0, powerTimer: 0,
  player: { x: 0, y: 0, targetX: 0, targetY: 0, radius: 19, hitUntil: 0 },
  meteors: [], powers: [], particles: [], stars: [], pointerActive: false
};

let animationFrame = 0;
let bestScore = Number(localStorage.getItem(bestScoreKey)) || 0;
bestScoreElement.textContent = bestScore;

startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);
window.addEventListener('resize', resizeCanvas);
canvas.addEventListener('mousedown', handlePointerStart);
canvas.addEventListener('mousemove', handlePointerMove);
window.addEventListener('mouseup', handlePointerEnd);
canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

resizeCanvas();
drawScene(0);

function resizeCanvas() {
  const bounds = stage.getBoundingClientRect();
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  game.width = bounds.width;
  game.height = bounds.height;
  canvas.width = Math.floor(game.width * pixelRatio);
  canvas.height = Math.floor(game.height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  if (!game.running) {
    game.player.x = game.width / 2;
    game.player.y = game.height * 0.8;
    game.player.targetX = game.player.x;
    game.player.targetY = game.player.y;
  }
  createStars();
}

function createStars() {
  game.stars = Array.from({ length: Math.max(55, Math.floor(game.width * game.height / 7500)) }, () => ({
    x: Math.random() * game.width, y: Math.random() * game.height,
    size: Math.random() * 1.6 + 0.35, alpha: Math.random() * 0.7 + 0.2,
    drift: Math.random() * 0.35 + 0.08
  }));
}

function startGame() {
  game.elapsed = 0; game.score = 0; game.lives = 3; game.invincibleUntil = 0;
  game.spawnTimer = 0; game.powerTimer = 5; game.meteors = []; game.powers = []; game.particles = [];
  game.running = true; game.lastTime = performance.now();
  game.player.x = game.width / 2; game.player.y = game.height * 0.8;
  game.player.targetX = game.player.x; game.player.targetY = game.player.y; game.player.hitUntil = 0;
  scoreElement.textContent = '0'; updateLives();
  startScreen.classList.add('is-hidden'); gameOverScreen.classList.add('is-hidden');
  cancelAnimationFrame(animationFrame); animationFrame = requestAnimationFrame(gameLoop);
}

function gameLoop(now) {
  const delta = Math.min((now - game.lastTime) / 1000, 0.04);
  game.lastTime = now; game.elapsed += delta;
  updateGame(delta, now); drawScene(now);
  if (game.running) animationFrame = requestAnimationFrame(gameLoop);
}

function updateGame(delta, now) {
  const difficulty = 1 + game.elapsed / 42;
  const player = game.player;
  player.x += (player.targetX - player.x) * Math.min(1, delta * 12);
  player.y += (player.targetY - player.y) * Math.min(1, delta * 12);
  game.score += delta * 10;
  scoreElement.textContent = Math.floor(game.score);
  game.spawnTimer -= delta;
  if (game.spawnTimer <= 0) { spawnMeteor(difficulty); game.spawnTimer = Math.max(0.22, 0.78 - game.elapsed * 0.006); }
  game.powerTimer -= delta;
  if (game.powerTimer <= 0) { spawnPower(); game.powerTimer = 9 + Math.random() * 8; }
  updateMeteors(delta, difficulty, now); updatePowers(delta, now); updateParticles(delta);
}

function spawnMeteor(difficulty) {
  const radius = 9 + Math.random() * 16;
  game.meteors.push({ x: radius + Math.random() * (game.width - radius * 2), y: -radius - 4, radius,
    speed: (90 + Math.random() * 95) * difficulty, drift: (Math.random() - 0.5) * 22, angle: Math.random() * 6.28, spin: (Math.random() - 0.5) * 2.5,
    color: Math.random() > 0.45 ? '#f5a078' : '#ffcf83' });
}

function spawnPower() {
  game.powers.push({ x: 28 + Math.random() * (game.width - 56), y: -20, radius: 11, speed: 78 + Math.random() * 25, pulse: Math.random() * 6.28 });
}

function updateMeteors(delta, difficulty, now) {
  const player = game.player;
  for (let index = game.meteors.length - 1; index >= 0; index -= 1) {
    const meteor = game.meteors[index]; meteor.y += meteor.speed * delta; meteor.x += meteor.drift * delta; meteor.angle += meteor.spin * delta;
    if (meteor.y - meteor.radius > game.height) { game.meteors.splice(index, 1); continue; }
    if (distance(meteor, player) < meteor.radius + player.radius * 0.7 && now > player.hitUntil) {
      game.meteors.splice(index, 1); createExplosion(meteor.x, meteor.y, meteor.color);
      if (now < game.invincibleUntil) continue;
      game.lives -= 1; player.hitUntil = now + 900; updateLives();
      if (game.lives <= 0) endGame();
    }
  }
}

function updatePowers(delta, now) {
  for (let index = game.powers.length - 1; index >= 0; index -= 1) {
    const power = game.powers[index]; power.y += power.speed * delta; power.pulse += delta * 5;
    if (power.y - power.radius > game.height) { game.powers.splice(index, 1); continue; }
    if (distance(power, game.player) < power.radius + game.player.radius) {
      game.invincibleUntil = now + 5000; game.powers.splice(index, 1); createExplosion(power.x, power.y, '#66efff');
    }
  }
}

function updateParticles(delta) {
  for (let index = game.particles.length - 1; index >= 0; index -= 1) {
    const particle = game.particles[index]; particle.life -= delta; particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.vy += 20 * delta;
    if (particle.life <= 0) game.particles.splice(index, 1);
  }
}

function drawScene(now) {
  context.clearRect(0, 0, game.width, game.height);
  drawBackground(now); game.meteors.forEach(drawMeteor); game.powers.forEach(power => drawPower(power, now)); game.particles.forEach(drawParticle); drawShip(now);
}

function drawBackground(now) {
  const glow = context.createRadialGradient(game.width * 0.5, game.height * 0.35, 0, game.width * 0.5, game.height * 0.35, game.width * 0.8);
  glow.addColorStop(0, 'rgba(35, 42, 118, 0.23)'); glow.addColorStop(1, 'rgba(6, 8, 25, 0)'); context.fillStyle = glow; context.fillRect(0, 0, game.width, game.height);
  game.stars.forEach(star => { const y = (star.y + now * 0.006 * star.drift) % game.height; context.globalAlpha = star.alpha * (0.8 + Math.sin(now * 0.002 + star.x) * 0.2); context.fillStyle = '#c8d7ff'; context.fillRect(star.x, y, star.size, star.size); }); context.globalAlpha = 1;
}

function drawMeteor(meteor) {
  context.save(); context.translate(meteor.x, meteor.y); context.rotate(meteor.angle); context.globalAlpha = 0.22; context.strokeStyle = meteor.color; context.lineWidth = meteor.radius * 0.75; context.lineCap = 'round'; context.beginPath(); context.moveTo(0, -meteor.radius * 1.2); context.lineTo(0, -meteor.radius * 5); context.stroke(); context.globalAlpha = 1; context.fillStyle = meteor.color; context.shadowColor = meteor.color; context.shadowBlur = 14; context.beginPath(); context.arc(0, 0, meteor.radius, 0, Math.PI * 2); context.fill(); context.shadowBlur = 0; context.fillStyle = 'rgba(110, 39, 65, 0.45)'; context.beginPath(); context.arc(-meteor.radius * 0.3, -meteor.radius * 0.2, meteor.radius * 0.24, 0, Math.PI * 2); context.fill(); context.restore();
}

function drawPower(power, now) {
  const scale = 1 + Math.sin(power.pulse + now * 0.001) * 0.1; context.save(); context.translate(power.x, power.y); context.scale(scale, scale); context.shadowColor = '#66efff'; context.shadowBlur = 20; context.strokeStyle = '#a7f8ff'; context.lineWidth = 2; context.beginPath(); context.arc(0, 0, power.radius, 0, Math.PI * 2); context.stroke(); context.fillStyle = '#66efff'; context.beginPath(); context.moveTo(2, -7); context.lineTo(-4, 0); context.lineTo(1, 0); context.lineTo(-2, 8); context.lineTo(6, -2); context.lineTo(1, -2); context.closePath(); context.fill(); context.restore();
}

function drawShip(now) {
  const { x, y, radius } = game.player; const shielded = now < game.invincibleUntil; const hit = now < game.player.hitUntil;
  context.save(); context.translate(x, y); if (hit && Math.floor(now / 80) % 2 === 0) context.globalAlpha = 0.35;
  context.shadowColor = shielded ? '#66efff' : '#ff719d'; context.shadowBlur = shielded ? 28 : 16;
  context.fillStyle = '#ff9e6d'; context.beginPath(); context.moveTo(-radius * 0.35, radius * 0.48); context.lineTo(0, radius * 1.25 + Math.random() * 5); context.lineTo(radius * 0.35, radius * 0.48); context.fill();
  context.shadowBlur = 0; context.fillStyle = '#dfeaff'; context.beginPath(); context.moveTo(0, -radius * 1.15); context.lineTo(radius * 0.85, radius * 0.8); context.lineTo(0, radius * 0.48); context.lineTo(-radius * 0.85, radius * 0.8); context.closePath(); context.fill(); context.fillStyle = '#6c8ee9'; context.beginPath(); context.arc(0, -radius * 0.26, radius * 0.3, Math.PI, 0); context.fill();
  context.fillStyle = '#8aaaff'; context.beginPath(); context.moveTo(-radius * 0.85, radius * 0.8); context.lineTo(-radius * 1.2, radius * 1.05); context.lineTo(-radius * 0.25, radius * 0.48); context.fill(); context.beginPath(); context.moveTo(radius * 0.85, radius * 0.8); context.lineTo(radius * 1.2, radius * 1.05); context.lineTo(radius * 0.25, radius * 0.48); context.fill();
  if (shielded) { context.strokeStyle = 'rgba(102, 239, 255, 0.9)'; context.lineWidth = 2; context.shadowColor = '#66efff'; context.shadowBlur = 15; context.beginPath(); context.arc(0, 0, radius * 1.6, 0, Math.PI * 2); context.stroke(); } context.restore();
}

function drawParticle(particle) { context.globalAlpha = Math.max(0, particle.life / particle.maxLife); context.fillStyle = particle.color; context.beginPath(); context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); context.fill(); context.globalAlpha = 1; }
function createExplosion(x, y, color) { for (let index = 0; index < 18; index += 1) { const angle = Math.random() * Math.PI * 2; const speed = 35 + Math.random() * 100; game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, size: 1.5 + Math.random() * 3, life: 0.35 + Math.random() * 0.5, maxLife: 0.85, color }); } }
function distance(first, second) { return Math.hypot(first.x - second.x, first.y - second.y); }
function updateLives() { livesElement.textContent = '❤'.repeat(game.lives) + '♡'.repeat(3 - game.lives); }

function endGame() {
  game.running = false; finalScoreElement.textContent = Math.floor(game.score); const isRecord = game.score > bestScore;
  if (isRecord) { bestScore = Math.floor(game.score); localStorage.setItem(bestScoreKey, bestScore); bestScoreElement.textContent = bestScore; }
  newRecordElement.classList.toggle('is-hidden', !isRecord); gameOverScreen.classList.remove('is-hidden');
}

function setPlayerTarget(clientX, clientY) {
  const bounds = canvas.getBoundingClientRect(); const padding = game.player.radius + 5;
  game.player.targetX = Math.max(padding, Math.min(game.width - padding, clientX - bounds.left));
  game.player.targetY = Math.max(game.height * 0.45, Math.min(game.height - padding, clientY - bounds.top));
}
function handlePointerStart(event) { game.pointerActive = true; setPlayerTarget(event.clientX, event.clientY); }
function handlePointerMove(event) { if (game.pointerActive) setPlayerTarget(event.clientX, event.clientY); }
function handlePointerEnd() { game.pointerActive = false; }
function handleTouchStart(event) { event.preventDefault(); game.pointerActive = true; const touch = event.touches[0]; setPlayerTarget(touch.clientX, touch.clientY); }
function handleTouchMove(event) { event.preventDefault(); if (game.pointerActive) { const touch = event.touches[0]; setPlayerTarget(touch.clientX, touch.clientY); } }
function handleTouchEnd(event) { event.preventDefault(); game.pointerActive = false; }