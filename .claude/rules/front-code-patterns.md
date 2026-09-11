---
paths:
  - "apps/front/app/**/*.ts"
  - "apps/front/app/**/*.tsx"
  - "apps/front/components/**/*.ts"
  - "apps/front/components/**/*.tsx"
  - "apps/front/hooks/**/*.ts"
  - "apps/front/lib/**/*.ts"
  - "apps/front/types/**/*.ts"
  - "apps/front/scripts/**/*.mjs"
  - "apps/front/next.config.ts"
---

# 프론트 코드 패턴 (`apps/front`)

> **이 파일은 위 `paths` 의 파일을 읽는 순간 자동으로 컨텍스트에 로드된다.**
> 최종 확인일: **2026-09-11** · 규모: `app/` 18파일 · `components/` 17 · `lib/` 13 · `scripts/` 3 · 테스트 6(46건).
> 기반(디자인 토큰 · `lib/api` · UI 3종 · vitest)까지 구현됨. 근거는 [`tasks-my-story.md`](../../docs/tasks/tasks-my-story.md) 0-B.
> **용도**: 프론트 코드를 쓸 때 **코드에서 어기기 쉬운 것**만 모았다. 결정의 근거와 배경은 [`docs/tasks/tasks-frontend-cicd.md`](../../docs/tasks/tasks-frontend-cicd.md) 가 SSOT 다.
> **경계**: 백엔드 규약은 [`back-code-patterns.md`](back-code-patterns.md), 금지·함정 전체는 [`CLAUDE.md`](../../CLAUDE.md), 배포 규약은 [`docs/deploy.md`](../../docs/deploy.md).

---

## 1. 백엔드 호출 — 브라우저는 상대경로, 서버는 내부 DNS

같은 도메인에서 Caddy 가 `/api/v2/*` 만 백엔드로 분기한다. 그래서 오리진을 코드에 넣을 필요가 없다.

| 어디서 | 무엇을 쓰나 |
|---|---|
| 클라이언트 컴포넌트·브라우저 | **상대경로** `fetch('/api/v2/...')` |
| 서버 컴포넌트·route handler | `process.env.BACKEND_INTERNAL_URL` (overlay 직통, stack YAML 이 주입) |

**이 분기를 화면마다 반복하지 않는다.** `lib/api` 의 `apiFetch` 가 **호출 시점에** 결정한다 —
🚫 모듈 로드 시점에 고정하면 서버 렌더와 클라이언트 렌더 중 한쪽이 반드시 틀린 값을 쓴다.
경로 접두(`api/v2`)도 손으로 쓰지 않는다. `@nerd/contracts` 의 `API_PREFIX` 가 SSOT 다.

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
- 🚫 `next.config.ts` 의 `outputFileTracingRoot` 를 지우거나 **앱으로 좁히지 않는다.** 값은 **레포 루트**여야 한다 — 이름은 트레이싱이지만 **Turbopack 의 모듈 해석 경계**라, 좁히면 워크스페이스 패키지를 못 찾아 `Module not found: Can't resolve '@nerd/contracts'` 로 **빌드가 실패한다**(2026-09-04 실측).
  - 그 대가로 standalone 산출물이 `apps/front/server.js` 로 한 단계 깊어진다. **Dockerfile 의 COPY·WORKDIR 이 이 구조에 맞춰져 있다** — 값을 바꾸면 거기도 고친다.
  - 참고: `@nerd/contracts` 자체는 Next 가 서버 번들에 인라인하므로 standalone 의 `node_modules` 에는 없다(컨테이너 실측: `require.resolve` 실패, 페이지는 정상). 이 설정이 필요한 이유는 트레이싱이 아니라 **해석**이다.

## 6. 타입·린트

- `any` · `@ts-ignore` 등 타입 억제 금지. 불가피하면 disable + **사유 주석** (두 앱 공통 — `CLAUDE.md` Never).
- 타입 검사는 **`next typegen && tsc --noEmit`** 이다. `typegen` 이 선행되지 않으면 라우트 타입이 검증되지 않는다.
- 검증 명령: `pnpm front ci:core`(lint → check:types → build). PR 직전 `pnpm front ci:all`(+ 스텁 검사 + 헬스 경로 검사).

## 7. 테스트 — vitest

2026-09-04 도입 (D6 해소). `ci:core` 와 `ci:all` 에 **`test` 단계가 있다.**

- 설정은 `vitest.config.mts` 하나. 테스트 파일은 **소스 옆에** `*.test.ts` 로 둔다(`lib/api/client.test.ts`).
- 지금은 `environment: 'node'` 다 — **순수 로직과 `lib/api` 래퍼**를 덮는다. 컴포넌트 테스트(jsdom + Testing Library)는 필요해질 때 도입하고 그때 이 절을 고친다.
- `@nerd/contracts` 는 **소스로** 해석한다(`resolve.alias`). dist 로 두면 contracts 를 고치고 빌드를 안 했을 때 낡은 산출물을 검증한다.
- `restoreMocks: true` 라 `afterEach` 복원을 직접 쓰지 않는다. 전역 스텁은 `vi.unstubAllGlobals()` 로 되돌린다.
- ⚠️ `scripts/check-stubs.mjs` 의 `TARGET_DIRS` 에 **새 최상위 디렉터리를 추가한다.** 빠지면 그 디렉터리의 `.only`·`TODO` 가 검사에서 통째로 빠진다(현재 `app` · `components` · `lib` · `scripts`).

## 8. 컴포넌트·디자인 시스템

### 폴더 경계

```text
app/                    라우트만. (demo) = 시연 · (trial) = 체험(인증 필요, Slice 2)
components/ui/          actionStyles · ActionLink · Card — 도메인을 모른다
components/story/       StoryCard — 도메인 컴포넌트
lib/api/                fetch 래퍼 · ApiError
```

🚫 **빈 디렉터리를 미리 만들지 않는다.** `hooks/` · `types/` 는 넣을 것이 생길 때 만든다 —
지금 만들면 git 이 추적하지도 않고 Dockerfile COPY 목록만 헷갈리게 한다.
⚠️ **새 최상위 디렉터리를 만들면 `Dockerfile` 의 COPY 목록과 `check-stubs` 의 `TARGET_DIRS` 에 함께 추가한다.**

- `@/*` alias 가 `./*` 로 잡혀 있다. 상대경로 `../../` 를 쓰지 않는다.
- 라우트 그룹 `(demo)` 는 로그인 없이 도는 시연 모드다. `(trial)` 은 인증이 생기는 Slice 2 에서 만든다.
- 🚫 **`components/ui/` 가 도메인 타입을 import 하지 않는다.** 동화·세션 타입이 들어오는 순간 그 컴포넌트는 `components/story/` 로 간다. 이 경계가 무너지면 "공용 UI"가 도메인에 묶여 재사용이 끊긴다.
- 라우트 전용 컴포넌트는 그 라우트 폴더에 colocate 한다. **두 번째 라우트가 쓰는 순간** `components/` 로 올린다 — 미리 올리지 않는다.
- 인증 가드는 **`(trial)/layout.tsx` 한 곳**에만 둔다. 페이지마다 검사하면 빠뜨린 페이지가 곧 구멍이다.
  ⚠️ **아직 그렇게 되어 있지 않다**(2026-09-10 확인: 그 파일이 없다). 마이페이지는 세션 훅으로 먼저
  막고, 촬영·리더는 401 을 받은 뒤 되돌린다. 새 보호 화면을 만들 때 이 셋 중 하나를 고르지 말고
  **레이아웃 가드로 모으는 작업을 먼저 끝낸다.** 별건으로 등재되어 있다.

### variant — 객체 맵, 의존성 0개

```ts
const variantStyles: Record<Variant, string> = { primary: '...', ghost: '...' };
```

🚫 `cva`·`tailwind-merge`·`clsx` 를 도입하지 않는다. 객체 맵으로 같은 일이 되고, 새 의존성은 승인 대상이다 (`CLAUDE.md` Ask).

### ⭐ 같은 모양이 태그를 넘나들면 **래퍼가 아니라 문자열을 공유**한다

같은 CTA 가 상황에 따라 `<button>` 도 되고 `<Link>` 도 된다. 래퍼만 만들어 두면 **다른 태그가 필요한
순간 클래스를 손으로 옮겨 적게 되고 두 벌이 된다** — 2026-09-04 리뷰에서 실제로 잡혔다(홈 링크가
버튼 클래스 10개를 복제하고 있었다).

- 스타일 문자열을 `components/ui/actionStyles.ts` 처럼 **함수 하나로** 뽑고, 래퍼들이 그것을 부른다.
- 🚫 새 래퍼를 만들 때 클래스를 복사하지 않는다. `actionClass(variant, extra)` 를 부른다.

### 🚫 컴포넌트를 **첫 사용처 없이** 만들지 않는다

쓰이지 않는 컴포넌트는 린트도 타입체크도 잡지 못하고(빌드에서 조용히 트리셰이킹된다), 디자인이
바뀌어도 아무도 고치지 않아 **틀린 예제**로 남는다. 필요해지는 화면과 **같은 커밋에서** 만든다.
- 미사용 판별은 어휘 grep 만으로 하지 않는다 — **빌드 산출물(JS 청크)에 식별 문자열이 있는지**로 교차 확인한다
  (Tailwind 는 import 여부와 무관하게 소스를 스캔하므로 **CSS 는 근거가 되지 않는다**).

### 디자인 토큰

- 정의는 **`app/globals.css` 의 `@theme` 한 곳**이다 (Tailwind v4 CSS-first). 🚫 `tailwind.config.ts` 를 만들지 않는다.
- 생성되는 유틸리티: `bg-primary` `text-ink` `rounded-card` `rounded-pill` `min-h-touch` `size-touch` 등. **토큰을 추가하면 빌드 산출 CSS 에서 유틸리티가 실제로 나오는지 확인한다** — 오타는 빌드를 깨뜨리지 않고 그냥 클래스가 없는 상태가 된다.
- 🚫 **폰트에 `next/font/google` 을 쓰지 않는다.** `next build` 가 네트워크를 타게 되고(오프라인·프록시 빌드 실패), 한글 서브셋 확보가 불확실하다. 시스템 스택을 쓴다.
- 🚫 **컴포넌트에 색 리터럴(`bg-[#6BA3D6]`)을 쓰지 않는다.** 토큰만 쓴다. 리터럴이 한 번 퍼지면 팔레트 변경이 전수 수정이 된다.
- 🚫 다크모드를 쓰지 않는다. 시안이 전부 라이트이고 파스텔 팔레트가 다크에서 성립하지 않는다.

### 뷰포트 — 태블릿 가로 우선 ⭐

시안이 전부 **태블릿 가로**다(기준 1024×768). 통상의 모바일 퍼스트와 반대다.

- Tailwind 의 `min-width` 방향은 **뒤집지 않는다.** 뒤집으면 유틸리티 클래스 전부와 싸운다.
- 대신 **완성형 레이아웃을 `md:` 이상에서 만들고 base(모바일)는 축소 대응**한다.
- 터치 타깃 최소 **56px**. WCAG 권장(44px)보다 큰 이유는 **아이 손가락이 대상**이기 때문이다.

## 8-1. 로그인 상태와 대기 화면 — 새로고침마다 깜빡이지 않게 (2026-09-10)

배포 환경에서 **새로고침할 때마다 인증 문구와 목록이 깜빡인다**는 보고가 세 번 있었다. 원인은 하나다 —
**서버 HTML 은 로그인 상태를 모르고, 화면이 그것을 기다렸다가 뒤늦게 바뀐다.** 아래는 그 대응이다.

### 로그인 상태는 CSS 가 고른다 ⭐

- `layout.tsx` 의 **블로킹 인라인 스크립트**가 첫 페인트 전에 `<html data-session>` 을 세운다.
  🚫 `next/script` 로 바꾸지 않는다 — 로더를 거치면 블로킹이 보장되지 않는다.
- 헤더와 CTA 는 **두 문구를 다 렌더하고** `globals.css` 의 `.session-guest` / `.session-authenticated`
  규칙이 하나만 보인다. 🚫 컴포넌트에서 상태로 분기해 한쪽만 그리지 않는다 — 하이드레이션 전까지
  칸이 비어 그것이 곧 깜빡임이다.
- 클래스 이름은 **리터럴로 적는다**. `` `session-${status}` `` 로 조립하면 전수 검색에 안 잡혀
  스타일시트를 고칠 때 그 파일만 조용히 깨진다.
- 서버 확인은 `SessionSync` 가 페이지당 한 번 낸다. 🚫 헤더에서 값을 버리는 `useSession()` 호출로
  대신하지 않는다.

### 기억해 두는 값에는 사용자 정보를 넣지 않는다 🚫

- `localStorage` 에 남기는 것은 **로그인 여부 한 값**뿐이다(`{"status":"guest"|"authenticated"}`).
- 아이디를 넣으면 로그아웃 없이 브라우저를 닫았을 때 **다음 사람 화면에 앞사람 아이디가 먼저
  그려진다.** 실제로 그랬고 리뷰에서 잡혔다.
- 이 값은 **힌트일 뿐 확인이 아니다.** React 상태는 서버가 확인해 준 것만 담는다.
- 서버 확인이 **401 이 아닌 이유로 실패하면 "확인함" 표시를 세우지 않는다.** 세우면 잠깐 끊겼다
  복구돼도 인증 칸이 빈 채로 남는다.

### 대기 화면은 최종 화면과 **같은 틀·같은 크기** ⭐

- 로딩·성공·에러 세 화면이 **같은 껍데기 컴포넌트**를 쓴다(예: `library/LibraryShell.tsx`).
  한쪽만 다르게 생기면 데이터가 도착할 때 화면이 통째로 바뀐다.
- 값이 들어갈 자리에는 **최종 모양과 같은 크기의 스켈레톤**을 둔다. 🚫 비어 있는 칸을 두지 않는다.
- ⚠️ **스켈레톤으로 개수를 약속하지 않는다.** 여러 장을 그려 놓고 실제가 적으면 화면이 줄어드는데,
  줄어듦은 늘어남보다 크게 튄다.
- **껍데기를 흘리는 방법은 두 가지고 둘 다 된다.** 페이지가 최상단에서 `await` 하고 `loading.tsx` 가
  같은 틀을 그리거나, 목록만 `Suspense` 로 감싸거나다. 실측(2026-09-10, 백엔드 500 응답):
  **두 구조 모두 `error.tsx` 가 1초 안에 정상으로 뜬다.** 껍데기 도착은 88ms 대 152ms 로 둘 다 충분하다.
  서재는 앞의 것을 쓴다 — `loading.tsx` 가 이미 같은 틀을 그리므로 구조가 더 단순하다.
  ⚠️ 한때 "중첩 `Suspense` 면 에러 화면이 안 뜬다"고 이 자리에 적혀 있었다. **죽은 서버가 포트를 잡고
  있어 옛 빌드를 관측한 결과였다.** 재현 환경을 새로 띄울 때는 포트 소유 프로세스를 매번 확인한다.
- `error.tsx` 의 prop 이름은 **`reset`** 이다. `retry` 로 받으면 값이 `undefined` 라 타입은 통과하는데
  버튼이 무반응이다. 서버 데이터를 다시 받으려면 `router.refresh()` 를 **함께** 부른다.

### 공개 경로에서 인증 API 를 부르지 않는다 🚫

`(demo)` 는 로그인 없이 도는 공개 경로다. 여기서 인증이 필요한 엔드포인트를 조건 없이 부르면
**방문마다 401 이 한 번씩 쌓인다**(실측: 공개 상세 1회 방문에 `GET /sessions/my` 401 한 번).
로그인이 확인된 뒤에 부른다. 대기 시간은 자리표시로 덮는다.

### 배지 색은 디자이너가 소유한다

- `Badge` 의 톤 값은 디자이너 커밋과 `docs/design/my-story-flow.html` 에서 온다.
  🚫 대비를 이유로 임의로 바꾸지 않는다 — 필요하면 디자이너와 맞춘다.
- 소비처는 **톤을 명시한다.** 기본값에 기대면 기본이 바뀔 때 그 화면 색이 조용히 따라 바뀐다.

---

## 9. 백엔드 응답 다루기

```ts
type ApiSuccess<T> = { code: 'SUCCESS'; data: T; message: string };
type ApiErrorBody  = { code: string; message: string; timestamp: string; details?: unknown };
```

- 🚫 **에러 바디에 `statusCode` 필드는 없다.** HTTP 상태와 `code` 로 분기한다. 백엔드 전역 필터가 이 형태를 고정한다.
- 성공 상태는 정석 REST 다 — 생성 201, 본문 없음 204. **전부 200 이 아니다.**
- baseURL 은 **호출 컨텍스트가 정한다** (§1). 클라이언트는 `''`(상대경로), 서버는 `BACKEND_INTERNAL_URL`. 🚫 fetch 래퍼가 모듈 로드 시점에 baseURL 을 고정하지 않는다 — 그러면 서버·클라이언트 중 한쪽이 틀린다.
- 401 은 개별 화면이 각자 처리하지 않는다. 전역 이벤트로 올려 로그아웃을 한 곳에 모은다.
- 🚫 롤백 경로 없는 낙관적 업데이트를 만들지 않는다. 실패가 조용히 잘못된 화면으로 굳는다.

### 폼 검증 — 스키마는 백엔드와 같은 것을 쓴다

- 🚫 화면에서 검증 규칙을 다시 쓰지 않는다. `@nerd/contracts` 의 스키마를 `safeParse` 로 돌린다 — 그래야 "프론트는 통과했는데 백엔드가 400" 이 생기지 않는다.
- ⚠️ **로그인 폼에는 가입 규칙을 적용하지 않는다.** "아이디 형식이 틀렸다"는 표시가 곧 "그런 아이디는 없다"는 신호가 된다. 비어 있는지만 본다(백엔드와 같은 규칙).
- 오류를 **색으로만** 알리지 않는다. `aria-invalid` · `aria-describedby` 로 잇고, 폼 전체 오류는 `role="alert"` 로 즉시 읽히게 한다.
