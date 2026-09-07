const imageInput = document.querySelector('#image-input');
const restartButton = document.querySelector('#restart-button');
const puzzleBoard = document.querySelector('#puzzle-board');
const statusMessage = document.querySelector('#status-message');

const tileCount = 9;
let imageUrl = '';
let tileOrder = [];
let draggedIndex = null;

imageInput.addEventListener('change', handleImageSelection);
restartButton.addEventListener('click', startNewGame);

function handleImageSelection(event) {
  const [file] = event.target.files;

  if (!file || !file.type.startsWith('image/')) {
    return;
  }

  if (imageUrl) {
    URL.revokeObjectURL(imageUrl);
  }

  imageUrl = URL.createObjectURL(file);
  startNewGame();
}

function startNewGame() {
  if (!imageUrl) {
    return;
  }

  tileOrder = createShuffledOrder();
  puzzleBoard.classList.remove('is-empty', 'is-solved');
  restartButton.disabled = false;
  statusMessage.classList.remove('is-success');
  statusMessage.textContent = '拖动拼图块，挑战把图片还原吧';
  renderBoard();
}

function createShuffledOrder() {
  const order = Array.from({ length: tileCount }, (_, index) => index);

  do {
    for (let index = order.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [order[index], order[randomIndex]] = [order[randomIndex], order[index]];
    }
  } while (order.every((tile, index) => tile === index));

  return order;
}

function renderBoard() {
  puzzleBoard.replaceChildren();

  tileOrder.forEach((tileNumber, position) => {
    const tile = document.createElement('button');
    const sourceRow = Math.floor(tileNumber / 3);
    const sourceColumn = tileNumber % 3;

    tile.className = 'puzzle-tile';
    tile.type = 'button';
    tile.setAttribute('aria-label', `第 ${tileNumber + 1} 块拼图，当前位置第 ${position + 1} 格`);
    tile.style.backgroundImage = `url("${imageUrl}")`;
    tile.style.backgroundPosition = `${sourceColumn * 50}% ${sourceRow * 50}%`;
    tile.dataset.position = position;
    tile.addEventListener('pointerdown', handlePointerDown);
    tile.addEventListener('pointerup', handlePointerUp);
    tile.addEventListener('pointercancel', clearDragState);
    puzzleBoard.append(tile);
  });
}

function handlePointerDown(event) {
  if (puzzleBoard.classList.contains('is-solved')) {
    return;
  }

  draggedIndex = Number(event.currentTarget.dataset.position);
  event.currentTarget.classList.add('is-dragging');
}

function handlePointerUp(event) {
  if (draggedIndex === null) {
    return;
  }

  const targetIndex = Number(event.currentTarget.dataset.position);
  const draggedTile = puzzleBoard.children[draggedIndex];

  if (draggedIndex !== targetIndex) {
    [tileOrder[draggedIndex], tileOrder[targetIndex]] = [tileOrder[targetIndex], tileOrder[draggedIndex]];
    renderBoard();
    checkForWin();
  } else {
    draggedTile.classList.remove('is-dragging');
  }

  draggedIndex = null;
}

function clearDragState() {
  draggedIndex = null;
  puzzleBoard.querySelector('.is-dragging')?.classList.remove('is-dragging');
}

function checkForWin() {
  const isSolved = tileOrder.every((tile, index) => tile === index);

  if (!isSolved) {
    return;
  }

  puzzleBoard.classList.add('is-solved');
  statusMessage.classList.add('is-success');
  statusMessage.textContent = '恭喜完成！这张图片已经还原啦';
}