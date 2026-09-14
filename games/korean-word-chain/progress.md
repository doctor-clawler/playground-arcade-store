Original prompt: 끝말잇기 게임이야 로비에 플레이 버튼이 있어 누르면 시작돼 먼저 플레이어가 단어를 말하고 그 다음 AI상대방이 끝 말을 이어 단어를 말해 국어 사전에 있는 단어 만 할 수 있어 최대한 쉬운 단어로 대답해줘 그리고 더 이상 끝말을 이을 수 없는 사람이 져 플레이어가 이기면 2,000원을 받고 로비로 돌아가 지면 로비로 돌아가

## Notes

- Build as a self-contained browser game under `korean-word-chain/`.
- Use an in-game curated easy Korean word dictionary, not an external API.
- Validate with unit tests first, then browser playtest and screenshots.
- RED: `npm test` fails because `src/game.js` does not exist yet.
- GREEN: `npm test` passes 9 game-rule tests after adding `src/game.js`.

## Visual contract

- Mood: bright Korean notebook tabletop, simple and friendly.
- Hierarchy: lobby title and Play button first; during play, required starting syllable and input first, history second.
- Layout: one centered game surface, no nested cards, responsive down to mobile width.
- Motion: small entrance, button press feedback, new word bubble reveal; respect reduced motion.
- Visual QA note: win lobby initially showed the previous-game bubble list clipped near the bottom. Replace lobby history with a compact last-word line.

## Verification

- `npm test`: 10 game-rule tests pass.
- `PREVIEW_URL=http://192.168.219.121:8770/ npm run smoke`: desktop/mobile visual smoke passes and writes screenshots under `output/visual-qa/word-chain/`.
- Skill client run: `output/web-game-client/shot-0.png` and `state-0.json` confirm the Play button reaches playable state.
- Dictionary bug fix: root cause was `isDictionaryWord` checking only the AI easy-word list. Added a larger player dictionary and kept AI answers restricted to the easy list.
- Regression: `컴퓨터` is accepted and AI answers `터널`; `없는말` is still rejected.
- AI fake-word bug fix: root cause was bridge words in `EASY_KOREAN_WORDS` such as `란초`, `릎받이`, `름름이`, `례절`, `람보`, and `을지로`.
- Regression: `계란`, `무릎`, `이름`, `차례`, `사람`, and `마을` now make AI lose instead of answering with a made-up connector word.
- Follow-up difficulty fix: `컴퓨터` previously made AI answer `터널`, leaving only `널빤지` for the player. Added `터치` as the easy AI answer and show a playable hint such as `예: 치킨` after AI speaks.
- Immediate player-loss fix: `chooseAiWord` now skips AI answers that would leave the player with zero valid follow-up words. If all AI answers are dead ends, AI loses instead of answering and immediately declaring the player stuck.
- Regression: all player dictionary words were scanned; cases where AI answers and immediately makes the player lose are now `0`. Browser smoke covers `박수 -> 수건 -> 예: 건물`.
- User example fix: `기차 -> 차도 -> 도시` is now a covered flow. AI prioritizes `차도`, then `도시` is accepted and AI answers `시계`.
- UI history fix: the word history now scrolls to the latest word after each render so the newest AI answer remains visible.
- Korean dictionary expansion fix: `dictionary-ko` is generated into `src/generatedDictionary.js` and merged into the player validation dictionary. `가격` is now accepted as a dictionary word, while `없는말` is still rejected.
- AI difficulty guard: AI answers still come only from `EASY_KOREAN_WORDS`; the generated dictionary is for player validation and player follow-up checks. AI also requires a curated easy player hint before choosing an answer, so it avoids forcing obscure one-word continuations.
- Performance guard: first-syllable indexes are built for the easy, curated, and full player dictionaries so generated dictionary lookups do not scan ~100k words on every turn.
- Recovery note: automatic recovery for source task `4421` found a stale worker lease, not a project runtime failure. The interrupted work was resumed from the generated dictionary integration point.
- Verification after recovery: `npm test` passes 16 tests; `PREVIEW_URL=http://192.168.219.121:8765/ npm run smoke` passes and includes `가격` plus `기차 -> 차도 -> 도시 -> 시계`; `web_game_playwright_client.js` confirms the Play button reaches playing state with `dictionarySize: 99690`.
- Preview after recovery: durable static preview session `lan-preview-korean-word-chain-8765`; LAN `http://192.168.219.121:8765/`; Tailscale `http://100.111.114.76:8765/`; both returned HTTP 200 in `curl -I`.

## TODO

- `dictionary-ko` includes some conjugated or non-noun forms. If strict noun-only play is required, add a filtered noun dictionary or an official dictionary API.
- A future version could add difficulty levels or 두음법칙 handling.
