# nerd-back

NestJS 11 + TypeScript 백엔드.

> **문서 경계** — 같은 내용을 두 곳에 쓰지 않는다.
> 이 문서는 **사실과 사용법**(What / How)을 담는다: 스택, 명령어, 환경 변수, 배포 구성.
> **결정과 그 근거**(Why)는 [`docs/tasks/tasks-backend-skeleton.md`](docs/tasks/tasks-backend-skeleton.md)가 SSOT다.
> 진행 상황·완료 이력을 이 문서에 쓰지 않는다.

**현재 상태**: Phase 1(뼈대) 구현 완료. DB 계층은 미착수 — DB 종류가 확정되면 Phase 2 로 진행한다.

---

## 기술 스택

| 구분 | 선택 |
|---|---|
| 런타임 | Node 22 LTS (ARM64) |
| 프레임워크 | NestJS 11 |
| HTTP 플랫폼 | Express |
| 언어 | TypeScript |
| 패키지 매니저 | pnpm |
| ORM | TypeORM (**DB 확정 후 설치**) |
| 트랜잭션 | `@Transactional` (`typeorm-transactional`) |
| 캐시·카운터 | Redis (`ioredis`) |
| 로깅 | Pino (`nestjs-pino`) |
| API 문서 | Swagger (`@nestjs/swagger`) |
| 헬스체크 | `@nestjs/terminus` |
| 레이트리밋 | `@nestjs/throttler` + Redis 스토리지 |
| 테스트 | Jest + supertest, mock 주력 |
| DB | **미결정** |

---

## 아키텍처

### 계층

```
Controller  →  Service  →  TypeORM Repository<Entity>
                  ↓
               Port (interface + DI 토큰)  →  Adapter (외부 API 구현체)
```

- Service가 `@InjectRepository(Entity)`로 `Repository<Entity>`를 직접 주입받는다. **별도 Repository 클래스를 만들지 않는다.**
- 외부 시스템(LLM·스토리지·메신저)은 **반드시 Port를 거친다.** 서비스가 SDK를 직접 들지 않는다.
- 서비스가 커지면 계층을 늘리지 말고 **협력 서비스로 옆으로 분리**한다.

### 폴더

```
src/
├── common/
│   ├── constants/    app.constants.ts, throttle.constants.ts
│   ├── decorators/   api-error-response.decorator.ts
│   ├── dto/          api-error.dto.ts, api-response.dto.ts,
│   │                 common-error.dto.ts, define-domain-error.ts
│   ├── filters/      http-exception.filter.ts
│   ├── guards/       custom-throttler.guard.ts
│   ├── logger/       logger.module.ts
│   ├── pipes/        global-validation-pipe.ts
│   ├── port/         llm.port.ts
│   ├── redis/        redis.module.ts
│   └── utils/        date.utils.ts
├── config/           env.validation.ts
├── modules/
│   └── health/       health.controller.ts, health.module.ts
├── app.module.ts
└── main.ts
```

`entities/` 와 `common/__spec__/` 는 DB 계층(Phase 2)에서 추가된다.

### Path Aliases

```
@/*  @common/*  @config/*  @entities/*  @modules/*
```

---

## API 규약

### 성공 응답

컨트롤러가 **객체 리터럴을 직접 반환**한다. 전역 응답 인터셉터는 없다.

```ts
return { code: 'SUCCESS', data: result, message: '' };
```

`ApiSuccessResponseDto` 상속 DTO는 **Swagger 명세용 타입 선언 전용**이다 — `new`로 만들어 반환하지 않는다.

### HTTP 상태 코드

정석 REST를 따른다. 생성은 201, 본문 없는 응답은 204. 성공을 전부 200으로 통일하지 않는다.

### 에러 응답

`defineDomainError` 팩토리로 정의하고 throw하면, 전역 `HttpExceptionFilter`가 형식을 통일한다.

```ts
export const SessionNotFoundErrorResponseDto = defineDomainError({
  code: 'SESSION_NOT_FOUND',
  status: 404,
  message: '세션을 찾을 수 없습니다.',
  name: 'SessionNotFoundErrorResponseDto',
});
```

응답 형식:

```json
{ "code": "SESSION_NOT_FOUND", "message": "세션을 찾을 수 없습니다.", "timestamp": "..." }
```

- 응답 바디에 **`statusCode` 필드는 없다.** HTTP 상태와 `code`로 분기한다.
- 필터는 4단으로 분기한다: 도메인 에러 DTO → **헬스체크 진단 페이로드(원본 그대로 통과)** → 일반 `HttpException`(상태코드 매핑) → 그 외(`INTERNAL_SERVER_ERROR`, 원본 미노출).
- 2단이 있는 이유: Terminus 는 검사 실패를 `ServiceUnavailableException` 으로 던지는데 그 본문이 진단 결과 자체다. 우리 봉투로 감싸면 어느 의존이 왜 죽었는지가 사라진다.
- 로그 레벨은 필터가 나눈다. `status >= 500`은 `error`(스택 포함), 그 외는 `warn`.

### 입력 검증

전역 ValidationPipe **하나**만 쓴다. 설정 본체는 `src/common/pipes/global-validation-pipe.ts` 한 곳에 있고 **프로덕션과 E2E가 공유**한다. 한쪽만 바꾸면 E2E가 프로덕션과 다른 규칙으로 검증하게 되므로 이 파일만 고친다.

```
whitelist: true                 // DTO에 없는 필드 제거
forbidNonWhitelisted: true      // 없는 필드가 오면 에러 (조용히 무시하지 않음)
transform: true
transformOptions: { enableImplicitConversion: true }
```

암묵 변환이 켜져 있어 쿼리·파라미터 숫자 변환에 `@Type(() => Number)`가 필요 없다.

---

## 로깅

Pino(`nestjs-pino`)를 쓴다.

| 환경 | 출력 |
|---|---|
| 로컬 | `pino-pretty` 컬러 콘솔, 레벨 `debug` |
| 배포 | **JSON stdout**, 레벨 `info` |

배포 환경에서 JSON stdout을 쓰는 이유는 로그 수집 에이전트가 그 형식을 그대로 파싱하기 때문이다. 앱에서 추가 작업은 없다.

- **마스킹**: Pino 내장 `redact` 사용. 대상은 `authorization` `cookie` `password` `token` `access_token` `refresh_token` `secret` `apikey` `credentials`.
- **serializers**: `req`(method·url) · `res`(statusCode) · `err`.
- **요청 ID**: `x-request-id` 헤더가 있으면 승계, 없으면 생성.
- **제외 경로**: `/api/v2/health`, `/api/v2/health/ready`, `/api/v2/docs` — 30초 간격 폴링이 로그를 채운다.

### 지켜야 할 두 가지

1. **큰 본문을 로그에 넣지 않는다.** 외부 API 요청·응답 본문은 기록하지 않고, 필요한 메타데이터만 남긴다. 로그 수집 스택은 낮은 인제스트 한도로 운영되므로 대용량 로그는 공유 파이프라인 전체에 영향을 준다.
2. **고카디널리티 값을 로그 레이블로 승격하지 않는다.** `userId` `requestId` `url` 등은 본문 필드로만 넣는다. 레이블로 올리면 인덱스가 폭증해 조회 성능 전체가 느려진다.

---

## 날짜·시간

**UTC 저장, 표시 시점에만 변환.** 저장·비교·연산은 전부 UTC 로 하고, 사람이 읽는 문자열이 필요할 때만 타임존을 명시해 변환한다. API 응답은 ISO 8601 `Z` suffix 로 보내고 오프셋을 붙이지 않는다.

| 레이어 | 적용 |
|---|---|
| 앱 코드 | `@common/utils/date.utils` 헬퍼만 사용 |
| 린트 | 로컬 TZ 의존 메서드(`getHours` `toLocaleString` `getTimezoneOffset` 등)를 `no-restricted-syntax` 로 **error** |
| 컨테이너 | `Dockerfile` 의 `ENV TZ=UTC` |
| 테스트 | `test/setup/setup-tz.ts` 가 TZ 를 UTC 로 고정 |

```ts
import { KST, dateKeyInTimeZone, nowUtc, toIsoUtc } from '@common/utils/date.utils';

toIsoUtc(nowUtc());                          // '2026-08-26T15:30:00.000Z'
dateKeyInTimeZone(nowUtc(), KST);            // '2026-08-27'  ← 일별 집계 키
```

`dateKeyInTimeZone` 이 타임존을 인자로 강제하는 이유는 일별 카운터의 "오늘"이 어느 타임존이냐가 집계 결과를 바꾸기 때문이다. 한국 사용자 기준이면 KST 로 리셋해야 한다.

DB 세션 타임존과 컬럼 타입은 DB 확정 후 정한다 — DB별 적용 방법과 함정은 `docs/tasks/tasks-backend-skeleton.md` 의 「날짜·시간 정책」 참조.

## 헬스체크

| 엔드포인트 | 검사 대상 | 쓰는 곳 |
|---|---|---|
| `GET /api/v2/health` | **프로세스만** (외부 의존 검사 없음) | Swarm healthcheck, 리버스 프록시 업스트림 판정 |
| `GET /api/v2/health/ready` | Redis·DB 등 (의존이 생길 때 추가) | 진단·수동 확인 |

**Swarm healthcheck에 외부 의존을 넣지 않는다.** DB나 Redis가 흔들릴 때 컨테이너가 unhealthy로 판정되면 재시작 루프에 빠지고 롤링 업데이트가 롤백된다. 앱은 멀쩡한데 배포가 막히는 경로다.

---

## 개발 환경

### 사전 요구사항

- Node 22 LTS
- pnpm
- Docker (Redis 로컬 실행용)

### 실행

```bash
pnpm install
pnpm dev            # http://localhost:5501/api/v2
```

Swagger: `http://localhost:5501/api/v2/docs`

### 로컬 Redis

배포와 같은 이미지·정책으로 띄운다.

```bash
docker run -d --name nerd-redis -p 6379:6379 redis:7-alpine \
  redis-server --appendonly yes --maxmemory 128mb --maxmemory-policy volatile-lru
docker exec -it nerd-redis redis-cli ping     # PONG 이 나와야 한다
```

Redis 가 떠 있지 않아도 앱은 기동하고 HTTP 는 응답한다. 레이트리밋만 축소 모드가 된다.

### 환경 변수

`.env.example`을 복사해 `.env`를 만든다. **`.env`는 커밋하지 않는다.**

부팅 시 `src/config/env.validation.ts`가 필수 변수를 검증하고, 누락되면 **기동에 실패**한다. 런타임에 `undefined`로 새어나가지 않게 하기 위한 설계다.

| 변수 | 설명 |
|---|---|
| `ENV` | `LOCAL` / `PROD` |
| `PORT` | 기본 5501 |
| `LOG_LEVEL` | 로컬 `debug`, 배포 `info` |
| `REDIS_HOST` `REDIS_PORT` | Redis 접속 정보 |
| `TASK_SLOT` | Swarm이 주입 (`{{.Task.Slot}}`) — 단일 실행 작업 가드용 |

DB 관련 변수는 DB 확정 후 추가한다.

### 배포 환경의 env 파일

서버상의 env 파일은 **저장소에 두지 않고** 배포 시 `env_file` 로 주입한다. 경로는
GitHub Environment 시크릿 `ENV_FILE_PATH` 가 가리키므로 저장소에는 절대 경로가 없다.

환경이 늘어날 수 있으므로 파일명과 디렉터리에 환경을 명시한다.

| 대상 | 규칙 | 예시 |
|---|---|---|
| env 파일 | `<프로젝트>.<환경>.env` | `nerd.prod.env` · `nerd.qa.env` |
| stack 디렉터리 | `.../<프로젝트>/<환경>/` | `.../nerd/prod/` |
| Swarm 스택 이름 | `<환경>_<프로젝트>` | `prod_nerd` · `prod_nerd_cache` |
| GitHub Environment | 대문자 환경명 | `PROD` |

한 디렉터리에 여러 환경의 파일이 섞여도 구분되고, 기존에 있던 다른 프로젝트의
`.env` 와도 이름이 겹치지 않는다.

---

## 주요 명령어

```bash
# 개발
pnpm dev                 # watch 모드

# 빌드 / 실행
pnpm build
pnpm start:prod

# 코드 품질
pnpm lint
pnpm lint:fix

# 테스트
pnpm test
pnpm test:e2e
pnpm test:cov

# 통합 검증
pnpm ci:core             # lint → test → build
pnpm ci:all              # + 스텁 검사 + E2E (PR 전 필수)
```

`check:stubs`는 `TODO|FIXME|XXX|HACK`과 `.only(` 잔존을 CI에서 차단한다. `.only`가 남으면 나머지 테스트가 조용히 스킵되고 통과로 보인다.

---

## 테스트

**mock 주력**이다. 전 환경이 동일한 DB를 공유하는 구성이므로 테스트가 DB에 접속하지 않는다.

- 단위 spec 은 소스 옆에 `*.spec.ts`. 헬퍼·팩토리는 `__spec__/` 안에 두고 커버리지 분모에서 제외한다.
- E2E는 **`AppModule`을 import하지 않는다.** `test/helpers/e2e-app.ts`의 `createE2eApp()`을 쓴다. 부팅만으로 외부 시스템에 붙는 것을 막고, CI에서 외부 의존 없이 돌아가게 한다.
- E2E도 **프로덕션과 같은 전역 파이프·필터**를 붙인다. 다르면 통과가 아무것도 보증하지 않는다.
- `restoreMocks: true`이므로 `afterEach` 복원을 직접 쓰지 않는다.
- Mock repository 헬퍼와 엔티티 팩토리는 Phase 2에서 추가된다 (TypeORM 타입과 엔티티가 필요).
- 에러 경로 테스트는 status와 code를 **정확히 고정**한다. `expect([403, 404]).toContain(status)` 같은 느슨한 단정은 그 차이가 곧 방어의 유무일 때 테스트를 조용히 무력화한다.

### mock 주력의 대가

`@Transactional`이 실제로 롤백되는지 테스트로 검증할 수 없다. 데코레이터가 빠져 있어도 테스트는 통과한다. 그래서 **다중 테이블 쓰기 경로에 데코레이터가 붙어 있는지 리뷰에서 grep으로 확인**한다. 데코레이터는 Service 메서드에만 붙이고 Repository·유틸에는 붙이지 않는다.

---

## 배포 및 인프라

### 구성

| 항목 | 값 |
|---|---|
| 오케스트레이터 | Docker Swarm (stack) |
| 스택 | `prod_nerd`(앱) · `prod_nerd_cache`(Redis) — **독립 배포** |
| 서비스 DNS | `prod_nerd_back`(앱) · `prod_nerd_cache_redis`(Redis) |
| 레플리카 | **3** |
| 컨테이너 포트 | **5501** (호스트 publish 없음) |
| 이미지 | 멀티스테이지 빌드, `linux/arm64` 단독 |
| 네트워크 | 기존 overlay 네트워크에 `external: true`로 참여 |
| 노드 배치 | 라벨 제약 — 앱 `prod_nerd_back=1` · Redis `prod_nerd_redis=1` (규칙: `prod_<프로젝트>_<역할>`) |
| 리버스 프록시 | Caddy — 사이트 블록에서 `reverse_proxy tasks.prod_nerd_back:5501` |

서비스 DNS 는 **`<스택명>_<서비스명>`** 이다. 앱과 Redis 를 **별도 스택**으로 두어
배포 수명주기를 끊는다 — 각자 바뀐 것만 배포된다.

```bash
docker stack deploy -c infra/docker-stack.app.yml   prod_nerd
docker stack deploy -c infra/docker-stack.redis.yml prod_nerd_cache
```

| 변경한 것 | 도는 워크플로 | 이미지 빌드 | 앱 재배포 | Redis 재시작 |
|---|---|:-:|:-:|:-:|
| `src/**`, `Dockerfile`, 의존성 | `deploy.yml` | O | O | X |
| `infra/docker-stack.app.yml` | `deploy.yml` | O | O | X |
| `infra/docker-stack.redis.yml` | `deploy-redis.yml` | X | X | O |
| 문서·태스크 파일만 | (없음) | X | X | X |

같은 스택에 두면 Redis 설정만 바꿔도 커밋 SHA 가 바뀌어 앱 이미지 태그가 달라지고,
결과적으로 앱까지 재배포된다. 그래서 스택을 분리했다.

호스트로 포트를 publish하지 않는다. Caddy가 같은 overlay 안에 있어 서비스 DNS로 바로 닿는다. publish하면 도메인을 우회한 직접 접근 경로가 열리고 포트 충돌 위험이 생긴다.

`tasks.` 접두를 붙이면 Swarm DNS가 레플리카 IP 전체를 반환하므로 Caddy가 직접 분배하고 개별 태스크의 헬스를 본다.

### 롤링 업데이트

```
update_config:   order: start-first, parallelism: 1,
                 failure_action: rollback, max_failure_ratio: 0
rollback_config: order: start-first, parallelism: 1
healthcheck:     liveness 경로만
```

레플리카 3개를 두는 이유가 이것이다. 단일 노드에서도 **무중단 배포**가 가능하다.

### 배포 흐름

`main` 브랜치 푸시 → GitHub Actions

```
paths 화이트리스트 트리거
  → ci:core (lint → test → build)          ← 이 게이트 없이 배포하지 않는다
  → buildx 빌드 (linux/arm64, 캐시 사용, --provenance=false --sbom=false)
  → 레지스트리 push (태그 = 커밋 short SHA)
  → stack YAML을 매니저로 전송
  → docker stack deploy --detach=false     ← 수렴까지 동기 대기
  → liveness 폴링 스모크 테스트
```

- 트리거는 `paths` **화이트리스트**로 지정한다. `paths-ignore`는 머지 커밋 평가에서 의도 외 트리거가 발생한다.
- 이미지 태그는 커밋 short SHA. 불변 태그라 어떤 커밋이 떠 있는지 항상 특정된다.
- `--provenance=false --sbom=false`가 필요하다. Swarm의 매니페스트 처리가 attestation을 삼키지 못한다.
- 시크릿은 저장소에 두지 않고 서버상의 `env_file` 경로에서 주입한다.

### 롤백

```bash
docker service update --rollback prod_nerd_back    # 이전 이미지로
docker service rm prod_nerd_back                   # 서비스 제거
```

Caddy 사이트 블록을 되돌릴 때는 블록을 제거한 뒤 `caddy validate && caddy reload`. 새 설정이 유효하지 않으면 Caddy는 기존 설정을 유지하므로 다른 사이트는 영향받지 않는다.

### 저장소에 넣지 않는 것

- `.env` 및 모든 시크릿 — 커밋 이력에 영구 보존된다
- Caddyfile — 도메인·IP가 노출된다
- 서버 경로·인스턴스 주소·네트워크 이름 등 인프라 식별 정보

---

## 관측성

- **로그**: 기존 수집 에이전트가 global 모드로 전 컨테이너를 자동 발견한다. 앱은 JSON stdout만 유지하면 되고 **추가 작업이 없다.**
- **메트릭**: `/metrics` 노출과 스크레이프 연결은 **후순위**. 뼈대 완료 후 별도 태스크로 진행한다.

---

## 레플리카 3개가 강제하는 규칙

| 규칙 | 어기면 |
|---|---|
| 인메모리 변수·타이머로 공유 상태 관리 금지 → Redis | 레플리카별로 상태가 갈린다 |
| 레이트리밋은 **Redis 스토리지 필수** | 실효 한도가 3배가 되어 제한이 사실상 사라진다 |
| 카운터·예산 집계도 Redis | 3배까지 새어나간다 |
| 스케줄러·Cron은 `TASK_SLOT` 가드로 1개 레플리카만 | 전 레플리카에서 중복 실행된다 |
| DB 커넥션 풀 크기 × 3이 세션 한도 안에 들어와야 함 | 앱이 커넥션을 못 얻어 장애가 난다 |
| WebSocket 도입 시 Redis 어댑터 필수 | 다른 레플리카에 붙은 클라이언트에 브로드캐스트가 안 간다 |

---

## 문서 맵

| 문서 | 담당 |
|---|---|
| 이 문서 | 사실·사용법 — 스택, 명령어, 환경 변수, 배포 구성 |
| [`docs/tasks/tasks-backend-skeleton.md`](docs/tasks/tasks-backend-skeleton.md) | 뼈대 관련 **결정의 SSOT** — 결정 근거, 미결정 항목, 구현 단계, 위험도 |
| `docs/conventions/code-patterns.md` | 코드 규약 상세 (작성 예정) |
| `CLAUDE.md` | AI 에이전트 행동 규약 — 금지·함정·DoD (작성 예정) |

---

## 커밋 컨벤션

```
type(scope): 한국어 설명
```

- type: `feat` `fix` `refactor` `test` `docs` `chore`
- 한 커밋 = 한 의도. 포맷팅 전용 변경과 행위 변경을 섞지 않는다.
- 제목이 "무엇"이면 **본문이 "왜"**다.
- API 계약이 바뀌면 본문에 명시한다 (상태코드·에러코드 변경 등).
