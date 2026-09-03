---
paths:
  - "apps/front/app/**/*.ts"
  - "apps/front/app/**/*.tsx"
  - "apps/front/scripts/**/*.mjs"
  - "apps/front/next.config.ts"
---

# 프론트 코드 패턴 (`apps/front`)

> **이 파일은 위 `paths` 의 파일을 읽는 순간 자동으로 컨텍스트에 로드된다.**
> 최종 확인일: 2026-09-03 · 규모: `app/` **4파일** · `scripts/` **3파일**. 아직 얇다 — 규약이 쌓이면 절을 늘린다.
> **용도**: 프론트 코드를 쓸 때 **코드에서 어기기 쉬운 것**만 모았다. 결정의 근거와 배경은 [`docs/tasks/tasks-frontend-cicd.md`](../../docs/tasks/tasks-frontend-cicd.md) 가 SSOT 다.
> **경계**: 백엔드 규약은 [`back-code-patterns.md`](back-code-patterns.md), 금지·함정 전체는 [`CLAUDE.md`](../../CLAUDE.md), 배포 규약은 [`docs/deploy.md`](../../docs/deploy.md).

---

## 1. 백엔드 호출 — 브라우저는 상대경로, 서버는 내부 DNS

같은 도메인에서 Caddy 가 `/api/v2/*` 만 백엔드로 분기한다. 그래서 오리진을 코드에 넣을 필요가 없다.

| 어디서 | 무엇을 쓰나 |
|---|---|
| 클라이언트 컴포넌트·브라우저 | **상대경로** `fetch('/api/v2/...')` |
| 서버 컴포넌트·route handler | `process.env.BACKEND_INTERNAL_URL` (overlay 직통, stack YAML 이 주입) |

- 🚫 **`NEXT_PUBLIC_API_BASE_URL` 류를 새로 만들지 않는다.** 상대경로면 빌드타임 env 가 하나 줄고 이미지가 환경 독립이 되며 CORS 자체가 발생하지 않는다.
- 🚫 도메인을 코드·`.env.production` 에 하드코딩하지 않는다 (인프라 식별 정보 — `CLAUDE.md` Never).

## 2. 환경변수 — 값의 성격이 아니라 **확정 시점**이 위치를 정한다

| 접두사 | 확정 시점 | 두는 곳 |
|---|---|---|
| `NEXT_PUBLIC_*` | **빌드타임** (번들에 인라인된다) | `apps/front/.env.production` **한 곳만** |
| 그 밖 | 런타임 | stack YAML `environment:` (공개) · 서버 env 파일 (비밀) |

- 🚫 **`NEXT_PUBLIC_*` 를 서버 env 파일에 넣지 않는다.** 값은 이미 번들에 박혀 있어 서버 프로세스의 `process.env` 만 바뀐다. 증상은 "설정했는데 브라우저에서 `undefined`" 이고 원인이 파일이 아니라 시점에 있어 찾기 어렵다.
- 🚫 **`PORT` 는 `.env` 계열 어디에 넣어도 무시된다.** HTTP 서버 부팅이 env 로딩보다 먼저다. 포트는 `package.json` scripts(`-p ${PORT:-5502}`)와 Dockerfile `ENV` 가 소유한다.
- 로컬 개발 값은 `apps/front/.env.local` (앱별 독립 — `.env` 를 쓰지 않는다).

## 3. 레플리카 3개가 코드에 거는 제약

프론트도 레플리카 3개다. 인스턴스별로 갈리는 상태를 만들면 사용자가 새로 고칠 때마다 다른 결과를 본다.

| 기능 | 도입 시 **필수** |
|---|---|
| ISR · `use cache` · `revalidateTag()` | `cacheHandler` + `cacheMaxMemorySize: 0` + Redis 백엔드. 기본 캐시는 컨테이너별 메모리·디스크라 한 레플리카만 무효화된다 |
| Server Actions | `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 고정. 빌드마다 랜덤이면 롤링 중 `Failed to find Server Action` |
| 모듈 전역 변수·타이머로 상태 공유 | 🚫 금지. Redis 를 쓴다 (`CLAUDE.md` Never — 두 앱 공통) |

`deploymentId` 는 이미 `next.config.ts` 에 있다. 지우지 않는다 — 롤링 중 구·신 청크 불일치(version skew)를 막는다.

## 4. 헬스체크

- `app/api/health/route.ts` 는 **liveness 전용**이다. 외부 의존을 검사하지 않는다 — 의존 장애가 재시작 루프와 배포 롤백을 유발한다.
- `force-dynamic` + `Cache-Control: no-store` 를 **둘 다** 명시한다. `force-dynamic` 은 렌더 방식만 정하고 캐시 헤더를 보장하지 않는다(실측: 명시 전에는 헤더가 비어 있었다). 중간 캐시가 이 응답을 보관하면 죽은 인스턴스가 살아 보인다.
- 경로를 옮기면 `scripts/healthcheck.mjs` 와 어긋난다. `pnpm front check:health-path` 가 잡는다 — **경로를 바꿀 때 이 스크립트도 같이 고친다.**
- 🚫 Caddy matcher 를 `/api/*` 로 넓히지 않는다. 프론트 헬스체크(`/api/health`)가 백엔드로 흘러가 컨테이너가 영원히 unhealthy 가 된다.

## 5. 정적 자산 · 이미지

- `output: 'standalone'` 은 `public/` 과 `.next/static` 을 **복사하지 않는다.** Dockerfile 이 수동 COPY 한다 — 빼면 HTML 은 뜨는데 CSS·JS·이미지가 전부 404 다.
- **standalone 서버는 기동 시점에 `public/` 을 스캔한다.** 런타임에 파일을 추가해도 서빙되지 않는다. 정적 자산을 볼륨 마운트하거나 런타임에 생성하는 설계는 동작하지 않는다.
- `next/image` 는 `sharp`(libvips)를 쓴다. **V8 힙 밖에서 할당해 `--max-old-space-size` 로 막을 수 없다** — 큰 이미지를 다룰 때는 `images.minimumCacheTTL` 과 `limits.memory` 를 함께 본다. SVG 는 최적화 경로를 타지 않는다(`dangerouslyAllowSVG` 기본 비활성).
- 🚫 `outputFileTracingIncludes` 로 `node_modules/sharp/**/*` 를 넣지 않는다. pnpm 격리 구조에서는 **아무것도 매칭하지 못하는데** "챙겼다"는 착각만 남는다. 기본 트레이싱이 이미 담는다.
- 🚫 `next.config.ts` 의 `outputFileTracingRoot` 를 지우지 않는다. 없으면 워크스페이스 루트가 추론되어 산출물이 `.next/standalone/apps/front/server.js` 로 깊어지고 Dockerfile COPY 와 어긋난다.

## 6. 타입·린트

- `any` · `@ts-ignore` 등 타입 억제 금지. 불가피하면 disable + **사유 주석** (두 앱 공통 — `CLAUDE.md` Never).
- 타입 검사는 **`next typegen && tsc --noEmit`** 이다. `typegen` 이 선행되지 않으면 라우트 타입이 검증되지 않는다.
- 검증 명령: `pnpm front ci:core`(lint → check:types → build). PR 직전 `pnpm front ci:all`(+ 스텁 검사 + 헬스 경로 검사).

## 7. 테스트

**아직 없다** (의도된 미도입 — `tasks-frontend-cicd.md`). 그래서 `ci:core` 에 `test` 단계가 없다.
도입하면 `check:stubs` 의 `.only` 규칙이 실효를 갖고 `ci:core` 정의가 바뀐다 — 그때 이 절을 채운다.
