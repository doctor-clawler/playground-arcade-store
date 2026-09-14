import assert from "node:assert/strict";
import test from "node:test";

import {
  createGameState,
  spawnGuest,
  chooseDialogue,
  toggleTalisman,
  holdGuest,
  updateSimulation,
} from "../src/game/simulation/core.js";

test("admit sends a normal guest into the first empty exam room", () => {
  const state = createGameState({ seed: 7 });
  const guest = spawnGuest(state, { behavior: "normal", phrase: "배가 아파요" });

  const result = chooseDialogue(state, guest.id, "admit");

  assert.equal(result.ok, true);
  assert.equal(result.roomId, 1);
  assert.equal(state.rooms[0].occupantId, guest.id);
  assert.equal(guest.status, "in-room");
  assert.equal(guest.dialogue, "진료실로 들어갈게요");
});

test("admit routes guests only to rooms without another patient", () => {
  const state = createGameState({ seed: 3 });
  const first = spawnGuest(state, { behavior: "normal" });
  const second = spawnGuest(state, { behavior: "normal" });

  chooseDialogue(state, first.id, "admit");
  const result = chooseDialogue(state, second.id, "admit");

  assert.equal(result.roomId, 2);
  assert.equal(state.rooms[0].occupantId, first.id);
  assert.equal(state.rooms[1].occupantId, second.id);
});

test("reject makes a suspicious repeat-talker leave without entering a room", () => {
  const state = createGameState({ seed: 11 });
  const guest = spawnGuest(state, { behavior: "repeat", phrase: "안 아파요" });

  const result = chooseDialogue(state, guest.id, "reject");

  assert.equal(result.ok, true);
  assert.equal(guest.status, "gone");
  assert.equal(guest.dialogue, "잘가요...");
  assert.equal(state.rooms.every((room) => room.occupantId === null), true);
});

test("talisman banishes suspicious guests but scares normal guests with 뭐에요", () => {
  const state = createGameState({ seed: 13 });
  const suspicious = spawnGuest(state, { behavior: "stare" });

  toggleTalisman(state);
  updateSimulation(state, 0.1);

  assert.equal(suspicious.status, "gone");
  assert.equal(suspicious.dialogue, "부적이 싫어!");

  const normal = spawnGuest(state, { behavior: "normal" });
  toggleTalisman(state);
  updateSimulation(state, 0.1);

  assert.equal(normal.status, "gone");
  assert.equal(normal.dialogue, "뭐에요?!");
});

test("attack guests damage the player until held for three seconds", () => {
  const state = createGameState({ seed: 17 });
  const attacker = spawnGuest(state, { behavior: "attack" });

  updateSimulation(state, 1.1);
  assert.equal(attacker.status, "attacking");
  assert.equal(state.player.health, 95);

  holdGuest(state, attacker.id, 1.5);
  assert.equal(attacker.status, "attacking");

  holdGuest(state, attacker.id, 1.5);
  assert.equal(attacker.status, "gone");
  assert.equal(attacker.dialogue, "사라진다...");
});

test("talisman banishes a suspicious guest admitted by mistake", () => {
  const state = createGameState({ seed: 19 });
  const guest = spawnGuest(state, { behavior: "repeat" });

  chooseDialogue(state, guest.id, "admit");
  assert.equal(guest.status, "attacking");

  toggleTalisman(state);
  updateSimulation(state, 0.1);

  assert.equal(guest.status, "gone");
  assert.equal(guest.dialogue, "부적이 싫어!");
});

test("doctors finish treatment and health regenerates over time", () => {
  const state = createGameState({ seed: 23 });
  const guest = spawnGuest(state, { behavior: "normal" });
  chooseDialogue(state, guest.id, "admit");

  state.player.health = 80;
  updateSimulation(state, 8);

  assert.equal(guest.status, "treated");
  assert.equal(guest.dialogue, "고마워요!");
  assert.equal(state.rooms[0].occupantId, null);
  assert.equal(state.player.health > 80, true);
  assert.equal(state.player.health <= 100, true);
});
