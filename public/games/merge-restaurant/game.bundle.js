const BOARD_COLUMNS = 7;
const BOARD_ROWS = 7;
const BOARD_CELLS = BOARD_COLUMNS * BOARD_ROWS;
const SERVE_REWARD = 500;

const RECIPE = [
  { id: "flour", name: "밀가루", icon: "🌾", color: "#f2d28a" },
  { id: "noodles", name: "스파게티면", icon: "🍜", color: "#f4e39c" },
  { id: "tomato", name: "토마토", icon: "🍅", color: "#f36c4f" },
  { id: "sauce", name: "토마토소스", icon: "🥫", color: "#bf332c" },
  { id: "spaghetti", name: "스파게티", icon: "🍝", color: "#e7a43b" },
];

const ITEM_BY_ID = Object.fromEntries(RECIPE.map((item) => [item.id, item]));

const CUSTOMER_NAMES = ["민지", "준호", "서아", "도윤", "하린", "유찬"];
const CUSTOMER_WANTS = ["noodles", "tomato", "sauce", "spaghetti"];

function createGameState() {
  return {
    board: Array.from({ length: BOARD_CELLS }, () => null),
    customers: [createCustomer(0), createCustomer(1), createCustomer(2)],
    nextCustomerSerial: 3,
    money: 0,
    selectedIndex: null,
    message: "장바구니를 눌러 밀가루를 꺼내세요.",
  };
}

function createCustomer(serial) {
  return {
    id: `customer-${serial}`,
    name: CUSTOMER_NAMES[serial % CUSTOMER_NAMES.length],
    wants: CUSTOMER_WANTS[serial % CUSTOMER_WANTS.length],
  };
}

function addIngredientFromBasket(state) {
  const index = state.board.findIndex((cell) => cell === null);
  if (index === -1) {
    state.message = "빈 칸이 없습니다.";
    return { ok: false, reason: "board-full" };
  }

  state.board[index] = RECIPE[0].id;
  state.message = "밀가루가 나왔습니다. 같은 재료 위로 드래그하세요.";
  return { ok: true, index, item: RECIPE[0].id };
}

function mergeCells(state, fromIndex, toIndex) {
  if (!isBoardIndex(fromIndex) || !isBoardIndex(toIndex)) {
    return { ok: false, reason: "out-of-range" };
  }
  if (fromIndex === toIndex) {
    state.selectedIndex = toIndex;
    return { ok: false, reason: "same-cell" };
  }

  const fromItem = state.board[fromIndex];
  const toItem = state.board[toIndex];
  if (!fromItem || !toItem) {
    return { ok: false, reason: "empty-cell" };
  }
  if (fromItem !== toItem) {
    state.message = "같은 재료끼리만 합칠 수 있어요.";
    return { ok: false, reason: "different-items" };
  }

  const nextItem = getNextItemId(fromItem);
  if (!nextItem) {
    state.message = "스파게티는 손님에게 줄 수 있어요.";
    return { ok: false, reason: "max-stage" };
  }

  state.board[fromIndex] = null;
  state.board[toIndex] = nextItem;
  state.selectedIndex = toIndex;
  state.message = `${ITEM_BY_ID[nextItem].name} 완성!`;
  return { ok: true, created: nextItem, index: toIndex };
}

function selectCell(state, index) {
  if (!isBoardIndex(index) || state.board[index] === null) {
    state.selectedIndex = null;
    return { ok: false, reason: "empty-cell" };
  }

  state.selectedIndex = index;
  state.message = `${ITEM_BY_ID[state.board[index]].name} 선택됨`;
  return { ok: true, index, item: state.board[index] };
}

function deliverToCustomer(state, customerId) {
  const customerIndex = state.customers.findIndex((customer) => customer.id === customerId);
  if (customerIndex === -1) {
    return { ok: false, reason: "missing-customer" };
  }

  const selectedIndex = state.selectedIndex;
  if (!isBoardIndex(selectedIndex) || state.board[selectedIndex] === null) {
    state.message = "먼저 완성된 음식을 선택하세요.";
    return { ok: false, reason: "nothing-selected" };
  }

  const selectedItem = state.board[selectedIndex];
  const customer = state.customers[customerIndex];
  if (selectedItem !== customer.wants) {
    state.message = `${ITEM_BY_ID[customer.wants].name}을 원하고 있어요.`;
    return { ok: false, reason: "wrong-item" };
  }

  state.board[selectedIndex] = null;
  state.selectedIndex = null;
  state.money += SERVE_REWARD;
  state.customers[customerIndex] = createCustomer(state.nextCustomerSerial);
  state.nextCustomerSerial += 1;
  state.message = `${customer.name}에게 서빙했습니다. +${SERVE_REWARD}원`;

  return { ok: true, paid: SERVE_REWARD };
}

function getNextItemId(itemId) {
  const index = RECIPE.findIndex((item) => item.id === itemId);
  if (index === -1 || index === RECIPE.length - 1) return null;
  return RECIPE[index + 1].id;
}

function describeBoardCell(itemId) {
  if (!itemId) return null;
  return ITEM_BY_ID[itemId] ?? null;
}

function isBoardIndex(index) {
  return Number.isInteger(index) && index >= 0 && index < BOARD_CELLS;
}


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
