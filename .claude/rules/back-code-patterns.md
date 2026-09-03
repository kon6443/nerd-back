---
paths:
  - "apps/back/src/**/*.ts"
  - "apps/back/test/**/*.ts"
  - "apps/back/scripts/**/*.ts"
---

# 코드 패턴 (SSOT)

> **이 파일은 위 `paths` 의 파일을 읽는 순간 자동으로 컨텍스트에 로드된다.** 라우팅 표를 기억하는 것에 의존하지 않는다.
> 최종 확인일: 2026-09-02 · 근거: `src` 전체 **37개 `.ts`**(spec 10개 포함) + `test` 실측. 각 규약에 사용 카운트를 병기한다.
> **용도**: 새 코드를 "이 프로젝트 모양"으로 쓰기 위한 규약. 신규 모듈·API·테스트 작성 **전에** 해당 섹션을 확인한다.
> **경계**: 여기는 *코드를 어떻게 쓰는가*. 금지·함정은 [`CLAUDE.md`](../../CLAUDE.md), 사실·사용법은 [`README.md`](../../README.md), 작업 방식의 교훈은 [`docs/lessons.md`](../../docs/lessons.md).

규모 참고: 컨트롤러 1 · 모듈 5 · Port 1 · 도메인 에러 정의 4 · 단위 spec 10 · E2E spec 4.
뼈대 + DB 연결(`DatabaseModule`)까지 완료. 도메인 모듈은 없다.

---

## 1. 계층 — Repository 클래스 없음, 외부 연동은 Port

- **Controller → Service → TypeORM `Repository<Entity>`** 2계층. 별도 Repository 클래스를 만들지 않는다 (`class *Repository` **0건**).
- Service 가 `@InjectRepository(Entity)` 로 직접 주입받는다. TypeORM 의 `Repository<T>` 가 이미 리포지토리이므로 한 겹 더 감싸지 않는다.
- **외부 시스템은 반드시 Port 를 거친다** (`src/common/port/`, **1건**). 서비스가 SDK 를 직접 들지 않는다.
- 서비스가 커지면 계층을 늘리지 말고 **협력 서비스로 옆으로 분리**한다.

### 3계층 전환 트리거

감으로 판단하지 않는다. 아래 중 하나가 걸릴 때만 재논의한다.

- 한 서비스가 **400줄을 넘고** 협력 서비스 분리로도 안 잡힐 때
- **같은 조회 조건이 3곳 이상**에서 반복될 때
- 특정 조회를 캐시·외부 API 로 **교체**해야 할 때 (Port 가 답일 수도 있음)

### Path Aliases

```
@/*  @common/*  @config/*  @entities/*  @modules/*
```

⚠️ `tsconfig.json` 의 `paths` 와 `jest.config.js` 의 `moduleNameMapper` 를 **1:1 로 유지**한다. 누락하면 해당 alias 를 쓰는 테스트만 모듈 해석에 실패한다.

## 2. 응답 — 전역 인터셉터 없음, 객체 리터럴 직접 반환

```ts
return { code: SUCCESS_CODE, data: result, message: '' };
```

- 응답 인터셉터를 두지 않는다. 컨트롤러가 리터럴을 반환한다.
- `ApiSuccessResponseDto` 상속 DTO 는 **Swagger 명세용 타입 선언 전용**이다. `new` 로 만들어 반환하지 않는다.
- HTTP 상태는 정석 REST 를 따른다. 생성은 201, 본문 없음은 204. **성공을 전부 200 으로 통일하지 않는다.**

## 3. 에러 — `defineDomainError` 팩토리

```ts
export const SessionNotFoundErrorResponseDto = defineDomainError({
  code: 'SESSION_NOT_FOUND',
  status: HttpStatus.NOT_FOUND,
  message: '세션을 찾을 수 없습니다.',
  name: 'SessionNotFoundErrorResponseDto',
});

throw new SessionNotFoundErrorResponseDto();                  // 기본 메시지
throw new SessionNotFoundErrorResponseDto('만료되었습니다.');   // override
```

- 정의는 `defineDomainError` 로만 한다 (**4건**). code 가 한 곳에 모여 프론트와의 계약이 흔들리지 않는다.
- 도메인 에러는 각 모듈의 `dto/*.error.dto.ts` 에, 공통 에러는 `common/dto/common-error.dto.ts` 에 둔다.
- 전역 `HttpExceptionFilter` 가 **4단 분기**로 통일한다:
  1. `ApiErrorResponseDto` → DTO 의 code·message·details
  2. **헬스체크 페이로드(`status` + `details` 보유) → 원본 그대로 통과** ([lessons 2026-08-26](../../docs/lessons.md) 참조)
  3. 일반 `HttpException` → 상태코드를 코드 문자열로 매핑 (429 → `TOO_MANY_REQUESTS`)
  4. 그 외 → `INTERNAL_SERVER_ERROR` + 고정 메시지 (원본 미노출)
- 응답 바디에 **`statusCode` 필드는 없다.** HTTP 상태와 `code` 로 분기한다.
- 로그 레벨은 필터가 나눈다. `status >= 500` 은 `error`(스택 포함), 그 외는 `warn`.
- ⚠️ **전역 필터·인터셉터를 추가·수정할 때는 "이 규칙이 적용되면 안 되는 응답"을 먼저 확인**하고 통과 케이스를 테스트로 고정한다.

## 4. 검증 — 전역 ValidationPipe 하나

`src/common/pipes/global-validation-pipe.ts` 의 `createGlobalValidationPipe()` 하나가 `APP_PIPE` 와 E2E 에서 **공유**된다. 한쪽만 바꾸면 E2E 가 프로덕션과 다른 규칙으로 검증하므로 **이 파일만 고친다.**

```
whitelist: true · forbidNonWhitelisted: true · transform: true
transformOptions: { enableImplicitConversion: true }
```

- 암묵 변환이 켜져 있어 `@Type(() => Number)` 를 쓰지 않는다 (**0건**).
- 검증 실패는 `VALIDATION_FAILED` · 400 이고 `details` 에 `필드: 메시지` 배열이 담긴다.
- 커스텀 Pipe 는 만들지 않는다.

## 5. 로깅 — Pino, 본문은 남기지 않는다

- 로컬 `pino-pretty`, 배포 **JSON stdout**(수집 에이전트가 그대로 파싱).
- 마스킹은 **Pino 내장 `redact`** 를 쓴다. 재귀 순회 함수를 만들지 않는다 — 모든 로그마다 페이로드 전체를 훑게 되어 큰 응답에서 비용이 붙는다.
- `x-request-id` 헤더가 있으면 승계, 없으면 생성.
- 🚫 **외부 API 요청·응답 본문을 로그에 남기지 않는다.** 토큰 수·모델명·소요시간만 남긴다. 로그 수집 스택이 공유 자원이고 인제스트 한도가 낮다.
- 🚫 **고카디널리티 값을 로그 레이블로 승격하지 않는다.** `userId` `requestId` `url` 은 본문 필드로만.
- 헬스체크·docs 경로는 `autoLogging.ignore` 대상 (`LOG_IGNORED_PATHS`). 실측: liveness 20회 → 로그 **0줄**.
- 🚫 **재시도하는 외부 의존의 이벤트 핸들러에서 바로 로그를 찍지 않는다.** `createLogThrottle`
  (`@common/utils/log-throttle`)로 감싼다 — 첫 발생은 즉시, 이후는 1분 간격 + 억제 건수 보고.
  ioredis 는 끊긴 동안 약 2초마다 `error` 를 내므로 그대로 찍으면 **트래픽 0에서도** 쌓인다
  (실측: 유휴 60초 → 29줄, 레플리카 3개 하루 125,280줄 → 수정 후 1줄/분).
- 🚫 **로그를 추가하기 전에 라이브러리가 같은 이벤트를 이미 찍는지 확인한다.**
  readiness 실패는 Terminus 가 `error` 로 상세를 남기므로 우리 필터는 `debug` 로 낮췄다
  (실측: 요청당 2줄 → 1줄).
- 🚫 **`dist` 의 `.js.map` 을 "안 쓰이는 파일"로 보고 지우지 않는다.** 런타임 CMD 에
  `--enable-source-maps` 가 켜져 있어 500 에러 스택이 `src/*.ts` 줄번호를 가리킨다.
  `sourceMap` 을 끄면 스택이 `dist/*.js` 로 돌아가 원인 추적이 느려진다.
- 검증 방법: 컨테이너를 띄우고 **요청 0건으로 60초 유휴** 후 로그 증가량을 센다.
  "요청당 몇 줄"만 보면 배경 노이즈를 놓친다.

## 6. 레이트리밋 — Redis 스토리지 필수, fail-open

- 2단 구성: `short`(1초 5회) + `long`(1분 60회). 둘을 겹쳐야 "초당은 막지만 분당은 통과"하는 구멍이 없다.
- **스토리지는 Redis.** 레플리카가 3개라 메모리 스토리지는 실효 한도가 3배가 된다.
- `CustomThrottlerGuard` 가 두 가지를 바꾼다: 429 를 우리 에러 형식으로 던지고, **스토리지 장애 시 fail-open** 한다.
- ⚠️ fail-open 은 **레이트리밋에만** 적용한다. 비용이 걸린 카운터(외부 API 예산 등)는 **fail-closed** 여야 한다 — 셀 수 없으면 쓰지 않는다.
- 스로틀 제외는 **`@SkipThrottle(SKIP_ALL_THROTTLERS)`** 로 쓴다.
  🚫 **인자 없는 `@SkipThrottle()` 은 동작하지 않는다.** 기본값 `{ default: true }` 가
  우리 throttler 이름(`short`·`long`)과 매칭되지 않아 스로틀이 그대로 적용된다
  (실측: health 5회 → 스토리지 접근 10회). `test/throttle-skip.e2e-spec.ts` 가 이 동작을 고정한다.
- **가드가 닿지 않는 경로 3종**은 **엣지 백스톱 미들웨어**가 덮는다 (`common/middleware/edge-throttle.middleware.ts`).
  `/api/v2/docs`·`/api/v2/docs-json`(SwaggerModule 이 express 미들웨어로 마운트되어 가드 밖) ·
  **매칭되지 않는 404 경로**(라우트 핸들러가 없어 가드가 실행되지 않음). 2026-08-28 실측 확인
  (`CountingStorage` 로 스토리지 호출 횟수 계측 — 일반 라우트 2회 vs 3종 전부 0회).
  - 가드를 **대체하지 않고** 더 느슨한 별도 예산(`THROTTLE_EDGE`, IP당 분당 300)으로 겹친다.
    예산이 다르므로 이중 계상이 실효 한도를 깎지 않는다.
  - **코드 기본값 비활성** — `EDGE_THROTTLE_ENABLED=true` 일 때만 등록된다. 모든 요청을 지나는
    미들웨어라 한도 오설정이 곧 정상 트래픽 429 이기 때문이다. 켜는 시점은 운영이 통제한다.
  - 🚫 **헬스체크(`/health`·`/health/ready`)는 반드시 제외한다.** 여기 걸리면 Swarm 이
    unhealthy 로 판정해 재시작 루프에 빠지고 배포가 롤백된다. `test/edge-throttle.e2e-spec.ts` 가 고정한다.
  - `main.ts` 와 E2E 가 **같은 팩토리**를 호출한다. 한쪽만 배선하면 E2E 가 다른 규칙을 검증한다.
  - IP 식별은 가드와 **`resolveClientIp` 를 공유**한다. 각자 구현하면 같은 요청이 두 한도에서
    다른 키로 세어진다.
- 🚫 **레이트리밋 키로 `X-Forwarded-For` 를 직접 파싱하지 않는다. `req.ip` 를 쓴다.**
  Caddy 의 `reverse_proxy` 는 XFF 를 덮어쓰지 않고 **append** 하므로, 공격자가 헤더를 보내면
  `<위조>, <실제IP>` 가 도착한다. **첫 값을 쓰면 공격자가 정한 값**이 되어 헤더만 바꿔가며
  한도를 무력화할 수 있다. `req.ip` 는 `proxy-addr` 가 오른쪽부터 신뢰 홉만 건너뛰어 계산하므로
  위조를 무시한다 (실측 2026-08-28: XFF `1.2.3.4, 203.0.113.9` → `req.ip` = `203.0.113.9`).
  `@nestjs/throttler` 의 기본 `getTracker` 도 `return req.ip` 다 — **기본값을 덮어쓸 때는
  그 기본값이 왜 그런지 먼저 확인한다.**
  - 전제: **신뢰 프록시가 정확히 1단**(`app.set('trust proxy', 1)`). CDN 을 앞에 두면 숫자를
    늘려야 하고, 안 늘리면 스푸핑이 다시 열린다.
  - **프로덕션과 E2E 가 같은 `trust proxy` 값을 쓴다** (`test/helpers/e2e-app.ts`).
    미설정 시 `req.ip` 가 `::ffff:127.0.0.1` 로 나와 다른 규칙을 검증하게 된다(실측).
  - ⚠️ **차단을 미들웨어가 직접 로깅한다.** 실측(2026-08-28): `app.use()` 미들웨어는
    모듈 미들웨어(pino-http)보다 **먼저** 실행되므로, 여기서 응답을 끝내면 **액세스 로그에
    아무것도 남지 않는다.** 로그에 경로는 남기고 **IP 는 남기지 않는다**.

## 7. 헬스체크 — liveness / readiness 분리

| 경로 | 검사 | 쓰는 곳 |
|---|---|---|
| `/api/v2/health` | 프로세스만 | Swarm healthcheck, 리버스 프록시 |
| `/api/v2/health/ready` | Redis 등 외부 의존 | 진단·수동 확인 |

🚫 **liveness 에 외부 의존을 넣지 않는다.** 넣으면 의존 장애가 컨테이너를 unhealthy 로 만들어 재시작 루프에 빠지고 롤링 업데이트가 롤백된다. 앱은 멀쩡한데 배포가 막힌다. 이 동작은 E2E 로 고정되어 있다 (`Redis 가 죽어도 200 이다`).

## 8. 외부 의존은 죽어도 앱을 내리지 않는다

- Redis: `lazyConnect` + `enableOfflineQueue: false` + `maxRetriesPerRequest: 2`. 초기 연결 실패를 흡수해 **부팅을 막지 않는다.**
- `error` 이벤트 핸들러를 반드시 붙인다. 없으면 ioredis 가 unhandled error 로 프로세스를 죽인다.
- 종료 시 커넥션을 정리하되 **실패해도 종료를 막지 않는다.** 종료가 지연되면 배포가 멈춘다.
- 🚫 **DB 는 이 절의 예외 — 핵심 의존이다.** 연결 실패가 재시도 예산(`DB_CONNECT_RETRY` 10회 × 3초 = 30초, healthcheck 종료 시한 75초 안쪽)을 넘기면 **부팅이 실패**하고 Swarm `restart_policy`(무제한)가 재시도한다. 이유는 [`docs/tasks/archive/tasks-db-mysql.md`](../../docs/tasks/archive/tasks-db-mysql.md) D8. 런타임 장애는 다르다 — 이미 뜬 앱은 살아 있고 쿼리만 실패하다가 풀이 회복한다.

## 9. 테스트 — mock 주력

전 환경이 동일 DB 를 공유하는 구성이라 테스트가 DB 에 접속하지 않는다. **도구가 막는다** — 두 jest 설정의 `moduleNameMapper` 가 `mysql2` 를 `test/setup/forbid-db.ts`(던지는 스텁)로 바꿔, 어떤 경로로든 `DataSource.initialize()` 에 도달하면 이유·대안을 담아 즉시 실패한다. 양쪽 설정에 같은 매퍼가 있어야 하고 `forbid-db.spec.ts` · `forbid-db.e2e-spec.ts` 가 각각 고정한다.

- 단위 spec 은 소스 옆에 `*.spec.ts`. 헬퍼·팩토리는 `__spec__/` 안에 두고 커버리지 분모에서 제외한다.
- **E2E 는 `AppModule` 을 import 하지 않는다.** `test/helpers/e2e-app.ts` 의 `createE2eApp()` 을 쓴다. 부팅만으로 외부 시스템에 붙는 것을 막고, CI 에서 외부 의존 없이 돌아가게 한다.
- E2E 도 **프로덕션과 같은 전역 파이프·필터**를 붙인다. 다르면 통과가 아무것도 보증하지 않는다.
- 에러 경로는 status·code 를 **정확히 고정**한다. `expect([403, 404]).toContain(status)` 같은 느슨한 단정은 그 차이가 곧 방어의 유무일 때 테스트를 조용히 무력화한다.
- `restoreMocks: true` 이므로 `afterEach` 복원을 직접 쓰지 않는다.
- ⚠️ `@Transactional` 롤백은 mock 으로 검증할 수 없다. 다중 테이블 쓰기 경로에 데코레이터가 붙었는지 **리뷰에서 grep 으로 확인**한다.
- E2E 는 `createE2eApp({ dbQuery })` 로 DB 를 스텁한다 — `@InjectDataSource()` 의 기본 토큰(`DataSource` 클래스)에 `{ query }` 를 꽂는다.

## 10. 날짜·시간 — UTC 저장, 표시 시점에만 변환

저장·비교·연산은 전부 UTC 로 한다. 사람이 읽는 문자열이 필요할 때만 **타임존을 명시해** 변환한다. API 응답은 ISO 8601 `Z` suffix 로 보내고 오프셋을 붙이지 않는다 — 받는 쪽이 변환한다.

| 레이어 | 적용 |
|---|---|
| 앱 코드 | `@common/utils/date.utils` 헬퍼만 사용 |
| 린트 | 로컬 TZ 의존 메서드 **19종**을 `no-restricted-syntax` 로 **error** (2026-08-27 실측) |
| 컨테이너 | `Dockerfile` 의 `ENV TZ=UTC` |
| 프로세스 | `src/config/timezone.ts` 가 부팅 최초에 `process.env.TZ = 'UTC'` — `main.ts` **첫 import**. 로컬 `pnpm dev`(노트북 KST)까지 UTC 로 맞춘다 |
| 테스트 | **`jest.config.js` · `test/jest-e2e.js` 상단**에서 고정. `test/setup/setup-tz.ts` 는 고정이 아니라 **검증 가드** — 🚫 setupFiles 안의 `process.env.TZ` 대입은 샌드박스 env 에만 쓰여 V8 에 닿지 않는다 (2026-09-02 실측, [lessons](../../docs/lessons.md)) |
| DB (MySQL) | 서버 `--default-time-zone=+00:00` · 컬럼 **`DATETIME(3)`** · 드라이버 mysql2 **`timezone: 'Z'`** |

```ts
import { KST, dateKeyInTimeZone, nowUtc, toIsoUtc } from '@common/utils/date.utils';

toIsoUtc(nowUtc());                // '2026-08-26T15:30:00.000Z'
dateKeyInTimeZone(nowUtc(), KST);  // '2026-08-27'  ← 일별 집계 키
```

- 🚫 `getHours` `toLocaleString` `getTimezoneOffset` 등을 직접 부르지 않는다. **린트가 error 로 막는다** — 개발자 노트북(KST)·CI(UTC)·컨테이너(UTC)가 서로 다른 답을 내기 때문이다.
  - **예외 3곳은 룰이 꺼져 있다** (`eslint.config.mjs` 의 `files` 오버라이드): `src/common/utils/date.utils.ts`(헬퍼 자신) · `**/*.spec.ts` · `test/**/*.ts`. 즉 **spec 에서는 막히지 않는다** — 프로덕션 코드에만 강제된다.
- `dateKeyInTimeZone` 이 타임존을 **인자로 강제**하는 이유: 일별 카운터의 "오늘"이 어느 타임존이냐가 집계 결과를 바꾼다. 한국 사용자 기준이면 KST 로 리셋해야 한다.
- 🚫 **MySQL `TIMESTAMP` 타입을 쓰지 않는다.** 세션 TZ 기준으로 저장·조회 시 자동 변환되어 환경마다 값이 달라지고, 2038-01-19 이후를 표현하지 못한다. `DATETIME(3)` 에 UTC 를 넣는다.
- 🚫 mysql2 `timezone: 'Z'` 를 빼지 않는다. 없으면 `DATETIME` 을 프로세스 로컬 TZ 로 해석해, 같은 행을 로컬(KST)과 운영(UTC)이 다르게 읽는다. 근거·점검표는 [`docs/tasks/archive/tasks-db-mysql.md`](../../docs/tasks/archive/tasks-db-mysql.md) 「시간 설정 점검」.

## 11. 타입 — 억제는 도구가 막는다

- `no-explicit-any`, `no-floating-promises`, `no-misused-promises` 가 **error** 다. 현재 `any` **0건**.
- 불가피한 경우에만 `eslint-disable-next-line` + **사유 주석**을 남긴다 (현재 **1건** — `CustomThrottlerGuard.getTracker` 가 상위 클래스 시그니처를 따라야 함).
- 테스트 코드도 린트 대상이다.

## 12. DB 계층 — 옵션은 한 곳, 실행은 사람

- 접속 옵션은 **`src/common/database/typeorm.options.ts` 한 곳**이다. 앱(`DatabaseModule`)과 마이그레이션 CLI(`src/config/data-source.ts`)가 같은 함수를 쓴다. 한쪽만 고치면 CLI 가 앱과 다른 타임존·문자셋으로 붙는다.
- 고정값: `synchronize: false` · `migrationsRun: false` · `timezone: 'Z'` · `charset: 'utf8mb4_0900_ai_ci'` · `logging: ['error']` · `autoLoadEntities: true`. `typeorm.options.spec.ts` 가 고정한다.
  - ⚠️ TypeORM 의 `charset` 기본값은 `UTF8_GENERAL_CI` = **utf8mb3** 다. 명시하지 않으면 이모지가 깨진다.
- 엔티티는 `*.entity.ts`, 모듈이 `TypeOrmModule.forFeature` 로 등록한다 (경로 glob 미사용). 시각 컬럼은 `DATETIME(3)` (§10).
- `@Transactional` 은 Service 메서드에만. `main.ts` 가 `initializeTransactionalContext({ storageDriver: ASYNC_LOCAL_STORAGE })` 를 **`NestFactory.create` 전에** 1회 부른다 — 늦으면 데코레이터가 조용히 자동 커밋으로 돈다.
- 마이그레이션: **1개 = 1목적 · `down()` 필수 · 멱등 작성.** MySQL 은 DDL 이 암묵 커밋이라 중간 실패 시 부분 적용 상태로 남는다 — 멱등 + 1목적이 유일한 방어다. 실행은 `pnpm migration:run`(빌드 산출물 + `--env-file=.env.migration`, 계정 `nerd_migrator`)으로 **사람이** 한다. 앱 계정 `nerd_app` 에는 DDL 권한이 없어 코드 경로에서 스키마가 바뀔 수 없다.
- 커넥션 풀 `DB_POOL_SIZE`(기본 10, 상한 30) × 레플리카 3 ≤ `max_connections` 100.

---

## 신규 기능 체크리스트

**신규 HTTP 엔드포인트**
- [ ] 에러를 `defineDomainError` 로 정의해 throw 하는가? (§3)
- [ ] 응답을 `{ code, data, message }` 리터럴로 반환하는가? (§2)
- [ ] 상태코드가 정석 REST 인가? 생성 201, 본문 없음 204 (§2)
- [ ] Swagger: `@ApiOperation` + 응답 DTO + 공통 에러 데코레이터 (§2)
- [ ] 폴링되는 경로면 `@SkipThrottle(SKIP_ALL_THROTTLERS)` + `LOG_IGNORED_PATHS` (§5, §6)

**외부 시스템 연동 추가**
- [ ] Port 인터페이스 + DI 토큰을 먼저 만들었는가? (§1)
- [ ] 서비스가 SDK 를 직접 들고 있지 않은가? (§1)
- [ ] 요청·응답 본문을 로그에 남기지 않는가? (§5)
- [ ] 그 의존이 죽어도 앱이 기동·응답하는가? (§8)
- [ ] 비용이 걸린 카운터면 fail-closed 인가? (§6)

**전역 장치(필터·인터셉터·가드) 추가·수정**
- [ ] 이 규칙이 적용되면 **안 되는** 응답을 확인했는가? (§3, lessons)
- [ ] 통과 케이스를 테스트로 고정했는가?

**날짜·시간 다루는 코드**
- [ ] `date.utils` 헬퍼를 쓰는가? 로컬 TZ 의존 메서드를 직접 부르지 않는가? (§10)
- [ ] 일별 집계 키라면 타임존을 명시했는가? (§10)

**빌드 진입 설정 변경** (`tsconfig*.json` · `build` 스크립트 · 엔트리)
- [ ] 같은 커밋에서 `Dockerfile` 의 `COPY` 목록을 확인했는가? (lessons)
