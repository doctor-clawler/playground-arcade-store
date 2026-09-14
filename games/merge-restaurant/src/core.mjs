export const BOARD_COLUMNS = 7;
export const BOARD_ROWS = 7;
export const BOARD_CELLS = BOARD_COLUMNS * BOARD_ROWS;
export const SERVE_REWARD = 500;

export const RECIPE = [
  { id: "flour", name: "밀가루", icon: "🌾", color: "#f2d28a" },
  { id: "noodles", name: "스파게티면", icon: "🍜", color: "#f4e39c" },
  { id: "tomato", name: "토마토", icon: "🍅", color: "#f36c4f" },
  { id: "sauce", name: "토마토소스", icon: "🥫", color: "#bf332c" },
  { id: "spaghetti", name: "스파게티", icon: "🍝", color: "#e7a43b" },
];

export const ITEM_BY_ID = Object.fromEntries(RECIPE.map((item) => [item.id, item]));

const CUSTOMER_NAMES = ["민지", "준호", "서아", "도윤", "하린", "유찬"];
const CUSTOMER_WANTS = ["noodles", "tomato", "sauce", "spaghetti"];

export function createGameState() {
  return {
    board: Array.from({ length: BOARD_CELLS }, () => null),
    customers: [createCustomer(0), createCustomer(1), createCustomer(2)],
    nextCustomerSerial: 3,
    money: 0,
    selectedIndex: null,
    message: "장바구니를 눌러 밀가루를 꺼내세요.",
  };
}

export function createCustomer(serial) {
  return {
    id: `customer-${serial}`,
    name: CUSTOMER_NAMES[serial % CUSTOMER_NAMES.length],
    wants: CUSTOMER_WANTS[serial % CUSTOMER_WANTS.length],
  };
}

export function addIngredientFromBasket(state) {
  const index = state.board.findIndex((cell) => cell === null);
  if (index === -1) {
    state.message = "빈 칸이 없습니다.";
    return { ok: false, reason: "board-full" };
  }

  state.board[index] = RECIPE[0].id;
  state.message = "밀가루가 나왔습니다. 같은 재료 위로 드래그하세요.";
  return { ok: true, index, item: RECIPE[0].id };
}

export function mergeCells(state, fromIndex, toIndex) {
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

export function selectCell(state, index) {
  if (!isBoardIndex(index) || state.board[index] === null) {
    state.selectedIndex = null;
    return { ok: false, reason: "empty-cell" };
  }

  state.selectedIndex = index;
  state.message = `${ITEM_BY_ID[state.board[index]].name} 선택됨`;
  return { ok: true, index, item: state.board[index] };
}

export function deliverToCustomer(state, customerId) {
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

export function getNextItemId(itemId) {
  const index = RECIPE.findIndex((item) => item.id === itemId);
  if (index === -1 || index === RECIPE.length - 1) return null;
  return RECIPE[index + 1].id;
}

export function describeBoardCell(itemId) {
  if (!itemId) return null;
  return ITEM_BY_ID[itemId] ?? null;
}

function isBoardIndex(index) {
  return Number.isInteger(index) && index >= 0 && index < BOARD_CELLS;
}
