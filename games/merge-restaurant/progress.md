Original prompt: "이 기획서 참고해서 모바일게임 만들어 줘" with Slack PDF attachment "타이쿤이 좋겠어.PDF".

## Notes

- PDF summary: mobile tycoon for elementary players with a magical snack shop mood. Core loop is ingredient collection -> snack crafting -> customer service/sales -> collection/upgrades.
- IP safety: implemented an original "기묘한 과자점" prototype instead of using the referenced original title or characters directly.
- Implementation target: static mobile-first web game in `/Volumes/BigHugeMemory/works/playground/mystic-snack-tycoon`.
- Required test hooks added: `window.render_game_to_text()` and `window.advanceTime(ms)`.

## Current Prototype Scope

- Shop screen with customer dilemma, shelf, cat helpers, stats, and thief mission.
- Garden collection mini-game with falling ingredients and rubbable bushes.
- Crafting screen with three recipes and cauldron stirring.
- Service screen with snack choice, caution sticker choice, and sales result.
- Growth screen with upgrades and solved-customer story collection.

## TODO

- Run browser playtest with Playwright client.
- Inspect screenshots for mobile layout, text fit, and interaction readability.
- Serve through verified LAN/Tailscale preview URL.

## 2026-06-20 Merge Restaurant Update

- Added the current requested restaurant merge game on the same static entry point.
- Rules implemented: 7x7 board, basket-generated flour, same-item drag merge, flour -> noodles -> tomato -> sauce -> spaghetti, three customers, selected spaghetti delivery for 500 won.
- Added pure core rules in `src/core.mjs` and tests in `tests/core.test.mjs`.
- Browser hooks are available: `window.render_game_to_text()` and `window.advanceTime(ms)`.
- Verification passed:
  - `npm test`: 4 tests passed.
  - `node --check src/app.mjs && node --check src/core.mjs`: passed.
  - Web-game Playwright client loaded the LAN preview, clicked basket, captured screenshots, and wrote text state.
  - Focused Playwright flow clicked basket 16 times, dragged all merge stages to spaghetti, clicked customer, and confirmed money became 500.
- Preview server:
  - screen session: `lan-preview-mystic-snack-tycoon-8778`
  - LAN: `http://192.168.219.121:8778/`
  - Tailscale: `http://100.111.114.76:8778/`

## Merge Restaurant TODO

- Existing `game.js` from the older canvas prototype is still preserved but no longer used by `index.html`.
- Add more dishes or customer order variety only after this core loop is accepted.

## 2026-06-20 Merge Control Fix

- User reported merging felt unreliable.
- Reproduced the issue with a mobile Playwright flow: basket twice, tap cell 0, tap cell 1 did not create noodles.
- Changed controls so basket creation no longer auto-selects the new flour.
- Added tap-to-merge: select one ingredient, then tap a matching ingredient to merge into the tapped target.
- Kept drag-to-merge and made pointer-down avoid changing selection before the click/tap handler runs.
- Verification passed:
  - `npm test`: 4 tests passed.
  - `node --check src/app.mjs && node --check src/core.mjs`: passed.
  - Mobile tap merge flow: flour + flour -> noodles at tapped target.
  - Mobile drag full flow: spaghetti served, money became 500, no console/page errors.

## 2026-06-20 Varied Customer Orders

- User requested customers should not all ask for spaghetti.
- Changed customer wants to rotate through crafted items: noodles, tomato, sauce, spaghetti.
- Flour is excluded from customer orders because it is the base basket ingredient.
- Added core coverage for varied initial orders.
- Verification passed:
  - `npm test`: 5 tests passed.
  - `node --check src/app.mjs && node --check src/core.mjs`: passed.
  - Mobile browser flow confirmed initial customer wants are noodles, tomato, sauce.
  - Mobile browser flow served noodles to the first customer for 500 won with no console/page errors.
