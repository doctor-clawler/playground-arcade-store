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
