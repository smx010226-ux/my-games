const TOTAL_LEVELS = 100;
const STORAGE_KEY = 'the-last-cell-v1';
const TUTORIAL_LEVELS = [
  { title: '手把手教学', note: '认识一次点击会改变的范围', cells: [5, 10] },
  { title: '看见连锁', note: '试着提前想一步', cells: [5, 6, 10] },
  { title: '保持观察', note: '同一个位置点击两次会恢复', cells: [1, 6, 9, 10] },
  { title: '逐行解决', note: '从上到下，慢慢整理棋盘', cells: [0, 2, 5, 7, 10, 12] },
  { title: '新手毕业', note: '准备好进入真正的关卡', cells: [0, 3, 5, 6, 9, 10, 12, 15] }
];
const ui = Object.fromEntries([
  'home-screen', 'tutorial-screen', 'select-screen', 'game-screen', 'pause-overlay', 'result-overlay',
  'info-modal', 'settings-modal', 'back-button', 'sound-button', 'info-button', 'settings-button',
  'tutorial-button', 'tutorial-status', 'tutorial-levels', 'level-groups', 'select-eyebrow', 'select-title',
  'game-mode-label', 'level-title', 'moves', 'best', 'board-size', 'level-difficulty', 'board', 'hint-count',
  'tutorial-guide', 'tutorial-step', 'tutorial-tip', 'home-level', 'home-best', 'home-streak', 'restart-button',
  'undo-button', 'hint-button', 'pause-button', 'resume-button', 'pause-restart-button', 'pause-select-button',
  'pause-home-button', 'again-button', 'next-button', 'result-select-button', 'stars', 'result-copy',
  'result-message', 'theme-options', 'key-sound-toggle', 'complete-sound-toggle'
].map((id) => [id, document.getElementById(id)]));

const state = loadState();
let current = null;
let mode = 'campaign';
let puzzle = null;
let audioContext;

function loadState() {
  const defaults = { unlocked: 1, bests: {}, stars: {}, daily: {}, keySound: true, completeSound: true, theme: 'default', streak: 0, tutorialDone: false, tutorialProgress: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...defaults, ...saved, keySound: saved.keySound ?? saved.sound ?? true };
  } catch (error) {
    return defaults;
  }
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function hashSeed(value) { let hash = 2166136261; String(value).split('').forEach((char) => { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }); return hash >>> 0; }
function random(seed) { return () => { seed = Math.imul(1664525, seed) + 1013904223 | 0; return (seed >>> 0) / 4294967296; }; }
function levelInfo(number) {
  if (number <= 10) return { size: 4, scrambles: 3 + number % 3, difficulty: '初见' };
  if (number <= 25) return { size: 4, scrambles: 5 + number % 4, difficulty: '入门' };
  if (number <= 40) return { size: 4, scrambles: 8 + number % 5, difficulty: '思考' };
  if (number <= 60) return { size: 5, scrambles: 8 + number % 7, difficulty: '沉着' };
  if (number <= 80) return { size: 5, scrambles: 12 + number % 7, difficulty: '专注' };
  return { size: 5, scrambles: 18 + number % 8, difficulty: '挑战' };
}
function toggleMask(mask, index, size) {
  const row = Math.floor(index / size), col = index % size;
  [index, row > 0 ? index - size : -1, row < size - 1 ? index + size : -1, col > 0 ? index - 1 : -1, col < size - 1 ? index + 1 : -1].forEach((cell) => { if (cell >= 0) mask ^= 1 << cell; });
  return mask;
}
function maskFrom(size, cells) { return cells.reduce((mask, cell) => toggleMask(mask, cell, size), 0); }
function buildPuzzle(number, seedOverride) {
  const info = levelInfo(number), rng = random(seedOverride ?? hashSeed(`level-${number}`));
  let mask = 0, previous = -1;
  for (let turn = 0; turn < info.scrambles; turn += 1) {
    let cell = Math.floor(rng() * info.size * info.size);
    if (cell === previous) cell = (cell + 1) % (info.size * info.size);
    previous = cell;
    mask = toggleMask(mask, cell, info.size);
  }
  return { ...info, initial: mask, seed: seedOverride ?? hashSeed(`level-${number}`) };
}
function solve(initial, size) {
  const full = (1 << (size * size)) - 1;
  let best = null;
  for (let first = 0; first < (1 << size); first += 1) {
    let board = initial, presses = 0, plan = [];
    const press = (index) => { board = toggleMask(board, index, size); presses += 1; plan.push(index); };
    for (let col = 0; col < size; col += 1) if (first & (1 << col)) press(col);
    for (let row = 1; row < size; row += 1) for (let col = 0; col < size; col += 1) if (board & (1 << ((row - 1) * size + col))) press(row * size + col);
    if ((board & (full ^ ((1 << size) - 1))) === 0 && (board & ((1 << size) - 1)) === 0 && (!best || presses < best.moves)) best = { moves: presses, plan };
  }
  return best;
}
function dailyPuzzle() {
  const date = new Date(), key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  return { ...buildPuzzle(100, hashSeed(`daily-${key}`)), daily: true, date: key };
}
function tutorialPuzzle(number) { return { size: 4, initial: maskFrom(4, TUTORIAL_LEVELS[number].cells), difficulty: '教程', tutorial: true }; }

function showScreen(name) {
  ['home-screen', 'tutorial-screen', 'select-screen', 'game-screen'].forEach((screen) => ui[screen].classList.toggle('is-hidden', screen !== name));
  ui['back-button'].classList.toggle('is-hidden', name === 'home-screen');
}
function home() {
  showScreen('home-screen');
  closeOverlays();
  updateHomeStats();
}
function updateHomeStats() {
  ui['home-level'].textContent = state.unlocked > 1 ? `第 ${Math.min(state.unlocked - 1, TOTAL_LEVELS)} 关` : '还没有记录';
  const values = Object.values(state.bests);
  ui['home-best'].textContent = values.length ? `${Math.min(...values)} 步` : '还没有记录';
  ui['home-streak'].textContent = state.streak ? `${state.streak} 关` : '还没有记录';
  ui['tutorial-status'].textContent = state.tutorialDone ? '已完成' : '5 个练习';
}
function openTutorialMenu() {
  showScreen('tutorial-screen');
  ui['tutorial-levels'].innerHTML = '';
  TUTORIAL_LEVELS.forEach((tutorial, index) => {
    const button = document.createElement('button');
    const completed = state.tutorialProgress > index;
    button.type = 'button';
    button.className = `tutorial-card ${completed ? 'completed' : ''}`;
    button.innerHTML = `<span class="tutorial-number">0${index + 1}</span><span><strong>${tutorial.title}</strong><small>${tutorial.note}</small></span><b>${completed ? '✓' : '→'}</b>`;
    button.addEventListener('click', () => startLevel(index, 'tutorial'));
    ui['tutorial-levels'].appendChild(button);
  });
}
function openSelect(selectMode = 'free') {
  mode = selectMode;
  showScreen('select-screen');
  ui['select-eyebrow'].textContent = selectMode === 'campaign' ? 'CAMPAIGN' : 'FREE CHALLENGE';
  ui['select-title'].textContent = selectMode === 'campaign' ? '继续闯关' : '选择关卡';
  ui['level-groups'].innerHTML = '';
  for (let group = 0; group < 5; group += 1) {
    const start = group * 20 + 1, section = document.createElement('section');
    section.className = 'level-group';
    section.innerHTML = `<h3><span>${start} — ${start + 19}</span><span>${group === 0 ? 'BEGIN' : group === 4 ? 'CHALLENGE' : 'LEVELS'}</span></h3><div class="level-grid"></div>`;
    const grid = section.querySelector('.level-grid');
    for (let number = start; number < start + 20; number += 1) {
      const locked = number > state.unlocked, cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `level-cell ${locked ? 'locked' : ''} ${number === state.unlocked ? 'current' : ''} ${state.stars[number] ? 'done' : ''}`;
      cell.innerHTML = locked ? '<span class="lock-symbol">⌑</span>' : `<span>${number}</span><small>${state.stars[number] ? '★'.repeat(state.stars[number]) : '○'}</small>`;
      cell.disabled = locked;
      cell.addEventListener('click', () => startLevel(number, selectMode));
      grid.appendChild(cell);
    }
    ui['level-groups'].appendChild(section);
  }
}
function startLevel(number, selectedMode = mode) {
  mode = selectedMode;
  current = { number, hints: 0, moves: 0, paused: false, history: [], usedHint: false };
  puzzle = selectedMode === 'daily' ? dailyPuzzle() : selectedMode === 'tutorial' ? tutorialPuzzle(number) : buildPuzzle(number);
  puzzle.solution = solve(puzzle.initial, puzzle.size);
  puzzle.mask = puzzle.initial;
  showScreen('game-screen');
  ui['game-mode-label'].textContent = selectedMode === 'daily' ? 'DAILY CHALLENGE' : selectedMode === 'tutorial' ? `TUTORIAL ${number + 1} / ${TUTORIAL_LEVELS.length}` : selectedMode === 'free' ? 'FREE CHALLENGE' : 'CAMPAIGN';
  ui['level-title'].textContent = selectedMode === 'daily' ? '今日挑战' : selectedMode === 'tutorial' ? TUTORIAL_LEVELS[number].title : `第 ${number} 关`;
  ui['board-size'].textContent = `${puzzle.size} × ${puzzle.size}`;
  ui['level-difficulty'].textContent = selectedMode === 'daily' ? puzzle.date.replaceAll('-', ' / ') : puzzle.difficulty;
  ui.best.textContent = selectedMode === 'daily' ? (state.daily[puzzle.date] || '—') : selectedMode === 'tutorial' ? '练习' : (state.bests[number] || '—');
  ui['hint-count'].textContent = '3 / 3';
  ui['tutorial-guide'].classList.toggle('is-hidden', selectedMode !== 'tutorial');
  closeOverlays();
  renderBoard();
  updateGameHud();
  updateTutorialGuide();
}
function renderBoard() {
  ui.board.style.gridTemplateColumns = `repeat(${puzzle.size}, 1fr)`;
  ui.board.innerHTML = '';
  const guideMove = mode === 'tutorial' && puzzle.mask !== 0 ? solve(puzzle.mask, puzzle.size)?.plan[0] : -1;
  for (let index = 0; index < puzzle.size * puzzle.size; index += 1) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = `cell ${puzzle.mask & (1 << index) ? 'on' : ''}`;
    if (index === guideMove) cell.classList.add('guide-target');
    if (mode === 'tutorial' && guideMove >= 0 && [guideMove, guideMove - puzzle.size, guideMove + puzzle.size, guideMove - 1, guideMove + 1].includes(index)) cell.classList.add('guide-affect');
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', `${index + 1}号格`);
    cell.addEventListener('click', () => pressCell(index));
    ui.board.appendChild(cell);
  }
}
function updateGameHud() {
  ui.moves.textContent = current.moves;
  ui['hint-count'].textContent = `${3 - current.hints} / 3`;
  ui['undo-button'].disabled = current.history.length === 0;
}
function updateTutorialGuide() {
  if (mode !== 'tutorial') return;
  const steps = current.moves === 0 ? ['先看黄色边框', '点击发光的方块。它和周围最多四格会一起改变。'] : current.moves === 1 ? ['观察连锁变化', '刚才的五格同时变化了。记住：同一个位置点两次会恢复。'] : ['继续试试看', '不要只看当前这一步，也想想下一步会怎样。'];
  ui['tutorial-step'].textContent = steps[0];
  ui['tutorial-tip'].textContent = steps[1];
}
function pressCell(index) {
  if (!current || current.paused || puzzle.mask === 0) return;
  current.history.push({ mask: puzzle.mask, moves: current.moves });
  puzzle.mask = toggleMask(puzzle.mask, index, puzzle.size);
  current.moves += 1;
  renderBoard();
  updateGameHud();
  updateTutorialGuide();
  tone(220, .035, 'keySound');
  if (puzzle.mask === 0) finishLevel();
}
function undoMove() {
  const previous = current?.history.pop();
  if (!previous) return;
  puzzle.mask = previous.mask;
  current.moves = previous.moves;
  renderBoard();
  updateGameHud();
  updateTutorialGuide();
}
function starCount(optimal, moves) {
  const three = optimal + Math.max(1, Math.floor(optimal * .15));
  const two = optimal + Math.max(3, Math.floor(optimal * .35));
  const one = optimal + Math.max(6, Math.floor(optimal * .7));
  if (moves <= three) return 3;
  if (moves <= two) return 2;
  if (moves <= one) return 1;
  return 0;
}
function renderStars(count) {
  ui.stars.innerHTML = Array.from({ length: 3 }, (_, index) => `<span class="star ${index < count ? 'earned' : ''}">★</span>`).join('');
  ui.stars.setAttribute('aria-label', `${count} 星`);
}
function finishLevel() {
  ui.board.classList.add('solved');
  setTimeout(() => ui.board.classList.remove('solved'), 800);
  const optimal = puzzle.solution?.moves ?? 0, score = current.moves;
  const stars = current.usedHint ? Math.min(2, starCount(optimal, score)) : starCount(optimal, score);
  if (mode === 'tutorial') {
    state.tutorialProgress = Math.max(state.tutorialProgress, current.number + 1);
    if (current.number === TUTORIAL_LEVELS.length - 1) state.tutorialDone = true;
  } else if (mode === 'daily') {
    state.daily[puzzle.date] = state.daily[puzzle.date] ? Math.min(state.daily[puzzle.date], score) : score;
  } else {
    state.bests[current.number] = state.bests[current.number] ? Math.min(state.bests[current.number], score) : score;
    state.stars[current.number] = Math.max(state.stars[current.number] || 0, stars);
    if (mode === 'campaign' && current.number === state.unlocked) state.unlocked = Math.min(TOTAL_LEVELS + 1, state.unlocked + 1);
  }
  if (stars === 3 && mode === 'campaign') state.streak += 1;
  saveState();
  renderStars(stars);
  ui['result-copy'].textContent = mode === 'tutorial' ? '很好，你已经掌握了这一节。' : `本次步数：${score}　最优步数：${optimal}`;
  ui['result-message'].textContent = stars === 3 ? '三星完成，漂亮。' : stars > 0 ? '稳稳通关，再试试能不能更接近最优解。' : '成功就是最重要的，下一次会更顺手。';
  ui['next-button'].classList.toggle('is-hidden', mode === 'daily' || (mode === 'campaign' && current.number >= TOTAL_LEVELS) || (mode === 'tutorial' && current.number >= TUTORIAL_LEVELS.length - 1));
  ui['next-button'].querySelector('span').textContent = mode === 'tutorial' ? '下一节' : '下一关';
  ui['result-select-button'].querySelector('span').textContent = mode === 'tutorial' ? '返回教程' : '返回关卡目录';
  ui['result-overlay'].classList.remove('is-hidden');
  tone(440, .12, 'completeSound');
  if (stars === 3) setTimeout(() => tone(660, .16, 'completeSound'), 100);
}
function useHint() {
  if (current.hints >= 3 || puzzle.mask === 0) return;
  const suggestion = solve(puzzle.mask, puzzle.size);
  if (!suggestion?.plan.length) return;
  current.hints += 1;
  current.usedHint = true;
  const cell = ui.board.children[suggestion.plan[0]];
  cell?.classList.add('hint');
  setTimeout(() => cell?.classList.remove('hint'), 1600);
  updateGameHud();
}
function togglePause() { current.paused = !current.paused; ui['pause-overlay'].classList.toggle('is-hidden', !current.paused); }
function closeOverlays() { ['pause-overlay', 'result-overlay', 'info-modal', 'settings-modal'].forEach((id) => ui[id].classList.add('is-hidden')); }
function tone(frequency, duration, setting) {
  if (!state[setting]) return;
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
  oscillator.frequency.value = frequency;
  oscillator.type = 'sine';
  gain.gain.setValueAtTime(.025, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}
function applyTheme() { document.body.dataset.theme = state.theme; }
function renderSettings() {
  ui['theme-options'].innerHTML = [['default', '默认'], ['blue', '蓝色'], ['green', '绿色'], ['violet', '紫色']].map(([value, label]) => `<button class="theme-swatch theme-${value} ${state.theme === value ? 'selected' : ''}" data-theme-value="${value}" type="button" aria-label="${label}"><span></span></button>`).join('');
  ui['theme-options'].querySelectorAll('[data-theme-value]').forEach((button) => button.addEventListener('click', () => { state.theme = button.dataset.themeValue; applyTheme(); renderSettings(); saveState(); }));
  [['key-sound-toggle', 'keySound'], ['complete-sound-toggle', 'completeSound']].forEach(([id, key]) => { ui[id].textContent = state[key] ? '开' : '关'; ui[id].classList.toggle('active', state[key]); });
}
function openModal(id) { closeOverlays(); ui[id].classList.remove('is-hidden'); if (id === 'settings-modal') renderSettings(); }

document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => { const selected = button.dataset.mode; selected === 'daily' ? startLevel(0, 'daily') : openSelect(selected); }));
ui['tutorial-button'].addEventListener('click', openTutorialMenu);
ui['back-button'].addEventListener('click', home);
ui['sound-button'].addEventListener('click', () => { state.keySound = !state.keySound; ui['sound-button'].textContent = `声 · ${state.keySound ? '开' : '关'}`; ui['sound-button'].setAttribute('aria-pressed', state.keySound); saveState(); });
ui['info-button'].addEventListener('click', () => openModal('info-modal'));
ui['settings-button'].addEventListener('click', () => openModal('settings-modal'));
document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', closeOverlays));
ui['restart-button'].addEventListener('click', () => startLevel(current.number, mode));
ui['undo-button'].addEventListener('click', undoMove);
ui['hint-button'].addEventListener('click', useHint);
ui['pause-button'].addEventListener('click', togglePause);
ui['resume-button'].addEventListener('click', togglePause);
ui['pause-restart-button'].addEventListener('click', () => startLevel(current.number, mode));
ui['pause-select-button'].addEventListener('click', () => mode === 'tutorial' ? openTutorialMenu() : openSelect(mode));
ui['pause-home-button'].addEventListener('click', home);
ui['again-button'].addEventListener('click', () => startLevel(current.number, mode));
ui['next-button'].addEventListener('click', () => startLevel(current.number + (mode === 'tutorial' ? 1 : 1), mode));
ui['result-select-button'].addEventListener('click', () => mode === 'tutorial' ? openTutorialMenu() : openSelect(mode));
ui['key-sound-toggle'].addEventListener('click', () => { state.keySound = !state.keySound; renderSettings(); saveState(); });
ui['complete-sound-toggle'].addEventListener('click', () => { state.completeSound = !state.completeSound; renderSettings(); saveState(); });
document.querySelector('.wordmark').addEventListener('click', (event) => { event.preventDefault(); home(); });

applyTheme();
ui['sound-button'].textContent = `声 · ${state.keySound ? '开' : '关'}`;
renderSettings();
home();
window.LastCell = { buildPuzzle, solve, toggleMask, levelInfo, tutorialPuzzle, starCount };