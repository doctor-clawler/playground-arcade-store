import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  chooseAiWord,
  createGame,
  CURATED_PLAYER_WORDS,
  firstSyllable,
  giveUp,
  isDictionaryWord,
  lastSyllable,
  syllableWithRo,
  submitPlayerWord,
} from "../src/game.js";

describe("Korean word-chain rules", () => {
  test("reads the first and last Korean syllable from a word", () => {
    assert.equal(firstSyllable(" 사과 "), "사");
    assert.equal(lastSyllable(" 사과 "), "과");
  });

  test("formats Korean syllable with a natural ro/euro particle", () => {
    assert.equal(syllableWithRo("자"), "자로");
    assert.equal(syllableWithRo("턱"), "턱으로");
  });

  test("accepts words from the player Korean dictionary", () => {
    assert.equal(isDictionaryWord("사과"), true);
    assert.equal(isDictionaryWord("컴퓨터"), true);
    assert.equal(isDictionaryWord("가격"), true);
    assert.equal(isDictionaryWord("없는말"), false);

    const dictionaryOnlyWord = submitPlayerWord(createGame(), "가격");
    assert.equal(dictionaryOnlyWord.mode, "lobby");
    assert.equal(dictionaryOnlyWord.lastResult.winner, "player");
    assert.deepEqual(dictionaryOnlyWord.history.map((item) => item.word), ["가격"]);
  });

  test("player can use a dictionary word that AI does not prefer as an easy answer", () => {
    const next = submitPlayerWord(createGame(), "컴퓨터");

    assert.equal(next.mode, "playing");
    assert.deepEqual(
      next.history.map((item) => item.word),
      ["컴퓨터", "터치"],
    );
    assert.equal(next.currentSyllable, "치");
    assert.match(next.message, /예: 치킨/);
  });

  test("player starts with a dictionary word and AI replies with an easy matching word", () => {
    const next = submitPlayerWord(createGame(), "사과");

    assert.equal(next.mode, "playing");
    assert.equal(next.turn, "player");
    assert.equal(next.history[0].word, "사과");
    assert.equal(next.history[1].speaker, "ai");
    assert.equal(firstSyllable(next.history[1].word), "과");
    assert.equal(next.currentSyllable, lastSyllable(next.history[1].word));
    assert.match(next.message, /예: 자두/);
  });

  test("rejects words that are not in the dictionary", () => {
    const next = submitPlayerWord(createGame(), "없는말");

    assert.equal(next.mode, "playing");
    assert.equal(next.history.length, 0);
    assert.match(next.message, /사전에 있는 단어/);
  });

  test("rejects a player word that does not continue the previous ending", () => {
    const game = {
      ...createGame(),
      currentSyllable: "나",
      usedWords: ["바나나"],
      history: [{ speaker: "ai", word: "바나나" }],
    };
    const next = submitPlayerWord(game, "사과");

    assert.equal(next.history.length, 1);
    assert.match(next.message, /나로 시작/);
  });

  test("rejects a repeated word", () => {
    const game = {
      ...createGame(),
      usedWords: ["사과"],
      history: [{ speaker: "player", word: "사과" }],
    };
    const next = submitPlayerWord(game, "사과");

    assert.equal(next.history.length, 1);
    assert.match(next.message, /이미 쓴 단어/);
  });

  test("awards 2000 won and returns to lobby when AI cannot answer", () => {
    const next = submitPlayerWord(createGame({ balance: 3000 }), "문턱");

    assert.equal(next.mode, "lobby");
    assert.equal(next.balance, 5000);
    assert.equal(next.lastResult.winner, "player");
    assert.equal(next.lastResult.reward, 2000);
  });

  test("give up returns to lobby as a loss only when no player word exists", () => {
    const blocked = {
      ...createGame(),
      currentSyllable: "릎",
      history: [{ speaker: "ai", word: "무릎" }],
    };
    const next = giveUp(blocked);

    assert.equal(next.mode, "lobby");
    assert.equal(next.lastResult.winner, "ai");
    assert.equal(next.balance, 0);
  });

  test("AI chooses the shortest easy word for the required syllable", () => {
    const game = createGame({ usedWords: ["사과"] });
    const aiWord = chooseAiWord(game, "과");

    assert.equal(aiWord, "과자");
  });

  test("AI skips answers that immediately leave the player with no word", () => {
    const next = submitPlayerWord(createGame(), "시계");

    assert.equal(next.mode, "lobby");
    assert.equal(next.lastResult.winner, "player");
    assert.deepEqual(
      next.history.map((item) => item.word),
      ["시계"],
    );
  });

  test("AI chooses a playable answer instead of a dead-end answer", () => {
    const next = submitPlayerWord(createGame(), "박수");

    assert.equal(next.mode, "playing");
    assert.deepEqual(
      next.history.map((item) => item.word),
      ["박수", "수건"],
    );
    assert.equal(next.currentSyllable, "건");
    assert.match(next.message, /예: 건물/);
  });

  test("player can answer after the 기차 to 차도 exchange", () => {
    const afterFirst = submitPlayerWord(createGame(), "기차");

    assert.equal(afterFirst.mode, "playing");
    assert.deepEqual(
      afterFirst.history.map((item) => item.word),
      ["기차", "차도"],
    );
    assert.equal(afterFirst.currentSyllable, "도");
    assert.match(afterFirst.message, /예: 도시/);

    const afterSecond = submitPlayerWord(afterFirst, "도시");
    assert.equal(afterSecond.mode, "playing");
    assert.deepEqual(
      afterSecond.history.map((item) => item.word),
      ["기차", "차도", "도시", "시계"],
    );
    assert.equal(afterSecond.currentSyllable, "계");
    assert.match(afterSecond.message, /예: 계란/);
  });

  test("AI never answers and immediately declares the player unable to continue", () => {
    const immediateLosses = [];

    for (const word of CURATED_PLAYER_WORDS) {
      const next = submitPlayerWord(createGame(), word);
      const aiAnswered = next.history.some((item) => item.speaker === "ai");
      if (aiAnswered && next.mode === "lobby" && next.lastResult?.winner === "ai") {
        immediateLosses.push(word);
      }
    }

    assert.deepEqual(immediateLosses, []);
  });

  test("AI does not answer with made-up connector words", () => {
    const cases = [
      ["계란", "란초"],
      ["무릎", "릎받이"],
      ["이름", "름름이"],
      ["차례", "례절"],
      ["사람", "람보"],
      ["마을", "을지로"],
    ];

    for (const [playerWord, blockedAiWord] of cases) {
      const next = submitPlayerWord(createGame(), playerWord);
      assert.equal(next.mode, "lobby", `${playerWord} should make AI lose`);
      assert.equal(next.lastResult.winner, "player");
      assert.equal(
        next.history.some((item) => item.word === blockedAiWord),
        false,
        `${blockedAiWord} should not be used by AI`,
      );
    }
  });
});
