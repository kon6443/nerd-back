# Task Tracker: 프론트 합류 — pnpm 워크스페이스 모노레포 전환

> **상태**: **계획 확정 (2026-09-03) — 미결정 0건. Step 0 시작 가능.** 아카이브 이동(Step 6 일부)은 선행 완료. 구현(Step 1~)은 미착수.
> **2026-09-03 재결정**: 사용자가 다운타임을 허용하고 "모노레포에 맞게 깔끔하게" 를 택해 **D5 를 바꿨다** — 프론트 전용 시크릿 2개 추가(A안) 대신 **경로 시크릿을 `DEPLOY_DIR` 하나로 통합**하고 서버 디렉터리를 **파일명 = 스택명** 트리로 재구성한다. 아래 「시크릿 · 서버 디렉터리」절.
> **작성일**: 2026-09-03
> **대상 브랜치**: `feat/monorepo` (`main` a187787 기준으로 분기)
> **용도**: 별도 저장소 `nerd-front` 를 이 저장소로 합쳐 pnpm 워크스페이스 모노레포로 만들고, **프론트 변경은 프론트만 · 백엔드 변경은 백엔드만** 빌드·배포하도록 만드는 전환의 **결정·근거·절차·진행 상황**. 진행 상황의 정본은 이 파일이다.
> **경계**: 배포 인프라 일반 규약은 [`../deploy.md`](../deploy.md). 프론트 컨테이너·스택·헬스체크의 결정은 `tasks-frontend-cicd.md` (지금은 `nerd-front` 저장소에 있고 Step 3 에서 이 디렉터리로 옮긴다). 이 문서는 **합치는 동안**의 절차를 소유하고, 끝나면 결과를 `deploy.md` · `README.md` · `CLAUDE.md` 에 반영한 뒤 아카이브한다.

---

## Goal & Acceptance Criteria

- **무엇을 달성하는가**: 두 저장소(`kon6443/nerd-back`, `kon6443/nerd-front`)를 하나의 pnpm 워크스페이스로 합친다. 앱 코드·Dockerfile·스택 YAML·헬스체크·Swarm 서비스는 **그대로** 두고, 위치와 워크플로만 바꾼다.
- **수용 기준**
  1. 루트에서 `pnpm install` 한 번으로 두 앱이 설치되고 `pnpm ci:core` 가 두 앱을 모두 검증한다.
  2. `apps/back/**` 만 바꾼 `main` 푸시는 **`deploy-back` 만**, `apps/front/**` 만 바꾼 푸시는 **`deploy-front` 만** 돈다. **배포 4개**(back·front·db·redis)의 `paths` 교집합 **0건** — CI 2개는 루트 워크스페이스 파일에서 의도적으로 함께 돈다(Step 5).
  3. 두 Dockerfile 과 stack YAML 4개의 **내용이 바뀌지 않는다** (빌드 컨텍스트와 업로드 경로만). `docker build apps/back` · `docker build apps/front` 가 로컬에서 성공하고 실기동 헬스체크가 통과한다.
  4. Swarm 스택·서비스 DNS·이미지 이름·노드 라벨 **무변경**. 서버 파일은 `<DEPLOY_DIR>/{stacks,env}/<스택명>.*` 트리로 이동하고, 시크릿은 경로 2개(`DEPLOY_STACK_DIR` · `ENV_FILE_PATH`)가 `DEPLOY_DIR` 1개로 대체되어 **10 → 9개**. 앱이 늘어도 시크릿이 늘지 않는다.
  5. 프론트 git 이력(12커밋, 운영 태그 `1aa9484` 포함)이 보존된다.
  6. 루트 `CLAUDE.md` 200줄 이하 · 문서 SSOT 가 두 곳에 생기지 않는다 · `grep` 전수 확인으로 옛 경로 참조 0건.
- **비목표 (이번에 안 하는 것)**
  - Turborepo / Nx 등 빌드 오케스트레이터 도입 (D10)
  - 공유 패키지(`packages/*`, 타입 공유) 신설 — 프론트에 API 호출 코드가 아직 0건이라 근거가 없다
  - 프론트 prettier·테스트 프레임워크 도입 (후속)
  - 프론트 Caddy 블록·DNS·무중단 실측 — `tasks-frontend-cicd.md` Step 6 이 소유 (스택 자체는 9월 1일에 배포됨)
  - 백엔드 스모크 필터 라벨 전환·runner 변경 등 워크플로 **행위** 개선 — 별도 커밋으로 분리 가능하지만 이 전환의 완료 조건이 아니다
  - GitHub 저장소 이름 변경(`nerd-back` → `nerd`) — 후속 (아래 「후속」)

---

## Existing Patterns / Source of Truth

- **워크플로별 `paths` 화이트리스트 + 교집합 0** — 이미 `deploy.yml` / `deploy-db.yml` / `deploy-redis.yml` 3개가 이 패턴이다 ([`deploy.md` 「독립 배포」](../deploy.md)). 모노레포는 이 표에 **행을 추가**하는 일이다.
- **프론트 배포 파이프라인은 이미 완성돼 있다** — Dockerfile(deps→builder→runner, standalone) · `infra/docker-stack.app.yml` · `ci.yml`/`deploy.yml` · 헬스체크. Step 1~5 완료, **PR #3 머지로 9월 1일 운영 배포까지 성공**(`prod_nerd_front` 3/3 healthy). 문서상 Step 6 은 미완 표기지만 Caddy·DNS·무중단 실측 여부만 남았다. 프론트 저장소 `docs/tasks/tasks-frontend-cicd.md` 가 정본.
- **이름 규칙은 확정됐다** — 스택 `prod_nerd_front` · 서비스 `app` · DNS `prod_nerd_front_app` · 이미지 `prod_nerd_front:<sha>` · 라벨 `prod_nerd_front=1`(부여 완료) · 서버 env `nerd-front.prod.env`(생성 완료) · 서버 stack 디렉터리 저장소별 분리 완료 ([`tasks-stack-rename.md`](tasks-stack-rename.md)).
- **"로컬 빌드 성공 ≠ 컨테이너 빌드 성공"** ([lessons 2026-08-26](../lessons.md)) — 빌드 컨텍스트를 바꾸는 이번 작업의 핵심 위험. CI 의 ARM64 빌드 검증 job 이 방어선.
- **`docker ps --filter name=` 은 부분 매칭** ([lessons 2026-09-01](../lessons.md)) — 프론트 워크플로는 이미 라벨 필터, 백엔드는 미전환(후속).

### 2026-09-03 실측 — 두 저장소의 현재 상태

| 항목 | nerd-back | nerd-front |
|---|---|---|
| 패키지 매니저 | `pnpm@10.26.2` (`packageManager`) | `pnpm@10.18.0` |
| Node | `engines >=22` · 이미지 `node:22-bookworm-slim` | engines 없음 · 이미지 동일 · workflow `node-version: 22` |
| lockfile | v9.0 · importer `.` 하나 | v9.0 |
| `pnpm-workspace.yaml` | 없음 | **있음** — `ignoredBuiltDependencies: [sharp, unrs-resolver]` 만 (워크스페이스 정의 없음) |
| Dockerfile 컨텍스트 가정 | 레포 루트 = 패키지 루트 (`COPY package.json pnpm-lock.yaml ./`, `COPY src ./src`) | 동일 가정 |
| 워크플로 | `ci.yml`(paths 없음) · `deploy.yml`(paths) · `deploy-db.yml` · `deploy-redis.yml` | `ci.yml` · `deploy.yml`(paths) |
| 시크릿 (GitHub Env `PROD`) | 10개 | 9개 — 7개는 백엔드와 값 동일, `DEPLOY_STACK_DIR` · `ENV_FILE_PATH` 만 프론트 값 |
| git | `main` a187787, 원격과 동기 | 원격 `main` = **`1aa9484` (PR #3 머지, 2026-09-01 21:46)** = 운영 이미지 태그. 총 12커밋. `feat/frontend-skeleton` 9b0cd9e 는 그 안에 포함. 로컬 클론 `main` 은 11커밋 뒤처짐 |
| prettier | `.prettierrc` + devDep | **없음** |
| 테스트 | jest + supertest | **없음** (의도된 미도입) |
| API 호출 코드 | — | **0건** (설계상 브라우저는 상대경로 `/api/v2/*`) |
| 공유 타입 | — | 없음 |
| CLAUDE.md | 규약 문서 (≤200줄) | `@AGENTS.md` 한 줄. `AGENTS.md` 는 **Next 가 자동 생성**하는 보일러플레이트 |
| 경로 하드코딩 | `.claude/rules/back-code-patterns.md` frontmatter `paths: src/**/*.ts …` · `precompact.sh` 가 `$cwd/docs/handoff` | `tsconfig paths "@/*": ["./*"]` |

---

## Design

### 접근 요지

**앱 디렉터리를 배포 단위와 1:1 로 맞추고, 각 앱을 오늘의 저장소 루트와 똑같이 자급자족하게 둔다.** 그러면 Dockerfile 은 컨텍스트만 `apps/<x>` 로 바꾸고 내용은 손대지 않으며, `paths` 필터는 `apps/<x>/**` 접두사만 붙이면 된다. 워크스페이스는 "한 번에 설치·한 번에 검증" 을 위한 얇은 껍데기다.

이 접근을 가능하게 하는 결정이 **D2 — 패키지별 lockfile** 이다.

### 📌 결정 (2026-09-03) — ✅ 사용자 확정 · ☑ 권장 디폴트를 이견 없이 채택

| # | 항목 | 권장 | 대안 | 근거 |
|---|---|---|---|---|
| D1 ✅ | 디렉터리 | `apps/back` · `apps/front` (패키지명 `nerd-back` · `nerd-front` 유지). **모든 축의 이름을 `back` / `front` 로 통일** — 아래 「이름 통일표」 | 백엔드를 루트에 두고 `apps/front` 만 추가 | 대칭. 비대칭은 "루트 = 백엔드" 가정이 영구화되어 필터·문서·훅이 계속 꼬인다. 디렉터리명은 스택 `prod_nerd_back/front` · 서버 파일 `nerd-back/front.prod.env` 와 1:1 |
| D2 ☑ | lockfile | **패키지별** — `pnpm-workspace.yaml` 에 `sharedWorkspaceLockfile: false` | 공유 lockfile 1개 (pnpm 기본값) | 공유 lockfile 이면 (a) 두 Dockerfile 을 루트 컨텍스트 + `--filter`/`pnpm deploy` 로 다시 짜야 하고 (b) 프론트 의존성 하나 추가가 루트 lockfile 을 바꿔 **백엔드 배포까지 트리거**된다. 패키지별이면 둘 다 사라진다. 잃는 것은 dedup — 공유 패키지 0개인 지금은 의미 없다. **공유 패키지가 생기면 재검토** |
| D3 ☑ | 공유 인프라 위치 | 루트 `infra/` 에 `docker-stack.db.yml` · `docker-stack.redis.yml` · `mysql/` **그대로**. 앱 스택만 `apps/<x>/infra/docker-stack.app.yml` | 전부 루트 `infra/` | DB·Redis 는 두 앱의 공유 자원(프론트 ISR 도입 시 Redis 사용 예정). `deploy-db.yml` · `deploy-redis.yml` 은 서버 경로 변수만 바뀐다(D5) |
| D4 ☑ | 워크플로 | 6개 — `ci-back` `ci-front` `deploy-back` `deploy-front` `deploy-db` `deploy-redis`. 각각 `paths` 화이트리스트 | 단일 워크플로 + changed-files 판별 job | 기존 패턴 그대로 확장. 서드파티 액션 불필요. 워크플로별 concurrency 그룹 분리로 백·프론트 배포가 병렬로 돈다 |
| D5 ✅ (재결정) | 시크릿 · 서버 트리 | 경로 시크릿을 **`DEPLOY_DIR` 1개**로. 서버는 `<DEPLOY_DIR>/stacks/<스택명>.yml` · `<DEPLOY_DIR>/env/<스택명>.env` 규약 — **파일명 = 스택명**. `DEPLOY_STACK_DIR` · `ENV_FILE_PATH` 는 전환 후 삭제. 프론트 전용 시크릿은 만들지 않는다 | (폐기) A: `_FRONT` 2개 추가 · B: `_BACK`/`_FRONT` 4개 | 사용자 결정(2026-09-03): 다운타임 허용, 구조 우선, 경로 시크릿은 공용 1개만. 규약으로 계산하면 앱·스택이 늘어도 시크릿이 늘지 않고, 스택명 하나로 YAML·env·라벨·DNS 를 전부 찾는다. 대가: 4개 배포 워크플로가 모두 바뀌고 머지 시 전부 1회 실행 · 서버 파일 이동(사용자) — 아래 「시크릿 · 서버 디렉터리」절 |
| D6 ☑ | git 이력 | `git subtree add --prefix=apps/front front/main` (GitHub 원격 `main` = `1aa9484`) | `git filter-repo` 로 경로 재작성 후 merge / 이력 없이 복사 | 내장 명령 1회로 11커밋 보존. filter-repo 는 `git log apps/front/…` 가 더 예쁘지만 도구 설치가 필요. 복사는 이력 손실 |
| D7 ✅ | 프론트 배포 시점 | 모노레포 **머지 시 `deploy-front` 가 배포**. ⚠️ 2026-09-03 정정: `prod_nerd_front` 스택이 **9월 1일에 이미 떠 있어** 첫 배포가 아니라 **롤링 재배포**다 (Step 0 확인) | 프론트 저장소에서 먼저 배포해 파이프라인을 검증한 뒤 이관 | 파이프라인은 이미 한 번 성공했다(이미지·스택 존재). 머지 시 `start-first` 롤링 + `failure_action: rollback` 이라 실패해도 이전 이미지로 돌아간다. 백엔드 무영향. Caddy 블록 상태는 Step 0 에서 확인 |
| D8 ☑ | 문서 | 루트 `docs/` 단일 (`deploy.md` · `lessons.md` · `tasks/`). 앱 README 는 앱 디렉터리 | 앱별 `docs/` | SSOT 두 곳 금지. `tasks-frontend-cicd.md` 를 루트 `docs/tasks/` 로 이동 |
| D9 ☑ | CLAUDE.md | 루트(공통) + `apps/back/CLAUDE.md` + `apps/front/CLAUDE.md` + path-scoped rule 2개 | 루트 단일 | 아래 「CLAUDE.md 구조」 |
| D10 ☑ | Turborepo / Nx | **도입하지 않음** | | 앱 2개 · 공유 패키지 0 · 태스크 그래프 없음. 배포 분리는 `paths` 로 달성. **공유 패키지가 생기거나 빌드 캐시가 필요해지면** 재검토 |
| D11 ☑ | pnpm 버전 | `pnpm@10.26.2` 로 통일 (프론트 10.18.0 상향). 루트 + 두 앱 `package.json` 세 곳에 **같은 값** | 루트만 | 워크스페이스는 루트 `packageManager` 를 본다. 앱 `package.json` 에도 두는 이유는 **Dockerfile 의 `corepack enable` 이 앱 컨텍스트에서 앱 package.json 을 읽기 때문** |
| D12 ☑ | Next 트레이싱 루트 | `apps/front/next.config.ts` 에 `outputFileTracingRoot: __dirname` **명시** | 추론에 맡김 | Next 는 lockfile 위치로 워크스페이스 루트를 추론한다. 패키지별 lockfile 이라 지금은 `apps/front` 로 추론되지만, 루트에 lockfile 이 생기는 순간 standalone 이 `.next/standalone/apps/front/server.js` 로 중첩되어 Dockerfile COPY 가 깨진다. 추론에 맡기지 않는다 |
| D13 ☑ | 루트 `package.json` | **의존성 0** · 오케스트레이션 스크립트만 | 루트에 prettier 등 공통 devDep | 루트에 의존성이 생기면 루트 lockfile · `node_modules` 가 생기고 D12 의 추론 위험이 현실화된다. 공통 도구는 각 앱 devDep 으로 |
| D14 ✅ | env 파일 | **로컬**: 앱별 독립 — `apps/back/.env` · `apps/front/.env.local`. **운영**: 서버 env 파일 2개를 앱별로 따로 관리(현행 유지), 위치·이름만 `<DEPLOY_DIR>/env/prod_nerd_back.env` · `prod_nerd_front.env` 로 통일(D5) | 루트 공용 `.env` | 두 앱의 env 는 키가 하나도 겹치지 않고 로딩 시점도 다르다(Nest 는 전부 런타임, Next 는 빌드타임·런타임 혼재). 합치면 프론트 함정(`NEXT_PUBLIC_*` 시점 · `PORT` 무시)이 백엔드 쪽으로 번진다 — 아래 「환경변수 파일」절 |
| D15 ✅ | 프론트 prettier | **후속** — 전환 PR 에 넣지 않는다 | 지금 도입 | prettier 는 포맷 전용이라 없어도 런타임·빌드·CI 에 영향이 없다. 루트 `.prettierrc` 가 프론트 파일에도 "보이지만" 프론트에 prettier 스크립트·devDep 이 없어 아무것도 실행되지 않는다 → **안전**. 단 에디터 format-on-save 가 루트 설정을 집어 잡음 diff 를 만들 수 있으니 전환 직후 별건 PR 로 도입한다 |
| D16 ✅ | 파일 전송 도구 | **`appleboy/scp-action` 유지** (현행). 업로드 전 러너에서 `cp` 로 스택명 파일로 이름을 바꿔 두는 staging 단계 추가 | rsync 로 교체 | 전송 대상이 5KB 안팎 파일 4~5개라 rsync 의 성능(델타 전송)은 체감 0. rsync 의 실질 이점은 `--delete` 로 목적지를 미러링하는 것인데, 워크플로 4개가 **같은 `stacks/` 에 각자 파일 하나씩** 올리므로 `--delete` 를 쓰면 다른 워크플로의 파일을 지운다 → 이점이 사라진다. 검증된 액션을 이유 없이 바꾸지 않는다. scp-action 은 파일 **이름을 바꿔 올릴 수 없어**(`strip_components` 는 디렉터리만 벗긴다) staging `cp` 가 필요하다 — 이건 rsync 라도 같다 |

### 🚧 미결정

**없음 (2026-09-03).** 마지막 3건의 결정:

| 항목 | 결정 | 반영 |
|---|---|---|
| `docs/tasks` 아카이브 | `tasks-ai-config.md` · `tasks-db-mysql.md` 를 `archive/` 로 — **이동 완료 (2026-09-03)**. `tasks-stack-rename.md` 는 서버 정리 절차 11 이 남아 제외 | Step 6 ✅. 근거: [`CLAUDE.md`](../../CLAUDE.md) 「분할 임계치」— `docs/tasks/` 6개 초과 시 완료분 이동. 이동 후 4개, Step 3 에서 프론트 문서가 들어오면 5개 |
| 커밋 scope | **A — 앱 접두** `type(back\|front\|infra\|ci\|repo\|docs): …` | 루트 `CLAUDE.md` Git 절 (Step 6). 아래 「커밋 scope 규칙」 |
| 프론트 저장소 정리 | ~~`feat/frontend-skeleton` → `main` 머지~~ (**이미 완료** — PR #3, 2026-09-01) → README 에 이동 안내 1줄 → **아카이브**(삭제 아님) | Step 7 |

**2026-09-03 사용자 확정** — D1 `apps/back`·`apps/front` · D5 (A안 → 같은 날 **`DEPLOY_DIR` 통합안으로 재결정**) · D7 머지 시 배포(재배포) · D14 env 정책 · D15 prettier 후속 · 위 3건. **이견 없이 디폴트 채택** — D6 subtree · D8~D13 · 저장소 이름 변경(`nerd-back` → `nerd`)은 후속.

### 트레이드오프

- **패키지별 lockfile** — "의존성이 싱글턴" 이라는 pnpm 워크스페이스의 장점을 포기한다. 두 앱이 서로 import 하지 않으므로 지금은 잃는 것이 없다. 공유 패키지가 생기면 그 시점에 공유 lockfile + 루트 컨텍스트 Dockerfile 로 옮기는 비용을 낸다 — 그때는 필요한 것이 분명해진 뒤다.
- **워크플로 6개** — 파일 수는 늘지만 각 파일이 "무엇을 바꾸면 내가 돈다" 를 `paths` 로 스스로 말한다. 단일 워크플로 + 판별 job 은 파일이 하나지만 조건 분기가 늘고 `paths` 표를 코드 밖에서 다시 그려야 한다.
- **머지 = 4개 배포 워크플로 전부 1회 실행** — back·front 는 이미지 재빌드 + 롤링 재배포(코드 무변경, digest 동일 보장 없음), db·redis 는 워크플로 파일이 바뀌어 트리거되지만 스펙 무변경이라 재시작 없음. 사용자가 다운타임을 허용했으므로 이 결합을 받아들이고 구조를 우선한다.

---

## 목표 구조

```
nerd-back/                          ← 저장소 (이름 변경은 후속)
├── package.json                    루트: private · packageManager · engines · 스크립트만 (의존성 0)
├── pnpm-workspace.yaml             packages: [apps/*] · sharedWorkspaceLockfile: false · ignoredBuiltDependencies
├── .prettierrc                     (기존 백엔드 것 — 위치 그대로, 이제 공통)
├── .gitignore                      병합 (앵커 없는 패턴으로)
├── CLAUDE.md                       공통 규약 ≤200줄
├── README.md                       모노레포 지도 · 퀵스타트 · 링크 (신규)
├── .claude/
│   ├── settings.json · hooks/ · templates/ · commands/      (무변경)
│   └── rules/
│       ├── back-code-patterns.md   paths: apps/back/{src,test,scripts}/**/*.ts   (← code-patterns.md 이름 변경)
│       └── front-code-patterns.md  paths: apps/front/**/*.{ts,tsx}                (신규 · 얇게)
├── .github/workflows/
│   ├── ci-back.yml · ci-front.yml
│   ├── deploy-back.yml · deploy-front.yml
│   └── deploy-db.yml · deploy-redis.yml                       (서버 경로 변수만 변경)
├── infra/                          공유 인프라 (무변경)
│   ├── docker-stack.db.yml · docker-stack.redis.yml · mysql/init-users.sh
├── docs/
│   ├── deploy.md · lessons.md
│   ├── tasks/   tasks-monorepo.md · tasks-frontend-cicd.md(← 이동) · …
│   ├── tasks/archive/
│   └── handoff/                    (git 미추적)
├── ideas/                          (무변경)
└── apps/
    ├── back/                       = 오늘의 저장소 루트 그대로
    │   ├── package.json (nerd-back) · pnpm-lock.yaml · Dockerfile · .dockerignore
    │   ├── src/ · test/ · scripts/ · tsconfig*.json · jest.config.js · nest-cli.json · eslint.config.mjs
    │   ├── infra/docker-stack.app.yml
    │   ├── .env.example · .env.migration.example · .env(로컬, 미추적)
    │   ├── CLAUDE.md               백엔드 고유 (Key Patterns · Pitfalls · 명령)
    │   └── README.md               (← 현재 README, 경로 갱신)
    └── front/                      = nerd-front 저장소 (subtree)
        ├── package.json (nerd-front) · pnpm-lock.yaml · Dockerfile · .dockerignore
        ├── app/ · public/ · scripts/ · next.config.ts · tsconfig.json · postcss.config.mjs · eslint.config.mjs
        ├── infra/docker-stack.app.yml
        ├── CLAUDE.md               프론트 고유 + `@AGENTS.md`
        ├── AGENTS.md               (Next 자동 생성 — 손대지 않음)
        └── README.md
```

**프론트에서 합류 시 사라지는 것**: `.github/`(루트 워크플로로 재작성) · `pnpm-workspace.yaml`(설정을 루트로) · `.gitignore`(루트 병합) · `docs/tasks/`(루트로 이동) · `CLAUDE.md` 내용 교체.

### 이름 통일표 — 모든 축에서 `back` / `front`

한 축의 이름을 알면 다른 축의 이름을 파일을 열지 않고 알 수 있어야 한다.

| 축 | 백엔드 | 프론트 | 공유 |
|---|---|---|---|
| 디렉터리 | `apps/back` | `apps/front` | `infra/` (db · redis) |
| 패키지명 (`--filter`) | `nerd-back` | `nerd-front` | 루트 `nerd` |
| 루트 단축 스크립트 | `pnpm back …` | `pnpm front …` | `pnpm ci:core` · `pnpm ci:all` |
| 워크플로 | `ci-back.yml` · `deploy-back.yml` | `ci-front.yml` · `deploy-front.yml` | `deploy-db.yml` · `deploy-redis.yml` |
| concurrency 그룹 | `deploy-back` | `deploy-front` | `deploy-db` · `deploy-redis` |
| Swarm 스택 = 노드 라벨 | `prod_nerd_back` | `prod_nerd_front` | `prod_nerd_db` · `prod_nerd_cache`(**예외** — 라벨 `prod_nerd_redis`) |
| 서비스 DNS | `prod_nerd_back_app:5501` | `prod_nerd_front_app:5502` | `prod_nerd_db_mysql` · `prod_nerd_cache_redis` |
| 이미지 | `prod_nerd_back:<sha>` | `prod_nerd_front:<sha>` | — |
| 서버 stack 파일 | `<DEPLOY_DIR>/stacks/prod_nerd_back.yml` | `<DEPLOY_DIR>/stacks/prod_nerd_front.yml` | `stacks/prod_nerd_db.yml` · `stacks/prod_nerd_cache.yml` · `stacks/mysql/init-users.sh` |
| 서버 env 파일 | `<DEPLOY_DIR>/env/prod_nerd_back.env` | `<DEPLOY_DIR>/env/prod_nerd_front.env` | `env/prod_nerd_db` (비밀번호 백업, 워크플로 미참조) · redis 없음 |
| 시크릿 | 앱별 **0개** | 앱별 **0개** | 공용 9개 — `DEPLOY_DIR` 1개로 경로 전부 계산, `MYSQL_DATA_DIR` 은 DB 전용 |
| CLAUDE.md | `apps/back/CLAUDE.md` | `apps/front/CLAUDE.md` | 루트 `CLAUDE.md` |
| path-scoped rule | `back-code-patterns.md` | `front-code-patterns.md` | — |
| 커밋 scope | `(back)` | `(front)` | `(infra)` `(ci)` `(repo)` `(docs)` |

이미 굳어진 이름(`prod_nerd_cache`, 이미지에 `_app` 접미사 없음)은 **바꾸지 않는다** — [`tasks-stack-rename.md`](tasks-stack-rename.md) 의 결정. 서버 파일은 그 스택명을 그대로 파일명으로 쓰므로 Redis 만 `prod_nerd_cache.yml` 이다 — 예외가 파일명에도 그대로 드러나는 것이 의도다.

### 시크릿 · 서버 디렉터리 — 경로 시크릿을 `DEPLOY_DIR` 하나로 (D5 재결정 · 2026-09-03)

사용자 결정: 다운타임 허용 · 모노레포에 맞게 서버 구조를 깔끔하게 · 경로 시크릿은 공용 1개만. 이전 A안(`_FRONT` 2개 추가)은 **폐기**.

**원칙** — 서버에는 이 프로젝트 전용 트리 **하나**만 두고, 그 안의 **파일명 = 스택명**으로 한다. 시크릿은 트리 루트의 절대경로 하나만 알고, 나머지 경로는 워크플로가 규약으로 계산한다.

```
<DEPLOY_DIR>/                         ← 시크릿 DEPLOY_DIR (절대경로 1개). 이웃 프로젝트 트리와 형제
├── stacks/                           ← CI 가 scp 로 쓴다. 사람은 손대지 않는다
│   ├── prod_nerd_back.yml            ← apps/back/infra/docker-stack.app.yml
│   ├── prod_nerd_front.yml           ← apps/front/infra/docker-stack.app.yml
│   ├── prod_nerd_db.yml              ← infra/docker-stack.db.yml
│   ├── prod_nerd_cache.yml           ← infra/docker-stack.redis.yml   (Redis 스택명이 cache — 예외가 파일명에 드러난다)
│   └── mysql/init-users.sh           ← infra/mysql/init-users.sh      (db.yml 이 ./mysql/ 상대경로로 참조 — 구조 유지)
└── env/                              ← 사람이 쓴다 (600). CI 는 경로만 넘긴다
    ├── prod_nerd_back.env            ← 현 nerd-back.prod.env (230B) 의 복사본
    ├── prod_nerd_front.env           ← 현 nerd-front.prod.env (157B) 의 복사본
    └── prod_nerd_db                  ← DB 비밀번호 백업 (167B) 의 복사본. 워크플로 미참조 · 운영 자산
```

원본 env 디렉터리의 파일은 **전부 그대로 둔다** — 복사만 한다.

```
```

`docker stack deploy -c "$DEPLOY_DIR/stacks/prod_nerd_back.yml" prod_nerd_back` — 파일명과 스택명이 같아 명령을 읽는 순간 대응이 보인다. 스택명은 이미 노드 라벨·서비스 DNS 접두와 같으므로, **이름 하나로 YAML · env · 라벨 · DNS 를 전부 찾는다.**

**시크릿 — 10개 → 9개. 앱이 늘어도 늘지 않는다**

| 시크릿 | 조치 | 비고 |
|---|---|---|
| `REGISTRY_URL` `REGISTRY_USERNAME` `REGISTRY_PASSWORD` `DEPLOY_SERVER` `DEPLOY_USER` `SWARM_MANAGER_SSH_KEY` `OVERLAY_NETWORK` | 유지 | 공용 7개 |
| `MYSQL_DATA_DIR` | 유지 | 블록 볼륨 마운트 경로 — 배포 트리와 무관해 규약으로 계산할 수 없다 |
| **`DEPLOY_DIR`** | **신규** | 위 트리의 절대경로 |
| `DEPLOY_STACK_DIR` · `ENV_FILE_PATH` | **삭제** — 머지 후 스모크 통과 뒤 | `$DEPLOY_DIR/stacks/…` · `$DEPLOY_DIR/env/…` 규약으로 대체 |
| ~~`DEPLOY_STACK_DIR_FRONT`~~ ~~`ENV_FILE_PATH_FRONT`~~ | 만들지 않음 | A안 폐기 |

**워크플로가 규약으로 계산하는 값** — stack YAML 4개는 **내용 무변경**. YAML 안의 `${ENV_FILE_PATH}` 변수명도 그대로 두고 워크플로가 값만 계산해 넣는다.

| 워크플로 | scp target | `docker stack deploy -c` | `ENV_FILE_PATH` 로 넘기는 값 |
|---|---|---|---|
| `deploy-back` | `$DEPLOY_DIR/stacks/prod_nerd_back.yml` | 같은 파일 → 스택 `prod_nerd_back` | `$DEPLOY_DIR/env/prod_nerd_back.env` |
| `deploy-front` | `$DEPLOY_DIR/stacks/prod_nerd_front.yml` | → `prod_nerd_front` | `$DEPLOY_DIR/env/prod_nerd_front.env` |
| `deploy-db` | `…/stacks/prod_nerd_db.yml` + `…/stacks/mysql/init-users.sh` | → `prod_nerd_db` | — (Swarm secret 사용) |
| `deploy-redis` | `…/stacks/prod_nerd_cache.yml` | → `prod_nerd_cache` | — |

`env_file` 은 **`docker stack deploy` 시점에 CLI 가 읽어** 서비스 스펙에 굳힌다. 파일을 옮겨도 이미 떠 있는 서비스는 영향받지 않고, 다음 배포부터 새 경로를 쓴다 — 그래서 서버 준비를 머지 전에 해도 안전하다.

🚫 실제 경로는 이 문서·저장소에 적지 않는다 (인프라 식별 정보). 아래 명령의 `<…>` 는 사용자가 채운다.

**전환 순서**

| # | 누가 | 무엇 | 확인 |
|---|---|---|---|
| 1 | 사용자·서버 | 옛 `prod_nerd` 디렉터리 격리 — `mv nerd _deprecated_nerd_20260901` (`tasks-stack-rename.md` 절차 11). **새 트리가 같은 이름 `nerd/` 를 쓰므로 반드시 먼저** | `docker stack ls` 에 `prod_nerd` 없음 · `ls -la` 로 내용 확인 후 mv |
| 2 | 사용자·서버 | 새 트리 — `mkdir -p nerd/stacks nerd/env`. **전부 `cp`, 원본은 건드리지 않는다**(2026-09-03 사용자 지시 — 옛 env 디렉터리는 그대로 두고, 옛 워크플로의 롤백 경로로도 남는다): `nerd-back.prod.env` → `nerd/env/prod_nerd_back.env` · `nerd-front.prod.env` → `nerd/env/prod_nerd_front.env` · **`prod_nerd_db` → `nerd/env/prod_nerd_db`** (DB 비밀번호 백업 — 워크플로는 참조하지 않지만 운영 자산이므로 같은 트리에 둔다, 이름 유지) · `chmod 600 nerd/env/*`. `stacks/` 는 비워 둔다(CI 가 채운다) | `ls -l nerd/env` — 230B · 157B · 167B · 전부 `-rw-------` |
| 2b | 사용자·서버 (권장) | 원본 `prod_nerd_db` 의 권한이 **`-rw-rw-r--`(664)** — 같은 호스트의 다른 계정도 DB 비밀번호를 읽을 수 있다. 원본을 옮기거나 지우지 않되 **`chmod 600` 한 줄만은 권장**한다. 사용자 판단 | `ls -l` |
| 3 | 사용자·GitHub | `gh secret set DEPLOY_DIR --env PROD --repo kon6443/nerd-back` — 프롬프트에 새 트리 절대경로 붙여넣기 (인자로 넘기지 않는다) | `gh secret list --env PROD --repo kon6443/nerd-back` 에 `DEPLOY_DIR` |
| 4 | 머지 | 배포 워크플로 4개 전부 실행 — back·front 롤링 재배포, db·redis 스펙 무변경 | 4개 모두 스모크 통과 · `ls nerd/stacks` 에 파일 4개 + `mysql/` |
| 5 | 사용자·GitHub | `gh secret delete DEPLOY_STACK_DIR --env PROD …` · `ENV_FILE_PATH` 삭제 | `gh secret list` 9개 |
| 6 | 사용자·서버 | 옛 **stack** 디렉터리 격리 — `nerd-back/` `nerd-front/` → `_deprecated_nerd-back_20260903` 등. **한 달 뒤 삭제.** 옛 **env** 디렉터리는 **건드리지 않는다**(사용자 지시) — 옛 파일 3개는 그대로 남는다 | 격리 후 다음 배포 1회 정상 |

⚠️ **5·6 은 4 의 스모크가 통과한 뒤에만.** 그 전까지 옛 시크릿·옛 디렉터리는 머지 커밋을 revert 했을 때 옛 워크플로가 그대로 도는 롤백 경로다. 옛 env 파일은 영구히 남으므로 `tasks-stack-rename.md` 절차 11 의 "env 파일 격리" 항목은 **하지 않기로 변경**한다(그 문서에 한 줄 덧붙임).

**2026-09-03 서버 실측 (현재 상태)** — stack 트리에 `nerd/prod/`(옛 `prod_nerd`: app·redis YAML) · `nerd-back/prod/`(app·db·redis YAML + `mysql/`) · `nerd-front/prod/`(app YAML) 3개, env 디렉터리는 별도 위치에 `nerd.prod.env`(옛) · `nerd-back.prod.env`(230B) · `nerd-front.prod.env`(157B) 3개. 디렉터리와 env 가 **서로 다른 트리**에 있고 옛 것이 섞여 있어 "무엇이 쓰이는가" 를 시크릿 값을 알아야만 판단할 수 있었다 — 이것이 재구성의 동기다.

**`DEPLOY_DIR` 값** — 현 `DEPLOY_STACK_DIR` 값(`…/infra/nerd-back/prod`)에서 두 단계 위(`…/infra`)에 `nerd` 를 붙인 경로. 즉 옛 `prod_nerd` 디렉터리 자리다(전환 순서 1 에서 비운다).

⚠️ "설정했다" 가 아니라 "파싱된다" 를 확인한다 ([lessons 2026-08-26](../lessons.md)). 여기서는 **머지 직후 4개 워크플로의 scp 단계가 그 검증**이다 — 트리가 없으면 `No such file or directory`, env 파일이 없으면 `docker stack deploy` 가 `env_file … not found` 로 실패한다. 실패해도 떠 있는 서비스는 그대로다(스펙 갱신 전에 멈춘다).

### 환경변수 파일 — 로컬은 앱별, 운영은 기존 그대로 (D14)

| 위치 | 백엔드 | 프론트 | git |
|---|---|---|---|
| 로컬 개발 | `apps/back/.env` (`.env.example` 참고) | `apps/front/.env.local` (Next 규약) | ignore |
| 로컬 예시 | `apps/back/.env.example` · `.env.migration.example` | 없음 — 지금 필요한 로컬 값이 없다 | 커밋 |
| 빌드타임 공개값 | — | `apps/front/.env.production` (**`NEXT_PUBLIC_*` 만**, 지금은 파일 없음) | **커밋** — 파일이 생기는 시점에 루트 `.gitignore` 에 `!apps/front/.env.production` |
| 운영 런타임 비밀 | 서버 `<DEPLOY_DIR>/env/prod_nerd_back.env` | 서버 `<DEPLOY_DIR>/env/prod_nerd_front.env` | 저장소 밖 · 앱별 파일 따로 관리 |
| 운영 런타임 공개값 | `apps/back/infra/docker-stack.app.yml` `environment:` | `apps/front/infra/docker-stack.app.yml` `environment:` | 커밋 |

- **루트에 `.env` 를 두지 않는다.** pnpm 워크스페이스는 env 파일을 읽지 않는다. `pnpm back dev` 는 `pnpm --filter nerd-back dev` 이고 pnpm 은 스크립트를 **그 패키지 디렉터리를 cwd 로** 실행하므로, Nest 의 ConfigModule 은 오늘처럼 `apps/back/.env` 를 찾는다 (Step 1 verify 에서 부팅으로 확인).
- 루트 `.gitignore` 의 `.env` · `.env.*` · `!.env.example` · `!.env.migration.example` 는 어느 깊이든 매칭되어 두 앱을 함께 덮는다. 프론트 `.env.local` 도 여기에 걸린다.
- 프론트 규칙(`NEXT_PUBLIC_*` 는 빌드 시 번들에 박힌다 · `PORT` 는 `.env` 어디에 넣어도 무시된다)은 `tasks-frontend-cicd.md` 「환경변수」절이 정본이다. 여기에 다시 쓰지 않는다.

### 커밋 scope 규칙 (A안 확정 — 2026-09-03)

현행 규칙은 `type(scope): 한국어 설명` 이고 scope 는 모듈명 자유였다. 최근 40커밋 실측: `tasks` 7 · `infra` 4 · `security` `scripts` `db` `config` `claude` 각 2 · `test` `readme` `ai` 각 1.

**현업 관행** — Conventional Commits 는 scope 를 "프로젝트가 정한다" 고만 하고, 모노레포에서는 **패키지·앱 이름을 scope 로 쓰는 것**이 표준적이다 (Angular `fix(router):` · `feat(compiler-cli):`, Nx/Turborepo 계열 `feat(web):` · `fix(api):`). 공통 영역은 `ci` `deps` `repo` `docs` 같은 고정 어휘를 쓰고, 팀이 커지면 commitlint `scope-enum` 으로 강제한다. `back/db` 같은 중첩 scope 는 드물다 — 필터링이 어려워진다. 여기서도 같은 방식이다. commitlint 강제는 새 devDependency 라 **후속**.

모노레포에서는 제목만 보고 **어느 앱의 커밋인가**가 보여야 한다:

| scope | 대상 |
|---|---|
| `back` | `apps/back/**` |
| `front` | `apps/front/**` |
| `infra` | 루트 `infra/**` (db · redis) |
| `ci` | `.github/workflows/**` |
| `repo` | 루트 `package.json` · `pnpm-workspace.yaml` · `.gitignore` · `.prettierrc` · `.claude/**` |
| `docs` | `docs/**` · `CLAUDE.md` · `README.md` |

세부 모듈은 제목 본문으로 — `fix(back): throttler 가 …` · `feat(front): 헬스체크 …`. **한 커밋이 두 scope 에 걸치면 커밋을 나눈다** (한 커밋 = 한 의도 — 기존 규칙). 이점: `git log --oneline | grep '(front)'` 로 앱별 이력이 바로 걸러지고, 두 앱을 동시에 건드린 커밋이 제목에서 드러난다. 이 전환 작업의 커밋부터 적용한다 (예: `chore(repo): pnpm 워크스페이스 뼈대` · `ci: 워크플로를 앱별로 분리`).

### 루트 `package.json` 스크립트

```json
{
  "name": "nerd", "private": true,
  "packageManager": "pnpm@10.26.2",
  "engines": { "node": ">=22" },
  "scripts": {
    "back":    "pnpm --filter nerd-back",
    "front":   "pnpm --filter nerd-front",
    "ci:core": "pnpm -r run ci:core",
    "ci:all":  "pnpm -r run ci:all",
    "lint":    "pnpm -r run lint"
  }
}
```

→ `pnpm back dev` · `pnpm front dev` · `pnpm back test -- --testPathPatterns health` · 루트 `pnpm ci:core` 는 두 앱 모두. 앱 디렉터리로 `cd` 하는 절차를 문서에 쓰지 않는다.

### 무엇을 바꾸면 무엇이 뜨는가 (목표)

`deploy.md` 「독립 배포」 표를 이렇게 확장한다. **교집합 0 을 유지한다.**

| 변경한 것 | 워크플로 | 이미지 빌드 | 재배포 |
|---|---|---|---|
| `apps/back/**` 중 화이트리스트 (`src` `test` `scripts` `Dockerfile` `.dockerignore` `package.json` `pnpm-lock.yaml` `tsconfig*.json` `jest.config.js` `infra/docker-stack.app.yml`) · `.github/workflows/deploy-back.yml` | `deploy-back` | 백 | 백 |
| `apps/front/**` 중 화이트리스트 (`app` `public` `scripts` `Dockerfile` `.dockerignore` `package.json` `pnpm-lock.yaml` `next.config.ts` `tsconfig.json` `postcss.config.mjs` `.env.production` `infra/docker-stack.app.yml`) · `deploy-front.yml` | `deploy-front` | 프론트 | 프론트 |
| `infra/docker-stack.db.yml` · `infra/mysql/**` | `deploy-db` | X | MySQL |
| `infra/docker-stack.redis.yml` | `deploy-redis` | X | Redis |
| 루트 `package.json` · `pnpm-workspace.yaml` · `.prettierrc` · `CLAUDE.md` · `docs/**` · `.claude/**` | (없음) | X | X |

- 루트 워크스페이스 파일은 **컨테이너 컨텍스트 밖**이라 산출물을 바꾸지 못한다. 배포 화이트리스트에 넣지 않는다. 대신 `ci-back` · `ci-front` 의 `paths` 에는 넣어 PR 에서 설치 회귀를 잡는다.
- 프론트 lockfile 변경이 백엔드를 배포하지 않는다 — D2 의 직접 효과.
- 머지 커밋은 모든 앱 파일과 4개 배포 워크플로 파일이 "변경" 이므로 **첫 머지에서 `deploy-back` · `deploy-front` · `deploy-db` · `deploy-redis` 가 모두 돈다.** back·front 는 롤링 재배포, db·redis 는 스펙 무변경이라 재시작 없음. 의도된 동작이다 (D5 · D7).

#### "백·프론트 공통 파일을 바꾸면 둘 다 배포되나?"

**이 설계에서는 두 이미지에 동시에 들어가는 파일이 없다.** 각 이미지의 입력은 `apps/<x>/` 안의 파일뿐이고, 루트 파일(`package.json` · `pnpm-workspace.yaml` · `.prettierrc` · `CLAUDE.md` · `docs/**`)은 어느 이미지에도 들어가지 않는다. 그래서 "공통 파일 수정 → 둘 다 배포" 라는 상황 자체가 **발생하지 않는다.**

둘 다 배포되는 경우는 두 가지뿐이다.

| 경우 | 동작 |
|---|---|
| 한 푸시가 `apps/back` 화이트리스트와 `apps/front` 화이트리스트를 **둘 다** 건드림 | `deploy-back` 과 `deploy-front` 가 **각자 자기 것만** 빌드·배포한다 (병렬, concurrency 그룹이 다르다). 이건 "공통 파일" 이 아니라 "두 앱을 한 번에 바꾼 것" 이다 |
| 첫 머지 | 위와 같다 (모든 앱 파일이 변경으로 잡힌다) |

장래에 `packages/shared` 같은 **진짜 공통 패키지**가 생기면 그때는 둘 다 배포되는 것이 맞는 동작이 된다 — 두 화이트리스트에 `packages/shared/**` 를 넣고, Docker 컨텍스트도 루트로 바꿔야 한다. 그 시점이 D2(lockfile) · D10(오케스트레이터) 재검토 트리거다.

### CLAUDE.md 구조 (D9)

| 파일 | 담는 것 | 로드 시점 |
|---|---|---|
| `CLAUDE.md` (루트, ≤200줄) | 문서 경계 표 · 모노레포 명령 · 자동 라우팅 표 · **공통** Never/Ask · Git 컨벤션 · DoD · 공통 함정(Caddy `route` 순서 · 로컬≠컨테이너 빌드 · HEALTHCHECK 위치 · **세션은 루트에서 연다**(훅이 `$cwd/docs/handoff` 를 쓴다)) | 항상 |
| `apps/back/CLAUDE.md` | Key Patterns 7줄 · Nest/jest/tsconfig/TZ/gwbridge 함정 · 백엔드 고유 Never(E2E `AppModule` · 마이그레이션 실행) · DB 규약 · 명령 | `apps/back/**` 파일을 다룰 때 (Claude Code 가 하위 디렉터리 CLAUDE.md 를 지연 로드) |
| `apps/front/CLAUDE.md` | `@AGENTS.md` + 프론트 고유: `NEXT_PUBLIC_*` 는 `.env.production` 에만(빌드타임) · `PORT` 는 `.env` 불가 · `HOSTNAME=0.0.0.0` · standalone 이 `public`·`.next/static` 을 복사하지 않음 · Caddy matcher 를 `/api/*` 로 넓히지 않음 · 브라우저 API 는 상대경로 `/api/v2/*` · 레플리카 3 → ISR/Server Action 도입 시 Redis·키 고정 필수 · 헬스 경로 이동 시 `check:health-path` | `apps/front/**` 를 다룰 때 |
| `.claude/rules/back-code-patterns.md` | 현재 `code-patterns.md` 그대로, frontmatter `paths` 만 `apps/back/…` | 해당 `.ts` 를 읽는 순간 |
| `.claude/rules/front-code-patterns.md` | 처음엔 얇게 — 위 프론트 CLAUDE.md 항목 중 **코드에서 어기기 쉬운 것**만 (fetch 경로, env 접두사). 규약이 쌓이면 확장 | 해당 `.ts/.tsx` 를 읽는 순간 |

**원칙** — (1) 같은 문장을 두 파일에 쓰지 않는다. 앱 파일에 있으면 루트에서 지운다. (2) 충돌 시 더 구체적인 쪽이 이긴다(기존 규칙 유지). (3) 루트 Never 표에서 `E2E AppModule` · `마이그레이션 실행` 두 행은 백엔드 파일로 내려간다. `인메모리 공유 상태 금지` 는 **프론트에도 해당**(ISR 캐시·Server Action 키)하므로 루트에 남기고 근거를 "레플리카 3 — 두 앱 모두" 로 고친다. (4) 생성 문서(`AGENTS.md`)는 편집하지 않고 import 만 한다.

### README 구조 (D8)

| 파일 | 담는 것 | 안 담는 것 |
|---|---|---|
| `README.md` (루트, 신규) | 무엇이 들어 있나(앱 2 · 공유 인프라 표) · 요구사항(Node 22 · corepack) · 퀵스타트(`pnpm install` → `pnpm back dev` / `pnpm front dev`) · 검증(`pnpm ci:core`) · 배포 한 줄 + `docs/deploy.md` 링크 · 문서 지도 | 앱별 환경변수·명령 상세 · 배포 절차 |
| `apps/back/README.md` | 현재 README 그대로. 명령을 `pnpm back …` 형태로, `scripts/db-tunnel.sh` 등 경로 갱신 | |
| `apps/front/README.md` | 현재 README 그대로 + "CI/CD 는 루트 `.github/workflows/*-front.yml`" | |

---

## Implementation Steps

각 step 은 implement → verify 를 1회 포함한다. **커밋 하나 = step 하나.** 전부 `feat/monorepo` 브랜치에서 하고, 머지 전에는 아무것도 배포되지 않는다.

### Step 0 — 사전 확인 (구현 전, 로컬만)

- [ ] 「미결정」 표 확정
- [x] `git subtree -h` 사용 가능 (2026-09-03 확인) · pnpm 10.26.2 · Node 22.21.1
- [x] **`sharedWorkspaceLockfile: false` 실측 (2026-09-03, 더미 `apps/a`·`apps/b`)** — 앱별 `pnpm-lock.yaml` 생성 ✅ · `pnpm -r run` 이 각 패키지 디렉터리를 cwd 로 실행 ✅ · 루트 스크립트 `pnpm a hello` (`--filter` 별칭) ✅ · `--frozen-lockfile` ✅ · 앱 디렉터리만 복사한 격리 설치(Docker 컨텍스트 흉내) `--frozen-lockfile` ✅. **가정과 다른 것 1건**: 루트에도 `pnpm-lock.yaml`(importer `.: {}` 만) 과 `node_modules/`(`.modules.yaml` · 워크스페이스 상태 파일만) 가 **생긴다**. → 루트 lockfile 은 커밋한다(사실상 불변). **D12 `outputFileTracingRoot` 명시가 선택이 아니라 필수** — Next 가 루트 lockfile 을 보고 워크스페이스 루트를 저장소 루트로 추론할 수 있다
- [x] 프론트 저장소 clean · 전부 push (2026-09-03: 11커밋, 미푸시 0)
- [x] **프론트 스택 존재·상태 확인 (2026-09-03)** — `prod_nerd_front_app` **3/3 · 전부 `(healthy)` · Up 37h · 이미지 태그 `1aa9484`**. 이 태그는 프론트 저장소 **`main` 의 PR #3 머지 커밋**(2026-09-01 21:46, `feat/frontend-skeleton` → `main`)이다. 즉 `main` push → `paths` 매칭 → `deploy.yml` 이 **정상 경로로 한 번 완주**했다(수동 배포 아님). → D7 은 "첫 배포" 가 아니라 **롤링 재배포**. 롤백 태그 = `1aa9484`. 프론트 `main` 은 이미 최신이므로 「프론트 저장소 정리」의 머지 단계는 **이미 끝났다**. 로컬 프론트 클론의 `main` 은 11커밋 뒤처져 있다 — subtree 는 GitHub 원격의 `main` 에서 가져온다(Step 2). `tasks-frontend-cicd.md` 의 "Step 6 미완" 표기는 실제와 어긋나 있으니 Step 3 에서 옮길 때 고친다
- [ ] 프론트 **도메인이 브라우저에서 열리는지** (사용자) — 열리면 Caddy 블록·DNS·인증서까지 끝난 것이고 `tasks-frontend-cicd.md` Step 6 은 무중단 실측만 남는다. 안 열리면 Caddy 블록이 그 문서 Step 6 의 남은 작업이다
- [x] 서버 stack 디렉터리 3개 확인 (2026-09-03) — `nerd/`(옛 `prod_nerd`, 참조 없음 → 절차 11 대상) · `nerd-back/`(app·db·redis·mysql/) · `nerd-front/`(app). 이 실측이 D5 재결정(트리 재구성)의 근거. 「시크릿 · 서버 디렉터리」절 참조
- [x] `feat/monorepo` 브랜치 생성 — `main` a187787 (2026-09-03)

### Step 1 — 백엔드를 `apps/back` 으로 이동 + 워크스페이스 뼈대

- [x] `git mv` (2026-09-03): `src test scripts Dockerfile .dockerignore package.json pnpm-lock.yaml tsconfig.json tsconfig.build.json tsconfig.runtime.json jest.config.js nest-cli.json eslint.config.mjs .env.example .env.migration.example README.md infra/docker-stack.app.yml` → `apps/back/` — 72개 경로, 전부 rename 으로 인식됨
- [x] 루트에 남김: `.claude .github docs ideas infra/{docker-stack.db.yml,docker-stack.redis.yml,mysql} CLAUDE.md .gitignore .prettierrc`
- [x] 신규: 루트 `package.json`(의존성 0 · `back`/`front`/`lint`/`ci:core`/`ci:all`) · `pnpm-workspace.yaml`(`apps/*` · `sharedWorkspaceLockfile: false` · `ignoredBuiltDependencies` 프론트 값 이관) · 루트 `pnpm-lock.yaml`(pnpm 이 생성, 커밋) · `.gitignore` 에 `.stage/`
- [x] 미추적 `.env` → `apps/back/.env` 이동. 루트 `dist/` `coverage/` 는 옛 산출물로 남아 있음(무해, ignore 대상) — **삭제는 사용자 확인 후**. 루트 `node_modules/` 는 `pnpm install` 이 워크스페이스 상태 파일만 남기고 정리했다
- **verify (2026-09-03)**:
  - `pnpm install` ✅ (733 패키지, 4.1s) → `pnpm back ci:core` ✅ — lint 0건 · **jest 10 suites 64 tests 통과** · `tsc` 빌드 성공
  - `docker build --platform linux/arm64 apps/back` ✅ **성공** — Dockerfile 내용 무변경, 컨텍스트만 `apps/back`. 컨테이너 실기동은 `.env.example` 로 띄워 **env 검증 단계까지 도달**(`DB_PASSWORD` 빈 값으로 의도된 중단) — 모듈 해석·`TS_NODE_PROJECT`·`corepack` 이 새 컨텍스트에서 동작. **healthy 까지는 로컬에서 확인 불가**(DB 없이는 설계상 부팅 실패 — D8). 실제 `.env` 를 docker 에 넘기는 것은 권한 규칙이 막는다
  - 로컬 부팅: `pnpm back start:prod` 는 **cwd 가 `apps/back` 으로 잡히고 ConfigModule 이 그 디렉터리의 `.env` 를 읽는다** ✅ — 사용자 실행에서 env 검증을 통과해 DB 접속 단계까지 갔다. **D14(로컬 env 는 앱별 독립)가 동작으로 확인된 셈이다.**
    ⚠️ 정정: AI 세션의 실행이 `REDIS_HOST`·`DB_*` 누락으로 실패한 것은 **`.env` 내용 문제가 아니라 샌드박스가 `**/.env` 읽기를 막은 것**이었다(뒤에 `EPERM: operation not permitted, open '.../.env'` 로 드러남). dotenv 가 읽기 실패를 조용히 넘겨 "파일이 없는 것" 처럼 보였다. **AI 의 로컬 부팅 결과로 env 를 판단하지 않는다.**
    별건: 사용자 실행에서 `'nerd_app'@'localhost'` 접근 거부 — 터널은 3307 인데 `DB_PORT` 가 3306 이라 노트북 로컬 MySQL 에 붙었다([lessons 2026-09-02](../lessons.md) 와 같은 모양). `.env` 의 `DB_PORT` 를 터널 포트와 맞춘다
  - ⚠️ 부수 발견 2건 (**둘 다 이동 전부터 있던 것**)
    1. `pnpm start:prod` 는 `TS_NODE_PROJECT=tsconfig.runtime.json` 없이는 `@config/*` 를 `src/` 로 해석해 `Cannot find module` 로 죽는다. Dockerfile 은 `ENV` 로 넣어 두었지만 README 의 로컬 절차에는 없다 → **후속**(README 또는 스크립트에 반영)
    2. **DB 연결 재시도 10회 중 실제 접속은 1회뿐이었다** — `dataSourceFactory` 가 재시도마다 다시 불리는데 `addTransactionalDataSource` 중복 등록이 거부되어, 2회차부터 접속 전에 죽었다. 코드 결함이므로 게이트로 미루지 않고 **같은 브랜치에서 고쳤다**(`fix(back)` 커밋 · 단위 테스트 3건 · 컨테이너 실측 1회→10회). 경위와 예방 규칙은 [lessons 2026-09-03](../lessons.md) 2건
  - `git log --follow` 이력 확인은 커밋 후 (rename 이 커밋돼야 follow 가 된다)

### Step 2 — 프론트 subtree 합류 (merge 커밋)

- [ ] `git remote add front git@github.com:kon6443/nerd-front.git && git fetch front` — ⚠️ 로컬 `../nerd-front` 를 원격으로 잡지 않는다. 그 클론의 `main` 은 11커밋 뒤처져 있다(2026-09-03 확인)
- [ ] `git subtree add --prefix=apps/front front/main` — `main`(= `1aa9484`, PR #3 머지)을 가져온다. 운영에 떠 있는 이미지 태그와 같은 커밋이라 "무엇이 배포돼 있는가" 와 "무엇을 가져왔는가" 가 일치한다
- **verify**: `git ls-files apps/front | wc -l` = 30 · `git log --oneline --merges -1` 이 subtree merge · 프론트 원본 커밋 12개(11 + PR #3 머지)가 `git log --oneline | grep -c` 로 보인다 · `git log --oneline | grep 1aa9484` 1건

### Step 3 — 프론트를 워크스페이스에 맞춤

- [x] 삭제: `apps/front/pnpm-workspace.yaml` · `apps/front/.gitignore`. **`apps/front/.github/` 는 Step 5 로 미뤘다** — 새 워크플로의 원본이라 지우기 전에 옮겨 써야 한다. 하위 디렉터리의 `.github` 는 GitHub 이 읽지 않아 그때까지 무해하다
- [x] 이동: `tasks-frontend-cicd.md` → `docs/tasks/`. 헤더 상태를 실제와 맞추고(9월 1일 운영 배포 성공 · 남은 것은 Caddy·DNS·무중단 실측) 저장소 간 참조 9곳을 같은 저장소 상대경로로 바꿨다 — `nerd-back 저장소` 표현 잔존 **0건**
- [x] `apps/front/package.json` `packageManager` → `pnpm@10.26.2` (D11)
- [x] `apps/front/next.config.ts` 에 `outputFileTracingRoot: __dirname` (D12) — `next.config.ts` 에서 `__dirname` 이 동작함을 빌드로 확인
- [x] 루트 `.gitignore` 에 `.next/` `out/` `next-env.d.ts` `.vercel` `*.pem` 추가(앵커 없이 — 프론트 원본은 `/.next/` 처럼 루트 앵커라 그대로 옮기면 하위 앱에서 안 먹는다) + `.pnpm-store/`. `.env.production` 이 생기는 시점에 `!apps/front/.env.production` 예외 (지금은 파일이 없다)
- [x] **`apps/front/Dockerfile` 의 COPY 목록에서 `pnpm-workspace.yaml` 제거** — 계획에 없던 필수 수정. 지운 파일을 COPY 하고 있어 컨테이너 빌드가 `failed to compute cache key: "/pnpm-workspace.yaml": not found` 로 깨졌다. **「로컬 빌드 성공 ≠ 컨테이너 빌드 성공」이 그대로 재현된 사례**([lessons 2026-08-26](../lessons.md)) — `pnpm front ci:all` 은 통과하는데 이미지 빌드만 실패했다. 그 파일의 `ignoredBuiltDependencies` 는 빌드 스크립트 실행 여부만 정하고 pnpm 10 은 기본적으로 이를 막으므로 산출물은 같다(아래 sharp 확인)
- **verify (2026-09-03)**
  - `pnpm install`(워크스페이스 전체) ✅ · `pnpm front ci:all` ✅ — lint · `next typegen && tsc --noEmit` · `check:stubs`(6파일) · `check:health-path` · `next build` 전부 통과
  - `.next/standalone/server.js` 가 **최상위** ✅ (`apps/front/` 중첩 없음) — D12 가 실효
  - `docker build --platform linux/arm64 apps/front` ✅ · 컨테이너 실기동: `healthcheck.mjs` exit **0** · `/api/health` **200** · `/` **200** · `/next.svg` **200**(정적 자산 COPY 정상) · env `HOSTNAME=0.0.0.0` `PORT=5502` `TZ=UTC` `MALLOC_ARENA_MAX=2` 주입 확인 · `@img/sharp-linux-arm64@0.35.4` 포함
  - lockfile 은 **둘 다 무변경** (`git status` 에 lockfile 없음)
  - ⚠️ 미검증: 래스터 이미지 최적화 200 — `public/` 이 전부 SVG 라 이번에 확인하지 않았다(2026-09-01 원 저장소 실측은 있다)

### Step 4 — `.claude/` 경로 갱신

- [x] `code-patterns.md` → `back-code-patterns.md`, frontmatter `paths` 를 `apps/back/{src,test,scripts}/**/*.ts` 로. 경로 참조 **10개 파일** 갱신, 옛 경로 grep **0건**. 본문의 비공식 언급(`code-patterns §10` 처럼 절만 가리키는 것)은 그대로 뒀다 — 파일명이 아니라 절 번호를 가리키므로 유효하다
- [x] `front-code-patterns.md` 신규 — 7절 · 스코프는 `apps/front/{app,scripts}` + `next.config.ts`. **코드에서 어기기 쉬운 것만** 담았다(상대경로 API 호출 · `NEXT_PUBLIC_*` 확정 시점 · `PORT` · 레플리카 3 제약 · 헬스체크 · standalone 자산 · 타입). 결정 근거는 `tasks-frontend-cicd.md` 가 SSOT 라고 못박아 중복을 피했다
- [x] `precompact.sh` — **문서화로 끝나지 않았다. 실제 결함을 고쳤다** (별도 `fix(repo)` 커밋). 아래 발견 참조
- **verify (2026-09-03)**: 루트 `pnpm ci:core` **두 앱 통과** (back 11 suites · 67 tests + build · front 빌드) · 훅을 루트 cwd 와 `apps/back` cwd 양쪽에서 실행해 **같은 루트 경로**에 쓰는 것을 확인 · `sh -n` 문법 검사 통과 · `git status` 에 handoff 미노출
  - ⚠️ **rule 자동 주입은 이 세션에서 확정할 수 없다** — path-scoped rule 은 세션 시작 시 스코프가 잡히고 파일을 읽는 시점에 로드된다. **다음 세션에서 `apps/back/src` 의 `.ts` 를 열어 주입을 확인한다**(폴백으로 루트 `CLAUDE.md` 라우팅 표가 있다)
  - ⚠️ 이 단계에서 `node_modules` 가 손상돼 `eslint` 바이너리가 사라졌다 — 앞선 **샌드박스 차단 설치**의 잔재였다(`.pnpm` 가상 스토어가 1개 항목만). 워크스페이스 전체를 지우고 재설치해 복구했고(`.pnpm` 735·356 항목) 그 뒤 검증을 다시 돌렸다. **코드 문제가 아니다**

#### 🔍 발견: 훅이 세션 cwd 를 그대로 써서 하위 디렉터리에 스냅샷을 만들 수 있었다

`precompact.sh` 는 `out_dir="$cwd/docs/handoff"` 였다. 모노레포에서 `apps/back` 에 들어가 세션을 열면 `apps/back/docs/handoff/` 가 생기는데, 루트 `.gitignore` 의 `docs/handoff/` 는 **경로에 슬래시가 있어 루트에만 적용**된다 → 그 스냅샷은 **커밋 대상으로 올라온다.** 핸드오프는 정본이 아니고 대화 내용을 담으므로 커밋되면 안 된다.

- `git rev-parse --show-toplevel` 으로 **저장소 루트**를 구해 거기에 모은다. 작업 트리 변경 수집도 루트 기준으로 바꿨다 — 하위에서 세션을 열어도 다른 앱의 변경이 빠지지 않는다
- 루트 `.gitignore` 를 `**/docs/handoff/` 로 바꿔 **어느 깊이든** 막는다 (이중 방어)
- 이 수정으로 D9 의 "세션은 루트에서 연다" 는 **권고**로 내려간다. 훅이 위치에 의존하지 않으므로 루트 `CLAUDE.md` 에 금지로 적지 않는다

### Step 5 — 워크플로 재작성 ✅ 완료 (2026-09-03)

`ci.yml` · `deploy.yml` 2개 → **6개**. 앱 이름이 파일명에 드러나므로 어느 워크플로가 무엇을 배포하는지 목록만 보고 안다.

- [x] `deploy.yml` → **`deploy-back.yml`** — `paths` 에 `apps/back/` 접두 · buildx `context: apps/back` `file: apps/back/Dockerfile` · scp `.stage/stacks/prod_nerd_back.yml` → `$DEPLOY_DIR/stacks` · `ENV_FILE_PATH=$DEPLOY_DIR/env/prod_nerd_back.env` · concurrency `deploy-back`. **스택·이미지·서비스 이름·스모크 로직 무변경**
- [x] **`deploy-front.yml`** — 프론트 원본을 같은 방식으로 변환. `DEPLOYMENT_VERSION` build-arg · `start_period 60s` 감안한 폴링(3s×40) 유지 · concurrency `deploy-front`
- [x] **`deploy-db.yml`** — 경로만 변경. `mysql/` 하위 구조를 유지해야 한다(`configs.…file: ./mysql/init-users.sh` 가 **YAML 파일이 있는 디렉터리 기준**이라 `stacks/prod_nerd_db.yml` 옆에 `stacks/mysql/init-users.sh` 가 있어야 한다). 사전 점검·SQL 스모크 무변경
- [x] **`deploy-redis.yml`** — 경로만 변경. 파일명이 `prod_nerd_cache.yml` 인 것은 스택명 예외가 파일명에도 드러나는 것이다(의도)
- [x] `ci.yml` → **`ci-back.yml` + `ci-front.yml`** — 각 앱 디렉터리 전체 + 루트 워크스페이스 파일 + 자기 파일. `pnpm install --frozen-lockfile`(워크스페이스 전체) 후 `pnpm --filter <앱> run ci:all`. GHA 캐시 `scope` 를 앱별로 분리했다 — 섞으면 서로의 레이어를 밀어낸다
- [x] 배포 4개 공통 **staging 단계** — scp-action 은 업로드 중 이름을 못 바꾼다(`strip_components` 는 디렉터리만 벗긴다). 러너에서 `.stage/stacks/<스택명>.yml` 로 복사한 뒤 `strip_components: 2` 로 올린다 (D16)
- [x] `DEPLOY_STACK_DIR` · `secrets.ENV_FILE_PATH` 참조 **0건** — 경로는 전부 `DEPLOY_DIR` 에서 규약으로 계산한다
- [x] 스모크 필터는 4개 모두 **라벨 방식**(`label=com.docker.stack.namespace=…`) — 백엔드도 이미 라벨이었다. `tasks-stack-rename.md` 후속 항목은 **이 시점에 닫힌다**

#### 설계 판단 — CI 의 `paths` 는 배포와 성격이 다르다

배포는 **산출물을 바꾸는 파일만** 정확히 잡아 교집합 0 을 유지한다. CI 는 넓게 잡는다 — PR 에서 검증이 안 도는 것이 더 위험하다. 그래서 **루트 워크스페이스 파일(`package.json` · `pnpm-workspace.yaml` · 루트 `pnpm-lock.yaml`)은 두 CI 가 함께 돈다.** 반대로 배포 화이트리스트에는 그 파일들을 **넣지 않았다** — 컨테이너 빌드 컨텍스트가 `apps/<x>` 뿐이라 산출물을 바꿀 수 없다.

⚠️ **paths 필터가 있는 워크플로는 "건드리지 않은 앱" 의 체크를 아예 만들지 않는다.** 브랜치 보호에서 `CI (back)` 을 필수 체크로 걸어 두면 프론트만 바꾼 PR 이 영구히 대기한다. **필수 체크를 설정할 때 이 점을 확인한다** (지금은 미설정으로 파악).

**verify (2026-09-03)**

- YAML 파싱: 6개 전부 통과
- **교집합 0 실측** — glob 을 정규식으로 바꿔 `git ls-files` 전수에 매칭했다. 문자열 비교가 아니라 **파일 단위**로 센다:
  ```bash
  # docs/tasks/tasks-monorepo.md 의 검증 스크립트 (paths → 정규식 → git ls-files 매칭)
  # 결과: 추적 123개 중 배포 트리거 86개 = back 59 · front 22 · db 3 · redis 2, 중복 0개
  ```
  두 개 이상을 트리거하는 파일 **0개** ✅
- 컨테이너 빌드: `context: apps/back` · `context: apps/front` 로 로컬 ARM64 빌드·실기동 확인 (Step 1·3)
- ⚠️ **미검증**: GitHub Actions 에서의 실제 실행. 러너·시크릿·캐시 scope 는 **PR 을 올려야** 확인된다. `DEPLOY_DIR` 이 없으면 배포 4개가 모두 scp 단계에서 실패한다 — Step 7 의 "머지 전 준비" 가 그 전제다

### Step 6 — 문서 · CLAUDE.md · README

- [ ] 루트 `CLAUDE.md` 재구성(공통만, ≤200줄) · `apps/back/CLAUDE.md` · `apps/front/CLAUDE.md` (위 「CLAUDE.md 구조」)
- [ ] 루트 `README.md` 신규 · `apps/back/README.md` · `apps/front/README.md` 경로·명령 갱신
- [ ] `docs/deploy.md`: 파일 위치 · 워크플로 표 · 「무엇을 바꾸면」 표 확장 · 시크릿 12개 · 이름 규칙표의 "저장소" 를 "앱" 으로 (`<앱>.<환경>.env`, 서버 stack 디렉터리 앱별)
- [ ] `tasks-stack-rename.md` 「연동」 줄 갱신
- [x] 아카이브 이동 (2026-09-03 선행) — `tasks-ai-config.md` · `tasks-db-mysql.md` → `docs/tasks/archive/`. 경로 참조 9개 파일 갱신(`README.md` · `.env.example` · `docs/deploy.md` · `.claude/rules/back-code-patterns.md` · `tasks-backend-skeleton.md` · `infra/docker-stack.{db,app}.yml` 주석 등), 갱신 후 옛 경로 `grep` **0건**. `src/` 의 주석 2곳은 경로 없는 파일명만 언급해 손대지 않았다.
  ⚠️ **부수 효과**: `infra/docker-stack.db.yml` 주석 1줄이 바뀌어 **머지 시 `deploy-db` 가 1회 돈다.** 스펙 무변경이라 MySQL 재시작은 없다(2026-09-01 Redis 전례 — 주석은 파싱 후 사라진다). 원치 않으면 그 파일의 주석 수정만 되돌리고 옛 경로를 남긴다
- **verify**: `grep -rn` 전수 — `nerd-front` 저장소 참조 · 루트 기준 `infra/docker-stack.app.yml` · 루트 기준 `src/` `test/` `scripts/` 참조 · `deploy.yml`(구 이름) — 남은 것이 전부 **의도된 과거 기록(lessons)** 인지 하나씩 확인. 파일 단위 제외는 `--exclude` 로 ([lessons 2026-09-01](../lessons.md)) · `wc -l CLAUDE.md` ≤ 200

### Step 7 — GitHub · 서버 (사용자)

- [ ] **머지 전** 서버·GitHub 준비 — 「시크릿 · 서버 디렉터리」 전환 순서 1~3 (옛 `nerd/` 격리 → 새 트리 + env `cp` → `DEPLOY_DIR` 등록). **이게 안 돼 있으면 머지 직후 4개 배포가 전부 scp 에서 실패한다** (떠 있는 서비스는 무사)
- [ ] PR 리뷰 → 머지 → **배포 워크플로 4개 실행 관찰**. 백엔드는 [`deploy.md` 폴링](../deploy.md) 으로 실측(다운타임 허용이지만 재본다), 프론트는 `docker ps --filter label=com.docker.stack.namespace=prod_nerd_front` healthy 3/3, db·redis 는 재시작 없음(`docker service ps` 의 시작 시각 유지) · `ls -R <DEPLOY_DIR>/stacks` 에 파일 4개 + `mysql/`
- [ ] **머지 후** 전환 순서 5~6 — 옛 시크릿 2개 삭제 · 옛 디렉터리·env 격리(한 달 뒤 삭제). `tasks-stack-rename.md` 절차 11 도 이때 함께 닫힌다
- [ ] 프론트 Caddy 블록·DNS — `tasks-frontend-cicd.md` Step 6 이 소유 (이 문서의 완료 조건이 아니다)
- [ ] `kon6443/nerd-front` 정리 (사용자) — (1) ~~`feat/frontend-skeleton` → `main` 머지~~ **완료됨** (PR #3 · 2026-09-01 · `1aa9484`) (2) `README.md` 맨 위에 "이 저장소는 `kon6443/nerd-back` 의 `apps/front` 로 이동했다 (2026-09-xx)" 1줄 커밋 (3) Settings → **Archive this repository**. 삭제하지 않는다 — 이력·시크릿 이름·이슈가 남아야 나중에 대조할 수 있고, 아카이브는 되돌릴 수 있다

### Step 8 — 사후

- [ ] 백엔드 readiness 200 (`db: up`) · 도메인 헬스 200
- [ ] 로컬 명령 문서 ↔ 실제 일치 (`pnpm back dev` · `pnpm back test` · DB 터널)
- [ ] `docs/lessons.md` append (있으면) · 이 문서 → `archive/`

---

## Tests / Verification

- [ ] 로컬: `pnpm install` · 루트 `pnpm ci:core`(두 앱) · `pnpm back ci:all` · `pnpm front ci:all` · `pnpm back dev` 가 `apps/back/.env` 로 부팅
- [ ] 컨테이너: `docker build --platform linux/arm64 apps/back` · `… apps/front` + 실기동 헬스체크 — **로컬 통과를 컨테이너 통과로 포장하지 않는다**
- [ ] `paths` 교집합 0 — 스크립트 결과를 Step 5 에 기록
- [ ] 이력: `git log --follow` (백) · subtree merge 확인 (프론트)
- [ ] 문서: `grep` 전수 · 루트 `CLAUDE.md` 줄 수
- [ ] **검증 못 하는 경로**: 운영 배포는 머지 전엔 검증할 수 없다. `workflow_dispatch` 를 브랜치에서 실행할 수 있는지는 미확인 — 가능하더라도 **백엔드는 브랜치에서 배포하지 않는다**(main 푸시 = 배포 규약). 머지 직후 관찰(Step 7)로 대체한다

---

## Risk & Rollback

| 위험 | 정도 | 완화 |
|---|---|---|
| 컨테이너 컨텍스트 변경으로 COPY 누락 | 높음 | Dockerfile 내용 무변경(D2) · Step 1·3 로컬 ARM64 빌드 + 실기동 · CI ARM64 빌드 job |
| `paths` 누락 — 바꿨는데 배포가 안 된다 | 중간 | 「무엇을 바꾸면」 표 ↔ 6개 파일 대조 · 교집합 0 스크립트 |
| 서버 트리·`DEPLOY_DIR` 준비 전에 머지 → 4개 배포 전부 scp 실패 | 중간 | Step 7 "머지 전" 체크리스트. 실패해도 스펙 갱신 전이라 떠 있는 서비스는 무사 — 준비 후 `workflow_dispatch` 재실행 |
| 옛 `nerd/` 를 비우지 않고 새 트리를 만듦 → 옛 YAML 과 섞임 | 낮음 | 전환 순서 1 을 먼저. `ls nerd/` 가 비어 있는지 확인 후 `mkdir` |
| 옛 시크릿을 너무 일찍 삭제 → revert 롤백 경로 상실 | 중간 | 전환 순서 5 는 4 의 스모크 통과 후에만 |
| Next 가 워크스페이스 루트를 다르게 추론 → standalone 중첩 → 프론트 이미지 기동 실패 | 중간 | `outputFileTracingRoot: __dirname` 명시(D12) · 루트 의존성 0(D13) · Step 3 에서 `server.js` 위치 확인 |
| `packageManager` 3곳 불일치 | 낮음 | Step 5 CI 로그의 `pnpm -v` 확인 · 갱신 시 `grep -rn '"packageManager"'` |
| 머지 시 양쪽 동시 재배포 · 서버 메모리 | 낮음 | 독립 스택 · 프론트 reservations 128M×3 · available 8.7Gi(2026-09-01 실측) |
| 로컬 `.env` 이동 누락 | 낮음 | `pnpm back dev` 가 env 검증에서 즉시 실패한다 |
| 훅·rule 경로 깨짐 | 낮음 | Step 4 수동 확인 · 세션은 루트에서 |
| 프론트 재배포 실패 | 낮음 | 스택이 이미 떠 있어 `start-first` 롤링 + `failure_action: rollback` 이 자동으로 이전 이미지로 되돌린다 · 수동은 `docker service update --rollback prod_nerd_front_app` · 백엔드 무영향 |

**롤백**
- 머지 전: 브랜치 폐기. 운영에 아무 변화 없음.
- 머지 후 백엔드: 코드 무변경이라 `docker service update --rollback prod_nerd_back_app` 으로 옛 이미지 복귀(태그 불변). 저장소는 머지 커밋 `git revert` → 옛 레이아웃·`deploy.yml` 이 돌아와 재배포.
- 머지 후 프론트: `docker service update --rollback prod_nerd_front_app` (9월 1일 이미지로 복귀 — 태그는 Step 0 에서 메모). 스택 자체를 내려도 되면 `docker stack rm prod_nerd_front`.

**운영 영향** — 백엔드·프론트 롤링 재배포 1회씩(무중단 구성이지만 다운타임 허용됨). Redis·MySQL 은 `docker stack deploy` 가 돌지만 스펙 무변경이라 재시작 없음(2026-09-01 Redis 전례). 서버 파일 이동은 떠 있는 서비스에 영향 없음(`env_file` 은 배포 시점에 읽힌다).

---

## 후속 (별건 등재)

- 프론트 prettier 도입 (루트 `.prettierrc` 공유)
- 백엔드 스모크 필터 라벨 전환 (Step 5 선택 항목을 안 했다면)
- 저장소 이름 `nerd-back` → `nerd`
- 공유 패키지(`packages/api-types` 등)가 필요해지는 시점에 D2·D10 재검토
- `tasks-stack-rename.md` 절차 11 (서버 옛 디렉터리·env 정리)

## Verification Story (작업 완료 후 채움)

- 무엇이 어떻게 바뀌었는가:
- 어떻게 동작을 확인했는가:

## Lessons (해당 시)

-

---

> Definition of Done: 글로벌 DoD + [`CLAUDE.md`](../../CLAUDE.md) 의 "Definition of Done (이 프로젝트)" 6항목.
