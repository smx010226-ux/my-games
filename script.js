const canvas = document.querySelector('#game-canvas');
const context = canvas.getContext('2d');
const startScreen = document.querySelector('#start-screen');
const pauseScreen = document.querySelector('#pause-screen');
const gameOverScreen = document.querySelector('#game-over-screen');
const startButton = document.querySelector('#start-button');
const pauseButton = document.querySelector('#pause-button');
const resumeButton = document.querySelector('#resume-button');
const restartButton = document.querySelector('#restart-button');
const soundButton = document.querySelector('#sound-button');
const scoreElement = document.querySelector('#score');
const livesElement = document.querySelector('#lives');
const finalScoreElement = document.querySelector('#final-score');

const width = canvas.width;
const height = canvas.height;
const player = { x: width / 2, y: height - 76, width: 76, height: 58, targetX: width / 2 };
let coins = [];
let particles = [];
let popups = [];
let score = 0;
let lives = 3;
let state = 'ready';
let lastTime = 0;
let spawnTimer = 0;
let animationFrame;
let controlDirection = 0;
let muted = false;

function resetGame() {
  score = 0;
  lives = 3;
  coins = [];
  particles = [];
  popups = [];
  spawnTimer = 0;
  player.x = width / 2;
  player.targetX = player.x;
  updateHud();
}

function startGame() {
  resetGame();
  state = 'playing';
  startScreen.classList.add('is-hidden');
  gameOverScreen.classList.add('is-hidden');
  pauseScreen.classList.add('is-hidden');
  pauseButton.disabled = false;
  pauseButton.setAttribute('aria-label', '暂停游戏');
  lastTime = performance.now();
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(gameLoop);
}

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    pauseScreen.classList.remove('is-hidden');
    pauseButton.textContent = '▶';
    pauseButton.setAttribute('aria-label', '继续游戏');
  } else if (state === 'paused') {
    state = 'playing';
    pauseScreen.classList.add('is-hidden');
    pauseButton.textContent = 'Ⅱ';
    pauseButton.setAttribute('aria-label', '暂停游戏');
    lastTime = performance.now();
    animationFrame = requestAnimationFrame(gameLoop);
  }
}

function endGame() {
  state = 'over';
  pauseButton.disabled = true;
  finalScoreElement.textContent = score;
  gameOverScreen.classList.remove('is-hidden');
  draw();
}

function updateHud() {
  scoreElement.textContent = String(score).padStart(4, '0');
  livesElement.textContent = `${'♥ '.repeat(lives).trim()}${lives ? '' : '—'}`;
}

function gameLoop(time) {
  if (state !== 'playing') return;
  const delta = Math.min((time - lastTime) / 1000, 0.035);
  lastTime = time;
  update(delta);
  draw();
  animationFrame = requestAnimationFrame(gameLoop);
}

function update(delta) {
  const difficulty = 1 + score / 180;
  const fallSpeed = 135 + difficulty * 24;
  const spawnEvery = Math.max(360, 850 - score * 2.1);
  spawnTimer += delta * 1000;
  if (spawnTimer >= spawnEvery) {
    spawnTimer = 0;
    coins.push({ x: 25 + Math.random() * (width - 50), y: -22, radius: 16, speed: fallSpeed * (.85 + Math.random() * .3), spin: Math.random() * Math.PI });
  }

  const keyboardSpeed = 310 * delta;
  if (controlDirection) player.targetX += controlDirection * keyboardSpeed;
  player.targetX = Math.max(42, Math.min(width - 42, player.targetX));
  player.x += (player.targetX - player.x) * Math.min(1, delta * 12);

  coins.forEach((coin) => {
    coin.y += coin.speed * delta;
    coin.spin += delta * 4;
  });
  for (let index = coins.length - 1; index >= 0; index -= 1) {
    const coin = coins[index];
    const caught = coin.y + coin.radius > player.y - 18 && coin.y - coin.radius < player.y + player.height / 2 && Math.abs(coin.x - player.x) < 45;
    if (caught) {
      score += 10;
      popups.push({ x: coin.x, y: coin.y, life: 1 });
      burst(coin.x, coin.y, '#ffe27a');
      coins.splice(index, 1);
      updateHud();
    } else if (coin.y - coin.radius > height) {
      lives -= 1;
      burst(coin.x, height - 14, '#ff9a82');
      coins.splice(index, 1);
      updateHud();
      if (lives <= 0) endGame();
    }
  }
  particles.forEach((particle) => { particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.vy += 90 * delta; particle.life -= delta * 2.2; });
  particles = particles.filter((particle) => particle.life > 0);
  popups.forEach((popup) => { popup.y -= 26 * delta; popup.life -= delta * 1.5; });
  popups = popups.filter((popup) => popup.life > 0);
}

function burst(x, y, color) {
  for (let index = 0; index < 9; index += 1) {
    const angle = (Math.PI * 2 * index) / 9;
    particles.push({ x, y, vx: Math.cos(angle) * (30 + Math.random() * 60), vy: Math.sin(angle) * (30 + Math.random() * 60), life: 1, color });
  }
}

function draw() {
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#214c8c');
  sky.addColorStop(1, '#122c60');
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);
  drawStars();
  drawClouds();
  coins.forEach(drawCoin);
  particles.forEach((particle) => { context.globalAlpha = particle.life; context.fillStyle = particle.color; context.beginPath(); context.arc(particle.x, particle.y, 3, 0, Math.PI * 2); context.fill(); });
  context.globalAlpha = 1;
  popups.forEach((popup) => { context.globalAlpha = popup.life; context.fillStyle = '#fff0a8'; context.font = '700 20px Georgia'; context.textAlign = 'center'; context.fillText('+10', popup.x, popup.y); });
  context.globalAlpha = 1;
  drawPlayer();
}

function drawStars() {
  context.fillStyle = 'rgba(255,245,194,.7)';
  for (let index = 0; index < 34; index += 1) {
    const x = (index * 83) % width;
    const y = (index * 137) % (height - 100) + 16;
    const size = index % 5 === 0 ? 2 : 1;
    context.fillRect(x, y, size, size);
  }
}

function drawClouds() {
  context.fillStyle = 'rgba(127,164,215,.13)';
  for (let index = 0; index < 3; index += 1) {
    const x = (index * 210 + 30) % width;
    const y = 150 + index * 112;
    context.beginPath();
    context.arc(x, y, 30, Math.PI, 0);
    context.arc(x + 34, y + 5, 22, Math.PI, 0);
    context.fill();
    context.fillRect(x - 30, y, 86, 20);
  }
}

function drawCoin(coin) {
  context.save();
  context.translate(coin.x, coin.y);
  context.scale(Math.abs(Math.cos(coin.spin)) * .55 + .45, 1);
  context.shadowColor = '#ffd75b';
  context.shadowBlur = 15;
  const gradient = context.createRadialGradient(-5, -6, 2, 0, 0, coin.radius);
  gradient.addColorStop(0, '#fff5af');
  gradient.addColorStop(.35, '#ffd75d');
  gradient.addColorStop(1, '#d88b22');
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, coin.radius, 0, Math.PI * 2);
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = '#ffe98a';
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = '#b5761d';
  context.font = '700 17px Georgia';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('$', 0, 1);
  context.restore();
}

function drawPlayer() {
  context.save();
  context.translate(player.x, player.y);
  context.fillStyle = '#f27f6b';
  context.beginPath();
  context.ellipse(0, 23, 43, 11, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#ff9d84';
  context.beginPath();
  context.arc(0, 0, 30, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#f7c9a2';
  context.beginPath();
  context.arc(0, 5, 22, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#48345c';
  context.beginPath();
  context.arc(-8, 4, 2.5, 0, Math.PI * 2);
  context.arc(8, 4, 2.5, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#48345c';
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 8, 8, 0.15, Math.PI - .15);
  context.stroke();
  context.fillStyle = '#ffcf5d';
  context.beginPath();
  context.arc(-18, -20, 13, 0, Math.PI * 2);
  context.arc(18, -20, 13, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function setPointerPosition(event) {
  const bounds = canvas.getBoundingClientRect();
  const pointerX = (event.clientX - bounds.left) * width / bounds.width;
  player.targetX = Math.max(42, Math.min(width - 42, pointerX));
}

canvas.addEventListener('pointerdown', (event) => { if (state === 'playing') { canvas.setPointerCapture(event.pointerId); setPointerPosition(event); } });
canvas.addEventListener('pointermove', (event) => { if (state === 'playing' && event.buttons) setPointerPosition(event); });
canvas.addEventListener('pointerup', (event) => { canvas.releasePointerCapture?.(event.pointerId); });
document.addEventListener('keydown', (event) => { if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') controlDirection = -1; if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') controlDirection = 1; if (event.key === ' ' && state !== 'ready' && state !== 'over') { event.preventDefault(); togglePause(); } });
document.addEventListener('keyup', (event) => { if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(event.key)) controlDirection = 0; });
startButton.addEventListener('click', startGame);
restartButton.addEventListener('click', startGame);
pauseButton.addEventListener('click', togglePause);
resumeButton.addEventListener('click', togglePause);
soundButton.addEventListener('click', () => { muted = !muted; soundButton.textContent = muted ? '×' : '♫'; soundButton.setAttribute('aria-pressed', String(!muted)); });

resetGame();
draw();