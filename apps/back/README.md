# nerd-back

NestJS 11 + TypeScript 백엔드.

> **이 문서는 사실과 사용법만 담는다** — 스택, 실행법, 환경 변수, 명령어.
> 규약·설계·배포 상세는 아래 [문서와 설정](#문서와-설정)으로 분리되어 있다. 같은 내용을 두 곳에 쓰지 않는다.

**현재 상태**: 뼈대 + MySQL 연결까지 배포됨. 도메인 모듈은 없다.

---

## 기술 스택

| 구분 | 선택 |
|---|---|
| 런타임 | Node 22 LTS (ARM64) |
| 프레임워크 | NestJS 11 · Express |
| 패키지 매니저 | pnpm |
| ORM | TypeORM 0.3 (`@nestjs/typeorm`) + `typeorm-transactional` |
| 캐시·카운터 | Redis (`ioredis`) |
| 로깅 | Pino (`nestjs-pino`) |
| API 문서 | Swagger — `/api/v2/docs` |
| 헬스체크 | `@nestjs/terminus` |
| 레이트리밋 | `@nestjs/throttler` + Redis 스토리지 |
| 테스트 | Jest + supertest |
| 배포 | Docker Swarm on ARM64 |
| DB | MySQL 8.4 — 같은 Swarm 에 자체 호스팅 (`prod_nerd_db` 스택). 로컬용 DB 없음, 전 환경 공유 |

---

## 시작하기

### 사전 요구사항

Node 22 LTS · pnpm · Docker(로컬 Redis용) · 운영 DB 터널용 **SSH 별칭 `fs-01`** (`~/.ssh/config` — 내용은 저장소 밖) · `mysql` CLI(선택)

### 실행

```bash
pnpm install
cp .env.example .env      # 값을 채운다
pnpm dev                  # http://localhost:5501/api/v2
```

Swagger: `http://localhost:5501/api/v2/docs`

### 로컬 Redis

배포와 같은 이미지·정책으로 띄운다.

```bash
docker run -d --name nerd-redis -p 6379:6379 redis:7-alpine \
  redis-server --appendonly yes --maxmemory 128mb --maxmemory-policy volatile-lru
docker exec -it nerd-redis redis-cli ping     # PONG
```

Redis 가 없어도 앱은 기동하고 HTTP 는 응답한다. 레이트리밋만 축소 모드가 된다.

### DB 접속 — 로컬에도 DB 는 없다, 터널로 운영 DB 에 붙는다

전 환경이 서버의 MySQL 하나를 쓴다. 호스트 포트를 열어두지 않으므로 **SSH 터널**이 유일한 경로다.

```bash
scripts/db-tunnel.sh fs-01 3307     # 터미널 1 — 열어둔 채로. 노트북에 MySQL 이 없으면 포트 생략(3306)
mysql -h 127.0.0.1 -P 3307 -u nerd_app -p nerd     # 터미널 2 (GUI 도구도 같은 host/port)
```

- 🚫 `sudo` 로 실행하지 않는다 — root 의 `~/.ssh/config` 를 읽어 별칭을 못 찾는다.
- **Redis 와 다르다**: DB 에 못 붙으면 앱은 30초 재시도 후 **기동에 실패**한다(의도된 동작). `pnpm dev` 전에 터널이 열려 있어야 한다.
- 접속 확인: `SELECT @@time_zone, @@character_set_database, CURRENT_USER();` → `+00:00 / utf8mb4 / nerd_app@%`
- 계정 3개 — `nerd_app`(앱, DML 만) · `nerd_migrator`(마이그레이션, DDL) · `root`(복구용). 비밀번호는 비밀번호 관리자에만 있다. 왜 이렇게 나눴는지는 [`docs/tasks/tasks-db-mysql.md`](docs/tasks/tasks-db-mysql.md).

---

## 환경 변수

`.env.example` 을 복사해 채운다. **`.env` 는 커밋하지 않는다.**

부팅 시 `src/config/env.validation.ts` 가 검증하고, 누락되면 **기동에 실패**한다. 런타임에 `undefined` 로 새어나가지 않게 하기 위한 설계다.

| 변수 | 설명 |
|---|---|
| `ENV` | `LOCAL` / `PROD` |
| `PORT` | 기본 5501 |
| `LOG_LEVEL` | 로컬 `debug`, 배포 `info` |
| `CORS_ORIGINS` | 쉼표 구분. 비우면 크로스 오리진 차단. 로컬 기본값은 프론트 개발 서버(`http://localhost:5502`) |
| `REDIS_HOST` `REDIS_PORT` `REDIS_PASSWORD` | Redis 접속 정보 |
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` `DB_NAME` | MySQL 접속 정보. 앱은 **`nerd_app`**(DML 만) 계정을 쓴다 |
| `DB_POOL_SIZE` | 커넥션 풀 크기 (기본 10, 최대 30). 레플리카 3 × 풀 + 여유 ≤ `max_connections` 100 |
| `TASK_SLOT` | Swarm 이 주입 — 단일 실행 작업 가드용 |
| `EDGE_THROTTLE_ENABLED` | `true`/`false` (기본 `false`). 켜면 Swagger·404 등 가드 밖 경로를 IP당 분당 300 으로 제한 |

**전 환경이 같은 서버 DB 를 쓴다** — 로컬용 DB 는 없다. 환경별 값:

| 변수 | 로컬 (`.env`) | 배포 (서버 env 파일) |
|---|---|---|
| `DB_HOST` | `127.0.0.1` — `scripts/db-tunnel.sh [fs-01] [포트]` 로 터널을 먼저 연다 (`sudo` 없이) | `prod_nerd_db_mysql` (DB 스택 서비스 DNS) |
| `DB_PORT` | 터널 로컬 포트. 노트북에 MySQL 이 3306 을 쓰고 있으면 **3307** 로 열고 여기도 3307 | `3306` |
| `DB_USER` / `DB_NAME` | `nerd_app` / `nerd` | 동일 |
| `DB_PASSWORD` | Swarm secret `prod_nerd_db_app_pw` 와 **같은 값** (비밀번호 관리자) | 동일 — 회전 시 secret 과 함께 바꾼다 |
| `REDIS_HOST` | `127.0.0.1` (로컬 Redis) | `prod_nerd_cache_redis` |
| `ENV` / `LOG_LEVEL` | `LOCAL` / `debug` | `PROD` / `info` |

배포 환경의 env 파일은 저장소에 두지 않고 서버에서 주입한다. 파일명은 `<프로젝트>.<환경>.env` 규칙을 따른다 — 상세는 [`docs/deploy.md`](docs/deploy.md).

---

## 주요 명령어

```bash
pnpm dev                 # 개발 서버 (watch)
pnpm build
pnpm start:prod

pnpm lint                # pnpm lint:fix
pnpm check:types         # 전체 타입 검사 (src + test, 산출물 없이)
pnpm test                # pnpm test:watch · test:cov
pnpm test:e2e

pnpm ci:core             # lint → test → build
pnpm ci:all              # + 타입 검사 + 스텁 검사 + E2E  (PR 전 필수)

pnpm migration:show                                # 적용/미적용 목록
pnpm migration:generate src/migrations/<PascalName> # 엔티티 diff 로 파일 생성 (실행 아님)
pnpm migration:run                                 # ⚠️ 사람만. 실행 = 상용 적용
pnpm migration:revert                              # 마지막 1개 되돌림
```

### 마이그레이션 — 실행은 사람이

전 환경이 같은 DB 라 **실행이 곧 상용 적용**이다. AI 는 파일 작성까지만 한다 (`CLAUDE.md`).

```bash
cp .env.migration.example .env.migration   # DB_USER=nerd_migrator (DDL 권한). 비밀번호는 비밀번호 관리자
scripts/db-tunnel.sh fs-01 3307             # 다른 터미널에서 유지. .env.migration 의 DB_PORT 를 같은 포트로
pnpm migration:show                          # 무엇이 적용될지 먼저 본다
pnpm migration:run
```

- 스크립트는 `pnpm build` 후 `dist/config/data-source.js` 로 TypeORM CLI 를 돌린다 (ts-node 미도입). 환경변수는 Node 의 `--env-file=.env.migration` 로 읽는다.
- 마이그레이션은 **1개 = 1목적**, `down()` 필수, 멱등 작성 — MySQL 은 DDL 이 암묵 커밋이라 중간 실패 시 부분 적용 상태로 남는다. 상세는 `.claude/rules/code-patterns.md` §12.
- 컬럼 시각은 `DATETIME(3)`. `TIMESTAMP` 는 쓰지 않는다 (§10).

`check:types` 는 `tsc --noEmit` 이다. `build` 는 `src` 만, jest 는 로드한 spec 만 검사하므로 **`src` 와 `test` 를 한 번에 보는 수단은 이것뿐이다.**

`check:stubs` 는 `TODO|FIXME|XXX|HACK` 과 `.only(` 잔존을 CI 에서 차단한다. `.only` 가 남으면 나머지 테스트가 조용히 스킵되고 전체 통과로 보인다.

⚠️ jest 30 에서 `--testPathPattern`(단수)은 동작하지 않는다. 복수형 `--testPathPatterns` 를 쓴다.

---

## 문서와 설정

**담당 범위**는 [`CLAUDE.md`](CLAUDE.md) 문서 경계표가 정의한다. 여기는 **언제 무엇을 여는지**만 안내한다.

| 파일 | 언제 여는가 |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | 코드를 쓰기 전 — 금지 사항·함정·완료 기준 |
| [`.claude/rules/code-patterns.md`](.claude/rules/code-patterns.md) | 모듈·API·테스트를 만들 때 |
| [`docs/deploy.md`](docs/deploy.md) | 배포하거나 장애를 확인할 때. MySQL 스택 운영 사실도 여기 |
| [`infra/`](infra/) | 스택 YAML 을 볼 때 — 설정값을 왜 그렇게 골랐는지는 `docs/tasks/tasks-db-mysql.md` |
| [`docs/lessons.md`](docs/lessons.md) | 같은 실수를 반복하지 않으려 할 때 |
| [`docs/tasks/`](docs/tasks/) | 왜 이렇게 결정됐는지 확인할 때 |
| [`.claude/templates/`](.claude/templates/) | 계획서·버그 리포트를 작성할 때 |
| [`.claude/commands/`](.claude/commands/) | 쓸 수 있는 슬래시 커맨드를 찾을 때 (`/review`) |
| [`.claude/hooks/`](.claude/hooks/) | 훅이 무엇을 막고 무엇을 남기는지 확인할 때 |
| [`.claude/settings.json`](.claude/settings.json) | 권한 정책·훅 등록을 확인할 때 (팀 공유) |

---

## 커밋

`type(scope): 한국어 설명` — 상세는 [`CLAUDE.md`](CLAUDE.md).
