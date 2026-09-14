import test from "node:test";
import assert from "node:assert/strict";

import {
  WHITE,
  createDefaultCharacter,
  createInitialState,
  eraseCurrentSelection,
  exitWithoutSaving,
  normalizeCharacter,
  saveAndExit,
  selectOutfit,
  setActiveTab,
  setOutfitColor,
  setSkinColor,
  startCustomizing,
} from "../src/logic.mjs";

test("first start opens a white character with no face or clothes", () => {
  const state = createInitialState();
  startCustomizing(state);

  assert.deepEqual(state.draft, {
    skinColor: WHITE,
    outfit: null,
    outfitColor: WHITE,
    eyes: false,
    mouth: false,
  });
});

test("each newly selected outfit starts white and can be recolored", () => {
  const state = createInitialState();
  startCustomizing(state);
  setActiveTab(state, "clothes");
  selectOutfit(state, "short");
  setOutfitColor(state, "#f05f56");
  assert.equal(state.draft.outfitColor, "#f05f56");

  selectOutfit(state, "coat");
  assert.equal(state.draft.outfit, "coat");
  assert.equal(state.draft.outfitColor, WHITE);
});

test("eraser resets skin or removes the current outfit", () => {
  const state = createInitialState();
  startCustomizing(state);
  setSkinColor(state, "#bd7d52");
  eraseCurrentSelection(state);
  assert.equal(state.draft.skinColor, WHITE);

  setActiveTab(state, "clothes");
  selectOutfit(state, "windbreaker");
  eraseCurrentSelection(state);
  assert.equal(state.draft.outfit, null);
  assert.equal(state.draft.outfitColor, WHITE);
});

test("plain exit discards changes while save and exit preserves them", () => {
  const state = createInitialState();
  startCustomizing(state);
  setSkinColor(state, "#eab48b");
  exitWithoutSaving(state);
  assert.equal(state.saved, null);
  assert.equal(state.draft.skinColor, WHITE);

  startCustomizing(state);
  setSkinColor(state, "#eab48b");
  selectOutfit(state, "long");
  setOutfitColor(state, "#4d84d8");
  saveAndExit(state);
  assert.equal(state.saved.skinColor, "#eab48b");
  assert.equal(state.saved.outfit, "long");

  startCustomizing(state);
  assert.deepEqual(state.draft, state.saved);
});

test("saved data is normalized and cannot restore eyes or a mouth", () => {
  const normalized = normalizeCharacter({
    skinColor: "#553124",
    outfit: "coat",
    outfitColor: "#34343d",
    eyes: true,
    mouth: true,
  });
  assert.equal(normalized.eyes, false);
  assert.equal(normalized.mouth, false);

  assert.deepEqual(normalizeCharacter({ skinColor: "hotpink", outfit: "cape" }), createDefaultCharacter());
});
