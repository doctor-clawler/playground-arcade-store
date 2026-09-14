# Neon Lane Dodger

하이퍼캐주얼 웹게임 — 3개 레인 사이를 이동하며 네온 장애물을 피합니다.

## 플레이

- 모바일: 화면 탭(레인 선택) / 좌우 스와이프
- 데스크톱: 클릭, `←` `→`, `A` `D`
- 시작·재시작: 버튼 또는 `Space` / `Enter`
- 최고 점수: `localStorage` 키 `neonLaneDodger.highScore`

## 파일

| 파일 | 역할 |
|------|------|
| `index.html` | 셸·오버레이 UI |
| `styles.css` | 반응형 네온 UI |
| `gameCore.js` | 순수 로직 (테스트 가능) |
| `game.js` | 렌더·입력·루프 |
| `tests/smoke.test.mjs` | 자동 smoke 테스트 |

## 테스트

```bash
node tests/smoke.test.mjs
```

외부 의존성 없음 (순수 HTML/CSS/JS + Node 내장 테스트).
