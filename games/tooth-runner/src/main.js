import {
  attackTooth,
  buyItem,
  ITEM_DEFS,
  loadStatePayload,
  renderStateToText,
  saveStatePayload,
  startRun,
  updateGame,
} from "./gameCore.js";

const SAVE_KEY = "tooth-runner-save-v1";
const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const moneyLabel = document.querySelector("#moneyLabel");
const statusLabel = document.querySelector("#statusLabel");
const saveExitButton = document.querySelector("#saveExitButton");
const startButton = document.querySelector("#startButton");
const shopButton = document.querySelector("#shopButton");
const shopPanel = document.querySelector("#shopPanel");
const closeShopButton = document.querySelector("#closeShopButton");
const attackButton = document.querySelector("#attackButton");
const buyButtons = [...document.querySelectorAll("[data-buy]")];
const visualLayer = document.querySelector("#visualLayer");
const stageMoney = document.querySelector("#stageMoney");
const fallbackPlayer = document.querySelector("#fallbackPlayer");
const fallbackTooth = document.querySelector("#fallbackTooth");
const fallbackCoins = document.querySelector("#fallbackCoins");

let state = loadStatePayload(localStorage.getItem(SAVE_KEY));
let shopOpen = false;
let lastFrame = performance.now();
let renderFailureReported = false;

const input = {
  up: false,
  down: false,
  left: false,
  right: false,
  pointerActive: false,
  targetX: 0,
  targetY: 0,
};

const LOBBY_COIN_PREVIEW = [
  { id: "lobby-coin-left", x: 190, y: 430, r: 34, value: 50 },
  { id: "lobby-coin-center", x: 480, y: 430, r: 34, value: 50 },
  { id: "lobby-coin-right", x: 770, y: 430, r: 34, value: 50 },
];

const LOBBY_PLAYER_PREVIEW = { x: 350, y: 360 };
const LOBBY_TOOTH_PREVIEW = { x: 610, y: 360 };

function persistState() {
  localStorage.setItem(SAVE_KEY, saveStatePayload(state));
}

function setStatus(message) {
  statusLabel.textContent = message;
}

function updateUi() {
  moneyLabel.textContent = `${state.money.toLocaleString("ko-KR")}원`;
  shopPanel.hidden = !shopOpen;
  attackButton.disabled = state.mode !== "playing" || !state.hammer.carried;

  for (const button of buyButtons) {
    const item = ITEM_DEFS[button.dataset.buy];
    const owned = state.inventory[item.inventoryKey];
    button.disabled = owned || state.money < item.cost;
    button.querySelector(".shop-item-status").textContent = owned ? "보유중" : `${item.cost.toLocaleString("ko-KR")}원`;
  }

  if (state.mode === "playing") {
    setStatus(`${Math.max(0, Math.ceil(state.run.duration - state.run.elapsed))}초`);
  } else if (state.lastResult === "survived") {
    setStatus("생존 성공 +100원");
  } else if (state.lastResult === "eaten") {
    setStatus("먹혔습니다");
  } else if (state.lastResult === "saved-exit") {
    setStatus("저장됨");
  } else if (state.lastShopMessage === "not-enough-money") {
    setStatus("돈이 부족합니다");
  } else if (state.lastShopMessage?.startsWith("bought-")) {
    setStatus("구매 완료");
  } else {
    setStatus("로비");
  }
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function drawRoundedRect(x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, r);
  } else {
    const radius = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }
  ctx.fill();
}

function drawEllipse(x, y, rx, ry) {
  if (typeof ctx.ellipse === "function") {
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    return;
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.restore();
}

function setOverlayPosition(element, x, y) {
  if (!element) return;
  element.style.setProperty("--x", `${(x / state.arena.width) * 100}`);
  element.style.setProperty("--y", `${(y / state.arena.height) * 100}`);
}

function renderOverlayCoin(coin) {
  return `<div class="fallback-coin" style="--x: ${(coin.x / state.arena.width) * 100}; --y: ${(coin.y / state.arena.height) * 100}"><span>${coin.value}</span></div>`;
}

function updateVisualLayer() {
  if (!visualLayer) return;
  visualLayer.hidden = false;
  if (stageMoney) stageMoney.textContent = `${state.money.toLocaleString("ko-KR")}원`;

  if (state.mode === "playing") {
    setOverlayPosition(fallbackPlayer, state.player.x, state.player.y);
    setOverlayPosition(fallbackTooth, state.tooth.x, state.tooth.y);
    if (fallbackTooth) fallbackTooth.hidden = !state.tooth.alive;
    if (fallbackCoins) fallbackCoins.innerHTML = state.coins.map(renderOverlayCoin).join("");
  } else {
    setOverlayPosition(fallbackPlayer, LOBBY_PLAYER_PREVIEW.x, LOBBY_PLAYER_PREVIEW.y);
    setOverlayPosition(fallbackTooth, LOBBY_TOOTH_PREVIEW.x, LOBBY_TOOTH_PREVIEW.y);
    if (fallbackTooth) fallbackTooth.hidden = false;
    if (fallbackCoins) fallbackCoins.innerHTML = LOBBY_COIN_PREVIEW.map(renderOverlayCoin).join("");
  }
}

function drawPlayer(player = state.player, options = {}) {
  const hammerCarried = options.hammerCarried ?? state.hammer.carried;
  ctx.save();
  ctx.translate(player.x, player.y);
  if (state.inventory.invincible) {
    ctx.strokeStyle = "rgba(48, 213, 200, 0.72)";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, player.r + 10, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "#2c72ff";
  ctx.beginPath();
  ctx.arc(0, 0, player.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-6, -5, 4, 0, Math.PI * 2);
  ctx.arc(7, -5, 4, 0, Math.PI * 2);
  ctx.fill();
  if (hammerCarried) drawHammerShape(18, -24, 0.85);
  ctx.restore();
}

function drawTooth(tooth = state.tooth) {
  if (!tooth.alive) return;
  ctx.save();
  ctx.translate(tooth.x, tooth.y);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#212735";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-26, -20);
  ctx.quadraticCurveTo(-30, -44, 0, -43);
  ctx.quadraticCurveTo(30, -44, 26, -20);
  ctx.lineTo(17, 28);
  ctx.quadraticCurveTo(9, 45, 0, 24);
  ctx.quadraticCurveTo(-9, 45, -17, 28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#ff4b54";
  ctx.beginPath();
  ctx.arc(0, -12, 10, 0, Math.PI);
  ctx.fill();
  ctx.fillStyle = "#212735";
  ctx.beginPath();
  ctx.arc(-9, -24, 3, 0, Math.PI * 2);
  ctx.arc(9, -24, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHammerShape(x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.4);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#6f4f2f";
  drawRoundedRect(-4, -1, 8, 34, 4);
  ctx.fillStyle = "#e0e7ef";
  drawRoundedRect(-18, -10, 36, 14, 5);
  ctx.fillStyle = "#9aa5b1";
  drawRoundedRect(12, -8, 10, 10, 3);
  ctx.restore();
}

function drawHammerPickup() {
  if (!state.hammer.visible || state.hammer.carried) return;
  drawHammerShape(state.hammer.x, state.hammer.y - 18, 1.25);
  ctx.fillStyle = "#212735";
  ctx.font = "700 16px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("망치", state.hammer.x, state.hammer.y + 24);
}

function drawCoin(coin) {
  ctx.save();
  ctx.translate(coin.x, coin.y);
  const pulse = state.mode === "playing" ? 1 + Math.sin(state.run.elapsed * 7) * 0.08 : 1;
  ctx.scale(pulse, pulse);

  ctx.fillStyle = "rgba(23, 32, 51, 0.18)";
  ctx.beginPath();
  drawEllipse(0, coin.r + 6, coin.r + 10, 8);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, coin.r + 9, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 210, 55, 0.62)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(0, 0, coin.r + 17, 0, Math.PI * 2);
  ctx.stroke();

  const shine = ctx.createRadialGradient(-8, -10, 3, 0, 0, coin.r + 8);
  shine.addColorStop(0, "#fff7a8");
  shine.addColorStop(0.45, "#ffd84d");
  shine.addColorStop(1, "#e9a900");
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.arc(0, 0, coin.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8a5d00";
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 247, 168, 0.9)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, coin.r - 7, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#8a5d00";
  ctx.font = `900 ${Math.max(18, Math.round(coin.r * 0.78))}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("50", 0, 1);
  ctx.restore();
}

function drawCoins() {
  for (const coin of state.coins) {
    try {
      drawCoin(coin);
    } catch (error) {
      if (!renderFailureReported) {
        console.error("Coin render failed", error);
        renderFailureReported = true;
      }
    }
  }
}

function drawPlaying() {
  const remaining = Math.max(0, state.run.duration - state.run.elapsed);
  const progress = remaining / state.run.duration;

  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#bdefff");
  sky.addColorStop(1, "#f8f2d8");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.42)";
  for (let x = 0; x < canvas.width; x += 64) {
    ctx.fillRect(x, 0, 2, canvas.height);
  }
  for (let y = 0; y < canvas.height; y += 64) {
    ctx.fillRect(0, y, canvas.width, 2);
  }

  ctx.fillStyle = "#132236";
  ctx.globalAlpha = 0.14;
  ctx.beginPath();
  drawEllipse(480, 595, 430, 42);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#ffffff";
  drawRoundedRect(28, 26, 904, 18, 9);
  ctx.fillStyle = progress > 0.25 ? "#2fc58d" : "#ff4b54";
  drawRoundedRect(28, 26, 904 * progress, 18, 9);

  drawHammerPickup();
}

function drawLobby() {
  const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  bg.addColorStop(0, "#e5fbff");
  bg.addColorStop(0.52, "#fff3c7");
  bg.addColorStop(1, "#ffd6dd");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.arc(168, 128, 86, 0, Math.PI * 2);
  ctx.arc(792, 478, 126, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#172033";
  ctx.textAlign = "center";
  ctx.font = "900 64px system-ui, sans-serif";
  ctx.fillText("이빨 피하기", 480, 178);
  ctx.font = "700 28px system-ui, sans-serif";
  ctx.fillText("60초 버티면 100원", 480, 226);
  ctx.font = "800 22px system-ui, sans-serif";
  ctx.fillText("중간에 떨어지는 코인은 50원", 480, 262);

  ctx.font = "700 22px system-ui, sans-serif";
  ctx.fillStyle = "#172033";
  ctx.fillText("상점에서 무적과 망치를 살 수 있습니다", 480, 520);
}

function render() {
  try {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (state.mode === "playing") drawPlaying();
    else drawLobby();
  } catch (error) {
    if (!renderFailureReported) {
      console.error("Canvas render failed; DOM fallback remains visible", error);
      renderFailureReported = true;
    }
  } finally {
    updateVisualLayer();
  }
}

function tick(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  state = updateGame(state, dt, input);
  updateUi();
  render();
  requestAnimationFrame(tick);
}

startButton.addEventListener("click", () => {
  state = startRun(state);
  shopOpen = false;
  updateUi();
  render();
});

saveExitButton.addEventListener("click", () => {
  if (state.mode === "playing") {
    state = {
      ...state,
      mode: "lobby",
      lastResult: "saved-exit",
      hammer: { ...state.hammer, visible: false, carried: false },
      coins: [],
    };
  } else {
    state = { ...state, lastResult: "saved-exit" };
  }
  persistState();
  updateUi();
  render();
});

shopButton.addEventListener("click", () => {
  shopOpen = !shopOpen;
  updateUi();
});

closeShopButton.addEventListener("click", () => {
  shopOpen = false;
  updateUi();
});

attackButton.addEventListener("click", () => {
  state = attackTooth(state);
  updateUi();
  render();
});

buyButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state = buyItem(state, button.dataset.buy);
    persistState();
    updateUi();
    render();
  });
});

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") input.up = true;
  if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") input.down = true;
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") input.left = true;
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") input.right = true;
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    state = attackTooth(state);
  }
  if (event.key.toLowerCase() === "f" && document.fullscreenEnabled) {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") input.up = false;
  if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") input.down = false;
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") input.left = false;
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") input.right = false;
});

canvas.addEventListener("pointerdown", (event) => {
  canvas.setPointerCapture(event.pointerId);
  const point = canvasPoint(event);
  input.pointerActive = true;
  input.targetX = point.x;
  input.targetY = point.y;
});

canvas.addEventListener("pointermove", (event) => {
  if (!input.pointerActive) return;
  const point = canvasPoint(event);
  input.targetX = point.x;
  input.targetY = point.y;
});

canvas.addEventListener("pointerup", (event) => {
  canvas.releasePointerCapture(event.pointerId);
  input.pointerActive = false;
});

window.render_game_to_text = () => renderStateToText(state);
window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) {
    state = updateGame(state, 1 / 60, input);
  }
  updateUi();
  render();
};

updateUi();
render();
requestAnimationFrame(tick);
