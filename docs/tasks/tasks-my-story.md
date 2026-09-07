# Task Tracker: My Story — 풀스택

> 작성일: 2026-09-04
> 상태: **Slice 1(백엔드 콘텐츠 API) 완료.** Slice 0·2 착수 대기
> 입력: [`ideas/my-story/`](../../ideas/my-story/) · 팀 회의 2026-08-31 · **2026-09-02** · 작업 지시 2026-09-04
> 참고: AI 시안 5장(팀 공유) · 사내 참고 프로젝트 2곳 — 본 문서에서 **참고 A**(NestJS 백엔드) · **참고 B**(Next.js 프론트)
> 범위: `apps/back` + `apps/front` 의 도메인 모듈·API 계약·화면·연동
> 비목표: 동화 원고·삽화 제작, AI 모델 선정(실험 중), TTS, 인프라 변경
> 원칙: 이 문서가 **My Story 결정의 SSOT** 다. 결정이 바뀌면 코드보다 이 문서를 먼저 고친다.

> **SSOT 경계** — 여기 없는 것은 다른 문서가 소유한다. 옮겨 적지 않는다.
> 코드 규약 → [`.claude/rules/*-code-patterns.md`](../../.claude/rules/) · 금지·함정 → [`CLAUDE.md`](../../CLAUDE.md)
> 배포 → [`docs/deploy.md`](../deploy.md) · 프론트 인프라 결정 → [`tasks-frontend-cicd.md`](tasks-frontend-cicd.md)
>
> ⚠️ `product-spec.md` 의 **기술 스택 표는 무효다.** `next` + `nest` 로 합의했다.

---

## 📌 확정 사항

09-02 회의가 08-31 을 덮어쓴 항목은 09-02 를 따른다(분량 8장 → 6장). 09-04 지시가 회의를 덮어쓴 항목은 09-04 를 따른다.

| 항목 | 결정 | 출처 |
|---|---|---|
| 스택 | 프론트 `next` · 백엔드 `nest` | 08-31 |
| 작업 단위 | 도메인(기능) 단위 · **프론트 연동까지 한 슬라이스** | 08-31 · **09-04** |
| 개발 방식 | SDD · TDD — 문서 → 테스트 → 코드 | 08-31 |
| 화면 모드 | **시연 / 체험하기 2종** | 09-02 |
| 인증 | **아이디 · 비밀번호만.** 이름 등 부가 정보 받지 않는다 | **09-04** |
| 생성 제한 | **횟수 카운터가 아니다.** 사용자 × 동화 **1권당 1회** — 이미 만든 책은 다시 못 만든다 | **09-04** |
| 생성 상한 | 템플릿 2권이므로 **1인 최대 2권**이 자연 상한이다 (회의록 "2~3회"의 실체) | **09-04** |
| 시연 동화 | **1권 고정** | **09-04** |
| 생성 결과 보관 | **계정에 영구 보관** | **09-04** |
| 프론트 테스트 | **vitest 도입** — 순수 로직과 `lib/api` 부터 | **09-04** |
| 얼굴 데이터 | **저장하지 않는다** | 09-02 |
| 이미지 생성 | **Port & Adapter 로 격리.** 모델 교체가 어댑터 1개 교체로 끝나야 한다 | **09-04** |
| 콘텐츠 분량 | 본편 4장 + 비하인드 2장 = **6장** · 동화 **2편** | 09-02 |
| 개발용 콘텐츠 | **책 데이터 없이도 전 플로우가 돌아야 한다** → 픽스처 동화 | **09-04** |
| AI 게이트웨이 | OpenRouter (모델 혼합) | 09-02 |
| 예산 | 1차 합산 $50 · 테스트 $30 · **건당 1200원 추정 → 목표 300원** | 09-02 |
| 브랜치 | **`main` ← `feat/*`** — `develop` 을 만들지 않는다 (08-31 안을 09-04 에 축소) | **09-04** |
| 도메인 | duckdns 기반 | 🚫 실제 값을 저장소에 쓰지 않는다 |
| 다크모드 | **쓰지 않는다** | 09-04 |
| 타입·검증 공유 | **모노레포 공유 패키지 `packages/contracts`** — 폼 검증 스키마와 타입을 한 곳에서 소유 | **09-04** |
| 구현 브랜치 | 구현은 **별도 `feat/*` 브랜치**에서. 문서·규약도 함께 올리되 **커밋을 scope 별로 나눈다** | **09-04** |

### 이번 범위에서 뺀 것

| 항목 | 사유 |
|---|---|
| **TTS** | 낭독은 팀이 직접 녹음한다. 정적 오디오 파일이지 API 가 아니다 |
| **이미지 생성 모델 선정** | 실험 중. **Port 인터페이스는 지금 만들고 어댑터만 대기**한다 |
| STT | 스펙에 없다 |

> [`tasks-ai-fairy-tale-cost.md`](tasks-ai-fairy-tale-cost.md) 는 TTS·STT·부모캐릭터 전제다. 셋 다 범위 밖이므로
> **그 합계($0.16)를 My Story 예산으로 쓰지 않는다.** 유효한 것은 그 문서의 「비용 통제 규칙」 8개뿐이다.

---

## 두 가지 모드

⚠️ **용어를 먼저 고정한다.** 09-02 회의록은 앞을 「시연」, 뒤를 「체험하기」라 불렀는데,
09-04 구두 설명에서는 **앞쪽(비로그인)을 "체험"** 이라고 불렀다. 같은 단어가 두 대상을 가리키면
라우트 이름·DB 플래그·문서가 전부 어긋난다. **이 문서는 회의록 표기를 따른다** — 아래 표가 정본이다.

| | **시연 (Demo)** | **체험하기 (Trial)** |
|---|---|---|
| 별칭 주의 | 09-04 구두로는 "체험"이라 불렀다 | 09-04 구두로는 "실제 생성" |
| 로그인 | **불필요** | **필요** (아이디·비밀번호) |
| AI 호출 | **없음** | 있음 |
| 얼굴 | **미리 합성해 둔 파일**을 AI 가 만든 것처럼 보여준다 | 실제 촬영 → 업로드 → 생성 |
| 대상 동화 | **1권 고정** | 템플릿 **2권** 중 선택 |
| 낭독 | 팀 녹음 (D9 보류) | 팀 녹음 (D9 보류) |
| 인터랙션 | 버튼으로 플로우 진행만 | 등장인물 대화 |
| 제한 | 없음 | **동화 1권당 1회.** 만든 책은 다시 못 만든다 |
| 진입 | 첫 화면 | 시연 화면 우측 상단 버튼 |

### 생성 제한 — 카운터가 아니라 "이미 있음" ⭐

09-04 에 모델이 바뀌었다. **소모성 횟수 카운터를 만들지 않는다.**

```text
로그인 → 템플릿 2권 중 선택 → 사진 촬영·업로드 → 실제 AI 호출 → 책 생성
                                                              │
                                          그 책이 이미 있으면 ─┘ 다시 만들 수 없다
```

- 제한의 실체는 **`(사용자, 동화)` 조합의 유일성**이다. Redis 소모 카운터가 아니라 **DB UNIQUE 제약**이 강제한다
- 템플릿이 2권이므로 1인 최대 2권 — 회의록의 "2~3회"가 **설계가 아니라 결과**로 나온다
- 🚫 **실패한 생성은 제한에 걸리지 않는다.** 책이 없으니 다시 시도할 수 있어야 한다. 제한은 **완성된 책의 존재**가 만든다
- 이 모델의 장점: AI 실패·타임아웃으로 사용자가 기회를 잃는 경로가 **구조적으로 없다.** 시연 현장에서 대응할 수 없는 사고를 하나 없앤다

**백엔드 관점의 결론** — 시연 모드는 AI·스토리지·인증 없이 전부 만들 수 있다.
필요한 것은 "사전 제작된 페이지를 순서대로 내려주는 API"뿐이고, 그건 **Slice 1 에서 이미 만들었다.**

## 🚧 미결정

| # | 항목 | 상태 | 무엇이 정해지면 풀리는가 |
|---|---|---|---|
| ~~D1~~ | ~~이미지 보관~~ | **✅ 해소 (09-07)** | **자체 호스팅 MinIO + 서명 URL.** ↓ 「이미지 보관 (D1)」. 삭제 규칙만 D10 으로 넘겼다 |
| ~~D2~~ | ~~사용자 식별~~ | ✅ 해소 | 아이디 · 비밀번호 |
| **D3** | 이미지 생성 모델 | 실험 중 | 어댑터만 대기. 인터페이스는 Slice 0 에서 만든다 |
| **D4** | 비하인드 6장의 분기 구조 | 열림 | 작가 결정 — "비하인드 2장 각각이 A/B" vs "1장 후 선택 → 결말 1장씩" |
| **D5** | 저작권 | 열림 | 퍼블릭 도메인 원작이어도 특정 번역·각색·삽화에 권리가 있을 수 있다. **실 콘텐츠 투입 전에 끝나야 한다** |
| ~~D6~~ | ~~프론트 테스트~~ | **✅ 해소 (09-04)** | **vitest 도입.** 순수 로직과 `lib/api` 부터. `ci:core` 에 `test` 단계가 생긴다 |
| **D10** | 계정·데이터 삭제 | **열림 · 신규** | 생성 결과를 **영구 보관**하기로 해서 생긴 항목이다. 탈퇴·삭제 요구에 어떻게 응할지 정해야 한다 |
| ~~D7~~ | ~~프론트·백 타입 공유~~ | **✅ 해소 (09-04)** | 공유 패키지 `packages/contracts`. ↓ 「타입·검증 공유」 |
| ~~D8~~ | ~~백엔드 검증 체계~~ | **✅ 해소 (09-04)** | **전면 교체** — 전역 파이프를 스키마 기반으로 바꾸고 class-validator 를 걷어낸다. ↓ 「D8 확정」 |
| **D9** | 오디오 낭독 | **보류 (09-04)** | 할지 말지 미정. `story_pages.audio_key` 는 **결정 전까지 추가하지 않는다** — 안 쓸 컬럼을 미리 만들지 않는다 |

**지금 무엇이 막혀 있는가 (2026-09-07)** — 슬라이스마다 흩어져 있어 한눈에 안 보이므로 여기 모은다.

| 미결정 | 막고 있는 것 | 비중 |
|---|---|---|
| ~~**D1** 이미지 보관~~ | ~~Slice 3 · Slice 4~~ | **✅ 해소 (09-07)** — MinIO 확정. Slice 3 착수 가능 |
| **D3** 이미지 생성 모델 | Slice 4 (어댑터만) | Port 경계는 Slice 4 에서 어댑터와 함께 만든다 |
| **D4** 비하인드 분기 구조 | Slice 6 · 분기 카드 메타 마이그레이션 | 작가 결정 |
| **D5** 저작권 | 실 콘텐츠 투입 | 개발용 픽스처로 우회 중이라 **구현은 막지 않는다** |
| **D9** 오디오 | `audio_key` 컬럼 · `AudioPlayer` | 안 하기로 하면 할 일이 사라진다 |
| **D10** 계정·데이터 삭제 | 없음 (정책) | 출시 전까지 |

**→ 이제 Slice 3 이 최우선이다.** D1 이 풀려 `StoragePort` 의 형태(**S3 어댑터**)가 정해졌다.
이미지 생성 모델(D3)은 스텁 어댑터로 뚫는다 — ↑ 「개발용 픽스처」의 방식 그대로다.

---

## 비용 제약 ⚠️

**6장 생성 추정 1,200원 → 목표 300원.** 4분의 1로 줄여야 한다. 모델이 미정이라 단가는 못 내지만 **구조로 미리 방어**한다.

1. **1인 최대 2권** — `UNIQUE(user_id, template_id)` 가 만드는 자연 상한이다. 카운터가 아니다 (Slice 3)
2. **프로젝트 단위 지출 상한** — 1차 $50. 카운터를 못 읽으면 호출하지 않는다 (**fail-closed**)
3. **레퍼런스 1장 재사용** — ↓ 「얼굴 데이터 처리」 C안. 페이지마다 얼굴에서 새로 만들지 않는다
4. **생성 결과 캐시** — 같은 동화를 다시 읽을 때 재생성하지 않는다
5. **대화 응답 길이 상한** + 현재 장면만 프롬프트에 (전체 기록 금지)
6. **재시도 횟수 상한**

🚫 카운터를 인메모리로 두지 않는다. **레플리카가 3개라 실효 한도가 3배가 된다.**

---

## 아키텍처 — 프론트 ↔ 백 경계

```text
브라우저 ──상대경로 /api/v2/*──► Caddy ──► apps/back (5501)
   │                                            │
   └── Next.js (5502) ── 서버 컴포넌트 ──────────┘
                         BACKEND_INTERNAL_URL (overlay 직통)
```

| 어디서 | 무엇을 쓰나 |
|---|---|
| 클라이언트 컴포넌트 | **상대경로** `fetch('/api/v2/...')` |
| 서버 컴포넌트 · route handler | `process.env.BACKEND_INTERNAL_URL` |

- 🚫 `NEXT_PUBLIC_API_BASE_URL` 류를 새로 만들지 않는다. 상대경로면 빌드타임 env 가 줄고 CORS 가 발생하지 않는다.
- 🚫 도메인을 코드·`.env.production` 에 하드코딩하지 않는다.
- 🚫 Caddy matcher 를 `/api/*` 로 넓히지 않는다. 프론트 헬스체크(`/api/health`)가 백엔드로 흘러가 영구 unhealthy 가 된다.

### 응답 계약

프론트는 이 두 형태만 알면 된다. **공용 타입을 프론트에 한 번 선언**하고 재사용한다.

```ts
type ApiSuccess<T> = { code: 'SUCCESS'; data: T; message: string };
type ApiError      = { code: string; message: string; timestamp: string; details?: unknown };
```

- 🚫 에러 바디에 **`statusCode` 필드는 없다.** HTTP 상태와 `code` 로 분기한다.
- 성공 상태는 정석 REST 다. 생성 201, 본문 없음 204 — **전부 200 이 아니다.**

---

## 디자인 시스템

AI 시안 5장(홈·리더·비하인드 선택·생성 대기·개인화 결과)에서 도출했다. **색 값은 초안이다** — UI 담당이 확정하면 이 표를 먼저 고친다.

### 기준 뷰포트 — 태블릿 가로 우선 ⭐

시안 5장이 **전부 태블릿 가로**다. 통상의 모바일 퍼스트와 반대이므로 초반에 못 박는다. 나중에 뒤집으면 레이아웃을 전부 다시 짠다.

- 기준 해상도: **1024 × 768** (태블릿 가로)
- Tailwind 는 `min-width` 기반 모바일 퍼스트다. **이 방향을 뒤집지 않는다** — 뒤집으면 유틸리티 클래스 전부와 싸우게 된다
- 대신 규약으로 정한다: **완성형 레이아웃은 `md:` 이상에서 만들고, base(모바일)는 축소 대응**이다
- 🚫 모바일에서 픽셀 단위로 완벽할 것을 요구하지 않는다. 시연 대상이 태블릿이다

### 토큰 (초안)

| 토큰 | 값(초안) | 쓰이는 곳 |
|---|---|---|
| `--color-primary` | 하늘색 | 헤더 바 · 얼굴 인식 CTA · 본문 말풍선 |
| `--color-primary-soft` | 연한 하늘 | 카드 배경 · 삽화 프레임 |
| `--color-surface` | 크림 | 페이지 배경 |
| `--color-accent-a` | 민트/세이지 | `다음 페이지` · 비하인드 **A** |
| `--color-accent-b` | 코랄/핑크 | 비하인드 **B** |
| `--color-ink` | 짙은 회청 | 본문 텍스트 |
| `--radius-card` | 20~24px | 카드 |
| `--radius-pill` | 999px | 버튼 |
| `--touch-min` | **56px** | 모든 터치 타깃 |

- `--touch-min` 이 WCAG 권장(44px)보다 큰 이유: **아이 손가락이 대상**이다. 시안의 버튼이 전부 크다
- 정의 위치는 `app/globals.css` 의 `@theme inline` **한 곳**이다 (Tailwind v4 CSS-first). 🚫 `tailwind.config.ts` 를 만들지 않는다
- 🚫 컴포넌트에 색 리터럴(`bg-[#6BA3D6]`)을 쓰지 않는다. 토큰만 쓴다

### 지금 고쳐야 하는 스캐폴드 잔재 ⚠️

`apps/front` 는 `create-next-app` 기본형 그대로다(2026-09-04 실측). 디자인 작업 **전에** 정리한다.

| 파일 | 현재 | 조치 |
|---|---|---|
| `app/layout.tsx` | `lang="en"` · `title: "Create Next App"` | `lang="ko"` · 실제 서비스명 |
| `app/layout.tsx` | `Geist({ subsets: ["latin"] })` | **한글 서브셋이 없다.** 한글이 시스템 fallback 으로 렌더된다 → 라운드 계열 한글 폰트로 교체 |
| `app/globals.css` | `body { font-family: Arial, Helvetica }` | 폰트 변수를 덮어쓰는 잔재. 제거 |
| `app/globals.css` | `@media (prefers-color-scheme: dark)` | **다크모드를 쓰지 않는다.** 시안이 전부 라이트이고 파스텔 팔레트가 다크에서 성립하지 않는다 → 제거 |

⚠️ `next build` 는 Google Fonts 를 네트워크로 받는다. 폰트를 바꿀 때 빌드가 깨지지 않는지 확인한다.

### 컴포넌트 인벤토리 — 중복을 먼저 잡는다

시안에서 **같은 구조가 세 화면에 반복**된다. 이걸 하나로 안 잡으면 카드 컴포넌트가 3벌 생긴다.

> ⚠️ 아래는 **시안이 요구하는 목록**이지 구현 현황이 아니다. 🚫 컴포넌트는 **첫 사용처와 함께** 만든다 —
> 미리 만들면 아무도 import 하지 않는 죽은 코드가 되고, 디자인이 바뀌어도 안 고쳐져 틀린 예제로 남는다
> (2026-09-04 리뷰에서 실제로 걸렸다). **구현됨** 표기가 없으면 아직 없는 것이다.

| 컴포넌트 | 시안 등장 | 상태 | 비고 |
|---|---|---|---|
| **`StoryCard`** | 홈 앨범 · 서재 목록 · **비하인드 A/B 선택** | ✅ | ⭐ **셋이 같은 구조다** — 썸네일 + 제목 + 부제 + 설명 + 액션. `variant`(album·library·choice)로 흡수 |
| **`AppHeader`** | 전 화면 | ✅ (2026-09-07) | 루트 레이아웃의 sticky 상단 네비 — 홈·서재·로그인. 🚫 **`설정`·`내 프로필` 은 만들지 않는다**(2026-09-07 결정). 하단 `TabBar` 도 두지 않는다 |
| `IconButton` | 리더·비하인드의 `집` 버튼 | 미구현 | 반복 등장 |
| `ActionButton` | `얼굴 인식 시작` · `선택하기` · `다음 페이지` | 미구현 — 스타일은 `actionClass` 가 이미 있다 | 색만 다르다 → `variant` |
| `FaceGuideCircle` | 홈 얼굴 등록 | 미구현 | 촬영 화면과 공유 |
| `BookFrame` | 리더 · 비하인드 | 미구현 | 페이지 컬 배경 |
| ~~`AudioPlayer`~~ | 리더 | 보류 | **보류 (D9)** — 낭독을 할지 자체가 미정이다. 쓸지 모르는 컴포넌트를 먼저 만들지 않는다 |
| `ProgressWithTip` | 생성 대기 | 미구현 | 진행률 + 팁 텍스트. **Slice 4 의 UX 답이다** |

**variant 는 `Record<Variant, string>` 객체 맵으로 관리한다.** 참고 B 의 방식이고 `cva`·`tailwind-merge`·`clsx` **의존성이 0개**로 해결된다. 새 의존성은 승인 대상이므로 이쪽이 유리하다.

---

## 프론트 아키텍처

### 폴더 구조

`@/*` alias 가 이미 `./*` 로 잡혀 있다(`tsconfig.json` 실측). `app/` 은 **라우트만** 두고 나머지는 형제 디렉터리로 뺀다.

```text
apps/front/
  app/
    (demo)/              시연 — 로그인 불필요
    (trial)/             체험 — 인증 필요
    api/health/          🚫 건드리지 않는다 (liveness)
    layout.tsx  globals.css
  components/
    ui/                  Button · Card · Modal — 도메인을 모른다
    story/               StoryCard · BookFrame · AudioPlayer
  hooks/
  lib/api/               fetch 클라이언트 · 에러 타입
  types/
```

- **라우트 그룹 `(demo)` / `(trial)` 로 두 모드를 가른다.** 인증 가드가 `(trial)/layout.tsx` **한 곳**에 붙어 각 페이지가 인증을 신경 쓰지 않는다
- `components/ui/` 는 **도메인을 모른다.** 동화·세션 타입을 import 하는 순간 그건 `components/story/` 로 간다
- 라우트 전용 컴포넌트는 그 라우트 폴더에 colocate 한다. **두 번째 라우트가 쓰는 순간** `components/` 로 올린다

### Server / Client 경계

- 기본은 **Server Component**. `'use client'` 는 훅·이벤트 핸들러가 실제로 필요한 파일에만 붙인다
- 조회는 가능한 한 Server Component 에서 `BACKEND_INTERNAL_URL` 로. 폴링·촬영처럼 상호작용이 필요한 것만 Client
- 🚫 **Server Actions 를 도입하려면** `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 고정이 **필수**다. 레플리카 3개 + `start-first` 롤링에서 빌드마다 키가 랜덤이면 `Failed to find Server Action` 이 뜬다
- 🚫 ISR·`use cache`·`revalidateTag()` 를 도입하려면 Redis `cacheHandler` 가 **필수**다. 기본 캐시는 컨테이너별이라 한 레플리카만 무효화된다

### API 클라이언트

참고 B 의 `FetchClient` + `ApiError` 설계를 가져오되 **baseURL 처리만 우리 규약으로 바꾼다.**

```ts
type ApiSuccess<T> = { code: 'SUCCESS'; data: T; message: string };
type ApiErrorBody  = { code: string; message: string; timestamp: string; details?: unknown };

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) { super(message); }
  get isUnauthorized() { return this.status === 401; }
}
```

- 🚫 **`NEXT_PUBLIC_API_BASE_URL` 류를 만들지 않는다.** 참고 B 는 이걸 쓰지만 우리 규약과 정면 충돌한다. baseURL 은 **호출 컨텍스트가 정한다** — 브라우저는 `''`(상대경로), 서버는 `BACKEND_INTERNAL_URL`
- 에러는 바디의 `code` 로 분기한다. 🚫 `statusCode` 필드는 응답에 **없다**
- 401 은 전역 이벤트로 올려 로그아웃 처리를 한 곳에 모은다 (참고 B 방식)
- **React Query 등 서버상태 라이브러리는 도입하지 않고 시작한다.** 새 의존성이고, 우리 화면은 폴링 1곳 외에 캐시 요구가 얕다. 필요해지면 그때 승인받는다

### 낙관적 업데이트

상태 변경을 UI 에 먼저 반영하고 **실패 시 이전 값으로 롤백**한다(참고 B). 비하인드 선택처럼 즉시 반응이 필요한 곳에 쓴다.
🚫 롤백 경로 없는 낙관적 업데이트는 만들지 않는다 — 실패가 조용히 잘못된 화면으로 굳는다.

---

## 데이터 모델

```text
[콘텐츠 — 사전 제작, 앱은 읽기만]                      ✅ Slice 1 완료
story_templates ──┬── story_pages ──── story_page_characters ──┐
                  └── story_characters ─────────────────────────┘

[사용자 — Slice 2]
users            (login_id · password_hash)
세션·체험 횟수    → Redis (테이블 아님)

[진행 상태 — Slice 3~6]
story_sessions ──┬── session_page_images   (개인화 결과·상태)
                 └── session_branch_choice (A/B 선택)
```

🚫 **얼굴 이미지 테이블은 없다.** 저장하지 않는다.

### ⚠️ 시안이 드러낸 스키마 결손

AI 시안 5장을 보고 **현재 스키마에 없는데 필요한 것**이 드러났다. Slice 6 이전에 마이그레이션 1개로 추가한다.

| 필요한 것 | 어디에 | 왜 |
|---|---|---|
| ~~`story_pages.audio_key`~~ | — | **보류 (D9).** 시안에는 오디오 플레이어가 있지만 낭독을 할지 자체가 미정이다. 하기로 하면 컬럼 1개 추가 마이그레이션이면 된다 — **미리 만들지 않는다** |
| 분기 카드 메타 (`title` · `subtitle` · `description` · `thumbnail_key`) | 콘텐츠 | 비하인드 A/B 화면이 **카드로 선택**시킨다. 제목·부제·설명·썸네일이 전부 콘텐츠 데이터다 |
| `story_templates.is_demo` · `story_pages.demo_image_key` | 콘텐츠 | **시연 모드(1권 고정)의 미리 합성된 이미지.** ↓ 「시연 콘텐츠를 어떻게 둘 것인가」 |
| `story_templates.album_thumbnail_key` | 콘텐츠 | 홈의 "나의 동화 앨범" 카드가 서재 커버와 **다른 비율**을 쓴다. 한 키를 돌려쓰면 잘림이 생긴다 — **메인 검증 요청**: 디자인 담당과 확인 후 확정 |

시안의 A/B 카드가 각각 독립된 썸네일·제목·설명을 갖는 것으로 보아 **D4 는 "비하인드 2장이 각각 A/B"** 쪽에 무게가 실린다. 작가 확인이 필요하다.

⚠️ 오디오는 **D9 로 보류**다. 리더의 `AudioPlayer` 컴포넌트도 같이 보류한다 — 쓸지 모르는 컴포넌트를 먼저 만들지 않는다.

### 시연 콘텐츠를 어떻게 둘 것인가

09-04 에 **"시연 동화는 1권 고정"** 이 정해졌다. 두 방식 중 아래를 택한다 — **가정이므로 다르면 알려달라.**

| | 별도 동화 레코드 (`demo-cinderella`) | **`is_demo` + `demo_image_key`** ✅ |
|---|---|---|
| 본문 | **두 벌** — 원고를 고치면 두 곳을 고친다 | 한 벌 |
| 위험 | 두 벌이 서로 어긋난다 | 시연 대상 페이지에 이미지를 **안 채우면 시연이 깨진다** |
| 시드 | 콘텐츠 3벌(시연 1 + 체험 2) | 콘텐츠 2벌 + 그중 1권에 시연 이미지 |

**후자를 택한다.** 시연 대상이 1권 고정이라 "전수 채움" 위험이 그 1권에만 국한되고, 원고 수정이 한 곳에서 끝난다.
🚫 시연 대상 동화의 페이지 중 `demo_image_key` 가 비어 있으면 **시드 투입 단계에서 막는다.** 런타임에 발견하면 시연 중이다.

### Slice 1 에서 확정한 스키마 규약 ✅

뼈대 문서가 「엔티티 컬럼 타입·네이밍 규칙 — 첫 엔티티에서」로 남겨둔 항목을 닫았다.

| 규약 | 값 | 근거 |
|---|---|---|
| 엔티티 위치 | **`src/entities/`** (모듈 안이 아니라) | `@entities/*` alias 가 그 자리를 가리킨다. 모듈을 넘는 참조에서 순환 import 가 안 생긴다 |
| 테이블명 | snake_case 복수형 | |
| 컬럼명 | snake_case · 속성은 camelCase · **모든 컬럼에 `@Column({ name })` 명시** | 규약 유추와 명시가 섞이면 속성명을 다듬는 것만으로 SQL 컬럼이 조용히 바뀐다 |
| PK | `INT UNSIGNED AUTO_INCREMENT` | |
| 외부 노출 식별자 | **`slug`** | id 를 노출하면 콘텐츠 수가 드러나고 값을 1씩 바꿔 미공개 콘텐츠를 찾을 수 있다 |
| 시각 컬럼 | `DATETIME(3)` + DB 기본값 | 🚫 `TIMESTAMP` 금지 |
| 민감 컬럼 | `select: false` | 선언된 컬럼은 모든 `find` 에서 SELECT 되어 응답·로그로 샌다 |
| 마이그레이션 | `IF NOT EXISTS` / `IF EXISTS` + `down()` | MySQL 은 DDL 이 암묵 커밋이라 중간 실패가 부분 적용으로 남는다 |

---

## 얼굴 데이터 처리 — "저장 안 하는데 업로드가 왜 필요한가"

정당한 의문이고, **비동기 생성과 정면으로 충돌하는 지점**이라 여기서 답을 고정한다.

개인화는 6장을 만들어야 해서 오래 걸린다 → `202 + 폴링` 구조가 맞다.
그런데 요청이 끝나면 메모리의 얼굴은 사라진다. **나중에 도는 잡이 그 바이트를 필요로 한다.** 이게 충돌이다.

| 안 | 방식 | 얼굴이 디스크에 닿나 | 문제 |
|---|---|---|---|
| A | 동기 pass-through — 업로드 요청 안에서 6장 생성까지 완료 | **안 닿음** | 요청이 수십 초~분. 타임아웃·재시도 시 전액 재과금 |
| B | 임시 저장 (`tmp/` + 짧은 TTL) | 닿음 | "저장 안 한다"가 약해진다 |
| **C** | **레퍼런스 1장 생성 후 얼굴 폐기** | **안 닿음** | 권장 |

### C안 (권장)

```text
1단계 (동기, 짧다)   얼굴 3장(정면/좌/우) ──► 주인공 레퍼런스 이미지 1장
                     └─ 응답 반환과 동시에 얼굴 바이트 폐기 ─┘
2단계 (비동기, 길다) 레퍼런스 이미지 ──► 페이지 6장 개인화
```

이 안이 좋은 이유가 셋이다.

1. **얼굴 보유 시간 = 단일 요청 수명.** 디스크에 닿지 않으므로 "저장하지 않는다"가 구조로 보장된다
2. **비용** — 페이지마다 얼굴에서 새로 만들지 않고 레퍼런스 1장을 재사용한다. 1200원 → 300원 목표의 핵심 수단
3. **얼굴 일관성 (RISK-001)** — 모든 페이지가 같은 레퍼런스를 참조하므로 페이지 간 인물 동일성이 올라간다

**결론**
- 얼굴은 **`multipart/form-data` 로 3장을 한 요청에 담아** 받는다. 서명 URL·`POST /uploads` 2단계 커밋이 **필요 없다**
- 오브젝트 스토리지(D1)는 얼굴이 아니라 **레퍼런스 이미지와 생성 결과** 때문에 필요하다
- 얼굴 검증(크기·**매직바이트** 기반 실제 형식)은 수신 즉시. 확장자·헤더는 위조된다
- 🚫 얼굴 바이트를 로그·에러 메시지·APM 에 싣지 않는다
- ⚠️ 1단계가 동기라 **레플리카 3개짜리 API 가 수 MB 를 받는다.** 요청 크기 상한을 명시하고, 프론트가 **업로드 전에 캔버스로 리사이즈**한다

---

## 이미지 보관 (D1) — 2026-09-07 확정

**자체 호스팅 MinIO 를 Swarm 스택으로 띄운다.** 스택 파일은 `prod_nerd_storage.yml`.

| 결정 | 값 |
|---|---|
| 저장 위치 | 서버 **블록 스토리지** + 도커 네임드 볼륨 (`mysql-data` 와 같은 패턴) |
| 인터페이스 | **S3 API** (MinIO) |
| 서빙 방식 | **서명 URL** — 브라우저가 MinIO 에서 직접 받는다. 백엔드를 안 거친다 |
| 삭제 규칙 | ⏸ **열림** — D10(계정·데이터 삭제)과 한 몸. 출시 전까지 |

### 왜 파일시스템이 아니라 S3 인가

같은 날 로컬 볼륨 + 백엔드 스트리밍으로 먼저 정했다가 **S3 로 바꿨다.** 이유는 인기가 아니라
**포팅 가능성**이다.

| | 파일시스템 어댑터 | **S3 (MinIO)** ✅ |
|---|---|---|
| 나중에 R2·S3 로 이전 | 어댑터 재작성 | 엔드포인트·키 교체 |
| 서명 URL | 불가 | 가능 |
| 이미지 트래픽 | Node 3 레플리카를 통과 | 스토리지가 직접 |

**서명 URL 이 생기면서 「서빙 방식」 결정이 저절로 풀렸다** — 만료 시간이 붙은 URL 을 백엔드가
발급하고 브라우저가 스토리지에서 직접 받는다. 인증도 되고 Node 도 안 거친다.

🚫 **파일 키는 UUID 다. 순번(`1.png`)을 쓰지 않는다** — 번호를 바꿔가며 남의 이미지를 찾을 수 있다.

### 서버 여력 (실측)

`OCI Ampere A1 · 12GB RAM · 2 OCPU · 블록 볼륨 58GB · linux/arm64`.
현재 스택 limits 합계 ≈ **5.65GB**(back 1.92 + front 1.54 + db 2.0 + cache 0.19) → **약 6GB 여유**.
MinIO 에 1GB 를 배정해도 넉넉하다. 디스크는 1인 ~7MB(레퍼런스 2 + 페이지 12) 기준 **40GB ≈ 5,700명**.

가용성은 나아지지 않는다 — 같은 노드·같은 볼륨이라 노드가 죽으면 똑같이 끝이다. 얻는 것은
**인터페이스(S3)와 서빙 오프로드**이지 이중화가 아니다 (09-07: 가용성은 상관없다고 확인).

### 🚫 함정 — 서명 URL 은 **서명한 호스트에서만** 유효하다

백엔드가 내부 DNS(`prod_nerd_storage_minio:9000`)로 서명하면 **브라우저에서 그 URL 이 동작하지 않는다.**
서명에는 리버스 프록시가 외부로 노출하는 주소를 써야 하고, MinIO 에 실제로 도달하는 경로는 내부 DNS 다 —
**둘이 다르다.** 그래서 앱 env 에 `S3_ENDPOINT`(내부 접근용)와 `S3_PUBLIC_URL`(서명용)이 **따로** 필요하다.
하나로 합치면 서버에서는 되는데 브라우저에서만 403 이 난다.

⚠️ 리버스 프록시 라우트를 추가할 때 **`route` 블록 안에서는 작성 순서가 곧 평가 순서다.** matcher 없는
catch-all 이 위에 있으면 그 아래는 도달하지 않는다 (전례: `/api/v2/*` 가 이웃 프로젝트로 흘러감).

### 새 의존성 — 승인 필요 ⚠️

S3 클라이언트가 필요하다. 기존 스택으로는 안 풀린다 — S3 v4 서명을 직접 구현하는 것은 위험하다.

| 후보 | 판단 |
|---|---|
| **`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`** | 권장 — R2·S3 가 이 SDK 사용을 문서화한다. 이전 비용이 가장 낮다 |
| `minio` (공식 JS 클라이언트) | 더 가볍지만 MinIO 에 묶인다. 포팅 가능성이 채택 이유였으므로 상충 |

### 환경 준비물 — 어디에 무엇을 넣나

🚫 실제 도메인·경로를 이 문서에 적지 않는다 (인프라 식별 정보). 값은 시크릿·서버 env 가 소유한다.

| 어디 | 키 | 값의 성격 |
|---|---|---|
| GitHub Secret | `MINIO_DATA_DIR` | `<블록볼륨 마운트>/nerd/prod/storage/data` |
| GitHub Secret | `MINIO_SERVER_URL` | `https://<스토리지 서브도메인>` — **서명 URL 이 이 이름으로 서명된다** |
| GitHub Secret | `STORAGE_CORS_ORIGINS` | `https://<서비스 도메인>` (프론트 오리진). 🚫 `*` 금지 |
| Swarm secret | `prod_nerd_storage_root_user` · `_root_pw` | 매니저에서 사람이 1회 생성 |
| 백엔드 서버 `.env` | `S3_ENDPOINT` | **내부** overlay DNS — `http://prod_nerd_storage_minio:9000` (TLS 불필요) |
| 백엔드 서버 `.env` | `S3_PUBLIC_URL` | **외부** 주소 — `MINIO_SERVER_URL` 과 같은 값 |
| 백엔드 서버 `.env` | `S3_BUCKET` · `S3_REGION` | 리전은 스택의 `MINIO_REGION` 과 **반드시 일치** |
| 백엔드 서버 `.env` | `S3_ACCESS_KEY` · `S3_SECRET_KEY` | 🚫 root 가 아니라 **버킷 하나만 접근하는 앱 전용 키** |

**서브도메인을 쓴다** — 경로 프리픽스(`/storage/*`)로 두지 않는다. S3 서명은 경로를 포함해서 계산되므로
프록시가 프리픽스를 떼면 클라이언트가 서명한 것과 서버가 계산한 것이 어긋난다.

🚫 **SDK 는 path-style 을 강제한다(`forcePathStyle: true`).** 기본값인 virtual-host style 은
`<버킷>.<스토리지 도메인>` 으로 접속을 시도하는데, TLS 인증서가 그 이름을 포함하지 않아 실패한다.

### 부트스트랩 (스택이 뜬 뒤 1회)

콘솔을 껐으므로(`MINIO_BROWSER=off`) `mc` 로 한다. 컨테이너 안에 이미 있다.

```bash
cid=$(docker ps -q --filter "label=com.docker.stack.namespace=prod_nerd_storage" | head -1)
docker exec -it "$cid" sh -lc '
  mc alias set local http://127.0.0.1:9000 "$(cat /run/secrets/prod_nerd_storage_root_user)" "$(cat /run/secrets/prod_nerd_storage_root_pw)"
  mc mb --ignore-existing local/<버킷명>
  mc admin user add local <앱키> <앱시크릿>
  mc admin policy attach local readwrite --user <앱키>
'
```

⚠️ `readwrite` 는 내장 정책이라 **모든 버킷**에 쓴다. 버킷이 하나뿐인 지금은 충분하지만,
버킷이 늘면 그 버킷만 허용하는 정책을 따로 만든다.

### 리버스 프록시 — **별도 호스트 블록**이다 ⭐

기존 도메인의 `route` 안에 경로를 하나 더 넣는 방식이 **아니다.** 스토리지는 자기 호스트(서브도메인)를
가져야 한다 — S3 서명은 경로를 포함해 계산되므로 프록시가 프리픽스를 떼면 클라이언트가 서명한 것과
서버가 계산한 것이 어긋나 전부 403 이 된다.

```caddyfile
<스토리지 서브도메인> {
    reverse_proxy prod_nerd_storage_minio:9000
}
```

- **기존 프론트 도메인 블록은 건드리지 않는다.** 별도 블록이라 `route` 순서 함정과 무관하다
  (그 함정은 한 블록 안에서 `handle` 이 상호 배타적일 때 생긴다)
- `MINIO_SERVER_URL` 이 **이 서브도메인과 정확히 같아야 한다.** 다르면 서명 URL 이 403 이다
- 인증서는 Caddy 가 자동 발급한다. DuckDNS 는 와일드카드라 서브도메인 등록이 따로 필요 없다
  (2026-09-07 DNS 실측: 임의 서브도메인이 같은 IP 로 해석됨)
- ⚠️ **Caddy 가 스토리지 스택과 같은 overlay 망에 있어야** 서비스 DNS 로 닿는다.
  스택은 `${OVERLAY_NETWORK}` 를 external 로 참조한다
- 업로드 크기 상한을 프록시가 막지 않는지 확인한다 — 얼굴 3장이 수 MB 다

### 배포 게이트 (Slice 3 머지 전) ⚠️

코드 결함이 아니라 **환경 준비물**이다. 미충족 상태로 배포하면 업로드가 전부 실패한다.

- [ ] 노드 라벨 `prod_nerd_storage=1`
- [ ] Swarm 시크릿 2개 — `prod_nerd_storage_root_user` · `prod_nerd_storage_root_pw`
- [ ] 블록 스토리지에 데이터 디렉터리 생성 + 서버 .env 에 `MINIO_DATA_DIR` · `MINIO_IMAGE_TAG` · `STORAGE_CORS_ORIGINS`
- [ ] 스택 배포
- [ ] 버킷 생성 + **앱 전용 액세스 키** 발급 (🚫 root 자격증명을 앱에 주지 않는다)
- [ ] 리버스 프록시 라우트 (09-07 확인: 설정 가능)
- [ ] 백엔드 `.env` — `S3_ENDPOINT` · `S3_PUBLIC_URL` · `S3_BUCKET` · `S3_ACCESS_KEY` · `S3_SECRET_KEY`

**미검증** — 이 스택은 아직 배포한 적이 없다. 특히 `healthcheck` 의 `mc ready local` 은 MinIO
릴리스마다 이미지 구성이 달라 **첫 배포에서 healthy 로 뜨는지 확인해야 한다.** 안 되면 그 블록을
지우고 재배포한다 — 재시작 루프를 피하는 것이 먼저다.

**라이선스** — MinIO 는 AGPLv3 이고 2025 년에 커뮤니티 에디션 정책이 바뀌었다.
09-07 확인: **대회용이고 상용화 계획이 없어 문제 없음.** 상용화하게 되면 이 줄을 다시 본다.

---

## API 계약

전부 `/api/v2` 하위.

| # | 메서드·경로 | 용도 | 상태 |
|---|---|---|---|
| 1 | `GET /stories` | 서재 목록 (공개 동화만) | ✅ 구현됨 |
| 2 | `GET /stories/:slug` | 동화 상세 — 페이지 수 + 등장인물 | ✅ 구현됨 |
| 3 | `GET /stories/:slug/pages/:pageNo` | 리더 — 본문 + 기본 삽화 + 대화 가능 캐릭터 | ✅ 구현됨 |
| 4 | `POST /auth/signup` | 아이디·비밀번호 가입 | ✅ 구현됨 |
| 5 | `POST /auth/login` | 로그인 → 세션 쿠키 | ✅ 구현됨 (200, `@HttpCode` 명시) |
| 6 | `POST /auth/logout` | 세션 파기 | ✅ 구현됨 (204) |
| 7 | **`GET /auth/me`** | 로그인 상태 | ✅ 구현됨 — 경로가 `/me` 가 아니다(실측). 「남은 체험 횟수」는 **없다** — 제한이 카운터가 아니라 `UNIQUE(user_id, template_id)` 라 Slice 3 에서 붙는다 |
| 8 | `POST /sessions` | 체험 1회 소비 + 세션 생성 | Slice 3 |
| 9 | `POST /sessions/:id/face` | 얼굴 3장 → 레퍼런스 생성 (동기) | Slice 3 |
| 10 | `POST /sessions/:id/personalize` | 페이지 개인화 시작 (202) | Slice 4 |
| 11 | `GET /sessions/:id/pages` | 진행 상태 폴링 | Slice 4 |
| 12 | `POST /sessions/:id/pages/:n/retry` | 실패 페이지 재시도 | Slice 4 |
| 13 | `POST /sessions/:id/pages/:n/characters/:role/messages` | 등장인물 대화 | Slice 5 |
| 14 | `GET /sessions/:id/after-story` · `POST .../choice` | 비하인드 + A/B | Slice 6 |

⚠️ **11번은 폴링 경로다.** 별도 완화 예산을 검토하고 `LOG_IGNORED_PATHS` 에 넣어 로그 폭증을 막는다.
🚫 인자 없는 `@SkipThrottle()` 은 동작하지 않는다.

### 화면 ↔ API 매핑

| 화면 | 모드 | 쓰는 API |
|---|---|---|
| 첫 진입 · 서재 | 공통 | 1 |
| 시연 리더 | 시연 | 2, 3 |
| 로그인 · 가입 | 체험 | 4, 5, 7 — 화면은 `/login` 만 있고 **가입 화면은 아직 없다** |
| 나의 동화 앨범 | 체험 | 7 |
| 얼굴 촬영 | 체험 | 8, 9 |
| 생성 대기 | 체험 | 10, 11, 12 |
| 개인화 리더 | 체험 | 3, 11 |
| 등장인물 대화 | 체험 | 13 |
| 비하인드 · 분기 | 체험 | 14 |

---

## Port & Adapter

**서비스는 SDK 를 직접 들지 않는다.** 모델·공급자 교체가 어댑터 1개 교체로 끝나야 한다.

```text
StoryPersonalizeService ──► ImageGenerationPort (인터페이스)
                                    ▲
                          ┌─────────┴─────────┐
                    OpenRouterAdapter    (교체 대상)
```

| Port | 용도 | 상태 |
|---|---|---|
| `LlmPort` | 등장인물 대화 | 인터페이스 존재. **OpenRouter 어댑터 미구현** (Slice 5) |
| `ImageGenerationPort` | 얼굴 → 레퍼런스, 레퍼런스 → 페이지 | **인터페이스를 Slice 0 에서 만든다.** 어댑터는 D3 대기 |
| `StoragePort` | 레퍼런스·생성 결과 보관 | D1 확정 후 (Slice 3) |

### 인터페이스 설계 원칙

- **모델 식별자를 인터페이스에 노출하지 않는다.** 어댑터 내부 설정이다. 서비스가 모델명을 알면 교체가 서비스까지 번진다
- 반환에 **`usage`(모델명·토큰/이미지 수·소요시간)를 포함**한다. OpenRouter 는 여러 모델을 한 엔드포인트 뒤에 두므로, 안 남기면 **어느 모델이 예산을 먹었는지 사후에 알 수 없다**
- 🚫 요청·응답 **본문을 로그에 남기지 않는다.** 토큰 수·모델명·소요시간만
- 그 의존이 죽어도 앱은 기동·응답한다. DB 만 예외
- **비용 카운터는 fail-closed** — 레이트리밋의 fail-open 을 여기 옮기면 셀 수 없을 때 무제한으로 쓴다
- 어댑터를 **`ci:core` 에서 실제 호출하지 않는다.** 테스트는 Port 스텁으로 돈다

---

## 백엔드 공통 규약 — 이번에 보강할 것

참고 A 는 우리와 **같은 스택**(NestJS 11 + TypeORM)이고, 핵심 패턴(`defineDomainError` · `ApiErrorResponseDto` · `HttpExceptionFilter` · Port · `env.validation`)은 **이미 우리 쪽에 있다.**
일부는 우리가 더 낫다 — 전역 필터의 헬스체크 passthrough 단계, `no-floating-promises` 강제, `expectDomainError` 헬퍼.

**실제로 비어 있는 것은 넷이다.**

| # | 항목 | 현재 | 조치 |
|---|---|---|---|
| **B1** | Mock Repository 공용 헬퍼 | `story.service.spec.ts` 안에 `repoStub<T>()` 를 **로컬 정의** | `src/common/__spec__/mock-repository.ts` 로 추출. 참고 A 는 17개 spec 이 공유한다 |
| **B2** | Entity Factory | `PUBLISHED_TEMPLATE` 을 `as StoryTemplate` **인라인 캐스팅** | `src/entities/__spec__/entity.factory.ts` |
| **B3** | Swagger 성공 응답 보일러플레이트 | 엔드포인트마다 `XxxResponseDto extends ApiSuccessResponseDto` 를 손으로 만든다 (Slice 1 에서 3개) | 제네릭 데코레이터로 뺀다 |
| **B4** | 에러 코드 유니온 | 코드가 각 모듈 `*.error.dto.ts` 에 흩어져 있다 | 프론트와의 계약을 타입으로 고정할 `ErrorCode` 유니온 |

**B1·B2 는 지금이 적기다.** 도메인 모듈이 `story` 하나뿐이라 중복 비용이 아직 안 드러났을 뿐,
`users`·`story_sessions` 가 생기는 순간 "컬럼 하나 추가 → spec 여러 개 수정"이 그대로 재현된다.

**B2 의 4원칙** (참고 A 에서 그대로 가져온다)

- 관계 프로퍼티는 `const UNSET = undefined as never` 로 둔다 — **접근하면 터지는 게 의도다.** 로드하지 않은 관계를 테스트가 쓰고 있으면 즉시 드러난다
- 시각은 `FIXED_DATE` 상수로 고정한다. 현재 시각을 쓰면 결과가 실행 시점에 따라 흔들린다
- 🚫 **엔티티 전체를 캐스팅하지 않는다**(`{...} as Entity`). 필드가 빠져도 컴파일러가 못 잡는다
- `overrides: Partial<T>` 로 케이스별 차이만 표현한다

**B3 형태** — Swagger 가 `data` 를 정확히 그리려면 `allOf` + `getSchemaPath` 가 필요하다.

```ts
export const ApiSuccessResponse = <T extends Type<unknown>>(dataType: T) =>
  applyDecorators(
    ApiExtraModels(ApiSuccessResponseDto, dataType),
    ApiOkResponse({ schema: { allOf: [
      { $ref: getSchemaPath(ApiSuccessResponseDto) },
      { properties: { data: { $ref: getSchemaPath(dataType) } } },
    ] } }),
  );
```

**아직 설계가 필요한 것** — 참고 A 에도 **페이지네이션 DTO 가 없다.** 목록이 커지는 시점에 직접 설계한다. 동화가 2편인 지금은 급하지 않다.

### 🚫 참고 A 에서 가져오면 안 되는 것

- **`x-forwarded-for` 첫 값 직접 파싱** — 참고 A 의 throttler 가 이렇게 한다. Caddy 는 XFF 를 **append** 하므로 공격자가 헤더를 보내면 첫 값이 곧 공격자가 정한 값이 된다. 우리는 `req.ip`(trust proxy 1단)를 쓴다 (code-patterns §6)
- **`dataSource.transaction(cb)` 콜백 방식** — 우리는 `@Transactional` 데코레이터다. 섞으면 트랜잭션 전파가 갈린다

---

## 참고 프로젝트 — 채택 / 기각

| 항목 | 출처 | 판정 |
|---|---|---|
| API 응답·에러 타입 (`ApiSuccess<T>` · `ApiError`) | B | **채택** — 우리 백엔드 봉투와 필드 단위로 일치한다 |
| variant 를 `Record<Variant,string>` 맵으로 | B | **채택** — 의존성 0개 |
| 낙관적 업데이트 + 롤백 | B | **채택** |
| `forwardRef` + `displayName` 관례 | B | 채택 |
| Mock Repository · Entity Factory 헬퍼 | A | **채택** (B1·B2) |
| `@CurrentUser()` 데코레이터 설계 | A | **채택** — Slice 2 에서 |
| `NEXT_PUBLIC_API` 로 백엔드 절대 URL | B | **기각** — 우리 규약과 충돌 |
| 폼 검증을 프론트/백이 각자 관리 | B | **기각** — 불일치가 상존하는 구조다 |
| 백엔드 타입을 프론트가 수동 재정의 | B | **기각** — 우리는 모노레포다 (↓ D7) |
| `x-forwarded-for` 첫 값 파싱 | A | **기각** — 스푸핑 |
| `dataSource.transaction(cb)` | A | **기각** — `@Transactional` 과 충돌 |
| 라우팅·params API 문법 | B | **기각** — 참고는 Next 15, 우리는 **Next 16** |
| 테스트 문화 · 디자인 토큰 체계 | A·B | 참고할 성숙 패턴 없음 — 직접 만든다 |

### 타입·검증 공유 — `packages/contracts` (D7 확정, 2026-09-04)

참고 B 의 가장 큰 약점은 백엔드 DTO 가 바뀌어도 프론트 타입이 자동 추적되지 않는 것이다. 서비스 파일마다 20+ 타입을 손으로 다시 쓴다.
**우리는 같은 저장소에 두 앱이 있으므로 정공법으로 간다** — 스키마를 한 곳에서 소유하고 양쪽이 파생시킨다.

```text
packages/contracts/          ← 검증 스키마 + 파생 타입의 SSOT
  ├─ auth.ts                 loginSchema · signupSchema
  ├─ story.ts                응답 타입
  └─ envelope.ts             ApiSuccess<T> · ApiErrorBody · ErrorCode

apps/back  ─┐
            ├─ workspace:* 로 의존. 스키마 하나가 검증과 타입 양쪽을 만든다
apps/front ─┘
```

- 스키마에서 **타입을 파생**시킨다. 타입을 손으로 다시 쓰지 않는다 — 그 순간 계약이 갈린다
- 프론트 폼 검증과 백엔드 입력 검증이 **같은 스키마**를 쓴다. "프론트는 통과했는데 백엔드가 400" 이 구조적으로 사라진다
- `ErrorCode` 유니온(B4)도 여기가 자리다. 프론트가 `switch` 로 분기할 때 오타를 컴파일러가 잡는다

#### ⚠️ 비용 — 이 결정은 앱 코드에서 끝나지 않는다

저장소의 기존 결정 **세 개**를 건드린다. 시작 전에 전부 인지하고 들어간다.

| 무엇 | 현재 | 왜 바뀌는가 |
|---|---|---|
| `pnpm-workspace.yaml` | `packages: [apps/*]` · `sharedWorkspaceLockfile: false` | 주석이 **"공유 패키지(`packages/*`)가 생기면 재검토한다"** 고 이미 예고해 두었다. 그 시점이 왔다 |
| **Dockerfile 빌드 컨텍스트** | `context: apps/back` · `apps/front` — 앱 디렉터리가 곧 루트 | 공유 패키지가 **컨텍스트 밖**이라 COPY 가 불가능하다. 컨텍스트를 **레포 루트로 올리고** 두 Dockerfile 의 COPY 경로를 전부 고쳐야 한다 |
| **배포 워크플로 `paths`** | 4개 워크플로의 **교집합 0건** | `packages/contracts/**` 는 **두 워크플로 모두에** 들어가야 한다. contracts 가 바뀌면 실제로 두 산출물이 다 바뀌기 때문이다 → **의도된 예외**로 주석에 명시한다 |

🚫 **이건 「로컬 빌드 성공 ≠ 컨테이너 빌드 성공」 함정의 교과서적 사례다**(루트 `CLAUDE.md` #2).
로컬은 레포 전체가 보이지만 컨테이너는 `COPY` 목록만 본다. 모노레포 전환 때 실제로 걸렸던 그 함정이다.
**CI 의 ARM64 빌드 검증 job 이 유일한 방어선**이므로, 컨텍스트를 바꾸는 커밋은 반드시 그 job 을 통과시킨 뒤 머지한다.

⚠️ 프론트의 `outputFileTracingRoot: __dirname` 은 **앱 디렉터리가 빌드 루트라는 전제**로 들어간 값이다.
컨텍스트를 루트로 올리면 이 값과 Dockerfile COPY 가 어긋날 수 있다 — 같은 커밋에서 확인한다.

#### D8 확정 — 백엔드 검증을 전면 교체한다 (2026-09-04)

전역 `ValidationPipe` 를 **공유 스키마 기반으로 바꾸고 class-validator 를 걷어낸다.**
근거: 지금 라우트가 **3개뿐**이라 전환 비용이 앞으로 가장 싸고, 병행안의 이중 체계는 code-patterns §4 가 명시적으로 피하려던 상태다.

**전환 범위 — 생각보다 넓다. 착수 전에 전부 확인한다.**

| 대상 | 현재 | 조치 |
|---|---|---|
| `createGlobalValidationPipe()` | class-validator 기반. **프로덕션·E2E 가 공유**한다 | 스키마 기반으로 교체. **한 파일만 고친다는 원칙은 유지** — 양쪽이 계속 같은 팩토리를 쓴다 |
| `story-params.dto.ts` | `@Matches` · `@IsInt` · `@Min` | 공유 스키마로 이전 |
| **`config/env.validation.ts`** | ⚠️ **이것도 class-validator 다** | 같이 전환한다. 안 하면 의존성을 못 걷어낸다 |
| `*-response.dto.ts` 의 `@ApiProperty` | `@nestjs/swagger` (별개 패키지) | **유지한다.** 응답 DTO 는 검증이 아니라 Swagger 명세 전용이라 영향이 없다 |
| **Swagger 요청 스키마** | DTO 클래스에서 자동 생성 | ⚠️ **여기가 진짜 비용이다.** 스키마 → OpenAPI 변환 경로를 새로 잡아야 한다. **B3(제네릭 응답 데코레이터)과 함께 설계**한다 |
| `enableImplicitConversion: true` | 문자열 경로 파라미터를 number 로 암묵 변환 | 스키마에 **명시적 강제 변환(coerce)** 으로 옮긴다. 🚫 암묵 변환을 흉내 내려 하지 않는다 — 어디서 변환됐는지 보이는 편이 낫다 |
| code-patterns §4 | class-validator 전제로 서술됨 | **같은 커밋에서 다시 쓴다** |

🚫 **검증 실패 응답 형식(`VALIDATION_FAILED` · 400 · `details` 에 `필드: 메시지` 배열)을 바꾸지 않는다.**
프론트와의 계약이고, 바뀌면 이미 붙은 화면이 조용히 깨진다. **교체 전후로 같은 형식이 나오는지 E2E 로 고정**한다.

⚠️ 순서가 중요하다 — **검증 체계 교체가 `packages/contracts` 의 스키마 형태를 정한다.** 0-C 안에서 이걸 먼저 정하고 패키지를 만든다.

## 개발용 픽스처 — 책 데이터 없이 전 플로우 돌리기

D5(저작권)가 열려 있어도 **프론트·백이 병렬로 끝까지 갈 수 있어야 한다.**

- **자체 창작 더미 동화 1편**(6장)을 픽스처로 만든다. 실제 동화가 아니므로 저작권 무관
- 삽화는 단색 배경 + 페이지 번호 플레이스홀더면 충분하다. 플로우 검증이 목적이지 보기 좋을 필요가 없다
- 투입 경로는 **마이그레이션이 아니라 별도 시드 스크립트**다. 마이그레이션은 스키마만 다룬다 — 픽스처가 마이그레이션에 섞이면 상용에도 들어간다
- 시드는 `slug` 를 `dev-` 접두사로 두고 **`status` 를 `draft` 로** 넣는다. 공개 목록에 새어나가지 않는다. 개발에서만 `published` 로 바꿔 쓴다
- 🚫 시드 스크립트를 자동 실행에 걸지 않는다. 마이그레이션과 같은 이유 — 전 환경이 같은 DB 다

**AI 미확정 구간도 같은 방식으로 뚫는다.** `ImageGenerationPort` 의 **스텁 어댑터**(입력을 무시하고 플레이스홀더 이미지를 반환)를
env 플래그로 붙이면, 모델이 정해지기 전에도 「촬영 → 대기 → 리더」 전 플로우가 실제로 돈다. 프론트는 이걸로 붙인다.

---

## 브랜치 · 커밋 전략

**구현은 이 계획 브랜치가 아니라 별도 브랜치에서 한다** (09-04 지시).

| 무엇 | 어디에 |
|---|---|
| 이 문서 · `.claude/rules/*` 갱신 | 구현 브랜치에 함께 올리되 **커밋을 분리**한다 (`docs` · `repo` · `back` · `front`) |
| 슬라이스 구현 | **슬라이스마다 `feat/*` 브랜치 1개** |
| 저장소 구조 변경 (0-C) | 별도 브랜치. 앱 코드와 섞지 않는다 — 되돌릴 일이 생기면 통째로 되돌려야 한다 |

- 한 커밋 = 한 의도. **scope 가 둘에 걸치면 커밋을 나눈다** (`back` · `front` · `infra` · `ci` · `repo` · `docs`)
- 🚫 리팩터링(B1~B3)과 신규 기능을 같은 커밋에 넣지 않는다. `refactor(back): ...` 로 분리한다
- 🚫 사용자 지시 없이 `git commit` · `push` 하지 않는다

**`develop` 을 만들지 않는다** (2026-09-04 결정). `feat/*` 가 곧바로 `main` 으로 간다.
회의에서 `main` ← `develop` ← `feat/*` 를 언급했지만 `develop` 은 로컬·원격 어디에도 없었고, 단계를 하나 줄이는 쪽을 택했다.

⚠️ **`main` 머지가 곧 자동 배포다.** 중간 완충 브랜치가 없으므로 **PR 에서 거르지 못한 것은 그대로 배포된다.**
그래서 PR 직전 `pnpm ci:all` 과 **CI 의 ARM64 컨테이너 빌드 job** 이 유일한 방어선이다. 이 전제가 부담이 되면 그때 `develop` 을 다시 논의한다.

---

## Implementation Steps

각 슬라이스는 **백엔드 + 프론트 + 연동 확인**까지를 하나로 본다. 09-04 지시대로 슬라이스가 API 에서 끊기지 않는다.

### Slice 0 — 기반 · 선행 조건 없음 · **가장 먼저**

기능이 아니라 **경계와 기반**이다. 이게 있어야 백/프가 병렬로 간다. 두 갈래가 서로 독립이라 동시에 진행할 수 있다.

### ✅ Slice 0-C-1 — 공유 패키지 + 검증 전면 교체 (완료 2026-09-04)

- [x] `packages/contracts` 생성 (zod 4) + `pnpm-workspace.yaml` 에 `packages/*` 추가
- [x] `sharedWorkspaceLockfile: false` 재검토 — 원래 근거 절반이 소멸했음을 workspace 파일 주석에 기록하고 **유지**
- [x] 루트 `back`·`front` 스크립트를 **`--filter <앱>...`** 로 — contracts 가 앱보다 먼저 빌드된다
- [x] **검증 전면 교체 (D8)** — 전역 파이프 · `env.validation.ts` · `story-params.dto.ts` 를 zod 로. **class-validator·class-transformer 제거**
- [x] 검증 실패 형식(`VALIDATION_FAILED` · 400 · `details` 배열) **유지** — spec 이 고정
- [x] Swagger — `createZodDto` + `cleanupOpenApiDoc`. `test/swagger.e2e-spec.ts` 가 **파라미터가 실제로 생성되는지** 고정
- [x] 응답 DTO 가 contracts 타입을 **`implements`** — 계약이 어긋나면 컴파일이 깨진다
- [x] code-patterns §4 재작성 + `CLAUDE.md` 저장소 지도·Commands 갱신
- [x] 검증: `pnpm ci:core` 통과(3 패키지) · `pnpm back ci:all` 통과(단위 80 · E2E 31) · **경고 0건**

⚠️ **작업 중 발견 — zod 인스턴스가 둘이다.** `sharedWorkspaceLockfile: false` 라 앱과 contracts 가
각자 zod 를 설치한다(실측: 서로 다른 `.pnpm/zod@4.5.4`). 🚫 `instanceof ZodError` 로 판별하면
**검증은 도는데 `details` 만 조용히 비는** 형태로 깨진다. 구조 판별로 우회했고 spec 이 고정한다.

### ✅ Slice 0-C-2 — 빌드 컨텍스트 · 배포 워크플로 (완료 2026-09-04)

앱 코드가 아니라 **배포 구조**다. 0-C-1 과 커밋을 섞지 않는다 — 되돌릴 일이 생기면 통째로 되돌려야 한다.

- [x] **`apps/back` 의 빌드 컨텍스트를 레포 루트로** 올리고 COPY 경로 전면 수정 (2단계 모두 워크스페이스 설치)
- [x] 루트 `.dockerignore` 신설 · `apps/back/.dockerignore` 제거(컨텍스트가 바뀌어 죽은 파일이 된다)
- [x] `deploy-back.yml` · `ci-back.yml` 의 `context: .` — **두 값이 같아야** CI 통과가 배포를 보증한다
- [x] `deploy-back.yml` `paths` 에 `packages/contracts/**` + 루트 워크스페이스 파일 추가
- [x] `ci-back.yml` `paths` 도 넓게 (검증이 안 도는 것이 더 위험하다)
- [x] `docs/deploy.md` 트리거 표 + 「빌드 컨텍스트가 앱마다 다르다」 절 추가
- [x] 검증: **로컬 arm64 컨테이너 빌드 성공**(50초) + 이미지 안에서 런타임 해석 확인

**`apps/front` 은 바꾸지 않았다.** 아직 contracts 에 의존하지 않아 컨텍스트가 `apps/front` 로 남는다.
그 덕에 **배포 워크플로 교집합이 여전히 0건**이다(스크립트로 확인). 프론트가 contracts 를 가져가는
시점에 그쪽도 옮기고, 그때 두 워크플로가 경로를 공유하는 **의도된 예외**가 된다.
→ 그래서 `outputFileTracingRoot` 확인은 지금 할 일이 아니다. 프론트 이동 시점으로 미룬다.

**이미지 배치가 바뀌었다** — WORKDIR 이 `/app` → **`/app/apps/back`**.
stack YAML 의 헬스체크가 상대경로(`node scripts/healthcheck.mjs`)라 그대로 동작하는 것을 이미지 안에서 확인했다.
⚠️ WORKDIR 을 다시 바꾸면 `infra/prod_nerd_back.yml` 도 같이 고쳐야 한다.

**검증 근거** (`ci:all` 이 못 잡는 종류라 컨테이너로 직접 확인했다)

| 확인한 것 | 결과 |
|---|---|
| arm64 컨테이너 빌드 | 성공 · 50초 · 이미지 361MB |
| contracts → back 빌드 순서 | `pnpm --filter nerd-back...` 이 contracts 를 먼저 빌드 |
| `@nerd/contracts` 런타임 해석 | `/app/packages/contracts/dist/index.js` — `workspace:*` 가 프로덕션 스테이지에서도 해석됨 |
| `tsconfig-paths` alias + contracts 재수출 | `SUCCESS_CODE` · `API_PREFIX` 정상 |
| WORKDIR 상대 헬스체크 경로 | `scripts/healthcheck.mjs` 존재 |
| 워크플로 `paths` 교집합 | **0건** (스크립트 대조) |

**미검증** — 실제 배포는 하지 않았다. 레지스트리 push·Swarm 롤링·스모크 테스트는 `main` 머지 시 CI 가 수행한다.

### ✅ 0-A. 백엔드 공통 규약 (완료 2026-09-04)

- [x] **B1** `common/__spec__/mock-repository.ts` — `createMockRepository` + `asRepository`. 로컬 스텁 정의 **0건**
- [x] **B2** `entities/__spec__/entity.factory.ts` — 4원칙. 엔티티 인라인 캐스팅 **0건**
- [x] **B3** `@ApiSuccessResponse(DataDto, { isArray })` — 응답 DTO 상속 보일러플레이트 **0건**(3개 제거)
- [x] **B4** `defineDomainError` 의 `code` 를 **contracts 의 `DomainErrorCode` 유니온**으로 좁혔다
- [x] 검증: `pnpm back ci:all` — 단위 **90**(+5) · E2E **32**(+1) · 경고 0

#### B4 가 실제로 강제한다

타입을 좁히자마자 **테스트 픽스처의 가짜 코드(`SAMPLE_NOT_FOUND`)가 컴파일 에러로 걸렸다.** 계약에
테스트 값을 넣을 수는 없으므로, 필터 spec 은 `ApiErrorResponseDto` 를 직접 상속한 픽스처로 바꿨다 —
필터가 분기하는 기준이 원래 그것이라 오히려 더 정확한 테스트가 됐다. 팩토리 자체는 새 spec 이 맡는다.

이제 **새 도메인 에러를 만들려면 contracts 에 먼저 넣어야 한다.** 안 그러면 프론트가 그 분기의 존재를
모르는 채로 배포되는데, 그걸 문서가 아니라 컴파일러가 막는다.

#### ⚠️ Port 2종은 **미룬다** — 첫 소비자와 함께 만든다

계획에는 `ImageGenerationPort`·`StoragePort` 인터페이스와 스텁 어댑터가 있었지만 빼기로 했다.

**근거는 실측이다.** 유일한 Port 인 `llm.port.ts` 는 뼈대 때 "구현체는 나중에, 지금은 경계만" 으로
만들어졌고 **2026-09-04 현재 참조 0건**이다. 소비자 없이 만든 인터페이스는 검증되지 않고, 실제
어댑터를 붙일 때 형태가 안 맞아 결국 다시 쓴다. 0-B 에서 세운 「첫 사용처 없이 만들지 않는다」가
백엔드에도 그대로 적용된다.

→ **Slice 3(StoragePort)·Slice 4(ImageGenerationPort)에서 어댑터와 함께 만든다.**
스텁 어댑터도 마찬가지다 — 프론트에 개인화 화면이 아직 없어 지금 만들면 아무도 쓰지 않는다.

### ✅ 0-B. 프론트 기반 (완료 2026-09-04)

- [x] 스캐폴드 잔재 정리 — `lang="ko"` · 서비스명 · `body` font-family 잔재 · **다크모드 블록 제거**(빌드 CSS 에서 `prefers-color-scheme` 0건 확인)
- [x] `globals.css` 의 `@theme` 에 **디자인 토큰** — 색·반경·`--spacing-touch`(56px). **빌드 산출 CSS 에서 유틸리티가 실제로 생성되는지 대조 확인**
- [x] 폴더 뼈대 — `components/ui` · `components/story` · `lib/api`
- [x] `lib/api` — `ApiError` + `apiFetch`. **baseURL 은 호출 시점에 결정**한다(모듈 로드 시점 고정 금지)
- [x] `components/ui` — `actionStyles`(스타일 소스) · `ActionLink` · `Card` (variant 는 `Record<Variant,string>` 맵, 의존성 0개)
- [x] `components/story/StoryCard` — 앨범·서재·비하인드 **세 화면의 중복을 하나로 흡수**
- [x] 라우트 그룹 `(demo)` + 서재 페이지(`force-dynamic` — 빌드 시점에 백엔드를 부르지 않는다)
- [x] **vitest 도입 (D6)** — `ci:core`·`ci:all` 에 `test` 단계. `lib/api` 11건
- [x] `check-stubs` 의 `TARGET_DIRS` 에 `components`·`lib` 추가 — 빠지면 그 디렉터리의 `.only`·`TODO` 가 통째로 검사에서 빠진다
- [x] **프론트 빌드 컨텍스트를 레포 루트로** + 워크플로 `context`·`paths` + `docs/deploy.md`
- [x] 검증: `pnpm ci:all` 통과 · **컨테이너를 실제로 띄워** 확인

#### 2차 리뷰 지적 반영 (2026-09-04)

리뷰가 **이 슬라이스의 목적과 정면으로 어긋나는 중복**을 잡았다. 셋 다 고쳤다.

| 지적 | 실체 | 수정 |
|---|---|---|
| 홈 링크가 CTA 클래스를 **인라인 복제** | 두 문자열의 **공통 클래스 10개** — `ActionButton` 이 `<button>` 이라 링크에 못 써서 옮겨 적었다 | 스타일을 `actionStyles.ts` 의 `actionClass()` **함수 하나**로 뽑고 `ActionLink` 가 그것을 쓴다. **래퍼가 아니라 문자열을 공유**한다 |
| `ActionButton`·`IconButton` **미사용** | import 0건 + 빌드 JS 청크 **0개 파일**(대조군 `StoryCard` 3개) | 삭제. 버튼형 CTA 는 첫 사용처가 생길 때 **같은 `actionClass` 로** 만든다 |
| `*.test.ts` 가 빌드 컨텍스트에 포함 | `**/test` 는 **디렉터리명만** 매칭한다 | `.dockerignore` 에 `**/*.test.ts(x)` 추가. 컨텍스트 프로브로 **0건** 확인(대조군 `client.ts` 존재) |

**검증** — 수정 후 `pnpm ci:all` 통과(back 단위 85·E2E 31, front 11, 경고 0), pristine 트리에서 두 컨테이너 빌드 성공, 프론트 기동(헬스체크 exit 0 · `/` 200 · CTA 렌더 확인).
모든 컴포넌트가 빌드 JS 에 존재(11/3/3), 삭제된 것은 0개, BASE 클래스 문자열은 **소스 1개 파일**에만 있다.

**하지 않은 것** — `(trial)` 라우트 그룹은 인증이 생기는 Slice 2 에서 만든다. `hooks/`·`types/` 는
넣을 것이 생길 때 만든다(빈 디렉터리는 git 이 추적하지도 않고 COPY 목록만 헷갈리게 한다).
컴포넌트 테스트(jsdom + Testing Library)도 필요해질 때 도입한다.

**폰트** — `next/font/google` 을 쓰지 않고 **시스템 스택**으로 갔다. `next build` 가 네트워크를 타지
않게 하려는 것이고(오프라인·프록시 빌드 실패 제거), 한글 서브셋 확보가 Google Fonts 경로에서
불확실하다. 유아틱 라운드 폰트는 UI 담당이 정하면 `globals.css` 한 곳에서 교체한다. **색 값도 초안이다.**

**`API_PREFIX` 를 contracts 로 올렸다** — 프론트가 URL 을 만들 때 같은 값을 쓰므로 계약 값이다.
백엔드는 재수출한다(`SUCCESS_CODE` 와 같은 선례).

#### ⚠️ 이번에 드러난 것 — `outputFileTracingRoot` 는 **모듈 해석 경계**다

프론트가 `@nerd/contracts` 를 가져가면서 `next.config.ts` 의 `outputFileTracingRoot` 를 **레포 루트로
바꿔야 했다.** 이름은 "트레이싱"이지만 **Turbopack 의 모듈 해석 경계이기도 해서**, 앱으로 좁히면
`Module not found: Can't resolve '@nerd/contracts'` 로 **빌드가 실패한다**(실측).

⚠️ 처음에는 "NFT 가 앱 밖 파일을 담지 못한다" 는 이유로 바꿨는데 **그 가정은 틀렸다** —
Next 는 서버 코드를 번들링하므로 contracts 는 산출물에 인라인된다(컨테이너 실측: `require.resolve`
는 실패하는데 페이지는 정상). 되돌렸다가 빌드가 깨져서 진짜 이유를 알았다. 코드 주석에 실측 근거로 적었다.

**검증 근거**

| 확인한 것 | 결과 |
|---|---|
| `pnpm ci:all` | contracts · back(단위 85 · E2E 31) · front(11) 전부 통과 · 경고 0 |
| 디자인 토큰 | 빌드 CSS 에서 `min-h-touch` `size-touch` `rounded-card` `rounded-pill` 등 **생성 확인** |
| 다크모드 제거 | 빌드 CSS 에 `prefers-color-scheme` **0건** |
| 프론트 컨테이너 | 빌드 → **기동** → 헬스체크 exit 0 · `/` 200(한글 렌더) · CSS 200 · `/api/health` 200 |
| contracts 런타임 | `/library` 가 `Cannot find module` 이 아니라 **`fetch failed`** 로 실패 (모듈은 해석됨) |
| `.env` 규칙 | 빌드 컨텍스트에 `apps/front/.env.production` **만** 들어가고 `.env.local` 은 차단 (양성·음성 대조) |
| 백엔드 컨테이너 | `.dockerignore` 변경 후 재빌드·런타임 해석 재확인 |
| 워크플로 paths | 공유 5건은 **의도된 예외**, 앱·인프라 경로 겹침 **0건** | (이제 `test` 포함)

> ⚠️ **B1~B3 은 이미 머지된 Slice 1 코드를 건드린다.** 리팩터링과 신규 기능을 같은 커밋에 섞지 않는다 —
> 별도 커밋(`refactor(back): ...`)으로 분리하고, **테스트가 같은 것을 검증하는지**를 먼저 확인한다.

### ✅ Slice 1 — 콘텐츠 조회 API + 시연 리더 (완료 2026-09-04)

- [x] 엔티티 4종 + 마이그레이션 (멱등 · `down()`)
- [x] API 1·2·3 + Swagger + 도메인 에러 2종
- [x] 단위 7건 · E2E 9건
- [x] **픽스처 시드 스크립트** — `pnpm db:seed:dev [--publish]` ← ↓ 「픽스처를 러너와 분리했다」
- [x] **프론트**: 서재 목록 → 상세 → 시연 리더(`BookFrame`) + **전역 네비(`AppHeader`)**. `AudioPlayer` 는 D9 대기
- [ ] **스키마 결손 보강 마이그레이션** — `audio_key` · 분기 카드 메타 · 앨범 썸네일 ← ↑ 「시안이 드러낸 스키마 결손」
- [x] 마이그레이션 실행 + 시드 투입 (사람이, 2026-09-04 · 09-07) — ↓ 「Verification Story」에 시각과 근거

#### 픽스처를 러너와 분리했다

`src/scripts/dev-fixture.ts`(데이터) + `seed-dev-fixture.ts`(러너) 두 파일이다. **DB 없이 정합성을
검사하기 위해서다** — `personaTargetRole` 은 FK 가 없어(대상이 `(template_id, role)` 복합키라 단일
컬럼으로 못 가리킨다) 오타가 나도 DB 가 막지 못하고, 증상은 "그 페이지만 개인화가 조용히 빠짐"이다.
`dev-fixture.spec.ts` 9건이 그 자리를 대신한다.

**변이 테스트로 공허하지 않음을 확인했다** — 배역 오타 · 페이지 번호 건너뜀 · hitbox 를 픽셀값으로 ·
`dev-` 접두사 제거, 네 가지를 넣어 각각 실패하는 것을 봤다.

시드는 **앱 계정**으로 돈다. 행 쓰기라 DDL 이 필요 없고, 그래야 DDL 권한이 이 경로로 새지 않는다.
멱등(같은 slug 를 지우고 다시 씀)하고, `dev-` 접두사가 아니면 스크립트가 먼저 던진다 —
실 콘텐츠를 덮어쓸 수 있는 유일한 경로를 막는 장치다.

#### 프론트 — 리더는 상세를 함께 부른다

`/library` → `/library/[slug]` → `/library/[slug]/[pageNo]` 3단이다.

- 경로 파라미터를 **백엔드와 같은 zod 스키마**(`storyPageParamsSchema`)로 검증한다. 형식이 아니면
  백엔드를 부르지 않고 `notFound()` 다. 🚫 `Number()` 로 따로 변환하지 않는다 — 판정이 갈린다
- 리더가 상세를 **함께** 부르는 이유: 마지막 페이지인지 알아야 다음 버튼을 「다음 페이지」로 둘지
  「다 읽었어요」로 바꿀지 정해진다. 다음 페이지를 미리 호출해 404 로 판정하면 매 페이지마다
  헛된 요청이 하나씩 는다
- 404 → `notFound()` 변환은 `orNotFound()` **한 곳**이다. 화면마다 `try/catch` 를 쓰면 한 곳을
  빠뜨렸을 때 **404 가 500 으로 보인다**
- `IconButton` 은 만들지 않았다 — 「집」 버튼이 실은 네비게이션이라 `ActionLink` 로 충분하다.
  아이콘 체계가 아직 없는데 컴포넌트를 먼저 만들면 0-B 에서 걸린 함정을 반복한다
- 비활성 「이전」은 **숨기지 않고** 같은 `actionClass` 로 흐리게 둔다. 버튼이 사라졌다 나타나면
  위치가 흔들려 오터치가 는다
- **전역 네비는 실재하는 라우트만 담는다** (`/` · `/library` · `/login`).
  🚫 **`설정`·`내 프로필` 화면은 만들지 않는다** (2026-09-07 결정). 시안에는 있지만 이 서비스가
  담을 개인 정보가 아이디 하나뿐이라 화면을 둘 이유가 없다. 로그아웃이 필요해지면 네비에 넣는다
- ⚠️ 리더의 뒤로 가기 버튼은 **서재가 아니라 이 동화의 상세**로 간다. 라벨이 「서재로」였는데
  전역 네비의 「서재」와 목적지가 달라 「동화 소개」로 고쳤다 (2026-09-07 리뷰)

**미공개 동화를 404 로 답한다.** 403 등으로 구분하면 slug 를 바꿔가며 제작 중인 콘텐츠의 존재를 확인할 수 있다.

### ✅ Slice 2 — 로그인 (완료 2026-09-04)

**새 의존성 0개로 끝냈다** — `node:crypto` scrypt + 이미 있는 Redis·cookie-parser.

- [x] `users` 엔티티 + 마이그레이션 — `login_id`(UNIQUE) · `password_hash`(**`select: false`**) · `created_at`
- [x] 비밀번호: **scrypt**. 저장 형식에 파라미터를 담아 나중에 값을 올려도 옛 해시를 검증한다
- [x] 세션: **서명 쿠키**(httpOnly). ↓ 「세션을 Redis 에서 서명 쿠키로 옮겼다」
- [x] `POST /auth/signup`(201) · `POST /auth/login`(200) · `POST /auth/logout`(204) · `GET /auth/me`
- [x] `AuthGuard` + `@CurrentUser()` — 🚫 전역 등록하지 않는다
- [x] 로그인 실패 사유를 구분하지 않고, **없는 아이디에도 해시 검증을 실제로 수행**한다(타이밍 오라클 방지)
- [x] 로그인 전용 좁은 레이트리밋(`THROTTLE_LOGIN`, 분당 5)
- [x] 🚫 소모성 횟수 카운터를 만들지 않았다 — 제한은 Slice 3 의 `UNIQUE(user_id, template_id)`
- [x] **프론트**: `/login` 화면. 폼 검증이 **백엔드와 같은 zod 스키마**를 쓴다
- [x] 검증: `pnpm ci:all` — back 단위 **119** · E2E **44** · front **17** · 경고 0

#### 이번에 도구가 잡은 것 2건

**1. `@CurrentUser()` 가 전역 파이프에 막혔다.** `strictSchemaDeclaration` 이 ZodDto 가 아닌
파라미터를 500 으로 막는데, 커스텀 데코레이터의 값은 **서버가 넣는 것**이라 검증할 스키마가 없다.
예외를 두지 않았으면 **인증된 라우트가 전부 첫 요청에서 500** 이었다. 빌드·타입체크로는 안 잡힌다.

**2. `POST /auth/login` 이 201 을 반환하고 있었다.** `@Post` 의 Nest 기본값이다. Swagger 는 200 으로
문서화하고 있어 **문서와 실제가 갈린 상태**였고, E2E 가 잡았다. `@HttpCode(200)` 로 고쳤다.

#### 세션을 Redis 에서 서명 쿠키로 옮겼다 (2026-09-07)

**질문이 계기였다** — "인증에 캐시 서버를 쓰면 의존성이 너무 높지 않나".
재검토해 보니 **Redis 가 사주는 유일한 것(서버측 강제 만료)을 쓰는 기능이 하나도 없었다.**
로그아웃은 쿠키 삭제로 사용자 경험이 같고, 비밀번호 변경도 관리자 차단도 계획에 없다.

| | Redis 세션 | **서명 쿠키** ✅ |
|---|---|---|
| 저장소 | `sess:<sid>` → userId | 없음 (쿠키가 값을 들고 있다) |
| 새 의존성 | 0 (Redis 가 이미 있었다) | 0 (`cookie-parser` 가 이미 있었다) |
| 강제 만료 | 가능 — **쓰는 곳 0곳** | 불가 |
| 로컬 개발 | Redis 필요 | 불필요 |

⚠️ **가용성이 이유가 아니다.** Redis 와 MySQL 은 같은 노드에 있어 같이 죽는다
(`tasks-db-mysql.md`: "노드 1대 = 앱·Redis·DB 동시 상실, 완화 불가"). 옮긴다고 가용성이 오르지 않는다.
이유는 **쓰지 않는 능력 때문에 인증이 외부 시스템에 묶여 있던 것**이다.

**부수 효과 — 어제 고친 버그가 사라졌다.** 계정(MySQL) 저장 후 세션(Redis) 생성이 실패하면
계정만 남아 재시도 시 409 이던 문제가, 쿠키 발급이 실패할 수 없어 성립하지 않는다.
보상 삭제 로직과 그 테스트 2건을 지웠다.

**잃은 것 — 서버측 강제 만료.** 훔친 쿠키는 만료(7일)까지 유효하다(훔친 sid 도 같았으므로
탈취 위험 자체는 그대로다). E2E 가 이 사실을 **테스트로 고정**했다 —
`⚠️ 로그아웃해도 이미 발급된 쿠키 자체는 만료까지 유효하다`. 🚫 버그로 보고 고치지 않는다.

🚫 **재검토 조건: 강제 로그아웃 · 기기 관리 · 비밀번호 변경.** 이 중 하나가 필요해지면
서버측 세션으로 되돌린다. git 이력의 이전 버전이 그대로 근거다.

**새 환경변수 `SESSION_SECRET`** (32자 이상). ⭐ 레플리카 3개가 같은 값이어야 한다 —
다르면 "새로고침할 때마다 로그아웃" 으로 드러난다. 바꾸면 전원 로그아웃되며,
그것이 유일한 「전체 강제 로그아웃」 수단이다.

#### 미룬 것 — 첫 사용처와 함께

- **`GET /auth/me` 의 "내가 만든 책 목록"** — `story_sessions` 가 생기는 Slice 3 에서. 지금은 로그인 상태만 준다
- **`(trial)` 레이아웃 인증 가드** — 아직 보호할 페이지가 없다. 첫 보호 페이지와 함께 만든다
- **서버 컴포넌트에서의 쿠키 전달** — 서버가 인증 API 를 부를 일이 생길 때. 지금 로그인 화면은 클라이언트에서 부른다

### Slice 3 — 세션 + 얼굴 → 레퍼런스 · **D1 필요**

- [ ] `story_sessions` 엔티티 + 마이그레이션 — **`UNIQUE(user_id, template_id)`**
- [ ] API 8 — 이미 만든 동화면 **409**. 🚫 앱 레벨 조회로만 막지 않는다. **동시 요청 2건이 둘 다 통과**하므로 DB 제약이 최종 방어선이고, 위반을 409 로 변환한다
- [ ] 🚫 **실패한 생성이 제한에 걸리지 않게 한다.** 책이 없으면 다시 시도할 수 있어야 한다 — 실패 세션을 UNIQUE 에서 어떻게 뺄지가 설계 지점이다
- [ ] API 9 — `multipart/form-data` 3장, 크기 상한, **매직바이트** 검증, 처리 후 즉시 폐기
- [ ] `StoragePort` + **S3 어댑터** — 업로드 · 서명 URL 발급. 🚫 키는 UUID(순번 금지). ↑ 「이미지 보관 (D1)」
- [ ] **인프라**: `prod_nerd_storage` 스택 배포 — 배포 게이트 목록은 「이미지 보관 (D1)」이 소유
- [ ] **프론트**: 카메라 촬영 UI(가이드 영역, 정면/좌/우), 업로드 전 리사이즈
- [ ] ⚠️ `getUserMedia` 는 **secure context** 에서만 동작한다. `localhost` 와 HTTPS 는 되고 평문 HTTP LAN 접속은 안 된다
- [ ] 검증: 형식 위조 파일 거부 · 상한 초과 거부 · 한도 소진 후 8번이 막히는지

### Slice 4 — 개인화 파이프라인 · **D1 · D3 필요**

- [ ] `session_page_images` 상태머신 (`pending → running → succeeded | failed`)
- [ ] 🚫 인메모리 큐·타이머 금지 — 레플리카 3개. Redis 잡 큐 또는 DB 상태 + **리더 락 스위퍼**
- [ ] API 10·11·12. 10번은 **멱등** (이미 진행 중이면 현재 상태 반환)
- [ ] fail-closed 예산 카운터 (세션당 · 프로젝트 일일)
- [ ] **프론트**: 대기 화면(페이지별 진행률), 폴링 백오프, 부분 실패 표시 + 재시도 버튼
- [ ] 검증: 어댑터 실패·타임아웃·부분 실패를 각각 spec 으로 고정

### Slice 5 — 등장인물 대화 · **선행 슬라이스 해소됨 (2026-09-04)**

구현을 막는 슬라이스는 없다. 다만 **착수 전에 운영이 준비할 것**이 있다 — OpenRouter API 키와
월 예산 상한이다. 키 없이 어댑터를 만들면 검증할 수 없고, 예산 없이 붙이면 fail-closed 카운터의
임계값을 정할 수 없다(↑ 「비용 제약」 2번).

- [ ] `LlmPort` OpenRouter 어댑터
- [ ] 프롬프트 조립: `persona` + **현재 페이지 장면만**. 🚫 전체 대화 기록 금지
- [ ] 응답 길이 상한 · 사용자별 일일 대화 한도(fail-closed)
- [ ] **본편 보호** — 스포일러 유도·프롬프트 인젝션 방어. 수용 기준이 필요하다
- [ ] 대화 이력 보존 여부 결정 (저장하면 개인정보 범위가 늘어난다)
- [ ] **프론트**: 캐릭터 터치(hitbox), 대화 UI, placeholder 예시, 본편 복귀
- [ ] 검증: usage 기록 · 본문 미로깅 · 길이 상한

### Slice 6 — 비하인드 + A/B · **D4 필요**

- [ ] 본편/비하인드 구분을 `story_pages` 에 둘지 별도 노드로 둘지 — D4 의 답에 따라 갈린다
- [ ] `session_branch_choice` + API 14
- [ ] 재선택 허용 여부 — 허용하면 선택의 무게가 사라지고, 막으면 오조작 복구가 안 된다
- [ ] **프론트**: 분기 선택 UI, 결말 화면

---

## Tests / Verification

| 앱 | 명령 | 비고 |
|---|---|---|
| 백엔드 | `pnpm back ci:core` → PR 직전 `pnpm back ci:all` | lint · 단위 · 빌드 (+ 타입 · 스텁 · E2E) |
| 프론트 | `pnpm front ci:core` → PR 직전 `pnpm front ci:all` | lint · 타입 · 빌드. **`test` 단계가 없다** (D6) |
| 둘 다 | `pnpm ci:core` · PR 직전 `pnpm ci:all` | 루트 설정을 건드렸으면 반드시 |

- 🚫 E2E 에서 `AppModule` import 금지 — `createE2eApp()` 을 쓴다
- 🚫 테스트가 DB 에 접속하지 않는다 — `forbid-db` 매퍼가 막는다
- 에러 경로는 **status·code 를 정확히** 고정한다
- ⚠️ jest 30 은 `--testPathPatterns`(복수형)
- ⚠️ **샌드박스에서 E2E 가 `listen EPERM` 으로 실패한다.** 소켓 bind 제한이지 코드 문제가 아니다 (2026-09-04 실측: 기존 헬스체크 E2E 도 동일)
- ⚠️ `next build` 는 Google Fonts 를 받아오므로 **네트워크가 필요하다**

**검증할 수 없는 것**

| 항목 | 이유 | 대안 |
|---|---|---|
| 얼굴 일관성 (RISK-001) | 자동 검증 불가 | 회의 결정대로 팀 전원 코어 테스트. 동일 사진 반복 생성 후 육안 |
| 캐릭터 일관성 (RISK-002) | LLM 출력 품질 판정 | 골든 프롬프트 세트 + 사람 리뷰 |
| 실제 비용 | 호출 전에는 모른다 | 어댑터가 usage 를 기록하고 사후 보정 |

---

## Risk & Rollback

| 위험 | 완화 |
|---|---|
| AI 비용 폭주 | fail-closed 카운터를 **어댑터보다 앞**에 둔다. 못 세면 호출하지 않는다 |
| 건당 300원 미달 | **1인 최대 2권**(자연 상한) + 레퍼런스 재사용 + 캐시 + 재시도 상한. 모델 확정 시 재계산 |
| 얼굴 유출 | 디스크 미접촉 · 처리 후 즉시 폐기 · 로그·에러에 싣지 않는다 |
| **영구 보관의 대가** | 스토리지가 단조 증가하고 삭제 요구 대응이 필요해진다 (D10). D1 선택 시 비용 예측 가능성을 본다 |
| 모델 종속 | Port & Adapter. 모델 식별자를 인터페이스에 노출하지 않는다 |
| 저작권 (D5) | 실 콘텐츠 투입 전 확인 완료. **코드 결함이 아니라 머지 전 차단 게이트다** |
| 프론트 테스트 부재 (D6) | 결정 전까지는 E2E 없이 가는 구간이 있음을 인지한다. 백엔드 계약 테스트가 방어선 |
| 롤백 | 슬라이스마다 격리 커밋. 외부 연동(4·5)은 env 플래그 기본 비활성으로 시작 |

---

## Verification Story

**Slice 1 (2026-09-04)** — 동화 콘텐츠 조회 API 3종을 엔티티 4개·마이그레이션 1개와 함께 추가했다.
E2E 는 `StoryModule` 대신 컨트롤러·서비스만 올리고 Repository 를 토큰으로 스텁해 **DB 접속 없이** 돈다.

**Slice 2 (2026-09-04)** — 아이디·비밀번호 로그인과 Redis 세션. **새 의존성 0개** (`node:crypto` scrypt).
E2E 가 두 가지를 실제로 잡았다 — `@CurrentUser()` 가 전역 파이프에 막혀 인증 라우트가 전부 500 이던 것,
`POST /auth/login` 이 Swagger(200)와 달리 201 을 내보내던 것. 둘 다 빌드·타입체크로는 안 잡힌다.

**Slice 1 마무리 (2026-09-04)** — 개발용 픽스처(자체 창작 6장)와 시연 리더를 붙여
「서재 → 상세 → 리더」가 **실 콘텐츠 없이** 돈다. 픽스처 정합성은 DB 없이 spec 9건이 지키고,
그 spec 이 공허하지 않음을 **변이 4종**(배역 오타·페이지 번호 건너뜀·hitbox 픽셀값·접두사 제거)으로 확인했다.

**최종 실측 (2026-09-07)**

| 명령 | 결과 |
|---|---|
| `pnpm back ci:all` | 단위 **136**(17 스위트) · E2E **44**(7 스위트) · lint·타입체크·스텁검사·빌드 통과 |
| `pnpm front ci:core` | vitest **22**(3 파일) · lint · 타입체크 · **Turbopack 빌드** 통과 |
| 프론트 라우트 | `/library` · `/library/[slug]` · `/library/[slug]/[pageNo]` 전부 `ƒ (Dynamic)` — 빌드 중 백엔드를 부르지 않는다 |

**실 DB 반영 완료 (사람이 실행).**

| 무엇 | 언제 | 근거 |
|---|---|---|
| 마이그레이션 2개 적용 | 2026-09-04 22:55 KST | `information_schema.TABLES.CREATE_TIME` — 5개 테이블 + `migrations` |
| 픽스처 투입 (`--publish`) | 2026-09-07 09:45 KST | `dev-cloud-village` · 페이지 6 · 등장인물 2 |
| 전 체인 동작 | 2026-09-07 | 기동 중인 백엔드에 직접 호출 — `/stories` 200, `/stories/dev-cloud-village/pages/3` 200 |

⭐ **`persona` 가 응답에 없는 것을 실 데이터로 확인했다.** `select: false` 가 실제로 막는다 —
mock 테스트가 아니라 실 DB 조회에서 확인한 것이라 의미가 다르다.

⚠️ 전 환경이 같은 DB 다 — 위 두 명령은 곧 상용 적용이었다. `dev-` 접두사와 `draft` 기본값이
그 위험을 좁히는 장치였고, `--publish` 는 명시적으로 준 것이다.

**남은 미검증**: 실제 배포(레지스트리 push · Swarm 롤링 · 스모크)는 `main` 머지 시 CI 가 수행한다.
