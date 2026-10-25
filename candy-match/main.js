
const ROWS = 8;
const COLS = 8;
const TYPES = 5;

const boardEl = document.getElementById("board");
const restartBtn = document.getElementById("restartBtn");
const scoreEl = document.getElementById("score");

const candyEmojis = ["🍓", "🍊", "🍏", "🫐", "🍋"];

let board = [];

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// 检查放置糖果后是否会形成横向或纵向三连
function createsTriple(row, col, type) {
  if (
    col >= 2 &&
    board[row][col - 1] === type &&
    board[row][col - 2] === type
  ) {
    return true;
  }

  if (
    row >= 2 &&
    board[row - 1][col] === type &&
    board[row - 2][col] === type
  ) {
    return true;
  }

  return false;
}

// 逐格生成棋盘，确保初始没有三连
function generateBoard() {
  board = Array.from(
    { length: ROWS },
    () => Array(COLS).fill(null)
  );

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const candidates = shuffle(
        Array.from({ length: TYPES }, (_, i) => i)
      );

      const validType = candidates.find(
        type => !createsTriple(row, col, type)
      );

      board[row][col] = validType;
    }
  }
}

// 将棋盘数据绘制到页面
function renderBoard() {
  boardEl.innerHTML = "";

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.setAttribute(
        "aria-label",
        `第 ${row + 1} 行，第 ${col + 1} 列`
      );

      const candy = document.createElement("div");
      candy.className = `candy candy-${board[row][col]}`;
      candy.textContent = candyEmojis[board[row][col]];

      cell.appendChild(candy);
      boardEl.appendChild(cell);
    }
  }
}

// 检查棋盘是否存在三连，供调试使用
function checkNoTriples() {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const type = board[row][col];

      if (
        col <= COLS - 3 &&
        board[row][col + 1] === type &&
        board[row][col + 2] === type
      ) {
        return false;
      }

      if (
        row <= ROWS - 3 &&
        board[row + 1][col] === type &&
        board[row + 2][col] === type
      ) {
        return false;
      }
    }
  }

  return true;
}

function initGame() {
  generateBoard();
  scoreEl.textContent = "0";
  renderBoard();

  console.log("棋盘已生成：", board);
  console.log(
    "初始棋盘无三连：",
    checkNoTriples()
  );
}

restartBtn.addEventListener("click", initGame);

initGame();
