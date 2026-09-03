# nerd

동화 생성 서비스의 모노레포. 앱 2개와 두 앱이 공유하는 인프라 스택으로 이루어져 있다.

| 경로 | 무엇 | 포트 | 배포 스택 |
|---|---|---|---|
| [`apps/back/`](apps/back/) | NestJS API (`/api/v2`) | 5501 | `prod_nerd_back` |
| [`apps/front/`](apps/front/) | Next.js 앱 | 5502 | `prod_nerd_front` |
| [`infra/`](infra/) | 스택 YAML 4개 (앱 2 + MySQL + Redis). **파일명 = 스택명** | — | 4개 스택 |

앱별 스택·환경변수·명령어 상세는 **각 앱의 `README.md`** 가 SSOT 다 — [백엔드](apps/back/README.md) · [프론트](apps/front/README.md).

## 요구사항

- **Node 22** 이상
- **pnpm** — `corepack enable` 로 `packageManager` 필드의 버전이 자동으로 맞춰진다. 전역 설치가 필요 없다
- Docker (컨테이너 빌드를 로컬에서 확인할 때만)

## 퀵스타트

```bash
corepack enable
pnpm install            # 루트에서 한 번. 두 앱이 함께 설치된다

pnpm back dev           # → http://localhost:5501/api/v2   (Swagger: /api/v2/docs)
pnpm front dev          # → http://localhost:5502
```

`pnpm back dev` 는 **DB 터널을 먼저 자동으로 연다** — 백엔드는 DB 없이 기동하지 않기 때문이다. 이미 열려 있으면 그대로 쓰고, 포트는 `apps/back/.env` 의 `DB_PORT` 를 따른다. 닫을 때는 `pnpm back db:tunnel:stop`, 건드리고 싶지 않으면 `SKIP_DB_TUNNEL=1 pnpm back dev`. 상세는 [백엔드 README 「DB 접속」](apps/back/README.md).

`pnpm back` · `pnpm front` 는 각각 `pnpm --filter nerd-back` · `pnpm --filter nerd-front` 의 별칭이다. 뒤에 그 앱의 스크립트 이름을 붙인다.

```bash
pnpm back test --testPathPatterns health      # 앱 스크립트에 인자 전달 (`--` 없이 그대로 붙인다)
pnpm front check:types
```

앱 디렉터리로 `cd` 할 필요는 없다.

### 로컬 환경변수

앱별로 따로 관리한다. 두 앱의 키는 겹치지 않고 로딩 시점도 다르다.

| 파일 | 무엇 | 참고 |
|---|---|---|
| `apps/back/.env` | 백엔드 런타임 전부 | `apps/back/.env.example` |
| `apps/front/.env.local` | 프론트 로컬 개발용 | ⚠️ `PORT` 는 여기에 넣어도 **무시된다** |

백엔드는 **DB 가 없으면 기동하지 않는다.** 로컬도 운영 DB 를 SSH 터널로 쓰고, `pnpm back dev` 가 그 터널을 자동으로 연다 — [백엔드 README 「DB 접속」](apps/back/README.md).

## 검증

```bash
pnpm ci:core     # 두 앱 (백엔드 lint→test→build · 프론트 lint→typecheck→build)
pnpm ci:all      # PR 직전. + 스텁 검사 · E2E · 헬스 경로 검사

pnpm back ci:core     # 한 앱만
pnpm front ci:core
```

**루트 설정(`package.json` · `pnpm-workspace.yaml` · lockfile)을 건드렸으면 두 앱 모두 돌린다.**

## 배포

`main` 푸시가 곧 배포다. 워크플로 4개가 **바꾼 파일에 따라 각자** 돈다 — 프론트만 바꾸면 프론트만, 백엔드만 바꾸면 백엔드만 빌드·배포된다.

| 워크플로 | 트리거 |
|---|---|
| `deploy-back` · `deploy-front` | 해당 앱의 화이트리스트 경로 |
| `deploy-db` · `deploy-redis` | `infra/` 의 해당 스택 파일 |

구성·흐름·롤백·상태 확인은 [`docs/deploy.md`](docs/deploy.md) 가 SSOT 다.

## 문서 지도

| 문서 | 담당 |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | AI 에이전트 공통 규약·금지·함정 (앱별은 `apps/<앱>/CLAUDE.md`) |
| [`docs/deploy.md`](docs/deploy.md) | 배포·운영 (SSOT) |
| [`docs/lessons.md`](docs/lessons.md) | 작업 방식의 누적 교훈 |
| [`docs/tasks/`](docs/tasks/) | 진행 상황·결정 근거 (완료분은 `archive/`) |
| [`ideas/`](ideas/) | 제품 아이디어·스펙 초안 |
