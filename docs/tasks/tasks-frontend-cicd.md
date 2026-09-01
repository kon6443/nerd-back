# Task Tracker: 프론트엔드 CI/CD 구축

> **상태**: Step 1·2 완료 (포트·설정 · 헬스체크) · Step 3(컨테이너)부터 진행 중
> **작성일**: 2026-09-01
> **대상 브랜치**: `feat/frontend-skeleton`
> **용도**: 이 저장소의 CI/CD·컨테이너·배포 구성의 **결정과 근거**. 진행 상황의 정본은 이 파일이다.

**이 문서가 SSOT 인 것** — 프론트 고유의 결정·근거·진행 상황.
**이 문서가 SSOT 가 아닌 것** — 배포 인프라의 일반 규약(Swarm·Caddy·롤백·이름 규칙)은 `nerd-back` 저장소의 `docs/deploy.md` 가 정본이다. 여기서는 **프론트에서 달라지는 것만** 적고 같은 내용을 다시 쓰지 않는다.

**선행 의존** — 스택 재명명은 `nerd-back` 저장소의 `docs/tasks/tasks-stack-rename.md` 가 소유한다. **이름은 확정됐다.** 다만 그 전환이 끝나기 전에는 `prod_nerd_back_app` 이 실제로 존재하지 않으므로, 이 이름을 참조하는 것(Caddy 블록 · `BACKEND_INTERNAL_URL`)은 전환 이후에 유효해진다.

---

## 📌 결정 사항 요약

| 항목 | 결정 | 근거 |
|---|---|---|
| 컨테이너 포트 | **5502** | 백엔드 5501 과 인접해 프로젝트군 식별. 호스트 publish 가 없어 충돌 회피는 애초에 쟁점이 아니다 |
| 포트 주입 | `PORT` 환경변수 (Next CLI 가 지원) | ⚠️ **`.env` 에 넣으면 동작하지 않는다** — 아래 「포트」절 |
| 빌드 산출물 | `output: 'standalone'` | 이미지에서 `pnpm install` 자체를 제거한다. 백엔드와의 최대 차이 |
| 레플리카 | **3** | 백엔드와 동일. 단일 노드 무중단 배포 |
| 이미지 | 멀티스테이지, `linux/arm64` 단독, 태그 = 커밋 short SHA | 백엔드와 동일 |
| 배포 전 게이트 | `pnpm ci:core` (lint → typecheck → build) | 프론트는 테스트 프레임워크가 없어 `test` 단계가 공집합 |
| 헬스체크 | `app/api/health/route.ts` + `scripts/healthcheck.mjs` | Next 에 기본 헬스 경로가 없다. liveness 만 |
| 환경변수 관리 | **네 군데로 분리** — `.env.production`(공개·빌드) · `.env.local`(로컬) · stack YAML(공개·런타임) · 서버 env 파일(비밀·런타임) | 값의 **성격**과 **확정 시점**이 위치를 정한다 — 아래 「환경변수」절 |
| **URL 배치** | **프론트 전용 도메인의 루트.** 같은 도메인의 `/api/v2/*` 를 Caddy 가 백엔드로 분기 | `basePath` 불필요 · CORS 불필요 · 빌드타임 API URL 불필요 — 아래 「URL 배치」절 |
| API 호출 | 브라우저는 **상대경로** `/api/v2/*` | `NEXT_PUBLIC_*` 와 CORS 를 둘 다 없앤다 |
| 테스트 프레임워크 | **지금은 도입하지 않는다** | `ci:core` = lint → check:types → build. 테스트 도입은 별건으로 등재 |
| 이미지 이름 | `prod_nerd_front:<sha>` (`_app` 접미사 없음) | 이미지는 스택과 다른 네임스페이스다. 경로를 바꾸면 태그 이력이 단절되고 롤백 시 옛 태그를 손으로 찾아야 한다 |
| CI 러너 | **`ubuntu-24.04-arm` (네이티브 arm64)** | 저장소가 public 이라 무료다 (2026-09-01 확인). QEMU 에뮬레이션이 사라진다 — 아래 「배포 속도」 |

---

## 🚧 미결정 · 보류

| 항목 | 왜 막혀 있나 | 결정되면 무엇이 바뀌나 |
|---|---|---|
| ISR / `use cache` 도입 | 기능 미착수 | 도입 시 `cacheHandler` + Redis 가 **필수**가 된다 (아래 「레플리카 3개」절) |
| Server Actions 도입 | 기능 미착수 | 도입 시 `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 고정이 **필수**가 된다 |
| 테스트 프레임워크 (후속) | 지금은 미도입 결정 | 도입하면 `ci:core` 에 `test` 가 들어가고 `check:stubs` 의 `.only` 규칙이 실효를 갖는다 |

---

## 개요

`nerd-back` 이 확립한 배포 패턴(Swarm stack · ARM64 단일 노드 · Caddy · 커밋 SHA 불변 태그 · 배포 전 검증 게이트 · 배포 후 스모크)을 프론트에 이식한다. **그대로 복사하지 않는다** — Next.js 는 백엔드와 다른 제약이 있고, 그 차이가 이 문서의 본론이다.

### 백엔드와 같은 것

`paths` 화이트리스트 트리거 · 커밋 short SHA 불변 태그 · `--provenance=false --sbom=false` · `docker stack deploy --detach=false` 동기 대기 · 배포 후 liveness 폴링 스모크 · `start-first` 롤링 · `failure_action: rollback` · 노드 라벨 핀 · 호스트 publish 없음 · Caddy overlay 내부 접근

### 백엔드와 다른 것

| 축 | 백엔드 | 프론트 | 영향 |
|---|---|---|---|
| 런타임 의존 설치 | 이미지에서 `pnpm install --prod` | **없음** (`standalone` 이 필요한 것만 포함) | 이미지가 작아지고 빌드 단계 하나가 사라진다 |
| 환경변수 확정 시점 | 전부 런타임 | **빌드타임 + 런타임 혼재** | `NEXT_PUBLIC_*` 는 이미지에 박힌다 |
| 정적 자산 | 없음 | `public/` · `.next/static` 을 **수동 COPY** | standalone 이 자동 복사하지 않는다 |
| 네이티브 의존 | 없음 | `sharp`(libvips) — `next/image` | 메모리 위험의 주된 원인 |
| 상태 공유 | Redis (레이트리밋·카운터) | ISR 캐시 · Server Action 키 · deploymentId | 성격이 다른 3종의 다중 인스턴스 문제 |
| 종료 유예 | 기본 10s | **30s 권장** | in-flight 요청 + `after()` 콜백 drain |
| 테스트 | jest + supertest | 없음 | `ci:core` 정의가 달라진다 |

---

## 포트

### 현황 (2026-09-01 실측)

| 확인 | 결과 |
|---|---|
| 소스·설정의 포트 하드코딩 | **0건**. `README.md:17` 의 `http://localhost:3000` 문서 언급이 유일 |
| `process.env.*` 사용 | **0건** |
| `.env` / `.env.local` / `.env.example` | **없음** |
| `package.json` scripts | `next dev` · `next start` — `-p`/`--port` 플래그 없음 |

→ 현재 **Next 기본값 3000 에 100% 암묵 의존**하고 있다. 포트를 바꾸려면 명시 주입이 필요하다.

### Next 16 의 포트 주입 규칙

`next dev` · `next start` 둘 다 `-p, --port <port>` 를 받고 **`env: PORT`** 를 지원한다 (`-H, --hostname` 기본값은 `0.0.0.0`).

> ⚠️ **`PORT` 는 `.env` 에 넣을 수 없다.**
> 공식 문서 원문: *"`PORT` cannot be set in `.env` as booting up the HTTP server happens before any other code is initialized."*
> HTTP 서버 부팅이 env 파일 로딩보다 먼저 일어난다. `.env` 에 `PORT=5502` 를 써도 3000 으로 뜨고, 조용히 어긋난다.

### 적용 방침

```json
"scripts": {
  "dev":   "next dev -p ${PORT:-5502}",
  "start": "next start -p ${PORT:-5502}"
}
```

- `PORT` 가 있으면 그 값, 없으면 5502. **환경변수 우선 + 안전한 기본값**을 한 줄로 만족한다.
- pnpm 은 스크립트를 `sh -c` 로 실행하므로 macOS·Linux 에서 확장된다. ⚠️ Windows `cmd` 에서는 확장되지 않는다 — 팀에 Windows 사용자가 생기면 `cross-env` 도입을 재검토한다.
- **컨테이너에서는 이 스크립트를 쓰지 않는다.** standalone `server.js` 를 직접 실행하며 `ENV PORT` · `ENV HOSTNAME` 이 적용된다.

### 컨테이너에서 반드시 지켜야 할 것

```dockerfile
ENV PORT=5502
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
```

🚫 **`HOSTNAME=0.0.0.0` 을 빠뜨리면 안 된다.** 루프백에만 바인딩되어 overlay 안의 Caddy 가 닿지 못한다. 컨테이너는 정상 기동하고 헬스체크(컨테이너 내부 127.0.0.1)도 통과하므로 **밖에서만 안 되는** 형태로 드러난다 — 가장 찾기 어려운 실패 모양이다.

### 백엔드에 필요한 후속

`nerd-back/.env.example:16` 의 `CORS_ORIGINS=http://localhost:3000` → `http://localhost:5502`.
로컬 개발에서 프론트가 백엔드를 직접 부를 때만 필요하다. 상용은 같은 도메인 경유라 CORS 자체가 발생하지 않는다.

---

## 환경변수

백엔드와 **결정적으로 다른 지점**: Next 는 `NEXT_PUBLIC_*` 를 `next build` 시점에 클라이언트 번들에 **인라인**한다. 서버상의 `env_file` 로 런타임 주입해도 브라우저 번들에는 반영되지 않는다. 저장 위치의 문제가 아니라 **값이 확정되는 시점**의 문제다.

### 빌드타임 (Docker build-arg → CI 주입)

| 변수 | 값 | 비고 |
|---|---|---|
| `DEPLOYMENT_VERSION` | 커밋 short SHA | `next.config.ts` 의 `deploymentId`. 이미지 태그와 **같은 값** |
| `NEXT_TELEMETRY_DISABLED` | `1` | 빌드·런타임 모두 |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | base64 32B | **Server Action 도입 시에만.** build-arg 는 `docker history` 에 평문으로 남으므로 BuildKit `--secret` 을 쓴다 |

### 런타임 (stack YAML `environment:`)

| 변수 | 값 | 비밀? |
|---|---|---|
| `NODE_ENV` | `production` | 아니오 (Dockerfile `ENV` 로 고정) |
| `PORT` | `5502` | 아니오 |
| `HOSTNAME` | `0.0.0.0` | 아니오 |
| `TZ` | `UTC` | 아니오 |
| `NODE_OPTIONS` | `--max-old-space-size=384` (limits 512M 의 75%) | 아니오 |
| `MALLOC_ARENA_MAX` | `2` | 아니오 |
| `BACKEND_INTERNAL_URL` | `http://prod_nerd_back_app:5501` | 아니오 (서버 컴포넌트 전용) |
| `TASK_SLOT` | `{{.Task.Slot}}` | 아니오 (Swarm 주입, 지금은 자리만) |

### 값이 사는 곳 — 네 군데

값의 **성격**(공개/비밀)과 **확정 시점**(빌드/런타임)이 위치를 정한다. 이 둘을 섞으면 반드시 사고가 난다.

| 위치 | 담는 것 | 시점 | git |
|---|---|---|---|
| `.env.production` | **`NEXT_PUBLIC_*` 만** | 빌드타임 | **커밋한다** |
| `.env.local` | 로컬 개발용 전부 | 로컬 | ignore |
| stack YAML `environment:` | 비밀 **아닌** 런타임 값 | 런타임 | 커밋한다 |
| 서버 `nerd-front.prod.env` | **민감한** 런타임 값 | 런타임 | 저장소에 두지 않는다 |

#### 🚫 이 구조의 가장 위험한 함정

**서버 env 파일에 `NEXT_PUBLIC_*` 를 넣어도 브라우저에는 반영되지 않는다.**

"환경변수는 서버에서 관리한다"고 생각하는 순간 `NEXT_PUBLIC_*` 값을 서버 파일에 넣게 되는데, 그 값은 **이미 빌드 시점에 번들에 박혔다.** 서버 파일은 서버 프로세스의 `process.env` 만 바꾼다. 증상은 "설정했는데 브라우저에서 `undefined`" 이고, 원인이 파일이 아니라 **시점**에 있어 찾기 어렵다.

→ **`NEXT_PUBLIC_` 접두사가 붙은 값은 `.env.production` 에만 둔다.** 다른 곳에서 보이면 잘못 놓인 것이다.

#### `.env.production` 을 커밋하는 이유

`next build` 가 읽으려면 **Docker 빌드 컨텍스트에 있어야** 한다. 그리고 `NEXT_PUBLIC_*` 는 정의상 브라우저가 받는 값이라 **숨길 수 없으므로** 커밋해도 잃는 것이 없다.

```gitignore
.env*
!.env.production        # NEXT_PUBLIC_ 전용 — 아래 경고를 반드시 읽을 것
```

🚫 **이 저장소는 public 이다** (2026-09-01 확인). 이 파일에 비밀을 넣으면 커밋 이력에 영구 보존될 뿐 아니라 **즉시 전 세계에 공개된다.** 되돌리려면 이력 재작성과 자격증명 폐기가 필요하다. 파일 첫 줄에 이 경고를 주석으로 박아 둔다.

🚫 **도메인도 넣지 않는다.** `NEXT_PUBLIC_*` 는 브라우저에 노출되니 "비밀"은 아니지만, 백엔드 `CLAUDE.md` 는 **도메인을 인프라 식별 정보로 분류해 커밋을 금지**한다. 이웃 프로젝트 `next-bun` 이 `.env.build` 에 운영 도메인을 평문 커밋하고 소스에도 fallback 으로 하드코딩한 사례가 있다 — 재현하지 않는다.
지금은 브라우저가 **상대경로** `/api/v2/*` 를 쓰기로 해서 도메인이 필요한 값 자체가 없다. 필요해지면 CI 시크릿 → build-arg 로 주입한다.

⚠️ `.dockerignore` 에도 같은 예외가 필요하다. 백엔드는 `.env.*` 제외 + `!.env.example` 구조인데, 프론트는 `!.env.production` 이다.

#### `.env` 가 아니라 `.env.local` 인 이유

`.env` 는 **프로덕션 빌드에서도 로드된다.** `.env.production` 에 없고 `.env` 에만 있는 키가 있으면 상용 번들에 개발 값이 섞인다. `.env.local` 은 이름이 의도를 드러내고 Next 공식 권장이기도 하다.

어느 쪽이든 **`.dockerignore` 에 넣는 것이 실제 방어선**이다 — 빌드 컨텍스트에 없으면 애초에 로드될 수 없다.

⚠️ **`PORT` 는 `.env` 계열 어디에 넣어도 무시된다.** 포트는 `package.json` scripts 가 소유한다 (위 「포트」절).

#### 비밀은 컨테이너 env 에 들어가면 평문 조회된다

`environment:` 든 `env_file` 이든 `docker inspect` 로 보인다. 서버 접근 권한자에게는 어차피 노출되므로, 진짜 격리가 필요하면 `docker secret`(`/run/secrets/` 마운트)뿐이다. 지금 수준에서는 서버 env 파일로 충분하되, **유출 시 피해가 큰 값(외부 API 키·DB 자격증명)이 생기면 그때 재검토**한다.

### GitHub Environment `PROD` 시크릿 9개

저장소 단위라 백엔드 것이 공유되지 않는다. **이 저장소에 따로 등록**한다. 백엔드와 같은 이름·같은 개수이고 값은 2개만 다르다.

| 시크릿 | 백엔드와 | 상태 |
|---|---|---|
| `REGISTRY_URL` `REGISTRY_USERNAME` `REGISTRY_PASSWORD` | 동일 | ✅ 2026-09-01 |
| `DEPLOY_SERVER` `DEPLOY_USER` `SWARM_MANAGER_SSH_KEY` | 동일 | ✅ 2026-09-01 |
| `OVERLAY_NETWORK` | 동일 | ✅ 2026-09-01 |
| `DEPLOY_STACK_DIR` | **프론트 전용 경로** | ✅ 2026-09-01 |
| `ENV_FILE_PATH` | **프론트 전용 `nerd-front.prod.env`** | ✅ 2026-09-01 |

⚠️ **`env_file` 이 가리키는 파일이 서버에 없으면 `docker stack deploy` 가 실패한다.** 지금은 담을 비밀이 없더라도 **주석만 있는 파일을 미리 만들어 둔다.** 백엔드 env 파일과 같은 디렉터리에 `nerd-front.prod.env` 로 두고 권한은 `600` 으로 맞춘다.

⚠️ SSH 키는 등록 **전에** 로컬에서 접속을 검증한다 — `ssh -i <키> <user>@<host> 'echo ok'`. 복사는 드래그하지 말고 `pbcopy < <키파일>` 로 한다(줄바꿈 보존). 시크릿은 write-only 라 등록 후 값을 다시 읽어 확인할 수 없고, 확인 수단이 배포 실패뿐이다 (백엔드 lessons 2026-08-26).

### API base URL 을 만들지 않는다

브라우저에서 `fetch('/api/v2/...')` **상대경로**를 쓰면:

- 빌드타임 env 가 불필요 → 이미지 하나를 모든 환경에 승격 가능
- **CORS 가 발생하지 않는다** → 상용에서 백엔드 `CORS_ORIGINS` 를 비워둘 수 있다
- Caddy 가 이미 `/api/v2/*` 를 백엔드로 보내므로 추가 라우팅이 없다

전제는 아래 「URL 배치」가 만족시킨다.
서버 컴포넌트에서 부를 때만 절대 URL 이 필요하고, 그때는 `BACKEND_INTERNAL_URL` 로 overlay 직통 — Caddy·TLS·공인 DNS 를 우회해 더 빠르고 더 안전하다.

---

## URL 배치

**프론트 전용 도메인의 루트를 프론트가 차지하고, 같은 도메인의 `/api/v2/*` 만 Caddy 가 백엔드로 분기한다.**

🚫 실제 도메인은 이 저장소에 적지 않는다. 아래는 구조만 나타낸다.

```
<프론트 도메인>/api/v2/*   →  prod_nerd_back_app:5501    (백엔드 · Swagger 포함)
<프론트 도메인>/*          →  prod_nerd_front_app:5502   (프론트 · catch-all)
```

### 이 배치가 없애는 것

| 없어지는 것 | 왜 |
|---|---|
| `basePath` · `assetPrefix` | 프론트가 루트를 차지하므로 Next 기본 동작 그대로 |
| CORS | 브라우저에서 보면 프론트와 API 가 **같은 오리진**이다. 상용에서 백엔드 `CORS_ORIGINS` 를 비워둘 수 있다 |
| `NEXT_PUBLIC_API_BASE_URL` | 상대경로 `fetch('/api/v2/...')` 로 충분 → 빌드타임 env 가 하나 줄고 이미지가 환경 독립이 된다 |

### ⚠️ Caddy 작성 순서

**`route` 블록 안에서는 작성 순서가 곧 평가 순서다.** 프론트가 catch-all 이므로 위에 두면 `/api/v2/*` 가 **절대 도달하지 않는다.** 실제로 이 순서를 어겨 요청이 엉뚱한 프로젝트로 흘러간 전례가 있다 (백엔드 `docs/deploy.md`).

```caddy
route {
    handle /api/v2/* { reverse_proxy ... }   ← 반드시 위
    handle           { reverse_proxy ... }   ← catch-all 은 항상 마지막
}
```

`route` **밖**에서는 Caddy 가 matcher 구체성 순으로 정렬하므로 이 함정이 없다. **작업 전에 `route` 안인지 밖인지를 먼저 확인한다.**

### 확인된 사항

- **스트리밍** — Caddy `reverse_proxy` 는 응답을 버퍼링하지 않으므로 Next 의 streaming SSR·Suspense 가 그대로 동작한다. nginx 처럼 `X-Accel-Buffering` 을 따로 끌 필요가 없다.
- **HTTPS** — Caddy 자동 인증서(HTTP-01)로 서브도메인 하나는 그대로 발급된다. 와일드카드가 아니므로 DNS-01 설정이 필요 없다.
- **경로 충돌** — 프론트 헬스체크는 **`/api/health`**, 백엔드는 `/api/v2/health` 다. Caddy 가 `/api/v2/*` 만 백엔드로 보내므로 겹치지 않는다.
  🚫 **그 matcher 를 `/api/*` 로 넓히지 않는다.** 넓히는 순간 프론트 헬스체크가 백엔드로 흘러가고, 프론트 컨테이너는 **영원히 unhealthy** 가 되어 재시작 루프에 빠진다. 백엔드에 새 최상위 API 경로가 필요하면 `/api/v2` 아래에 두거나 별도 matcher 를 **명시적으로** 추가한다.
- **`/_next/*` 정적 자산** — catch-all 로 프론트에 도달한다. 별도 매처가 필요 없다.

---

## 레플리카 3개가 프론트에 강제하는 것

백엔드의 「인메모리 상태 금지 → Redis」에 대응하는 프론트 규칙이다. 셋 다 Next 공식 self-hosting 문서가 명시한 다중 인스턴스 요구사항이다.

| # | 항목 | 레플리카 3 + `start-first` 에서 무슨 일이 | 조치 | 지금 필요? |
|---|---|---|---|---|
| 1 | **`deploymentId` 미설정** | 롤링 중 구/신 이미지 공존 → 클라이언트가 사라진 JS/CSS 청크를 요청 (version skew) | `deploymentId: process.env.DEPLOYMENT_VERSION`, 커밋 SHA 주입 | **예 — 즉시** |
| 2 | **ISR/Data Cache 가 인스턴스별** | 기본 캐시가 각 컨테이너의 메모리+로컬 디스크. `revalidateTag()` 가 자기 레플리카만 무효화 → 3개가 서로 다른 내용을 서빙 | `cacheHandler` + `cacheMaxMemorySize: 0`, Redis 백엔드. `refreshTags()` 구현 | ISR·`use cache` 도입 시 |
| 3 | **Server Action 암호화 키가 빌드마다 랜덤** | 구 인스턴스가 발급한 Action 을 신 인스턴스가 복호화 못 함 → `Failed to find Server Action` | `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 고정 | Server Action 도입 시 |

**Redis 는 이미 있다** — 2번이 필요해지면 새 인프라 없이 붙일 수 있다. 서비스 DNS 는 재명명 후 값을 `tasks-stack-rename.md` 에서 확인한다.

### `stop_grace_period: 30s`

Next 공식 문서: SIGTERM 후 in-flight 요청과 `after()` 콜백 완료까지 **10~30초 drain** 을 권장한다. Swarm 기본은 10초다. 백엔드 stack YAML 에도 명시가 없으므로 이 항목은 **양쪽 모두의 개선 대상**이다.

---

## 메모리 — 프론트가 백엔드보다 위험하다

### 왜 위험한가 (4가지)

1. **SSR 은 요청당 힙 할당이 크다** — React 서버 렌더링은 컴포넌트 트리를 메모리에 구성한다. 백엔드의 JSON 직렬화와 자릿수가 다르다.
2. **Next 인메모리 캐시 기본 50MB** — `cacheMaxMemorySize` 기본값. 레플리카마다 별도이므로 3개면 캐시로만 150MB.
3. **`sharp`/libvips 는 V8 힙 밖에서 할당한다** — `next/image` 최적화는 디코딩→리사이즈→인코딩을 네이티브에서 수행한다. 큰 이미지 하나가 수십~수백 MB 를 순간 할당하고, **`--max-old-space-size` 로 막을 수 없다.**
4. **glibc malloc arena 단편화** — sharp 공식 문서가 경고하는 항목. 멀티스레드 네이티브 할당이 arena 를 늘려 **RSS 가 반환되지 않고 계속 증가**한다. 즉시 터지지 않고 며칠 뒤 OOM 되는 형태라 원인 추적이 어렵다.

현재 `app/page.tsx` 가 `next/image` 를 쓰고 있다 (1·7·48행). 3·4번이 이미 해당된다.

### OOM 이 나면 무슨 일이 벌어지나

```
limits.memory 초과
  → 커널 OOM Killer 가 프로세스 종료 (exit 137)
  → healthcheck 실패
  → Swarm 이 태스크 교체
  → 배포 중이었다면 failure_action: rollback 발동 → 배포가 되돌아간다
```

백엔드와 달리 프론트는 **트래픽 패턴(큰 이미지 요청)에 따라 갑자기** 터질 수 있다. 평시에 안정적이라는 것이 안전을 뜻하지 않는다.

### 대응

| 조치 | 값 | 무엇을 막나 |
|---|---|---|
| `NODE_OPTIONS=--max-old-space-size` | `limits.memory` × 약 0.7 | V8 이 컨테이너 한도를 넘겨 힙을 키우는 것 |
| `MALLOC_ARENA_MAX=2` | | glibc arena 단편화 (sharp 공식 권장) |
| `cacheMaxMemorySize: 0` | cacheHandler 도입 시 | 인메모리 캐시 50MB × 3 |
| `images.minimumCacheTTL` 상향 | | 재최적화 빈도 |
| `unoptimized: true` 또는 외부 loader | | sharp 리스크를 통째로 제거 (최후 수단) |

### 노드 전체 계산 (2026-09-01 실측)

`reservations` 합계가 노드 가용 메모리를 넘으면 **스케줄링 자체가 실패**한다 (`no suitable node`). `limits` 는 상한이라 넘어도 배치는 되지만 OOM 위험이 커진다.

| 항목 | 값 |
|---|---|
| 노드 메모리 | total 11Gi · used 2.9Gi · **available 8.7Gi** |
| 기존 스택 | 7개 (`infra` · `monitor_shared` · `prod_monitor` · `prod_nerd` · `prod_nerd_cache` · `prod_nest` · `prod_next`) |

프론트 3 레플리카를 추가해도 여유가 있다 → **`limits 640M / reservations 192M` 으로 시작한다** (백엔드와 동일).

```
백엔드 앱  3 × 192M = 576M      (limits 최악 1,920M)
프론트     3 × 192M = 576M      (limits 최악 1,920M)
Redis      1 ×  64M =  64M      (limits 최악   192M)
                     ────────
     reservations 1,216M · limits 최악 4,032M   vs   available 8.7Gi
```

⚠️ 우리 것을 뺀 **나머지 5개 스택(11개 서비스)** 의 예약량은 확인하지 않았다. **Step 3 에서 `docker stats` 로 유휴 RSS 를 실측**해 이 값이 과도한지 확인하고 조정한다 — 추정으로 확정하지 않는다.

---

## Dockerfile 설계 — 캐시와 이미지 크기

### 스테이지 구성

```
deps    : package.json + pnpm-lock.yaml 만 COPY → pnpm install (전체)
builder : deps 의 node_modules + 소스 → next build → .next/standalone
runner  : standalone + public + .next/static 만 COPY. install 없음
```

**runner 에서 `pnpm install` 을 하지 않는다.** 이것이 백엔드 Dockerfile 과의 최대 차이다. `output: 'standalone'` 이 `@vercel/nft` 로 실제 사용되는 파일만 추린 `node_modules` 를 `.next/standalone` 안에 만들어 준다.

### 캐시 전략

| 층 | 수단 | 효과 |
|---|---|---|
| 레이어 캐시 | lockfile 만 먼저 COPY → install → 소스 COPY | 소스만 바뀌면 의존 설치 레이어가 그대로 재사용 |
| 레지스트리 캐시 | `cache-from: type=gha` / `cache-to: type=gha,mode=max` | 러너가 매번 새 VM 이어도 레이어를 가져온다 (백엔드가 이미 사용) |
| pnpm store | `RUN --mount=type=cache,target=/pnpm/store` | ⚠️ **GHA 에서는 유지되지 않는다** — 아래 주의 |
| Next 빌드 캐시 | Turbopack 파일시스템 캐시 (Next 16 기본 활성) | 반복 빌드 가속 |

⚠️ **BuildKit `--mount=type=cache` 는 `type=gha` 캐시로 export 되지 않는다.** 마운트 캐시는 빌더 로컬 상태이고 GHA 러너는 매 실행이 새 VM 이다. 로컬 반복 빌드에는 크게 도움이 되지만 **CI 시간 단축을 기대하면 안 된다.** CI 는 레이어 캐시(`type=gha`)에 의존한다.

### 반드시 넣을 것

| 항목 | 이유 |
|---|---|
| `COPY public ./public` · `COPY .next/static ./.next/static` | **standalone 이 자동 복사하지 않는다.** 빠뜨리면 CSS·이미지·JS 청크가 전부 404 |
| 🚫 `outputFileTracingIncludes` 로 sharp 를 강제 포함하지 **않는다** | 공식 문서 예시(`node_modules/sharp/**/*`)는 **pnpm 에서 아무것도 매칭하지 못한다** — 최상위에 그 경로가 없다. 기본 트레이싱이 이미 담는다 (2026-09-01 실측) |
| `ENV MALLOC_ARENA_MAX=2` | glibc(`bookworm-slim`) + sharp 메모리 증가 억제 |
| `USER node` + `COPY --chown=node:node` | 루트로 돌리지 않는다 (백엔드와 동일) |
| `.dockerignore` 에 `.next` · `node_modules` | 로컬 산출물이 컨텍스트로 들어가면 캐시가 매번 깨진다 |
| 🚫 `HEALTHCHECK` 을 Dockerfile 에 두지 않음 | stack YAML 한 곳에서만 정의 (백엔드 규약) |

### sharp / ARM64 — 2026-09-01 실측 완료

`pnpm-lock.yaml` 에 `@img/sharp-linux-arm64@0.35.4` + `@img/sharp-libvips-linux-arm64@1.3.3` 이 있다. `node:22-bookworm-slim` 은 glibc 이므로 `-gnu` 계열이 맞고, `@next/swc-linux-arm64-gnu@16.3.3` 도 있다.

**로컬(darwin-arm64)에서 standalone 을 띄워 확정한 것:**

| 확인 | 결과 |
|---|---|
| standalone 에 sharp 포함 | ✅ `.pnpm/sharp@0.35.4/…` + `@img/sharp-darwin-arm64` 네이티브 바이너리까지 |
| `outputFileTracingIncludes` 없이도 | ✅ 포함됨 — **기본 트레이싱이 pnpm 격리 경로를 따라간다** |
| 래스터 이미지 최적화 | ✅ `/_next/image?url=/probe.png` → **200 `image/png`** |
| `ignoredBuiltDependencies` 영향 | ✅ 없음 — sharp 0.33+ 는 prebuilt 를 optional dep 로 받아 postinstall 이 필요 없다 |

⚠️ 로컬은 `darwin-arm64`, 컨테이너는 `linux-arm64` 바이너리가 담긴다. **컨테이너 안에서 `pnpm install` 하므로 플랫폼이 자동으로 맞는다** — 다만 Step 3 에서 실제 이미지로 한 번 더 확인한다.

⚠️ SVG 는 최적화 경로를 타지 않는다 (`dangerouslyAllowSVG` 기본 비활성 → 400). 현재 `public/` 이 전부 SVG 라 **평소에는 sharp 가 안 쓰인다** — 래스터 이미지를 추가하는 순간부터 쓰인다.

---

## CI/CD 워크플로 설계

### 파일

| 파일 | 트리거 | 하는 일 |
|---|---|---|
| `.github/workflows/ci.yml` | PR · `main` 외 브랜치 푸시 | `ci:all` + ARM64 이미지 빌드 검증 (push 없음) |
| `.github/workflows/deploy.yml` | `main` 푸시 (`paths` 화이트리스트) · `workflow_dispatch` | verify → buildx → push → stack 전송 → deploy → 스모크 |

### `paths` 화이트리스트

```yaml
paths:
  - 'app/**'
  - 'public/**'
  - 'scripts/**'
  - 'Dockerfile'
  - '.dockerignore'
  - 'package.json'
  - 'pnpm-lock.yaml'
  - 'pnpm-workspace.yaml'
  - 'next.config.ts'
  - 'tsconfig.json'
  - 'postcss.config.mjs'
  - 'infra/docker-stack.app.yml'
  - '.github/workflows/deploy.yml'
```

`paths-ignore` 를 쓰지 않는다 — 머지 커밋 평가에서 의도 외 트리거가 발생한다 (백엔드 규약).

### 중복 빌드 제거

백엔드는 `verify` job 이 `pnpm build` 를 돌리고 `deploy` job 의 Docker 빌드가 **같은 빌드를 한 번 더** 한다. 프론트는 `next build` 가 훨씬 무거우므로 그대로 두면 손해가 크다.

```
verify : lint + check:types           ← 빠르고 빌드를 포함하지 않는다
deploy : Docker 빌드가 next build 를 담당  ← 빌드 실패는 여기서 배포 실패로 드러난다
```

`ci:core` 스크립트 자체는 로컬·PR 용으로 `lint → check:types → build` 를 유지한다. 워크플로에서만 분리한다.

### 스크립트 (`package.json`)

```
lint         : eslint
check:types  : next typegen && tsc --noEmit
check:stubs  : node scripts/check-stubs.mjs
build        : next build
ci:core      : lint → check:types → build
ci:all       : lint → check:types → check:stubs → build
```

⚠️ `next typegen` 이 선행되어야 한다. Next 16 은 라우트 타입을 `.next/types` 에 생성하는데, 이게 없으면 `tsc --noEmit` 이 라우트 타입을 검증하지 못한다. 공식 문서가 CI 용으로 `next typegen && tsc --noEmit` 을 명시한다.

### 배포 속도 — 가장 큰 레버는 네이티브 arm64 러너다

**`runs-on: ubuntu-24.04-arm` 을 쓴다.** 저장소가 public 이므로 무료다 (2026-09-01 확인, GitHub 2025-08 GA · 4vCPU).

백엔드는 `ubuntu-latest` + QEMU 로 arm64 를 에뮬레이션한다. 네이티브 러너를 쓰면 그 계층이 통째로 사라지고, **Next 빌드는 CPU 집약적이라 백엔드보다 이득이 훨씬 크다.**

```yaml
jobs:
  deploy:
    runs-on: ubuntu-24.04-arm      # 네이티브 arm64
```

- **`docker/setup-qemu-action` 이 불필요하다** — 네이티브라 에뮬레이션 계층이 없다. 단계를 지운다
- `platforms: linux/arm64` 는 명시해 둔다 (러너가 바뀌어도 산출물이 흔들리지 않게)
- 🚫 **private 저장소에서는 이 라벨이 실패한다.** public 을 전제로 한 선택이므로, 저장소를 private 으로 바꾸면 `ubuntu-latest` + QEMU 로 되돌려야 한다

⚠️ **백엔드도 같은 개선이 가능하다** (역시 public). 다만 별건이므로 프론트를 먼저 검증한 뒤 적용한다.

### 스모크 테스트

백엔드와 같은 형태. 떠 있는 태스크 안에서 확인한다.

```bash
cid=$(docker ps -q --filter "name=prod_nerd_front_app" | head -1)
docker exec "$cid" node scripts/healthcheck.mjs
```

🚫 `docker run --network <overlay>` 를 쓰지 않는다 — Swarm overlay 는 기본적으로 attachable 이 아니다.

---

## 네이밍

`tasks-stack-rename.md` 확정 후 값이 고정된다. 프론트 기준 예정값:

| 대상 | 값 |
|---|---|
| Swarm 스택 | `prod_nerd_front` |
| 서비스 키 | `app` |
| **서비스 DNS** | **`prod_nerd_front_app`** |
| 이미지 | `prod_nerd_front:<sha>` (`_app` 접미사 없음) |
| 노드 라벨 | `prod_nerd_front=1` |
| 서버 env 파일 | `nerd-front.prod.env` (민감한 런타임 값 전용) |
| GitHub Environment | `PROD` (시크릿 9개) |

---

## 구현 단계

각 단계는 implement → verify 를 1회 포함한다.

### Step 0 — 사전 확인 (구현 전)

- [x] `pnpm install` 후 `pnpm build` 통과 확인 (2026-09-01 — install 6.1초, 빌드 3.3초)
- [x] 노드 가용 메모리 실측 — available 8.7Gi 확인 (2026-09-01)
- [x] ARM64 네이티브 러너 — **저장소 public 확인, `ubuntu-24.04-arm` 무료 사용 가능** (2026-09-01)
- [x] GitHub 시크릿 9개 등록 · 서버 `nerd-front.prod.env` 생성(157B·600) (2026-09-01)
- [ ] 프론트 도메인의 DNS 가 서버를 가리키는지 확인 (Caddy 인증서 발급 전제)

### Step 1 — 포트·설정 ✅ 완료 (2026-09-01)

- [x] `package.json` scripts 에 `-p ${PORT:-5502}` 적용 (`dev` · `start`) + `check:types` 추가
- [x] `next.config.ts` — `output: 'standalone'`, `deploymentId`
- [x] 검증 완료 — 아래

**실측 결과**

| 확인 | 결과 |
|---|---|
| `pnpm dev` (PORT 미지정) | **5502** 리슨, 응답 200 |
| `PORT=5599 pnpm dev` | **5599** 리슨, 응답 200 — 환경변수 오버라이드 동작 |
| `pnpm build` | Turbopack 3.3초, 성공 |
| `.next/standalone/server.js` | 생성됨 (7,470 B) |
| standalone 실기동 (`PORT=5502`) | 페이지 200 · `/next.svg` 200 · CSS 청크 200 · 404 정상 |
| `public` · `.next/static` | **standalone 에 없음** → Dockerfile 수동 COPY 필요 확정 |
| sharp | 트레이싱에 이미 포함, 래스터 최적화 200 |
| `pnpm lint` · `pnpm check:types` | 통과 |

standalone 크기 43M (자산 복사 전).

### Step 2 — 헬스체크 ✅ 완료 (2026-09-01)

- [x] `app/api/health/route.ts` — liveness. 외부 의존을 검사하지 않는다
- [x] `scripts/healthcheck.mjs` — 백엔드 것 이식, `PORT` 기본값 5502 · 경로 `/api/health`
- [x] `scripts/check-health-path.mjs` — 경로 불일치 방지 (백엔드 `app.constants.spec.ts` 대응물)
- [x] 검증 완료 — 아래

**실측 결과**

| 확인 | 결과 |
|---|---|
| 빌드 라우트 표기 | **`ƒ /api/health` (Dynamic)** — `force-dynamic` 적용됨 |
| 응답 | 200 · `{"status":"ok"}` · `application/json` |
| 캐시 헤더 | `cache-control: no-store` |
| `node scripts/healthcheck.mjs` (서버 살아 있음) | 종료코드 **0** |
| `node scripts/healthcheck.mjs` (서버 내림) | 종료코드 **1** |
| `check:health-path` 정상 | 통과 |
| `check:health-path` 경로 깨뜨림 | **exit 1** — 가드가 실제로 잡는다 |

**설계에서 정한 두 가지**

1. **`force-dynamic` 을 붙인다** — route handler 가 정적으로 굳으면 앱이 반쯤 죽어도 캐시된 200 이 나간다. liveness 는 핸들러가 실제로 실행되는 것 자체가 신호다.
2. **`cache-control: no-store` 를 직접 붙인다** — `force-dynamic` 은 렌더 방식만 정하고 캐시 헤더를 보장하지 않는다 (실측: 명시 전에는 헤더가 **비어 있었다**). 중간 캐시가 이 응답을 보관하면 죽은 인스턴스가 살아 보인다.

**`check-health-path.mjs` 가 필요한 이유** — App Router 는 파일 경로가 곧 URL 이라 `app/api/health/` 를 옮기면 `healthcheck.mjs` 는 그대로 남아 404 를 받는다. **두 파일 어디에도 에러가 없어 보이고 배포해 봐야 드러난다.** Swarm 이 unhealthy 로 판정하면 재시작 루프 + 배포 롤백이다. `ci:all` 에 넣는다 (Step 5).

### Step 3 — 컨테이너 ✅ 완료 (2026-09-01)

- [x] `Dockerfile` (deps → builder → runner)
- [x] `.dockerignore`
- [x] 로컬 ARM64 빌드 + 컨테이너 실기동 검증
- [x] `docker stats` 로 메모리 실측 → `limits` 확정

**실측 결과 (`--platform linux/arm64`)**

| 확인 | 결과 |
|---|---|
| 이미지 크기 | **303MB** (standalone 레이어 55.5MB · static 769kB · public 3.3kB) |
| 실행 사용자 | `node` (비루트) |
| 주입된 env | `PORT=5502` · **`HOSTNAME=0.0.0.0`** · `NODE_ENV=production` · `TZ=UTC` · `MALLOC_ARENA_MAX=2` |
| **호스트에서 접근** | `/api/health` **200** — `HOSTNAME=0.0.0.0` 실효 확인 |
| 페이지 · 정적자산 · CSS 청크 · 404 | 200 · 200 · 200 · 404 |
| `docker exec … node scripts/healthcheck.mjs` | 종료코드 **0** |
| sharp 네이티브 바이너리 | **`@img/sharp-linux-arm64@0.35.4`** + `libvips-linux-arm64` |
| 래스터 이미지 최적화 | **200 `image/png`** — 컨테이너에서 sharp 실동작 확인 |

**메모리 실측 → `limits` 근거**

| 상태 | 사용량 |
|---|---|
| 유휴 | **47.9 MiB** |
| 이미지 최적화 요청 후 | 45.3 MiB |
| 페이지 100회 동시 요청 후 | **43.5 MiB** |

부하를 줘도 늘지 않는다(GC 후 오히려 감소). Next standalone 은 예상보다 훨씬 가볍다.

→ **`reservations: 128M` · `limits: 512M` · `NODE_OPTIONS=--max-old-space-size=384`**

- `reservations` 는 스케줄링 보장이라 실사용(48MiB)의 약 2.7배로 잡는다. 백엔드(192M)보다 낮다 — 실측 근거가 있으므로 맞춘다고 늘리지 않는다
- `limits` 는 OOM 상한이라 여유를 둔다. **큰 이미지 하나가 sharp 에서 수백 MB 를 순간 할당**할 수 있고, ISR 도입 시 인메모리 캐시 50MB 가 더해진다
- `--max-old-space-size` 는 limits 의 75%. V8 이 컨테이너 한도를 넘겨 힙을 키우는 것을 막는다

#### 🔍 발견: standalone 은 **기동 시점에** `public/` 을 스캔한다

검증 중 `docker cp` 로 넣은 파일이 **원본 서빙조차 404** 였다. 컨테이너를 재시작하니 200 이 됐다.

- 런타임에 `public/` 에 파일을 추가해도 **서빙되지 않는다**
- 정적 자산을 볼륨으로 마운트하거나 런타임에 생성하는 설계는 동작하지 않는다
- 이미지 최적화의 `400 The requested resource isn't a valid image` 도 같은 원인이었다 — sharp 문제가 아니었다

⚠️ 이 사실을 모르면 "sharp 가 컨테이너에서 안 된다"고 오진하기 쉽다. **원본 파일 서빙(`/probe.png`)이 되는지 먼저 확인**하면 원인이 즉시 갈린다.

### Step 4 — 스택 YAML

- [ ] `infra/docker-stack.app.yml`
  - `replicas: 3` · `order: start-first` · `parallelism: 1` · `failure_action: rollback` · `max_failure_ratio: 0`
  - `resources`: **`limits 512M` / `reservations 128M`** (Step 3 실측 근거)
  - `healthcheck`: `node scripts/healthcheck.mjs` · interval 15s · retries 3 · **`start_period: 60s`**
  - **`stop_grace_period: 30s`**
  - `placement`: `node.labels.prod_nerd_front == 1`
  - `env_file`: `${ENV_FILE_PATH}` · `environment`: 위 런타임 표
  - 🚫 `ports:` 를 선언하지 않는다 (호스트 publish 없음)
- [x] 노드 라벨 부여 — `prod_nerd_front=1` (2026-09-01 완료)

**`start_period` 를 백엔드(30s)보다 길게 잡는 이유** — 이웃 프로젝트 `next-bun` 이 60s 를 쓴다. Next 콜드 스타트가 NestJS 보다 길어서, 짧으면 기동 중인 태스크를 unhealthy 로 판정해 **재시작 루프 + 배포 롤백**에 빠진다.

🚫 **`ports:` publish 는 `next-bun` 을 따라가지 않는다.** 그쪽은 `published: 23000` 으로 호스트에 노출하지만, 백엔드 규약은 "호스트 publish 없음 — Caddy 가 overlay 내부로 접근"이다. publish 하면 도메인을 우회한 직접 접근 경로가 열린다.

### Step 5 — 워크플로

- [ ] `.github/workflows/ci.yml`
- [ ] `.github/workflows/deploy.yml`
- [ ] `scripts/check-stubs.mjs` 이식 — ⚠️ **`TARGET_DIRS` 를 `['app', 'scripts']` 로, `EXTENSIONS` 에 `.tsx` 추가.** 백엔드 원본은 `['src','test']` + `.ts/.mts/.cts` 라 그대로 쓰면 **프론트 파일을 하나도 검사하지 않는다** (조용히 통과)
- [ ] GitHub Environment `PROD` 시크릿 9개 — 8개 완료, **`ENV_FILE_PATH` 남음** (사용자 실행)
- [ ] 서버에 `nerd-front.prod.env` 생성 (주석만 있어도 됨, 권한 600) — **없으면 `docker stack deploy` 가 실패한다**

### Step 6 — 배포·검증

- [ ] Caddy 블록 추가 (사용자 실행) — 프론트 도메인에 `/api/v2/*` → 백엔드, catch-all → 프론트. **catch-all 을 반드시 아래에**
- [ ] `caddy validate` → `caddy reload` → 인증서 발급 확인
- [ ] 배포 후 무중단 실측 — 배포 중 1초 간격 폴링, **비정상 0건**이 완료 조건
- [ ] 유휴 60초 로그 증가량 측정 (백엔드 lessons 2026-08-26 대응)

---

## ⚠️ 주의 사항

1. **`HOSTNAME=0.0.0.0` 누락** — 컨테이너는 정상 기동하고 내부 헬스체크도 통과한다. 밖에서만 안 된다. 가장 찾기 어려운 실패다.
2. **`public` · `.next/static` COPY 누락** — 페이지 HTML 은 뜨는데 CSS·JS·이미지가 전부 404. standalone 은 이 둘을 복사하지 않는다.
3. **`.env` 의 `PORT` 는 무시된다** — 공식 문서에 명시된 동작. 넣어두면 "설정했는데 3000 으로 뜬다"로 시간을 잃는다.
4. **로컬 빌드 성공 ≠ 컨테이너 빌드 성공** — 로컬 입력은 레포 전체, 컨테이너 입력은 `COPY` 목록뿐이다. 백엔드 lessons 2026-08-26 의 프론트 판이며, `sharp` 트레이싱이 정확히 이 함정에 해당한다.
5. **Turbopack + standalone 알려진 이슈** — Next 16.1.x 에서 `serverExternalPackages` 가 `.next/standalone/node_modules` 에 누락되는 보고가 있다. 현재 이 옵션을 쓰지 않아 직접 영향은 없을 것으로 **추정**하나, 문제가 나면 `next build --webpack` 으로 폴백한다.
6. **Caddy `route` 블록 안에서는 작성 순서가 곧 평가 순서다** — catch-all `handle { }` 이 위에 있으면 아래는 도달하지 않는다. 실제 사고 전례가 있다 (백엔드 `docs/deploy.md`).
7. **`docker inspect` 로 컨테이너 env 는 평문 조회된다** — `environment:` 든 `env_file` 이든 같다.
8. **배포 중 레플리카가 6개가 되는 구간** — `start-first` 는 새 태스크를 먼저 띄운다. 재명명 전환 때는 신·구 스택이 겹쳐 더 늘어난다.

---

## 위험도 요약

| 위험 | 정도 | 완화 |
|---|---|---|
| 메모리 OOM → 배포 롤백 | **높음** | 유휴·부하 RSS 실측 후 limits 확정. `MALLOC_ARENA_MAX` · `--max-old-space-size` |
| standalone COPY 누락 | 높음 | Step 3 에서 컨테이너 실기동 검증을 완료 조건으로 |
| Turbopack standalone 이슈 | 중간 | `--webpack` 폴백 경로 확보 |
| version skew (deploymentId 미설정) | 중간 | Step 1 에서 즉시 적용 |
| ARM64 QEMU 빌드 시간 | 중간 | 네이티브 러너 확인 |
| 재명명 전환 중 메모리 2배 | 중간 | 전환 절차를 `tasks-stack-rename.md` 가 소유 |

---

## 이웃 프로젝트 `next-bun` 대조 (2026-09-01 조사)

같은 노드에 `prod_next` 라벨로 이미 배포 중인 Next 앱이다. 커밋 이력이 **최소 3번의 장애급 시행착오**를 보여준다 — `health check api 추가 → Swarm 마이그레이션 → healthcheck IPv6 버그 → CI 컨버지 대기 추가 → HOSTNAME 바인딩 버그`. 그 값을 문서로 미리 받은 셈이다.

### 우리 설계를 검증해준 것

| 그쪽 커밋 | 우리 대응 |
|---|---|
| `fix: Next.js HOSTNAME=0.0.0.0 — standalone server loopback bind 이슈 해결` | Dockerfile `ENV HOSTNAME=0.0.0.0` — 실측으로 실효 확인 |
| `fix(healthcheck): IPv6 이슈 해결 — 127.0.0.1 + top-level await` | `healthcheck.mjs` 가 `host: '127.0.0.1'` 을 명시 (백엔드에서 이식) |
| 헬스체크 경로 `/api/health` | 동일 |
| `runs-on: ubuntu-24.04-arm` | 동일 (Step 5) |
| `start_period: 60s` | **채택** — 백엔드 30s 를 그대로 쓰지 않는 근거 |

### 우리가 다르게 가는 것

| 항목 | next-bun | 우리 | 왜 |
|---|---|---|---|
| CI 검증 게이트 | **없음** (`lint`·`test` 가 있는데 워크플로가 호출 안 함) | `ci:all` | `main` push 가 곧 배포인데 검증이 없으면 깨진 코드가 그대로 나간다 |
| 배포 후 검증 | replica 수렴만 확인 | 실제 HTTP 스모크 | 컨테이너는 떴는데 앱이 500 인 상황을 못 잡는다 |
| 컨테이너 사용자 | **root** | `USER node` | 최소 권한 |
| 메모리 제한 | **없음** (replicas 10 인데) | limits/reservations | 한 서비스의 폭주가 노드 전체에 번진다 |
| 호스트 publish | `published: 23000` | **없음** | 도메인 우회 경로가 열린다 |
| 패키지 매니저 | bun + **`pnpm-lock.yaml` 공존** | pnpm 단일 | lockfile 이 둘이면 "로컬 성공 ≠ 컨테이너 성공"이 재현된다 |
| `.dockerignore` | 2줄 | 충실히 | 빌드 컨텍스트·캐시 히트율 |

### 재현하지 말아야 할 것

- **`.env.build` 를 커밋했고 그 안에 운영 도메인이 평문**이다. `siteConfig.ts` 에도 fallback 으로 하드코딩돼 있다. 우리의 `.env.production` 커밋 결정이 **같은 함정 앞에 있다** → 위 「환경변수」절에 도메인 금지를 명시했다.

## 📚 참고

- Next.js Self-hosting — https://nextjs.org/docs/app/guides/self-hosting
- Next.js `output` — https://nextjs.org/docs/app/api-reference/config/next-config-js/output
- Next.js CLI — https://nextjs.org/docs/app/api-reference/cli/next
- Next.js 16 업그레이드 — https://nextjs.org/docs/app/guides/upgrading/version-16
- Turbopack standalone 이슈 — https://github.com/vercel/next.js/issues/88844
- `nerd-back` `docs/deploy.md` — 배포 인프라 일반 규약 (SSOT)
- `nerd-back` `docs/lessons.md` — 이식 대상 교훈
- `nerd-back` `docs/tasks/tasks-stack-rename.md` — 스택 재명명 (선행 의존)
