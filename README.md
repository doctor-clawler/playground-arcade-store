# LOA 게임 포털

정식 프로젝트: `/Volumes/BigHugeMemory/works/playground-arcade-store` · Slack `#loa` · GitHub `doctor-clawler/playground-arcade-store`.
공개 포털: https://loa.mibstudio.top/ — HTTPS 연결 완료. 배포·도메인 운영 절차는 `docs/DEPLOYMENT.md`에서 확인합니다.

모바일에서 게임을 고르고 바로 플레이하는 정적 웹게임 포털입니다. 12개 게임 소스가 `games/<id>/`에 편입되어 놀이터 원본 없이 재빌드할 수 있습니다. 포털 화면 원본은 `site/`, 카탈로그는 `config/games.json`, 생성 배포 디렉터리는 `public/`입니다.

- 게임 추가: [docs/ADDING_GAMES.md](docs/ADDING_GAMES.md)
- 에이전트 스킬: [skills/host-playground-games/SKILL.md](skills/host-playground-games/SKILL.md)
- 배포 및 도메인: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## 현재 카탈로그

| 게임 | 장르 | 원본 폴더 | Slack 원문 |
| --- | --- | --- | --- |
| 이빨 피하기 | 액션 | `games/tooth-runner` | `1782631822.044179` |
| 스파게티 머지 | 퍼즐 | `games/merge-restaurant` | `1781944250.863389` |
| 기묘한 과자점 | 타이쿤 | `games/mystic-candy-shop` | `1781943705.366939` |
| 네온 레인 | 액션 | `games/neon-lane-dodger` | `1784010522.377909` |
| 자정의 증언 | 추리 | `games/mafia-midnight` | `1783786273.560769` |
| 캐릭터 꾸미기 | 꾸미기 | `games/character-customizer` | `1783670910.580109` |
| 병원 야간 접수 | 어드벤처 | `games/hospital-night-shift` | `1783420221.809679` |
| 끝말잇기 | 퍼즐 | `games/korean-word-chain` | `1783236450.587479` |
| 솔바람 캠핑 타운 | 시뮬레이션 | `games/camping-town-3d` | `1782622128.113739` |
| 우리 중 스파이 | 파티 | `games/word-spy-party` | `1782527003.909989` |
| 3D 건축 놀이터 | 샌드박스 | `games/building-playground-3d` | `1781948232.826259` |
| 곰돌이의 집 | 어드벤처 | `games/gomdori-escape-3d` | `1781937188.132039` |

상세 링크와 첨부 ID는 [docs/PROVENANCE.md](docs/PROVENANCE.md)에 있습니다.

## 빌드와 검증

```bash
npm ci
npm run build
npm test
npm run validate
npm run build:web
PORTAL_BASE_URL=<검증된-preview-URL>/ npm run test:browser
```

`npm run build`는 편입된 Vite 게임을 lockfile 기준으로 빌드한 뒤 정적 파일을 allowlist에 따라 패키징합니다. 게임별 CSP/ready/error bridge를 삽입하고 공개 catalog를 생성해 누락 파일·경로 탈출·외부 entry를 검증합니다. `public/`과 게임별 `dist/`는 생성 결과이므로 Git에서 제외합니다. GitHub Pages도 같은 소스 빌드를 실행합니다.

새 놀이터 게임은 `npm run import-game -- --spec <reviewed-spec.json>`으로 소스와 썸네일을 편입합니다. 이미 내부에 소스를 갖춘 게임은 `npm run add-game -- --spec <internal-game-spec.json>`으로 등록할 수 있습니다. 절차와 형식은 [게임 추가 문서](docs/ADDING_GAMES.md)를 따릅니다.

publish는 단일 실행 lock과 staging 검증 후 manifest/public을 교체합니다. 실패 시 기존 catalog를 유지합니다. 외부 provenance는 운영용 manifest/docs에만 보관합니다.

GitHub Pages는 `_headers` 파일을 적용하지 않습니다. 실제 게임 경계는 HTML meta CSP와 sandbox로 유지하며, 특수 응답 헤더가 필요한 엔진은 별도 지원 작업이 필요합니다.

## 실행 경계

- 스토어 화면은 `site/index.html`과 `site/assets/`에서 관리하고 `public/`로 빌드합니다.
- Slack URL, 작성자, artifact ID, 로컬 경로는 내부 manifest/docs에만 보존하고 공개 catalog와 사용자 UI에는 내보내지 않습니다.
- 각 게임은 `public/games/<id>/` 아래 독립 번들입니다.
- iframe은 `sandbox="allow-scripts allow-pointer-lock"`, `referrerpolicy="no-referrer"`, 명시적 fullscreen 권한으로 실행됩니다. same-origin 권한은 주지 않습니다.
- 게임 URL과 썸네일에는 manifest version query가 붙습니다.
- ready/error bridge가 로딩 완료와 런타임 오류를 부모 스토어에 전달합니다.
- DOM 게임의 런타임 배치 때문에 game-side CSP에만 inline style을 허용합니다. store-side CSP에는 inline 예외가 없습니다.
- module 기반 원본은 publish 단계에서 classic 단일 번들로 변환합니다. 게임 실행 전 저장 bridge가 부모 포털의 게임별 localStorage를 복원합니다. 로그인 없이 같은 브라우저 프로필에서 자동 저장되며, 상세 계약과 게임별 범위는 [브라우저 저장](docs/BROWSER_SAVES.md)을 참고합니다.
- Vite/Three.js 빌드는 CSS를 game entry에 인라인하고 root-relative asset을 정규화하며, classic script를 저장 복원 뒤 순서대로 실행해 opaque sandbox에서도 동작하게 합니다.
- game-side CSP의 network scheme 허용은 opaque sandbox origin에서 로컬 정적 자원을 읽기 위한 것입니다. entry의 외부 URL은 build validator가 거부하고 `connect-src`는 차단됩니다.

## 반복 호스팅 스킬

새 후보 조사부터 등록, 모바일 QA, preview, 배포까지 반복할 때 전역 스킬 `$host-playground-games`를 사용합니다.

```bash
node ~/.codex/skills/host-playground-games/scripts/scan_candidates.mjs \
  --root /Volumes/BigHugeMemory/works/playground
```
