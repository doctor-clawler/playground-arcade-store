# Tooth Runner Design

The game is a small browser canvas survival game. The player starts in a lobby, can open a side shop, can start a 60 second run, and returns to the lobby after winning or being eaten.

Core rules:
- A tooth chases the player during a run.
- If the tooth touches the player without invincibility, the run ends and the player returns to the lobby.
- Surviving 60 seconds ends the run and awards 100 won.
- The shop sells permanent invincibility for 10000 won and hammer access for 2000 won.
- When hammer access is owned, a hammer appears at the bottom of the play area. The player can pick it up and hit a nearby tooth to earn 100 won.
- Coins appear during a run, including three large visible 50-won coins as soon as the run starts. The lobby also shows large preview coins so the player can identify them before playing. When the player gets close to a coin, the coin disappears and awards 50 won.
- The main money, character, tooth, and coin visuals are mirrored into a DOM overlay above the canvas. This keeps the important game state visible on browsers where some canvas drawing APIs fail.
- A top button saves money/items and returns to the lobby if pressed during a run.

Implementation:
- `src/gameCore.js` owns deterministic state transitions for tests and browser runtime.
- `src/main.js` owns DOM input, canvas rendering, localStorage saves, and `window.render_game_to_text` / `window.advanceTime`.
- `tests/gameCore.test.mjs` verifies the requested money, death, survival, and item rules.
