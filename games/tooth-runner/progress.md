Original prompt: 이 게임은 도망치는 게임이야 이빨이 쫓아오는데 피하면돼 먹히면 죽고 로비로 돌아가 1분동안 살아남으면 100원을줘 1분이 지나면 게임이 끝나 로비에서는 아이템을 살 수 있어 옆에있는 상점버튼을 누르면 아이템을 살수 있어 1무적 10000원 2 이빨을 죽이세요(망치를 엇어서 이빨을 때리면 100원을 받아 망치는 화면 맨아래있어)2000원 맨 위에 저장하고 나가기 버튼 만들어줘

Progress:
- Added RED tests for survival reward, tooth death, invincibility purchase, and hammer kill reward.
- Implemented a small HTML/CSS/JS canvas game under `tooth-runner`.
- Verified `npm test` passes with 4 tests.
- Verified browser gameplay with the web game Playwright client; latest screenshot is `output/web-game/shot-2.png`.
- Verified browser shop purchase, 60 second survival reward, and save-exit flow with Playwright.
- Started durable preview session `lan-preview-tooth-runner-8807`.
- Added coins that appear during runs and award 50 won when the player gets close.
- Verified coin spawn screenshot at `output/web-game-coins-dodge/shot-0.png`.
- Verified browser coin collection flow; collection screenshot is `output/web-game-coins-dodge/collection.png`.
- Adjusted coin visibility after user reported coins were hard to see: runs now start with 3 larger 50-won coins placed across the arena, and `index.html` cache-busts the module/CSS URLs.
- Verified immediate coin visibility at `output/web-game-coins-visible-2/shot-0.png` and collection at `output/web-game-coins-visible-2/collection.png`.
- Reworked coin visibility again after the user still could not see coins: lobby now shows large preview coins, gameplay coins use a larger radius, bright rings, and cache-busted `v=coins-visible-3` asset URLs.
- Verified lobby coin screenshot at `output/web-game-coins-visible-3-lobby/shot-0.png`, gameplay coin screenshot at `output/web-game-coins-visible-3-playing/shot-0.png`, and collection screenshot at `output/web-game-coins-visible-3-collection/collection.png`.
- Reworked visibility after the user reported character/tooth/money/coins were all missing: added a DOM visual layer for money, character, tooth, and coins so the important visuals remain visible even if canvas drawing fails, added canvas `roundRect`/`ellipse` fallbacks, and moved preview to fresh port 18036 with `v=always-visible-5`.
- Verified desktop/mobile/no-roundrect-ellipse screenshots in `output/web-game-always-visible-5-qa/`, web game client state in `output/web-game-always-visible-5-client/`, and mobile coin collection at `output/web-game-always-visible-5-qa/mobile-collection.png`.

TODO:
- None for the current request.
