# Bugfix Report Template

> **이 저장소의 SSOT 사본이다.** 버그 리포트를 쓸 때는 개인 글로벌 사본이 아니라 이 파일을 쓴다.
> 글로벌 사본은 개인 머신에만 있어 팀에 전파되지 않기 때문에 저장소로 내렸다.
> 자동 라우팅: "버그 리포트 작성·제출" 시 로드. 디버그 절차 자체는 글로벌 `error-recovery.md`.

---

## 1. Repro Steps

최소 안정 재현 절차. 환경·데이터·실행 명령 명시.

- 환경 (Node / 의존성 버전 / 배포 환경):
- 입력·데이터:
- 실행 명령 또는 요청 (메서드 · 경로 · 바디):
- 재현율 (always / sometimes / 첫 1회만 등):

## 2. Expected vs Actual

| | Expected | Actual |
|---|---|---|
| 동작 | | |
| 응답 (status · code) | | |
| 로그·상태 | | |

## 3. Root Cause

증상이 아닌 근본 원인.

- 원인 위치 (`파일:라인`):
- 왜 그렇게 동작했는가:
- 왜 지금까지 발견 안 됐는가 (테스트 갭 분석):

## 4. Fix

- 변경 요약:
- 변경 파일 목록:
- 핵심 diff 또는 의사코드:
- 의도적으로 손대지 않은 인접 영역과 그 이유:

## 5. Regression Coverage

- 추가한 테스트 (unit / E2E):
- 이 테스트가 동일 회귀를 잡는가 — **방어를 걷어내면 실제로 깨지는지** 확인했는가:
- 에러 경로면 **status·code 를 정확히 고정**했는가 (느슨한 기대는 방어 유무를 못 잡는다):
- 픽스 전 실패 확인 → 픽스 후 통과 확인:

## 6. Verification Performed

- 실행한 명령과 결과 (`pnpm ci:core` 등):
- 수동 재현 절차를 다시 돌렸는가:
- 변경 심볼 grep 전수 확인 (0건이면 **양성 대조**로 검산했는가):

## 7. Risk / Rollback Notes

- 운영 환경 영향:
- 롤백 절차 (revert 가능 여부, feature flag 등):
- 남은 항목의 게이트 분류 (머지 전 차단 / 배포 직후 조치 / 후속):

## 8. Lessons

- 동일 패턴의 다른 위치에 같은 버그가 있는가:
- `docs/lessons.md` 에 4필드로 추가할 항목 · 라우팅 표에 추가할 행:

---

> Definition of Done: 글로벌 DoD + [`CLAUDE.md`](../../CLAUDE.md) 의 "Definition of Done (이 프로젝트)" 6항목.
