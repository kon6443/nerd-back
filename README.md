# nerd-back

NestJS 11 + TypeScript 백엔드.

> **이 문서는 사실과 사용법만 담는다** — 스택, 실행법, 환경 변수, 명령어.
> 규약·설계·배포 상세는 아래 [문서와 설정](#문서와-설정)으로 분리되어 있다. 같은 내용을 두 곳에 쓰지 않는다.

**현재 상태**: Phase 1(뼈대) 배포 완료. DB 계층은 미착수.

---

## 기술 스택

| 구분 | 선택 |
|---|---|
| 런타임 | Node 22 LTS (ARM64) |
| 프레임워크 | NestJS 11 · Express |
| 패키지 매니저 | pnpm |
| ORM | TypeORM (**DB 확정 후 설치**) |
| 캐시·카운터 | Redis (`ioredis`) |
| 로깅 | Pino (`nestjs-pino`) |
| API 문서 | Swagger — `/api/v2/docs` |
| 헬스체크 | `@nestjs/terminus` |
| 레이트리밋 | `@nestjs/throttler` + Redis 스토리지 |
| 테스트 | Jest + supertest |
| 배포 | Docker Swarm on ARM64 |
| DB | **미결정** |

---

## 시작하기

### 사전 요구사항

Node 22 LTS · pnpm · Docker(로컬 Redis용)

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

---

## 환경 변수

`.env.example` 을 복사해 채운다. **`.env` 는 커밋하지 않는다.**

부팅 시 `src/config/env.validation.ts` 가 검증하고, 누락되면 **기동에 실패**한다. 런타임에 `undefined` 로 새어나가지 않게 하기 위한 설계다.

| 변수 | 설명 |
|---|---|
| `ENV` | `LOCAL` / `PROD` |
| `PORT` | 기본 5501 |
| `LOG_LEVEL` | 로컬 `debug`, 배포 `info` |
| `CORS_ORIGINS` | 쉼표 구분. 비우면 크로스 오리진 차단 |
| `REDIS_HOST` `REDIS_PORT` `REDIS_PASSWORD` | Redis 접속 정보 |
| `TASK_SLOT` | Swarm 이 주입 — 단일 실행 작업 가드용 |
| `EDGE_THROTTLE_ENABLED` | `true`/`false` (기본 `false`). 켜면 Swagger·404 등 가드 밖 경로를 IP당 분당 300 으로 제한 |

DB 관련 변수는 DB 확정 후 추가한다.

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
```

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
| [`docs/deploy.md`](docs/deploy.md) | 배포하거나 장애를 확인할 때 |
| [`docs/lessons.md`](docs/lessons.md) | 같은 실수를 반복하지 않으려 할 때 |
| [`docs/tasks/`](docs/tasks/) | 왜 이렇게 결정됐는지 확인할 때 |
| [`.claude/templates/`](.claude/templates/) | 계획서·버그 리포트를 작성할 때 |
| [`.claude/commands/`](.claude/commands/) | 쓸 수 있는 슬래시 커맨드를 찾을 때 (`/review`) |
| [`.claude/hooks/`](.claude/hooks/) | 훅이 무엇을 막고 무엇을 남기는지 확인할 때 |
| [`.claude/settings.json`](.claude/settings.json) | 권한 정책·훅 등록을 확인할 때 (팀 공유) |

---

## 커밋

`type(scope): 한국어 설명` — 상세는 [`CLAUDE.md`](CLAUDE.md).
