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
    highScore: core.loadHighScore(window.localStorage),
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
      state = core.update(state, dt, { storage: window.localStorage });
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
