# Plan Template

> **이 저장소의 SSOT 사본이다.** 계획서를 쓸 때는 개인 글로벌 사본이 아니라 이 파일을 쓴다.
> 글로벌 사본은 개인 머신에만 있어 팀에 전파되지 않기 때문에 저장소로 내렸다.
> 자동 라우팅: "계획 / 플랜 / 설계 / 마이그레이션 / 3+ 단계 작업" 시 로드.

작업 시작 전 이 골격을 채워 사용자에게 제시하거나 `docs/tasks/*.md` 로 옮긴다.

---

## Goal & Acceptance Criteria

- 무엇을 달성하는가:
- 끝났다는 것을 어떻게 아는가 (수용 기준):
- 비목표 (이번 작업에서 안 하는 것):

## Existing Patterns / Source of Truth

- 참고할 기존 구현:
- 따를 컨벤션: (`.claude/rules/code-patterns.md` 의 해당 절)
- 충돌 가능성 있는 영역:

## Design (Minimal Approach + Key Decisions)

- 접근 요지:
- 주요 결정과 대안 (why this, why not that):
- 트레이드오프:

## Implementation Steps (Thin Vertical Slices)

- [ ] Step 1 — (가장 작은 검증 가능 단위):
- [ ] Step 2 —
- [ ] Step 3 —

각 step 은 implement → test → verify 사이클 1회를 포함한다.

## Tests / Verification

- [ ] 추가·수정할 테스트:
- [ ] 실행할 명령: 기본은 **`pnpm ci:core`**(lint → test → build). PR 직전 **`pnpm ci:all`**
- [ ] 수동 재현 절차 (해당 시):
- [ ] 검증 못 하는 경로와 그 이유:

## Risk & Rollback

- 위험 요소:
- 롤백 전략 (feature flag, 격리 커밋, config switch 등):
- 운영 영향 (해당 시):

## Verification Story (작업 완료 후 채움)

- 무엇이 어떻게 바뀌었는가:
- 어떻게 동작을 확인했는가:

## Lessons (해당 시)

- 발견한 함정·새 규칙 → `docs/lessons.md` 에 4필드(실패 양상 / 탐지 신호 / 근본 원인 / 예방 규칙)로 append 할 항목:

---

> Definition of Done: 글로벌 DoD + [`CLAUDE.md`](../../CLAUDE.md) 의 "Definition of Done (이 프로젝트)" 6항목.
