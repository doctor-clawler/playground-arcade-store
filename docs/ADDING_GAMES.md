# 게임 추가와 유지보수

정식 경로는 `/Volumes/BigHugeMemory/works/playground-arcade-store`, 작업 채널은 `#loa`입니다.
기존 12개 게임은 `games/<id>/`에 소스와 테스트를 편입했습니다. 놀이터 원본은 보존하며 이후 수정은 편입본에서 합니다.

## 새 게임 추가

1. 놀이터 게임의 플레이 루프, 터치 입력, 자체 테스트를 확인하고 실제 화면을 썸네일로 선택합니다.
2. `docs/import-game.example.json`을 복사합니다. `projectPath`와 `thumbnailSource`는 놀이터 루트 상대 경로입니다.
3. `projectFiles`에 검토한 소스/설정/테스트/lockfile만 적습니다. 단순 HTML 게임은 `game.bundleFiles`에 공개 실행 파일만 적습니다. 파일명 목록 자동 확장은 하지 않습니다.
4. Vite 게임은 `game.build: {"kind":"vite"}`를 쓰고 package.json/package-lock.json 및 소스를 포함합니다. `npm ci`와 `npm run build`가 실행되므로 프로젝트 설치/빌드 스크립트를 먼저 검토합니다. 고정 hash 파일 목록은 빌드가 자동 계산합니다.
5. 포털에서 `npm run import-game -- --spec <spec.json>`을 실행합니다. 새 ID만 허용하며 기존 게임을 덮어쓰지 않습니다. 복사/빌드/검증 실패 시 새 소스와 썸네일을 정리하고 기존 manifest/public을 유지합니다. 중단 후 `.local/import.lock`이 남으면 실행 프로세스가 종료됐는지 확인한 뒤 이 작업 소유 lock만 정리합니다.
6. `scripts/verify-browser.mjs`에 새 게임의 첫 플레이 동작을 추가합니다. `npm run build:web` 후 출력된 URL로 `PORTAL_BASE_URL=<URL>/ npm run test:browser`를 실행하고 스크린샷을 확인합니다.
7. source/doc/config/test 변경만 commit/push합니다. GitHub Actions가 재빌드 후 배포합니다. 공개 root, catalog, 게임 entry/asset 응답을 확인합니다.

## 기존 게임 업데이트

`games/<id>/`를 직접 수정하고 manifest의 게임 version 및 storeVersion을 올립니다. `npm run build`는 잠근 의존성으로 빌드합니다. Vite 해시가 바뀌어도 manifest를 수동 변경할 필요가 없습니다. `npm run sync`는 이미 빌드된 소스에서 포털만 다시 생성합니다.

원본 놀이터 프로젝트를 삭제하거나 자동 덮어쓰지 않습니다. 새 원본 변경을 가져오려면 diff를 검토해 편입본에 적용합니다.

## 실행·배포 범위

현재 지원: 자체 완결 HTML/CSS/JS, 단일 엔트리 Vite/Three.js. Unity/Defold/WASM, 외부 API/서버 의존 게임은 별도 호환성 작업이 필요합니다. same-origin sandbox 권한을 추가하지 않습니다. [브라우저 저장](BROWSER_SAVES.md)에 따라 게임 상태 adapter를 등록하고 실제 진행 후 재접속·브라우저 재실행 복원을 검증합니다. 기존 `localStorage` 접근만으로 현재 판 전체가 저장된다고 가정하지 않습니다.

`site/`와 `games/`가 소스이고 `public/`은 생성 결과입니다. GitHub Pages workflow는 checkout에서 npm ci → build → test → validate → deploy를 실행합니다. `/build web`은 프로젝트의 `scripts/build_web.sh`를 통해 빌드와 private LAN/Tailscale preview를 제공합니다. 공개 배포는 검증된 commit을 main upstream에 push할 때 실행됩니다.
