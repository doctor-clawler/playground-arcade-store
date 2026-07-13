# Verification record

Date: 2026-07-14 KST

## Static and source checks

```text
npm run build     PASS — 3 games, catalog 2026.07.14.2
npm test          PASS — 8/8 store/publish safety tests
npm run validate  PASS — 3 game bundles, CSP/bridge/resources present
tooth-runner      PASS — 4/4 core tests
merge restaurant PASS — 5/5 core tests
magic candy       PASS — node --check game.js
```

## Runtime checks

- `develop-web-game` client: 세 publish bundle 모두 `render_game_to_text` 상태 생성, console/page error 0.
- 이빨 피하기: 시작→이동 입력, `mode=playing`, 타이머 감소, 플레이어 위치 갱신.
- 스파게티 머지: iframe 플레이어 ready, 장바구니 클릭 후 1번 칸 밀가루 생성.
- 기묘한 과자점: 제조→스티커→판매 흐름, `coins=42`, `sales=1`, 다음 손님 갱신.
- Store desktop 1440×1000: 홈→퍼즐 필터→상세→플레이→게임 클릭→전체화면 진입. `document.fullscreenElement`는 game iframe.
- Store mobile 390×844: 홈/상세/플레이 ready, horizontal overflow false, 장르 filter 44px.
- Portrait player: iframe 783px, inner document/body 783px로 일치해 세로 게임 하단 잘림 없음.
- Search: `과자` 검색 시 기묘한 과자점만 남음.
- 404: 없는 game id는 전용 오류 화면으로 라우팅.
- Network: store와 game 정적 요청 모두 HTTP 200, missing resource 없음.
- Console: desktop/mobile store와 iframe에서 error 0, warning 0.

## Visual evidence

- `output/visual-qa/store-desktop-home.png`
- `output/visual-qa/store-desktop-detail.png`
- `output/visual-qa/store-desktop-player.png`
- `output/visual-qa/store-fullscreen-player.png`
- `output/visual-qa/store-mobile-home.png`
- `output/visual-qa/store-mobile-detail.png`
- `output/visual-qa/store-mobile-player.png`

Screenshots were opened and visually inspected. No overlap, clipping, horizontal overflow, unreadable text, or broken game frame remained at the checked viewports.

## Preview proof

- Listener: `TCP *:18035 (LISTEN)`
- LAN: `http://192.168.219.121:18035/` — HTTP response verified
- Tailscale: `http://100.111.114.76:18035/` — HTTP response verified, private tailnet only
- Durable session: `ops-web-preview-playground`

## Public deployment

- GitHub Pages: `https://doctor-clawler.github.io/playground-arcade-store/` (catalog `2026.07.14.2`)
- HTTPS root, tooth game entry, and merge game bundle returned HTTP 200 after the Pages workflow completed.
- Repository: `https://github.com/doctor-clawler/playground-arcade-store`
