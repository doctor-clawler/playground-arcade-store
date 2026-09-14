Original prompt: "이 기획서 참고해서 모바일게임 만들어 줘" with Slack PDF attachment "타이쿤이 좋겠어.PDF".

## Notes

- PDF summary: mobile tycoon for elementary players with a magical snack shop mood. Core loop is ingredient collection -> snack crafting -> customer service/sales -> collection/upgrades.
- IP safety: implemented an original "기묘한 과자점" prototype instead of using the referenced original title or characters directly.
- Stable implementation target: `/Volumes/BigHugeMemory/works/playground/magic-candy-tycoon-mobile-20260620`.
- Required test hooks added: `window.render_game_to_text()` and `window.advanceTime(ms)`.

## Current Prototype Scope

- Shop screen with customer dilemma, shelf, cat helpers, stats, and thief mission.
- Garden collection mini-game with falling ingredients and rubbable bushes.
- Crafting screen with three recipes and cauldron stirring.
- Service screen with snack choice, caution sticker choice, and sales result.
- Growth screen with upgrades and solved-customer story collection.

## Verification

- `node --check game.js` passed.
- Playwright game client passed the main loop: craft first snack -> choose caution sticker -> sell successfully. Final state: coins 42, sales 1, next customer visible.
- Mobile Playwright sanity covered shop, garden collection, bush rub, and growth screen. No console/page errors recorded.
- Preview verified by helper on LAN `http://192.168.219.121:8793/` and private Tailscale `http://100.111.114.76:8793/`.
