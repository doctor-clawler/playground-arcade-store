/**
 * Neon Lane Dodger — Node smoke / logic tests (no external deps).
 * Run: node tests/smoke.test.mjs
 */

import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${msg}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${msg}`);
  }
}

function assertEq(a, b, msg) {
  assert(Object.is(a, b), `${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);
}

// --- File presence smoke ---
console.log("\n[files]");
for (const f of ["index.html", "styles.css", "game.js", "gameCore.js"]) {
  const p = path.join(root, f);
  assert(fs.existsSync(p), `${f} exists`);
  assert(fs.statSync(p).size > 100, `${f} non-trivial size`);
}

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert(html.includes("gameCore.js"), "index loads gameCore.js");
assert(html.includes("game.js"), "index loads game.js");
assert(html.includes("btn-start"), "start button present");
assert(html.includes("btn-restart"), "restart button present");
assert(html.includes("overlay-gameover"), "gameover overlay present");

// --- Load core via CommonJS ---
console.log("\n[core logic]");
const core = require(path.join(root, "gameCore.js"));

assert(core.LANE_COUNT === 3, "3 lanes");
assert(typeof core.createState === "function", "createState export");
assert(typeof core.update === "function", "update export");

let state = core.createState({ width: 360, height: 640 });
assertEq(state.status, "menu", "initial status menu");
assertEq(state.lane, 1, "starts center lane");
assertEq(state.score, 0, "initial score 0");

// start
state = core.startGame(state);
assertEq(state.status, "playing", "startGame -> playing");
assertEq(state.lane, 1, "reset to center");
assertEq(state.obstacles.length, 0, "cleared obstacles");

// move lanes
state = core.moveLane(state, -1);
assertEq(state.lane, 0, "move left to lane 0");
state = core.moveLane(state, -1);
assertEq(state.lane, 0, "clamp left");
state = core.moveLane(state, 1);
state = core.moveLane(state, 1);
assertEq(state.lane, 2, "move right to lane 2");
state = core.moveLane(state, 1);
assertEq(state.lane, 2, "clamp right");

// setLane / laneFromX
state = core.setLane(state, 1);
assertEq(state.lane, 1, "setLane center");
assertEq(core.laneFromX(10, 360), 0, "tap left third");
assertEq(core.laneFromX(180, 360), 1, "tap middle third");
assertEq(core.laneFromX(350, 360), 2, "tap right third");

// difficulty
assert(core.getSpeed(0) === core.BASE_SPEED, "base speed at 0");
assert(core.getSpeed(100) > core.getSpeed(0), "speed rises with score");
assert(core.getSpeed(9999) === core.MAX_SPEED, "speed caps at MAX");
assert(core.getSpawnInterval(100) < core.getSpawnInterval(0), "spawn faster with score");
assert(core.getSpawnInterval(9999) >= 280, "spawn interval floor");

// memory storage mock
const mem = (() => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
  };
})();
core.saveHighScore(mem, 42);
assertEq(core.loadHighScore(mem), 42, "highScore localStorage roundtrip");
assertEq(core.loadHighScore({ getItem: () => "nope" }), 0, "invalid highScore -> 0");

// update spawns obstacles
state = core.startGame(core.createState({ width: 360, height: 640, highScore: 42 }));
let rngCalls = 0;
const fixedRng = () => {
  rngCalls += 1;
  return 0.5;
};
for (let i = 0; i < 20; i++) {
  state = core.update(state, 50, { storage: mem, rng: fixedRng });
}
assert(state.obstacles.length > 0, "obstacles spawn over time");
assert(rngCalls > 0, "spawn used rng");
assertEq(state.status, "playing", "still playing after short run");

// score increases when obstacle exits bottom
state = {
  ...core.startGame(core.createState({ width: 360, height: 200 })),
  obstacles: [{ id: 99, lane: 0, y: 500 }],
  lane: 2,
};
const scoreBefore = state.score;
state = core.update(state, 16, { storage: mem, rng: () => 0 });
assert(state.score > scoreBefore, "score +1 when obstacle exits");
assert(!state.obstacles.some((o) => o.id === 99), "passed obstacle removed");

// collision -> gameover + high score
state = core.startGame(core.createState({ width: 360, height: 640, highScore: 5 }));
const pr = core.playerRect(state);
state = {
  ...state,
  score: 12,
  lane: 1,
  obstacles: [{ id: 7, lane: 1, y: pr.y }],
};
state = core.update(state, 16, { storage: mem, rng: () => 0 });
assertEq(state.status, "gameover", "collision ends game");
assert(state.highScore >= 12, "highScore updated on gameover");
assertEq(core.loadHighScore(mem), state.highScore, "highScore persisted");

// no collision different lane
state = core.startGame(core.createState({ width: 360, height: 640 }));
state = {
  ...state,
  lane: 0,
  obstacles: [{ id: 1, lane: 2, y: core.playerRect(state).y }],
};
state = core.update(state, 16, { storage: mem, rng: () => 0 });
assertEq(state.status, "playing", "no collision other lane");

// moveLane ignored when not playing
state = { ...state, status: "menu", lane: 1 };
const frozen = core.moveLane(state, 1);
assertEq(frozen.lane, 1, "move ignored in menu");

// rectsOverlap
assert(
  core.rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }),
  "overlap true"
);
assert(
  !core.rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 5, h: 5 }),
  "overlap false"
);

// pickSpawnLane avoids full wall when possible
const nearTop = [
  { id: 1, lane: 0, y: 10 },
  { id: 2, lane: 1, y: 20 },
];
const picked = core.pickSpawnLane(nearTop, () => 0);
assertEq(picked, 2, "prefers free lane when two blocked");

// global attach when loaded
assert(typeof globalThis.NeonLaneCore === "object", "globalThis.NeonLaneCore attached");

console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
console.log("SMOKE OK");
