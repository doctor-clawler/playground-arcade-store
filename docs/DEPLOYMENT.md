# 배포와 커스텀 도메인

## 현재 구성

- Repository: https://github.com/doctor-clawler/playground-arcade-store
- Existing Pages URL: https://doctor-clawler.github.io/playground-arcade-store/
- Desired public URL: https://loa.mibstudio.top/
- Source: `site/`, `games/`, `config/games.json`
- Build output: ignored `public/`
- Project root: `/Volumes/BigHugeMemory/works/playground-arcade-store`
- Slack: `#loa` (`C0C1P2B8LSV`)

2026-09-14: 정식 프로젝트 승격, 기존 저장소 이력 유지, 12개 게임 소스 편입. Porkbun 브라우저 세션이 로그아웃되어 DNS 변경은 사용자 로그인 대기 중입니다. 준비된 목표 설정은 `config/domain.json`입니다. 이 문서의 목표 URL 자체는 연결 성공 증거가 아닙니다.

## 도메인 연결 절차

1. Porkbun 계정의 `mibstudio.top` DNS에서 `CNAME loa → doctor-clawler.github.io` (TTL 600)를 추가합니다. `transit`, apex, wildcard 등 다른 레코드는 유지합니다. 정확히 `loa`에 충돌 레코드가 있으면 내용을 검토하고 요청 대상만 교체합니다.
2. GitHub Pages의 custom domain을 `loa.mibstudio.top`으로 지정합니다. 기존 계정 `doctor-clawler`와 저장소를 유지합니다. 커스텀 Actions 배포는 CNAME 파일만 추가하는 것으로 설정되지 않습니다.
3. 인증서 발급 후 HTTPS 강제를 켭니다. DNS 전파/인증서 대기는 성공으로 보고하지 않습니다.
4. 권한 있는 상태에서 `node scripts/connect-domain.mjs --apply`로 DNS를 먼저 검증하고 Pages 설정을 적용할 수 있습니다. HTTPS 준비가 되지 않으면 설정 상태를 남기고 종료하며, 준비 후 같은 명령을 다시 실행합니다.
5. 공개 root/catalog 및 모든 게임 entry/asset을 HTTP로 검사하고 실제 플레이를 확인합니다. 기존 Pages URL의 redirect도 점검합니다.

DNS 참고: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site

## 반복 배포

`npm ci && npm run build && npm test && npm run validate` 후 현재 main upstream에 commit/push합니다. `.github/workflows/pages.yml`이 소스부터 재빌드해 GitHub Pages에 배포합니다. `gh run list --repo doctor-clawler/playground-arcade-store`로 해당 commit workflow를 확인합니다.

미리보기는 `npm run build:web`을 사용합니다. 내부망과 Tailscale 주소는 helper가 현재 중앙 할당과 HTTP probe로 출력하는 값을 사용합니다. 포트를 문서의 과거 값으로 고정하지 않습니다.
