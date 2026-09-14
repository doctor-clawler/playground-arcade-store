Original prompt: 이 게임은 병원 게임이야. 커다란 맵에 병원이 있고, 카운터 안에서 손님을 기다리고, 손님을 클릭해 대화한 뒤 잘가!/들어가를 고른다. 이상 행동은 반복 발화, 플레이어 추적 눈동자, 카운터 문을 열고 공격하는 행동이다. 부적은 화면 아래에 있고 이상한 손님을 쫓아내며, 정상 손님에게 쓰면 "뭐에요?!" 후 사라진다. 진료실은 1,2,3번이고 의사가 치료하면 환자가 "고마워요!"라고 말한다. 체력은 100이고 괴물 환자 공격은 5 피해, 시간 경과로 회복한다. 모든 것은 3D, 1인칭이다.

## Progress

- 2026-07-07: Started self-contained Vite/Three.js prototype in `hospital-ward-3d/`.
- 2026-07-07: Added simulation tests first for room assignment, suspicious behavior handling, talisman behavior, attack/hold banish, treatment, and health regeneration.
- 2026-07-07: Added Three.js first-person hospital scene with counter, 3 exam rooms, doctors, guests, dialogue HUD, health HUD, talisman button, and `render_game_to_text`/`advanceTime` hooks.
- 2026-07-07: Verified `npm test`, `npm run build`, desktop Playwright smoke, mobile Playwright snapshot, and LAN/Tailscale static preview.
- 2026-07-07: Added visible movement pad and pointer-lock fallback drag look. Verified mobile movement smoke moves player from z -3.2 to z -4.39, with desktop/mobile smoke passing afterward.
- 2026-07-07: Improved stare monster eyes with visible sclera/pupils and player-tracking pupil offsets. Verified eye-tracking smoke changes pupilOffsetX from 0 to -0.058 after player movement.
- 2026-07-07: Fixed guest click hit detection so labels, eyes, and other child meshes resolve to the parent guest. Added label-click smoke that opens dialogue successfully.

## TODO

- Add richer movement/mobile controls if this prototype graduates from playground.
- Add authored 3D models or GLB assets if the placeholder capsule characters need final art direction.
