# 브라우저 자동 저장

로그인·계정·기기 ID·서버 없이 `https://loa.mibstudio.top/`를 연 **같은 브라우저 프로필**에 저장합니다. 브라우저를 닫았다 열어도 이어 할 수 있습니다. 다른 기기·브라우저·프로필·도메인으로 동기화되지 않습니다. 사이트 데이터 삭제, 시크릿 모드 종료, 브라우저의 저장소 정리 시 사라질 수 있습니다. 이전 sandbox 세션의 메모리 데이터는 닫힌 뒤 복구할 수 없습니다.

게임 상세에서 저장 상태와 실패 이유를 확인합니다. `다시 열기`는 저장을 이어서 엽니다. `이 게임 저장 삭제`는 확인창을 거쳐 해당 게임만 초기화합니다. 같은 게임을 두 탭에서 동시에 열면 두 번째 탭을 막아 진행도 덮어쓰기를 방지합니다. 다른 게임끼리는 동시 실행할 수 있습니다.

## 게임별 범위

| 게임 ID | 저장·복원 범위 |
| --- | --- |
| tooth-runner | 돈, 구매 아이템, 현재 달리기와 남은 시간·위치 |
| merge-restaurant | 머지 보드, 손님 주문, 돈, 선택 상태 |
| mystic-candy-shop | 날짜·돈·평판, 재료·과자, 업그레이드, 제조·임무 진행 |
| neon-lane-dodger | 최고 점수, 현재 판 점수·레인·장애물 |
| mafia-midnight | 역할·생존자, 날짜·투표·대화·결과, 난수 상태 |
| character-customizer | 저장한 캐릭터와 편집 중인 캐릭터·탭 |
| hospital-night-shift | 손님·진료실·체력·부적·위치·진행 시간. 복원 후 `이어서 근무하기`로 재개하며 열린 대화창은 닫음 |
| korean-word-chain | 보유금, 현재 판 단어·턴·사용 이력·결과 |
| camping-town-3d | 돈·구매·텐트·가구·동물·주민·수집·시간대·위치. 대화창은 닫음 |
| word-spy-party | 참가자 수, 현재 라운드·확인 순서·사용 단어. 재접속 시 비밀 단어는 가림 |
| building-playground-3d | 모든 배치물·높이·회전, 카메라 위치. 만들기 메뉴는 닫음 |
| gomdori-escape-3d | 단계·아이템·코드·코인·선택·위치. 보상/문 열림 직후의 지연 전환도 복구 |

게임을 열어 두지 않은 시간은 시뮬레이션하지 않습니다. 입력 직후와 1초 간격으로 변경된 상태를 저장하고, 포털 내 이동·다시 열기는 마지막 저장 메시지 처리까지 기다립니다. 강제 종료·전원 손실 직전 아직 저장되지 않은 순간까지 보장하지는 않습니다.

## 구현 계약

- `site/assets/save-store.js`: 부모만 실제 localStorage 접근. `loa.save.v1:<stable-game-id>` 키에 schema/revision/updatedAt/checksum/entries를 하나의 레코드로 기록합니다. 버전 query가 달라져도 저장 키는 유지합니다. 게임당 512 Ki UTF-16 코드 단위, 최대 128개 키로 제한합니다.
- `scripts/game-save-bridge.js`: iframe 전용 동기 Storage 캐시와 `window.LoaSave` API. 게임 소스가 실행되기 전에 캐시를 채웁니다. 기존 getItem/setItem/removeItem/clear는 해당 게임의 영역만 접근합니다.
- `scripts/sync-games.mjs`: 모든 외부 게임 스크립트를 inert placeholder로 만들고 hydration 후 순차 실행합니다. inline JS·다중 동적 chunk는 별도 패키징 검토가 필요합니다. 게임 초기화는 이미 완료된 DOM에서도 실행해야 하며 DOMContentLoaded/load 이벤트만 기다리지 않습니다. 직접 게임 URL은 포털 상세로 연결됩니다. bridge와 게임 스크립트에는 게임 버전을 붙입니다.
- sandbox는 계속 `allow-scripts allow-pointer-lock`. parent는 현재 iframe window + 무작위 세션 nonce를 검증한 뒤 MessagePort 하나를 전달합니다. 저장 대상 ID는 parent가 정하며, 자식 메시지의 game ID를 사용하지 않습니다. 레코드 revision 및 메시지 sequence로 오래된 쓰기를 거부합니다.
- Web Locks로 게임별 단일 writer를 유지합니다. HTTPS와 Web Locks 지원 브라우저가 필요합니다. 저장 접근 거부·손상·호환되지 않는 checkpoint는 원본을 보존하고 시작을 막습니다. 실행 중 용량 부족은 마지막 저장을 유지하고 경고하며 이후 변경에서 재시도합니다. 원본을 자동 삭제하거나 메모리 저장을 영구 저장으로 표시하지 않습니다.

## 새 게임 연결

게임 상태와 UI/scene 초기화가 끝난 뒤, 첫 simulation frame 전에 한 번 등록합니다. 함수를 포함한 scene/DOM 객체 대신 재구성 가능한 plain JSON만 저장합니다. Set/Map은 배열로 변환하고 복원 시 재생성합니다. 타이머의 콜백 자체는 저장되지 않으므로 지연 전환을 데이터 상태로 처리합니다.

```js
window.LoaSave?.register({
  version: 1,
  capture: () => ({ coins: state.coins, board: state.board }),
  restore(saved) {
    if (!Number.isFinite(saved.coins) || !Array.isArray(saved.board)) {
      throw new Error("Invalid checkpoint");
    }
    state.coins = saved.coins;
    state.board = saved.board;
    render();
  },
});
```

`capture()`는 부작용이 없어야 하며 JSON 직렬화가 가능해야 합니다. 기존 저장 의미가 바뀌면 명시적인 migration을 구현하고 이전 저장 fixture로 검증합니다. 단순 catalog/game version 증가에는 checkpoint version을 바꾸지 않습니다. 공통 `restoreObject`는 기본적인 최상위 형태만 검사하므로 게임별 배열 길이·ID·유효 숫자·필수 상태 검사는 adapter에서 합니다.

`npm test`, `npm run build`, `npm run validate`, `PORTAL_BASE_URL=<url>/ npm run test:browser`, `PORTAL_BASE_URL=<url>/ npm run test:saves`를 사용합니다. save harness는 분리된 테스트 프로필에서 실제 입력 → 나가기 → 재접속 → Chromium 프로세스 재실행 → 복원 비교를 수행합니다. 타임스탬프 비교 대신 실제 adapter의 복원 직후 capture를 관찰합니다. 테스트가 공개 사용자의 저장을 건드리지 않습니다. 추가 scene harness는 저장 fixture에서 곰돌이 코드 입력→3단계·보상과 캠핑 텐트/가구의 재구성을 확인합니다.

HTTP LAN preview에서는 Web Locks가 제공되지 않으므로 브라우저 harness만 `https://loa-preview.test/` 요청을 해당 preview로 라우팅합니다. 이는 로컬 빌드의 기능 검증이며 실제 TLS 검증이 아닙니다. 공개 HTTPS 검증은 라우팅 없이 실제 배포 주소에서 다시 실행합니다.
