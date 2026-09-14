# Tooth Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser game where a player dodges a chasing tooth, earns money for surviving, and buys lobby items.

**Architecture:** Keep the game rules in `src/gameCore.js` so Node tests and the browser use the same state transitions. Keep rendering and input in `src/main.js`, with a single canvas plus small DOM controls for save, start, attack, and shop.

**Tech Stack:** Plain HTML, CSS, JavaScript modules, Node's built-in test runner, and Playwright-based browser verification.

---

### Task 1: Core Rules

**Files:**
- Create: `src/gameCore.js`
- Test: `tests/gameCore.test.mjs`

- [x] Write tests for 60 second survival reward, tooth collision death, invincibility purchase, and hammer kill reward.
- [x] Run `node --test tests/gameCore.test.mjs` and observe failure before implementation.
- [x] Implement deterministic state transitions for lobby, run, shop, tooth chase, hammer pickup, attack, save/load payloads, and text rendering.

### Task 2: Browser Game

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `src/main.js`

- [x] Add a top `저장하고 나가기` button.
- [x] Add a lobby, start button, side shop button, item buttons, attack button, canvas rendering, keyboard/pointer movement, and localStorage persistence.
- [x] Expose `window.render_game_to_text` and `window.advanceTime(ms)` for automated playtests.

### Task 3: Verification

**Files:**
- Modify: `progress.md`

- [x] Run `npm test`.
- [x] Serve the directory over LAN.
- [x] Run the web game Playwright client and inspect screenshots.
- [x] Report verified LAN and Tailscale preview URLs if available.
