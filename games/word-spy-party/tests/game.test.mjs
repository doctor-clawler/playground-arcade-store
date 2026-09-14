import assert from "node:assert/strict";
import test from "node:test";

async function loadGameModule() {
  return import("../src/game.js").catch(() => ({}));
}

test("generateRound creates exactly three player assignments", async () => {
  const { generateRound } = await loadGameModule();

  const round = generateRound({ rng: () => 0 });

  assert.equal(round.assignments.length, 3);
  assert.deepEqual(
    round.assignments.map((assignment) => assignment.playerNumber),
    [1, 2, 3],
  );
});

test("generateRound gives two players the same word and one player a different word", async () => {
  const { generateRound } = await loadGameModule();

  const round = generateRound({ rng: () => 0 });
  const counts = new Map();
  for (const assignment of round.assignments) {
    counts.set(assignment.word, (counts.get(assignment.word) ?? 0) + 1);
  }

  assert.deepEqual([...counts.values()].sort(), [1, 2]);
  assert.equal(round.assignments.filter((assignment) => assignment.isOdd).length, 1);
});

test("generateRound always uses a word pair from one shared category", async () => {
  const { generateRound, WORD_PAIRS } = await loadGameModule();

  const round = generateRound({ rng: () => 0.42 });
  const sourcePair = WORD_PAIRS.find((pair) => pair.id === round.pairId);

  assert.ok(sourcePair, "round pair should exist in WORD_PAIRS");
  assert.equal(round.category, sourcePair.category);
  assert.deepEqual(
    [round.majorityWord, round.oddWord].sort(),
    [...sourcePair.words].sort(),
  );
});

test("WORD_PAIRS contains ten thousand similar word pair options", async () => {
  const { WORD_PAIRS } = await loadGameModule();

  assert.equal(WORD_PAIRS.length, 10_000);
  for (const pair of WORD_PAIRS.slice(0, 50)) {
    assert.equal(pair.words.length, 2);
    assert.notEqual(pair.words[0], pair.words[1]);
    assert.ok(pair.category);
    assert.ok(pair.hint);
  }
});

test("generateRound can avoid immediately repeating the previous pair", async () => {
  const { generateRound, WORD_PAIRS } = await loadGameModule();

  const previousPairId = WORD_PAIRS[0].id;
  const round = generateRound({ rng: () => 0, previousPairId });

  assert.notEqual(round.pairId, previousPairId);
});

test("generateRound skips words already used in the session", async () => {
  const { generateRound, WORD_PAIRS } = await loadGameModule();

  const usedWord = WORD_PAIRS[0].words[0];
  const round = generateRound({ rng: () => 0, excludedWords: [usedWord] });

  assert.notEqual(round.majorityWord, usedWord);
  assert.notEqual(round.oddWord, usedWord);
});

test("generateRound supports a custom player count with one odd player", async () => {
  const { generateRound } = await loadGameModule();

  const round = generateRound({ rng: () => 0.25, playerCount: 5 });
  const counts = new Map();
  for (const assignment of round.assignments) {
    counts.set(assignment.word, (counts.get(assignment.word) ?? 0) + 1);
  }

  assert.equal(round.assignments.length, 5);
  assert.deepEqual(
    round.assignments.map((assignment) => assignment.playerNumber),
    [1, 2, 3, 4, 5],
  );
  assert.deepEqual([...counts.values()].sort((a, b) => a - b), [1, 4]);
  assert.equal(round.assignments.filter((assignment) => assignment.isOdd).length, 1);
});
