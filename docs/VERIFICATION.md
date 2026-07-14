# Verification record

Date: 2026-07-15 KST

## Static and source checks

```text
npm run build     PASS — 12 games, catalog 2026.07.15.1
npm test          PASS — 8/8 store/publish safety tests
npm run validate  PASS — 12 game bundles, CSP/bridge/resources present
tooth-runner      PASS — 4/4 core tests
merge restaurant PASS — 5/5 core tests
magic candy       PASS — node --check game.js
neon lane         PASS — 51/51 source smoke tests
character custom PASS — 5/5 source tests
hospital night   PASS — 7/7 source tests + Vite build
korean word chain PASS — 16/16 source tests
camping town     PASS — 11/11 source tests + Vite build
word spy party   PASS — 7/7 source tests
3D building      PASS — Vite build
gomdori escape   PASS — Vite build
```

## Runtime checks

- `develop-web-game` client와 Playwright: 12개 publish bundle 모두 게임 상태 생성, console/page error 0.
- 이빨 피하기: 시작→이동 입력, `mode=playing`, 타이머 감소, 플레이어 위치 갱신.
- 스파게티 머지: iframe 플레이어 ready, 장바구니 클릭 후 1번 칸 밀가루 생성.
- 기묘한 과자점: 제조→스티커→판매 흐름, `coins=42`, `sales=1`, 다음 손님 갱신.
- 네온 레인: 시작 후 레인 이동, 주행 화면과 점수 상태 갱신.
- 자정의 증언: 역할 확인 후 `mode=day`, 추리 진행 상태 진입.
- 캐릭터 꾸미기: `mode=customize`, 캐릭터 부위 선택 상태 갱신.
- 병원 야간 접수: 시작 후 `running=true`, 3D 접수 화면 입력 반응.
- 끝말잇기: `mode=playing`, 99,690단어 사전 로드 및 입력 가능.
- 솔바람 캠핑 타운: `mode=camp`, 3D 캠핑장 이동 입력 반응.
- 우리 중 스파이: `phase=reveal`, 역할 공개 흐름 진입.
- 3D 건축 놀이터: `mode=building`, 건축 패널 열림과 블록 배치 입력 반응.
- 곰돌이의 집: `mode=stage1`, 3D 스테이지 시작 및 이동 입력 반응.
- Store desktop 1440×1000: 홈→퍼즐 필터→상세→플레이→게임 클릭→전체화면 진입. `document.fullscreenElement`는 game iframe.
- Store mobile 390×844: 카탈로그 전용 홈/최소 상세/플레이 ready, horizontal overflow false, 장르 filter 44px.
- 모바일 플레이 버튼: `fullscreenElement=#player-shell`, immersive class/body lock true. 닫기 후 fullscreen/class/body lock 모두 false.
- 데스크톱 플레이 버튼: 자동 fullscreen/class 적용 안 됨.
- 공개 catalog: provenance, Slack URL, artifact ID, local path 없음.
- Portrait player: iframe 783px, inner document/body 783px로 일치해 세로 게임 하단 잘림 없음.
- Search: `과자` 검색 시 기묘한 과자점만 남음.
- 404: 없는 game id는 전용 오류 화면으로 라우팅.
- Network: store와 game 정적 요청 모두 HTTP 200, missing resource 없음.
- Expanded mobile catalog: 390×844에서 12/12 상세→플레이→첫 상호작용 통과.
- Console/network: 12개 iframe의 error 0, failed request 0.

## Visual evidence

- `output/visual-qa/store-desktop-home.png`
- `output/visual-qa/store-desktop-detail.png`
- `output/visual-qa/store-desktop-player.png`
- `output/visual-qa/store-fullscreen-player.png`
- `output/visual-qa/store-mobile-home.png`
- `output/visual-qa/store-mobile-detail.png`
- `output/visual-qa/store-mobile-player.png`
- `output/visual-qa/expanded-mobile-home.png`
- `output/visual-qa/expanded-<game-id>.png` (12 games)
- `output/visual-qa/expanded-report.json`

Screenshots were opened and visually inspected. No overlap, clipping, horizontal overflow, unreadable text, or broken game frame remained at the checked viewports.

## Preview proof

- Listener: `TCP *:18035 (LISTEN)`
- LAN: `http://192.168.219.121:18035/` — HTTP response verified
- Tailscale: `http://100.111.114.76:18035/` — HTTP response verified, private tailnet only
- Durable session: `ops-web-preview-playground`

## Public deployment

- GitHub Pages: `https://doctor-clawler.github.io/playground-arcade-store/` (catalog `2026.07.15.1`, deploy verification pending current push)
- Repository: `https://github.com/doctor-clawler/playground-arcade-store`
