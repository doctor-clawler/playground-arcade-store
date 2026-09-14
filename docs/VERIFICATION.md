# 2026-09-14 formal promotion verification

- Formal root `/Volumes/BigHugeMemory/works/playground-arcade-store`, existing Git history/upstream preserved. Live `_ops` DB and registry: active, Slack `#loa` (`C0C1P2B8LSV`), requesting user invited.
- All 12 catalog games have editable source and relevant tests under `games/<id>/`. All source dependencies and thumbnails resolve inside this repository. Original playground game directories retained unchanged.
- Full source build: four locked Vite builds and portal packaging passed. Hash discovery removes hand-maintained asset names. Generated `public/` and game `dist/` excluded from Git; Pages builds from source.
- Portal tests: 9 passed, including successful import followed by removal of the original, invalid import rollback, symlink/path escape and publish recovery.
- Imported game focused tests: 57 unit tests across 7 games plus 51 Neon Lane checks passed. Games without a meaningful unit suite are covered by browser play checks, not counted as unit-tested.
- Browser: 12/12 first interactions and runtime state changes, search/filter/404, 390x844 mobile and 1440x1000 desktop captures. Console/page/network errors: 0. The mobile genre-wrap defect was fixed and screenshot verified. Empty Gomdori thumbnail replaced with an actual gameplay canvas capture.
- Skill: `skills/host-playground-games` validated; user skill points to this versioned source. Candidate scanner executes successfully. Import and update workflow in `docs/ADDING_GAMES.md`.
- `scripts/build_web.sh`: build/test/validate and durable managed preview passed. Actual listener `*:23171` PID 14451, HTTP probes passed for LAN and Tailscale. This proves same-machine responses, not access from a separate device. Preview assignments are machine-local and should be re-read from helper output.
- Custom domain (19:16 KST): `loa.mibstudio.top` is configured in GitHub Pages and Porkbun (`CNAME loa -> doctor-clawler.github.io`, TTL 600). Authoritative DNS, public resolver and GitHub DNS health passed. The original apex/wildcard/transit records remain unchanged. Certificate approved and HTTPS enforced. HTTPS root/catalog and 86 runtime files returned 200; `.nojekyll` and `_headers` are hosting metadata, excluded from resource probes. HTTP and the previous Pages URL both redirect with 301 to `https://loa.mibstudio.top/`.
- Domain helper: 5 focused tests passed for read-only inspection, hostname-before-DNS setup, unrelated-domain protection, certificate waiting versus authentication failure, HTTPS verification and stale-catalog rejection. Full portal suite: 14 passed. `--apply --wait` ran against production, waited for issuance, enabled HTTPS, and verified catalog `2026.09.14.1` with 12 games.
- Custom-domain browser QA: `PORTAL_BASE_URL=https://loa.mibstudio.top/ npm run test:browser` passed all 12 first-play actions and state changes, home search/filter/404 and mobile overflow checks. Console/page/network errors: 0. HTTP, certificate and browser evidence is ignored under `output/visual-qa/domain-*.json*` and `output/visual-qa/expanded-report.json`.
- Browser artifacts are ignored under `output/visual-qa/`; public deployment must be checked against the commit workflow after push.

---

## Historical verification (2026-07)

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

- GitHub Pages: `https://doctor-clawler.github.io/playground-arcade-store/` (catalog `2026.07.15.1`)
- Pages workflow `29344695293` 성공. HTTPS catalog 12개와 12개 game entry가 모두 HTTP 200을 반환했다.
- 공개 모바일 브라우저에서 카드 12개, 곰돌이의 집 `mode=stage1`, 자동 fullscreen, console/page/network error 0을 재확인했다.
- Repository: `https://github.com/doctor-clawler/playground-arcade-store`


## 2026-09-15 browser saves (catalog 2026.09.15.1)

- `npm run build` (including camping TypeScript check), `npm test` 20 tests, `npm run validate` passed. The eight game repositories with real test commands passed their existing suites; Gomdori's placeholder test command was not counted.
- `test:browser`: all 12 games loaded, accepted their first action and changed runtime state, with no console/page/resource errors. The CSS import sanitizer now preserves styles after semicolons inside font URLs. Word-chain submission no longer attempts sandbox-blocked form navigation.
- `test:saves`: all 12 games changed real gameplay state, left/reopened the portal and restored after a Chromium process restart using the same isolated profile. Also verified whole-page reload, toolbar reopen, same-game tab exclusion, forged-message rejection, corrupt-record preservation, per-game delete isolation, denied storage, quota warning and preservation of the last save.
- Additional save fixtures verified Gomdori's keypad→stage 3 and reward resume, a named camping tent with furniture, and direct game URL routing. These fixtures test scene reconstruction, not a complete manual playthrough of each game.
- Actual mobile/desktop screenshots inspected under `output/visual-qa/saves/`: restored board/character/building, furnished tent/stage 3, save information and visible quota warning. Chromium mobile emulation; real iPhone Safari remains untested.
- Local browser tests route the verified HTTP preview bytes into an isolated HTTPS test origin for Web Locks. Public deployment verification uses the real HTTPS origin without test routing. LAN/Tailscale preview links are not TLS/browser-save evidence.
