# PLAY//GROUND

Slack `#놀이터`에서 완성된 브라우저 게임만 선별해 실행하는 정적 웹게임 스토어입니다. 카탈로그/검색/장르 필터/최소 상세/모바일 조작 안내/sandbox iframe 플레이어를 제공하며, 모바일에서는 플레이와 동시에 전체화면을 요청합니다.

## 현재 카탈로그

| 게임 | 장르 | 원본 폴더 | Slack 원문 |
| --- | --- | --- | --- |
| 이빨 피하기 | 액션 | `../tooth-runner` | `1782631822.044179` |
| 스파게티 머지 | 퍼즐 | `../mystic-snack-tycoon` | `1781944250.863389` |
| 기묘한 과자점 | 타이쿤 | `../magic-candy-tycoon-mobile-20260620` | `1781943705.366939` |
| 네온 레인 | 액션 | `../grok-neon-dodge` | `1784010522.377909` |
| 자정의 증언 | 추리 | `../mafia-midnight` | `1783786273.560769` |
| 캐릭터 꾸미기 | 꾸미기 | `../character-grow-game` | `1783670910.580109` |
| 병원 야간 접수 | 어드벤처 | `../hospital-ward-3d` | `1783420221.809679` |
| 끝말잇기 | 퍼즐 | `../korean-word-chain` | `1783236450.587479` |
| 솔바람 캠핑 타운 | 시뮬레이션 | `../camping-game-3d` | `1782622128.113739` |
| 우리 중 스파이 | 파티 | `../word-spy-party` | `1782527003.909989` |
| 3D 건축 놀이터 | 샌드박스 | `../3d-building-game-20260620` | `1781948232.826259` |
| 곰돌이의 집 | 어드벤처 | `../gomdori-game` | `1781937188.132039` |

상세 링크와 첨부 ID는 [docs/PROVENANCE.md](docs/PROVENANCE.md)에 있습니다.

## 빌드와 검증

```bash
npm run build
npm test
npm run validate
```

`npm run build`는 `config/games.json`을 읽어 다음을 수행합니다.

1. allowlist에 있는 정적 게임 파일만 `public/games/<id>/`로 복사
2. 게임 entry에 제한적 CSP와 store ready/error bridge 삽입
3. 실제 플레이 캡처를 썸네일로 복사
4. `public/catalog.json`과 `public/catalog.js` 자동 생성
5. 누락 파일, 경로 탈출, 외부 entry URL, CSP/bridge를 검증

## 새 게임 추가

1. `docs/game-spec.example.json`을 복사해 실제 값, 모바일 조작법, 내부 Slack provenance를 채웁니다.
2. 실행합니다.

```bash
npm run add-game -- --spec ./my-game.json
```

같은 ID, 허용 경로 밖 파일, 허용되지 않은 확장자, 누락 entry/thumbnail은 실패합니다. 추가 후 전체 publish bundle까지 자동으로 다시 생성·검증합니다.
publish는 단일 실행 lock을 잡고 staging 디렉터리에서 전체 bundle 검증을 마친 뒤 `public/`과 manifest를 교체합니다. 잘못된 spec, symlink 경로 탈출, 누락 파일로 실패하면 기존 카탈로그와 배포 bundle은 그대로 유지됩니다. 프로세스가 교체 중 중단되면 다음 publish가 남은 backup과 manifest/catalog 일치 여부를 확인해 자동 복구합니다.

## 재배포

```bash
npm run build
```

정적 호스팅의 publish directory는 `public/`입니다. `_headers`를 지원하는 호스팅에서는 CSP, referrer, permissions, cache 정책도 같이 반영됩니다. GitHub Pages처럼 `_headers`를 해석하지 않는 호스팅에서도 HTML meta CSP는 유지됩니다.
현재 GitHub Pages 배포에서는 `_headers`의 응답 헤더가 적용되지 않으므로 `frame-ancestors`와 세밀한 cache header는 호스팅 경계입니다. 실제 게임 격리는 meta CSP와 `sandbox`/same-origin 차단으로 유지됩니다.

## 실행 경계

- 스토어는 `public/index.html`과 `public/assets/`에서 동작합니다.
- Slack URL, 작성자, artifact ID, 로컬 경로는 내부 manifest/docs에만 보존하고 공개 catalog와 사용자 UI에는 내보내지 않습니다.
- 각 게임은 `public/games/<id>/` 아래 독립 번들입니다.
- iframe은 `sandbox="allow-scripts allow-pointer-lock"`, `referrerpolicy="no-referrer"`, 명시적 fullscreen 권한으로 실행됩니다. same-origin 권한은 주지 않습니다.
- 게임 URL과 썸네일에는 manifest version query가 붙습니다.
- ready/error bridge가 로딩 완료와 런타임 오류를 부모 스토어에 전달합니다.
- DOM 게임의 런타임 배치 때문에 game-side CSP에만 inline style을 허용합니다. store-side CSP에는 inline 예외가 없습니다.
- module 기반 원본은 publish 단계에서 classic 단일 번들로 변환합니다. 브라우저 저장소를 쓰는 게임은 opaque sandbox에서 세션 메모리 fallback을 사용하므로 저장 상태는 해당 플레이 세션 안에서만 유지됩니다.
- Vite/Three.js 빌드는 CSS를 game entry에 인라인하고 root-relative asset을 정규화하며, classic script를 `defer`로 실행해 opaque sandbox에서도 동작하게 합니다.
- game-side CSP의 network scheme 허용은 opaque sandbox origin에서 로컬 정적 자원을 읽기 위한 것입니다. entry의 외부 URL은 build validator가 거부하고 `connect-src`는 차단됩니다.

## 반복 호스팅 스킬

새 후보 조사부터 등록, 모바일 QA, preview, 배포까지 반복할 때 전역 스킬 `$host-playground-games`를 사용합니다.

```bash
node ~/.codex/skills/host-playground-games/scripts/scan_candidates.mjs \
  --root /Volumes/BigHugeMemory/works/playground
```
