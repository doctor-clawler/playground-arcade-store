Original prompt: 아래 규칙에 맞는 앱을 만들어 줘
3명의 플레이어에게 각자 단어를 제시한다. 한명에게는 다른 단어를 나머지 플레이어에게는 같은 단어를 제시한다.
단 제시되는 단어들이 비슷한 성격을 가져야 한다.
예를 들어 수박과 딸기, 파스타와 피자같이

## Progress

- Added the initial failing tests for the round-generation rules.
- Implemented the round-generation module with similar-category word pairs.
- Added the static web UI for a three-player hidden-word reveal flow.
- Verified desktop and mobile browser flows through Playwright.
- Added a test-first update for configurable player counts.
- Verified 5-player desktop and mobile flows.
- Expanded similar-category word-pair candidates to 10,000 and added session history exclusion.
- Verified two consecutive browser rounds do not reuse words.

## TODO

- No open TODOs.
