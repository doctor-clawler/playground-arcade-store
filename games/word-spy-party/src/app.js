import {
  DEFAULT_PLAYER_COUNT,
  MAX_PLAYER_COUNT,
  MIN_PLAYER_COUNT,
  TARGET_WORD_PAIR_COUNT,
  generateRound,
} from "./game.js";

const STORAGE_KEYS = {
  usedPairIds: "word-spy-party.usedPairIds",
  usedWords: "word-spy-party.usedWords",
};

function loadStoredSet(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

function saveStoredSet(key, set) {
  localStorage.setItem(key, JSON.stringify([...set]));
}

const state = {
  phase: "idle",
  round: null,
  playerCount: DEFAULT_PLAYER_COUNT,
  currentPlayerIndex: 0,
  visiblePlayerIndexes: new Set(),
  usedPairIds: loadStoredSet(STORAGE_KEYS.usedPairIds),
  usedWords: loadStoredSet(STORAGE_KEYS.usedWords),
  wordVisible: false,
  answerVisible: false,
  previousPairId: null,
};

const els = {
  newRoundTop: document.querySelector("#newRoundTop"),
  roundStatus: document.querySelector("#roundStatus"),
  progressLabel: document.querySelector("#progressLabel"),
  wordCard: document.querySelector("#wordCard"),
  cardKicker: document.querySelector("#cardKicker"),
  cardWord: document.querySelector("#cardWord"),
  cardNote: document.querySelector("#cardNote"),
  primaryAction: document.querySelector("#primaryAction"),
  answerAction: document.querySelector("#answerAction"),
  setupPanel: document.querySelector("#setupPanel"),
  decreasePlayers: document.querySelector("#decreasePlayers"),
  increasePlayers: document.querySelector("#increasePlayers"),
  playerCountValue: document.querySelector("#playerCountValue"),
  setupHint: document.querySelector("#setupHint"),
  playerList: document.querySelector("#playerList"),
  clueText: document.querySelector("#clueText"),
  answerBlock: document.querySelector("#answerBlock"),
  answerText: document.querySelector("#answerText"),
};

function startRound() {
  state.round = generateRound({
    previousPairId: state.previousPairId,
    playerCount: state.playerCount,
    excludedPairIds: state.usedPairIds,
    excludedWords: state.usedWords,
  });
  if (state.round.historyReset) {
    state.usedPairIds = new Set();
    state.usedWords = new Set();
  }
  state.usedPairIds.add(state.round.pairId);
  state.usedWords.add(state.round.majorityWord);
  state.usedWords.add(state.round.oddWord);
  saveStoredSet(STORAGE_KEYS.usedPairIds, state.usedPairIds);
  saveStoredSet(STORAGE_KEYS.usedWords, state.usedWords);
  state.previousPairId = state.round.pairId;
  state.phase = "reveal";
  state.currentPlayerIndex = 0;
  state.visiblePlayerIndexes = new Set();
  state.wordVisible = false;
  state.answerVisible = false;
  render();
}

function revealWord() {
  if (!state.round || state.phase !== "reveal") return;
  state.wordVisible = true;
  state.visiblePlayerIndexes.add(state.currentPlayerIndex);
  render();
}

function hideAndAdvance() {
  if (!state.round) return;
  state.wordVisible = false;
  if (state.currentPlayerIndex < state.round.playerCount - 1) {
    state.currentPlayerIndex += 1;
    state.phase = "reveal";
  } else {
    state.phase = "discussion";
  }
  render();
}

function showAnswer() {
  if (!state.round) return;
  state.answerVisible = true;
  render();
}

function handlePrimaryAction() {
  if (!state.round || state.phase === "idle") {
    startRound();
    return;
  }
  if (state.phase === "discussion") {
    startRound();
    return;
  }
  if (state.wordVisible) {
    hideAndAdvance();
    return;
  }
  revealWord();
}

function getCurrentAssignment() {
  return state.round?.assignments[state.currentPlayerIndex] ?? null;
}

function setPlayerCount(nextCount) {
  if (state.phase === "reveal") return;
  state.playerCount = Math.min(MAX_PLAYER_COUNT, Math.max(MIN_PLAYER_COUNT, nextCount));
  render();
}

function getVisiblePlayerCount() {
  return state.round?.playerCount ?? state.playerCount;
}

function renderPlayers() {
  els.playerList.replaceChildren();
  const visiblePlayerCount = getVisiblePlayerCount();
  for (let index = 0; index < visiblePlayerCount; index += 1) {
    const row = document.createElement("div");
    const isActive = state.round && state.phase === "reveal" && index === state.currentPlayerIndex;
    const isDone = state.visiblePlayerIndexes.has(index) || state.phase === "discussion";
    row.className = [
      "player-row",
      isActive ? "is-active" : "",
      isDone ? "is-done" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const badge = document.createElement("span");
    badge.className = "player-index";
    badge.textContent = String(index + 1);

    const text = document.createElement("div");
    const title = document.createElement("p");
    title.className = "player-title";
    title.textContent = `플레이어 ${index + 1}`;
    const sub = document.createElement("span");
    sub.className = "player-state";
    sub.textContent = isActive ? "확인 차례" : isDone ? "확인 완료" : "대기";
    text.append(title, sub);

    const dot = document.createElement("span");
    dot.className = "status-dot";
    row.append(badge, text, dot);
    els.playerList.append(row);
  }
}

function renderSetupControls() {
  const locked = state.phase === "reveal";
  const pairCountLabel = `${TARGET_WORD_PAIR_COUNT.toLocaleString("ko-KR")}개 단어쌍`;
  els.setupPanel.classList.toggle("is-locked", locked);
  els.decreasePlayers.disabled = locked || state.playerCount <= MIN_PLAYER_COUNT;
  els.increasePlayers.disabled = locked || state.playerCount >= MAX_PLAYER_COUNT;
  els.playerCountValue.textContent = String(state.playerCount);
  els.setupHint.textContent =
    state.phase === "reveal"
      ? "라운드 진행 중"
      : state.phase === "discussion"
        ? "다음 라운드에 적용"
        : `${MIN_PLAYER_COUNT}~${MAX_PLAYER_COUNT}명 · ${pairCountLabel}`;
}

function renderIdle() {
  els.roundStatus.textContent = "대기 중";
  els.progressLabel.textContent = `0 / ${state.playerCount} 확인`;
  els.cardKicker.textContent = "준비";
  els.cardWord.textContent = "시작";
  els.cardNote.textContent = "새 라운드를 눌러 시작하세요";
  els.primaryAction.textContent = "새 라운드 시작";
  els.answerAction.hidden = true;
  els.clueText.textContent = "모두 확인하면 표시됩니다";
  els.answerBlock.hidden = true;
}

function renderReveal() {
  const assignment = getCurrentAssignment();
  const checkedCount = state.visiblePlayerIndexes.size;
  els.roundStatus.textContent = `플레이어 ${assignment.playerNumber} 차례`;
  els.progressLabel.textContent = `${checkedCount} / ${state.round.playerCount} 확인`;
  els.cardKicker.textContent = `플레이어 ${assignment.playerNumber}`;
  els.cardWord.textContent = state.wordVisible ? assignment.word : "비공개";
  els.cardNote.textContent = state.wordVisible
    ? "확인했으면 카드를 가리고 다음 사람에게 넘기세요"
    : "주변에서 화면을 보지 않을 때 단어를 확인하세요";
  els.primaryAction.textContent =
    state.wordVisible && state.currentPlayerIndex === state.round.playerCount - 1
      ? "가리고 토론 시작"
      : state.wordVisible
        ? "가리고 다음 플레이어"
        : "내 단어 보기";
  els.answerAction.hidden = true;
  els.clueText.textContent = "모두 확인하면 표시됩니다";
  els.answerBlock.hidden = true;
}

function renderDiscussion() {
  els.roundStatus.textContent = "토론 중";
  els.progressLabel.textContent = `${state.round.playerCount} / ${state.round.playerCount} 확인`;
  els.cardKicker.textContent = "토론";
  els.cardWord.textContent = "질문";
  els.cardNote.textContent = "서로의 단어를 직접 말하지 말고 스파이를 찾아보세요";
  els.primaryAction.textContent = "새 라운드 시작";
  els.answerAction.hidden = false;
  els.clueText.textContent = state.round.hint;

  els.answerBlock.hidden = !state.answerVisible;
  if (state.answerVisible) {
    const oddAssignment = state.round.assignments.find((assignment) => assignment.isOdd);
    els.answerText.textContent = `공통 단어는 ${state.round.majorityWord}, 다른 단어는 ${state.round.oddWord}. 스파이는 플레이어 ${oddAssignment.playerNumber}입니다.`;
  }
}

function render() {
  els.wordCard.classList.toggle("is-visible", state.wordVisible);
  if (state.phase === "idle") {
    renderIdle();
  } else if (state.phase === "reveal") {
    renderReveal();
  } else {
    renderDiscussion();
  }
  renderSetupControls();
  renderPlayers();
}

els.primaryAction.addEventListener("click", handlePrimaryAction);
els.newRoundTop.addEventListener("click", startRound);
els.answerAction.addEventListener("click", showAnswer);
els.decreasePlayers.addEventListener("click", () => setPlayerCount(state.playerCount - 1));
els.increasePlayers.addEventListener("click", () => setPlayerCount(state.playerCount + 1));
els.wordCard.addEventListener("click", () => {
  if (state.phase === "reveal" && !state.wordVisible) {
    revealWord();
  }
});

window.render_game_to_text = () => {
  const assignment = getCurrentAssignment();
  return JSON.stringify({
    phase: state.phase,
    selectedPlayerCount: state.playerCount,
    roundPlayerCount: state.round?.playerCount ?? null,
    totalWordPairCount: TARGET_WORD_PAIR_COUNT,
    usedPairCount: state.usedPairIds.size,
    usedWordCount: state.usedWords.size,
    currentPlayer: assignment?.playerNumber ?? null,
    wordVisible: state.wordVisible,
    visibleWord: state.wordVisible ? assignment.word : null,
    checkedPlayers: [...state.visiblePlayerIndexes].map((index) => index + 1),
    clue: state.phase === "discussion" ? state.round?.hint : null,
    answerVisible: state.answerVisible,
    answer: state.answerVisible
      ? {
          majorityWord: state.round.majorityWord,
          oddWord: state.round.oddWord,
          oddPlayer: state.round.assignments.find((item) => item.isOdd).playerNumber,
        }
      : null,
  });
};

window.advanceTime = () => {};

render();
