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
- GitHub Pages workflow 성공. 공개 HTTPS root와 game entry/bundle HTTP 200 확인.
- Goal audit에서 실패한 새 게임 spec이 manifest/public bundle을 훼손할 수 있는 publish 중간 상태를 발견했다. 전체 `public/`을 staging에서 검증한 뒤 교체하도록 바꾸고, 실패 시 기존 manifest/catalog 불변 회귀 테스트를 추가했다.
- 같은 store version을 재빌드할 때 `version.json`의 기존 `builtAt`을 유지해 검증 재실행만으로 작업 트리가 더러워지지 않게 했다.
- 후속 보안 리뷰에서 lexical path 검사로 symlink가 외부 파일을 가리킬 수 있음을 확인했다. realpath containment, 최종 symlink 거부, manifest/catalog 완전 일치 검사, 단일 publish lock과 중단 복구를 추가했다.
- 독립 시각 QA의 P2 항목을 반영해 accent를 흰색/크림 배경 모두 AA 대비가 나는 `#c5352b`로 조정하고, 모바일 장르 필터를 44px로 늘렸다. 세로 게임은 manifest orientation을 player에 전달하고 390:844 원본 비율로 frame 높이를 계산해 내부 캔버스가 잘리지 않게 했다.
- store UI 변경의 cache busting을 위해 catalog를 `2026.07.14.2`로 올리고, publish가 manifest version을 store CSS/catalog/app query에 자동 반영하며 validator가 stale query를 거부하게 했다.

## 2026-07-14 mobile-first simplification

- 사용자 피드백에 따라 기존 visual contract의 hero/브랜드/선별 설명/provenance 중심 구성을 폐기하고, 첨부 이미지의 카탈로그 한 화면을 새 source visual truth로 삼았다.
- 홈은 `오늘 뭐 하고 놀까?` 제목, 검색, 장르 필터, 게임 목록만 남겼다. 상세에서는 버전/포맷/태그/순번/만든 기록을 제거했다.
- provenance는 내부 manifest/docs에는 유지하되 공개 catalog payload에서 완전히 제거했다.
- 게임별 `mobileControls`를 manifest에 추가하고 상세에는 모바일 조작만 안내한다.
- 모바일 플레이 버튼은 player shell 전체화면을 즉시 요청하고, Fullscreen API 미지원/거부 시 동일한 화면을 CSS immersive mode로 유지한다. 닫기 버튼으로 원래 상세로 복귀할 수 있다.
