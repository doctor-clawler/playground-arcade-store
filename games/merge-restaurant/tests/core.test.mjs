import assert from "node:assert/strict";
import test from "node:test";

import {
  addIngredientFromBasket,
  createGameState,
  deliverToCustomer,
  mergeCells,
  RECIPE,
} from "../src/core.mjs";

test("basket adds flour to the first empty grid cell", () => {
  const state = createGameState();

  const result = addIngredientFromBasket(state);

  assert.equal(result.ok, true);
  assert.equal(result.index, 0);
  assert.equal(state.board.length, 49);
  assert.equal(state.board[0], "flour");
  assert.equal(state.board[1], null);
  assert.equal(state.selectedIndex, null);
});

test("initial customers ask for varied crafted items", () => {
  const state = createGameState();
  const wants = state.customers.map((customer) => customer.wants);

  assert.deepEqual(wants, ["noodles", "tomato", "sauce"]);
  assert.equal(new Set(wants).size, 3);
  assert.equal(wants.includes("flour"), false);
});

test("matching ingredients merge into the next recipe stage", () => {
  const state = createGameState();
  state.board[0] = "flour";
  state.board[1] = "flour";

  const result = mergeCells(state, 0, 1);

  assert.equal(result.ok, true);
  assert.equal(result.created, "noodles");
  assert.equal(state.board[0], null);
  assert.equal(state.board[1], "noodles");
  assert.equal(RECIPE.map((item) => item.id).join(">"), "flour>noodles>tomato>sauce>spaghetti");
});

test("different ingredients do not merge", () => {
  const state = createGameState();
  state.board[0] = "flour";
  state.board[1] = "tomato";

  const result = mergeCells(state, 0, 1);

  assert.equal(result.ok, false);
  assert.equal(result.reason, "different-items");
  assert.equal(state.board[0], "flour");
  assert.equal(state.board[1], "tomato");
});

test("serving a matching finished dish pays 500 won and consumes the dish", () => {
  const state = createGameState();
  state.board[4] = state.customers[0].wants;
  state.selectedIndex = 4;
  const customerId = state.customers[0].id;

  const result = deliverToCustomer(state, customerId);

  assert.equal(result.ok, true);
  assert.equal(result.paid, 500);
  assert.equal(state.money, 500);
  assert.equal(state.board[4], null);
  assert.equal(state.selectedIndex, null);
  assert.equal(state.customers.length, 3);
  assert.notEqual(state.customers[0].id, customerId);
});
