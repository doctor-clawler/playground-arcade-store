Original prompt: 곰돌이라는 게임. 진입하면 건너뛰기 가능한 튜토리얼 만화가 나오고, 버려진 곰돌이가 빨간 눈으로 살아나 아이를 쫓는 장면 뒤 설명 화면이 나온다. 1단계는 진한 보라색 인형의 집에서 서랍 속 망치를 찾아 벽을 뚫고 탈출한다. 2단계는 높은 계단 뒤 3개의 넓은 방에서 곰돌이를 피해 코드 3, 7, 8을 찾아 출입문 코드를 맞춘다. 기둥 뒤나 케비넷에 숨을 수 있다. 3단계는 감옥의 아이를 바닥 열쇠로 구하고 칼을 받은 뒤 45초 제한시간 안에 나간다. 이후 곰돌이를 죽이거나 살리는 선택을 하고 열쇠를 받아 하얀 방의 상자에서 5000코인을 얻은 뒤 첫 화면으로 돌아간다.

## Notes

- Built as a self-contained canvas web game in this folder.
- Violence is shown as non-graphic cartoon action.
- Implemented `index.html`, `styles.css`, and `game.js`; `node --check game.js` passed.
- Ran web-game smoke client, full Playwright flow, and rule checks for hiding and wrong code behavior.
- Verified both final branches: spare path reaches chest/5000 coins/menu return, kill path reaches the reward room.
- Added visible touch D-pad and 조사 button after user reported they could not move; verified touch movement on mobile viewport and reran the full flow.
- Increased stage 2 bear patrol: it now walks from room 3 into room 2 faster, while still chasing faster on sight. Verified it reaches room 2 and full flow still completes.
- Added cache-busting query strings to CSS/JS links so the preview reloads the latest controls and bear AI.
- Replaced D-pad text arrows with CSS-drawn triangle icons; verified icon controls still move the player on mobile.
- Prevented long-press copy/select UI on touch controls with touch-callout/user-select/contextmenu suppression and replaced the 조사 text button with a CSS icon.
- Made bear AI dumber: it patrols into room 2 but needs sustained sight before chasing, slows down while confused, and drops suspicion quickly. Verified patrol, delayed alert, and full completion flow.
- Replaced furniture label boxes with drawn furniture sprites/shapes for desks, chairs, drawers, dolls, bookshelves, cabinets, fridges, and pillars. Verified stage 1/stage 2 screenshots and full flow.
- Changed stage 3 glass-ceiling escape timer from 45 seconds to 7 seconds, removed the big first-screen title, and hides child/bear on the post-reward return menu. Verified screenshots and full flow.
- Fixed pillar hiding: pillar proximity now hides automatically across click, keyboard, and touch movement; 조사 near a pillar sets hidden true. Verified pillar hide state, screenshot, and full flow.
- Adjusted stage 2 bear patrol away from room 3: it now spends more time in room 2/left-side patrol and has shorter detection range, giving a safe window to inspect room 3 code 8. Verified room 3 code access and full flow.
- Removed child/bear drawings from the late hallway countdown and choice screens after the repeated final-screen request. Verified hallway/choice screenshots and reward flow.
- Removed the top title/explanation text from the final choice screen, leaving only the kill/spare buttons. Verified screenshot and reward transition.
- Corrected the final text removal target: restored choice-screen text and removed only the hallway countdown line "bear arrives in N seconds". Verified hallway/choice screenshots.
- Prevented mobile zoom sticking by locking viewport scale, disabling touch-action/overscroll, and preventing gesture/double-tap zoom events. Verified mobile layout and event prevention.
- Removed the hallway "문 밖으로 나왔습니다" text from both the large center label and the transition message. Verified hallway screenshot and preview version.
- Added a bottom inventory bar for held items: hammer, code pages, keys, and knife now render as icons/number cards near the bottom. Verified stage 1/2/3 screenshots and full flow.
- Converted the active preview to a Three.js first-person 3D version in `game3d.js`: rooms, furniture, bear, child, key/code interactions, 7-second glass ceiling event, choice screen, reward room, mobile D-pad/action controls, and bottom inventory overlay are now rendered/handled in 3D. Verified ES module syntax, desktop/menu/stage1 smoke, mobile stage1 screenshot, and HTTP preview URLs.
- Added a cabinet hiding overlay for the 3D version: when the player hides in a cabinet, the screen turns black and shows a drawn cabinet plus the text "케비넷에 숨었습니다" while touch controls remain usable above the overlay. Updated cache-busting query strings and verified syntax, the default web-game client, a full scripted route into stage 2 cabinet hiding, screenshots, and LAN/Tailscale HTTP preview URLs.
- Made cabinet hiding exit on direction input: while hidden in a cabinet, Arrow/WASD/touch D-pad input moves the player outside the cabinet radius and turns off the black overlay. Verified syntax, default web-game client, scripted stage 2 cabinet hide -> ArrowUp exit flow, before/after screenshots, and LAN/Tailscale HTTP preview URLs.
