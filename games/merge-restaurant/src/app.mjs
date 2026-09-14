import {
  addIngredientFromBasket,
  createGameState,
  deliverToCustomer,
  describeBoardCell,
  mergeCells,
  RECIPE,
  selectCell,
} from "./core.mjs";

const state = createGameState();
const boardEl = document.getElementById("board");
const basketEl = document.getElementById("basket");
const customersEl = document.getElementById("customers");
const messageEl = document.getElementById("message");
const moneyEl = document.getElementById("money");
const recipeEl = document.getElementById("recipe");
const selectedEl = document.getElementById("selected");

let lastChangedIndex = null;
let pointerDrag = null;
let suppressClick = false;

function render() {
  renderCustomers();
  renderBoard();
  renderRecipe();
  renderHud();
}

function renderCustomers() {
  customersEl.innerHTML = state.customers
    .map((customer, index) => {
      const wanted = describeBoardCell(customer.wants);
      const hairColor = ["#47535c", "#7a4931", "#253c36"][index % 3];
      const bodyColor = ["#d94b38", "#2f8f5b", "#e7a43b"][index % 3];
      return `
        <button class="customer" type="button" data-customer-id="${customer.id}" aria-label="${customer.name} 손님 주문 ${wanted.name}">
          <span class="wish" aria-hidden="true">${wanted.icon}</span>
          <span class="avatar" aria-hidden="true" style="--hair:${hairColor}; --body:${bodyColor}">
            <span class="hair" style="background:${hairColor}"></span>
            <span class="face"></span>
            <span class="body" style="background:${bodyColor}"></span>
          </span>
          <span class="customer-name">${customer.name}</span>
        </button>
      `;
    })
    .join("");
}

function renderBoard() {
  boardEl.innerHTML = state.board
    .map((itemId, index) => {
      const item = describeBoardCell(itemId);
      const classes = [
        "cell",
        item ? "filled" : "",
        state.selectedIndex === index ? "selected" : "",
        lastChangedIndex === index ? "pop" : "",
      ]
        .filter(Boolean)
        .join(" ");
      const style = item ? `style="--item-color:${item.color}"` : "";
      const label = item ? `${index + 1}번 칸 ${item.name}` : `${index + 1}번 빈 칸`;
      return `
        <button class="${classes}" ${style} type="button" data-index="${index}" aria-label="${label}">
          ${item ? `<span class="item-icon" aria-hidden="true">${item.icon}</span><span class="item-name">${item.name}</span>` : ""}
        </button>
      `;
    })
    .join("");
  lastChangedIndex = null;
}

function renderRecipe() {
  recipeEl.innerHTML = RECIPE.map((item) => {
    return `<div class="recipe-step"><span aria-hidden="true">${item.icon}</span><span>${item.name}</span></div>`;
  }).join("");
}

function renderHud() {
  moneyEl.value = state.money;
  moneyEl.textContent = `₩${state.money.toLocaleString("ko-KR")}`;
  messageEl.textContent = state.message;

  const selectedItem = describeBoardCell(state.board[state.selectedIndex]);
  selectedEl.classList.toggle("has-selection", Boolean(selectedItem));
  selectedEl.textContent = selectedItem ? `${selectedItem.icon} ${selectedItem.name}` : "선택 없음";
}

function onBasketClick() {
  const result = addIngredientFromBasket(state);
  if (result.ok) lastChangedIndex = result.index;
  render();
}

function onBoardClick(event) {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  const cell = event.target.closest("[data-index]");
  if (!cell) return;

  const index = Number(cell.dataset.index);
  if (
    Number.isInteger(state.selectedIndex) &&
    state.selectedIndex !== index &&
    state.board[state.selectedIndex] &&
    state.board[index]
  ) {
    const result = mergeCells(state, state.selectedIndex, index);
    if (result.ok) {
      lastChangedIndex = result.index;
    } else if (result.reason === "different-items") {
      selectCell(state, index);
      state.message = "같은 재료끼리만 합칠 수 있어요.";
    }
  } else {
    selectCell(state, index);
  }

  render();
}

function onPointerDown(event) {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  const cell = event.target.closest("[data-index]");
  if (!cell) return;

  const index = Number(cell.dataset.index);
  if (!state.board[index]) return;

  pointerDrag = {
    pointerId: event.pointerId,
    fromIndex: index,
    startX: event.clientX,
    startY: event.clientY,
    active: false,
  };
}

function onPointerMove(event) {
  if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;

  const moved = Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY);
  if (moved > 8) {
    pointerDrag.active = true;
    event.preventDefault();
  }
}

function onPointerUp(event) {
  if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;

  const drag = pointerDrag;
  pointerDrag = null;

  if (!drag.active) return;

  suppressClick = true;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-index]");
  if (!target) {
    render();
    return;
  }

  const toIndex = Number(target.dataset.index);
  const result = mergeCells(state, drag.fromIndex, toIndex);
  if (result.ok) lastChangedIndex = result.index;
  render();
}

function onPointerCancel(event) {
  if (pointerDrag?.pointerId === event.pointerId) pointerDrag = null;
}

function onCustomerClick(event) {
  const button = event.target.closest("[data-customer-id]");
  if (!button) return;
  deliverToCustomer(state, button.dataset.customerId);
  render();
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

function renderGameToText() {
  const selectedItem = describeBoardCell(state.board[state.selectedIndex]);
  return JSON.stringify({
    coordinateSystem: "7x7 board, row-major index, origin top-left, x increases right, y increases down",
    money: state.money,
    selectedIndex: state.selectedIndex,
    selectedItem: selectedItem ? selectedItem.id : null,
    board: state.board.map((itemId, index) => {
      const row = Math.floor(index / 7);
      const col = index % 7;
      return { index, row, col, item: itemId };
    }),
    customers: state.customers.map((customer, slot) => ({
      slot,
      id: customer.id,
      name: customer.name,
      wants: customer.wants,
    })),
    message: state.message,
  });
}

basketEl.addEventListener("click", onBasketClick);
boardEl.addEventListener("click", onBoardClick);
boardEl.addEventListener("pointerdown", onPointerDown);
window.addEventListener("pointermove", onPointerMove, { passive: false });
window.addEventListener("pointerup", onPointerUp);
window.addEventListener("pointercancel", onPointerCancel);
customersEl.addEventListener("click", onCustomerClick);
window.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "f") toggleFullscreen();
});

window.advanceTime = () => {
  render();
};
window.render_game_to_text = renderGameToText;
window.__mergeRestaurant = {
  state,
  addIngredientFromBasket: onBasketClick,
  mergeCells: (fromIndex, toIndex) => {
    const result = mergeCells(state, fromIndex, toIndex);
    if (result.ok) lastChangedIndex = result.index;
    render();
    return result;
  },
  render,
};

render();
