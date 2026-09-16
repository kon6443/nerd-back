# 운영 알림 Discord 연동

> 상태: **진행 중** (착수 2026-09-16)
> 발단: 사용자 요청 — 「서버 에러·알림을 Discord 로 보내고 싶다. `../bun` 프로젝트 구현을 참고해 포트/어댑터로」
> 이 문서가 이 작업의 **SSOT** 다.
> 브랜치: `fix/generation-feedback-and-hardening` (신뢰성 작업과 같은 브랜치 — 커밋은 scope 로 나눈다)

---

## 참고 프로젝트 조사 결과 (`node/bun`)

디렉터리 이름만 `bun` 이고 **실제로는 NestJS 11 + TypeORM** 이다. 런타임 고유 API 사용처가 없어 이식 장벽이 없다.

| 항목 | 그쪽 구현 | 우리가 취할 것 |
|---|---|---|
| 전송 | Webhook URL + 순수 `fetch` (`discord.service.ts:55`) | **그대로** — `discord.js` 는 그쪽에 선언만 되고 import 0건인 죽은 의존성이라 따라가지 않는다 |
| 페이로드 | `{ content }` / `{ content, embeds }`, **빈 배열이면 `embeds` 키 제거**(Discord 가 400) | 규칙 채택 |
| 에러 | 내부 `throw` → 경계에서 `catch` + 로그. 미연동은 `warn` 후 스킵 | **그대로** — 알림 장애가 도메인 API 를 죽이면 안 된다 |
| 반환형 | `notifyTeam(): void` — fire-and-forget 이 타입에 박혀 있다 | 채택 |
| 설정 | **DB 에 팀별 URL**(멀티테넌트) | ❌ 우리는 운영 알림 **한 채널** → env 하나면 된다. DB 컬럼·연동 API 3개·SSRF 검증이 통째로 불필요해진다 |
| 타임아웃 | **없음** | ❌ 추가한다 — 이 저장소는 외부 호출에 `AbortSignal.timeout` 이 규칙이다 |
| 레이트리밋 | **없음** | ❌ 대응한다 — 아래 「레플리카 3개」 |
| 오류 본문 로깅 | `throw new Error(\`... ${errorData}\`)` (`discord.service.ts:66`) | ❌ **루트 `CLAUDE.md` 「외부 API 응답 본문 로깅 금지」 위반.** 상태코드만 남긴다 |
| 테스트 | `jest.spyOn(global, 'fetch')` + 보낸 body 파싱 헬퍼 | 채택 (추가 의존성 0) |

### 레플리카 3개가 거는 제약

- **같은 사건이 3번 발송된다.** 레플리카마다 독립적으로 감지하기 때문이다. 🚫 인메모리 플래그로 막을 수 없다(루트 `CLAUDE.md` Never).
- **Discord webhook 레이트리밋은 채널 단위**라 레플리카가 나눠 쓰면 실효 여유가 1/3 이 된다.
- → **Redis `SET NX EX` 로 중복을 억제한다.** 첫 레플리카만 보내고 TTL 동안 나머지는 건너뛴다.
- → **Redis 가 죽으면 보낸다(fail-open).** 장애 알림이 Redis 장애 때문에 사라지는 것이 최악이다.

---

## 무엇을 보낼 것인가 (현업 기준 + 이 프로젝트 추천)

### 원칙 — 「사람이 지금 행동해야 하는가」

알림의 유일한 기준이다. 아니면 로그로 간다. 이 선을 넘기면 **알림 피로(alert fatigue)** 가 오고, 그러면 사람이 알림을 읽지 않게 되어 **진짜 장애를 놓친다.** 알림은 많을수록 좋은 것이 아니라, 많아질수록 쓸모가 없어진다.

모든 알림은 네 가지를 답해야 한다: **무엇이 / 어디서 / 얼마나 / 다음에 무엇을 해야 하는가.**

### 보낸다

| 등급 | 무엇 | 왜 |
|---|---|---|
| **P0** | 비용·쿼터 소진 (API 크레딧 부족·한도 초과) | 사람이 결제하지 않으면 기능이 영구 정지. 자동 복구가 **불가능**한 유일한 부류 |
| **P0** | 서비스 중단급 — 부팅 실패, 크래시 루프, 헬스체크 연속 실패 | 사용자가 접속 자체를 못 한다 |
| **P0** | 데이터 정합성 위험 — 마이그레이션 실패, 중복키 급증 | 늦게 알수록 복구 비용이 커진다 |
| **P1** | 외부 의존 장애 — DB·Redis·스토리지 연결 끊김 | 기능 일부가 죽는다. 자동 복구 여지가 있어 P0 보다 한 단계 아래 |
| **P1** | 핵심 플로우 실패율 급증 | 이 프로젝트에서는 **동화 제작 실패**가 곧 서비스 실패다 |
| **P1** | 배포 결과 (성공·실패·롤백) | 누가 무엇을 언제 바꿨는지가 장애 원인 추적의 출발점 |
| **P2** | 보안 — 로그인 무차별 시도, 레이트리밋 다발 | 즉시성은 낮지만 패턴을 봐야 한다 |

### 보내지 않는다

| 무엇 | 왜 |
|---|---|
| 개별 4xx | 사용자 실수다. 사람이 할 일이 없다 |
| 정상 요청 로그·성공 이벤트 | 알림 피로의 주범 |
| **외부 API 요청·응답 본문** | 루트 `CLAUDE.md` Never |
| **개인정보** — `loginId`·얼굴 이미지 URL·세션 소유자 | Discord 는 외부 서비스다. 채널 권한이 곧 접근 통제가 된다 |
| 중복 억제 없는 반복 이벤트 | 레이트리밋에 걸려 **정작 중요한 알림이 유실된다** |

### 이 프로젝트에 지금 붙일 것 (추천 순)

1. ⭐ **OpenRouter 크레딧 부족(402)** — P0. 이게 뜨면 동화가 **한 장도** 안 만들어지는데 지금은 로그에만 남아 아무도 모른다. 결제 외에 복구 수단이 없다. **1순위**
2. **OpenRouter 요청 한도 초과(429)** — P1. 일시적일 수 있으나 반복되면 모델·플랜 조정이 필요하다
3. **개인화 파이프라인 중단** (`markPipelineFailed`) — P1. 사용자 한 명의 제작이 통째로 실패한 것이다
4. (후속) 스토리지 서명 연속 실패 · readiness down 지속 · 배포 결과

이번 슬라이스는 **1~3** 까지만 붙인다. 4는 감지 로직(연속 카운트)이 따로 필요해 범위를 나눈다.

---

## Goal & Acceptance Criteria

- `NotificationPort` 뒤에 Discord 어댑터를 두고, **URL 미설정이면 no-op** 으로 조용히 동작한다(로컬·테스트 환경에서 아무 일도 일어나지 않아야 한다).
- 알림 전송 실패가 **도메인 API 를 절대 막지 않는다.**
- 레플리카 3개에서 같은 사건이 **한 번만** 나간다(Redis dedupe). Redis 가 죽으면 보낸다.
- 개인정보·외부 API 본문이 알림에 **들어가지 않는다** — 테스트로 고정한다.
- `pnpm back ci:core` 통과.

**비목표**: 멀티테넌트(팀별 채널), 사용자 입력 webhook URL(→ SSRF 검증 불필요), 재시도·DLQ, Slack·Telegram 확장.

---

## Implementation Steps

- [x] 1 `common/port/notification.port.ts` — `NotificationPort`(반환형 `void`) + `NOTIFICATION_PORT` Symbol
- [x] 2 `common/adapters/discord-notification.adapter.ts` — Embed·`AbortSignal.timeout(5s)`·Redis dedupe·실패 삼킴(로그는 `createLogThrottle`)
- [x] 3 `common/adapters/noop-notification.adapter.ts` — URL 미설정 시. `warn` 이 아니라 `debug` (로컬에서 미설정은 정상 상태라 `warn` 이면 진짜 경고가 묻힌다)
- [x] 4 `common/notification/notification.module.ts` — `useFactory` 로 선택 (`StorageModule` 과 같은 패턴)
- [x] 5 `env.validation.ts` 에 `DISCORD_WEBHOOK_URL: optionalText`
- [x] 6 알림 지점 3곳 — OpenRouter 402(critical/1h) · 429(warning/10m) · 파이프라인 중단(warning/5m)
- [x] 7 테스트 16건 — 페이로드·URL 미유출·타임아웃 시그널·실패 삼킴·dedupe 4종·402/429 발송·원문 미포함
- [x] Verify: `pnpm back ci:core` **통과** (31 suites / **292** tests, 착수 시 276)

### 결정 기록

- **`OpenRouterImageAdapter` 는 필수 주입, `StorySessionService` 는 `@Optional()`** — 전자는 생성자 인자가 2개라 spec 2곳만 고치면 되고, 알림이 그 클래스의 핵심 동작(402 통지)이라 빠지면 안 된다. 후자는 인자가 11개고 여러 spec 이 positional 로 생성해 필수화하면 전부 깨진다. 운영에서는 모듈이 반드시 주입한다.
- **dedupe fail-open 은 규약과 정합** — `back-code-patterns.md` §6 은 "fail-open 은 레이트리밋에만, 비용 카운터는 fail-closed" 라고 정한다. 알림 중복 억제는 레이트리밋 성격이지 비용 카운터가 아니다.
- **`embeds` 만 보내고 `content` 는 비운다** — 참고 프로젝트는 평문 `content` 를 썼지만, 운영 알림은 등급이 색으로 먼저 읽혀야 한다. Discord 는 `content` 없이 `embeds` 만으로도 받는다.

## 2차 슬라이스 — 기동·프로세스 오류 알림 ✅ 2026-09-16

사용자 요청으로 추가했다. **「무엇을 보내는가」의 정본은 이제 [`docs/alerts.md`](../alerts.md)** 다 — 이 문서는 구현 결정과 이력만 갖는다.

- [x] `BootstrapNotifier` (`OnApplicationBootstrap`) — 환경·**레플리카 슬롯**·버전. dedupe 키에 슬롯을 넣어 **레플리카마다 따로** 보고한다(키를 공유하면 "3개 중 하나만 떴다" 를 놓친다). TTL 60초 — 크래시 루프면 분당 1건으로 억제되면서도 반복 사실은 보인다
- [x] `ProcessErrorNotifier` — `unhandledRejection` · `uncaughtException`. 🚫 **스택을 알림에 담지 않는다**(내부 경로가 외부 채널로 나간다). 로그에 남기고 알림은 에러 **종류명**까지만. 🚫 `process.exit()` 도 하지 않는다 — Node 기본 동작에 맡겨야 전송이 잘리지 않는다
- [x] `infra/prod_nerd_back.yml` 에 `IMAGE_TAG: ${IMAGE_TAG}` — `image:` 가 쓰는 **같은 변수**라 두 곳이 어긋날 수 없다
- [x] `NotificationModule` 이 **어느 어댑터를 골랐는지 부팅 로그에 남긴다** — 없으면 "알림이 안 온다" 를 만났을 때 채널 문제인지 설정 문제인지 가릴 수단이 없다. 🚫 URL 은 남기지 않는다
- [x] `AppModule` 에 `NotificationModule` 등록 — 도메인 모듈에만 두면 부팅 훅이 돌지 않는다

### 실환경 확인 (로컬, 2026-09-16)

사용자가 `apps/back/.env` 에 `DISCORD_WEBHOOK_URL` 을 넣은 뒤 재기동했다.

- 부팅 로그: **`운영 알림 채널: Discord webhook 사용`** — no-op 이 아니라 Discord 어댑터가 선택됐다
- `Nest application successfully started` 2회(코드 수정으로 watch 재시작) · 전송 실패 로그 **0건**
- ⚠️ **채널 도착 여부는 사람이 봐야 한다** — 로그로는 "실패하지 않았다" 까지만 말할 수 있다

### 함정 기록

`pnpm back ci:core` 의 `tsc` 빌드가 `nest start --watch` 의 `dist` 를 덮어써 **`MODULE_NOT_FOUND` 로 dev 서버가 죽었다.** 같은 `dist` 를 두 도구가 쓴다. dev 를 띄운 채 `ci:core` 를 돌리면 재현되므로, **dev 를 멈추거나 `dist` 를 지우고 재기동**해야 한다.

## 리뷰 지적과 대응 (2026-09-16 `/review` 2차)

| 지적 | 근거 | 대응 |
|---|---|---|
| **`uncaughtException` 리스너가 Node 의 종료 동작을 껐다** — 주석에는 "기본 동작(종료)에 맡긴다" 고 썼는데 **리스너를 등록한 순간 그 동작이 사라진다** | 최소 재현으로 실측(Node 22): 리스너가 있으면 예외 후 200ms 뒤에도 프로세스 생존, 종료코드는 내가 부른 `exit(7)` | 알림 유예 3초 후 `process.exit(1)`. `unhandledRejection` 은 국소적이라 종료하지 않는다 — **두 정책을 테스트 2건(`⭐`)으로 고정** |
| 리스너 해제 경로 부재 — 앱을 여러 번 만드는 환경에서 누적되면 중복 보고 + `MaxListenersExceededWarning` | 핸들러가 `OnApplicationBootstrap` 에서만 등록됐다 | `OnApplicationShutdown` 에서 `process.off`. 해제 동작도 테스트로 고정 |

**확인했고 문제 없던 것**: E2E 는 `AppModule` 을 import 하지 않아(`e2e-app.ts`) 부팅 알림이 돌지 않는다 · `IMAGE_TAG` 는 워크플로의 `envs:` 에 이미 있어 stack 이 읽을 수 있다(`deploy-back.yml:116`) · `StorySessionModule` 이 `NotificationModule` 을 import 해 `OpenRouterImageAdapter` 의 주입이 성립한다.

## 3차 슬라이스 — 서버 오류 알림 ✅ 2026-09-16

사용자 질문 「일반 500 에러 알림도 보내는 건 어떻게 생각해?」에 대한 답을 구현으로 냈다.

**결론: 개별 500 마다는 보내지 않는다.** 같은 버그 하나가 수십 건을 만들어 채널을 덮고, 그러면 크레딧 부족 같은 진짜 알림을 놓친다. 대신 **성격이 다른 두 신호**로 나눴다.

- [x] `ServerErrorRateMonitor` — **새 서버 오류**(경로별 첫 발생, 6시간 억제) + **급증**(5분 10건, 창마다 1회)
- [x] 전역 필터가 5xx 에서만 `void` 로 호출 — **응답 경로를 막지 않는다**. 필터 주입은 `@Optional()`(E2E·spec 이 `new HttpExceptionFilter()` 로 직접 만든다)
- [x] 테스트 13건 — 임계치 `===` 경계, 4xx 미집계, **헬스체크 passthrough 미집계**, Redis 죽어도 미던짐, 경로에 실제 URL 미포함, **모니터 유무와 무관하게 응답 정규화 동일**
- [x] Verify: `pnpm back ci:core` **통과** (33 suites / **310** tests)

**결정 근거**
- **절대 건수** — 에러율(%)은 트래픽이 적을 때 요동친다(2건 중 1건 = 50% 인데 할 일은 없다)
- **라우트 패턴만** — 실제 URL 은 세션 ID 를 품어 고카디널리티이자 개인 식별 정보다(루트 `CLAUDE.md` Never)
- **`=== THRESHOLD`** — `>=` 면 넘어선 뒤 건건마다 알려 채널이 덮인다
- **503 자동 제외** — readiness 실패는 필터의 passthrough 분기로 빠져 여기 오지 않는다

### 실환경 검증 한계

실제 500 을 유발하려 했으나 **정상 경로로는 만들 수 없었다** — 도메인 에러가 전부 4xx 로 처리되고 있어서다. 이건 코드가 견고하다는 신호다. 대신 필터↔모니터 연결을 테스트로 고정했고, **Discord 전송 경로 자체는 기동 알림이 실제로 나가면서 증명됐다**(같은 어댑터를 쓴다).

## Risk & Rollback

- **롤백**: `DISCORD_WEBHOOK_URL` 을 비우면 no-op 어댑터가 선택되어 알림이 전부 꺼진다. 코드 되돌림 없이 차단 가능하다.
- **위험**: webhook URL 은 그 자체가 시크릿이다. 🚫 저장소·로그·응답 어디에도 값을 남기지 않는다.

## Verification Story

- **무엇이 바뀌었는가**: `NotificationPort` 뒤에 Discord webhook 어댑터를 붙이고, 알림이 필요한 3곳(크레딧 부족·요청 한도·파이프라인 중단)을 연결했다. 신규 5파일 + 수정 4파일.
- **어떻게 확인했는가**: `pnpm back ci:core` 통과(31 suites / 292 tests). **실제 기동으로 no-op 경로를 확인** — `DISCORD_WEBHOOK_URL` 미설정 상태에서 `NotificationModule` 이 DI 컨테이너에 로드되고 앱이 정상 기동(`health` 200)했다.
- **미검증**: 실제 Discord 채널 전송. webhook URL 이 있어야 하고, 그 값은 사용자가 설정한다. 전송 경로는 테스트(16건)로만 고정돼 있다.

---

## 진행 로그

- **2026-09-16** 문서 생성. `node/bun` 조사 완료 — 같은 NestJS 스택이라 이식 장벽 없음. 멀티테넌트 부분은 버리고 env 단일 채널로 축약하기로 결정.
- **2026-09-16** Step 1~7 완료.
- **2026-09-16** 2차 슬라이스(기동·프로세스 오류 알림) 완료 + `docs/alerts.md` 신설.
- **2026-09-16** 2차 리뷰 — `uncaughtException` 종료 동작 결함을 실측으로 잡아 수정.
- **2026-09-16** 3차 슬라이스(서버 오류 알림) 완료. 커밋하지 않았다 — 사용자 지시 대기.
