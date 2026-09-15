# 현재 작업: 제작형 서재와 삽화 속 캐릭터 대화

> 상태: **구현 및 전체 검증 완료 (CI 통과)**
> Spec: [`docs/tasks/slice-8-library-character-interaction-spec.md`](../docs/tasks/slice-8-library-character-interaction-spec.md)
> Plan: [`tasks/plan.md`](plan.md)

- [x] Task 1 — 계약과 세션 API 확장
  - Acceptance: 완성 세션의 1쪽 썸네일 URL과 6A/6B 등장인물 히트박스가 공개 계약에 포함되며, 누락·서명 실패가 응답 전체를 막지 않는다.
  - Verify: contracts build, story-session service tests, backend build.
  - Files: session contract, story-session service/test.
- [x] Task 2 — 서재 카드의 개인화 썸네일
  - Acceptance: 로그인 사용자의 완성 동화만 개인화 1쪽을 표시하고 공개·미완성·오류 상태는 기존 삽화로 폴백한다.
  - Verify: 매칭 Vitest, frontend typecheck/build, 공개·로그인 서재 수동 확인.
  - Files: LibraryStoryList, matching helper/test, library page, session API test.
- [x] Task 3 — 제작 모드 URL과 상세 CTA
  - Acceptance: 홈의 `내 얼굴로 만들기` 흐름만 `mode=create`를 상세까지 보존하고 일반 체험 흐름과 갈린다.
  - Verify: URL helper Vitest, 일반/제작 브라우저 흐름.
  - Files: libraryMode/test, authLinks, library list/detail.
- [x] Task 4 — 제작 모드의 시연 CTA 제거
  - Acceptance: 제작 모드 상세의 모든 세션 상태와 로딩 자리표시에서 시연 CTA가 없고 개인화 동작은 유지된다.
  - Verify: frontend typecheck/build와 세션 상태별 수동 확인.
  - Files: StorySessionActions, detail loading.
- [x] Task 5 — 정적 삽화 hotspot 기반
  - Acceptance: `object-cover` 크롭을 반영한 히트박스가 정적 삽화 면에 한 번만 존재하고 쪽 넘김에는 복제되지 않는다.
  - Verify: 좌표 변환 Vitest, BookPager 회귀 및 두 해상도 수동 확인.
  - Files: geometry/test, BookPager, BookFrame CSS.
- [x] Task 6 — 캐릭터 선택과 기존 채팅 연결
  - Acceptance: hover·focus·touch로 본편과 6A/6B 캐릭터를 선택해 대화를 열며 하단 런처 없이 모든 채팅 상태에 재진입한다.
  - Verify: frontend tests/build, 키보드·터치·음성 배타·포커스 복귀 수동 QA.
  - Files: CharacterHotspots, reader page/useCharacterChat, ChatLauncher 제거.
- [x] Task 7 — 전체 검증
  - Acceptance: `pnpm ci:all`, `git diff --check`, 1024×768/390×844의 두 공식 동화 전체 흐름이 통과한다.
  - Verify: CI와 Verification Story.
  - Files: 작업 문서.

## 🚨 최우선 다음 작업 (Next Priority)

- [ ] **피드백 5 캐릭터 테두리 시각 효과 고도화 (최우선)**
  - **현상 및 사용자 피드백**: "캐릭터 챗 동작 자체는 하는데 캐릭터의 테두리라기보단 그냥 타원형으로 쳐져 있는데 맞아?"
  - **현재 상태**: 클릭 동작 및 타원형 광원 애니메이션(`hotspotPulse`)은 연결되었으나, 단순 타원형(oval) 형태로 인해 캐릭터 삽화 외곽선에 맞춘 자연스러운 테두리 광선 느낌이 부족함.
  - **개선 목표**:
    - 사각/타원형 영역 대신 캐릭터의 자연스러운 아우라 또는 테두리 느낌을 주는 마법 발광 효과(예: SVG drop-shadow filter, 캐릭터 형태에 맞춘 다층 글로우, radial-gradient 블렌딩 마스킹 등)로 시각 디자인 전면 개편.
    - 호버/포커스/터치 시 캐릭터가 살아 움직이는 듯한 은은한 테두리 광선 인터랙션 구현.

## 2026-09-15 사용자 피드백 반영 및 해결 내역

- [x] **피드백 1**: `/library/{동화}?mode=create` 상세 페이지 표지 삽화에 1쪽 개인화 썸네일 노출 ([`StoryDetailArtwork.tsx`](../apps/front/components/story/StoryDetailArtwork.tsx))
- [x] **피드백 2**: 썸네일 프리로드 체감 속도 극대화
  - 마운트 즉시 `getMySessions()` 병렬 요청으로 `useSession` 대기 병목 완전 제거
  - 전역 인메모리 썸네일 캐시 구축으로 서재 목록 → 상세 페이지 진입 시 **0ms 즉시 렌더링**
  - 브라우저 백그라운드 이미지 디코딩(`img.decode()`) 프리로드 및 카드 호버/터치 사전 워밍업
  - 카드 및 상세 이미지 컨테이너에 `bg-surface-raised` 플레이스홀더 및 부드러운 페이드인(`transition-opacity duration-300`) 적용
- [x] **피드백 3 & 후속 과제 (문서화)**: 이미 다 만들어진 동화(`status === 'completed'`, `isAllCompleted === true`)를 읽을 때 리더 헤더의 `← 제작 현황 보기` 버튼 숨김 가드 적용 및 스펙/할일 문서에 기록 완료
- [x] **피드백 4**: 낭독 플레이어 로딩바 및 시간초 멈춤 버그 해결
  - 원인: React 18/19 StrictMode의 마운트 시뮬레이션 시 `useEffect` 언마운트 클린업(`destroy()`)이 실행되어 `Audio` 객체의 이벤트 리스너가 제거된 채 유지됨
  - 해결: `ReaderAudioController`에 `attach()` / `detach()` 수명 주기 및 `play()` 시 자동 리스너 복원(Self-healing) 구조 도입
  - 누락되었던 `durationchange`, `canplay`, `playing`, `seeking`, `seeked` 이벤트 리스너 보강
  - `NarrationPlayer`: 오디오 준비 중일 때 `"불러오는 중..."` 버튼 상태 제공 및 프로그레스 바 부드러운 전환(`transition-[width] duration-200 ease-linear`) 적용
- [x] **피드백 5**: 캐릭터 챗 클릭 불가 수정 (`.art` 컨테이너 내 `img` 탐색) 및 평상시에도 캐릭터 테두리가 은은하게 숨쉬듯 빛나는 타원형 광원 애니메이션 추가 ([`CharacterHotspots.tsx`](../apps/front/app/(trial)/stories/[slug]/read/CharacterHotspots.tsx), [`BookFrame.module.css`](../apps/front/components/story/BookFrame.module.css))
- [x] **피드백 6**: 일반 동화 체험하기(`!isCreateMode`)에서는 `내 얼굴 읽기`를 노출하지 않고 `시연 동화 읽기`를 주 행동(primary)으로 제공 ([`StorySessionActions.tsx`](../apps/front/components/story/StorySessionActions.tsx))

---

# 이전 완료 기록: 동화 낭독·캐릭터 답변 TTS

> 상태: **구현 완료, 운영 DB 적용·수동 QA 대기**
> Spec: [`docs/tasks/slice-7-tts-spec.md`](../docs/tasks/slice-7-tts-spec.md)
> Plan: [`tasks/plan.md`](plan.md)

- [x] Task 1 — 데이터·공유 계약과 공식 동화 낭독 키
  - Acceptance: 본편 1~5와 6A/6B 키, 캐릭터 음성 설정, 답변 음성 상태가 타입과 스키마에서 일치한다.
  - Verify: migration SQL/metadata, contracts, official story fixture tests. 실제 DB 명령은 실행하지 않는다.
  - Files: contracts 3개 이하, 엔티티 3개, migration 1개, official story data/test
- [x] Task 2 — 본편·비하인드 낭독 URL API
  - Acceptance: 시연·체험이 키가 아닌 서명 URL을 받고, 키 누락·서명 실패에도 본문을 받는다.
  - Verify: story service와 story-session service 단위 테스트, backend build.
  - Files: story contract/DTO/service, story-session service와 tests
- [x] Task 3 — OpenRouter Gemini TTS Port·Adapter
  - Acceptance: voice/model/settings가 올바르게 전달되고 API key 누락·타임아웃·비정상 응답이 음성 실패로 격리된다.
  - Verify: adapter와 env validation tests. 실제 과금 호출은 하지 않는다.
  - Files: TTS port/adapter/tests, `OPENROUTER_TTS_MODEL` env validation/example, module wiring
- [x] Task 4 — 캐릭터 답변 음성 생성·재시도 API
  - Acceptance: 답변 텍스트를 먼저 보존하고 동일 채팅 TTS를 한 번만 생성하며 실패 시 음성만 재시도한다.
  - Verify: 동시 선점, 저장 재사용, 실패·중단·재시도 service/controller tests.
  - Files: chat contract/DTO/controller/service/tests
- [x] Task 5 — 공통 낭독 UI
  - Acceptance: Q1~Q12, Q15~Q17, Q24~Q27이 시연·체험에서 같은 방식으로 동작한다.
  - Verify: Vitest와 1024×768/390×844 수동 리더 흐름.
  - Files: audio controller, `NarrationPlayer.tsx`, BookPager/BookReader, trial reader integration/tests
- [x] Task 6 — 캐릭터 답변 음성 UI
  - Acceptance: 새 답변만 자동재생하고 저장 답변은 수동재생하며 채팅 조작 시 내레이션이 정지한다.
  - Verify: 준비·완료·실패·재방문·배타 재생 Vitest 및 수동 QA.
  - Files: story-chat API, useCharacterChat, CharacterChat, audio integration/tests
- [ ] Task 7 — 전체 검증과 운영 게이트
  - Acceptance: `pnpm ci:all` 통과, 캐릭터 Gemini voice 설정과 `OPENROUTER_API_KEY`·`OPENROUTER_TTS_MODEL`이 배포 전 게이트로 정리된다.
  - Verify: CI, diff/check, 시연·체험 A/B와 채팅 수동 QA.
  - Files: 계획 Verification Story와 필요한 운영 문서

---

# 이전 완료 기록: main 기준 등장인물 채팅 통합 Implementation Plan

> **For implementers:** main 구현을 유지하고 채팅만 이식하며 아래 검증을 완료한다.

**Goal:** 최신 main의 얼굴 등록·개인화·분기형 리더에 기존 페이지 대화를 추가하고 충돌 없는 PR을 만든다.
**Architecture:** origin/main에서 만든 feat/story-character-chat-main 작업 트리에 채팅 계약·영속 예약·LLM adapter·리더 UI만 이식한다. 기존 StorySession 및 인증 흐름을 그대로 사용한다. 채팅의 권한/장면 조회는 별도 서비스가 맡고 페이지 ID로 분기별 대화를 구분한다.
**Tech Stack:** 기존 NestJS / TypeORM(MySQL) / Next.js / React / pnpm / GitHub CLI.
**Spec:** 사용자 지시 “지금꺼만 PR”, “main과 충돌 해결하고 PR”, “main 내용을 우선하고 채팅 추가한걸 넣어야해”.

## Global Constraints

- main의 로그인·저장·얼굴 등록·개인화 이미지·본편 1~5쪽·비하인드 A/B 6쪽·캐시 동작을 보존한다.
- 추가 개선 6개, 새 dependency, 운영 DB 변경, migration 실행, 배포, main merge는 제외한다.
- 본인 동화의 장면당 질문 1회. 배역 변경·동시 요청·AI 실패·새로고침으로 복구하지 않는다.
- 현재 장면만 모델에 전달하고 persona와 질문/답변은 로그에 남기지 않는다.
- 기존 미커밋 작업 및 실행 중인 테스트 서버는 원래 작업 트리에 보존한다. 비밀값·로컬 env·QA 파일은 커밋에서 제외한다.

## Implementation Steps

### Task 1: main 기반 채팅 API와 영속 예약
**Files:** packages/contracts/src/story-chat.ts, index.ts, envelope.ts; apps/back/src/modules/story/story-chat*.ts 및 dto/story-chat*.ts; common/port/llm.port.ts, common/utils/is-mysql-duplicate-key.ts; entities/story-page-chat.entity.ts; migrations/*CreateStoryPageChats*; modules/story/story.module.ts; config/env.validation* 및 .env.example.
**Interfaces:** GET/POST /sessions/:sessionId/pages/:pageNo/chat?branchKey=common|a|b. GET은 안전한 등장인물 목록과 상태/저장 대화, POST는 role/message를 받는다. branchKey 생략 시 common. UNIQUE(sessionId,pageId)로 장면별 1회 예약.
- [x] 최신 StorySession varchar UUID와 기존 스키마를 사용해 채팅만 추가한다.
**Acceptance criteria:** 소유권 검사 선행, 잘못된 분기/미등장인물 거부, 중복 요청 모델 1회, AI/DB 실패 시 예약 유지, 기존 session API 변경 없음.
**Verification:** 채팅 context/service/adapter 단위 tests, 외부 의존 없는 HTTP E2E, migration metadata/SQL mock tests. 실제 DB 실행 없음.

### Task 2: main 리더 안의 채팅 UX
**Files:** apps/front/app/(trial)/stories/[slug]/read/page.tsx 및 CharacterChat.tsx, chat-drafts.ts/test; apps/front/lib/api/story-chat.ts/test.
**Interfaces:** CharacterChat은 sessionId/pageNo/branchKey, reader 수명의 drafts와 다음 장면 callback을 받는다. GET의 characters로 질문 대상을 그린다.
- [x] 첫 화면 채팅 진입, 편집 가능한 예시, 초안 보존, 저장 대화 재조회, 등장인물 없는 장면 안내를 기존 책 아래에 연결한다.
**Acceptance criteria:** 본편·A/B 이동 및 이미지 렌더 유지. 책/페이지/분기별 초안 분리. 인증 변경/401 시 초안과 대화 제거. 재전송·자동 AI 재시도 없음.
**Verification:** Vitest 요청/검증/초안 분리 tests, 합성 API로 태블릿·모바일의 본편/분기/대화/실패/재방문·키보드 확인.

### Task 3: 최종 검증과 PR
**Files:** 이번 작업 변경 파일과 tasks/todo.md, GitHub PR.
- [x] pnpm ci:all, main 대비 diff, 비밀/충돌 표식 검사 후 scope별 commit/push 및 PR 생성.
**Acceptance criteria:** main 소스의 기존 기능 제거 없음. backend/frontend 전체 검사 통과. PR base main, merge 가능 여부와 원격 SHA/CI 확인. 운영 migration과 AI 설정 미검증 조건을 PR에 명시한다.
**Verification:** npx --yes pnpm@10.26.2 ci:all, git diff --check, gh pr view/checks.

## Risk & Rollback

채팅 테이블 migration 파일만 작성하며 운영 적용은 담당자 작업이다. 기존 테이블을 변경하지 않는다. API key가 없으면 채팅만 unavailable이며 리더는 유지된다. main으로 merge하지 않고 검토 가능한 PR까지 수행한다.

## 검증 결과

- PR: https://github.com/kon6443/nerd-back/pull/44 — base `main`, head `feat/story-character-chat-main`. 생성 직후 소스 SHA `a300d2be1254585cc820c00cfa6e596d7f68fb40`와 `MERGEABLE`을 확인했다. GitHub CI의 최신 결과는 PR checks에 연결된다.
- 최종 `pnpm ci:all` exit 0: backend unit 244개(27 suites), HTTP E2E 66개(9 suites), frontend 61개(9 files), lint 경고 0, contracts/types/build 통과. `git diff --check`, 충돌 표식 및 추가된 코드의 비밀 signature 검사 통과.
- main `f008860`의 얼굴 등록·개인화·StorySession API·인증·BookFrame·이미지 처리·lockfile 경로는 diff 0건이다. 기존 read/page.tsx는 채팅 연결 38줄 추가·등장인물 안내 8줄 대체만 포함한다.

| 수용 기준 | 검증 근거 |
| --- | --- |
| 본인 동화만 조회·전송, 현재 분기 출연 여부 검증 | context 단위 및 HTTP E2E의 401·404, UUID/분기/role 위조 차단 |
| 장면당 1회·실패 및 응답 유실에 따른 재호출 차단 | service 동시 요청·중복·AI 실패·저장 ACK 유실·서버 중단 tests, A/B 별도 예약 HTTP E2E |
| 본문 및 내부 persona 비공개 | SQL logger·LLM adapter·HTTP 응답 tests |
| main 리더와 새 채팅 동시 동작 | 실제 Next + 합성 Nest API에서 본편·A/B 전환, 장면별 이미지 로드, 저장 답변 재방문 확인 |
| 초안 분리·복원·인증 변경 시 제거 | Vitest와 브라우저에서 1→2→1 배역/질문 복원, A→B→A 복원, session-changed 후 빈 초안 확인 |
| 첫 화면 진입·모바일·실패·빈 장면 안내 | 1024×768·390×844 첫 화면 진입과 키보드 포커스, 320px 가로 overflow 없음, 56px 질문 버튼, 실패 후 재전송 폼 없음, 등장인물 없는 장면 안내 |

통합 브라우저 QA는 합성 AI 2회(성공 1·실패 1)를 사용했다. 실제 AI/운영 DB는 호출하지 않았다. migration은 기존 VARCHAR(36) 세션과의 SQL·metadata 호환성만 검증했고 운영 적용은 담당자 작업이다. 이번 QA의 5531/5532 서버와 브라우저는 종료했으며 기존 사용자의 5521/5522 테스트 서버는 유지했다.

## main의 기존 작업 기록

# My Story 프로토타입 UI 적용 계획

**Goal:** PR #22의 시각 구성을 현재 동작하는 홈·서재·동화 상세·리더·로그인 화면에 적용하고 기존 API 동작을 검증한다.
**Architecture:** 기존 Next.js App Router와 React 컴포넌트를 유지한다. Tailwind 토큰과 공통 UI를 먼저 갱신하고 서버 데이터 조회와 클라이언트 인증 경계를 보존한다.
**Tech Stack:** Next.js 16.3.3, React 19, Tailwind CSS 4, pnpm 10.26.2.
**Spec:** `docs/design/my-story-flow.html`, `docs/tasks/tasks-my-story.md`.

## Goal & Acceptance Criteria

- 홈과 공통 네비에 시안의 하늘·언덕 배경, 흰 헤더, 둥근 CTA를 적용한다.
- 서재·상세·리더는 실제 조회 API의 제목·본문·페이지 수·등장인물을 유지한다.
- 로그인·가입은 기존 입력 검증, 세션 쿠키 요청, 오류 안내를 유지한다.
- 기준 1024×768 및 모바일 390×844에서 글자·조작이 잘리지 않고 터치 영역 56px을 유지한다.
- 카메라·업로드·AI 생성·비하인드 분기·오디오는 신규 구현 범위에 포함하지 않는다.
- 완료한 화면을 사용자가 확인할 수 있도록 로컬 미리보기 서버를 실행하고 데이터 범위를 안내한다.

## Existing Patterns / Source of Truth

- 디자인 결정은 `docs/tasks/tasks-my-story.md`가 소유하며 색상 기록을 코드보다 먼저 갱신한다.
- API는 `lib/api`와 `@nerd/contracts`, 디자인은 `app/globals.css`와 기존 `components/`를 사용한다.
- 프로토타입의 화면 전환 JavaScript를 제품에 복사하지 않는다. 배경 장식은 기존 시안에서 재사용한다.
- 폰트는 현재 시스템 스택을 유지한다. 이미지 object key를 URL로 간주하지 않는다.

## Design (Minimal Approach + Key Decisions)

- 시안의 밝은 팔레트를 사용하고 작은 글자 및 CTA는 대비를 충족하는 같은 계열의 짙은 색을 쓴다.
- 고정 1024px 화면 축소 대신 기존 반응형 레이아웃을 유지해 모바일에서도 실제 터치 영역을 확보한다.
- 미구현 생성 기능으로 이동하는 링크 대신 현재 존재하는 로그인·서재 경로만 제공한다.

## Implementation Steps (Thin Vertical Slices)

### Task 1: 디자인 토큰·공통 화면

**Files:**
- Modify: `docs/tasks/tasks-my-story.md`
- Modify: `apps/front/app/globals.css`
- Modify: `apps/front/app/layout.tsx`
- Modify: `apps/front/app/page.tsx`
- Modify: `apps/front/components/layout/AppHeader.tsx`
- Modify: `apps/front/components/ui/actionStyles.ts`
- Modify: `apps/front/components/ui/Card.tsx`
- Create: `apps/front/components/layout/StoryBackground.tsx`

- [x] 토큰 기록을 갱신하고 공통 배경·헤더·홈·CTA·카드를 적용한다.

`AppHeader`는 `usePathname`으로 활성 경로만 표시하고 데이터 조회를 추가하지 않는다. `StoryBackground`는 시안의 구름과 언덕을 `aria-hidden` SVG로 렌더한다. 모든 화면에서 `actionClass(variant, extra)`를 계속 사용한다.

### Task 2: 서재·상세·책 리더

**Files:**
- Modify: `apps/front/components/story/StoryCard.tsx`
- Modify: `apps/front/components/story/BookFrame.tsx`
- Modify: `apps/front/app/(demo)/library/page.tsx`
- Modify: `apps/front/app/(demo)/library/[slug]/page.tsx`
- Modify: `apps/front/app/(demo)/library/[slug]/[pageNo]/page.tsx`
- Create: `apps/front/components/story/StoryArtwork.tsx`
- Create: `apps/front/components/story/BookFrame.module.css`

- [x] API 데이터와 동적 렌더링을 유지하며 표지 카드·등장인물·양면 책 레이아웃을 적용한다.

`StoryArtwork`는 실제 이미지 URL이 없는 기존 빈 삽화 영역의 장식 전용 자산이다. 콘텐츠 이미지를 제공받은 것처럼 표시하지 않는다. `BookFrame`의 `pageNo`, `imageUrl`, `children`, `footer` 계약을 유지하며 왼쪽 삽화·오른쪽 본문을 배치한다. 이전·다음·마지막 페이지 분기와 `orNotFound`를 그대로 유지한다.

### Task 3: 로그인 시각 적용

**Files:**
- Modify: `apps/front/app/(trial)/login/page.tsx`

- [x] 로그인·가입을 시안 카드와 입력 스타일로 정리하고 오류·pending·자동완성 접근성을 보존한다.

기존 `validateLogin`, `validateSignup`, `login`, `signup`을 사용하고 API 필드를 바꾸지 않는다. 인증 요청 성공 후 기존 `/library` 이동을 유지한다.

### Task 4: 독립 리뷰 후 리팩토링·사각지대 수정

**Files:**
- Modify: `apps/front/components/ui/actionStyles.ts`
- Modify: `apps/front/components/ui/ActionLink.tsx`
- Modify: `apps/front/components/layout/AppHeader.tsx`
- Modify: `apps/front/components/story/BookFrame.tsx`
- Modify: `apps/front/components/story/BookFrame.module.css`
- Modify: `apps/front/app/(trial)/login/page.tsx`
- Modify: `apps/front/lib/api/auth.ts`
- Modify: `apps/front/lib/api/auth.test.ts`
- Modify: `apps/front/lib/api/client.ts`
- Modify: `apps/front/lib/api/client.test.ts`
- Create: `apps/front/components/ui/PageMessage.tsx`
- Create: `apps/front/app/(demo)/library/loading.tsx`
- Create: `apps/front/app/(demo)/library/error.tsx`
- Create: `apps/front/app/not-found.tsx`

- [x] 독립 reviewer가 모바일 display 충돌, 56px 미만 메뉴 폭, 한글 줄바꿈, 상태 배지 대비 미달, 로딩·오류 경계 누락을 확인했다.
- [x] reviewer → refactor 순서로 CTA의 `size` variant를 명시하고 Card를 통째로 덮어쓰는 BookFrame 결합을 제거한다.
- [x] 모바일 CTA visibility와 터치 영역, 한글 줄바꿈, 배지 대비를 수정한다.
- [x] 로그인 폼의 native 제출을 POST로 고정하고 클라이언트 검증 메시지를 한국어로 제공한다. React 핸들러를 거치지 않는 `form.submit()`에서 POST와 쿼리 없는 URL을 확인했다.
- [x] library 하위 경로에 loading·error·not-found 화면을 제공하고 API 실패·빈 목록·404·장문을 실제 브라우저에서 검증한다.
- [x] `apiFetch`의 Headers·튜플 배열 전달을 `new Headers(headers)`로 보존하고 오류 응답의 code/message/timestamp가 문자열인지 검사한다. 회귀 테스트 실패를 먼저 확인했다.
- [x] 최종 리뷰에서 발견한 CTA 포커스와 입력·보조 CTA 경계 대비를 수정했다. 재리뷰 APPROVE, 실제 브라우저 스타일과 화면 확인 완료.

`ActionLink`의 `size="compact"`는 `actionClass(variant, extra, size)`에 전달한다. 기존 두 인자 호출은 기본 크기를 유지하며 표시 여부는 외부 wrapper가 소유한다. 로그인 스키마는 변경하지 않고 `validateLogin`의 검증 결과만 필드별 한국어 문구로 표현한다. 오류 경계는 서버 오류 내용을 출력하지 않고 재시도·홈 이동을 제공한다.

### Task 5: 최종 검증·PR

**Files:**
- Modify: `tasks/todo.md`

- [x] 최종 frontend `ci:all`과 독립 reviewer 재검토를 통과한다.
- [x] 사용자가 요청한 커밋·푸시·PR 생성 후 GitHub의 PR diff와 checks를 확인한다. [PR #23](https://github.com/kon6443/nerd-back/pull/23)은 main 대상으로 열렸으며 코드 커밋 `1a3d307`의 push·PR CI가 모두 통과했다.

### Task 6: 로컬 미리보기 실행

**Files:** 기존 `/private/tmp/nerd-ui-fixture.mjs`와 임시 로그만 사용한다. 제품 소스와 설정은 수정하지 않는다.

- [x] frontend와 검증용 API를 계속 실행되는 프로세스로 띄우고 홈·서재·인증 프록시 응답을 확인한다. 서버 실행 담당 작업이 종료된 뒤에도 홈·stories 응답 200을 재확인했다.

## Tests / Verification

- [x] `npx --yes pnpm@10.26.2 front ci:all`로 lint·타입·기존 테스트·스텁·헬스 경로·프로덕션 빌드를 검증한다.
- [x] 브라우저에서 홈 → 서재 → 상세 → 첫/마지막 페이지 및 로그인/가입 전환과 오류 표시를 확인한다. 로컬 검증 데이터는 별도 임시 서버를 사용하고 실제 DB를 변경하지 않는다.
- [x] 1024×768, 390×844 화면·가로 overflow·56px 터치·키보드 focus·reduced-motion을 확인하고 결과를 기록한다.

## Risk & Rollback

- 시안의 미구현 기능 카피를 그대로 옮기면 실제 기능으로 오해할 수 있으므로 현재 제공되는 기능에 맞춘다.
- 삽화 URL 해석과 실제 운영 인증·데이터는 이번 UI 변경의 검증 범위와 분리해 보고한다.
- 백엔드 API 계약·DB·배포 설정은 수정하지 않는다. 변경 사항은 `feat/my-story-artifact-ui` 브랜치에서 되돌릴 수 있다.

## Verification Story

최종 `npx --yes pnpm@10.26.2 front ci:all` 통과: contracts lint·build, frontend lint·타입·스텁·헬스 경로 검사, 3개 파일의 27 tests, Next production build. 독립 reviewer의 최종 결과는 APPROVE다.

| 인수 기준 | 검증 근거 |
|---|---|
| 시안의 홈·공통 배경·헤더·CTA | 6개 경로 × 태블릿/모바일 12개 화면 캡처·직접 검토, 독립 live QA PASS |
| 실제 조회 데이터·리더 동작 유지 | 제목·본문·등장인물 확인, 1→2→1 및 6→서재 SPA 이동, 18배 장문에서도 끝 문단·다음 CTA 표시 |
| 로그인·가입·오류 흐름 | 빈 필드 한국어 안내와 첫 오류 focus, 로그인 실패 메시지, 로그인·가입 성공 후 서재 이동·임시 세션 쿠키 확인 |
| 모바일·태블릿 접근성 | 390×844/1024×768 가로 넘침 없음, 표시된 app 링크·버튼·입력 모두 56×56 이상, aria-current·keyboard focus·reduced-motion 확인 |
| 예외 및 복구 | 빈 서재, 잘못된 slug/99쪽의 404, 503 오류와 내부 메시지 비표시, 재시도 후 복구, 지연 loading 후 정상 서재 확인 |
| API 경계 및 native 폼 제출 | HeadersInit 2종 보존·오류 필드 형검사 회귀 테스트, native POST /login 및 URL 쿼리 없음 |
| 사용자 확인용 서버 | `http://localhost:5512` 홈·서재·본문·임시 로그인 프록시 200, 별도 작업 종료 후에도 HTTP 응답 확인 |

브라우저 검증은 실제 계약 형태의 임시 API를 사용했다. 운영 DB·실제 이미지 스토리지·운영 인증 연결은 검증하지 않았다. Next devtools 표시는 개발 환경에 한정된다.

로그인 초기 검증 환경에서는 `127.0.0.1`이 Next dev 리소스의 허용 host와 달라 JavaScript 청크가 차단됐다. 서버 로그로 원인을 확인하고 `localhost`로 대조하자 클라이언트 검증이 실행됐다. 앱 설정은 바꾸지 않았다.
