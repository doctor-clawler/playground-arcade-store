import test from "node:test";
import assert from "node:assert/strict";

import {
  attackTooth,
  buyItem,
  COIN_VALUE,
  createInitialState,
  startRun,
  updateGame,
} from "../src/gameCore.js";

test("surviving for sixty seconds returns to lobby and awards 100 won", () => {
  let state = startRun(createInitialState({ money: 0 }));

  state = updateGame(state, 60.05, {});

  assert.equal(state.mode, "lobby");
  assert.equal(state.money, 100);
  assert.equal(state.lastResult, "survived");
});

test("touching the tooth without invincibility sends the player back to the lobby", () => {
  let state = startRun(createInitialState({ money: 0 }));
  state.player.x = 300;
  state.player.y = 300;
  state.tooth.x = 300;
  state.tooth.y = 300;

  state = updateGame(state, 0.016, {});

  assert.equal(state.mode, "lobby");
  assert.equal(state.money, 0);
  assert.equal(state.lastResult, "eaten");
});

test("invincibility can be bought for 10000 won and prevents tooth deaths", () => {
  let state = createInitialState({ money: 10000 });

  state = buyItem(state, "invincible");
  state = startRun(state);
  state.player.x = 320;
  state.player.y = 320;
  state.tooth.x = 320;
  state.tooth.y = 320;
  state = updateGame(state, 0.016, {});

  assert.equal(state.mode, "playing");
  assert.equal(state.money, 0);
  assert.equal(state.inventory.invincible, true);
});

test("hammer license costs 2000 won, lets the player collect the bottom hammer, and awards 100 won for killing the tooth", () => {
  let state = createInitialState({ money: 2000 });

  state = buyItem(state, "hammer");
  state = startRun(state);
  state.player.x = state.hammer.x;
  state.player.y = state.hammer.y;
  state = updateGame(state, 0.016, {});
  state.tooth.x = state.player.x + 50;
  state.tooth.y = state.player.y;
  state = attackTooth(state);

  assert.equal(state.inventory.hammer, true);
  assert.equal(state.hammer.carried, false);
  assert.equal(state.tooth.alive, false);
  assert.equal(state.money, 100);
  assert.equal(state.run.kills, 1);
});

test("coins are visible as soon as a run starts", () => {
  const state = startRun(createInitialState({ money: 0 }));

  assert.ok(state.coins.length >= 3);
  assert.ok(state.coins.every((coin) => coin.r >= 26));
  assert.ok(state.coins.some((coin) => coin.x < state.arena.width / 2));
  assert.ok(state.coins.some((coin) => coin.x > state.arena.width / 2));
  assert.ok(state.coins.some((coin) => coin.y > state.arena.height / 2));
});

test("coins award 50 won when the player gets close", () => {
  let state = startRun(createInitialState({ money: 0 }));
  const coinCount = state.coins.length;

  state.player.x = state.coins[0].x + 8;
  state.player.y = state.coins[0].y + 8;
  state = updateGame(state, 0.016, {});

  assert.equal(state.money, COIN_VALUE);
  assert.equal(state.coins.length, coinCount - 1);
  assert.equal(state.run.coinsCollected, 1);
});
