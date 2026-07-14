const __storeMemory = new Map();
const safeStorage = {
  getItem(key) { try { return window.localStorage.getItem(key); } catch { return __storeMemory.get(key) ?? null; } },
  setItem(key, value) { try { window.localStorage.setItem(key, value); } catch { __storeMemory.set(key, String(value)); } },
  removeItem(key) { try { window.localStorage.removeItem(key); } catch { __storeMemory.delete(key); } },
  clear() { try { window.localStorage.clear(); } catch { __storeMemory.clear(); } }
};

/**
 * Neon Lane Dodger — pure game logic (no DOM).
 * Browser: window.NeonLaneCore
 * Node: require("./gameCore.js") or createRequire
 */
(function (root) {
  "use strict";

  var STORAGE_KEY = "neonLaneDodger.highScore";
  var LANE_COUNT = 3;
  var BASE_SPEED = 220;
  var SPEED_PER_SCORE = 4.5;
  var MAX_SPEED = 720;
  var BASE_SPAWN_MS = 900;
  var MIN_SPAWN_MS = 280;
  var SPAWN_DECAY_PER_SCORE = 8;
  var PLAYER_Y_RATIO = 0.82;
  var OBSTACLE_H = 28;
  var PLAYER_H = 36;
  var PLAYER_W_RATIO = 0.22;
  var OBSTACLE_W_RATIO = 0.28;

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function laneCenterX(lane, width) {
    var laneW = width / LANE_COUNT;
    return laneW * lane + laneW / 2;
  }

  function createObstacle(lane, y, id) {
    return { id: id, lane: lane, y: y };
  }

  function createState(overrides) {
    overrides = overrides || {};
    return Object.assign(
      {
        status: "menu",
        lane: 1,
        score: 0,
        highScore: 0,
        elapsed: 0,
        spawnTimer: 0,
        nextObstacleId: 1,
        obstacles: [],
        width: 360,
        height: 640,
        lastDt: 0,
      },
      overrides
    );
  }

  function getSpeed(score) {
    return Math.min(MAX_SPEED, BASE_SPEED + score * SPEED_PER_SCORE);
  }

  function getSpawnInterval(score) {
    return Math.max(MIN_SPAWN_MS, BASE_SPAWN_MS - score * SPAWN_DECAY_PER_SCORE);
  }

  function loadHighScore(storage) {
    if (!storage || typeof storage.getItem !== "function") return 0;
    try {
      var raw = storage.getItem(STORAGE_KEY);
      var n = Number(raw);
      return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
    } catch (e) {
      return 0;
    }
  }

  function saveHighScore(storage, score) {
    if (!storage || typeof storage.setItem !== "function") return;
    try {
      storage.setItem(STORAGE_KEY, String(Math.max(0, Math.floor(score))));
    } catch (e) {
      /* ignore */
    }
  }

  function startGame(state) {
    return Object.assign({}, state, {
      status: "playing",
      lane: 1,
      score: 0,
      elapsed: 0,
      spawnTimer: 0,
      nextObstacleId: 1,
      obstacles: [],
    });
  }

  function moveLane(state, delta) {
    if (state.status !== "playing") return state;
    var lane = clamp(state.lane + delta, 0, LANE_COUNT - 1);
    if (lane === state.lane) return state;
    return Object.assign({}, state, { lane: lane });
  }

  function setLane(state, lane) {
    if (state.status !== "playing") return state;
    var next = clamp(Math.floor(lane), 0, LANE_COUNT - 1);
    if (next === state.lane) return state;
    return Object.assign({}, state, { lane: next });
  }

  function laneFromX(x, width) {
    if (width <= 0) return 1;
    var lane = Math.floor((x / width) * LANE_COUNT);
    return clamp(lane, 0, LANE_COUNT - 1);
  }

  function playerRect(state) {
    var pw = state.width * PLAYER_W_RATIO;
    var ph = PLAYER_H;
    var cx = laneCenterX(state.lane, state.width);
    var py = state.height * PLAYER_Y_RATIO - ph / 2;
    return { x: cx - pw / 2, y: py, w: pw, h: ph };
  }

  function obstacleRect(state, obs) {
    var ow = state.width * OBSTACLE_W_RATIO;
    var oh = OBSTACLE_H;
    var cx = laneCenterX(obs.lane, state.width);
    return { x: cx - ow / 2, y: obs.y, w: ow, h: oh };
  }

  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function pickSpawnLane(obstacles, rng) {
    var random = typeof rng === "function" ? rng : Math.random;
    var topLanes = {};
    for (var i = 0; i < obstacles.length; i++) {
      if (obstacles[i].y < 120) topLanes[obstacles[i].lane] = true;
    }
    var free = [];
    for (var L = 0; L < LANE_COUNT; L++) {
      if (!topLanes[L]) free.push(L);
    }
    var pool = free.length ? free : [0, 1, 2];
    return pool[Math.floor(random() * pool.length) % pool.length];
  }

  function endGame(state, storage) {
    var highScore = Math.max(state.highScore, state.score);
    if (highScore > state.highScore) {
      saveHighScore(storage, highScore);
    }
    return Object.assign({}, state, {
      status: "gameover",
      highScore: highScore,
      obstacles: state.obstacles,
    });
  }

  function update(state, dtMs, options) {
    options = options || {};
    if (state.status !== "playing") {
      return Object.assign({}, state, { lastDt: dtMs });
    }

    var dt = Math.min(Math.max(dtMs, 0), 50);
    var storage = options.storage;
    var rng = options.rng;

    var score = state.score;
    var elapsed = state.elapsed + dt;
    var spawnTimer = state.spawnTimer + dt;
    var nextObstacleId = state.nextObstacleId;
    var obstacles = [];
    for (var i = 0; i < state.obstacles.length; i++) {
      obstacles.push(Object.assign({}, state.obstacles[i]));
    }

    var speed = getSpeed(score);
    var dy = (speed * dt) / 1000;

    var kept = [];
    for (var j = 0; j < obstacles.length; j++) {
      var o = obstacles[j];
      o.y = o.y + dy;
      if (o.y > state.height + OBSTACLE_H) {
        score += 1;
      } else {
        kept.push(o);
      }
    }
    obstacles = kept;

    var interval = getSpawnInterval(score);
    while (spawnTimer >= interval) {
      spawnTimer -= interval;
      var lane = pickSpawnLane(obstacles, rng);
      obstacles.push(createObstacle(lane, -OBSTACLE_H, nextObstacleId++));
    }

    var next = Object.assign({}, state, {
      score: score,
      elapsed: elapsed,
      spawnTimer: spawnTimer,
      nextObstacleId: nextObstacleId,
      obstacles: obstacles,
      lastDt: dt,
    });

    var pr = playerRect(next);
    for (var k = 0; k < obstacles.length; k++) {
      if (rectsOverlap(pr, obstacleRect(next, obstacles[k]))) {
        return endGame(next, storage);
      }
    }

    return next;
  }

  function resize(state, width, height) {
    return Object.assign({}, state, {
      width: Math.max(200, Math.floor(width)),
      height: Math.max(320, Math.floor(height)),
    });
  }

  var API = {
    STORAGE_KEY: STORAGE_KEY,
    LANE_COUNT: LANE_COUNT,
    BASE_SPEED: BASE_SPEED,
    MAX_SPEED: MAX_SPEED,
    clamp: clamp,
    laneCenterX: laneCenterX,
    createState: createState,
    getSpeed: getSpeed,
    getSpawnInterval: getSpawnInterval,
    loadHighScore: loadHighScore,
    saveHighScore: saveHighScore,
    startGame: startGame,
    moveLane: moveLane,
    setLane: setLane,
    laneFromX: laneFromX,
    playerRect: playerRect,
    obstacleRect: obstacleRect,
    rectsOverlap: rectsOverlap,
    pickSpawnLane: pickSpawnLane,
    endGame: endGame,
    update: update,
    resize: resize,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = API;
  }
  root.NeonLaneCore = API;
})(typeof globalThis !== "undefined" ? globalThis : this);


/* global NeonLaneCore */
(function () {
  "use strict";

  const core = window.NeonLaneCore;
  if (!core) {
    console.error("NeonLaneCore missing — load gameCore.js first");
    return;
  }

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlayMenu = document.getElementById("overlay-menu");
  const overlayOver = document.getElementById("overlay-gameover");
  const scoreEl = document.getElementById("score");
  const highEl = document.getElementById("high-score");
  const finalScoreEl = document.getElementById("final-score");
  const finalHighEl = document.getElementById("final-high");
  const footerTip = document.getElementById("footer-tip");
  const touchZones = document.getElementById("touch-zones");

  let state = core.createState({
    highScore: core.loadHighScore(safeStorage),
  });

  let raf = 0;
  let lastTs = 0;
  let flash = 0;
  let particles = [];

  function show(el, on) {
    el.classList.toggle("hidden", !on);
  }

  function syncHud() {
    scoreEl.textContent = String(state.score);
    highEl.textContent = String(state.highScore);
  }

  function setStatusUi() {
    show(overlayMenu, state.status === "menu");
    show(overlayOver, state.status === "gameover");
    touchZones.classList.toggle("visible", state.status === "playing");
    footerTip.textContent =
      state.status === "playing"
        ? "탭 레인 · ← → · A D"
        : state.status === "gameover"
          ? "다시 도전하세요"
          : "3레인 네온 회피";
    if (state.status === "gameover") {
      finalScoreEl.textContent = String(state.score);
      finalHighEl.textContent = String(state.highScore);
    }
    syncHud();
  }

  function resizeCanvas() {
    const app = document.getElementById("app");
    const rect = app.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(200, Math.floor(rect.width));
    const h = Math.max(320, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state = core.resize(state, w, h);
  }

  function start() {
    state = core.startGame(state);
    particles = [];
    flash = 0;
    lastTs = 0;
    setStatusUi();
    if (!raf) raf = requestAnimationFrame(loop);
  }

  function spawnBurst(x, y, color) {
    for (let i = 0; i < 14; i++) {
      const a = (Math.PI * 2 * i) / 14 + Math.random() * 0.3;
      const sp = 60 + Math.random() * 120;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.45 + Math.random() * 0.25,
        color,
      });
    }
  }

  function drawBackground(w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#0d1230");
    g.addColorStop(0.55, "#070a18");
    g.addColorStop(1, "#03050c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // scanlines
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = "#00f0ff";
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 1);
    }
    ctx.restore();

    // lanes
    const laneW = w / core.LANE_COUNT;
    for (let i = 0; i <= core.LANE_COUNT; i++) {
      const x = i * laneW;
      ctx.strokeStyle = "rgba(0, 240, 255, 0.18)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // glow rails
    for (let i = 1; i < core.LANE_COUNT; i++) {
      const x = i * laneW;
      ctx.strokeStyle = "rgba(255, 43, 214, 0.12)";
      ctx.lineWidth = 6;
      ctx.shadowColor = "#ff2bd6";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // horizon glow
    const hg = ctx.createRadialGradient(w / 2, 0, 10, w / 2, 0, w * 0.7);
    hg.addColorStop(0, "rgba(139, 92, 255, 0.25)");
    hg.addColorStop(1, "rgba(139, 92, 255, 0)");
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, w, h * 0.45);
  }

  function drawPlayer(w, h) {
    const r = core.playerRect(state);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;

    // thruster
    ctx.save();
    ctx.globalAlpha = 0.55 + Math.sin(performance.now() / 80) * 0.15;
    ctx.fillStyle = "#00f0ff";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(cx - 8, r.y + r.h);
    ctx.lineTo(cx + 8, r.y + r.h);
    ctx.lineTo(cx, r.y + r.h + 14 + Math.random() * 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // body
    ctx.save();
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 18;
    const body = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    body.addColorStop(0, "#7dfff6");
    body.addColorStop(0.5, "#00d4ff");
    body.addColorStop(1, "#0077aa");
    ctx.fillStyle = body;
    roundRect(r.x, r.y, r.w, r.h, 10);
    ctx.fill();

    // cockpit
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#fff";
    ctx.beginPath();
    ctx.ellipse(cx, cy - 2, r.w * 0.18, r.h * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawObstacles() {
    for (const o of state.obstacles) {
      const r = core.obstacleRect(state, o);
      const hue = (o.id * 47) % 360;
      ctx.save();
      ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
      ctx.shadowBlur = 16;
      const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
      g.addColorStop(0, `hsla(${hue}, 100%, 70%, 0.95)`);
      g.addColorStop(1, `hsla(${(hue + 40) % 360}, 100%, 45%, 0.95)`);
      ctx.fillStyle = g;
      roundRect(r.x, r.y, r.w, r.h, 8);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  function roundRect(x, y, w, h, rad) {
    const r = Math.min(rad, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function updateParticles(dt) {
    const t = dt / 1000;
    particles = particles.filter((p) => {
      p.life -= t;
      p.x += p.vx * t;
      p.y += p.vy * t;
      p.vy += 180 * t;
      return p.life > 0;
    });
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFlash() {
    if (flash <= 0) return;
    ctx.fillStyle = `rgba(255, 59, 107, ${Math.min(0.55, flash)})`;
    ctx.fillRect(0, 0, state.width, state.height);
  }

  function loop(ts) {
    if (!lastTs) lastTs = ts;
    const dt = ts - lastTs;
    lastTs = ts;

    const prevStatus = state.status;
    if (state.status === "playing") {
      state = core.update(state, dt, { storage: safeStorage });
      if (state.status === "gameover" && prevStatus === "playing") {
        flash = 0.7;
        const pr = core.playerRect(state);
        spawnBurst(pr.x + pr.w / 2, pr.y + pr.h / 2, "#ff2bd6");
        spawnBurst(pr.x + pr.w / 2, pr.y + pr.h / 2, "#00f0ff");
        setStatusUi();
      } else {
        syncHud();
      }
    }

    if (flash > 0) flash = Math.max(0, flash - dt / 700);
    updateParticles(dt);

    const w = state.width;
    const h = state.height;
    drawBackground(w, h);
    drawObstacles();
    if (state.status !== "menu") drawPlayer(w, h);
    drawParticles();
    drawFlash();

    // subtle speed meter
    if (state.status === "playing") {
      const spd = core.getSpeed(state.score);
      const t = (spd - core.BASE_SPEED) / (core.MAX_SPEED - core.BASE_SPEED);
      ctx.fillStyle = "rgba(184, 255, 60, 0.85)";
      ctx.fillRect(12, h - 8, Math.max(4, (w - 24) * t), 3);
    }

    raf = requestAnimationFrame(loop);
  }

  function pointerToLane(clientX) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    return core.laneFromX(x, rect.width);
  }

  // Input
  document.getElementById("btn-start").addEventListener("click", start);
  document.getElementById("btn-restart").addEventListener("click", start);
  document.getElementById("btn-menu").addEventListener("click", () => {
    state = { ...state, status: "menu", obstacles: [] };
    setStatusUi();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      e.preventDefault();
      state = core.moveLane(state, -1);
    } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      e.preventDefault();
      state = core.moveLane(state, 1);
    } else if (e.key === " " || e.key === "Enter") {
      if (state.status === "menu" || state.status === "gameover") {
        e.preventDefault();
        start();
      }
    }
  });

  canvas.addEventListener(
    "pointerdown",
    (e) => {
      if (state.status !== "playing") return;
      state = core.setLane(state, pointerToLane(e.clientX));
    },
    { passive: true }
  );

  // Touch lane zones (bottom third)
  touchZones.querySelectorAll("[data-lane]").forEach((btn) => {
    btn.addEventListener(
      "pointerdown",
      (e) => {
        e.preventDefault();
        if (state.status !== "playing") return;
        state = core.setLane(state, Number(btn.dataset.lane));
      },
      { passive: false }
    );
  });

  // swipe left/right
  let swipeX = null;
  canvas.addEventListener(
    "touchstart",
    (e) => {
      if (!e.touches[0]) return;
      swipeX = e.touches[0].clientX;
    },
    { passive: true }
  );
  canvas.addEventListener(
    "touchend",
    (e) => {
      if (swipeX == null || state.status !== "playing") return;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - swipeX;
      if (Math.abs(dx) > 36) {
        state = core.moveLane(state, dx < 0 ? -1 : 1);
      } else {
        state = core.setLane(state, pointerToLane(t.clientX));
      }
      swipeX = null;
    },
    { passive: true }
  );

  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("orientationchange", () => setTimeout(resizeCanvas, 80));

  resizeCanvas();
  setStatusUi();
  raf = requestAnimationFrame(loop);
})();
