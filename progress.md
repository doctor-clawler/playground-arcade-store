Original prompt: `/Volumes/BigHugeMemory/works/playground`에서 #놀이터의 기존 브라우저 게임 3개 이상을 선별해 provenance가 있는 반응형 웹게임 스토어를 end-to-end로 구현하고, manifest 자동 등록·안전한 iframe 플레이·브라우저 검증·LAN/Tailscale 또는 외부 배포·commit/push까지 완료한다.

## Visual contract

- Visual thesis: 크림색 종이, 검정 잉크, 형광 코랄로 만든 편집형 독립 아케이드 카탈로그. 실제 게임 캡처가 가장 큰 시각 요소다.
- Content plan: 전체 화면 대표작 → 검색/장르 카탈로그 → 선별 기준 → 게임 상세/플레이어/조작법/provenance.
- Interaction thesis: 대표작 등장 모션, 카탈로그 이미지 줌과 화살표 회전, hash 기반 상세 전환과 플레이 로딩 상태.
- Desktop target: 1440×1000, mobile target: 390×844. 44px 이상 탭 타깃, 첫 화면 내 CTA, 가로 overflow 금지.
- Anti-patterns: 작은 카드 모자이크, 임의 외부 이미지, 장식용 대시보드, 게임 위에 과한 UI 오버레이.

## 2026-07-14

- Slack #놀이터와 로컬 결과물을 교차 확인해 `tooth-runner`, `mystic-snack-tycoon`, `magic-candy-tycoon-mobile-20260620`을 선별했다.
- manifest, 정적 bundle sync, catalog 생성, path/CSP/resource validator, add-game/publish 스크립트를 추가했다.
- 반응형 홈/검색/장르 필터/상세/sandbox iframe/전체화면/404 UI를 구현했다.
- 세 게임의 web-game client 실플레이에서 상태 갱신은 확인됐고, game-side CSP의 `frame-ancestors` meta 경고와 DOM 게임 inline style 차단을 발견했다. `frame-ancestors`는 호스팅 header로 이동하고 game-side style만 허용하도록 수정했다.
- 스토어 첫 Playwright 점검에서 store meta의 같은 `frame-ancestors` 경고와 favicon 404를 발견해 header 전용으로 이동하고 self-hosted favicon을 추가했다.
- 상세→플레이 검증은 성공했지만 Chromium이 `allow-scripts + allow-same-origin` sandbox 탈출 가능성을 경고했다. module 게임을 classic bundle로 변환하고 safe storage fallback을 넣어 same-origin 권한을 제거했다.

## Completion status

- Build, store tests, 세 원본 게임 test/check, static bundle validation 통과.
- Playwright 홈→검색/필터→상세→플레이→게임 입력→전체화면과 404 통과.
- 1440×1000, 390×844 화면 직접 검토. console error/warning 0, 누락 리소스 0, 모바일 overflow 없음.
- Durable LAN `192.168.219.121:18035`와 Tailscale `100.111.114.76:18035` HTTP 응답 확인.
- Local git commit 생성. GitHub Pages 배포와 public URL 검증만 남음.
