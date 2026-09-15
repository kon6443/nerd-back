# 제작형 서재와 삽화 속 캐릭터 대화 Implementation Plan

**Goal:** 개인화 동화를 서재에서 1쪽 삽화로 식별하고, 제작 흐름의 CTA를 단순화하며, 개인화 리더에서 그림 속 캐릭터를 직접 선택해 대화를 연다.

**Architecture:** `GET /sessions/my`가 완성 세션의 1쪽 썸네일 URL을 선택적으로 제공하고, 공개 서재는 서버 렌더를 유지한 채 로그인 확인 후 개인화 카드만 보강한다. 제작 의도는 `/library?mode=create`로 상세까지만 전달한다. 리더는 기존 히트박스를 `object-cover` 좌표로 변환해 정적 삽화 면에 접근 가능한 hotspot을 한 번만 렌더하고 기존 채팅 상태·표면을 재사용한다.

**Tech Stack:** Next.js 16.3.3, React 19.2.8, NestJS 11.1.9, TypeORM 0.3.31, MySQL, TypeScript, Vitest, Jest.

**Spec:** [`docs/tasks/slice-8-library-character-interaction-spec.md`](../docs/tasks/slice-8-library-character-interaction-spec.md)

## Existing Patterns / Source of Truth

- 개인화 삽화 키와 상태는 `session_page_images`가 소유한다.
- 공개 응답은 `@nerd/contracts`를 먼저 변경한다.
- 공개 `/library`는 백엔드 동화 목록을 서버에서 렌더하고 인증 전용 세션 조회는 클라이언트에서 게이트한다.
- 제작 모드는 URL이 소유하며 컴포넌트 전역 상태나 localStorage를 추가하지 않는다.
- 캐릭터 위치는 `StoryPageCharacter.hitbox`의 0~1 정규 좌표가 정본이다.
- `BookPager.renderArt`는 넘김 종이에 반복되므로 상호작용은 별도 정적 오버레이 슬롯에 둔다.
- 채팅의 상태·폴링·초안·음성은 기존 `useCharacterChat`이 계속 소유한다.

## Design Direction

- 기존 Green `#58cc02`, Blue `#1cb0f6`, Gold `#ffc800`, Purple `#ce82ff`, Paper `#fbf7ec`, Ink `#4b4b4b` 토큰만 사용한다.
- 캐릭터 영역에는 사각형 개발용 히트박스를 노출하지 않고 타원형 광원과 짧은 이름표를 사용한다.
- 포인터 환경은 hover/focus에 반응하고 터치 환경은 작은 말풍선 단서를 항상 보여 준다.
- 대화 표면과 하단 조작 바는 현재 위계를 유지한다. 시각적 강조는 삽화 hotspot 한 곳에만 쓴다.

## Dependency Order

```text
계약·백엔드 응답
  ├─ 서재 개인화 썸네일
  └─ 6A/6B 캐릭터 위치
       └─ BookPager 정적 오버레이
            └─ CharacterHotspots와 채팅 연결

제작 모드 URL 유틸
  └─ 홈 → 서재 → 상세 CTA 분기
```

## Implementation Steps

### Task 1 — 계약과 세션 API 확장

**Files:**
- Modify: `packages/contracts/src/session.ts`
- Modify: `apps/back/src/modules/story-session/story-session.service.ts`
- Modify: `apps/back/src/modules/story-session/story-session.service.spec.ts`

- [x] `MyStorySessionItem.thumbnailImageUrl`과 `AfterStoryChoice.characters`를 계약에 추가한다.
- [x] 완료 세션 ID들의 1쪽 공통 성공 이미지를 한 번에 조회해 URL로 변환한다.
- [x] 썸네일 키·서명 실패를 `null`로 격리한다.
- [x] 비하인드 A/B 페이지 조회에 각 페이지의 등장인물과 히트박스를 포함한다.

**Checkpoint:** 계약 build와 story-session service tests가 통과하며 DB 스키마를 바꾸지 않는다.

### Task 2 — 서재 카드의 개인화 썸네일

**Files:**
- Create: `apps/front/app/(demo)/library/LibraryStoryList.tsx`
- Create: `apps/front/app/(demo)/library/libraryStories.ts`
- Create: `apps/front/app/(demo)/library/libraryStories.test.ts`
- Modify: `apps/front/app/(demo)/library/page.tsx`
- Modify: `apps/front/lib/api/session.test.ts`

- [x] 서버가 받은 공개 동화 목록을 즉시 렌더하고, 로그인 확인 뒤 세션 목록을 한 번만 조회한다.
- [x] 완성 세션과 같은 slug의 `thumbnailImageUrl`만 `StoryCard.imageUrl`로 전달한다.
- [x] 미완성·누락·실패에서는 기존 `StoryArtwork`를 유지한다.
- [x] 이미지가 뒤늦게 들어와도 카드 크기와 격자가 움직이지 않게 한다.

**Checkpoint:** 순수 매칭 tests와 frontend types/build에서 공개·로그인 서재가 모두 성립한다.

### Task 3 — 제작 모드 URL과 상세 CTA

**Files:**
- Create: `apps/front/lib/libraryMode.ts`
- Create: `apps/front/lib/libraryMode.test.ts`
- Modify: `apps/front/components/layout/authLinks.ts`
- Modify: `apps/front/app/(demo)/library/page.tsx`
- Modify: `apps/front/app/(demo)/library/[slug]/page.tsx`

- [x] 홈 로그인 사용자용 CTA를 `/library?mode=create`로 보낸다.
- [x] `mode=create`를 정확히 판정하고 카드 상세 링크와 돌아가기 링크에 보존한다.
- [x] 일반 체험·헤더 서재·로그인 기본 이동은 일반 모드로 유지한다.

**Checkpoint:** URL helper tests와 Next 타입 검사에서 일반/제작 경로가 갈린다.

### Task 4 — 모든 세션 상태에서 제작 모드 CTA 정리

**Files:**
- Modify: `apps/front/components/story/StorySessionActions.tsx`
- Modify: `apps/front/app/(demo)/library/[slug]/loading.tsx`

- [x] 상세이 제작 모드임을 명시적 prop으로 전달한다.
- [x] 확인 중 자리표시, 완료, 생성 중, 실패, 미생성 모든 상태에서 시연 CTA를 함께 숨긴다.
- [x] 개인화 제작·읽기·재시도·초기화 버튼은 그대로 유지한다.
- [x] 제작 모드 로딩 화면도 최종 CTA 폭과 같은 자리를 그린다.

**Checkpoint:** 일반 모드의 시연 CTA와 제작 모드의 개인화 CTA가 각각 유지된다.

### Task 5 — cover 좌표 변환과 BookPager 정적 오버레이

**Files:**
- Create: `apps/front/app/(trial)/stories/[slug]/read/characterHotspotGeometry.ts`
- Create: `apps/front/app/(trial)/stories/[slug]/read/characterHotspotGeometry.test.ts`
- Modify: `apps/front/components/story/BookPager.tsx`
- Modify: `apps/front/components/story/BookFrame.module.css`

- [x] 원본 이미지와 컨테이너 크기로 `object-cover` scale·center crop을 계산한다.
- [x] 히트박스를 표시 좌표로 변환하고 컨테이너 경계로 안전하게 자른다.
- [x] `BookPager`에 정적 삽화 면 전용 `renderArtControls` 슬롯을 추가한다.
- [x] 넘김 중 오버레이를 숨기고 leaf/artHold에는 복제하지 않는다.

**Checkpoint:** 정사각·세로 원본 좌표 tests가 통과하고 기존 넘김 시각이 변하지 않는다.

### Task 6 — 캐릭터 hotspot과 채팅 연결

**Files:**
- Create: `apps/front/app/(trial)/stories/[slug]/read/CharacterHotspots.tsx`
- Modify: `apps/front/app/(trial)/stories/[slug]/read/page.tsx`
- Modify: `apps/front/app/(trial)/stories/[slug]/read/useCharacterChat.ts`
- Delete: `apps/front/app/(trial)/stories/[slug]/read/ChatLauncher.tsx`

- [x] 현재 본편 또는 6A/6B의 캐릭터 히트박스를 hotspot 버튼으로 그린다.
- [x] 클릭한 available 캐릭터를 선택하고 내레이션을 멈춘 뒤 기존 대화 표면을 연다.
- [x] 로그인·로딩·대기·완료·실패 상태도 hotspot을 통해 다시 열 수 있게 한다.
- [x] 하단 런처를 제거하고 hotspot trigger로 닫힘 포커스를 복귀시킨다.
- [x] hover·focus-visible·touch 단서와 reduced-motion을 적용한다.

**Checkpoint:** 하단 바가 단순해지고 본편·비하인드 캐릭터가 같은 대화 상태를 연다.

### Task 7 — 통합 검증과 문서 완료

**Files:**
- Modify: `tasks/todo.md`
- Modify: `tasks/plan.md`
- Modify: `docs/tasks/slice-8-library-character-interaction-spec.md`

- [x] contracts, backend, frontend의 집중 tests/build를 수행한다.
- [x] `pnpm ci:all`과 `git diff --check`를 수행한다.
- [x] 1024×768 및 390×844에서 두 동화의 서재·제작 모드·본편·6A/6B를 수동 검증한다.
- [x] 실제 화면에서 hover, 키보드, touch, 닫힘 포커스, 쪽 넘김, 채팅 상태와 이미지 크롭을 확인한다.

**Checkpoint:** Success Criteria와 Verification Story가 근거로 채워진다.

## Risks & Mitigations

- **인증 요청 폭포:** 공개 목록은 서버에서 먼저 그리고 로그인 확인 후 세션 조회만 수행한다.
- **DB N+1:** 완료 세션의 1쪽 이미지를 `IN(sessionIds)`로 한 번에 조회한다.
- **서명 URL 장애:** 썸네일 URL만 `null`로 폴백해 서재 전체를 유지한다.
- **히트박스 크롭 오차:** `object-cover`의 자연 크기와 컨테이너 크기를 반영하고 두 공식 동화를 실제 화면에서 검증한다.
- **넘김 중 중복 버튼:** 상호작용을 `renderArt`에서 분리하고 정적 면·비전환 상태에서만 렌더한다.
- **모바일 발견성:** hover에 기대지 않고 말풍선 단서를 항상 노출한다.
- **포커스 유실:** 대화를 연 실제 hotspot을 기억하고 닫힐 때 연결 여부를 확인해 복귀한다.

## Verification Story (작업 완료)

- **무엇이 어떻게 바뀌었는가:**
  - `GET /sessions/my` 응답에 완성 세션 1쪽 썸네일 URL(`thumbnailImageUrl`)을 1회 일괄 쿼리로 조회해 매핑하도록 백엔드와 계약(`@nerd/contracts`)을 확장함.
  - 서재(`LibraryStoryList`)에서 로그인한 사용자의 완성된 동화 카드에 개인화 1쪽 썸네일을 표시하고 미완성/오류/비로그인 시에는 기본 삽화로 안전하게 폴백함.
  - 홈 `내 얼굴로 만들기` CTA를 `/library?mode=create`로 연결하고 상세 페이지까지 제작 모드를 보존하며, 상세 화면의 모든 상태(로딩/완료/제작중/실패/미생성)에서 시연 읽기 CTA를 숨김.
  - `BookPager`에 정적 삽화 전용 오버레이 슬롯(`renderArtControls`)을 신설하고, `object-cover` 비율 및 중앙 크롭을 반영한 `CharacterHotspots` 컴포넌트를 구현하여 그림 속 캐릭터를 직접 터치/클릭/포커스해 대화를 열 수 있게 연결함. 하단 `ChatLauncher`는 제거됨.
- **어떻게 동작을 확인했는가:**
  - 백엔드 단위 테스트 30 suites (270 passed), E2E 테스트 9 suites (66 passed) 전체 통과 (`pnpm back test`, `pnpm back test:e2e`).
  - 프론트엔드 Vitest 15 test files (91 passed) 전체 통과 (`pnpm front test`).
  - `@nerd/contracts` 빌드 및 NestJS / Next.js 프로덕션 빌드 성공.
  - 전체 CI 검사 `pnpm ci:all` exit code 0 확인.
  - `git diff --check` 공백 및 충돌 표식 검사 통과.
- **미검증 또는 운영 확인이 필요한 항목:**
  - 실제 S3 스토리지 및 실제 운영 DB 적용은 운영 배포 환경에서 확인 필요(코드 및 스키마 수준에서는 DB 변경 없음).
