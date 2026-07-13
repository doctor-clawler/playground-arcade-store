(() => {
  "use strict";

  const catalog = window.PLAYGROUND_CATALOG;
  const games = catalog?.games || [];
  const byId = new Map(games.map((game) => [game.id, game]));
  const state = { query: "", genre: "전체", currentGame: null, loadTimer: null };

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

  function setHero() {
    const featured = games.find((game) => game.featured) || games[0];
    if (!featured) return;
    $("#hero-image").src = featured.thumbnailUrl;
    $("#hero-image").alt = `${featured.title} 게임 화면`;
    $("#hero-description").textContent = featured.shortDescription;
    $("#hero-play").addEventListener("click", () => { window.location.hash = `game/${featured.id}`; });
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
      const haystack = [game.title, game.edition, game.genre, game.shortDescription, ...game.tags].join(" ").toLocaleLowerCase("ko");
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

  function resetPlayer() {
    clearTimeout(state.loadTimer);
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
    resetPlayer();
    $("#detail-position").textContent = `${String(games.indexOf(game) + 1).padStart(2, "0")} / ${String(games.length).padStart(2, "0")}`;
    $("#detail-edition").textContent = `${game.genre} — ${game.edition}`;
    $("#detail-title").textContent = game.title;
    $("#detail-description").textContent = game.description;
    $("#detail-tags").innerHTML = game.tags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join("");
    $("#detail-facts").innerHTML = [
      ["VERSION", game.version], ["PLAYERS", game.players], ["VIEW", game.orientation], ["FORMAT", "HTML5"]
    ].map(([term, value]) => `<div><dt>${term}</dt><dd>${escapeHtml(value)}</dd></div>`).join("");
    $("#player-poster-image").src = game.thumbnailUrl;
    $("#player-poster-image").alt = `${game.title} 게임 시작 화면`;
    $("#controls-list").innerHTML = game.controls.map((control) => `<li>${escapeHtml(control)}</li>`).join("");
    const provenance = game.provenance;
    $("#source-list").innerHTML = `
      <div><dt>원문</dt><dd><a href="${escapeHtml(provenance.threadUrl)}" target="_blank" rel="noreferrer">${escapeHtml(provenance.channel)} thread ↗</a></dd></div>
      <div><dt>작성자</dt><dd>${escapeHtml(provenance.author)}</dd></div>
      <div><dt>원본</dt><dd>${escapeHtml(provenance.artifactTitle || "local playable bundle")}</dd></div>
      <div><dt>번들</dt><dd>${escapeHtml(provenance.localSource)}</dd></div>
    `;
  }

  function startGame() {
    const game = state.currentGame;
    if (!game) return;
    resetPlayer();
    playerPoster.hidden = true;
    playerLoading.hidden = false;
    playerShell.dataset.state = "loading";
    $("#player-label").textContent = `${game.title} 준비 중…`;

    const iframe = document.createElement("iframe");
    iframe.title = `${game.title} 게임 플레이어`;
    iframe.src = game.entryUrl;
    iframe.allow = "fullscreen; gamepad";
    iframe.setAttribute("sandbox", "allow-scripts allow-pointer-lock");
    iframe.setAttribute("referrerpolicy", "no-referrer");
    iframe.setAttribute("data-testid", "game-frame");
    frameHost.append(iframe);

    state.loadTimer = window.setTimeout(() => showPlayerError("게임 준비 신호를 받지 못했습니다. 정적 번들을 다시 검증해 주세요."), 12000);
  }

  function showPlayerReady() {
    clearTimeout(state.loadTimer);
    playerLoading.hidden = true;
    playerError.hidden = true;
    frameHost.hidden = false;
    playerShell.dataset.state = "ready";
    $("#reload-game").disabled = false;
    $("#fullscreen-game").disabled = false;
    $("#player-label").textContent = `${state.currentGame.title} 실행 중 · F 키 또는 전체화면 버튼`;
  }

  function showPlayerError(message) {
    clearTimeout(state.loadTimer);
    playerLoading.hidden = true;
    frameHost.hidden = true;
    playerError.hidden = false;
    playerShell.dataset.state = "error";
    $("#player-error-message").textContent = message;
    $("#player-label").textContent = "게임 실행 오류";
  }

  function route() {
    const hash = window.location.hash.replace(/^#\/?/, "") || "home";
    if (hash === "home") {
      showView("home");
      state.currentGame = null;
      resetPlayer();
      document.title = "PLAY//GROUND — 놀이터 아케이드";
      return;
    }
    if (hash === "not-found") {
      showView("not-found");
      return;
    }
    if (hash.startsWith("game/")) {
      const game = byId.get(hash.slice(5));
      if (!game) {
        showView("not-found");
        document.title = "게임을 찾을 수 없음 — PLAY//GROUND";
        return;
      }
      showView("detail");
      fillDetail(game);
      document.title = `${game.title} — PLAY//GROUND`;
      window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }
    showView("not-found");
  }

  searchInput.addEventListener("input", () => { state.query = searchInput.value; renderCatalog(); });
  $("#reset-search").addEventListener("click", () => {
    state.query = ""; state.genre = "전체"; searchInput.value = ""; renderFilters(); renderCatalog(); searchInput.focus();
  });
  $("#back-button").addEventListener("click", () => { window.location.hash = "home"; });
  $("#start-game").addEventListener("click", startGame);
  $("#retry-game").addEventListener("click", startGame);
  $("#reload-game").addEventListener("click", startGame);
  $("#fullscreen-game").addEventListener("click", async () => {
    const iframe = frameHost.querySelector("iframe");
    if (!iframe) return;
    try { await iframe.requestFullscreen(); } catch { showPlayerError("이 브라우저에서 전체화면을 시작할 수 없습니다."); }
  });
  window.addEventListener("message", (event) => {
    const iframe = frameHost.querySelector("iframe");
    if (!iframe || event.source !== iframe.contentWindow || event.data?.source !== "playground-game") return;
    if (event.data.type === "ready") showPlayerReady();
    if (event.data.type === "error") showPlayerError(event.data.detail?.message || "게임 내부 오류가 발생했습니다.");
  });
  window.addEventListener("hashchange", route);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !detailView.hidden && !document.fullscreenElement) window.location.hash = "home";
  });

  if (!catalog || games.length === 0) {
    gameGrid.innerHTML = "<p>카탈로그를 불러오지 못했습니다.</p>";
    return;
  }
  $("#catalog-version").textContent = catalog.version;
  setHero();
  renderFilters();
  renderCatalog();
  route();
})();
