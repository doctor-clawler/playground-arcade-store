# OpenSpec

이 프로젝트의 변경 명세는 `changes/`, 검증 후 반영된 명세는 `specs/`에서 관리합니다.

일반 구현 요청은 공통 `openspec-workflow` 스킬로 명세·구현·검증까지 이어갑니다. 계획만 요청하면 계획 단계에서 마칩니다. 작은 수정이나 읽기 전용 질문에 새 명세를 강제하지 않습니다. 기존 `AGENTS.md`와 프로젝트 SSOT를 먼저 따릅니다.

Codex에서 명시적으로 사용할 때: `$openspec-workflow`, 계획만 작성하려면 `$openspec-propose`, 기존 계획 구현은 `$openspec-apply-change`, 대조 검증은 `$openspec-verify-change`. Grok은 `/openspec-*`, Antigravity는 `/opsx-*` 워크플로를 제공합니다. Slack에서는 등록되지 않은 slash command 대신 “OpenSpec으로 … 구현해줘”처럼 일반 메시지로 요청합니다.

[공통 운영 안내](/Volumes/BigHugeMemory/works/_ops/docs/openspec.md)를 참고합니다. 설치 자체는 제품 기능 전체의 명세화나 실제 기능 검증을 의미하지 않습니다.
