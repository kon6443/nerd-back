# apps/back (NestJS) — AI 에이전트 규약

> 공통 규약·금지·Git 컨벤션·DoD 는 **저장소 루트의 [`CLAUDE.md`](../../CLAUDE.md)** 가 소유한다. 여기는 **백엔드에서만 다른 것**만 적는다.
> 코드 규약의 상세와 실측 카운트는 [`.claude/rules/back-code-patterns.md`](../../.claude/rules/back-code-patterns.md) — `src`·`test`·`scripts` 의 `.ts` 를 읽는 순간 자동 로드된다.
> 사실·사용법(스택·환경변수·명령어)은 [`README.md`](README.md).

## Never — 백엔드 고유

| 금지 | 이유 |
|---|---|
| E2E 에서 `AppModule` import | 부팅만으로 외부 시스템에 붙는다. `createE2eApp()` 을 쓴다 |
| DB 마이그레이션 **실행** | 전 환경이 동일 DB — 모든 실행이 곧 상용 적용. AI 는 파일 작성까지만. 실행은 사람이 `nerd_migrator` 로 |

**근거의 유효기간** — 마이그레이션 실행 금지 ← **전 환경 동일 DB**. 환경별 DB 가 분리되면 재검토한다. (2026-09-02 자체 호스팅 전환 때 재검토했고 **유지** — 인스턴스 1대 공유)

## Key Patterns (요약)

> 상세와 실측 카운트는 `back-code-patterns.md` 에 있다.
> **이 7줄이 그 파일과 겹치는 것은 의도된 것이다** — rule 은 `.ts` 를 읽을 때 로드되므로, 설계·계획 단계(코드를 아직 안 만진 시점)에는 이 요약이 유일한 출처다.

- **계층**: Repository 클래스 없음(Service 가 `@InjectRepository` 직접). **외부 시스템은 반드시 Port 경유**
- **응답**: `{ code, data, message }` 객체 리터럴 직접 반환. 전역 인터셉터 없음. 상태코드는 정석 REST
- **에러**: `defineDomainError` → 전역 필터가 `{ code, message, timestamp }` 로 통일. 바디에 `statusCode` 없음
- **검증**: `createGlobalValidationPipe()` 하나를 프로덕션·E2E 가 공유 — **이 파일만 고친다**
- **테스트**: mock 주력. E2E 는 외부 의존 없이 돈다
- **외부 의존**: 죽어도 앱은 기동·응답한다. 레이트리밋은 fail-open, 비용 카운터는 fail-closed. **DB 만 예외** — 핵심 의존이라 못 붙으면 부팅 실패 + Swarm 무제한 재시작
- **DB**: 옵션은 `typeorm.options.ts` 한 곳 · `synchronize` 금지 · 시각은 `DATETIME(3)`(`TIMESTAMP` 금지) · 앱 계정에 DDL 없음 · 테스트는 `forbid-db` 매퍼가 접속을 막는다

## Commands

- 검증: `pnpm back ci:core`(lint → test → build) · PR 직전 `pnpm back ci:all`(+ 스텁 검사 + E2E). **루트에서 부른다**
- 실행: `pnpm back dev` → `localhost:5501/api/v2` · Swagger `/api/v2/docs`
- ⚠️ jest 30 에서 `--testPathPattern`(단수)은 동작하지 않는다. **복수형** `--testPathPatterns` 를 쓴다
- ⚠️ `pnpm back start:prod` 는 `TS_NODE_PROJECT=tsconfig.runtime.json` 이 필요하다. 없으면 `@config/*` 를 `src/` 로 해석해 `Cannot find module` 로 죽는다 — 컨테이너는 Dockerfile `ENV` 로 넣어 두었다
- DB: 로컬 개발도 **운영 DB 를 터널로** 쓴다(`scripts/db-tunnel.sh`, README). ⚠️ 터널 포트와 `.env` 의 `DB_PORT` 가 다르면 노트북 로컬 MySQL 에 붙는다 — 에러의 호스트가 `@'localhost'` 면 그 경우다
- 로컬 env 는 `apps/back/.env` (앱별 독립). 마이그레이션은 **파일 작성까지** — `pnpm migration:run` 은 사람이

## Common Pitfalls — 백엔드 고유

공통 함정(전역 필터 예외 · 로컬≠컨테이너 빌드 · HEALTHCHECK 위치 · Caddy 순서 · 로그 빈도 · `bufferLogs`)은 루트 `CLAUDE.md` 에 있다.

1. **`tsconfig.json` paths 와 `jest.config.js` moduleNameMapper 는 세트다** — 한쪽만 고치면 해당 alias 를 쓰는 테스트만 조용히 깨진다.
2. **`reflect-metadata` 는 테스트에서도 필요하다** — `main.ts` 에서만 import 하면 spec 이 `Reflect.getMetadata is not a function` 으로 터진다. jest `setupFiles` 에 들어 있다.
3. **에러 경로 테스트는 status·code 를 정확히 고정한다** — 느슨하게 받으면 그 차이가 곧 방어의 유무일 때 테스트가 조용히 무력해진다.
4. **부팅 시 `LegacyRouteConverter: Unsupported route path: "/api/v2/*"` 경고 2줄은 무해하다** — `setGlobalPrefix` + `app.use()` 조합에서 Nest 11 이 Express 5 의 구 와일드카드 문법으로 등록하며 내는 경고다. 실측으로 helmet 헤더 6종·gzip·Swagger CSP 제외가 모두 정상 적용됨을 확인했다. **쫓지 말 것.**
5. **jest `setupFiles` 안에서 `process.env` 를 대입해도 V8 에는 닿지 않는다** — 샌드박스 env 복사본에만 쓰인다. TZ 같은 프로세스 전역은 `jest.config.js`·`test/jest-e2e.js` **상단**에서 고정하고, `test/setup/setup-tz.ts` 는 고정이 아니라 **가드**다. 되돌리면 테스트가 KST 로 조용히 돌아간다 ([lessons 2026-09-02](../../docs/lessons.md)).
6. **Swarm 태스크의 `docker_gwbridge` IP 는 컨테이너 `inspect` 에 안 나온다** — `docker network inspect docker_gwbridge` 에서 컨테이너 ID 로 역조회한다. Go 템플릿은 키가 없으면 `<no value>` 문자열을 내므로 **비어 있지 않음을 성공으로 믿지 않는다** (`scripts/db-tunnel.sh`).
7. **재시도 경로에 놓인 factory 는 멱등해야 한다** — Nest 는 DB 연결 실패 시 `dataSourceFactory` 를 재시도마다 다시 부른다. 전역 레지스트리에 등록하는 코드가 있으면 2회차부터 중복 등록으로 죽어 **접속 시도가 1회로 줄어든다.** 실제로 그랬다 ([lessons 2026-09-03](../../docs/lessons.md)).
