# Development Workflow

## Purpose

이 프로젝트에서 OpenSpec 명세와 구현·검증을 함께 관리하면서 기존 작업 계약을 보존한다. 제품 기능 전체의 명세는 실제 변경에 맞추어 점진적으로 작성한다.

## Requirements

### Requirement: Preserve requested scope
에이전트는 사용자 요청의 계획 또는 구현 범위를 SHALL 유지한다. 명세 작성만으로 이미 받은 구현 권한을 축소하지 않는다.

#### Scenario: Implementation is requested
- **WHEN** 사용자가 기능 구현이나 수정을 요청한다
- **THEN** 필요한 명세를 작성하고 구현·검증·요청된 전달까지 계속 진행한다

#### Scenario: Planning only is requested
- **WHEN** 사용자가 조사 또는 계획만 요청한다
- **THEN** 요청한 조사·계획 범위에서 마치고 제품 코드를 변경하지 않는다

### Requirement: Preserve project authority and work
에이전트는 프로젝트 지침과 SSOT, 현재 브랜치 및 다른 작업의 변경을 SHALL 보존한다.

#### Scenario: A specification affects existing behavior
- **WHEN** 기존 기능 변경의 명세를 작성한다
- **THEN** 현재 코드·문서·데이터 원본을 대조하고 확인 사실과 제안을 구분한다

### Requirement: Verify completion with matching evidence
에이전트는 실제 변경에 맞는 검증을 SHALL 수행하며 구조 검사를 기능 동작 증거로 사용하지 않는다.

#### Scenario: OpenSpec validation passes
- **WHEN** 명세의 구조 검증이 통과한다
- **THEN** 코드·UI·빌드·배포 검증은 필요한 범위에서 별도로 수행하고 미검증 경계를 기록한다

### Requirement: Keep unfinished changes active
에이전트는 사용자 요청의 필수 작업이나 전달이 남아 있으면 변경을 SHALL 활성 상태로 유지한다.

#### Scenario: An external gate remains
- **WHEN** 구현은 끝났지만 요청된 배포 또는 외부 검증이 차단되어 있다
- **THEN** 차단 근거를 기록하고 전체 완료로 archive하지 않는다
