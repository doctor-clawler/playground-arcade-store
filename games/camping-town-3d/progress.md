Original prompt: 이 게임은 켐핑 게임이야. 큰 네모난 캠핑장, 수영장, 매점/사장님/상품, 텐트 15개 이름 짓기와 내부 꾸미기, 동물우리와 시간 이벤트, 마시멜로우 파티, 주민 6명, 화장실 상호작용, 귀여운 동물, 실제 계절 배경, 3D 화면.

## Progress

- Started a self-contained Vite + Three.js prototype in `camping-game-3d/`.
- Chosen scope: playable 3D prototype with real click interactions, timer events, DOM menus, and simulation tests.
- Added simulation tests first and confirmed RED via missing module.
- Implemented simulation state; `npm test` passes 8 tests.
- Implemented Three.js campsite scene, DOM HUD/menu interactions, tent interior decoration, toilet interior, night/party events, animal/resident animations.
- Verified `npm run build` and `npm test`.
- Served `dist/` through LAN preview helper on port 8806.
- Ran game Playwright client and inspected screenshots in `output/web-game-fixed/`.
- Ran custom browser smoke for freezer purchase, owner dialogue, tent claim/decor, night event, and marshmallow flow; final screenshot is `output/interaction-final.png`.
- Ran mobile viewport smoke; screenshot is `output/mobile.png`.
- Added on-screen side direction controls for touch/click movement.
- Verified direction controls with build/test, game Playwright client, pointer-hold movement smoke, desktop screenshot `output/dpad-touch.png`, and mobile screenshot `output/mobile-dpad.png`.
- Reworked the campsite toward a cozy life-sim town feel without copying specific IP: added `솔바람 캠핑 타운`, plaza, paths, cottages, notice board, clickable residents, resident friendship/talk counts, town mood, daily collection task, and collectible clovers/shells/star pieces.
- Verified cozy-town pass with `npm test` 11 tests, `npm run build`, game Playwright client, resident dialogue + daily task browser smoke, desktop screenshot `output/cozy-town-interactions.png`, and mobile screenshot `output/cozy-town-mobile.png`.
- Polished the town quality pass: added clouds, animated water, night lamp glow, benches, flower clusters, stone paths, picnic blanket, pennant lines, cottage details, cuter resident/player proportions, and a resident card dialogue UI.
- Verified polish pass with `npm run build`, `npm test` 11 tests, game Playwright client screenshots in `output/web-game-polish/`, resident card screenshot `output/polished-resident-dialogue.png`, mobile screenshot `output/polished-mobile.png`, and night-party screenshot `output/polished-night-party.png`.
- Adjusted the latest request without adding new gameplay/features: rebuilt the existing people into larger chibi-style town characters with distinct hair variants, bigger heads, visible face sprites, outfit accents, shoes, and slightly larger in-world scale.
- Verified the people-only polish with `npm run build`, `npm test` 11 tests, game Playwright client screenshots in `output/web-game-people-polish-final3/`, and close-up screenshot `output/people-closeup-final3.png`.

## TODO

- Next improvement: replace coordinate-based smoke with stable in-game test hooks if this prototype becomes a durable project.
- Next improvement: add save/load for claimed tents and furniture if persistence is desired.
- Next improvement: add persistent player inventory/gifts and a daily reset calendar if the cozy-town loop continues.
