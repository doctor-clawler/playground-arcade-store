# 배포와 커스텀 도메인

## 현재 구성

- Repository: https://github.com/doctor-clawler/playground-arcade-store
- Previous Pages URL: https://doctor-clawler.github.io/playground-arcade-store/
- Public URL: https://loa.mibstudio.top/
- Source: `site/`, `games/`, `config/games.json`
- Build output: ignored `public/`
- Project root: `/Volumes/BigHugeMemory/works/playground-arcade-store`
- Slack: `#loa` (`C0C1P2B8LSV`)

2026-09-14: 정식 프로젝트 승격, 기존 저장소 이력 유지, 12개 게임 소스 편입. Chrome 자동완성과 Gmail의 새 기기 인증으로 Porkbun 로그인을 완료하고 GitHub Pages custom domain과 `CNAME loa → doctor-clawler.github.io` (TTL 600)를 적용했습니다. Porkbun 관리 화면, authoritative DNS, Cloudflare resolver에서 반영을 확인했습니다. 기존 apex, wildcard, `transit` 레코드는 유지했습니다.

2026-09-14 19:16 KST: GitHub DNS 검사 정상, 인증서 `approved`, HTTPS 강제 활성화. 공개 HTTPS root/catalog와 86개 runtime 파일은 모두 HTTP 200입니다. HTTP 주소와 이전 GitHub Pages 주소는 모두 `https://loa.mibstudio.top/`으로 301 이동합니다. 카탈로그는 `2026.09.14.1`, 12개 게임입니다. `.nojekyll`과 `_headers`는 배포 메타데이터로 리소스 검사에서 제외합니다.

## 도메인 연결 절차

1. GitHub Pages의 custom domain을 먼저 `loa.mibstudio.top`으로 지정합니다: `gh api --method PUT repos/doctor-clawler/playground-arcade-store/pages -f cname=loa.mibstudio.top`. 다른 custom domain이 이미 지정되어 있다면 교체 전에 확인합니다. 기존 계정과 저장소를 유지합니다. 커스텀 Actions 배포는 CNAME 파일만 추가하는 것으로 설정되지 않습니다.
2. Porkbun 계정의 `mibstudio.top` DNS에서 `CNAME loa → doctor-clawler.github.io` (TTL 600)를 추가합니다. `transit`, apex, wildcard 등 다른 레코드는 유지합니다. 정확히 `loa`에 충돌 레코드가 있으면 내용을 검토하고 요청 대상만 교체합니다.
3. 인증서 발급 후 HTTPS 강제를 켭니다. DNS 전파/인증서 대기는 성공으로 보고하지 않습니다.
4. `node scripts/connect-domain.mjs --apply --wait`로 HTTPS 강제 설정과 공개 root/catalog 검증을 완료합니다. 인증서 발급은 30초 간격으로 최대 15분 기다립니다. 시간 초과는 exit 2, 인증/API/카탈로그 오류는 exit 1이며 성공으로 처리하지 않습니다. 인자 없이 실행하면 읽기 전용입니다. 초기 상태의 `--apply`는 GitHub hostname을 먼저 설정한 뒤 DNS가 준비되지 않으면 `waiting_dns`로 알리므로, Porkbun DNS 변경은 위 2단계에서 별도로 처리해야 합니다.
5. 공개 root/catalog 및 모든 게임 entry/asset을 HTTP로 검사하고 실제 플레이를 확인합니다. 기존 Pages URL의 redirect도 점검합니다.

DNS 참고: https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site

## 반복 배포

`npm ci && npm run build && npm test && npm run validate` 후 현재 main upstream에 commit/push합니다. `.github/workflows/pages.yml`이 소스부터 재빌드해 GitHub Pages에 배포합니다. `gh run list --repo doctor-clawler/playground-arcade-store`로 해당 commit workflow를 확인합니다.

미리보기는 `npm run build:web`을 사용합니다. 내부망과 Tailscale 주소는 helper가 현재 중앙 할당과 HTTP probe로 출력하는 값을 사용합니다. 포트를 문서의 과거 값으로 고정하지 않습니다.
