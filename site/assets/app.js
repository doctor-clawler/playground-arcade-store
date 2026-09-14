(() => {
  "use strict";

  const catalog = window.PLAYGROUND_CATALOG;
  const games = catalog?.games || [];
  const byId = new Map(games.map((game) => [game.id, game]));
  const state = { query: "", genre: "전체", currentGame: null, loadTimer: null, saveSession: null, action: 0 };

  const $ = (selector) => document.querySelector(selector);
  const homeView = $("#home-view");
  const detailView = $("#detail-view");
  const notFoundView = $("#not-found-view");
  const gameGrid = $("#game-grid");
  const emptyState = $("#empty-state");
  const searchInput = $("#search-input");
  const filterHost = $("#genre-filters");
  const frameHost = $("#frame-host");
  const playerShell = $("#player-shell");
  const playerPoster = $("#player-poster");
  const playerLoading = $("#player-loading");
  const playerError = $("#player-error");

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[character]);
  }

  function showView(name) {
    homeView.hidden = name !== "home";
    detailView.hidden = name !== "detail";
    notFoundView.hidden = name !== "not-found";
    document.body.dataset.view = name;
  }

  function renderFilters() {
    const genres = ["전체", ...new Set(games.map((game) => game.genre))];
    filterHost.innerHTML = genres.map((genre) => `
      <button type="button" class="filter-button${genre === state.genre ? " is-active" : ""}" data-genre="${escapeHtml(genre)}" aria-pressed="${genre === state.genre}">${escapeHtml(genre)}</button>
    `).join("");
    filterHost.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        state.genre = button.dataset.genre;
        renderFilters();
        renderCatalog();
      });
    });
  }

  function filteredGames() {
    const query = state.query.trim().toLocaleLowerCase("ko");
    return games.filter((game) => {
      const genreMatch = state.genre === "전체" || game.genre === state.genre;
      const haystack = [game.title, game.genre, game.shortDescription, ...game.tags].join(" ").toLocaleLowerCase("ko");
      return genreMatch && (!query || haystack.includes(query));
    });
  }

  function renderCatalog() {
    const visible = filteredGames();
    gameGrid.innerHTML = visible.map((game, index) => `
      <article class="game-item game-${escapeHtml(game.id)}" data-game-id="${escapeHtml(game.id)}" data-testid="game-card-${escapeHtml(game.id)}">
        <button class="game-link" type="button" aria-label="${escapeHtml(game.title)} 상세 보기">
          <span class="game-order">${String(index + 1).padStart(2, "0")}</span>
          <span class="game-media"><img src="${escapeHtml(game.thumbnailUrl)}" alt="${escapeHtml(game.title)} 플레이 화면" loading="lazy"></span>
          <span class="game-copy">
            <span class="game-kicker">${escapeHtml(game.genre)} · ${escapeHtml(game.orientation)}</span>
            <strong>${escapeHtml(game.title)}</strong>
            <span>${escapeHtml(game.shortDescription)}</span>
          </span>
          <span class="game-arrow" aria-hidden="true">↗</span>
        </button>
      </article>
    `).join("");
    emptyState.hidden = visible.length > 0;
    gameGrid.querySelectorAll(".game-item").forEach((item) => {
      item.querySelector("button").addEventListener("click", () => { window.location.hash = `game/${item.dataset.gameId}`; });
    });
  }

  function isMobilePlayViewport() {
    return window.matchMedia("(max-width: 800px), (pointer: coarse)").matches;
  }

  function exitMobilePlayMode() {
    playerShell.classList.remove("is-mobile-play");
    document.body.classList.remove("mobile-play-active");
    try { window.screen.orientation?.unlock?.(); } catch { /* unsupported */ }
    if (document.fullscreenElement === playerShell) document.exitFullscreen().catch(() => {});
  }

  function enterMobilePlayMode(game) {
    if (!isMobilePlayViewport()) return;
    playerShell.classList.add("is-mobile-play");
    document.body.classList.add("mobile-play-active");
    if (document.fullscreenElement) return;

    const requestFullscreen = playerShell.requestFullscreen || playerShell.webkitRequestFullscreen;
    if (!requestFullscreen) return;
    try {
      const request = requestFullscreen.call(playerShell, { navigationUI: "hide" });
      Promise.resolve(request).then(() => {
        // A fast load/save failure may have exited CSS play mode while the
        // browser was still processing the fullscreen request.
        if (!playerShell.classList.contains("is-mobile-play")) {
          if (document.fullscreenElement === playerShell) return document.exitFullscreen?.();
          return;
        }
        const orientation = game.orientation === "가로" ? "landscape" : "portrait";
        return window.screen.orientation?.lock?.(orientation);
      }).catch(() => {});
    } catch {
      // CSS immersive mode remains active when the Fullscreen API is unavailable.
    }
  }

  async function resetPlayer({ keepMobileMode = false } = {}) {
    const oldSession = state.saveSession;
    if (oldSession) await oldSession.close();
    if (state.saveSession === oldSession) state.saveSession = null;
    if (state.saveSession) return;
    clearTimeout(state.loadTimer);
    if (!keepMobileMode) exitMobilePlayMode();
    frameHost.replaceChildren();
    frameHost.hidden = true;
    playerPoster.hidden = false;
    playerLoading.hidden = true;
    playerError.hidden = true;
    playerShell.dataset.state = "idle";
    $("#reload-game").disabled = true;
    $("#fullscreen-game").disabled = true;
    $("#player-label").textContent = "포스터에서 플레이 버튼을 누르세요.";
  }

  function fillDetail(game) {
    state.currentGame = game;
    playerShell.dataset.orientation = game.orientation === "세로" ? "portrait" : "landscape";
    setSaveStatus("ready", "이 브라우저에 자동 저장해요.");
    $("#detail-title").textContent = game.title;
    $("#detail-description").textContent = game.description;
    $("#player-poster-image").src = game.thumbnailUrl;
    $("#player-poster-image").alt = `${game.title} 게임 시작 화면`;
    $("#player-start-hint").textContent = isMobilePlayViewport() ? "탭하면 전체화면으로 시작합니다" : "바로 플레이";
    $("#controls-list").innerHTML = game.mobileControls.map((control) => `<li>${escapeHtml(control)}</li>`).join("");
  }

  async function startGame() {
    const game = state.currentGame;
    if (!game) return;
    const action = ++state.action;
    enterMobilePlayMode(game);
    await resetPlayer({ keepMobileMode: true });
    if (action !== state.action) return;
    playerPoster.hidden = true;
    playerLoading.hidden = false;
    playerShell.dataset.state = "loading";
    $("#player-label").textContent = `${game.title} 준비 중…`;

    const iframe = document.createElement("iframe");
    iframe.title = `${game.title} 게임 플레이어`;
    const nonce = Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => n.toString(16)).join("-");
    iframe.src = `${game.entryUrl}#loa-session=${nonce}`;
    iframe.allow = "fullscreen; gamepad";
    iframe.setAttribute("sandbox", "allow-scripts allow-pointer-lock");
    iframe.setAttribute("referrerpolicy", "no-referrer");
    iframe.setAttribute("data-testid", "game-frame");
    state.saveSession = LoaSaveStore.connect({ frame: iframe, id: game.id, nonce,
      onStatus: setSaveStatus, onReady: showPlayerReady, onError: showPlayerError });
    frameHost.append(iframe);

    state.loadTimer = window.setTimeout(() => showPlayerError("게임을 불러오지 못했어요. 다시 시도해 주세요."), 12000);
  }

  function showPlayerReady() {
    clearTimeout(state.loadTimer);
    playerLoading.hidden = true;
    playerError.hidden = true;
    frameHost.hidden = false;
    playerShell.dataset.state = "ready";
    $("#reload-game").disabled = false;
    $("#fullscreen-game").disabled = false;
    $("#player-label").textContent = isMobilePlayViewport() ? `${state.currentGame.title} 실행 중` : `${state.currentGame.title} 실행 중 · 전체화면 버튼 사용 가능`;
  }

  function showPlayerError(message) {
    clearTimeout(state.loadTimer);
    playerLoading.hidden = true;
    frameHost.hidden = true;
    playerError.hidden = false;
    playerShell.dataset.state = "error";
    $("#player-error-message").textContent = message;
    $("#player-label").textContent = "게임 실행 오류";
    exitMobilePlayMode();
  }

  function setSaveStatus(kind, text) {
    $("#save-status").dataset.state = kind;
    $("#save-status").textContent = text;
    $("#save-warning").hidden = kind !== "error";
    $("#save-warning").textContent = kind === "error" ? text : "";
  }

  async function route() {
    const action = ++state.action;
    await resetPlayer();
    if (action !== state.action) return;
    const hash = window.location.hash.replace(/^#\/?/, "") || "home";
    state.currentGame = null;
    if (hash === "home") {
      showView("home");
      document.title = "PLAY//GROUND — 놀이터 아케이드";
      return;
    }
    if (hash.startsWith("game/")) {
      const game = byId.get(hash.slice(5));
      if (game) {
        showView("detail");
        fillDetail(game);
        document.title = `${game.title} — PLAY//GROUND`;
        window.scrollTo({ top: 0, behavior: "instant" });
        return;
      }
    }
    showView("not-found");
    document.title = "게임을 찾을 수 없음 — PLAY//GROUND";
  }

  searchInput.addEventListener("input", () => { state.query = searchInput.value; renderCatalog(); });
  $("#reset-search").addEventListener("click", () => {
    state.query = ""; state.genre = "전체"; searchInput.value = ""; renderFilters(); renderCatalog(); searchInput.focus();
  });
  $("#back-button").addEventListener("click", () => { window.location.hash = "home"; });
  $("#start-game").addEventListener("click", startGame);
  $("#retry-game").addEventListener("click", startGame);
  $("#reload-game").addEventListener("click", startGame);
  $("#exit-mobile-player").addEventListener("click", () => { state.saveSession?.flush(); exitMobilePlayMode(); });
  $("#delete-save").addEventListener("click", async () => {
    const game = state.currentGame;
    if (!game || !window.confirm(`${game.title}의 저장을 삭제하고 처음부터 시작할까요? 다른 게임 저장은 유지돼요.`)) return;
    ++state.action;
    await resetPlayer();
    try {
      await LoaSaveStore.remove(game.id);
      setSaveStatus("ready", "저장을 삭제했어요. 플레이를 누르면 새로 시작해요.");
    } catch (error) { setSaveStatus("error", error.message); }
  });
  window.addEventListener("pagehide", () => state.saveSession?.close());
  window.addEventListener("pageshow", (event) => { if (event.persisted) route(); });
  $("#fullscreen-game").addEventListener("click", async () => {
    const iframe = frameHost.querySelector("iframe");
    if (!iframe) return;
    if (isMobilePlayViewport()) {
      enterMobilePlayMode(state.currentGame);
      return;
    }
    try { await iframe.requestFullscreen(); } catch { showPlayerError("이 브라우저에서 전체화면을 시작할 수 없습니다."); }
  });
  window.addEventListener("hashchange", route);
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
      playerShell.classList.remove("is-mobile-play");
      document.body.classList.remove("mobile-play-active");
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !detailView.hidden && !document.fullscreenElement) window.location.hash = "home";
  });

  if (!catalog || games.length === 0) {
    gameGrid.innerHTML = "<p>카탈로그를 불러오지 못했습니다.</p>";
    return;
  }
  renderFilters();
  renderCatalog();
  route();
})();
