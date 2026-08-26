# Task Tracker: 백엔드 뼈대 구축

> 작성일: 2026-08-26
> 상태: **Phase 1 구현 완료 (2026-08-26)** — 배포 실행과 Caddy 등록은 사용자 작업으로 남음. Phase 2(DB 계층) 미착수.
> 범위: 주제와 무관하게 확정 가능한 뼈대만. 도메인 모듈은 주제 확정 후 별도 태스크.
> 원칙: 이 문서가 뼈대 관련 **결정의 SSOT**다. 결정이 바뀌면 코드보다 이 문서를 먼저 고친다.

**참고 프로젝트 표기** — 본 문서는 사내·개인 식별 정보를 담지 않는다. 기존 NestJS 저장소 두 곳을 각각 `참고 A`(소규모·문서 규율 우수), `참고 B`(대규모·상용 운영)로만 표기한다. 실제 도메인명·서비스 URL·인스턴스 IP는 어떤 파일에도 적지 않는다.

---

## 📌 결정 사항 요약

| 항목 | 결정 | 근거 |
|---|---|---|
| 프레임워크 | NestJS 11 + TypeScript | 참고 A·B 공통. 팀 학습 비용 0 |
| ORM | **TypeORM** — 단, **DB 확정 후 설치** | 참고 A·B 공통. DB별로 다른 건 드라이버고, 본체만 미리 깔아도 얻는 게 없다 (↓ 주의 사항 #10) |
| 트랜잭션 | **`@Transactional`** (`typeorm-transactional`) — DB 확정 후 | 참고 B 방식. 서비스 코드에서 트랜잭션 배관이 사라짐 |
| 계층 | **2계층 + Port/Adapter** | DB는 Service가 `@InjectRepository` 직접. LLM·외부 API만 Port로 격리 |
| Repository 클래스 | **만들지 않음** | TypeORM `Repository<T>`가 이미 리포지토리다. 참고 A·B 모두 0건 |
| 폴더 구조 | **`src/modules/<name>/`** | 참고 A 방식. `src` 최상위가 도메인 수에 비례해 붐비지 않음 |
| DTO 배치 | **`dto/` 폴더 + `dto/__spec__/*.factory.ts`** | 참고 B 방식. 팩토리가 DTO 옆에서 같이 움직임 |
| 응답 생성 | **객체 리터럴 직접 반환**, DTO는 Swagger 명세 전용 | 참고 A 방식. `new` 없이 짧고, 형태는 전역 필터가 고정 |
| 에러 | `defineDomainError` 정의 → 전역 필터가 `{ code, message, timestamp }`로 통일 | 참고 A·B 공통 |
| HTTP 성공 상태 | **정석 REST** (201·204 사용) | 참고 B의 "전부 200"은 legacy 호환 타협이라 승계하지 않음 |
| HTTP 플랫폼 | **Express** | 병목은 외부 API 대기(수백 ms~수 초). 프레임워크 오버헤드는 무의미 |
| 테스트 | **mock 주력 + 순수 로직 단위 + DB 접속 차단 가드** | 전 환경이 동일 DB를 공유하므로 실 DB 테스트는 상용을 건드린다 (↓ 주의 사항 #1) |
| 검증 | 전역 ValidationPipe 하나를 프로덕션·E2E가 **공유** | 참고 A. 한쪽만 바꾸면 E2E가 다른 규칙으로 검증하게 됨 |
| 로깅 | Pino (`nestjs-pino`) — 로컬 pretty / 배포 JSON stdout, redact, `/health` 제외 | 참고 A·B 공통. 기존 로그 수집 파이프라인이 stdout JSON을 그대로 먹음 |
| Redis | **포함** | 레이트리밋 스토리지 + 예산 가드레일 카운터. 레플리카 3개 전제에서 필수 |
| 레이트리밋 | Throttler + **Redis 스토리지** | 메모리 스토리지는 레플리카 3개에서 실효 한도가 3배가 된다 |
| 헬스체크 | `@nestjs/terminus` — **liveness / readiness 분리** | Swarm healthcheck가 외부 의존을 검사하면 DB·Redis 장애가 재시작 루프와 배포 롤백을 유발한다 (↓ 아키텍처 · 헬스체크) |
| Swagger | **전 환경 노출** (`/api/v1/docs`) | 상용 환경 하나뿐. 심사위원이 API 설계를 직접 볼 수 있어 이점도 있음 |
| API prefix | `/api/v1` | |
| 포트 | **5501** (컨테이너 내부). 호스트 publish 없음 | Caddy가 같은 overlay에서 `tasks.prod_nerd_back:5501`로 접근. publish하면 도메인 우회 경로가 열리고 포트 충돌 위험이 생긴다 |
| 로그 마스킹 | Pino **내장 `redact`** | 참고 A는 재귀 함수로 페이로드 전체를 순회한다. 큰 응답을 다루는 우리에겐 비용이 크다. 키 목록만 승계 |
| 배포 | Docker **Swarm stack** `prod_nerd`, 서비스 `back` → DNS **`prod_nerd_back`**, **replicas 3** | 서비스 DNS 는 `<스택>_<서비스>` 다. 스택을 `prod_nerd_back` 으로 두면 DNS 가 `prod_nerd_back_back` 이 된다 |
| Redis 운영 | **전용 인스턴스** — 같은 스택의 별도 서비스 `redis` → DNS `prod_nerd_redis` | 파일은 분리(`docker-stack.redis.yml`)하되 스택 이름을 공유해 DNS 를 깔끔하게 유지. Swarm 은 스펙이 바뀐 서비스만 갱신하므로 앱 배포가 Redis 를 재시작하지 않는다 |
| Redis 정책 | `appendonly yes` · `maxmemory 128mb` · **`volatile-lru`** · `order: stop-first` | `allkeys-lru` 는 TTL 없는 키까지 evict 한다. named volume 은 동시 접근이 안 되므로 `start-first` 금지 |
| 날짜·시간 | **UTC 저장 · 표시 시점에만 변환** · API 응답은 ISO 8601 Z | 로컬 타임존 의존 메서드를 eslint `no-restricted-syntax` 로 **차단**했다 (↓ 날짜·시간 정책) |
| 리버스 프록시 | 기존 Caddy에 **사이트 블록 추가** → `reverse_proxy tasks.prod_nerd_back:<port>` | 블록 단위 독립이라 기존 사이트 무영향 |
| 로그 수집 | 기존 파이프라인 **자동 수집** (앱 작업 0) | 수집 에이전트가 global 모드로 전 컨테이너를 자동 발견 |
| 패키지 매니저 | pnpm | 참고 A·B 공통 |
| 런타임 | Node 22 LTS (ARM64) | |
| 마이그레이션 | 파일 작성까지만. **실행은 사람이** | 전 환경 동일 DB — 모든 실행이 곧 상용 적용 |
| 커밋 | `type(scope): 한국어 설명` (Conventional Commits) | 참고 A·B 공통 |
| 문서 체계 | `CLAUDE.md` + `docs/conventions/` + `docs/playbooks/` + `docs/tasks/` | 참고 A 방식. 같은 내용을 두 곳에 쓰지 않는다 |

---

## 🚧 미결정 · 보류

확정 전에는 코드에 들어가지 않는다. 각 항목이 풀리는 시점에 이 문서를 먼저 갱신한다.

| 항목 | 상태 | 무엇이 정해지면 풀리는가 |
|---|---|---|
| DB 종류 | **미결정** | 관리형 RDBMS 중 선택. A1 자체 호스팅은 제외됨 |
| DB 계층 패키지 일괄 | DB 확정 후 | `@nestjs/typeorm` `typeorm` `typeorm-transactional` + 드라이버를 **한 번에** 설치. 미리 깔아두지 않는다 |
| readiness 인디케이터 | Redis·DB 도입 시 | liveness는 Phase 1에서 완성, readiness는 의존이 생길 때 채운다 |
| 엔티티 컬럼 타입·네이밍 규칙 | DB 확정 후 | DB별 타입 매핑과 대소문자 관례가 다름 |
| DB 세션 타임존·컬럼 타입 | DB 확정 후 | 앱 레벨 정책은 확정됨. DB별 적용 방법만 남았다 (↓ 날짜·시간 정책) |
| 마이그레이션 멱등 가드 문법 | DB 확정 후 | 시스템 카탈로그 조회 문법이 DB별로 다름 |
| 커넥션 풀 크기 | DB 확정 후 | 세션 한도 ÷ 레플리카 3 (↓ 주의 사항 #2) |
| 로그 본문 정책 | **보류** | 프롬프트 본문 제외 · 토큰 수·모델명·소요시간만 남기는 규칙을 별도로 확정 |
| Prometheus 연결 | **후순위** | `/metrics` 노출과 스크레이프 설정은 뼈대 완료 후 |
| 인증 | **보류** | 주제 확정 후. 지금은 `common/guards/` 자리와 `@CurrentUser()` 데코레이터만 |
| WebSocket | 보류 | 필요해지면 Redis 어댑터 필수 (레플리카 3개) |
| LLM 어댑터 구현체 | 보류 | `LlmPort` 인터페이스와 DI 토큰만 먼저 |

---

## 개요

- **난이도**: 보통 | **효과**: 높음 (이후 모든 작업의 기반) | **위험도**: 🟢 낮음 (신규 저장소, 되돌릴 것이 없음)
- **선행**: 없음
- **후속**: 도메인 모듈 태스크(주제 확정 후), Prometheus 연결 태스크
- **프론트 영향**: 없음 (API 계약은 도메인 모듈에서 정의)

---

## 🏗️ 아키텍처

### 계층

```
Controller  →  Service  →  TypeORM Repository<Entity>
                  ↓
               Port (interface + DI 토큰)  →  Adapter (외부 API 구현체)
```

- Service가 `@InjectRepository(Entity)`로 `Repository<Entity>`를 직접 주입받는다. 별도 Repository 클래스를 만들지 않는다.
- 외부 시스템(LLM·스토리지·메신저)은 **반드시** Port를 거친다. 서비스가 SDK를 직접 들지 않는다.
- 서비스가 커지면 계층을 늘리지 말고 **협력 서비스로 옆으로 분리**한다.

### 3계층(Repository 분리) 재논의 트리거

아래 중 하나가 걸리면 그 시점에 다시 논의한다. 감으로 판단하지 않는다.

- 한 서비스가 **400줄을 넘고** 협력 서비스 분리로도 안 잡힐 때
- **같은 조회 조건이 3곳 이상**에서 반복될 때
- 특정 조회를 캐시나 외부 API로 **교체**해야 할 때 (Port가 답일 수도 있음)

### 폴더

```
nerd-back/
├── src/
│   ├── common/
│   │   ├── constants/
│   │   ├── decorators/        current-user.decorator.ts, api-error-response.decorator.ts
│   │   ├── dto/               api-response.dto.ts, api-error.dto.ts, define-domain-error.ts
│   │   ├── enums/
│   │   ├── filters/           http-exception.filter.ts
│   │   ├── guards/            (인증 보류 — 자리만)
│   │   ├── logger/            logger.module.ts
│   │   ├── pipes/             global-validation-pipe.ts
│   │   ├── port/              llm.port.ts  (인터페이스 + DI 토큰)
│   │   ├── redis/             redis.module.ts
│   │   ├── utils/             date.utils.ts
│   │   └── __spec__/          mock-repository.ts
│   ├── config/                env.validation.ts, database.config.ts, app.config.ts
│   ├── entities/
│   │   └── __spec__/          entity.factory.ts
│   ├── modules/
│   │   └── health/            health.controller.ts, health.module.ts
│   ├── app.module.ts
│   └── main.ts
├── test/
│   ├── helpers/               e2e-app.ts
│   └── setup/                 forbid-db.ts, setup-tz.ts
├── docs/
│   ├── conventions/           code-patterns.md
│   ├── playbooks/
│   └── tasks/                 (본 문서)
├── infra/                     docker-stack.app.yml, docker-stack.redis.yml
├── migrations/
├── CLAUDE.md
├── Dockerfile
└── README.md
```

### 헬스체크 — liveness / readiness 분리

| 엔드포인트 | 검사 대상 | 쓰는 곳 |
|---|---|---|
| `GET /api/v1/health` | **프로세스만.** 외부 의존 검사 없음 | Swarm `healthcheck`, Caddy 업스트림 판정 |
| `GET /api/v1/health/ready` | Redis·DB 등 (의존이 생길 때 추가) | 진단·수동 확인 |

🚫 **Swarm healthcheck에 외부 의존을 넣지 않는다.** DB나 Redis가 흔들릴 때 컨테이너가 unhealthy로 판정되어 재시작 루프에 빠지고, 롤링 업데이트가 `failure_action: rollback`으로 되돌아간다. **앱은 멀쩡한데 배포가 막히는 경로다.**

### 날짜·시간 정책

**UTC 저장, 표시 시점에만 변환.** 저장·비교·연산은 전부 UTC 로 하고, 사람이 읽는 문자열이 필요한 순간에만 타임존을 명시해 변환한다. API 응답은 ISO 8601 `Z` suffix 로 보내고 오프셋을 붙이지 않는다 — 받는 쪽이 변환한다.

| 레이어 | 적용 | 상태 |
|---|---|---|
| 앱 코드 | `@common/utils/date.utils` 헬퍼만 사용 (`nowUtc` `toIsoUtc` `dateKeyInTimeZone` `formatInTimeZone`) | ✅ |
| 린트 | 로컬 TZ 의존 메서드(`getHours` `toLocaleString` `getTimezoneOffset` 등 18종)를 `no-restricted-syntax` 로 **error** | ✅ 위반 2건 잡히는 것 실측 확인 |
| 컨테이너 | `Dockerfile` 에 `ENV TZ=UTC` | ✅ |
| 테스트 | `test/setup/setup-tz.ts` 가 `process.env.TZ = 'UTC'` 고정 | ✅ |
| DB | 세션 타임존과 컬럼 타입 | 🚧 DB 확정 후 |

린트로 막는 것이 핵심이다. 규약을 문서에만 적어두면 개발자 노트북(KST)·CI 러너(UTC)·컨테이너(UTC)가 서로 다른 답을 내는 코드가 들어온다. 지금은 날짜 코드가 없어 **위반 0건 상태에서 규칙을 켤 수 있는 유일한 시점**이다.

`dateKeyInTimeZone(date, timeZone)` 이 타임존을 **인자로 강제**하는 이유: 일별 카운터(예: API 예산)의 "오늘"이 어느 타임존이냐가 집계 결과를 바꾼다. 한국 사용자 기준이면 KST 로 리셋해야 한다.

#### DB 확정 시 채울 항목

| DB | 컬럼 타입 | 세션 타임존 | 함정 |
|---|---|---|---|
| PostgreSQL | `timestamptz` | 커넥션에 `timezone=UTC` | `timestamp`(without tz)를 쓰면 오프셋 정보가 사라진다 |
| MySQL | `DATETIME(3)` 에 UTC 저장 | 드라이버 `timezone: 'Z'` | **`TIMESTAMP` 타입을 피한다** — 세션 TZ 기준으로 저장·조회 시 자동 변환되어 환경마다 값이 달라진다 |
| Oracle | `TIMESTAMP WITH TIME ZONE` | 컨테이너 `TZ=UTC` 에 맞춤 | `ORA_SDTZ` 설정 금지(드라이버가 로컬 TZ 로 저장). `FROM_TZ()` 에 리전명(`'UTC'`) 대신 오프셋(`'+00:00'`) — ORA-01805 |

### Path Aliases

```
@/*         → src/*
@common/*   → src/common/*
@config/*   → src/config/*
@entities/* → src/entities/*
@modules/*  → src/modules/*
```

---

## 📦 패키지 (Phase 1 설치 완료)

**런타임**

| 묶음 | 패키지 |
|---|---|
| 코어 | `@nestjs/common` `@nestjs/core` `@nestjs/platform-express` `reflect-metadata` `rxjs` |
| 설정 | `@nestjs/config` `class-validator` `class-transformer` |
| DB | 🚧 **Phase 1에서 설치하지 않음** — `@nestjs/typeorm` `typeorm` `typeorm-transactional` + 드라이버를 DB 확정 시 일괄 추가 |
| 문서 | `@nestjs/swagger` `swagger-ui-express` |
| 로깅 | `nestjs-pino` `pino` `pino-http` |
| Redis | `ioredis` |
| 보호 | `@nestjs/throttler` `@nest-lab/throttler-storage-redis` `helmet` `compression` `cookie-parser` |
| 헬스 | `@nestjs/terminus` |
| 런타임 alias | `tsconfig-paths` |

**개발**

`@nestjs/cli` `@nestjs/testing` `jest` `ts-jest` `supertest` `pino-pretty` `eslint` `typescript-eslint` `eslint-config-prettier` `eslint-plugin-prettier` `prettier` `typescript` `@types/*`

**보류**: `@faker-js/faker` `rosie` (엔티티 팩토리는 Phase 2)

**보류**: `@willsoto/nestjs-prometheus` `prom-client` (Prometheus 후순위), `@nestjs/jwt` (인증 보류)

---

## 🧰 승계할 성숙도 패턴 (참고 A 전수조사 결과)

`.claude/`(훅·권한·커맨드), `eslint.config.mjs`, `jest.config.js`, `tsconfig*.json`, `Dockerfile`, `docs/lessons.md`, `docs/playbooks/`, `test/setup/`을 전수 확인해 추린 것. **공통 원리는 "규약을 문서가 아니라 도구로 강제한다"다.**

### 1. 도구로 강제하는 규약

| 패턴 | 내용 | 왜 |
|---|---|---|
| eslint `no-explicit-any: error` | 타입 억제 금지를 린트로 강제 | 문서에 선언만 두면 지켜지지 않는다 |
| eslint `no-floating-promises` · `no-misused-promises`: error | `await` 누락·잘못된 async 사용 차단 | NestJS에서 가장 흔한 버그원 |
| 테스트 코드도 린트 대상 | `ignores`에 spec을 넣지 않는다 | 프로덕션과 같은 품질 기준 |
| `check:stubs` 스크립트 | `TODO\|FIXME\|XXX\|HACK` + `.only(` 잔존을 CI에서 차단 | `.only`가 남으면 나머지 테스트가 조용히 스킵되고 통과로 보인다 |
| jest `restoreMocks: true` | spy·mock을 매 테스트 후 자동 복원 | 전역 객체에 spy를 걸고 복원을 깜빡하면 후속 테스트가 조용히 오염된다. 개별 파일의 규율에 의존하지 않는다 |
| jest `coveragePathIgnorePatterns`에 spec·`__spec__` 제외 | 커버리지 분모에서 테스트 코드 제거 | 안 빼면 "무엇이 검증되지 않았는가"라는 신호가 테스트 헬퍼의 미사용 라인에 묻힌다 |
| jest `moduleNameMapper` ↔ tsconfig `paths` 1:1 유지 | 둘을 같이 고친다 (주석으로 명시) | 누락 시 해당 alias를 쓰는 테스트가 모듈 해석에 실패한다 |
| tsconfig `include`에 테스트 포함 | 빌드만 `tsconfig.build.json`으로 분리 | 타입 인지 린팅과 IDE가 테스트 코드까지 검사하게 된다 |

### 2. 가드레일 — 그리고 가드 자체를 테스트한다

| 패턴 | 내용 |
|---|---|
| DB 접속 차단 가드 | 드라이버 모듈을 mock으로 갈아 호출 시 즉시 예외. 에러 메시지에 **올바른 대안 경로**를 적는다 (Phase 2) |
| **가드를 검증하는 테스트** ⭐ | 가드가 실제로 차단하는지 확인하는 spec을 함께 둔다. 짜놓고 작동을 확인하지 않는 경우가 흔하다 |
| 권한 3단 분리 | `allow` / `deny` / `ask`. deny에 파괴적 명령·시크릿 읽기·마이그레이션 실행, ask에 커밋·푸시·docker·ssh |
| 권한 파일 자체를 deny | AI가 자기 권한을 수정하지 못하게 `Edit/Write(.claude/settings.json)` 차단 |
| 커밋 서명 비활성 | `attribution: { commit: "", pr: "" }` |

### 3. AI 워크플로 자동화

| 패턴 | 내용 | 주의 |
|---|---|---|
| PreCompact 훅 → 핸드오프 자동 스냅샷 | 자동 compact는 수동 핸드오프 절차를 건너뛴다. 훅이 누락을 막는 **기계적 안전망** | `trap 'exit 0' EXIT` 필수 — PreCompact는 exit 2로 compact를 차단하므로 `set -e`로 죽으면 사고로 compact를 막는다. 시크릿 마스킹 포함 |
| PreToolUse 훅 → 연관 규약 자동 주입 | 특정 경로가 든 도구 호출 직전에 그쪽 규약을 주입 | 프론트 저장소가 생기면 도입 |
| 리뷰 커맨드 | 플로우 기반 QA 절차를 슬래시 커맨드로 고정 — 액션 → 핸들러 → API → Controller → Service → DB 체인 추적 + 타입 1:1 대조 | |

⚠️ 훅과 권한 파일 등록은 **사용자가 직접** 한다 (AI 쓰기 금지 대상).

### 4. 문서 규율

| 패턴 | 내용 |
|---|---|
| 문서 경계 표 | 어느 문서가 무엇을 담는지 명시 + "같은 내용을 두 곳에 쓰지 않는다" |
| 규약에 **실측 카운트 + 최종 확인일** 병기 | "raw 쿼리 0건", "트랜잭션 4곳(파일:줄)" — 규약이 희망이 아니라 측정된 사실이 된다 |
| `docs/lessons.md` | **실패 양상 / 탐지 신호 / 근본 원인 / 예방 규칙** 4필드 고정, 최신순 append |
| `docs/playbooks/` | fix 커밋 전수 분류 → 클러스터. **"1회 발생은 승격 대기, 2회째에 클러스터로 승격"** 판정 규칙 포함 |
| 폐기 서술에 폐기 표시 | 낡은 문서를 지우지 못할 때 "이 섹션은 폐기된 정책"이라고 명시 |
| 태스크 문서에 트러블슈팅 히스토리 표 예약 | 일자·이슈·원인·해결·커밋 |

### 5. 빌드 — 남의 사고에서 미리 배운다

참고 A의 lessons 첫 항목이 **"로컬 빌드 성공이 Docker 빌드 성공을 뜻하지 않는다"**다. 빌드 진입 설정을 바꿨는데 `Dockerfile`의 `COPY` 목록을 갱신하지 않아 CI가 5일간 깨져 있었다. 근본 원인은 **로컬 빌드의 입력은 레포 전체지만 Docker 빌드의 입력은 `COPY`로 명시한 것뿐**이라는 점이고, `ci:all`은 이 종류를 잡지 못한다.

우리 대응:

- `Dockerfile`의 `COPY` 목록에 **각 파일이 왜 필요한지 주석**을 단다
- 빌드 진입 설정(`tsconfig*.json`, `build` 스크립트, 엔트리 경로)을 바꾸면 **같은 커밋에서 `COPY` 목록을 확인**한다
- 이 항목을 `docs/lessons.md`에 **처음부터 등재**한다 (우리가 겪기 전에)
- 멀티스테이지 + 프로덕션 스테이지는 `--prod` 의존성만 설치
- `HEALTHCHECK`는 **stack YAML 한 곳에서만** 정의한다 — Dockerfile과 stack 양쪽에 두면 stack이 덮어써서 어느 쪽이 동작하는지 혼란해진다

---

## 🚀 구현 단계 (계획)

각 단계는 `pnpm ci:core` 통과를 완료 조건으로 한다. **본 문서 승인 시점까지 구현은 착수하지 않는다.**

### Phase 구분 — DB 없이 배포까지 관통한다

| Phase | 범위 | 완료 조건 |
|---|---|---|
| **Phase 1** | Step 1~4, 6~11 (DB 무관 전부) | 헬스체크 하나로 **로컬 → CI → 레지스트리 → Swarm → Caddy → 브라우저**까지 관통. 무중단 롤링 업데이트 실측 확인 |
| **Phase 2** | DB 계층 (별도 태스크) | DB 확정 후. 패키지 일괄 설치 + 엔티티·마이그레이션 규약 + `forbid-db` 가드 |

Phase 1을 먼저 뚫는 이유는 **코드가 거의 없는 시점에 무중단 배포가 실제로 되는지 검증**하기 위해서다. 조건 2(죽지 않는 서비스)와 조건 7(예산 폴백)이 배포 파이프라인에 걸려 있으므로, 도메인 코드가 쌓인 뒤에 여기서 막히면 되돌리기 비싸다.

### Step 1 — 프로젝트 초기화

- `nest new` 대신 수동 스캐폴딩 (불필요한 기본 파일 제거 비용이 더 큼)
- `tsconfig.json` — path alias 5종, `strict: true`. **`include`에 테스트 포함** (타입 인지 린팅용), 빌드는 `tsconfig.build.json`으로 분리
- `tsconfig.runtime.json` — 런타임 alias 해석용 (baseUrl=dist)
- ESLint — `no-explicit-any: error`, `no-floating-promises: error`, `no-misused-promises: error`. **테스트 코드도 린트 대상** (성숙도 패턴 §1)
- Prettier + `eslint-config-prettier`
- `jest.config.js` — `restoreMocks: true`, 커버리지 분모에서 spec·`__spec__` 제외, `moduleNameMapper`를 tsconfig `paths`와 1:1 유지 (성숙도 패턴 §1)
- `package.json` 스크립트: `dev` `build` `start:prod` `lint` `lint:fix` `test` `test:e2e` `test:cov` `check:stubs` `ci:core` `ci:all`
- `check:stubs`는 `TODO|FIXME|XXX|HACK`과 `.only(` 잔존을 CI에서 차단

### Step 2 — 설정 계층

- `@nestjs/config` 전역 등록
- `config/env.validation.ts` — 부팅 시 환경변수 검증. 누락이면 **기동 실패**시킨다 (런타임에 `undefined`로 새지 않게)
- `.env.example` 작성. `.env`는 커밋 금지

### Step 3 — 로깅

- `common/logger/logger.module.ts`
- 로컬은 `pino-pretty`, 배포는 **JSON stdout** (기존 수집 파이프라인이 그대로 먹는 형식)
- `redact`: `req.headers.authorization` `req.headers.cookie` `*.password` `*.token` `*.access_token` `*.refresh_token`
- `serializers`: `req`(method·url) `res`(statusCode) `err`
- `autoLogging.ignore`: `/api/v1/health` `/api/v1/health/ready` `/api/v1/docs`
- 레벨: 배포 `info`, 로컬 `debug`
- 요청 ID: `x-request-id` 헤더가 있으면 승계, 없으면 생성 (참고 A에서 가져옴 — Caddy가 주입할 수 있다)
- 🚫 재귀 마스킹 함수를 만들지 않는다 — 참고 A는 serializer에서 페이로드 전체를 순회한다. 큰 응답을 다루는 우리에겐 매 로그마다 비용이 붙는다. Pino 내장 `redact`(컴파일됨) + "큰 본문은 로그에 안 넣는다" 규칙으로 막는다
- 파일 롤링(`pino-roll`) 생략 — stdout으로 충분하고 의존성이 하나 줄어든다
- ⚠️ 로그 레이블은 저카디널리티만. `userId` 등은 **본문 필드로만** 넣고 레이블로 승격하지 않는다

### Step 4 — 공통 응답·에러 계층

- `common/dto/api-response.dto.ts` — Swagger 명세용 베이스 (`new`로 만들어 반환하지 않는다)
- `common/dto/define-domain-error.ts` — 도메인 에러 팩토리
- `common/filters/http-exception.filter.ts` — 3단 분기 후 `{ code, message, timestamp }`로 통일. `status >= 500`은 `error`(스택 포함), 그 외는 `warn`
- `common/pipes/global-validation-pipe.ts` — `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`, `enableImplicitConversion: true`. **프로덕션과 E2E가 이 파일 하나를 공유**
- `common/decorators/api-error-response.decorator.ts` — 공통 에러 응답 Swagger 데코레이터

### Step 5 — Redis + 레이트리밋

- `common/redis/redis.module.ts` — `ioredis`, `lazyConnect: true`
- **Redis가 죽어도 앱은 기동**한다. HTTP는 정상 동작, 레이트리밋만 축소 모드
- Throttler를 **Redis 스토리지**로 구성 (2단: 초당 / 분당)
- 식별자: 인증 도입 후 `user-{id}`, 그 전에는 `X-Forwarded-For` 첫 IP → `req.ip`
- Swagger 경로에도 레이트리밋을 적용한다 (전 환경 노출이므로)

### Step 6 — 헬스체크

- `modules/health/` — `GET /api/v1/health`(liveness) + `GET /api/v1/health/ready`(readiness)
- liveness는 **외부 의존 검사 없음.** Terminus 체크 배열을 비우고 프로세스 생존만 응답한다
- readiness는 자리만 만들고, Redis·DB 인디케이터는 그 의존이 생길 때 꽂는다
- Swarm `healthcheck`와 Caddy 업스트림 판정은 **liveness만** 본다
- 로깅에서 두 경로 모두 `autoLogging.ignore` 대상 (30초 간격 폴링이 로그를 채운다)

### Step 7 — Port/Adapter 골격

- `common/port/llm.port.ts` — 인터페이스 + `Symbol` DI 토큰만
- 어댑터 구현은 주제 확정 후. 이 단계에서는 **서비스가 SDK를 직접 들지 않는다는 규약**을 성립시키는 것이 목적

### Step 8 — 테스트 기반

- `jest` 설정 + `test/setup/setup-tz.ts`(TZ 고정)
- 🚧 `test/setup/forbid-db.ts` — **Phase 2**로 미룸. 차단할 드라이버가 확정돼야 작성 가능하다. Phase 1에는 DB 의존이 아예 없어 위험도 없음
- `common/__spec__/mock-repository.ts` — `createMockRepository()`, `createMockQueryBuilder()`
- `entities/__spec__/entity.factory.ts` — `rosie` + `@faker-js/faker`, 고정 시각 상수
- `test/helpers/e2e-app.ts` — **`AppModule` import 금지**. E2E는 DB에 붙지 않는다
- 에러 경로 테스트는 status·code를 **정확히 고정**한다 (`expect([403,404]).toContain(...)` 금지 — 그 차이가 방어의 유무일 때 테스트가 조용히 무력해진다)

### Step 9 — CI/CD

참고 A의 배포 워크플로를 기반으로 한다. **모니터링 배포 워크플로는 가져오지 않는다.**

**그대로 승계할 것**

- 트리거를 `paths` **화이트리스트**로 지정 (`paths-ignore`는 머지 커밋 평가에서 의도 외 트리거가 발생한다)
- 이미지 태그 = 커밋 short SHA 7자리 (불변 태그)
- stack YAML을 rsync로 매니저에 올린 뒤 `docker stack deploy --detach=false` — **수렴까지 동기 대기**
- `--provenance=false --sbom=false` — Swarm의 매니페스트 처리가 attestation을 삼키지 못한다
- 시크릿은 저장소에 두지 않고 서버상의 `env_file` 경로에서 주입

**우리 쪽에서 바꿀 것**

| 항목 | 값 |
|---|---|
| 이미지·스택 이름 | `prod_nerd_back` |
| 빌드 플랫폼 | `linux/arm64` **단독** (단일 ARM64 노드 — amd64는 낭비) |
| 러너 | 저장소가 public이면 arm64 러너로 네이티브 빌드 (QEMU 에뮬레이션 대비 크게 빠름). private이면 기본 러너 + QEMU |
| 서버상 stack YAML 경로 | 기존 파일과 겹치지 않는 별도 경로 |
| `env_file` 경로 | 기존과 분리된 디렉터리 |
| 포트 | 컨테이너 내부 **5501**. `ports:` 미선언 (호스트 publish 없음) → 포트 충돌 자체가 발생하지 않는다 |
| placement constraint | 단일 노드면 생략, 필요하면 새 라벨 |
| 볼륨 | 기존의 DB 클라이언트·공유 디렉터리 마운트는 불필요 |

**필요한 GitHub Secrets 6개**: 레지스트리 URL·계정·비밀번호, 배포 서버, 배포 계정, Swarm 매니저 SSH 키. 기존 것을 재사용할 수 있으면 신규 발급 불필요.

**개선할 것 — 참고 A에 없는 것** (워크플로 3개 전수 확인 결과)

| 개선 | 현재 상태 | 왜 |
|---|---|---|
| **배포 전 `ci:core` 게이트** ⭐ | 테스트·린트를 실행하는 워크플로가 **하나도 없다** | `main` 푸시가 곧 배포인데 검증이 없다. 깨진 코드가 그대로 나간다 |
| **buildx 캐시** | `cache-from`/`cache-to` 미사용 | 매 배포마다 의존성 설치부터 전부 재실행 |
| **배포 후 스모크 테스트** | `docker stack services` 출력만 확인 | 수렴 실패를 감지 못해 워크플로가 성공으로 보일 수 있다. liveness를 실제 폴링해 200 확인 |
| **`linux/arm64` 단독** | amd64 + arm64 멀티아치 | 노드가 ARM64뿐이라 절반이 낭비 |
| **SSH 키 정리 `if: always()`** | rsync 실패 시 `rm`이 실행되지 않음 | 러너가 일회용이라 위험은 낮지만, SSH 액션 방식으로 통일하면 임시 키 파일 자체가 사라진다 |
| 이미지 태그·레지스트리 정리 | short SHA만, 정리 정책 없음 | SHA 태그가 무한 누적. 롤백은 `docker service update --rollback`으로 가능하니 우선순위는 낮음 |

### Step 10 — 배포

- `Dockerfile` — 멀티스테이지, **ARM64 타깃**. 베이스 이미지 arm64 지원을 먼저 확인
- `infra/docker-stack.app.yml` — 서비스명 `prod_nerd_back`, `replicas: 3`, 메모리 한도 지정, `restart_policy: on-failure`
- `healthcheck`는 **liveness 경로만** 찌른다 (Step 6)
- 롤링 업데이트: `update_config` → `order: start-first`, `parallelism: 1`, `failure_action: rollback`, `max_failure_ratio: 0`. `rollback_config`도 함께 정의
- `TASK_SLOT: "{{.Task.Slot}}"` 주입 — 스케줄러 가드용 (지금은 미사용, 자리만)
- 기존 overlay 네트워크에 `external: true`로 참여 (네트워크 이름은 서버에서 확인 — 문서에 적지 않는다)
- Caddy 사이트 블록 추가 → `reverse_proxy tasks.prod_nerd_back:<port>`
  - `tasks.` 접두는 레플리카 IP 전체를 반환 → Caddy가 직접 분배하고 개별 태스크 헬스를 본다
  - 🚫 **Caddyfile은 저장소에 커밋하지 않는다** (도메인·IP 노출)
  - `caddy validate` → `caddy reload`. 새 설정이 유효하지 않으면 Caddy는 기존 설정을 유지하므로 기존 사이트는 영향받지 않는다
- **무중단 검증**: 배포 중 liveness를 1초 간격으로 폴링해 5xx·연결 끊김이 0건인지 실측한다. Phase 1의 진짜 완료 조건은 이것이다

### Step 11 — 문서 체계 · AI 워크플로

**문서**

- `CLAUDE.md` — 라우팅 표, Never/Ask 경계, Pitfalls, DoD, 커밋 컨벤션
  - ⚠️ 한 줄을 넣기 전에 자문한다: **"이걸 모르면 내가 틀리게 행동하는가?"** 아니면 넣지 않는다. 길어질수록 정작 중요한 금지 규칙의 준수율이 떨어진다 (참고 A lessons에 실제 사례 있음)
- `docs/conventions/code-patterns.md` — 계층·에러·응답·테스트 규약. **규약마다 실측 카운트와 최종 확인일을 병기**한다
- `docs/lessons.md` — **실패 양상 / 탐지 신호 / 근본 원인 / 예방 규칙** 4필드, 최신순 append
  - 초기 등재: **"로컬 빌드 성공 ≠ Docker 빌드 성공"** (성숙도 패턴 §5 — 남의 사고를 미리 등재)
- `docs/playbooks/` — 반복 결함 클러스터. 판정 규칙: **1회 발생은 승격 대기, 2회째에 클러스터로 승격**
- `README.md` — 사실·사용법 (스택, 명령어, 환경변수, 배포 구성)
- 같은 내용을 두 곳에 쓰지 않는다. 진행 상황은 태스크 문서, 사실은 README, 규약은 CLAUDE.md·conventions
- 정책을 바꾸는 커밋에서는 **바뀐 용어로 `docs/` 전체를 grep**해 잔존 서술을 같은 커밋에서 갱신한다

**AI 워크플로** (⚠️ 등록은 사용자가 직접 — AI 쓰기 금지 대상)

- `.claude/settings.json` — 권한 3단(`allow`/`deny`/`ask`) + `attribution` 비활성 + **권한 파일 자체를 deny**
- PreCompact 훅 → 핸드오프 자동 스냅샷. `trap 'exit 0' EXIT` 필수, 시크릿 마스킹 포함
- 리뷰 커맨드 — 플로우 기반 QA 절차 고정
- PreToolUse 훅(연관 규약 자동 주입)은 프론트 저장소가 생긴 뒤 도입

---

## ⚠️ 레플리카 3개가 강제하는 규칙

뼈대 단계에서 못 박아두지 않으면 나중에 조용히 깨진다.

| 규칙 | 어기면 |
|---|---|
| 인메모리 변수·타이머로 공유 상태 관리 금지 → Redis | 레플리카별로 상태가 갈린다 |
| 레이트리밋은 **Redis 스토리지 필수** | 실효 한도가 3배가 되어 제한이 사실상 사라진다 |
| 예산 가드레일 카운터도 Redis | 예산이 3배까지 새어 나간다 |
| 스케줄러·Cron은 `TASK_SLOT` 가드로 1개 레플리카만 | 전 레플리카에서 중복 실행된다 |
| DB 커넥션 풀 크기 × 3 이 세션 한도 안에 들어와야 함 | 앱이 커넥션을 못 얻어 장애 (↓ 주의 사항 #2) |
| WebSocket 도입 시 Redis 어댑터 필수 | 다른 레플리카에 붙은 클라이언트에 브로드캐스트가 안 간다 |

---

## ⚠️ 주의 사항

1. **전 환경이 동일 DB를 공유한다** — 테스트가 DB에 붙는 순간 상용을 건드린다. 롤백으로도 못 막는다: 커넥션은 실제로 열리고, 시퀀스 증가는 롤백되지 않으며, 코드 안의 커밋 경로는 그대로 남고, DDL은 자동 커밋되는 DB도 있다. `forbid-db.ts`가 최후 방어선이다.
2. **커넥션 한도가 레플리카 3개로 나뉜다** — 관리형 무료 티어는 동시 세션 수가 빡빡하다. 풀 크기를 작게 잡고 `풀 × 3 + 마이그레이션/운영 여유`가 한도 안에 드는지 계산한다. **심사 기간에 서비스가 죽는 가장 현실적인 경로다.**
3. **`@Transactional` 롤백은 테스트로 검증할 수 없다** — mock 전용이므로 데코레이터가 빠져 있어도 테스트가 통과한다. 다중 테이블 쓰기 경로에 데코레이터가 붙었는지 **리뷰 체크리스트 + grep으로 확인**한다. 데코레이터는 Service 메서드에만 붙이고 Repository·유틸에는 붙이지 않는다.
4. **로그량이 남의 파이프라인에 영향을 준다** — 수집 스택은 낮은 인제스트 한도로 운영 중이다. 프롬프트·응답 본문을 로그에 흘리면 한도를 순식간에 먹는다. 로그 본문 정책 확정 전까지는 **외부 API 요청·응답 본문을 로그에 남기지 않는다.**
5. **고카디널리티 로그 레이블 금지** — `userId` `requestId` `url` 등은 본문 필드로만. 레이블로 승격하면 인덱스가 폭증해 공유 중인 조회 성능 전체가 느려진다.
6. **ARM64를 처음부터 확인** — 이미지 하나가 arm64 미지원이면 배포 단계에서 하루가 날아간다. Step 1에서 베이스 이미지, Step 10에서 전체 스택을 확인한다.
7. **마이그레이션 실행은 사람이** — AI는 파일 작성까지만. 완료 조건에서 "작성"과 "실행"을 분리해 명시한다.
8. **Swagger가 전 환경 노출이다** — 명세가 공개되므로 레이트리밋과 예산 가드레일이 반드시 앞단에 있어야 한다.
9. **Caddyfile·`.env`·시크릿은 저장소에 넣지 않는다** — 커밋 이력에 영구 보존된다.
10. **안 쓰는 의존성을 미리 깔지 않는다** — TypeORM 본체는 순수 JS라서 미리 설치해도 ARM64 위험이 드러나지 않는다(위험은 전부 드라이버 쪽에 있다). `typeorm-transactional`은 DataSource 없이 `initializeTransactionalContext()`를 부팅 경로에 남길 뿐이다. 이미지 크기와 취약점 스캔 노이즈만 늘어난다.
11. **호스트 publish를 하지 않는다** — Caddy가 overlay 내부에서 `tasks.prod_nerd_back:5501`로 닿는다. publish하면 도메인을 우회한 직접 접근 경로가 열리고, 기존 스택과 포트가 겹치면 `docker stack deploy`가 실패한다. 디버깅용 호스트 접근이 필요해지면 그때 별도 결정한다.
12. **테스트 없이 배포되지 않게 한다** — 참고 A는 `main` 푸시가 곧 배포인데 검증 워크플로가 없다. 같은 구조를 그대로 베끼면 깨진 코드가 심사 기간에 배포된다. `ci:core`를 배포 전 게이트로 둔다.

---

## 🔄 롤백 절차

```bash
# 서비스 제거 (기존 스택 다른 서비스에는 영향 없음)
docker service rm prod_nerd_back

# 이전 이미지로 되돌리기
docker service update --rollback prod_nerd_back

# Caddy 사이트 블록 제거 후
caddy validate && caddy reload
```

- 뼈대 단계는 신규 저장소·신규 서비스라 되돌릴 기존 동작이 없다. 위험은 **기존 스택에 대한 영향**뿐이므로, 롤백은 "우리 서비스와 사이트 블록을 걷어내면 원상복구"로 성립한다.

---

## ✅ 실행 체크리스트

**Phase 1 — 구현 완료 (2026-08-26).** `pnpm ci:all` 통과: lint 0건 · 스텁 0건 · 단위 22 · E2E 5 · 빌드 성공.

```
Step 1 — 프로젝트 초기화 ✅
  [x] 수동 스캐폴딩 (nest new 미사용)
  [x] tsconfig path alias 5종 + build/runtime 분리, include 에 테스트 포함
  [x] ESLint — no-explicit-any / no-floating-promises / no-misused-promises = error
  [x] ESLint 대상에 테스트 코드 포함
  [x] jest — restoreMocks: true, 커버리지 분모에서 spec 제외
  [x] jest moduleNameMapper ↔ tsconfig paths 1:1 확인
  [x] package.json 스크립트 (ci:core / ci:all / check:stubs 포함)
  [~] 베이스 이미지 ARM64 지원 — CI 의 ARM64 빌드 job 으로 검증 예정 (로컬 docker build 미실행)

Step 2 — 설정 계층 ✅
  [x] @nestjs/config 전역
  [x] env.validation.ts — 누락 시 기동 실패 (spec 6건으로 고정)
  [x] .env.example

Step 3 — 로깅 ✅
  [x] logger.module.ts (로컬 pretty / 배포 JSON stdout)
  [x] Pino 내장 redact 적용 (재귀 함수 미사용)
  [x] serializers (req·res·err)
  [x] health / health/ready / docs 로그 제외
  [x] x-request-id 승계
  [x] 외부 API 본문 미기록 규칙 명문화 (CLAUDE.md Never 표 + code-patterns §5)

Step 4 — 공통 응답·에러 ✅
  [x] api-response.dto.ts (Swagger 명세 전용)
  [x] define-domain-error.ts
  [x] http-exception.filter.ts — 4단 분기 (헬스체크 페이로드 통과 포함)
  [x] global-validation-pipe.ts (프로덕션·E2E 공유)
  [x] 공통 에러 응답 Swagger 데코레이터

Step 5 — Redis + 레이트리밋
  [x] redis.module.ts (lazyConnect, enableOfflineQueue false, 실패해도 기동)
  [x] Throttler Redis 스토리지 (초당 5 + 분당 60)
  [x] CustomThrottlerGuard — 429 를 우리 형식으로, 스토리지 장애 시 fail-open
  [ ] ⚠️ Swagger 경로는 레이트리밋 밖에 있다 — SwaggerModule 은 express 미들웨어로
        마운트되므로 Nest 가드가 적용되지 않는다. 전 환경 노출이므로 별도 미들웨어 필요.
        → 후속 태스크로 분리

Step 6 — 헬스체크 ✅
  [x] GET /api/v1/health — liveness, 외부 의존 검사 없음
  [x] GET /api/v1/health/ready — readiness (Redis)
  [x] Swarm healthcheck 가 liveness 만 보게 구성
  [x] 두 경로 모두 autoLogging.ignore
  [x] "Redis 가 죽어도 liveness 는 200" E2E 로 고정

Step 7 — Port 골격 ✅
  [x] llm.port.ts (인터페이스 + Symbol 토큰 + usage 계측 필드)
  [x] 서비스가 SDK 를 직접 들지 않는다는 규약 문서화

Step 8 — 테스트 기반
  [x] jest 설정 + setup-tz.ts + reflect-metadata setupFiles
  [x] e2e-app.ts (AppModule import 금지, 프로덕션과 같은 파이프·필터)
  [~] mock-repository.ts → Phase 2 (TypeORM 타입 필요)
  [~] entity.factory.ts → Phase 2 (엔티티 필요)
  [~] forbid-db.ts → Phase 2 (차단 대상 드라이버 확정 후)

Step 9 — CI/CD ✅
  [x] paths 화이트리스트 트리거
  [x] 배포 전 ci:all 게이트 (별도 job — 실패 시 build 미시작)
  [x] PR 용 ci.yml + ARM64 빌드 검증 job
  [x] buildx 캐시 (type=gha)
  [x] 이미지 태그 = 커밋 short SHA
  [x] linux/arm64 단독 + provenance/sbom 비활성
  [x] concurrency group 으로 배포 직렬화
  [x] scp/ssh 액션 사용 → 임시 키 파일 없음
  [x] 배포 후 liveness 폴링 스모크 테스트
  [ ] GitHub Secrets 등록 (사용자 작업 — 8개)
  [ ] 러너 선택 확정 (public 이면 arm64 네이티브로 전환)

Step 10 — 배포
  [x] Dockerfile 멀티스테이지 ARM64 + COPY 목록 주석 + 비특권 사용자
  [x] scripts/healthcheck.mjs (slim 이미지에 curl 없음)
  [x] docker-stack.app.yml (prod_nerd_back, replicas 3, 메모리 한도)
  [x] healthcheck → liveness 경로만, HEALTHCHECK 는 stack 한 곳에서만 정의
  [x] update_config start-first / parallelism 1 / rollback / max_failure_ratio 0
  [x] rollback_config 정의
  [x] TASK_SLOT 주입
  [x] 컨테이너 포트 5501, ports 미선언 (호스트 publish 없음)
  [x] overlay 네트워크를 환경변수로 주입 (저장소에 이름 미기재)
  [ ] 새 도메인 A 레코드 → 인스턴스 (사용자 작업)
  [ ] Caddy 사이트 블록 추가 (사용자 작업 — validate → reload, 커밋 금지)
  [ ] 배포 중 liveness 1초 폴링 → 5xx·끊김 0건 실측 ⭐ (Phase 1 최종 완료 조건)

Step 11 — 문서 · AI 워크플로
  [x] CLAUDE.md (라우팅 표 / Never·Ask / Pitfalls / DoD / 커밋)
  [x] docs/conventions/code-patterns.md (규약마다 실측 카운트 + 최종 확인일)
  [x] docs/lessons.md — 2건 등재 (전역 필터가 헬스체크 덮어씀 / 로컬 빌드 ≠ 컨테이너 빌드)
  [x] README.md (스택 / API 규약 / 로깅 / 명령어 / 배포 구성)
  [x] .claude/settings.json 권한 3단 + 권한 파일 자체 deny
  [x] .claude/commands/review.md (플로우 기반 QA 절차)
  [ ] docs/playbooks/ — 결함 2회째 발생 시 생성 (현재 승격 대기 0건)
  [ ] PreCompact 핸드오프 훅 (사용자 등록 — settings.json 이 AI 쓰기 deny 대상)
  [~] PreToolUse 연관 규약 주입 훅 → 프론트 저장소 생성 후
```

## ⚠️ 위험도 요약

| 작업 | 위험도 | 핵심 이유 |
|---|:---:|---|
| Step 1~9 (로컬 코드) | 🟢 낮음 | 신규 저장소, 외부 영향 없음 |
| Caddy 사이트 블록 추가 | 🟢 낮음 | 블록 단위 독립 + 잘못된 설정은 reload가 거부하고 기존 설정 유지 |
| 기존 overlay 네트워크 참여 | 🟡 중간 | 네트워크·포트 충돌 가능. 서비스명·포트 중복 확인 필요 |
| 레플리카 3개 배포 | 🟡 중간 | DB 커넥션 한도 초과 시 앱이 커넥션을 못 얻는다 (주의 사항 #2) |
| 로그 인제스트 증가 | 🟡 중간 | 공유 수집 스택의 한도를 먹으면 남의 로그 조회까지 영향 |
| DB 접속 관련 전부 | 🔴 높음 | 전 환경 동일 DB — 테스트·마이그레이션 실행이 곧 상용 적용 |

---

## 📝 트러블슈팅 히스토리 (작성 예약)

| 일자 | 이슈 | 원인 | 해결 | commit |
|---|---|---|---|---|
| - | - | - | - | - |

---

## 📚 참고

- 계층·에러·응답·테스트 규약 상세: `docs/conventions/code-patterns.md` (Step 11에서 작성)
- 금지·함정·DoD: `CLAUDE.md` (Step 11에서 작성)
- 명령어·환경변수·배포 구성: `README.md` (Step 11에서 작성)

**본 문서 갱신 규칙**

1. 결정이 바뀌면 **코드보다 이 문서를 먼저** 고친다.
2. 「미결정·보류」 항목이 풀리면 해당 행을 「결정 사항 요약」으로 옮기고 근거를 적는다.
3. 진행 상황은 실행 체크리스트에만 적는다. `CLAUDE.md`·`README.md`에 중복 기재하지 않는다.
