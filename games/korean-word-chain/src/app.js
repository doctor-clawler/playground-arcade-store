import {
  PLAYER_DICTIONARY_WORDS,
  createGame,
  createLobby,
  giveUp,
  submitPlayerWord,
} from "./game.js";

const STORAGE_KEY = "korean-word-chain-balance";
const app = document.querySelector("#app");

let state = createLobby(loadBalance());

function loadBalance() {
  const value = Number(localStorage.getItem(STORAGE_KEY));
  return Number.isFinite(value) ? value : 0;
}

function saveBalance() {
  localStorage.setItem(STORAGE_KEY, String(state.balance));
}

function formatWon(value) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function speakerLabel(speaker) {
  return speaker === "player" ? "플레이어" : "AI";
}

function renderTopbar() {
  return `
    <div class="topbar">
      <div class="brand">끝말잇기</div>
      <div class="money">보유금 ${formatWon(state.balance)}</div>
    </div>
  `;
}

function renderLobby() {
  const result = state.lastResult
    ? `<div class="result">${state.lastResult.message} ${state.lastResult.reason}</div>`
    : "";
  const lastWords = state.history?.length
    ? `<div class="last-line" aria-label="지난 게임 단어">마지막 단어: ${state.history.map((item) => item.word).join(" → ")}</div>`
    : "";

  app.innerHTML = `
    <section class="shell">
      ${renderTopbar()}
      <div class="stage lobby">
        <p class="kicker">쉬운 단어로 겨루기</p>
        <h1 class="title">끝말잇기</h1>
        <p class="summary">플레이어가 먼저 말하고 AI가 이어 말합니다. 이기면 2,000원을 받습니다.</p>
        ${result}
        <button class="primary-button" id="play-button" type="button">플레이</button>
        ${lastWords}
      </div>
    </section>
  `;

  document.querySelector("#play-button").addEventListener("click", startGame);
}

function renderGame() {
  const promptText = state.currentSyllable
    ? `<span class="syllable">${state.currentSyllable}</span><span>로 시작</span>`
    : `<span class="syllable">첫 단어</span>`;

  app.innerHTML = `
    <section class="shell">
      ${renderTopbar()}
      <div class="stage game">
        <div class="prompt">
          <p class="prompt-label">${promptText}</p>
          <div class="message">${state.message}</div>
        </div>
        <form class="entry" id="word-form">
          <input id="word-input" name="word" autocomplete="off" inputmode="text" maxlength="12" placeholder="단어 입력" />
          <button class="primary-button" id="submit-word" type="submit">말하기</button>
          <button class="secondary-button" id="give-up" type="button">못 이어요</button>
        </form>
        <div class="word-list" aria-label="사용한 단어">
          ${state.history.length ? state.history.map(renderBubble).join("") : '<div class="empty">아직 쓴 단어가 없습니다.</div>'}
        </div>
      </div>
    </section>
  `;

  const form = document.querySelector("#word-form");
  const input = document.querySelector("#word-input");
  const wordList = document.querySelector(".word-list");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    state = submitPlayerWord(state, input.value);
    saveBalance();
    render();
  });
  document.querySelector("#give-up").addEventListener("click", () => {
    state = giveUp(state);
    saveBalance();
    render();
  });
  requestAnimationFrame(() => {
    wordList.scrollTop = wordList.scrollHeight;
  });
  input.focus();
}

function renderBubble(item) {
  return `
    <div class="bubble ${item.speaker === "ai" ? "ai" : "player"}">
      <div class="speaker">${speakerLabel(item.speaker)}</div>
      <div class="word">${item.word}</div>
    </div>
  `;
}

function startGame() {
  state = createGame({ balance: state.balance });
  render();
}

function render() {
  if (state.mode === "lobby") {
    renderLobby();
  } else {
    renderGame();
  }
}

window.render_game_to_text = () =>
  JSON.stringify({
    mode: state.mode,
    balance: state.balance,
    turn: state.turn,
    currentSyllable: state.currentSyllable,
    message: state.message,
    history: state.history,
    lastResult: state.lastResult,
    dictionarySize: PLAYER_DICTIONARY_WORDS.length,
  });

window.advanceTime = () => {
  render();
};

render();
