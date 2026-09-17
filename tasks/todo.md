# 동화나라 전체 UI 일관성 Implementation Plan — 2026-09-17

> **For implementers:** 홈의 종이·숲 재질을 전체 기존 경로에 확장하고, 기능·접근성·성능을 보존한다.

**Goal:** 홈·서재·소개·촬영·로그인·마이페이지·독서 및 상태 화면에서 일관된 GNB/CTA/색상과 목적 있는 입체 인터랙션을 제공한다.
**Architecture:** globals.css와 actionStyles의 의미 토큰을 공통 기준으로 만들고 StoryRoom으로 기존 평면 배경을 대체한다. 추가 입체 연출은 CSS perspective로 페이지 진입 시 한 번 펼쳐지는 작은 책, 호버, 실제 제작 진행 상태에 반응하게 구현한다. 새로운 WebGL renderer·타이머·패키지·API는 추가하지 않는다.
**Tech Stack:** 현재 Next.js 16.3.3, React 19, CSS Modules/Tailwind, Three.js 홈 유지, Vitest, 실제 Chromium 검증.
**Spec:** 사용자 첨부 촬영 화면과 전체 프론트 UI/UX 일관성·다른 페이지의 3D 재미 요소 요청. 홈의 크림색 종이·숲색을 시각 기준으로 삼는다.

## Global Constraints

- 변경 범위 apps/front UI 및 tasks/todo.md. backend·DB·인증/합성/폴링 계약 유지. 후속 요청에 따라 리팩토링 후 main 대상 PR을 게시하며 merge·배포는 하지 않는다.
- GNB guest/authenticated의 첫 렌더 안정성·현재 위치·모바일 터치 타깃을 유지한다. 주요 행동은 숲색, 보조는 종이색, 오류는 의미색으로 통일한다.
- 사진 안내의 사실 문구와 정면 한 장 흐름·카메라 정리·blob 해제 유지. 실제 얼굴/유료 생성/개인 데이터 쓰기는 QA에서 하지 않는다.
- 홈 진입·그림자/GPU lifecycle·이미지 preload/cache 유지. 장식 버튼은 두지 않는다(사용자 추가 요청). CSS 입체 모션은 진입 시 한 번/호버/실제 진행 변화에 반응하며 reduced motion에서는 펼쳐진 정지 상태를 제공한다.
- 디자인 검증은 desktop/mobile 묶음 1회, 발견된 결함을 모아 수정 후 확인 1회. 실제 상태 fixture는 브라우저 내부에서만 사용하고 운영 인증을 우회하지 않는다.

### Task 1: 공통 시각 언어와 GNB

**Files:** apps/front/app/globals.css, layout.tsx, HomeWorld.module.css, book-world.ts, page.tsx; components/layout/AppHeader.tsx, AuthCta.tsx, StoryBackground.tsx, StoryRoom.module.css; components/ui/actionStyles.ts, Card.tsx; app/(demo)/library/LibraryShell.tsx, LibraryStoryList.tsx, page.tsx.
**Interfaces:** actionClass(variant, extra, size) 및 session 표시 계약 유지. 헤더 높이 토큰을 홈과 공유한다. StoryBackground는 공통 종이 바탕의 정적 장식으로 변경한다.
- [x] 공통 팔레트·버튼·GNB·모바일 정렬을 일관되게 적용했다.
**Acceptance criteria:** 동일 역할의 CTA가 같은 색/높이/눌림/포커스를 갖고, 촬영 경로도 서재 위치로 표시된다. 홈의 guest 사용자도 내 얼굴로 만들기 진입을 발견할 수 있다.
**Verification:** 기존 테스트 및 frontend ci:all; 실제 guest/authenticated GNB, 320/390/768/1440 뷰포트·홈 진입 확인.

### Task 2: 촬영·로그인·마이페이지의 동화 재질과 입체 피드백

**Files:** components/layout/StoryRoom.tsx, StoryRoom.module.css; Create components/story/StoryBookScene.tsx, StoryBookScene.module.css; app/(trial)/stories/[slug]/capture/page.tsx, CaptureStudio.tsx, CaptureStudio.module.css; app/(trial)/login/page.tsx; app/(trial)/me/page.tsx; components/story/StoryCard.module.css; app/(demo)/library/[slug]/StoryDetail.module.css.
**Interfaces:** StoryBookOrnament는 장식용 작은 책을 진입 시 자동으로 펼치며 hover에 반응한다. StoryRoom(storySlug?)와 기존 촬영 props/API는 유지한다. 공개 서재 표지/소개는 기존 비율과 캐시를 보존한다.
- [x] 촬영·로그인·마이페이지를 공통 공간으로 맞추고 진입/호버와 실제 상태에 반응하는 깊이감을 줬다.
**Acceptance criteria:** 초기/카메라 거부/선택/재촬영/완료 화면이 같은 재질을 사용하고 사진이 왜곡되지 않는다. 작은 책은 조작 버튼 없이 자연스럽게 재생되고, hover가 없는 모바일과 모션 감소 설정에서도 내용과 기능이 유지된다. 내 동화의 비어 있음/목록/실패를 구분한다.
**Verification:** 브라우저 synthetic 사진과 차단된 API writes, 상태 fixture로 촬영·my page·로그인/가입 전환; 자동 재생/호버/reduced motion과 불필요한 Tab 정지점·overflow 없음 확인.

### Task 3: 독서·제작·완독·안내의 일관성

**Files:** app/(trial)/stories/[slug]/read/GeneratingView.tsx, EndView.tsx, BranchView.tsx, ChatSurface.tsx, page.tsx; components/ui/CenteredPage.tsx, PageMessage.tsx, StatusEmblem.tsx; 필요한 공통 아이콘은 Create components/ui/StoryIcon.tsx.
**Interfaces:** 생성 progress와 기존 상태/action callbacks를 그대로 소비한다. reader의 modal/keyboard/책넘김/오디오·polling은 유지한다.
- [x] 제작 상태와 독서·대화·완독·오류 화면을 같은 토큰/아이콘/여백으로 맞췄다.
**Acceptance criteria:** 실패를 완료/진행으로 오인시키지 않고 재시도·뒤로가기·모달 Esc/포커스가 유지된다. 페이지별 무한 장식 루프가 추가되지 않는다.
**Verification:** demo reader·분기·채팅 열기/닫기, synthetic 생성/실패/완료 상태와 production build. 필요한 상태 테스트만 추가하며 CSS 구현을 복제한 테스트는 만들지 않는다.

### Task 4: 전체 흐름과 성능 확인

**Files:** tasks/todo.md, 기존 frontend 검사, 임시 QA 파일은 /tmp/nerd-ui-consistency-*.
**Interfaces:** 실제 공개 API read 및 브라우저 격리 fixture; frontend ci:all과 최종 foreground lint.
- [x] 전체 경로의 desktop/mobile 검증 및 자동 재생·호버 최종 확인을 완료했다.
**Acceptance criteria:** 각 페이지 시각 확인, 수평 overflow/console exception 없음, focus 및 56px 주 행동 유지, 사진/인증/독서 흐름 회귀 없음, 추가 idle RAF/timer/WebGL 없음. 개발 서버 유지.
**Verification:** before/after screenshots, DOM·motion·network 관찰 결과와 테스트/lint/type/build exit 0 기록. 미검증 실제 유료 합성과 계정 쓰기는 명시한다.

### Task 5: 공통 스타일 정리 및 PR 게시

**Files:** components/layout/AuthCta.tsx, authLinks.ts, StoryRoom.module.css; components/story/StorySessionActions.tsx, StoryBookScene.module.css; app/HomeWorld.module.css, page.tsx 및 해당 공통 primary 스타일 호출부. Git feature branch와 tasks/todo.md.
**Interfaces:** 공통 actionClass가 버튼 색상을 단독 소유하도록 중복 override를 제거한다. 현재 유일한 헤더 호출자에 맞게 AuthCta props를 줄이되 두 session 슬롯과 aria-current를 보존한다. 진입·호버·모션 감소 동작은 유지한다.
- [ ] 중복 스타일과 미사용 props를 정리하고 검증 후 commit/push/PR을 게시한다. (진행 중)
**Acceptance criteria:** 외관·경로·인증·촬영·독서 동작 유지, frontend ci:all과 live smoke 통과, secrets/임시 파일 제외, 최신 main과 충돌 없음, 로컬·원격·PR head 일치.
**Verification:** 전체 호출자 검색, frontend ci:all, 실제 생성 진입·GNB·hover/reduced motion 확인, git diff --check, main ancestor 및 PR/CI 상태 확인.

## UI verification — 2026-09-17

- 7개 주요 화면의 desktop/mobile 14개 관찰과 상태 fixture 23개 관찰에서 가로 넘침·runtime exception 0. 촬영 거부/선택·완료, 내 동화 목록, 제작/실패, 독서·대화 Esc·분기·완독을 확인했다. 실제 사진·계정 쓰기·유료 AI 합성은 수행하지 않았다.
- 작은 책은 900ms 진입 1회 후 정지, PC hover 반응, 터치 환경 자동 재생, reduced motion 정지 상태를 확인했다. 장식 버튼 0, 촬영 페이지 idle RAF 0, 추가 canvas 0. 주요 CTA 56px, 320px 촬영 제목 겹침 없음.
- frontend ci:all(20 files/126 tests·lint/types/stubs/health-path·build), 마지막 CSS 수정 후 foreground lint/build exit 0. 최종 build는 sandbox 실행이 compile 단계에서 진행되지 않아 중단하고 허용된 실행 환경에서 같은 명령으로 성공했다. 내부 원인은 단정하지 않는다.
- 공통 UI 토큰 변경이 홈 3D의 강/나뭇잎 색에 전파되어 scene 전용 토큰으로 분리했다. JS에서만 사용하는 토큰은 Tailwind가 생략하므로 :root에 선언하고 production CSS·실제 색을 확인했다.
- 근거: /tmp/nerd-ui-consistency-final.json, /tmp/nerd-ui-consistency-states.json, /tmp/nerd-ui-consistency-motion.json 및 최종 home/capture-320 캡처. 리팩토링 후 검사는 별도로 기록한다.
- 리팩토링: 홈/서재/로그인/소개/오류의 중복 primary CSS와 StorySessionActions의 스타일 전달 prop, AuthCta의 미사용 목적지/prefetch 옵션을 제거했다. 전용 scene의 reduced motion 선택자가 모든 사용처에 적용되도록 맞췄다. 기존 요청·세션/사진·폴링 로직은 변경하지 않았다.
- 리팩토링 후 frontend ci:all exit 0(20 files/126 tests·lint/types/stubs/health-path·production build), 마지막 주석/이름/정렬 정리 후 foreground lint 및 git diff --check exit 0. 생성 진입·로그인 검증/가입 전환·PC hover·터치 자동 재생·reduced motion을 재확인했고 runtime exception/API write 0, idle RAF/canvas 0이었다. 실제 공개 상세의 CTA/돌아가기 경로, primary 색 rgb(53,79,56), 높이 56px와 GNB 현재 위치도 확인했다.
- 게시 전 origin/main=7c07864와 HEAD가 같아 통합 충돌 없음. 변경 파일은 frontend와 작업 기록뿐이며 dependency·migration·backend 변경과 secrets/임시 산출물은 없다.

---

# 홈 동화책·표지 로딩 리팩토링 및 PR Implementation Plan — 2026-09-17

> **For implementers:** 현재 작업을 검토하고 필요한 책임 분리만 수행한 뒤 검증된 feature branch를 main 대상 PR로 게시한다.

**Goal:** 차분한 홈 3D 동화책과 서재 표지 preload/cache 개선을 검토하기 쉬운 변경으로 완성한다.
**Architecture:** 서재의 소유자별 썸네일 상태에서 공용 이미지 preload 기능을 분리한다. 공개 표지 서명 구간/TTL은 명명하고 오류 fallback과 private 서명 경로를 보존한다. 기존 3D 모델/입자/lifecycle은 리뷰·검증 후 유지한다.
**Tech Stack:** 기존 Three.js·React/Next·NestJS·AWS SDK·pnpm·Git/GitHub CLI. 추가 의존성·DB/스토리지 변경 없음.
**Spec:** 사용자 최신 요청 — 리팩토링 후 PR. 현재 main의 홈 3D·표지 로딩 미커밋 변경 전체를 포함한다.

## Global Constraints

- 새 feature branch에서 commit/push/PR한다. main push·PR merge·배포는 하지 않는다. env·자격증명·서명 URL·QA 임시 파일은 staging하지 않는다.
- 소스 리뷰: createBookModel→createBookWorld→HomeWorld, 입자 update/dispose, preload의 홈/목록/상세 3개 호출자, StoragePort의 S3/local 및 공개/개인화/음성 호출자를 확인한다.
- preload의 최대 128 URL·decode 실패 재시도·늦은 실패 보호와 사용자별 썸네일 소유권 검사를 유지한다. 첫 두 공개 표지 준비, effect abort, navigation 실패 비차단 계약은 유지한다.
- 5분 공개 표지 서명 구간과 1시간 TTL·키 교체/미공개 검사·private 서명의 현재시각 발급을 유지한다.
- 3D 색·배치·진입 1450ms·Escape·reduced motion·기존 GPU 정리를 변경하지 않는다. 외관 변경이나 인접 API 리팩토링을 추가하지 않는다.

### Task 1: 리뷰 기반 책임 분리

**Files:** Create apps/front/lib/preloadThumbnailImage.ts, preloadThumbnailImage.test.ts. Modify app/(demo)/library/libraryStories.ts 및 test, LibraryStoryList.tsx, components/story/StoryDetailArtwork.tsx, app/HomeWorld.tsx의 imports; apps/back/src/modules/story/story.service.ts의 서명 상수/분기; tasks/todo.md.
**Interfaces:** preloadThumbnailImage(url: string | null | undefined): void 및 getOptionalAssetUrl 반환/오류 계약 동일. API·컴포넌트 props는 유지한다.
- [x] 전이적 호출자를 검토하고 공용 preload와 6개 테스트를 lib로 옮겼다. 공개 표지 서명 구간/TTL을 명명하고 직접 분기로 정리했다.
**Acceptance criteria:** 공용 기능이 특정 라우트 파일에 의존하지 않으며 기존 캐시/소유권/서명/취소 테스트가 유지된다. 3D 리뷰에서 확인한 자원 공유·해제 경로 보존.
**Verification:** 이동한 기존 preload 6개 테스트와 공개 목록/소유권·API signal·S3 서명/서비스 테스트. frontend/backend ci:all 및 foreground lint·git diff --check.

### Task 2: main 통합·PR 게시

**Files:** 검증된 현재 변경 및 tasks/todo.md. Git feature branch와 원격 main.
**Interfaces:** origin/main fetch/merge 후 feature push, PR base=main. 본문은 최종 3D·표지 로딩 동작과 리팩토링·검증·제한을 기술한다.
- [x] 최신 main과 통합하고 검증된 변경을 commit/push하여 PR과 원격 상태를 확인했다.
**Acceptance criteria:** 승인된 변경만 포함·secrets 미포함, main 충돌 없음, PR head SHA와 로컬/원격 일치. 실제 브라우저 preload 및 진입 회귀 유지, 개발 서버 유지.
**Verification:** main ancestor/diff·staged paths/content 확인, 필요한 통합 검사 및 실제 브라우저 회귀, gh pr view/checks. PR URL과 CI 상태 보고.

## Refactor and PR verification — 2026-09-17

- PR #61: https://github.com/kon6443/nerd-back/pull/61 (base=main). 소스 커밋 9292604·5dce477 게시 후 로컬·원격·PR head SHA 일치와 MERGEABLE을 확인했다. 게시 시 GitHub frontend/backend CI는 진행 중이며 최종 상태는 PR에서 확인한다.
- preload의 기존 구현이 이동 후에도 원문과 동일함을 비교했고, 홈/목록/상세 3개 호출자를 공용 lib로 연결했다. 사용자별 썸네일 상태는 서재에 남겼다. 3D geometry/material 공유와 InstancedMesh·context dispose, 새 빛가루의 취소 원복 및 중복 progress 갱신 방지 경로를 검토했다.
- 최신 origin/main fetch 결과 15ef3d3으로 기준과 같아 통합 충돌이 없다. feat/storybook-home-and-cover-loading에서 전체 변경을 게시한다.
- 최종 리팩토링 후 frontend ci:all exit 0: 20 files/126 tests·lint/types/stubs/health-path·build. backend ci:all exit 0: 33 suites/315 unit tests·9 suites/66 E2E·lint/types/stubs·build. 양쪽 foreground npm run lint와 git diff --check exit 0. 원격 CI와 별개인 로컬 결과다.
- 실제 브라우저의 캐시 없는 첫 run에서 표지가 클릭 약 0.89초 전에 요청됐고 route 후 34~35ms에 표시됐다. 재방문 표지 전송량 0, route 후 약 0.1ms. 이전 단계의 production·모바일·진입/취소·GPU 해제 검증 코드 및 lifecycle은 리팩토링에서 변하지 않았다. /tmp/nerd-image-loading-refactor.json.
- 검증 환경 문제를 분리했다. 첫 ci 명령은 sandbox npm DNS 제한으로 테스트 시작 전 실패했고 동일 명령을 허용된 네트워크 환경에서 실행해 성공했다. /tmp/nerd-pr61-{front,back}-ci-sandbox-failure.log, /tmp/nerd-pr61-{front,back}-ci.log.
- 초기 브라우저 재검사는 backend 5501 미실행으로 실패했다. 기존 Nest watch와 tsc build가 같은 dist를 공유하고, 일반 tsc가 require('@config/timezone')을 남겨 Nest watch 재실행 때 MODULE_NOT_FOUND가 났다. 실제 dist 및 Nest의 alias 변환 hook과 로그를 대조했다. 검증 빌드를 마친 후 이번 세션의 watch를 재시작해 require('./config/timezone') 변환·5501 listener·실제 API/표지 응답을 확인했다. 앞으로도 같은 dist에 두 빌드를 동시에 쓰면 재발할 수 있으며, 빌드 구성 변경은 이번 PR에 넣지 않았다. 기존의 별도 watch 프로세스는 수정하지 않았다.

---

# 서재 표지 로딩 지연 개선 Implementation Plan — 2026-09-17

> **For implementers:** 측정된 이미지 요청 시작 지연과 매 조회마다 바뀌는 URL을 함께 수정한다.

**Goal:** 홈에서 공개 표지를 미리 내려받고 서재에서 같은 URL의 브라우저 캐시를 재사용한다.
**Architecture:** 공개 동화 표지만 서명 시각을 5분 경계로 맞춰 같은 키의 URL을 안정화한다. 기존 1시간 서명 유효기간 내에서 남은 수명은 55~60분이다. HomeWorld의 비차단 effect가 공개 목록의 첫 두 표지만 기존 bounded preload helper로 받으며 이탈 시 목록 요청을 취소한다.
**Tech Stack:** 기존 AWS SDK v3·StoragePort·Next.js 16.3.3·React·Jest/Vitest. 새 endpoint/DB migration/asset 업로드/의존성 없음.
**Spec:** 사용자 요청 — '동화 체험하기' 이후 늦는 이미지의 해결. 실제 재현에서 라우트 약 1.75초 이후 이미지가 추가 2.5초 뒤 표시되며 같은 표지의 반복 요청도 캐시를 재사용하지 못했다. 목록 API 약 77ms, WebP 두 개 합계 약 910KB, URL 재조회 시 달라짐을 확인했다.

## Global Constraints

- 기존 main의 3D 변경을 보존한다. 1450ms 진입/CTA/Escape/reduced motion은 유지하며 이미지 완료를 기다리는 새 navigation gate를 만들지 않는다.
- 공개 목록/상세의 표지만 stable signingDate를 사용한다. 개인화 이미지·얼굴 사진·음성의 기존 서명 방식·만료·권한 검사와 private Cache-Control은 유지한다.
- 시간 경계는 요청마다 계산하고 URL/개인정보를 서버 전역 Map에 저장하지 않는다. 같은 시각/키/설정의 replica에서 URL이 동일해야 한다. 키가 바뀌면 즉시 새 URL을 받는다.
- 홈의 이미지 준비 실패는 정상 진입을 막지 않는다. 공개 첫 두 표지만 prefetch하고 effect cleanup은 fetch를 abort한다. 이미지 객체는 기존 128-entry URL 중복 방지 helper가 보관하지 않는다.
- 실측은 URL query/서명 정보를 로그·문서에 남기지 않는다. 단순히 캐시를 비우거나 timeout을 늘려 해결했다고 주장하지 않는다.

### Task 1: 공개 표지 URL과 미리 받기

**Files:** Modify apps/back/src/common/port/storage.port.ts, common/adapters/s3-storage.adapter.ts, modules/story/story.service.ts 및 인접 specs; apps/front/lib/api/story.ts, story.test.ts, app/HomeWorld.tsx. Read app/(demo)/library/libraryStories.ts. Record tasks/todo.md.
**Interfaces:** StoragePort.getPresignedUrl(key, expiresInSeconds?, signingDate?)는 기존 호출과 호환. fetchStories(signal?)는 선택적 취소 전달. 기존 목록 응답 계약은 유지한다.
- [x] 공개 표지의 5분 서명 구간·키 변경·기존 private 서명과 홈의 미리 받기/취소를 구현하고 확인했다.
**Acceptance criteria:** 5분 안의 같은 공개 표지 URL 동일, 다음 구간/키 변경은 새 URL, 실제 서명이 유효하고 private 흐름의 호출 인자는 동일. 홈 이탈 시 fetch 취소, 실패 시에도 서재 진입 가능.
**Verification:** S3 adapter에서 테스트 자격증명으로 실제 SDK 서명을 비교(외부 요청 없음), StoryService의 공개 범위/키 갱신/경계 테스트, frontend signal 전달 테스트.

### Task 2: 실측·프로젝트 검증

**Files:** Existing frontend/backend suites, tasks/todo.md, /tmp/nerd-image-loading-* 산출물.
**Interfaces:** 실제 공개 API/스토리지 GET만 사용하며 auth fixture가 필요하면 QA 브라우저 안에서만 적용한다.
- [x] dev/production에서 첫 방문·재방문 요청 순서 및 실패/이탈·모바일·GPU 자원 해제와 프로젝트 검사를 완료했다.
**Acceptance criteria:** 홈에서 표지 요청이 시작되고 다음 서재가 그 URL을 재사용. 전후 측정에 cold/warm 및 dev/production 조건 명시, preload 실패/이탈과 모바일 진입 유지. frontend/backend ci:all 및 foreground lint 통과.
**Verification:** 동일 시나리오 CDP 네트워크·DOM 타임라인 비교, 실제 API URL 동일성·이미지 200 확인, production preview 및 기존 진입/cleanup QA. git diff --check. 임시 서버/QA 브라우저만 종료하고 기존 5501/5502 유지.

## Library image loading verification — 2026-09-17

- 원인: route prefetch만으로 표지 파일이 다운로드되지 않았고 서재 commit 후에야 두 이미지 요청이 시작됐다. 이미 WebP이고 Cache-Control이 private/max-age=86400이어도 API가 매번 새 서명 URL을 발급해 재방문이 다른 cache key가 됐다. 로컬 최초 측정에서 route 1.75초 후 이미지 완료가 추가 2.44~2.54초, 다음 방문도 0.37~0.42초 및 두 파일 약 910KB 재전송이었다. 외부 첫 응답까지 약 2.2초였으며 DNS/TLS/스토리지 각각의 지연으로 분해하지 않았으므로 특정 인프라 원인을 단정하지 않는다.
- 수정: 공개 표지 서명 시각을 5분 단위로 안정화하고 홈의 useEffect에서 첫 두 표지를 기존 preloadThumbnailImage로 받는다. API 요청만 effect cleanup에서 취소하며 이미지 실패는 기존 서재 로딩으로 복구한다. 개인화/얼굴 사진/음성의 서명과 접근 검사는 유지한다. 서버 URL Map·추가 navigation gate·새 endpoint·DB/스토리지 쓰기 없음.
- 수정 전후 모두 홈 renderer ready 후 1초 대기하고 실제 버튼을 눌렀다. 별도 브라우저의 캐시 없는 dev 첫 방문은 표지 요청이 클릭 약 0.91초 전에 시작되고, route 후 추가 0.38~0.68초에 완료했다. 클릭부터 두 표지 완료는 약 4.29→2.23초. 같은 URL의 재방문 표지는 약 0.1ms 후 표시되고 전송량 0이었다. 사전에 캐시된 별도 run은 0~4ms였으며 cold 결과와 구분한다.
- production standalone + 실제 API reverse proxy에서도 확인했다. browser cache를 비운 첫 run은 이미지 두 개가 홈에서 HTTP 200으로 다운로드됐고 route와 약 0.1ms 차이로 표시됐다. 다음 run 전송량 0. 이 production run은 앞선 실측과 TCP/TLS 연결 조건이 같다고 보장하지 않으므로 보편적 첫 로드 보장은 아니다. 느린 연결/홈에서 즉시 클릭/5분 서명 경계에서는 추가 이미지 대기가 남을 수 있다.
- failure/abort: 브라우저에서 홈 목록 preload 실패를 주입해도 정상 서재·두 표지 표시. 지연된 preload 중 이탈하면 signal abort 1회 및 정상 서재·표지 2개 확인. 실제 API 쓰기 0. 1440/768/390/320 overflow 0, 두 CTA 유지, 실제 두 버튼·Escape·reduced motion·6회 홈/서재 이동 통과. idle draw 0, context 7/7·Buffer 1,869/1,869·VertexArray 1,134/1,134 해제, runtime exception 0.
- 최종 source 후 frontend ci:all exit 0: 19 files/126 tests·lint/types/stubs/health-path·build. backend ci:all exit 0: 33 suites/315 unit tests·9 suites/66 E2E·lint/types/stubs·build. 양쪽 foreground npm run lint 및 git diff --check exit 0. 실 SDK 고정 서명/기본 현재시각 서명, 공개 키 교체/시간 경계, AbortSignal 전달 테스트 포함.
- 근거: /tmp/nerd-image-loading-before.json, /tmp/nerd-image-loading-after.json(warm), /tmp/nerd-image-loading-after-cold.json, /tmp/nerd-image-loading-production-cold.json, /tmp/nerd-image-loading-resilience.json, /tmp/nerd-image-regression-qa-report.json. 보고서는 URL query/서명 값을 기록하지 않는다. main의 미커밋 변경으로 유지한다.

---

# 차분한 동화책 구성 Implementation Plan — 2026-09-17

> **For implementers:** 건물과 장식을 줄여 펼친 책과 작은 이야기 풍경의 위계를 회복한다.

**Goal:** 성·집·장식의 경쟁을 낮추고 종이 여백과 따뜻한 숲속 동화 분위기가 읽히게 한다.
**Architecture:** book-model.ts의 정적 건물 크기·첨탑·조경 수를 줄이고 book-atmosphere.ts는 소수의 진입 빛가루만 유지한다. 기존 카메라 성문 좌표와 라우팅·dispose 흐름을 유지한다.
**Tech Stack:** 기존 Three.js·TypeScript·Vitest. 새 asset/package 없음.
**Spec:** 사용자 요청 — 현재 책이 과하므로 객관적으로 판단하여 동화에 어울리도록 수정한다. 크기 경쟁과 중복 장식이 원인이며 작은 팝업 동화책 방향으로 절제한다.

## Global Constraints

- main의 현재 미커밋 작업에서 홈 3D만 다듬는다. 문구·CTA·책의 종이 두께·카메라·1450ms 진입·Escape·reduced motion·API·DB는 유지한다.
- 성문 좌표는 유지하고 성의 첨탑을 7→3개로 줄인다. 집은 0.8배로 낮추고 별채·돌출창·복잡한 지붕선은 제거한다. 아치문·현관·꽃상자·둥근 다락창은 남긴다.
- 책 밖 덩굴/꽃과 뒤쪽 구름 덩어리·중복 별은 제거한다. 책 위에는 작은 구름 2개, 나무 7그루, 꽃 12개, 소수 빛가루만 남긴다. idle 새 렌더/타이머/리스너 없음.
- 시각 검사는 PC·모바일 한 묶음으로 시행하고, 결함이 있으면 일괄 수정 후 한 번만 추가 확인한다. 기존 Impeccable context 설치 누락은 재시도하지 않는다.

### Task 1: 책 위 풍경과 주변 장식 절제

**Files:** Modify apps/front/app/book-model.ts, apps/front/app/book-atmosphere.ts. Read apps/front/app/book-atmosphere.test.ts, book-world.ts. Record tasks/todo.md.
**Interfaces:** createBookModel(BookPalette): THREE.Group 및 createBookAtmosphere(BookPalette): { group, update(entry) } 유지. 성문 위치 (1.4, 1.1, -0.53) 유지.
- [x] 작은 집·세 첨탑 성·드문 조경으로 정리했다. PC/모바일 첫 검사 후 회색에 치우친 성 지붕색만 부드러운 파란색으로 보정했다.
**Acceptance criteria:** PC/모바일에서 건물 위계와 책장이 읽히고 CTA를 가리지 않는다. 명시한 장식 수와 제거 항목 반영, 이전 모델보다 render/triangle 수 감소, 모든 geometry 좌표 유한.
**Verification:** 실제 PC/모바일 캡처 일괄 확인, 이전 snapshot과 모델 통계 비교. 기존 분위기 테스트로 진입·취소·progress 중복 갱신 방지 확인.

### Task 2: 최종 동작과 자원 검증

**Files:** Existing frontend suite, tasks/todo.md, 임시 /tmp 검증 산출물.
**Interfaces:** 기존 CTA 진입·Escape·reduced motion·BookWorld.dispose 및 개발 서버 5501/5502 유지.
- [x] frontend ci:all·foreground lint·실제 버튼 전환과 GPU 자원 해제 검증을 완료했다.
**Acceptance criteria:** lint/types/tests/build 성공, 가로 넘침·runtime exception 0, idle 추가 draw 0, 반복 이탈 때 context/buffer 해제, 실제 API 쓰기 0.
**Verification:** npx --yes pnpm@10.26.2 front ci:all, npm run lint, git diff --check. 기존 QA helper로 레이아웃과 진입/취소·6회 이동 계측. 사용한 QA 브라우저만 종료하고 개발 서버는 유지한다.

## Quieter storybook verification — 2026-09-17

- 성 첨탑 7→3개, 깃발 2→1개, 집 크기 0.8배와 단순한 지붕으로 정리했다. 책 밖 덩굴·꽃·뒤쪽 구름 덩어리·중복 금빛 별·표지 금속 장식은 제거했다. 나무 12→7그루, 책 위 꽃 28→12개, 진입 별/빛가루 25→11개로 줄이고 부드러운 파란 지붕과 초록 집 지붕을 유지했다.
- 책 종이·중앙 접힘·강/다리·두 갈래 길·문/현관/꽃상자는 유지했다. PC/모바일 캡처에서 책의 여백과 작은 집/성의 위계를 확인했다. 첫 검사에서 지붕이 회색에 치우친 점만 수정하고 마지막 확인을 마쳤다. /tmp/nerd-quieter-desktop.png, /tmp/nerd-quieter-mobile.png.
- 모델 통계: render 대상 108→89, 삼각형 92,597→54,461(약 41% 감소), 유한하지 않은 geometry 좌표 0. /tmp/nerd-quieter-model-report.json. 로컬 생성 시간 표본은 더 빨라지지 않았으므로 FPS·로딩 속도 향상을 단정하지 않는다. 마지막 색상 변경은 geometry 통계에 영향이 없다.
- 1440·768·390·320 너비에서 가로 넘침 0, canvas 1개, CTA 높이 56px 및 화면 내 노출 확인. 실제 진입·Escape 취소·reduced motion·홈/서재 6회 반복 통과. runtime exception/API 쓰기 0, idle 700ms draw 0. context 14/14 해제, Buffer 3,738/3,738·VertexArray 2,268/2,268 삭제. 색상 보정 전 검사이며 이후 lifecycle/geometry 변화는 없다. /tmp/nerd-quieter-qa-report.json.
- 마지막 소스 수정 후 frontend ci:all exit 0: lint/types/stubs/health-path·19 files/125 tests·production build. foreground npm run lint와 git diff --check exit 0. 개발 서버 5501/5502는 유지하며 main의 미커밋 작업으로 남겼다.

---

# 책 주변 동화 풍경과 진입 빛가루 Implementation Plan — 2026-09-17

> **For implementers:** 승인된 주변 장식을 추가하고 기존 진입 progress에 빛가루를 연결한다.

**Goal:** 책 뒤 낮은 구름, 오른쪽/아래 덩굴과 꽃, 성 주변의 별·빛가루로 책 속 세계가 주변으로 이어지는 느낌을 만든다.
**Architecture:** 정적 책 모델과 분리한 book-atmosphere.ts가 주변 geometry와 빛가루 update(entry)를 소유한다. book-world.ts가 group을 기존 scene에 연결하고 기존 render에서만 progress를 전달한다. 기존 scene dispose가 모든 geometry/material/InstancedMesh를 해제한다.
**Tech Stack:** 기존 Three.js·TypeScript·Vitest. 외부 asset·새 package·추가 animation loop 없음.
**Spec:** 사용자에게 제안한 네 항목(뒤쪽 구름, 오른쪽/아래 덩굴·꽃, 성 주변 별·빛가루, 버튼 진입 때 성문으로 모임)에 대한 '진행해줘' 승인.

## Global Constraints

- main의 미커밋 성/책 개선을 보존한다. 이번 추가 변경은 홈 3D 주변 장식에 한정한다. Git push/PR/배포·DB/API 수정 없음.
- 왼쪽 문구/CTA의 여백을 유지하고 장식은 책 주변에 집중한다. 장식은 기존 aria-hidden canvas 안에만 추가한다.
- 1450ms 진입과 카메라·라우팅·Escape·reduced motion을 유지한다. idle/hidden 상태에서 새 렌더·타이머·리스너가 생기지 않는다.
- 반복 구름·잎·꽃·빛가루는 공유 geometry와 InstancedMesh를 사용한다. 움직이는 장식은 shadow를 만들지 않아 고정 shadow map을 다시 그리지 않는다.
- focal moment는 책 주변 빛가루가 기존 카메라와 함께 성문으로 모이는 순간이다. entry=0은 정지, 취소는 원위치, 진입 후반에 작아지며 사라진다. 프레임별 heap 할당을 피한다.
- 시각 검사는 PC/모바일을 묶어 한 차례, 결함 수정 후 최대 한 차례 확인한다. 기존 Impeccable context 설치 누락은 재시도/수리하지 않는다.

### Task 1: 주변 장식 및 진입 연출

**Files:** Create apps/front/app/book-atmosphere.ts, book-atmosphere.test.ts; Modify apps/front/app/book-world.ts. Read book-model.ts, book-camera.ts, HomeWorld.tsx. 기존 book-model.ts의 현재 작업은 유지한다.
**Interfaces:** createBookAtmosphere(BookPalette): { group: THREE.Group; update(entry: number): void }. book-world는 book.add(group) 후 기존 material 등록/dispose를 재사용한다.
- [x] 책을 둘러싼 낮은 구름·덩굴·꽃과 성문으로 수렴하는 별/빛가루를 구현했다.
**Acceptance criteria:** 책과 성이 계속 주인공이고 좌측 UI를 가리지 않는다. entry 값에 따른 결정적 위치, 유한 좌표, 취소 원복, 같은 progress에서 불필요한 GPU buffer 갱신 없음.
**Verification:** Vitest에서 진입 수렴·끝 상태·취소 동일성·입력 경계·동일 progress 갱신 방지를 확인. 실제 PC/모바일 시각 검사 및 모델 draw/triangle 통계.

### Task 2: 왼쪽 주인공 집 보강

**Files:** Modify apps/front/app/book-model.ts의 cottage 및 인접 나무 배치. 기존 성·책/주변 장식·API는 유지한다.
**Interfaces:** createBookModel(BookPalette): THREE.Group 유지. 기존 box/column/archedDoor/material/instancing helper를 사용해 큰 박공 지붕과 낮은 별채·다락창·현관·꽃상자를 만든다.
- [x] 큰 박공 지붕·별채·다락창·현관·꽃상자를 추가하고 PC/모바일에서 성과 균형을 확인했다.
**Acceptance criteria:** 사용자의 22:01:30 스크린샷보다 존재감 있는 집, 여러 지붕/따뜻한 창/꽃상자/현관을 PC·모바일에서 확인. 성과 집의 역할 차이와 기존 책 위 길 유지, 인접 나무가 주된 정면을 가리지 않음.
**Verification:** 변경 후 PC/모바일 일괄 시각 검사, 모델 finite 좌표·draw/triangle 수 및 frontend ci:all 재확인. 새 애니메이션/리스너/타이머는 추가하지 않는다.

### Task 3: 회귀·자원 검증

**Files:** tasks/todo.md 및 임시 /tmp/nerd-atmosphere-* QA 산출물. Existing frontend suite.
**Interfaces:** 기존 버튼·Escape·reduced motion·BookWorld.dispose 유지. 테스트 브라우저의 합성 로그인 상태만 사용하고 실제 API 쓰기는 하지 않는다.
- [x] frontend ci:all/foreground lint와 실제 진입·idle·반복 이탈 검증을 완료했다.
**Acceptance criteria:** lint/types/tests/build 통과, PC/모바일 overflow 0·CTA 노출, idle draw 0, 이탈 시 canvas 및 WebGL context/buffer 해제, runtime exception 0.
**Verification:** frontend ci:all, npm run lint, git diff --check. 기존 QA helper를 이번 task session에 맞춰 재사용해 실제 화면·진입 프레임·GPU 자원 계측. 개발 서버는 유지하고 이번 QA 브라우저만 종료한다.

## Surroundings and cottage verification — 2026-09-17

- 책 뒤 구름, 오른쪽/아래 덩굴·꽃, 별·빛가루를 추가했다. 빛가루는 기존 entry progress에만 반응하고 성문으로 모인 뒤 사라진다. 동일 progress에서 instance buffer 갱신을 생략하며 취소 시 원래 위치로 돌아온다. 추가 animation loop·timer·listener는 없다.
- 사용자 후속 요청에 맞춰 왼쪽 집을 확대하고 별채·박공 지붕·둥근 다락창·돌출창·현관·꽃상자·굴뚝을 추가했다. 정면을 가리던 나무 한 그루의 배치를 조정했다. PC 1440×900·모바일 390×844 캡처에서 성과 집의 균형 및 문구/버튼 노출을 확인했다.
- 집 보강 전후 모델만 비교하면 render 대상 75→108, 삼각형 73,933→92,597, 생성 중앙값 9.10→10.89ms다. 장식 증가에 따른 비용이 있으므로 성능 향상을 주장하지 않는다. 전체 모델 경계는 동일하며 NaN/Infinity 좌표 0이다. 근거: /tmp/nerd-cottage-model-report.json.
- 주변 장식 반영 후 1440·768·390·320 너비에서 overflow 0·canvas 1·CTA 높이 56px 이상을 확인했다. 집 보강 후 실제 진입·Escape·reduced motion을 다시 확인하고 홈/서재 6회 반복에서 runtime exception 0, API 쓰기 0, idle 700ms 추가 draw 0을 확인했다. WebGL context 14/14 해제, Buffer 4,746/4,746·VertexArray 2,730/2,730 삭제. Three 내부 LUT 자원은 context loss로 반환되는 항목을 함께 확인했다.
- 최종 source 변경 후 frontend ci:all exit 0: lint/types/stubs/health-path·19 files/125 tests·production build. foreground npm run lint 및 git diff --check exit 0. frontend 5502/backend 5501 listener를 확인했다. main의 미커밋 변경으로 유지하며 PR/push/DB 변경은 하지 않았다.
- 근거: /tmp/nerd-atmosphere-before-cottage-qa-report.json(전체 viewport), /tmp/nerd-atmosphere-qa-report.json(최종 회귀), /tmp/nerd-cottage-{desktop,mobile}.png, /tmp/nerd-atmosphere-entry.png. 임시 helper·캡처는 저장소 밖에 있다.

---

# 홈 3D 동화 왕국 디테일 Implementation Plan — 2026-09-17

> **For implementers:** main 최신화 후 기존 홈의 책·성 모델을 보강하고 실제 브라우저와 frontend 검사로 확인한다.

**Goal:** 펼친 책 위에 높은 파란 첨탑·크림색 성벽·금빛 장식의 동화 왕국이 솟아난 느낌을 만든다.
**Architecture:** 기존 createBookModel의 procedural geometry와 프로젝트 팔레트를 재사용한다. 성의 높이와 지붕 계층·창문·성문을 보강하고 책 위 꽃밭·소품·책갈피를 추가한다. 반복 geometry/material은 기존 sphere instancing을 확장해 묶고 기존 BookWorld dispose 경로를 유지한다.
**Tech Stack:** Three.js 0.186.0·기존 Next/React·TypeScript. 신규 패키지·모델/텍스처 다운로드·외부 데이터 쓰기 없음.
**Spec:** 사용자 요청 — main 이동/pull 후 홈의 3D 동화책을 더 꾸미고 디즈니 성과 비슷한 분위기를 적용한다. 공식 성의 파란 지붕·크림색 벽·금색 장식과 현재 화면을 시각 기준으로 삼는다.

## Global Constraints

- main에서 작업한다. main push·새 PR·배포는 이번 요청 범위에 없다. 현재 main은 15ef3d3이며 pull --ff-only 완료.
- 홈의 문구·CTA·로그인/동화 경로·1450ms 진입·Escape·reduced motion·기존 카메라 성문 좌표를 보존한다. DB/서재/리더 수정 없음.
- 신규 상시 animation loop·타이머·이벤트 리스너를 추가하지 않는다. 반복 장식은 공유 geometry/material과 InstancedMesh로 제한한다. 기존 dispose에서 모든 GPU 자원이 해제되어야 한다.
- 현재 크림·청록 책의 정체성을 유지하고 장식은 책 위에 한정한다. 기존 3D fallback 유지. PC·모바일 CTA와 텍스트를 가리지 않는다.
- Impeccable context 도구는 이번 세션에서 설치 파일 누락으로 실패한 사실이 있어 재실행하지 않는다. 현행 코드·실제 홈 화면을 기준으로 작업한다.

### Task 1: 책 위 왕국 모델 보강

**Files:** Modify apps/front/app/book-model.ts. Read book-world.ts, book-camera.ts, HomeWorld.tsx, HomeWorld.module.css, globals.css. 필요한 구도 수정만 기존 home CSS/camera에 한정하며 변경 시 해당 검증을 추가한다.
**Interfaces:** createBookModel(BookPalette): THREE.Group 계약 유지. shared geometry의 월드 변환·재질·shadow 속성을 보존해 InstancedMesh로 묶는다.
- [x] 여러 높이의 파란 첨탑, 황금 장식, 성문·창문·시계, 초록 꽃밭·작은 소품·책갈피를 완성했다.
**Acceptance criteria:** 성이 여러 층의 뚜렷한 실루엣을 갖고 책/종이 두께가 유지된다. 데스크톱·모바일에서 왕국과 CTA가 읽히며 진입 시 성문 방향이 유지된다. 반복 메시로 인한 draw call 증가를 제한한다.
**Verification:** 수정 전후 모델 geometry/object/triangle 통계와 생성 시간 비교, 실제 PC·모바일 스크린샷을 한 번에 검토. 필요한 결함을 한 번에 수정하고 추가 확인은 최대 한 차례.

### Task 2: 회귀·성능 검증

**Files:** tasks/todo.md 및 임시 /tmp/nerd-castle-* QA 산출물. Test existing frontend suite 및 브라우저.
**Interfaces:** 기존 HomeWorld lifecycle·BookWorld.dispose 및 두 CTA 동작 보존. 모델 변경에는 구현을 복제하는 unit test를 추가하지 않는다.
- [x] frontend ci:all과 최종 foreground lint를 통과하고 실제 진입·취소·reduced motion·반복 이탈 자원 정리를 확인했다.
**Acceptance criteria:** lint/types/tests/build 통과, 런타임 오류·가로 넘침 없음, 장식 추가 후 idle 상태에서 렌더 반복 없음, 이탈 후 canvas 및 GPU 자원 해제. 사용자가 보던 개발 서버는 유지한다.
**Verification:** frontend ci:all, npm run lint, git diff --check, 브라우저 화면·WebGL 생성/삭제/idle draw 계측·진입 회귀. 이번에 연 QA 브라우저/임시 서버만 정리한다.


## Home castle verification — 2026-09-17

- main 15ef3d3으로 이동/pull 완료. 소스 수정은 book-model.ts 한 파일이며 카메라·라우팅·effect·글로벌 토큰은 유지했다. 7개 파란 첨탑·성문/계단·시계·황금 깃발/별·꽃밭/버섯·책갈피·표지 금속 장식을 추가했다.
- 최종 모델: render 대상 104→75(약 28% 감소), 삼각형 65,700→73,933. 반복 성벽/창문/첨탑을 geometry·재질·shadow 속성별로 묶고, 작은 꽃잎은 저해상도 공유 geometry를 사용했다. 모델 생성 중앙값은 로컬 반복 측정 7.35→7.60ms로 비슷한 범위이며 실제 기기의 FPS 향상을 단정하지 않는다. NaN/Infinity 좌표 0.
- UI: 1440·768·390·320 너비에서 renderer ready, canvas 1개, 가로 넘침 0, 두 CTA 최소 높이 56px 및 화면 내 노출. PC/모바일 실제 캡처에서 새 성의 실루엣·책 종이 두께·텍스트/CTA 배치를 확인했다. 로그인 상태는 테스트 브라우저 fixture이며 실제 인증/세션 쓰기 0회.
- 회귀/자원: 실제 서재 진입, Escape 취소, reduced motion 이동 통과. idle 700ms 동안 추가 draw 0. 최초 진입 후 홈/서재 6회 반복에서 runtime exception 0, 이탈 canvas 0, WebGL context 14개 모두 context loss로 해제, Buffer 3,206개·VertexArray 1,820개 모두 삭제. Three 내부 LUT의 일부 native 자원은 개별 delete 대신 context loss로 함께 반환되므로 context 종료도 별도로 계측했다.
- 환경 문제: 최초 전환 검사에서 서재 데이터 조회가 실패했다. frontend health 200 및 5501 listener 부재·직접 연결 거부를 확인했고, 기존 backend 종료 로그가 없어 종료 원인은 확정하지 않았다. 프로젝트 back dev로 다시 실행 후 같은 실제 전환이 정상 동작했다. timeout 증가·제품 코드 우회·DB 변경은 하지 않았다. Redis 미실행 경고는 기존 backend가 축소 모드로 처리하며 이번 범위에서 설정은 바꾸지 않았다.
- 검사: frontend ci:all exit 0 — lint/types/stubs/health-path, 18 files/121 tests, production build. 최종 source 변경 후 foreground npm run lint exit 0, git diff --check 통과. 원래 frontend 5502와 복구한 backend 5501은 유지한다.
- 근거: /tmp/nerd-castle-model-report.json, /tmp/nerd-castle-qa-server-unavailable.json(최초 화면 검사 및 환경 실패 보존), /tmp/nerd-castle-qa-report.json(남은 회귀 검사), /tmp/nerd-castle-final-{1440,390}.png. 검증 helper·스크린샷은 저장소 밖에 있다.

---

# 표지·서재 개선 리팩토링 및 PR Implementation Plan — 2026-09-17

> **For implementers:** 현재 변경 범위의 불필요한 코드를 정리하고 최신 main과 통합 후 PR을 게시한다.

**Goal:** 표지 API·WebP 연결·동화별 책/UI·서재 첫 진입 개선을 읽기 쉬운 변경으로 정리하고 검증 가능한 PR을 만든다.
**Architecture:** 현재 변경의 호출자와 상태 흐름을 직접 검토한 뒤, 사용되지 않는 skeleton CSS와 중복 표지 fit 조건을 정리한다. 검증된 변경을 commit하고 최신 origin/main을 merge한 뒤 feature branch를 push하여 PR을 생성한다.
**Tech Stack:** 기존 React·Next.js·NestJS·contracts·Git/GitHub CLI 및 pnpm 검사.
**Spec:** 사용자 요청 — 리팩토링 후 PR. 현재 작업 전체를 대상으로 하며 별도 migration은 필요 없다는 질문에 답변 완료.

## Global Constraints

- 기능·색상·책 비율·WebP 키·개인화 소유자 검사를 유지한다. 관련 없는 모듈/패키지를 리팩토링하지 않는다.
- 기존 PR #59는 merged다. 새 PR은 main 대상이며 강제 push/main push/PR merge/배포는 수행하지 않는다.
- shared DB/S3 데이터 반영은 이미 완료했다. env·원본 이미지·임시 실행 helper·서명 URL은 staging하지 않는다.
- public API는 기존 DB 필드 재사용이며 schema migration이 없다. PR에 기존 함수 재사용·데이터 적용 상태·검증 결과를 명시한다.

### Task 1: 리뷰 기반 리팩토링

**Files:** 현재 diff의 backend story service/DTO/spec/contracts, frontend LibraryStoryList·StoryCover·StoryRoom·상세 shell·prefetch 호출자. Write는 apps/front/components/story/StoryCard.tsx, StoryCard.module.css, StoryDetailArtwork.tsx; 필요한 변경부 JSX 가독성 및 tasks/todo.md에 한정.
**Interfaces:** 공개 컴포넌트 props와 API 계약 유지. originalCover class 하나로 원본 이미지의 CSS fit을 제어하고 없어진 skeleton 전용 CSS는 제거한다.
- [x] source와 전이적 호출자를 검토해 동작 보존 리팩토링을 수행하고 프로젝트 검사로 확인했다.
**Acceptance criteria:** 기존 테스트·시각적 결과·개인화 우선순위 동일, 불필요한 클래스/분기 제거, source 변경 범위와 PR 설명 일치.
**Verification:** frontend/backend ci:all, 실제 표지/첫 진입의 기존 QA 근거와 리팩토링 이후 확인, foreground lint와 git diff --check.

### Task 2: main 통합 및 PR 게시

**Files:** 승인된 변경 파일·tasks/todo.md. Git branch feat/story-cover-images.
**Interfaces:** origin/main fetch/merge, feature push, GitHub PR base=main. PR 제목·본문은 최종 구현과 검증을 설명한다.
- [x] 최신 main과 통합하고 검증된 변경을 push하여 새 PR URL과 병합/CI 상태를 확인했다.
**Acceptance criteria:** PR에서 이번 표지·서재 작업만 검토 가능, secrets 미포함, GitHub head SHA 일치 및 main 충돌 여부 확인.
**Verification:** staged paths/diff 확인, main ancestor 및 diff, push 후 gh pr view/checks, 원격 CI 상태 확인. 임시 5602 서버/QA 브라우저는 종료하고 개발 서버는 유지한다.

## Refactor verification — 2026-09-17

- StoryCover props를 명명하고 원본 이미지 fit을 부모 class 한 곳에서 처리했다. 모든 값이 neutral이던 variantTone map과 사용처가 없어진 blankCover CSS를 제거했다. 공개 계약·개인화 우선순위·기존 소유자 검사는 유지한다.
- 최종 frontend ci:all exit 0: lint·types·stubs·health-path·18 files/121 tests·production build. 최종 backend ci:all exit 0: lint·types·stubs·33 suites/313 unit tests·9 suites/66 E2E tests·build. 마지막 source 수정 이후 양쪽 npm run lint도 foreground에서 exit 0이다.
- 전체 backend 검사 중 발견한 기존 응답 비교 테스트의 1ms timestamp 차이는 해당 테스트의 toISOString 반환값을 고정해 제거했다. 운영 예외 처리 로직은 변경하지 않았다.
- 리팩토링 후 auth 응답을 보류한 실제 브라우저에서 제목/이미지 2개, skeleton 0개, SSR h2 2개를 확인했다. 원본 fit은 모두 contain이고 비율은 잭 2:3·빨간 모자 1:1과 일치했다. 이전 운영 빌드 진입·개인화·접근성 검증 결과도 유지한다.
- origin/main fba9d81을 fast-forward 반영했다. 이전 HEAD와 source tree가 같아 재검증이 필요한 통합 변경은 없었다. 검증용 5602 서버와 이번 QA 브라우저를 종료했으며 기존 개발 서버는 유지했다.
- PR: https://github.com/kon6443/nerd-back/pull/60 — main 대상 OPEN, 게시 시 MERGEABLE. 구현 commit 1017ea7의 로컬·원격·PR head SHA 일치를 확인했다. 변경 파일 23개와 staged diff를 검토했으며 env·이미지·서명 URL은 포함하지 않았다.
- GitHub의 frontend/backend CI 실행을 확인했다. 게시 시점에는 진행 중이며 최종 결과는 PR의 Checks에서 확인할 수 있다. DB migration 불필요·공용 표지 데이터 적용 상태·별도 DB의 반영 방법을 PR 본문에 명시했다.

---

# 서재 첫 진입 실제 동화 표시 Implementation Plan — 2026-09-17

> **For implementers:** 한 권 스켈레톤에서 두 권으로 바뀌는 단계와 공개 목록의 인증 대기를 제거한다.

**Goal:** 서재가 표시되는 첫 렌더부터 서버가 조회한 실제 두 동화·기본 WebP 표지를 보여주고, 개인화는 같은 카드 안에서 적용한다.
**Architecture:** /library/loading.tsx의 route fallback을 제거하여 데이터 준비 전에는 기존 화면을 유지한다. LibraryStoryList는 auth/세션 대기와 무관하게 전달받은 공개 stories를 렌더한다. 홈의 서재 CTA와 상단 서재 링크만 full-route prefetch하여 실제 이동 전 목록을 준비한다.
**Tech Stack:** 기존 Next.js 16.3.3 App Router·React 19.2.8·pnpm 10.26.2. 추가 캐시·타이머·의존성 없음.
**Spec:** 사용자 2026-09-17 21:07:42 스크린샷 — 서재 진입 시 한 권 스켈레톤 후 두 동화 표시 대신 바로 실제 두 동화를 표시해 달라는 요청.

## Global Constraints

- 기존 미커밋 표지·색상·WebP 작업을 유지한다. DB/S3/API/인증 판정은 변경하지 않는다.
- 공개 목록의 서버 조회는 유지한다. 동화 두 개를 하드코딩하거나 개인화 정보를 공용 캐시에 넣지 않는다.
- 현재 사용자 소유 썸네일만 사용하는 검사와 이탈 시 async 결과 무시를 보존한다. 인증/개인화 실패 시에도 기본 표지는 보여야 한다.
- 서재 상세와 리더 loading은 유지한다. 홈페이지 진입 연출·취소·reduced motion을 보존한다.
- 새로고침·느린 네트워크에서 서버 데이터 수신 시간은 필요하다. prefetch는 production에서만 작동하므로 운영 빌드로 검증하고 즉시 표시를 네트워크 무관한 보장으로 표현하지 않는다.

### Task 1: 공개 목록의 중간 skeleton 제거

**Files:** Modify apps/front/app/(demo)/library/LibraryStoryList.tsx, LibraryShell.tsx, page.tsx; Delete apps/front/app/(demo)/library/loading.tsx. 사용처가 없어지는 StoryListSkeleton과 그 전용 import/state 제거.
**Interfaces:** LibraryStoryList(stories, isCreateMode)는 unknown/guest/authenticated 어떤 상태에서도 같은 공개 카드 목록을 반환한다. 개인화 조회 결과만 기존 소유자 검사 후 교체한다.
- [x] route fallback과 auth/개인화 대기로 목록을 가리는 분기를 제거하여 처음부터 실제 공개 동화를 렌더한다.
**Acceptance criteria:** 인증 조회를 지연해도 두 동화 제목·표지·링크가 표시되고 skeleton이 없다. 로그인 세션 조회 지연/실패 시 기본 표지가 유지되고, 다른 계정/로그아웃에서는 이전 사용자 표지가 제거된다.
**Verification:** 수정 전 auth 응답 보류 브라우저에서 제목 0개/스켈레톤 2개 재현. 수정 후 같은 보류 조건에서 제목/기본 표지 2개, SSR HTML 실제 h2/이미지 존재, 개인화 교체·계정 변경 fixture.

### Task 2: 진입 경로 미리 준비·검증

**Files:** Modify apps/front/app/page.tsx, apps/front/components/layout/AuthCta.tsx, AppHeader.tsx; tasks/todo.md.
**Interfaces:** 기존 Next Link의 prefetch=true를 홈의 /library 및 /library?mode=create CTA, 상단 서재 링크에만 전달한다. AuthCta에 optional prefetch prop으로 홈 호출 의도를 전달한다.
- [x] 주요 서재 링크의 full-route prefetch를 적용하고 build·실제 진입/새로고침을 검증했다.
**Acceptance criteria:** production에서 클릭 전 RSC prefetch 확인, 홈 진입 후 실제 두 카드 표시까지 한 권 skeleton 0회, 모바일 가로 넘침 없음, 버튼 목적지/기존 진입 연출·취소 유지.
**Verification:** frontend ci:all 및 foreground npm run lint, git diff --check. 기존 서버는 유지하고 별도 임시 production 서버와 QA 브라우저만 종료한다. desktop/mobile navigation·slow auth·personalization fixture·새로고침 검사.

## First-entry verification — 2026-09-17

- 원인: route loading은 한 권 기본 skeleton, LibraryStoryList는 SSR의 unknown auth 및 개인화 응답 대기에서 다시 skeleton을 반환했다. 실제 stories를 이미 받아도 공개 제목/이미지를 표시하지 않았다.
- 수정 전후: 동일한 auth 응답 보류 조건에서 제목 0/이미지 0/skeleton 목록 1 → 제목 2/이미지 2/skeleton 0. 서버 HTML의 실제 h2도 0 → 2다.
- 운영 빌드: 별도 5602 서버에서 /library와 /library?mode=create의 클릭 전 RSC prefetch HTTP 200을 확인했다. 1440/390 화면의 홈 진입·직접 새로고침 모두 첫 서재 DOM부터 실제 제목 2개/skeleton 0개이며, 관찰 중 한 권 단계는 없었다. 가로 넘침 0, 홈 이탈 canvas 0, runtime exception 0.
- 기능: Escape 진입 취소·reduced motion 이동 유지. 개인화 응답 보류 중 기본 WebP 유지, 완료 후 같은 카드 DOM에서 썸네일 교체, 다른 계정의 세션 조회 500과 로그아웃 후 기본 표지 유지. 실제 auth/세션 쓰기 0회.
- 검증: frontend ci:all exit 0 — 18 files/121 tests·lint·types·stubs·health-path·production build. foreground npm run lint exit 0. 로컬 Next 16.3.3의 navigation guide와 Link prefetch 문서를 적용했으며, 네트워크 수신 자체가 생략되는 것은 아니다.
- 자료: /tmp/nerd-library-first-{before,after}.json, /tmp/nerd-library-entry-report.json, /tmp/nerd-library-entry-{1440,390}.png. 운영 테스트 fixture는 별도 브라우저에서만 적용했다.

---

# 표지 비율·동화별 책과 UI 색상 Implementation Plan — 2026-09-17

> **For implementers:** 사용자 스크린샷의 빈 표지 여백을 제거하고 기존 서재·소개 UI 안에서 두 그림의 비율과 팔레트를 적용한다.

**Goal:** 잭과 콩나무는 2:3 세로형, 빨간 모자는 1:1 정사각형 책으로 표시하고 책등·페이지 가장자리·카드·버튼·소개 화면을 표지와 어울리게 만든다. 추가 요청에 따라 기존 WebP 변환 함수를 재사용해 표지 전송량도 줄인다.
**Architecture:** StoryCover의 기존 imageFit 구분으로 원본 표지에만 해당 동화의 CSS 비율을 사용한다. StoryRoom.module.css의 동화별 scoped 변수는 목록 li와 상세 main에서 공유한다. 목록의 고정 높이 표지 전시 영역을 skeleton도 사용해 로딩 시 텍스트·버튼 위치를 보존한다.
**Tech Stack:** 기존 Next.js 16.3.3·React·CSS Modules·pnpm 10.26.2. 새 라이브러리·상태·effect·canvas 없음.
**Spec:** 사용자 2026-09-17 20:52:48 스크린샷 — 책 표지에 맞는 책 사이즈와 표지 색상에 어울리는 책/UI 요청.

## Global Constraints

- 기존 S3/DB 표지 연결과 모든 미커밋 작업을 유지한다. 추가 최적화 요청에 한해 두 표지의 WebP 복사본과 DB 표지 키를 갱신한다. 기존 PNG는 보존하며 API·다른 DB 필드는 추가 변경하지 않는다.
- 서재 목록·동화 소개에 범위를 한정한다. 홈·촬영·로그인·리더 및 공통 GNB의 색상은 유지한다.
- 두 첨부 표지의 비율은 1024:1536, 1254:1254로 이미 확인했다. 원본 전체를 표시하고 이미지 로드 전부터 같은 공간을 확보한다.
- 개인화 썸네일의 우선순위·소유자 검사·기존 cover 맞춤(목록 4:3, 상세 3:4)과 링크를 보존한다. 모바일 가로 넘침 0, 주요 터치 타깃 56px, 본문·버튼 대비 4.5:1, 키보드 focus와 reduced motion을 검증한다.
- 기존 파란 CTA 기본 규칙은 다른 화면에 유지한다. 요청에 따라 해당 두 동화 표면 안에서만 진한 숲 초록·붉은 갈색을 적용한다.
- Impeccable context.mjs는 설치된 scripts/lib/target-args.mjs 누락으로 실행 실패했다. skill 설치 복구는 범위 밖이며 사용자 스크린샷·현행 CSS/컴포넌트를 시각 기준으로 삼는다.

### Task 1: 원본 비율 책과 목록 배치

**Files:** Modify apps/front/components/story/StoryCard.tsx, StoryCard.module.css; apps/front/app/(demo)/library/LibraryShell.tsx, LibraryStoryList.tsx; apps/front/components/layout/StoryRoom.module.css.
**Interfaces:** StoryCover의 imageFit='contain'은 --story-original-ratio를 사용한다. 목록 coverStage는 실제·skeleton 공용; theme은 li의 data-story slug로 결정한다. 기존 개인화 imageFit='cover'는 4:3 유지.
- [x] 책 면을 원본 비율로 맞추고 여백 없는 표지·어울리는 책등·종이 두께와 정렬된 카드/버튼을 표시했다.
**Acceptance criteria:** 두 책의 렌더링 width/height와 원본 비율 일치, 제목/그림 자름·늘림 없음, 개인화/표지 없음 fallback 유지, 카드별 CTA 하단 정렬 및 skeleton 전시 높이 일치.
**Verification:** 1440·768·390·320 viewport의 DOM 비율/overflow/버튼 높이 검사, PC·모바일 캡처 확인, 개인화 fixture와 로그아웃 회귀.

### Task 2: 동화별 소개 팔레트·최종 검증

**Files:** Modify apps/front/components/layout/StoryRoom.tsx, StoryRoom.module.css; apps/front/app/(demo)/library/[slug]/StoryDetailShell.tsx, StoryDetail.module.css, page.tsx; tasks/todo.md.
**Interfaces:** StoryRoom.storySlug?: string, StoryDetailShell.storySlug?: string로 scoped 색/비율 변수를 전달한다. 서재는 공통 크림·숲 색상, 두 상세는 각 동화의 팔레트 사용.
- [x] 상세 책 비율과 표지별 UI 색상을 연결하고 프로젝트 검사 및 실제 UI 검증을 완료했다.
**Acceptance criteria:** 동화별 책·제목·CTA·보조 텍스트·focus 색 조화, 글자/버튼 대비 통과, 모바일/키보드/기존 이동 유지, 화면 밖 글로벌 UI 변화 없음.
**Verification:** frontend ci:all, foreground npm run lint, git diff --check. 실제 두 상세·목록을 한 번에 검사하고 발견된 결함이 있으면 한 묶음 수정 후 확인 1회. CSS 중심 변경에 별도 구현 복제 단위 테스트를 만들지 않는다.

### Task 3: 기존 변환 함수로 표지 WebP 적용

**Files:** Read apps/back/src/modules/story-session/convertImageToWebp.ts 및 해당 spec. 임시 /tmp/nerd-cover-webp-{prepare,apply,verify}.mjs와 검증 manifest; 소스 로직·의존성 추가 없음.
**Interfaces:** 기존 convertImageToWebp(Buffer): Promise<Buffer>, sharp quality 85. 변환한 bytes의 hash를 포함하는 prod/templates/{slug}/cover-{hash}.webp 키를 S3에 추가하고 두 DB 행의 기존 PNG 키를 비교 갱신한다.
- [x] 기존 함수를 재사용해 원본 크기·비율을 보존한 WebP를 만들고, 용량·시각 품질·S3 다운로드·실제 API를 검증한 후 표시했다.
**Acceptance criteria:** 원본 두 PNG 및 기존 S3 오브젝트 보존, 새 파일 MIME image/webp, 해상도/비율 동일, 전송 bytes 감소, DB는 해당 두 cover_image_key만 변경, 개인화 변환 로직과 다른 콘텐츠 불변.
**Verification:** 기존 convertImageToWebp.spec.ts 실행, sharp metadata·bytes/hash 확인, 새 WebP 이미지 시각 확인, DB transaction 전후 콘텐츠 counts 및 새 키 재조회, 실제 API 이미지 HTTP 200·MIME/bytes/hash 일치와 최종 브라우저 회귀 검사.

## Shape, palette & WebP verification — 2026-09-17

- 비율/팔레트: 두 원본에 맞는 잭 2:3, 빨간 모자 1:1 CSS 비율을 이미지 로딩 전부터 확보한다. 책 면의 빈 띠가 제거되었고, 동화별 책등·가장자리·제목·카드·CTA·focus 색을 scoped 변수로 공유한다. 개인화 이미지는 목록 4:3/상세 3:4와 기존 cover 맞춤을 유지했다. 추가 state/effect/observer/canvas는 없다.
- UI 근거: Chromium 1440·768·390·320 너비에서 목록·두 상세 12개 조합의 원본/렌더 비율 일치(오차 0.001 미만), 가로 넘침 0, CTA 높이 최소 56px 및 데스크톱 하단 정렬을 확인했다. PC·모바일 실제 viewport 캡처에서 제목·그림·종이 두께를 확인했다. 텍스트/버튼의 최소 실측 대비는 6.28:1. 키보드 focus-visible 3px 테마색 outline과 reduced-motion을 확인했다.
- QA 보정: 자동 검사의 reduced-motion 기대값이 0s로 잘못 고정되어 실패했다. globals.css가 0.01ms !important 정책을 적용하며 실제 값은 1e-05s임을 확인했다. 제품 코드는 그대로 두고 검증을 해당 정책과 일치시킨 뒤 남은 기능만 검사했다. 레이아웃 검사를 반복하지 않았다.
- 로딩/개인화: 목록 skeleton과 실제 coverStage 높이 모두 356px. fixture에서 개인화 썸네일 우선 표시, 목록 4:3/상세 3:4, 로그아웃 후 원본 2:3 복귀 통과. runtime exception 0, 실제 auth/세션 쓰기 0회.
- 최적화 원인/수정: 기존 표지는 원본 PNG를 unoptimized로 직접 표시해 합계 6,502,867 bytes가 필요했다. 기존 convertImageToWebp 함수(sharp quality 85)를 재사용했다. 원본 해상도를 유지하며 잭 3,171,373→392,856 bytes(87.61% 감소), 빨간 모자 3,331,494→517,610 bytes(84.46% 감소), 합계 약 86% 감소했다. 전송 시간 배수 향상을 단정하지 않는다.
- S3/DB: 새 키는 prod/templates/jack-and-beanstalk/cover-b4748985efa68b01.webp 및 prod/templates/red-riding-hood/cover-45013953ab26bba6.webp. 기존 PNG 오브젝트를 보존하고 id=2/3 cover_image_key만 이전 키 비교 조건과 transaction으로 갱신했다. 각 동화의 전체 페이지 7·등장인물 4·세션 4개는 동일하다. 실제 목록·상세 API와 이미지 GET HTTP 200, image/webp, 최적화 파일 SHA256 일치를 확인했다.
- 검사: 최종 frontend ci:all exit 0 — lint·types·stubs·health-path·18 files/121 tests·production build. 기존 WebP 변환 Jest 2 tests 통과. 최종 foreground npm run lint exit 0. 소스는 로컬 변경이며 새 PR/배포는 아직 수행하지 않았다.
- 근거: /tmp/nerd-cover-theme-report.json, /tmp/nerd-cover-theme-*.png, /tmp/nerd-cover-webp-{before,applied,api-report}.json. 임시 helper·원본·변환 이미지·서명 URL은 저장소 변경에 포함하지 않는다.

---

# 빨간 모자·잭과 콩나무 표지 연결 Implementation Plan — 2026-09-17

> **For implementers:** 첨부 원본 두 장을 기존 S3와 MySQL 표지 필드로 연결하고 실제 화면에서 확인한다.

**Goal:** 빨간 모자는 첨부 00-little-red-riding-hood-cover.png, 잭과 콩나무는 jack-and-the-beanstalk-cover.png를 기본 책 표지로 표시한다.
**Architecture:** 기존 story_templates.cover_image_key와 StoragePort를 재사용한다. 공개 동화 목록·상세 응답에 coverImageUrl을 추가해 조회 시 서명 URL을 만들고, frontend는 개인화 썸네일이 없을 때 이 URL을 사용한다. 원본 PNG는 콘텐츠 hash가 포함된 새 S3 키에 업로드하고 두 기존 DB 행의 표지 키만 트랜잭션으로 갱신한다.
**Tech Stack:** 기존 NestJS·TypeORM/MySQL·S3·Next.js·React·contracts·Jest/Vitest·pnpm 10.26.2. 새 dependency나 DB schema 없음.
**Spec:** 사용자 제공 이미지 2장을 DB에 저장하여 해당 동화의 책 표지로 사용한다는 요청.

## Global Constraints

- 현재 환경은 공용 MySQL 및 S3 prod/ prefix를 사용한다. DB에는 원본 binary/만료 URL 대신 반환된 오브젝트 키를 저장한다.
- 대상 slug는 red-riding-hood, jack-and-beanstalk 두 개뿐이다. 기존 키와 페이지·등장인물·세션 개수를 읽어 기록한 후 표지 키만 비교 갱신한다.
- 기존 원본 오브젝트를 덮어쓰거나 삭제하지 않는다. 전체 seed 스크립트는 하위 페이지·등장인물을 교체하므로 실행하지 않는다.
- 사용자 원본 그림과 제목을 자르지 않는다. 기본 표지는 contain으로 표시하며 기존 개인화 썸네일 우선순위·소유자 검사·책 입체 틀을 유지한다.
- 업로드·DB 변경은 검증된 소스와 구체적인 대상/이전 키/새 키가 준비된 뒤 실행한다. secrets·서명 URL·임시 데이터 작업 파일은 commit하지 않는다.

### Task 1: 공개 표지 URL 계약·조회

**Files:** Modify packages/contracts/src/story.ts; apps/back/src/modules/story/story.service.ts, dto/story-response.dto.ts, story.service.spec.ts; 필요한 API fixture apps/back/test/story.e2e-spec.ts 및 apps/front/lib/api/story.test.ts.
**Interfaces:** StorySummary.coverImageUrl: string | null (StoryDetail 상속). StoryService.toSummary(): Promise<StorySummary>, 기존 StoragePort.getPresignedUrl(key) 사용.
- [x] 목록·상세의 공개된 표지 키를 URL로 변환하고 빈 키/서명 실패는 null로 반환한다.
**Acceptance criteria:** 공개 조건과 응답 필드 보존, private/draft 조회 방지, URL 실패가 동화 조회 실패로 번지지 않음. 목록의 URL 발급은 Promise.all로 병렬 처리.
**Verification:** 계약/응답/조회 조건/키 없음/서명 실패에 대한 Jest 회귀 테스트, contracts와 backend lint·typecheck·tests·build.

### Task 2: 목록·소개 표지 표시

**Files:** Modify apps/front/app/(demo)/library/LibraryStoryList.tsx, [slug]/page.tsx; apps/front/components/story/StoryDetailArtwork.tsx, StoryCard.tsx, StoryCard.module.css.
**Interfaces:** StoryDetailArtwork에 coverImageUrl 전달; StoryCard/StoryCover.imageFit?: 'cover' | 'contain'. 기본 표지 URL은 nullish fallback이며 개인화 URL은 기존 우선순위 유지.
- [x] 새 기본 표지를 목록과 상세에 연결하고 두 비율의 원본을 잘리지 않게 표시한다.
**Acceptance criteria:** 빨간 모자/잭과 콩나무의 해당 이미지 표시, 다른 동화의 기본 표지·개인화 썸네일 유지, 기존 링크/키보드/모바일 폭 유지.
**Verification:** frontend ci:all; 실제 두 동화 목록·상세를 1440/390 너비에서 확인, 이미지 naturalWidth와 object-fit, 개인화/로그아웃 fixture 회귀 검사.

### Task 3: S3·DB 표지 반영

**Files:** 저장소 소스 외부 /tmp/nerd-cover-inspect.mjs, /tmp/nerd-cover-before.json, 업로드 실행 helper; 사용자 첨부 원본 두 파일.
**Interfaces:** 환경의 기존 S3 설정 및 MySQL 앱 계정. 새로운 키는 prod/templates/{slug}/cover-{sha256 앞 16자리}.png. SQL의 이전 cover_image_key 비교 조건으로 동시 변경 보호.
- [x] 원본 hash와 S3 업로드/다운로드 hash를 검증하고 두 표지 키를 한 트랜잭션으로 갱신한다.
**Acceptance criteria:** 정확히 두 행 갱신, 이전 키 복구 가능, 첨부 원본 byte 동일, DB 외 컬럼과 기존 콘텐츠/세션 개수 보존.
**Verification:** S3 GET sha256 일치, DB 재조회와 콘텐츠/세션 개수 비교, 실제 API 목록·상세에서 각 새 키와 유효한 이미지 URL 확인.

### Task 4: 전체 검증·정리

**Files:** 위 파일, tasks/todo.md, 검증 중 발견된 비결정적 timestamp 비교 테스트 apps/back/src/common/filters/http-exception.filter.spec.ts.
**Interfaces:** npx --yes pnpm@10.26.2 back ci:all / front ci:all, foreground npm run lint, git diff --check, 실제 로컬 UI.
- [x] 기존 오류 응답 비교 테스트의 실제 시각 1ms 차이를 고정 시각으로 바로잡고, 프로젝트 검사와 실화면 검증을 마쳤다.
**Acceptance criteria:** source·DB·스토리지·화면이 서로 일치하고 실제 적용 여부와 배포 상태를 구분해 보고한다.
**Verification:** frontend/backend 검사 exit 0, 실제 이미지 로드·에러 없음, diff check와 변경 파일 목록 확인. 현재 개발 서버 유지.

## Cover verification — 2026-09-17

- 계약/API: 구현 전 새 coverImageUrl 기대값 5개가 실패하고 기존 12개가 통과함을 확인했다. 구현 후 키 없음, URL 발급 실패의 개별 격리, 미공개/미존재 조회 제한과 HTTP 응답 회귀 검증이 통과했다.
- 프로젝트 검사: frontend ci:all exit 0 — lint·types·stubs·health-path·18 files/121 tests·production build. backend ci:all exit 0 — lint·types·stubs·33 unit suites/313 tests·9 E2E suites/66 tests·build. contracts build도 통과했다.
- 최종 foreground 검사: apps/front와 apps/back에서 각각 npm run lint exit 0, git diff --check 통과. 검증용 nerd-cover-qa 브라우저 세션은 종료했다.
- 검사 중 기존 HttpExceptionFilter 테스트가 두 호출의 실제 시각 차이(.349Z/.350Z)를 같은 값으로 기대하여 실패했다. 해당 테스트의 toISOString 반환만 고정해 결정적으로 비교하도록 수정했다. 제품 오류 처리 로직은 변경하지 않았다.
- 데이터: id=2 jack-and-beanstalk 및 id=3 red-riding-hood의 cover_image_key만 transaction으로 변경했다. 새 키는 각각 prod/templates/jack-and-beanstalk/cover-010e79e283f7b9f9.png, prod/templates/red-riding-hood/cover-6fbb8360fee1f378.png. 이전 templates/{slug}/page-1.png 오브젝트와 복구용 이전 키를 보존했다. 각 동화의 전체 페이지 7개·등장인물 4개·세션 4개는 동일하다.
- 원본: S3 GET 및 실제 API에서 발급한 URL GET 모두 HTTP 200/image/png. 잭 3,171,373 bytes, 빨간 모자 3,331,494 bytes의 SHA256이 사용자 첨부와 각각 일치한다. 변환·자르기 없이 원본 그대로 저장했다. API 상세의 본편 pageCount는 각각 5다.
- UI: Chromium 1440×900/390×844에서 서재·두 소개·제작 모드 소개 8개 조합을 확인했다. 해당 표지 키, naturalWidth 1024/1254, contain, 기존 링크와 가로 넘침 없음, runtime exception 0. 이미지 decode 완료 후 실제 viewport 캡처를 눈으로 확인했다. 모바일 소개의 전체 페이지 캡처에서만 표지가 가려지는 현상이 재현되어, 같은 화면의 viewport 캡처와 비교했다. 실제 viewport에서는 정상이며 이 캡처 현상을 제품 결함으로 처리하지 않았다.
- 개인화: 브라우저 fetch fixture로 목록·제작 상세의 개인화 썸네일 우선순위와 cover fit 유지, 로그아웃 후 DB 기본 표지 복귀를 확인했다. 실제 인증/세션 쓰기 0회. 기존 소유자 검사와 캐시 로직은 보존했다.
- 적용 범위: S3·공용 DB 반영 완료. API·frontend 소스는 feat/story-cover-images의 로컬 변경이며 배포/새 PR은 아직 수행하지 않았다. 개발 서버 5502/5501은 유지한다.
- 근거: /tmp/nerd-cover-{before,applied,api-report,ui-report}.json 및 /tmp/nerd-cover-viewport-*.png. 서명 URL·env·원본 이미지·QA helper는 저장소 변경에 포함하지 않는다.

---

# PR #58 초기 3D 비용·썸네일 캐시 개선 Implementation Plan — 2026-09-17

> **For implementers:** 승인된 두 성능 개선을 구현하고 회귀 검증을 완료한다.

**Goal:** 기존 3D 화면과 진입 연출을 유지하면서 초기 준비 비용을 줄이고 썸네일 프리로드 기록의 무제한 누적을 막는다.
**Architecture:** 모델 생성 한 번 안에서 동일 규격의 RoundedBoxGeometry와 나무 기둥 geometry를 공유한다. production에서 Three의 동기 shader 진단 조회를 비활성화하고 개발 중 검사는 유지한다. 기존 renderer의 소유권과 dispose를 유지한다. 프리로드 기록은 최근 사용 순서의 최대 128개 Map으로 제한하고 요청별 token으로 이전 실패와 새 요청을 구별한다.
**Tech Stack:** Next.js 16.3.3, React 19.2.8, Three 0.186.0, Vitest, pnpm 10.26.2. 새 의존성 없음.
**Spec:** 사용자 요청 — PR 메모리·성능 검토에서 확인한 초기 3D 준비 비용과 기존 썸네일 URL 캐시 누적을 개선한다.

## Global Constraints

- 홈의 즉시 3D 로딩·스크롤 없는 버튼 진입·책 디테일·그림자·WebGL fallback·reduced motion·이탈 cleanup을 보존한다.
- 캐시 상한은 URL 재요청 방지 기록에만 적용한다. 로그인 소유자 검사와 실제 썸네일 URL 선택을 변경하지 않는다.
- 변경 범위: 아래 frontend 파일, 해당 회귀 테스트, 기존 tasks/todo.md. API·DB·인증·패키지 변경 없음.
- 기존 개발 서버 5502/5501 유지. 측정용 production 서버와 브라우저만 별도로 실행·종료한다.

### Task 1: 초기 3D 준비 비용 감소

**Files:** Modify apps/front/app/book-model.ts, apps/front/app/book-world.ts. Test: 기존 book-camera.test.ts와 실제 production 브라우저.
**Interfaces:** createBookModel(palette)는 기존 THREE.Group과 같은 메시·재질·변환을 제공한다. createBookWorld의 render/dispose 계약과 HomeWorld의 lifecycle은 유지한다. 비동기 준비 상태나 추가 timer를 도입하지 않는다.
- [x] 동일 RoundedBox 규격·나무 기둥을 모델 내부에서 공유하고 production의 동기 shader 진단 조회를 줄였다.
**Acceptance criteria:** 동일 화면의 도형·재질·카메라 및 기존 버튼 이동을 보존한다. 같은 CPU 4배 감속 조건에서 초기 긴 작업/준비 시간 또는 GPU 업로드의 실측 개선이 있고 새 반복 작업·자원 누적이 없다.
**Verification:** 수정 전후 동일 production Chrome에서 반복 측정; 초기 화면 캡처, 진입/취소/reduced motion/context 복구, 20회 이상 왕복 후 canvas·context·RAF·observer와 heap 확인.

### Task 2: 썸네일 프리로드 기록 상한

**Files:** Modify apps/front/app/(demo)/library/libraryStories.ts, apps/front/app/(demo)/library/libraryStories.test.ts.
**Interfaces:** preloadThumbnailImage(url: string | null | undefined): void 유지. 최대 128개 최근 URL 기록과 요청별 token. getCachedThumbnailUrls/getOwnedThumbnailUrl/setCachedThumbnailUrls 계약 유지.
- [x] 중복 요청·최근 사용 유지·상한 초과 축출·decode 실패 후 재시도·오래된 실패의 재요청 보호를 테스트로 확인하고 구현했다.
**Acceptance criteria:** 빈 URL·서버 실행은 프리로드하지 않으며 같은 URL 중복을 막는다. 129번째 URL부터 오래된 기록을 제거한다. 실패한 현재 요청은 재시도할 수 있고 축출 전 요청의 늦은 실패는 새 요청에 영향이 없다.
**Verification:** 새 Vitest 테스트가 기존 구현에서 상한/경합 조건에 실패한 뒤 수정 후 통과. 기존 소유자·썸네일 선택 테스트 유지.

### Task 3: 통합 검증 및 기존 PR 상태 확인

**Files:** 위 frontend 파일 및 tasks/todo.md.
**Interfaces:** npx --yes pnpm@10.26.2 front ci:all, git diff --check, production QA, 기존 feature branch와 PR #58.
- [x] frontend ci:all·브라우저 회귀 검사·diff review를 완료하고 검증 결과를 기록했다.
- [x] PR #58이 이미 MERGED임을 확인했다. 최신 origin/main cc74b53에서 feat/front-startup-cache-optimization 브랜치를 만들고 로컬 후속 수정으로 보존했다.
**Acceptance criteria:** lint·types·tests·stubs·health-path·build 통과. 초기 비용 감소/캐시 상한/이탈 해제 각각의 근거 제공. secrets·임시 QA 파일은 포함하지 않는다. PR이 이미 병합됐다면 이를 보고하고 기존 PR에 후속 변경을 push하지 않는다.
**Verification:** foreground ci:all exit 0, git diff --check, 직접 화면 확인, 변경 파일 목록 및 gh pr view의 MERGED 상태 확인.


### Task 4: 새 PR 게시 — 2026-09-17

**Files:** 위 4개 frontend 파일과 tasks/todo.md.
**Interfaces:** feat/front-startup-cache-optimization → main, GitHub CLI PR 생성·조회, 기존 CLI credential helper를 통한 HTTPS push.
- [x] 변경 파일 5개와 최신 main 일치(HEAD...origin/main 0/0), 중복 PR 없음, foreground ci:all exit 0을 확인했다.
- [x] frontend 변경 4개를 40f3662로 커밋하고 후속 원격 브랜치에 push했다.
- [x] 새 PR #59를 main 대상으로 생성했다. head 40f3662와 변경 파일 4개를 확인했고 MERGEABLE이다. 생성 시점 CI(front)는 실행 중이며 로컬 검증 통과와 구분한다.
**Acceptance criteria:** 사용자 요청에 따라 PR URL을 제공하며 실제 변경 범위와 검증 근거를 본문에 기록한다. main에 직접 push하거나 PR을 병합하지 않는다.
**Verification:** git diff --cached --check/stat, 원격 head 일치, gh pr view의 base/head/files/mergeable/statusCheckRollup. 기존 통과한 frontend ci:all과 브라우저 검증은 소스가 변경되지 않은 범위에서 재사용한다.

## Verification Story — 초기 준비·캐시

- 원인 확인: CPU 4배 감속 production 프로파일에서 RoundedBox 생성과 UV 계산의 반복, 첫 shader 사용의 getProgramInfoLog 동기 대기가 기여했다. 같은 규격 geometry를 매번 만들고 production에서도 개발 진단을 수행하던 경로를 변경했다. shader 컴파일 자체를 제거한 것은 아니며 초기 긴 작업은 일부 남는다.
- 모델 표현 보존: 객체 121개·렌더링 정점 52,925개 유지. 정점/normal/UV/index·재질·instance 변환·객체 변환 digest가 전후 동일(bcdc54ed...). 실제 1440×900, 390×844(DPR 3) 캡처도 전후 SHA256이 동일하다.
- 자원/성능: 고유 geometry 96→58, 고유 정점 51,316→26,444. 실제 bufferData 325→200회(약 38% 감소). 같은 Chrome/M2 Pro에서 CPU 4배 감속·5회 측정의 ready 시간 중앙값 240.6→208.4ms(약 13% 감소). 첫 측정의 변동이 있으며 실제 저사양 기기 측정은 아니다.
- 캐시: 추가한 6개 사례 중 기존 구현의 상한·최근 접근·축출 후 재요청 3개가 실패함을 확인한 뒤 수정했다. 11개 libraryStories 테스트 모두 통과. 브라우저에서 실제 Image.decode를 사용한 129개 URL→중복 접근→축출 URL 재접근 검사도 생성/디코딩 130개로 통과했다.
- 메모리: production 20회 홈↔서재 왕복 후 매번 canvas/활성 WebGL context/예약 RAF/ResizeObserver 0개. DOM listener 319개 일정. 이탈 후 heap snapshot에 WebGLRenderer·Scene·카메라 누적 없음; Three 공용 Mesh/BufferGeometry와 브라우저 WebGL prototype은 각각 1개로 기존과 같다. 유휴 draw 0회.
- 기능: WebGL 손실/복구 3회, Escape 취소, reduced motion 이동, 데스크톱과 CPU 감속 모바일 크기의 버튼 진입 모두 통과. runtime exception 0. 진입 중 long task 0, frame interval P95 약 16.7~16.8ms.
- 프로젝트 검증: npx --yes pnpm@10.26.2 front ci:all exit 0 — contracts lint/build, frontend lint·types·stubs·health-path·18 files/121 tests·production build. git diff --check 통과.
- PR: https://github.com/kon6443/nerd-back/pull/59 — 후속 성능·캐시 개선. 게시 전 최신 origin/main과 일치(0/0)했으며, 코드·테스트 4개 파일과 이 검증 기록만 포함한다. 로컬 branch는 origin/feat/front-startup-cache-optimization을 추적한다.
- 근거: /tmp/nerd-pr58-bench-{before,after}.json, /tmp/nerd-book-model-{before,after}.json, /tmp/nerd-pr58-memory-after.json, /tmp/nerd-pr58-heap-after-20.heapsnapshot, /tmp/nerd-pr58-performance-after.json. QA 자료·env는 저장소 변경에 포함하지 않는다.

---

# 3D 동화 화면 최신 main 통합 및 PR Implementation Plan — 2026-09-17

> **For implementers:** 사용자 요청에 따라 충돌을 해결하고 검증 후 커밋·푸시·PR 생성을 완료한다.

**Goal:** 현재 홈·서재·로그인·동화 소개 개선을 최신 origin/main과 통합하여 검토 가능한 PR을 만든다.
**Architecture:** 현재 변경을 별도 feature branch에 보존한 뒤 origin/main을 merge한다. 겹치는 프론트 파일은 main의 썸네일/캐시/오류 처리/로그인 이동 기능과 이번 입체 표현을 모두 유지한다.
**Tech Stack:** Git·GitHub CLI·기존 pnpm frontend ci:all.
**Spec:** 사용자 요청 — main과 충돌 있으면 해결하고 PR 생성.

## Global Constraints

- 기존 작업을 누락하거나 main의 최근 기능을 되돌리지 않는다. 강제 push·main push·PR merge·배포 없음.
- 기존 3D 홈과 메모리 정리·시각 검증 결과를 보존한다. secrets·env·임시 QA 자료는 staging하지 않는다.
- 실제 계정 생성·동화 제작·DB 변경 없이 통합 결과를 검증한다.

### Task 1: 최신 main 통합

**Files:** 현재 변경된 apps/front 파일과 tasks/todo.md, origin/main과 겹치는 UI 파일.
**Interfaces:** feature branch feat/front-immersive-story-world, origin/main merge. StoryCard/StoryDetailArtwork/LibraryStoryList의 최신 interfaces 확인 후 표현 계층 연결.
- [x] 현재 작업을 feature branch에 보존하고 충돌 7개를 기능 단위로 해결했다.
**Acceptance criteria:** origin/main이 PR 브랜치의 조상이며 충돌 마커가 없다. 최신 썸네일·캐시·로그인/오류 처리와 3D 표현을 함께 보존한다.
**Verification:** merge 결과·변경 파일 diff·호출자 추적·frontend ci:all·실제 홈/서재/소개/로그인 흐름 확인.

### Task 2: 검증 및 PR 생성

**Files:** 위 통합 파일 및 tasks/todo.md.
**Interfaces:** frontend ci:all, git diff --check, GitHub PR base main.
- [x] 로컬 검증 후 feature branch를 push하고 PR #58 생성·main MERGEABLE·원격 CI 실행 상태를 확인했다.
**Acceptance criteria:** 로컬 프로젝트 검사 통과, PR URL 제공, main과 병합 가능 여부와 CI 상태를 사실대로 보고한다.
**Verification:** staged paths·diff check·커밋, origin/main 최신 여부 재확인, gh pr view/checks 및 remote branch SHA 확인.

## Integration verification — 최신 main

- PR: https://github.com/kon6443/nerd-back/pull/58 (base main, head feat/front-immersive-story-world). 게시 직전 main 재조회 후 ancestor 검사를 통과했고 GitHub는 MERGEABLE로 판정했다. 게시 시점 CI (front/back)는 실행 중이며 로컬 ci:all 통과와 구분한다.
- 기본 SSH 인증의 계정과 CLI 계정이 달라 첫 push는 권한 거부됐다. CLI 계정의 저장소 push 권한을 확인한 뒤, 전역 설정을 바꾸지 않고 기존 CLI credential helper와 명시적 HTTPS 주소로 push했다.

- origin/main 4f53e84의 추가 11개 커밋을 통합했다. LibraryShell/count skeleton, LibraryStoryList/사용자 캐시, mode=create 링크·단일 CTA, StoryDetailArtwork/소유자 검사·우선 로딩, 로그인 안전한 redirect·오류 details를 유지했다.
- 가입 오류 details의 ul을 포함하는 컨테이너를 p에서 div로 변경해 HTML 구조를 바로잡았다. StoryDetailShell은 완료 후 모드를 보존한 복귀 링크를 제공하고, 모드를 아직 모르는 loading은 같은 높이의 비활성 자리만 둔다.
- frozen-lockfile 설치와 contracts prepare 빌드 후 frontend ci:all exit 0: 18 test files / 115 tests, lint·types·stubs·health-path·build. 최종 foreground npm run lint exit 0.
- Chromium 1440×900/390×844에서 실제 동화 데이터를 사용하는 서재·일반 소개·제작 소개·로그인 8개 조합의 크림 배경·canvas 0·overflow 0 및 모드별 CTA/복귀 경로를 확인했다. 홈 두 CTA의 진입 후 이동도 확인했다.
- 브라우저 fetch fixture로 가입 오류 details 1회 표시, 제작 모드의 개인화 썸네일과 완성 세션 링크, 계정 전환 후 이전 썸네일 제거를 확인했다. 실제 auth/세션 쓰기는 차단했다. StoryDetailArtwork의 추가 세션 요청은 0회였다.
- QA helper는 최초 오류 envelope를 계약과 다르게 만들어 details 검증에 실패했다. 계약의 code/message/timestamp/details 형태로 고친 뒤 통과했다. 이후 요청 수를 production 기준으로 가정한 assertion이 실패하여 호출 스택을 확인했다: LibraryStoryList와 StorySessionActions 각각 개발 Strict Mode의 effect 재실행으로 2회였고 StoryDetailArtwork 요청은 0회. 제품 코드를 우회하거나 재시도 설정을 바꾸지 않았다.
- 자료: /tmp/nerd-pr-integration-report.json, /tmp/nerd-pr-{library,detail}-{1440,390}.png, /tmp/nerd-pr-personalized-1440.png. 인증·이미지는 격리된 fixture이며 실제 모바일/Safari 실기 검증은 미수행.
- main 통합 직후 로컬 backend가 이전 contracts/dist 타입을 참조해 TS 오류를 냈으나 frozen install의 prepare 빌드 후 0 errors로 시작했다. 검증용 backend는 프로세스 환경에서 Discord webhook을 비워 외부 알림을 전송하지 않도록 실행했다. .env는 변경하지 않았다.

---

# 동화 소개 화면의 입체 서재 연결 Implementation Plan — 2026-09-17

> **For implementers:** 기존 실행 정책에 따라 아래 체크리스트를 완료한다.

**Goal:** /library/jack-and-beanstalk를 포함한 /library/[slug] 소개 화면을 홈·서재의 크림 배경과 입체 책 재질에 맞춘다.
**Architecture:** 기존 StoryRoom을 재사용하는 StoryDetailShell로 상세와 로딩의 배경·패널을 공유한다. 기존 library 카드 표지를 StoryCover로 추출하여 상세에도 적용한다. 버튼은 선택적 primaryClassName으로 기존 StoryRoom의 파란 CTA를 재사용한다.
**Tech Stack:** 기존 Next.js·React·CSS Modules·디자인 토큰. 새 의존성 없음.
**Spec:** 사용자 요청 — /library/jack-and-beanstalk 페이지에 이전 배경이 남아 있으므로 앞서 승인한 홈과 같은 톤을 이어간다.

## Global Constraints

- 대상은 동화 소개·로딩과 이를 위한 기존 표지/버튼의 표현 계층. 실제 리더·촬영·API·인증·세션 처리 로직은 변경하지 않는다.
- 제목·요약·장수·등장인물·CTA 목적지와 56px 터치 타깃을 보존한다. 소개와 등장인물은 하나의 밝은 패널 안에 둔다.
- 추가 canvas·RAF·listener 없음. 기존 main 미커밋 작업을 보존한다. 공유 DB 쓰기·동화 생성·커밋·배포 없음.
- main 개발 서버 5502/5501 유지. 재시작 후 실제 /api/v2/stories는 HTTP 200으로 복구됨.

### Task 1: 소개·로딩 화면의 재질 연결

**Files:** Create apps/front/app/(demo)/library/[slug]/StoryDetailShell.tsx, StoryDetail.module.css; Modify 같은 디렉터리 page.tsx:1, loading.tsx:1; apps/front/components/story/StoryCard.tsx:50, StoryCard.module.css:8, StorySessionActions.tsx:12.
**Interfaces:** StoryDetailShell({children})은 StoryRoom·서재 복귀 링크·하나의 종이 패널을 제공한다. StoryCover({title,imageUrl?,className?})는 기존 카드의 장식 표지를 공유한다. StorySessionActions({slug,primaryClassName?})은 동작을 유지하며 주 버튼 클래스만 받는다.
- [x] 소개와 로딩에 같은 배경·패널·입체 책 표지와 파란 CTA를 적용했다.
**Acceptance criteria:** 초록 언덕 대신 홈과 같은 크림 배경이 표시되고 실제 제목/내용·버튼 경로·등장인물을 유지한다. 로딩도 같은 틀을 사용한다. 서재 카드 표현은 유지한다.
**Verification:** 실제 API의 두 동화 상세 및 서재를 브라우저로 확인한다. 1440×900·1024×768·390×844에서 overflow 0, CTA 최소 56px, 텍스트 대비·키보드 focus·reduced motion을 검사한다.

### Task 2: 회귀 검증

**Files:** 위 파일과 tasks/todo.md.
**Interfaces:** frontend ci:all, foreground npm run lint, git diff --check 및 실제 로컬 브라우저.
- [x] 화면·경로·로딩 검증과 프로젝트 검사를 완료하고 근거를 기록했다.
**Acceptance criteria:** 기존 테스트·lint·types·build 통과, 해당 소개 화면의 canvas 0, 새 client lifecycle 작업 없음. 서버가 실행 중이며 확인 가능한 주소를 제공한다.
**Verification:** 묶음 시각 검증 1회와 필요 시 보정 확인 1회, ci:all exit 0, foreground lint exit 0, diff check 및 서버 응답 확인.

## Verification Story — 동화 소개

| 수용 기준 | 검증 결과 |
|---|---|
| 배경·소개·표지 | 실제 5502 API 데이터로 잭과 콩나무/빨간 모자 확인. 두 소개 main의 배경 rgb(251,247,236), 기존 제목·요약·장수·등장인물·CTA 경로 유지. 책 표지는 서재와 공유하며 상세에만 세로 비율 적용 |
| 로딩 연결 | 실제 페이지 스트리밍 중 MutationObserver로 로딩 상태 포착. 로딩/완료의 StoryRoom main과 StoryDetail panel 클래스 동일, 로딩 중 서재 복귀 링크 존재 |
| 반응형·가독성 | 두 동화 각각 1440×900·1024×768·390×844 가로 overflow 0, 모든 CTA 높이 56px. 요약 대비 5.20:1, 주 버튼 5.05:1. /tmp/nerd-detail-{1440,1024,390}.png를 묶어서 직접 확인. 키보드 Tab의 주 버튼 focus-visible true, reduced motion transition 0.00001s |
| 실제 이동 | 서재 복귀 → 실제 두 권 목록, 상세 재진입 → /library/jack-and-beanstalk/1, 내 얼굴로 만들기 → /stories/jack-and-beanstalk/capture와 파일 입력 표시 확인. API 쓰기·촬영·생성·세션 삭제 없음 |
| 성능·검사 | 소개 canvas 0, 추가 hook/RAF/listener 없음. frontend ci:all exit 0 (83 tests·lint·types·stubs·health-path·build), 최종 foreground npm run lint exit 0. 실행 중 브라우저 uncaught exception 0 |

QA 자료: /tmp/nerd-detail-report.json과 /tmp/nerd-detail-check.mjs. 첫 helper의 촬영 목적지 기대값은 로그인으로 잘못 가정하여 실패했다. 실제 capture 소스를 확인해 기대값을 수정했고, 만료된 CDP endpoint도 현재 QA 세션에서 조회하도록 고쳐 미완료 기능 검사만 실행해 exit 0을 확인했다. 제품 동작은 이를 이유로 바꾸지 않았다. 시각 검증은 한 번의 묶음 검사로 완료했고, 실제 모바일 기기/Safari·로그인 사용자 세션 분기는 이번에 실기 테스트하지 않았다. main 개발 서버를 유지하고 전용 QA 브라우저만 종료한다.

---

# 홈에서 이어지는 입체 서재·로그인 Implementation Plan — 2026-09-17

> **For implementers:** 기존 실행 정책을 따르며 아래 항목을 완료한다.

**Goal:** 홈 CTA의 목적지인 서재·로그인에 홈과 같은 종이·청록 표지·금색 포인트와 입체 책 표현을 적용한다.
**Architecture:** 두 페이지에만 공통 StoryRoom 배경·장식과 CSS Module을 적용한다. 서재는 기존 StoryCard의 library variant를 입체 책 표지로 다듬고 로딩/오류/빈 화면에도 같은 shell을 유지한다. 로그인은 기존 인증 동작을 유지하며 표면·배치만 바꾼다. 입체감은 CSS perspective와 종이 단면으로 표현해 WebGL context·RAF·listener를 추가하지 않는다.
**Tech Stack:** 기존 Next.js/React/CSS Modules·디자인 토큰. 새 의존성·이미지 다운로드 없음.
**Spec:** 사용자 요청 — 버튼으로 들어간 페이지도 홈과 비슷한 3D 배경이나 톤앤매너로 맞춘다. 최근 메모리 누수 방지 요구도 유지한다.

## Global Constraints

- 적용 경로는 /library 목록·로딩·오류·빈 화면과 /login 로그인·가입 UI. 리더·촬영·마이페이지·전역 헤더·인증 로직·백엔드는 수정하지 않는다.
- 실제 제목/요약과 기존 CTA 목적지·로그인/가입 검증·aria·focus·56px 타깃을 보존한다.
- 전역 초록 배경을 대상 페이지의 불투명 cream 배경으로 덮는다. 새로운 전역 theme나 WebGL canvas를 추가하지 않는다.
- main의 기존 미커밋 작업 보존. DB 쓰기·실제 가입·동화 생성·커밋·푸시·배포 없음.
- 현재 /api/v2/stories HTTP 500. 실제 오류 UI를 확인하고 정상/빈/로딩 목록은 격리된 로컬 QA fixture로 명시적으로 검증한다.
- impeccable context helper는 설치 파일 scripts/lib/target-args.mjs 누락으로 실패했다. 스킬 설치를 변경하지 않고 기존 토큰·코드·실제 화면을 직접 읽어 같은 디자인을 이어간다.

### Task 1: 대상 화면의 공통 입체 재질

**Files:** Create apps/front/components/layout/StoryRoom.tsx, StoryRoom.module.css; Modify apps/front/app/(demo)/library/LibraryShell.tsx, apps/front/app/(trial)/login/page.tsx.
**Interfaces:** StoryRoom({children, className?})은 불투명 배경의 main과 콘텐츠 틀을 렌더한다. BookStack({className?})은 aria-hidden인 CSS 3D 책 장식이다. 기존 LibraryShell(children)은 성공·로딩·오류가 함께 사용한다.
- [x] 홈 팔레트·입체 책 장식·로그인 종이 패널을 구현하고 3개 뷰포트에서 확인했다.
**Acceptance criteria:** 홈 → 서재/로그인에서 색감이 연결되고 폼/목록이 배경에 가려지지 않는다. 모바일에서 장식보다 행동이 먼저 보이고 가로 overflow가 없다.
**Verification:** 기존 화면과 새 desktop/tablet/mobile 캡처 비교, 실제 홈 CTA 이동, 로그인/가입 전환·빈 입력 검증·키보드 focus. 신규 canvas 0·RAF/JS listener 추가 없음.

### Task 2: 서재의 책 카드와 전체 상태

**Files:** Modify apps/front/components/story/StoryCard.tsx, apps/front/app/(demo)/library/LibraryShell.tsx, page.tsx, error.tsx; Create apps/front/components/story/StoryCard.module.css.
**Interfaces:** StoryCard의 기존 props와 variant를 보존하고 library에만 입체 cover를 적용한다. STORY_GRID를 실제/로딩이 공유하고 skeleton은 같은 표지 비율·간격을 사용한다.
- [x] 책 표지·종이 단면·hover/focus 표현과 로딩/빈/오류 상태의 재질을 맞췄다.
**Acceptance criteria:** 제목/설명/CTA 가독성과 경로 유지, 긴 제목/설명 대응, reduced-motion에서 장식 모션 없음. 목록 수가 달라도 grid 정상.
**Verification:** 로컬 read-only QA fixture로 정상 3권·긴 제목·빈 목록·지연·500 상태 확인. 390×844·1024×768·1440×900 레이아웃, 색 대비와 focus 확인.

### Task 3: 통합 검증

**Files:** 위 파일과 tasks/todo.md.
**Interfaces:** frontend ci:all, foreground npm run lint, git diff --check; 개발 서버 5502/5501 유지.
- [x] 묶음 시각 검증·대비 보정 확인과 프로젝트 검사·활성 자원 회귀 검증을 완료했다.
**Acceptance criteria:** UI 검사·83개 기존 테스트·lint·types·build 통과. 홈 메모리 cleanup 회귀 없음. fixture QA와 실제 backend의 미검증 상태를 구분해 기록한다.
**Verification:** desktop/mobile 스크린샷과 실제 폼 상호작용, 홈/서재 왕복 canvas/context 정리, ci:all exit 0·foreground lint exit 0·health 200.


## Verification Story — 홈에서 이어지는 입체 서재·로그인

| 수용 기준 | 검증 결과 |
|---|---|
| 홈과 이어지는 재질 | 대상 두 페이지의 main 배경이 홈과 같은 rgb(251,247,236). 청록 표지·종이 단면·입체 책 장식·동일한 파란 CTA 적용. 홈 버튼 → 서재에서 책 카드 3개, canvas 0 확인. 실제 5502 서재의 오류 화면에도 같은 cream 배경 적용 확인 |
| 반응형·긴 내용 | Chromium 1440×900·1024×768·390×844에서 서재와 로그인 모두 가로 overflow 0, 입력/CTA 최소 56px. QA의 긴 제목 표지가 내용 높이만큼 늘어나며 내부 면과 표지 높이가 일치, 설명/버튼 겹침 없음. /tmp/nerd-world-library-{1440,1024,390}.png와 final-login-{1440,390}.png를 열어 확인 |
| 로그인·가입 | 빈 제출 시 loginId에 focus, 두 필드 aria-invalid와 오류 설명 연결 유지. 가입 전환 시 new-password autocomplete·이전 오류 초기화 확인. 실제 개발 서버에서도 같은 동작과 오류 border rgb(144,105,205) 확인. 실제 계정 생성/로그인 요청은 실행하지 않음 |
| 전체 목록 상태 | 읽기 전용 로컬 fixture에서 정상 3권·긴 제목·빈 목록·2초 지연·500 상태 확인. 오류의 다시 시도로 정상 목록 복구. 모바일 로딩 전후 titleY 165·listY 315로 동일. 실제 backend 데이터 조회 성공을 의미하지 않음 |
| 가독성과 동작 | 입력 경계/안쪽 배경 대비 3.56:1, CTA 5.05:1, 폼 안내 5.27:1. focus 표시·aria 오류 유지. reduced-motion에서 표지 transition 0.00001s(기존 전역 접근성 규칙). 브라우저 uncaught exception 0 |
| 메모리·성능 | 신규 배경은 서버 렌더 가능한 CSS/SVG만 사용, canvas·RAF·JS listener 추가 없음. 기존 홈에서 서재로 3회 왕복 후 canvas·활성 context·ResizeObserver·예약 RAF 0, 전역/미디어/홈 리스너 149로 일정, 매회 GPU 자원 532개 해제. 기존 홈의 정지 500ms draw 0. /tmp/nerd-world-memory.json |
| 프로젝트 검사 | frontend ci:all exit 0: 83 tests·lint·types·stubs·health-path·build. 이후 CSS 대비 보정은 최종 npm run build와 foreground npm run lint exit 0 및 최종 브라우저 검사로 확인. git diff --check 통과 |
| 실제 서버 상태 | main의 5502 홈·health 및 5501 health HTTP 200. `/api/v2/stories`는 직접 GET에서도 HTTP 500이 지속되어 실제 서재 목록 표시 성공은 미검증. 원인은 이번 UI 작업에서 변경/확정하지 않음 |

검증은 두 번의 시각 확인(초기 묶음, 대비 보정 확인)으로 마쳤다. 테스트 fixture(5601), 임시 production frontend(5602), API proxy(5603)는 /tmp에서만 실행했고 공유 DB를 읽거나 쓰지 않는다. 임시 프로세스/QA 브라우저를 종료하고 main 개발 서버는 유지한다. 리더·촬영·마이페이지·전역 헤더·인증 로직·백엔드 변경 없음. 실제 모바일 기기/Safari는 미검증이다.

재현 자료: /tmp/nerd-world-final-check.mjs 및 nerd-world-final-report.json, nerd-world-main-report.json. 전체 검사 로그 /tmp/nerd-world-ci.log, 최종 빌드 /tmp/nerd-world-final-build.log. QA helper의 DOM 객체 직렬화·CSS Module 이름 추측 오류는 boolean 조건과 의미 속성으로 바꿔 해결했고, 개발 서버 폼 검사는 SSR DOM 출현 대신 실제 모드 전환 완료를 확인한 뒤 수행했다. 실패한 helper 실행은 성공 증거에 포함하지 않았다. 커밋·푸시·배포하지 않았다.

---

# 스크롤 없는 3D 홈과 진입 최적화 Implementation Plan — 2026-09-16

> **For implementers:** 기존 실행 정책과 아래 체크리스트를 따른다.

**Goal:** 홈에서 이미지가 먼저 보이는 현상과 스크롤 여행을 제거하고 버튼 클릭으로만 책 속으로 진입해 다음 페이지까지 자연스럽게 연결한다.
**Architecture:** 홈을 단일 화면으로 단순화한다. Three.js를 홈 client bundle에서 미리 가져와 layout effect에서 첫 화면을 그린다. 카메라는 고정 시작점에서 버튼 진입 경로만 계산하고, 가능한 브라우저에서는 View Transition으로 목적지 화면을 연결한다.
**Tech Stack:** 기존 React/Next.js/Three.js/CSS Module, 지원 여부를 확인하는 native View Transition. 새 의존성 없음.
**Spec:** 사용자 최신 요청 — 새로고침 이미지 선노출 제거, 스크롤 제거, 버튼 진입 체감, 최적화.

## Global Constraints

- 홈 코드와 사용하지 않는 홈 전용 자산/계산 코드만 정리한다. 공통 헤더·서재·인증·백엔드는 변경하지 않는다.
- 일반 desktop/tablet/mobile에서 화면 한 장으로 보이며 가로/세로 여행 스크롤이 없다. 확대/작은 가로 화면에서는 접근성을 위해 콘텐츠 넘침을 허용한다.
- 초기 이미지 3장·스크롤 listeners·장면 상태/DOM 갱신을 제거한다. 3D 준비 중 다른 책 이미지를 표시하지 않는다. WebGL 실패 시에만 대체 이미지 1장을 요청한다.
- reduced-motion에서도 정지된 실제 3D를 보여 주되 클릭 연출은 생략한다. 새 탭·기존 목적지·Escape 취소·뒤로 가기를 유지한다.
- 초기 HTML만으로 WebGL을 그릴 수는 없으므로 지연/실패 상태에서 안내와 CTA가 항상 접근 가능해야 한다. 즉시 표시를 보장한다고 주장하지 않는다.

### Task 1: 한 화면과 초기 3D

**Files:** apps/front/app/HomeWorld.tsx:1, HomeWorld.module.css:1, world-progress.ts와 test 삭제; public/images/home-world 중 village/library 삭제.
**Interfaces:** HomeWorld는 기존 children CTA를 받는다. loading/ready/fallback 상태만 관리하며 첫 성공 렌더 후 canvas를 표시한다.
- [x] 단일 화면과 초기 렌더 순서를 구현하고 스크롤/이미지 여행 코드를 제거한다.
**Acceptance criteria:** 새로고침 중 이미지 선노출 없음, 정상 실행에서 홈 이미지 요청 0건, 일반 3뷰포트에서 세로 여행/장면 메뉴 없음.
**Verification:** cold/warm reload의 DOM/네트워크/첫 WebGL 시점, 1440×900·1024×768·390×844 화면 및 overflow 확인.

### Task 2: 진입 경로와 GPU 최적화

**Files:** apps/front/app/book-camera.ts:1, book-camera.test.ts:1, book-world.ts:1, book-model.ts:1, HomeWorld.tsx:1, HomeWorld.module.css:1.
**Interfaces:** bookCamera(entry, aspect)는 책 전체에서 성문 앞 시점으로 이동한다. render는 화면 크기·entry·pointer만 받는다. 반복 sphere는 같은 material끼리 InstancedMesh로 묶는다. navigation 완료는 홈 cleanup과 연결해 native View Transition이 새 화면을 캡처하게 한다.
- [x] 클릭 진입 카메라/전환과 반복 메시·렌더 작업을 개선했다. 최종 브라우저 검증은 아래 품질 항목에서 수행한다.
**Acceptance criteria:** 책 안으로 가까워진 후 화면 전환, 두 CTA 경로 유지·중복 이동 없음. 정지 상태 지속 렌더 0, 반복 메시 draw call 감소, 클릭 프레임의 레이아웃 읽기/쓰기 감소.
**Verification:** camera endpoints/continuity tests, model draw/triangle 수 전후 비교, live frame/idle instrumentation, 실제 진입·뒤로 가기·모션 설정·WebGL 및 View Transition 미지원 테스트.

### Task 4: 사용자 추가 요청 — 메모리 누수 방지

**Files:** apps/front/app/HomeWorld.tsx:20, book-world.ts:12.
**Interfaces:** 각 effect가 전용 canvas를 생성·제거한다. dispose는 geometry/material/instance/shadow/renderer/context를 해제하고 scene·호출자 참조를 비운다. 실패 초기화와 늦은 View Transition callback도 같은 소유권 규칙을 따른다.
- [x] 초기화/해제·Strict Mode·반복 왕복의 자원 정리를 보강하고 실제 누적 여부를 측정했다.
**Acceptance criteria:** 홈은 canvas/context 1개, 이탈하면 이전 context 해제·canvas 0·홈 RAF 0. 반복 왕복 후 리스너/observer/GPU 및 회수 후 heap이 계속 늘지 않는다.
**Verification:** Chromium CDP의 반복 SPA 이동·GPU context/삭제 계측·이벤트/RAF 계측·명시적 GC 후 heap 비교. 관측한 반복 횟수와 하드웨어 한계를 보고한다.

**추가 진단:** 배포 빌드에서 16회 왕복 후에도 회수된 heap이 증가했다. Heap snapshot의 강한 참조를 추적해 Three r186의 모듈 공용 `DFG_LUT` DataTexture → dispose listener → renderer 체인이 매 방문마다 남는 것을 확인했다. 공개 onBeforeCompile callback에서 실제 LUT uniform을 받아 renderer 해제 전에 texture.dispose()를 호출하고 동일한 왕복·heap snapshot으로 재검증한다. 라이브러리 내부 필드나 node_modules는 수정하지 않는다.

### Task 3: 최종 품질 검증

**Files:** 위 파일과 tasks/todo.md.
**Interfaces:** frontend ci:all, foreground lint, diff, 로컬 서버 health 및 브라우저 검증.
- [x] 최종 화면·초기 로딩·전환·접근성·성능을 검증하고 수치와 제한을 기록했다.
**Acceptance criteria:** 변경 범위가 홈에 한정되고 모든 기능/검사가 통과한다. 실제 모바일 하드웨어 검증 여부를 명시하고 main 서버를 유지한다.
**Verification:** frontend ci:all·npm run lint·git diff --check exit 0, frontend/backend health 200, 변경 전후 이미지 요청/코드량/draw call 증거.


## Verification Story — 한 화면·버튼 진입·메모리

| 수용 기준 | 최종 증거 |
|---|---|
| 첫 이미지 노출 제거 | 배포 빌드의 cache-disabled reload에서 loading → ready 동안 img 0, 홈 이미지 요청 0. 새 탭에서 ready 약 1.11초(현재 로컬 환경); WebGL/JS가 준비되기 전 즉시 3D 표시를 보장하지 않음 |
| 한 화면 레이아웃 | 1440×900·1024×768·390×844에서 scrollWidth/Height가 viewport와 일치. 두 CTA 모두 높이 56px, 화면 안에 표시. 실제 캡처 시각 확인: /tmp/nerd-home-final-{1440,1024,390}.png |
| 버튼 진입·목적지 | 클릭 400ms 뒤 홈 entering=true·wash=0인 상태에서 카메라가 책 안으로 접근하는 화면 확인. 이후 /library 이동, canvas 0·transition class 제거. 로그인 표시만 일시 전환해 ‘내 얼굴로 만들기’의 기존 /library 경로와 진입 확인. 실제 인증·서버 데이터는 변경하지 않음 |
| 취소·대체 동작 | Escape 뒤 1600ms 경과해도 홈 유지, entering=false·wash=0. Ctrl/Meta/Shift/Alt 클릭 미가로채기. reduced-motion은 정지 3D 유지·진입 연출 생략. View Transition API가 없어도 이동. 실제 context loss에서 fallback 이미지 1장과 정상 링크 이동. 최종 reload에서 ready·canvas 1·img 0·브라우저 uncaught exception 0 |
| 렌더 성능 | 63개 sphere 메시를 material별 4개 InstancedMesh로 묶어 draw call 163 → 104(-36.2%), triangle 65,700 유지, 63개 변환 행렬 오차 1e-5 이내. 정지 500ms 동안 draw 0·예약 RAF 0. 그림자는 필요할 때만 갱신, DPR 상한 1.5 |
| 자원 해제 | 배포 빌드 16회 왕복 모두 이탈 뒤 canvas·활성 context·ResizeObserver·예약 RAF 0, 전역/미디어/홈 리스너 149로 일정. 매회 GPU 자원 532개 삭제. Strict Mode마다 전용 canvas를 소유해 잃어버린 context 재사용을 방지 |
| 실제 heap 누수 수정 | 수정 전 6회 왕복으로 WebGLRenderer 17 → 23·PerspectiveCamera 51 → 69. DFG_LUT의 dispose listener가 renderer를 붙잡는 강한 참조 확인. Texture.dispose 추가 후 16회 + 6회 왕복에서는 renderer 수 증가 0, GC heap 15,703,376 → 15,691,360 bytes |
| 깨끗한 탭 재검증 | 새 배포 빌드 탭에서 8회 준비 + 추가 6회 왕복. 이탈 후 WebGLRenderer·PerspectiveCamera 모두 0개, 모듈 상수 Mesh/BufferGeometry 각 1개로 일정. 추가 6회 전후 GC heap 8,754,512 → 7,915,476 bytes, backing storage 증가 없음. /tmp/nerd-home-memory-clean.json·nerd-heap-clean-scan.log·nerd-heap-before/after.heapsnapshot |
| 프로젝트 검사 | 마지막 소스 수정 후 frontend ci:all exit 0: 83 tests·lint·types·stubs·health-path·production build. 별도 foreground npm run lint exit 0. git diff --check 통과. main의 5502 홈/health·5501 health 모두 HTTP 200 |

재현 스크립트는 /tmp/nerd-home-qa.mjs(반복 이동/GPU/RAF/listener 계측), /tmp/nerd-heap-scan.mjs(GC와 heap snapshot), /tmp/nerd-home-functional.mjs(뷰포트·CTA·대체 동작)이며 CDP 연결 주소와 localhost origin을 인자로 받는다. 검증 보고서는 /tmp/nerd-home-functional-report.json, 전체 검사 로그는 /tmp/nerd-home-memory-fix-ci.log에 있다. Heap snapshot은 브라우저 내부 데이터를 포함하므로 repo에 넣지 않았다.

**검증 제한:** Chromium 뷰포트 검증이며 실제 모바일 기기/Safari 장시간 사용은 미검증. 백엔드 `/api/v2/stories`는 별도 직접 GET에서도 HTTP 500을 반환했다. 이번 홈 수정으로 인한 것으로 단정하지 않으며, 서재의 정상 데이터 표시는 검증하지 못했다. 경로 이동·에러 화면 도달과 자원 해제는 확인했다. DB/백엔드 수정 없이 main 개발 서버를 유지했다. 임시 배포 QA 서버/브라우저만 종료하고 커밋·푸시·배포하지 않았다.

---

# 버튼으로 동화 속 진입 Implementation Plan — 2026-09-16

> **For implementers:** 기존 실행 정책을 따르고 아래 체크리스트로 진행한다.

**Goal:** 홈 CTA를 누르면 현재 카메라 위치에서 책 속 성문으로 들어간 뒤 기존 목적지로 자연스럽게 전환한다.
**Architecture:** HomeWorld의 기존 rAF와 Three.js camera를 재사용한다. 홈 CTA 영역의 일반 내부 링크 클릭만 지연하고 밝은 종이색 전환 후 Next router로 이동한다. 공유 AuthCta·ActionLink와 대상 페이지는 수정하지 않는다.
**Tech Stack:** 기존 Next.js 16.3.3·React 19·Three.js·CSS Module. 새 의존성 없음.
**Spec:** 사용자 요청 — 동화 체험하기/내 얼굴로 만들기를 누르면 책 안으로 들어간 뒤 페이지 전환.

## Global Constraints

- 홈 전용 파일과 tasks/todo.md만 수정한다. 기존 로그인별 목적지·스크롤 감상·새 탭 열기를 보존한다.
- 모션 줄이기·낮은 화면·WebGL 미지원에서는 원래 링크로 즉시 이동한다.
- 중복 클릭으로 중복 이동하지 않는다. Escape로 진입 연출을 취소할 수 있고 화면 이탈 시 rAF/자원을 정리한다.
- 실제 AI 생성·인증 계약·운영 DB·커밋·푸시·배포는 범위 밖이다.

### Task 1: 진입 카메라

**Files:** apps/front/app/book-camera.ts:9, book-camera.test.ts:4, book-world.ts:5.
**Interfaces:** bookCamera(progress, aspect, entry = 0)는 기존 위치를 유지하다 entry 0..1에 따라 성문 앞 시점으로 이동한다. BookWorldFrame.entry는 선택적 숫자다.
- [x] 현재 스크롤 위치를 시작점으로 삼는 진입 카메라와 렌더 입력을 구현한다.
**Acceptance criteria:** entry 0에서 순간 이동 없음. 모든 스크롤 위치와 화면 비율에서 entry 1은 성문 앞의 동일한 위치·중앙 시야로 수렴한다.
**Verification:** 시작점 동일성·종점 수렴·경계/비정상 입력·연속 이동 단위 테스트.

### Task 2: CTA 진입과 페이지 전환

**Files:** apps/front/app/HomeWorld.tsx:35, HomeWorld.module.css:1.
**Interfaces:** CTA capture handler는 같은 origin의 일반 왼쪽 클릭에만 진입을 시작한다. effect의 기존 rAF가 약 1.2초 동안 camera entry·문구 fade·종이색 mask를 갱신한 후 router.push(href)를 한 번 호출한다.
- [x] 클릭 진입·화면 fade·기존 라우팅·중복 클릭 방지·Escape 취소·접근성 대안을 연결한다.
**Acceptance criteria:** 체험/로그인 상태별 생성 링크의 목적지 유지. Ctrl/Meta/Shift 클릭과 target/download는 원래 동작. reduced-motion·WebGL 실패에서는 지연 없이 이동.
**Verification:** 실제 브라우저 시작/중간/끝 위치의 CTA 진입, 모바일, 키보드, 중복 클릭, 취소, 모션 줄이기 및 GPU 미지원 대안 검증.

### Task 3: 최종 검증과 기록

**Files:** 위 파일과 tasks/todo.md.
**Interfaces:** 기존 프로젝트 frontend 검증 명령·로컬 브라우저/health를 사용한다.
- [x] 시각 흐름을 확인하고 frontend ci:all·foreground lint·git diff --check·서버 health 결과를 기록한다.
**Acceptance criteria:** 책 속 진입이 먼저 보이고 목적지 이동이 뒤따른다. 화면 이탈 후 남은 overlay/canvas 없음, 기존 3D 품질 유지.
**Verification:** 단위/브라우저 증거와 CI exit 0, localhost 5502/5501 health 200. 실제 모바일 하드웨어 미검증 범위를 명시한다.


## Verification Story — CTA로 동화 속 진입

| 수용 기준 | 검증 근거 |
|---|---|
| 현재 시점에서 성문으로 접근 | book-camera 6 tests 통과. 스크롤 0/0.5/1 및 모바일/데스크톱에서 entry 0은 기존 위치와 동일하고 entry 1은 성문 앞 시점으로 수렴. 연속성·범위 밖 입력 검증 |
| 연출 뒤 기존 페이지 이동 | 실제 체험 버튼 클릭: 200ms/650ms에는 홈 WebGL 유지, 1050ms 전환 마스크 약 0.84, 약 1256ms에 /library push 1회. 1500ms에 목적지 도착 및 홈 canvas/overlay 0개 |
| 생성 CTA·중복 방지 | 브라우저의 표시용 data-session을 authenticated로 설정해 내 얼굴로 만들기의 기존 /library href 확인. 두 번 연속 클릭 후 약 1250ms에 push 1회. 실제 인증/서버 데이터는 변경하지 않았고 검사 뒤 새로고침해 표시 상태 복원 |
| 모바일과 가까운 시점 진입 | 390×844·마지막 스크롤 시점에서 성문으로 접근 후 /library 이동. 가로 넘침 없음. `/tmp/nerd-entry-mobile-flight.png`, 최종 시작 화면 `/tmp/nerd-entry-final-mobile-home.png`. 데스크톱 초기 진입 `/tmp/nerd-entry-motion.png` |
| 취소·키보드·새 탭 동작 | 키보드 Enter로 시작하고 Escape 취소 후 1300ms 이상 경과해도 홈 유지·push 0·mask 0·원래 CTA focus 유지. Ctrl/Meta/Shift/Alt 클릭 모두 홈 handler가 preventDefault 하지 않는 것을 확인 |
| 정적 대안·GPU 오류 | reduced-motion=true에서는 image 모드이며 클릭 후 약 31ms에 /library 이동. 실제 WEBGL_lose_context 후 image 모드에서도 약 31ms에 이동. 1.2초 연출 대기 없음 |
| 복귀·정리 | 실제 뒤로 가기 후 WebGL canvas 1개·entering=false·mask 0. 화면 이탈 후 홈 canvas/overlay 0개. 최종 새로고침 뒤 브라우저 page errors 0 |
| 프로젝트 검사 | frontend ci:all exit 0: 96 tests·lint·types·stubs·health-path·build. 이후 안내 문구 1문장 수정은 최종 모바일 화면과 foreground npm run lint exit 0으로 확인. git diff --check 통과. 5502 홈/health 및 5501 health 모두 200 |

모바일 검증은 Chromium의 뷰포트 변경이며 실제 기기/Safari 검증은 아니다. QA 스크립트의 최상위 변수 재선언 오류는 IIFE로 범위를 분리해 해결했고, 실패한 캡처는 증거에서 제외했다. 기존 스크롤 감상·로그인 경로를 유지했고 공유 컴포넌트/대상 페이지/백엔드를 변경하지 않았다. main 서버를 계속 실행하며 커밋·푸시·배포하지 않았다.

---

# Three.js 팝업 동화책 Implementation Plan — 2026-09-16

**Goal:** 홈을 실제 입체 책·마을·성으로 구성하고 스크롤 카메라가 그 안으로 들어가게 한다.
**Architecture:** 홈의 HTML 문구·CTA·스크롤 제어를 재사용한다. 지연 로드한 Three.js 렌더러와 절차적으로 생성한 메시를 별도 모듈로 분리하고 기존 이미지 화면은 그래픽 초기화 실패·모션 줄이기의 대안으로 유지한다.
**Tech Stack:** 기존 Next.js/React, 사용자가 요청한 three 0.186.0 및 동일 버전 @types/three. 유료 자산·영상과 추가 프레임워크는 사용하지 않는다.
**Spec:** 사용자 요청 — Three.js로 진짜 3D 목업 느낌, 동화 속으로 들어가는 몰입감.

## Global Constraints

- 홈 및 해당 frontend dependency/lockfile만 변경한다. 전역 헤더·서재·촬영·리더·백엔드·인증 계약은 유지한다.
- 파랑 CTA·56px 터치·키보드·reduced-motion을 보존한다. 실 GPU가 없는 환경에서도 동화 진입이 가능해야 한다.
- 카메라/렌더는 기존 rAF 흐름에서 필요할 때만 실행한다. 화면 이탈·늦은 import·context loss에서 GPU 자원을 정리한다.
- 현재 main 변경을 보존하고 커밋·푸시·배포하지 않는다.

### Task 1: 실제 입체 동화책 모델과 카메라

**Files:** 새 apps/front/app/book-model.ts, book-camera.ts 및 book-camera.test.ts, apps/front/package.json과 pnpm-lock.yaml.
**Interfaces:** createBookModel()은 Group을 반환한다. bookCamera(progress, aspect)는 카메라 위치·시선·화면 오프셋을 반환한다.
- [x] 곡면 페이지·책 두께·종이 층·나무·집·다리·성을 실제 geometry와 material로 구성한다.
**Acceptance criteria:** 카메라 각도가 달라져도 두께·겹침·그림자가 실제 공간을 따르고 책 전체 → 마을 → 성으로 연속 이동한다.
**Verification:** 카메라 시작/중간/끝·역방향·모바일 프레이밍 tests와 실제 WebGL 화면 확인.

### Task 2: 홈 연결과 자원 수명

**Files:** 새 apps/front/app/book-world.ts, 기존 HomeWorld.tsx·HomeWorld.module.css.
**Interfaces:** createBookWorld(canvas)의 render(frame)·dispose()를 HomeWorld의 rAF/cleanup에 연결한다. render 성공 시에만 이미지 대신 canvas를 표시한다.
- [x] 지연 로드·반응형·HTML 안내/버튼·정적 대안·GPU context loss/recovery·해제를 연결한다.
**Acceptance criteria:** 모바일·키보드 조작 가능, 재진입 중 중복 canvas/RAF 없음, 생성 실패·context loss에서 이미지와 CTA 유지.
**Verification:** 브라우저 canvas/실제 geometry/스크롤·포인터·3뷰포트·context loss/recovery·화면 이탈 검사.

### Task 4: 사용자 추가 승인 — 목업 디테일 보강

**Files:** book-model.ts, book-world.ts 및 기존 camera/스타일 파일.
**Interfaces:** 실제 geometry/material을 유지하며 그림자 바닥·책 표지 금박·지붕 곡선·성벽/창문 장식·꽃을 보강한다. 반복 꽃은 InstancedMesh로 묶는다.
- [x] 가까운 장면에서 드러나는 디테일과 스튜디오 조명을 개선한다.
**Acceptance criteria:** 책과 건물의 실루엣이 뚜렷하고 종이·표지·식물의 재질을 구분할 수 있다. CTA와 문구를 가리지 않으며 추가 디테일은 모바일 렌더 부담을 제한한다.
**Verification:** 최종 desktop/tablet/mobile 장면 비교, geometry/draw 수 확인, pointer/scroll 프레임과 최종 frontend ci:all.

### Task 3: 품질 검증과 기록

**Files:** 위 홈 파일, tasks/todo.md.
- [x] 시각 검토·frontend ci:all·foreground lint·서버 헬스를 확인했다. 추가 요청 구현 후 최종 diff 검사도 통과했다.
**Acceptance criteria:** 입체 책이 주인공으로 보이며 가로 넘침·문구/버튼 겹침이 없다. 검사 통과, main 서버 계속 실행.
**Verification:** npx --yes pnpm@10.26.2 front ci:all, frontend npm run lint, git diff --check, 5502/5501 health 200. 실제 모바일 하드웨어 검증 여부는 별도 명시한다.


## Verification Story — 실제 3D와 디테일 보강

- Three.js 0.186.0의 실제 geometry로 곡면 페이지·종이 층·표지·마을·성을 구성했다. 창문 프레임·성벽·문손잡이·곡선 지붕·금박 선·꽃을 보강했다.
- Desktop 1440×900·tablet 1024×768·mobile 390×844에서 시각 확인. 최종 캡처: `/tmp/nerd-three-final-desktop.png`, `/tmp/nerd-three-final-close.png`, `/tmp/nerd-three-final-mobile.png`, `/tmp/nerd-three-roof-fixed.png`. 가로 넘침 없음, 모바일 CTA/장면 버튼 높이 56px 및 화면 내 노출 확인.
- 실제 WebGL context loss 시 이미지로 전환, restore 시 WebGL·그림자 복구. 초기 WebGL 실패에서도 이미지·CTA 유지. SPA 이탈 후 canvas 0개·이전 context 해제 확인.
- Tab/Enter로 두 번째·세 번째 장면 이동. 모션 줄이기에서는 canvas 숨김·정적 이미지·3개 제목 모두 접근 가능. 원래 설정으로 복원했고 브라우저 page errors 0건.
- geometry 유효 좌표 확인, 지붕의 안쪽 법선 0개, 삼각형 65,700개·컬링 전 draw call 163개. 반복 꽃 72개는 2개 InstancedMesh로 처리했다.
- 로컬 Chromium 1024×768의 90프레임 스크롤 측정: 중앙값 16.7ms·p95 16.8ms. 실제 모바일 기기 성능/Safari는 미검증.
- frontend ci:all exit 0: 94 tests·lint·types·stubs·health-path·build 통과. 별도 foreground npm run lint exit 0. 5502 홈/health와 5501 health 모두 200. main 서버 유지, 커밋·푸시 없음.

---

# 동화 마을 스크롤 홈 Implementation Plan — 2026-09-15

**Goal:** 홈에서 동화 마을·숲속 도서관·마법의 책을 여행한 뒤 기존 동화 읽기/개인화 흐름으로 들어간다.
**Architecture:** 홈 전용 스크롤 스테이지와 CSS Module을 둔다. 기존 AuthCta·ActionLink·인증 라우팅을 재사용한다.
**Tech Stack:** Next.js 16.3.3, React 19, 기존 Tailwind/CSS Module, native scroll와 requestAnimationFrame, 생성 이미지. 유료 영상 없이 승인된 이미지 기반으로 구현한다.
**Spec:** 사용자 승인 — scroll-world 느낌의 둥근 클레이 동화 마을, 따뜻한 파스텔, 느린 이동, 홈 3~4개 장면과 항상 접근 가능한 동화 시작 버튼.

## Global Constraints

- 홈이 작업 범위다. 공통 헤더·서재·촬영·독서·백엔드를 별도로 재설계하지 않는다.
- 최소 56px 터치 영역, 키보드 이동, 모바일 390×844·태블릿 1024×768·데스크톱 1440×900을 지원한다.
- 자연스러운 브라우저 스크롤을 사용하고 모션 줄이기에는 정적 장면을 제공한다.
- 기존 파랑 CTA·로그인별 AuthCta를 재사용한다. 매 스크롤마다 React state를 갱신하거나 새 runtime 의존성을 기본으로 추가하지 않는다.
- 사용자가 이미지 기반 진행을 승인했다. 세 이미지의 확대·이동·크로스페이드로 깊이감을 표현하며 실제 3D 카메라 영상으로 소개하지 않는다.

### Task 1: 동화 세계 자산과 화면 구성

**Files:** `apps/front/public/images/home-world/`의 신규 생성 이미지, `tasks/todo.md`.
**Interfaces:** 텍스트 없는 이미지와 HTML 문구를 분리한다. 마을 → 숲속 도서관 → 펼쳐진 마법의 책의 순서를 사용한다.
- [x] 동화 마을·도서관·마법의 책 콘셉트 이미지를 기본 imagegen 도구로 생성하고 WebP 자산으로 준비한다.
- [x] 사용자 승인에 따라 유료 영상 없이 이미지 기반 제작을 확정한다.
**Acceptance criteria:** 둥근 클레이·따뜻한 파스텔·책이 중심인 세계가 일관되며 실제 사용 자산이 public에 있다.
**Verification:** 생성 이미지 직접 확인, 파일 크기/형식 검사. 세 이미지 합계 약 430KB이며 로컬 URL에서 200 응답을 확인했다.

**Asset evidence:** `public/images/home-world/village.webp`, `library.webp`, `magic-book.webp`. 세 원본 이미지를 직접 확인했고 원본은 기본 생성 이미지 경로에 보존한다. 프로덕션 자산은 설치된 sharp로 크기·WebP 압축만 적용했다. 공통 프롬프트 방향: text-free landscape, tactile matte clay, warm ivory/sage/pale-blue/apricot, quiet space for HTML headings. 첫 장면은 숲길과 파랑 지붕 도서관, 두 번째는 같은 도서관 내부의 큰 책, 세 번째는 같은 책에서 솟아난 팝업 동화 세계다. 실제 영상이나 카메라 이동 클립은 사용하지 않는다.

### Task 2: 스크롤 홈 연결

**Files:** `apps/front/app/page.tsx`, 새 `apps/front/app/HomeWorld.tsx`, 새 `apps/front/app/HomeWorld.module.css`; 스크롤 계산 분리가 필요하면 새 `apps/front/app/world-progress.ts` 및 `.test.ts`.
**Interfaces:** HomeWorld는 children으로 기존 인증별 진입 버튼을 받는다. 진행 위치를 stage ref의 CSS 변수와 현재 장면 표시에 반영한다. 이미지에 깊이감·이동·크로스페이드를 적용한다. 기본 HTML과 모션 줄이기/낮은 화면에서는 장면을 세로로 모두 노출한다. 동화 진입 버튼은 계속 접근 가능하고, 향상된 모드에서는 장면 이동 버튼을 제공한다.
- [x] 이미지 기반 스크롤 여행·장면 이동·항상 접근 가능한 기존 동화 진입을 구현한다.
**Acceptance criteria:** 세 장면과 마지막 초대가 순서대로 보이고 위로 스크롤하면 되돌아간다. 새로고침·회전·모션 줄이기·키보드 접근에서 내용을 잃지 않는다.
**Verification:** 진행 구간 경계·clamp 계산 테스트, 브라우저 실제 스크롤/링크/인증 표시 검증.

### Task 3: 반응형·동작 검증

**Files:** 위 홈 파일과 `tasks/todo.md`.
- [x] 3개 화면 크기, 모션 줄이기, 키보드, 이미지 실패와 진입 링크를 확인하고 frontend ci:all·diff·서버 헬스를 검증한다. 추가 3D 보강 후 최종 검증을 다시 수행한다.
**Acceptance criteria:** 가로 넘침·읽을 수 없는 겹침 없음, 끝까지 스크롤하지 않아도 동화 선택 가능, 검사 통과.
**Verification:** `npx --yes pnpm@10.26.2 front ci:all`, frontend `npm run lint`, `git diff --check`, localhost 5502 및 5501 health 200. 첫 시각 검토 뒤 수정사항을 모아 최종 한 번 더 확인한다.

### Task 4: 추가 피드백 — 원근감과 입체적인 움직임 보강

**Files:** 기존 홈 전용 HomeWorld.tsx·HomeWorld.module.css·world-progress.ts 및 테스트, tasks/todo.md.
**Interfaces:** 생성 이미지의 원본 비율을 유지해 원근 투영하고 가까운 빛 입자를 별도의 깊이에 배치한다. 데스크톱 포인터와 스크롤을 하나의 rAF에서 처리하고 텍스트/버튼은 고정한다. 새 runtime 의존성이나 유료 영상은 추가하지 않는다.
- [x] 도서관 문 → 도서관 내부 → 펼쳐진 책 안으로 깊게 진입하는 스크롤 카메라와 빛 입자의 시차·문구 페이드를 구현한다.
- [x] 스크롤·포인터 경계·복귀·터치 입력/모션 줄이기·레이어 가장자리를 확인하고 frontend ci:all·foreground lint·diff·헬스를 최종 검증한다.
**Acceptance criteria:** 도서관 문과 책이 각각 진입 초점이며 확대/장면 전환 중 문구는 옅어진다. 앞쪽 빛 입자와 동화 배경이 다른 깊이에서 움직이며, 손을 떼면 안정적으로 돌아온다. 모바일은 스크롤로 입체감을 표현하고 조작·문구의 가독성을 유지한다.
**Verification:** 카메라 좌표/범위 순수 함수 tests, 3개 뷰포트의 브라우저 변환 행렬·포인터/스크롤·정적 대안 및 최종 시각 확인.

## Verification Story — 스크롤 홈, 2026-09-16

| 수용 기준 | 근거 |
|---|---|
| 마을 → 도서관 → 책 속 세계 진입 | 브라우저에서 0 → 0.25 → 0.5 → 0.7 → 1 → 0 진행·역방향 재현. 최대 배율 2.8 / 2.6 / 1.8, 도서관 문·책·성 위치로 이동. 이동 구간 문구 opacity 0, 도착 후 1 확인 |
| 3D 원근과 깊이 | CSS perspective 1100px, 포인터에 따른 matrix3d 변화, 빛 입자 translateZ 40~180px 확인. 포인터 이탈 후 기울기 0.01도 이내 복귀. 터치 PointerEvent는 기울기 0 유지 |
| 반응형·가장자리 | 1440×900·1024×768·390×844에서 가로 넘침 없음. 모바일에서 확대 전 잘라 놓은 이미지 때문에 생긴 오른쪽 빈틈은 원본 비율의 전체 이미지 plane을 이동한 뒤 stage에서 잘라 해결. 최종 /tmp/nerd-home-world-door-mobile-fixed.png, /tmp/nerd-home-world-final-mobile-fixed.png, /tmp/nerd-home-world-final-desktop-fixed.png |
| 계속 접근 가능한 진입 | 전체 스크롤 위치에서 56px 동화 CTA 노출. 동화/개인화 링크는 /library, 비로그인 링크는 /login 이동 확인. 인증 슬롯은 DOM의 data-session을 바꿔 표시만 확인했으며 실제 로그인이나 AI 생성은 하지 않음 |
| 키보드·모션 줄이기 | Tab → 장면 버튼 → Enter로 두 번째 장면 이동 및 focus-visible 링 확인. reduced-motion에서 모든 장면 접근 가능, 카메라/이미지 transform none, 빛 입자 숨김. 낮은 844×390 화면은 정적 배치로 전환 |
| 이미지 실패·가독성 | 잘못된 data 이미지로 3장 모두 naturalWidth 0을 확인해도 문구·/library CTA·종이 배경 유지. 홈 CTA의 파랑을 기존 토큰으로 진하게 보정해 작은 흰 글자 대비를 높임 |
| 프로젝트 검증 | 최종 frontend ci:all exit 0: 90 tests·lint·types·stubs·health-path·build 통과. 별도 foreground npm run lint exit 0. 브라우저 page errors 0, diff check 통과, 5502·5501 health 200 |

이미지 기반 카메라 연출이며 실제 3D 모델이나 연속 촬영 영상은 아니다. 과도한 확대 구간에서는 원본 이미지 해상도에 따른 부드러움이 남는다. 반응형 검증은 Chromium의 뷰포트 변경으로 수행했고 실제 모바일 Safari 하드웨어는 검증하지 않았다. 세 자산은 합계 429,664 bytes이며 새 의존성·유료 영상·백엔드 변경은 없다. main 개발 서버를 유지하고 커밋·푸시하지 않는다.

## Risk & Rollback

실제 영상 제작에는 외부 서비스 인증·비용이 필요하며 자동 설치·결제를 하지 않는다. 이미지 기반을 선택하면 실제 카메라 이동 영상으로 표현하지 않는다. main에서 검토 가능한 변경을 만들고 커밋·푸시·배포는 이번 요청에 포함하지 않는다. 기존 기록은 아래에 보존한다.

---

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

## 다음 작업 상태

- [ ] **D10 사용자 데이터 삭제 구현**
  - 책 삭제 시 DB의 세션·분기·대화와 스토리지의 레퍼런스 이미지·개인화 삽화·캐릭터 답변 MP3를 함께 제거한다.
  - 계정 탈퇴 시 사용자의 모든 책에 같은 삭제를 적용한 후 계정을 제거한다. 현재는 탈퇴 API가 없고 책 삭제도 DB만 지우므로 구현·보상 삭제·재시도 테스트가 필요하다.
- [ ] **리더 평가용 `보기 설정` 정리**
  - `chat`/`immersive` 쿼리와 설정 UI를 정식 기능으로 채택하거나, 현재 기본값으로 고정하고 제거한다.
- [x] **완성 동화 리더 헤더 네비게이션 문제 종료 (2026-09-16)**
  - 완성 세션에서 `← 제작 현황 보기`가 노출되던 문제는 `isAllCompleted`와 `status === 'completed'` 가드로 이미 해결됐다.
  - 별도의 “상태 머신 전역 리팩토링”은 재현 가능한 문제와 수용 기준이 없어 작업으로 유지하지 않는다. 새 상태 전환 결함이 발견되면 그 시나리오를 기준으로 다시 연다.

## 2026-09-16 작업 완료 내역

- [x] **캐릭터 말풍선 핀(Speech Bubble Pin) 인터랙션 구현 (피드백 5 고도화 완료)**
  - **결정 배경**: 단일 통 이미지 특성상 캐릭터 실루엣 외곽선 발광의 한계를 극복하기 위해, 사용자와의 Grilling 세션을 통해 직관적이고 친근한 **"부유형 마법 말풍선 핀"** 방식으로 전면 개편.
  - [x] **어색한 타원 테두리 제거**: 기존 `.hotspot::before`의 달걀형 타원 테두리 선 및 `hotspotPulse` 애니메이션 완전 제거.
  - [x] **부유형 말풍선 핀 (`[ 💬 ]`)**: 캐릭터 우측 상단(어깨/머리 대각선 위)에 작고 귀여운 말풍선 핀을 상시 부유 배치 (`@keyframes bubbleFloat` 2.5s ease-in-out infinite alternate).
  - [x] **호버/포커스/활성화 확장**: 마우스 호버 또는 키보드 포커스 시 `grid-template-columns: 0fr -> 1fr` 트릭을 활용해 캐릭터 이름 캡슐(`[ 💬 {이름} ]`)로 부드럽게 확장.
  - [x] **스타일링**: 크림색 종이 배경(`var(--color-paper)`), 따뜻한 마법 금빛 테두리(`var(--color-gold)` / `var(--color-gold-strong)`), 소프트 드롭 섀도우.
  - [x] **상호작용 영역**: 말풍선 핀뿐만 아니라 기존 캐릭터 히트박스(몸체) 전체를 투명 클릭/터치 가능 영역으로 유지하여 아동 및 모바일 터치 편의성 확보.
  - [x] **모듈화 및 결합도 완화**: `CharacterHotspots.module.css`를 신설하여 핫스팟 전용 스타일을 캡슐화하고 `BookFrame.module.css`와의 결합도를 제거함.
  - [x] **접근성 & 모션 감축**: `aria-label`, `aria-pressed`, `aria-expanded`, `:focus-visible`, `prefers-reduced-motion` 완벽 지원.
  - [x] **위치 미세 조정 (얼굴 가림 방지)**: 말풍선 핀 기본 위치를 우측으로 20px 추가 이동(`inset-inline-end: -2rem`), 상단으로 살짝 이동(`inset-block-start: -1rem`)하여 잭과 콩나무 4쪽 등 캐릭터의 얼굴과 겹치지 않고 우측 어깨 바깥 여백에 자연스럽게 뜨도록 보정.
  - [x] **검증**: `pnpm ci:all` 전체 통과, 프론트엔드 Vitest 91개 테스트, ESLint, Next.js 빌드 및 독립 reviewer / qa-engineer 전원 PASS.

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

# 이전 완료 기록: 얼굴 등록 화면 UI/UX 개선 — 2026-09-15

**Goal:** 정면 사진 한 장으로 시작하는 흐름을 아이가 이해하기 쉬운 동화 속 촬영 공간으로 다듬는다.
**Architecture:** 기존 하늘·풀밭 배경과 파랑 CTA를 유지한다. 촬영 표현은 라우트 전용 `CaptureStudio`와 CSS Module로 분리하고, 사진·세션·카메라 상태는 기존 페이지가 소유한다.
**Spec:** 사용자 요청 — 현재 촬영 페이지의 투박함을 줄이고 아이들이 좋아할 UI/UX로 개선. 정면 한 장, 사진 이용 안내를 유지한다.

## Design / Acceptance Criteria

- 태블릿에서는 동화책 친구·짧은 안내와 촬영 공간을 나란히 배치하고, 모바일에서는 한 열로 읽히게 한다.
- 추가 피드백: 왼쪽은 큰 제목·짧은 설명·책 캐릭터·사진 이용 안내로 단순화한다. 작은 제목·말풍선·촬영 팁을 제거하고 오른쪽은 유지한다.
- 직접 그린 SVG 책 캐릭터, 부드러운 사진 프레임, 친근한 문구를 사용한다. 시스템 폰트·기존 색상·버튼 위계와 최소 56px 타깃을 유지한다.
- 페이지 진입만으로 카메라 권한을 요청하지 않는다. 사용자가 카메라 켜기를 눌러 시작하며 파일 선택은 항상 대안으로 제공한다.
- 사진 선택 전에는 촬영/카메라 켜기, 선택 후에는 이 얼굴로 만들기가 주 동작이다. 재촬영·파일 교체·오류·대기·완료·기존 동화 복원 흐름을 유지한다.
- 사진 이용 안내는 카메라 조작 전에 보이고, 정면 한 장만 제출한다. 모션 줄이기 설정을 존중한다.

### Task 1: 촬영 경험과 상태 화면 개선

**Files:** `apps/front/app/(trial)/stories/[slug]/capture/page.tsx`, 새 `CaptureStudio.tsx`, 새 `CaptureStudio.module.css`(같은 라우트).
**Interfaces:** `CaptureStudio`는 미리보기 URL·카메라/제출 상태·오류·DOM ref 및 조작 콜백을 받는다. 세션 API·사진 버퍼와 FormData 처리는 페이지가 유지한다.
- [x] 촬영 스튜디오·동화책 친구·반응형 레이아웃·명시적 카메라 시작과 상태 화면을 구현한다.
**Verification:** 사진 1개 FormData 유지, 클릭 전 카메라 요청 0회, 카메라 접근 실패와 화면 이탈 시 스트림 정리.

### Task 2: 화면·상호작용 검증

**Files:** 위 UI 파일과 기존 frontend 검증 명령, `tasks/todo.md`.
- [x] 합성 카메라·API로 촬영/재촬영/파일/제출 대기/실패/성공/기존 세션을 확인한다. 1024×768·1440×900·390×844에서 화면과 키보드/모션 줄이기를 검증한다.
- [x] frontend ci:all, foreground lint, diff 검사와 실제 개발 서버 헬스체크를 통과하고 근거를 기록한다.
**Verification:** `npx --yes pnpm@10.26.2 front ci:all`, frontend 폴더에서 `npm run lint`, `git diff --check`, 브라우저 요청·화면 검증. 첫 시각 검증 후 필요한 수정은 한 번에 모아 최종 확인한다.

## Risk & Rollback

기존 카메라 자동 시작을 명시적 시작으로 바꾸므로 재촬영·세션 복원·늦은 권한 응답을 확인한다. 실제 DB·유료 생성·개인 사진을 검증에 사용하지 않는다. 작업 범위는 촬영 페이지이며 전역 스타일·백엔드·의존성은 변경하지 않는다. 기존 변경을 보존하며 커밋·푸시·배포하지 않는다.


## Verification Story — UI/UX 개선

| 수용 기준 | 근거 |
|---|---|
| 아이 친화적인 촬영 공간·왼쪽 단순화 | 태블릿 2열·모바일 1열을 확인. 추가 피드백에 따라 작은 제목·말풍선·3개 촬영 팁을 제거하고 설명을 한 문장으로 축약. `/tmp/nerd-capture-simple-left-tablet.png`, `/tmp/nerd-capture-simple-left-mobile.png` |
| 촬영 시작을 직접 선택 | 진입 시 비디오·자동 카메라 요청 없음, 버튼 선택 후 요청 1회. 카메라 거부 시 한국어 오류와 사진 선택 대안 표시 |
| 사진 한 장·재촬영·교체 | 촬영 후 다시 찍기로 미리보기 복귀. 확인한 FormData 2건 모두 `front.jpg` 1개: 촬영 640×640 JPEG, 파일 교체 후 1024×768 JPEG. 선택한 파랑 합성 이미지의 픽셀 확인 |
| 대기·실패·성공 | 제출 중 3개 버튼 잠금, 실패 알림 후 사진 유지·재시도 가능. 성공 후 `sessionId`·`autoStart=true` 링크와 결과 화면 확인 |
| 카메라 정리 | 파일 선택 후 활성 track 종료. 권한 대기 중에도 파일 선택 가능, 늦게 도착한 stream의 track 즉시 종료. SPA 화면 이탈 시 track `ended` 확인 |
| 기존 동화·키보드·모션 | completed/face_ready 복원, 결과 제목으로 focus 이동, 읽기 링크·삭제 확인 취소 보존. Tab 포커스 링·Enter 카메라 시작·56px 버튼·reduced-motion에서 animation none 확인 |
| 반응형·사진 이용 안내 | 1440×900·1024×768·390×844에서 가로 넘침 없음. 모바일 주요 버튼 하단 약 820px. 사진 안내가 조작 영역보다 먼저 읽힘 |
| 프로젝트 검증 | 최종 frontend ci:all 통과: 79 tests·lint·types·build. 별도 foreground `npm run lint` exit 0, `git diff --check` 통과, 5502·5501 health 200. 브라우저 page errors 0 |

브라우저 촬영은 합성 카메라·색상 이미지로 확인했다. 생성·업로드 요청과 세션 복원은 페이지의 fetch 응답을 대체했고 실제 유료 생성·DB 변경은 하지 않았다. 브라우저 network route만으로는 일부 GET을 가로채지 못해 미로그인 조회 401이 관찰되었으며, 세션 복원 검증은 fetch 대체 후 SPA 재진입으로 확인했다. 실제 사진의 생성 품질은 검증 범위 밖이다. main 개발 서버는 계속 실행 중이다.


## PR 준비 — 사용자 승인 2026-09-15

**Goal:** 현재 얼굴 등록 화면 변경을 main 대상 PR로 올리고 정면 단독 입력이 기존 이미지 합성 경로와 호환되는지 확인한다.
**Files:** 촬영 페이지 3개 파일과 `tasks/todo.md`. 백엔드·API 계약은 읽기/검증 범위다.
**Interfaces:** `front` 1장 → `generateReference` → 저장된 캐릭터 레퍼런스와 `baseImage` → `generatePageIllustration`.
- [x] 얼굴 입력·캐릭터 생성·삽화 합성의 연결과 기존 테스트를 검토한다.
- [x] 전체 `npx --yes pnpm@10.26.2 ci:all`, diff 및 공개 저장소에 올릴 파일 범위를 확인한다.
- [x] 작업 브랜치에 관련 변경을 커밋·푸시하고 main 대상 PR을 만든 뒤 원격 SHA·변경 파일·검증 상태를 확인한다.
**Verification:** 서비스·이미지 어댑터의 정면 단독/이미지 순서 tests, 전체 CI, PR head SHA와 로컬 SHA 일치. 실제 AI 생성 품질과 외부 서비스 상태는 별도로 구분한다.
**Risk & Rollback:** 사용자 요청으로 이번 변경의 커밋·푸시·PR 생성이 승인되었다. main 직접 푸시·머지·배포·운영 DB 변경은 수행하지 않는다.

**검증 결과:** 루트 ci:all exit 0. Frontend 79, backend unit 268, backend E2E 66 — 총 413 tests 및 lint·types·build 통과. `story-session.service.spec.ts:301`에서 정면 단독 입력으로 레퍼런스를 만들고, `openrouter-image.adapter.spec.ts:104`에서 삽화 1번·주인공 레퍼런스 2번 전달을 검증한다. Backend와 공유 계약 diff는 없다.

**확인된 한계:** 실제 유료 AI 생성과 얼굴 유사도·배경 보존 품질은 미검증이다. 기존 `story-session.service.ts:674`는 템플릿 다운로드 실패를 무시하고 생성하므로 이 예외 상황에서는 기존 구도 보존을 보장할 수 없다. 일반 모드는 얼굴을 먼저 캐릭터로 변환하며, `DIRECT_FACE_MODE=true` 테스트 옵션은 원본 사진을 직접 저장·사용하므로 원본 미보관 안내는 일반 모드 기준이다. 이 PR은 기존 합성 정책을 변경하지 않는다.

**PR:** [#53](https://github.com/kon6443/nerd-back/pull/53), `feat/front-single-photo-studio` → `main`. 관련 UI와 검증 기록만 포함하며 실제 AI 생성 품질의 미검증 범위·기존 예외 동작을 PR 본문에 명시했다.

---

# 정면 사진 한 장으로 동화 만들기 Implementation Plan

> 체크리스트로 구현과 검증을 추적한다. 현재 작업은 이 항목이며 아래 기록은 보존한다.

**Goal:** 얼굴 등록 화면에서 정면 사진 한 장만 촬영하거나 첨부한 뒤 동화를 만들 수 있게 한다.
**Architecture:** 촬영 페이지의 3방향 슬롯 상태를 사진 1개와 미리보기로 단순화한다. 기존 얼굴 생성 API의 필수 `front` 필드만 전송하고, 이미 정면 단독 입력을 지원하는 백엔드 계약을 재사용한다.
**Tech Stack:** Next.js 16.3.3, React 19, TypeScript, 기존 Tailwind UI, NestJS 단위 테스트.
**Spec:** 2026-09-15 사용자 요청 및 첨부 화면 — 정면 사진만으로 동화 생성.

## Goal & Acceptance Criteria

- 좌·우 촬영 칸과 다음 방향으로 자동 전환하는 동작을 제거한다.
- 사진이 없으면 제출할 수 없고, 촬영 또는 첨부 1회 후 즉시 미리보기와 제출 버튼을 사용할 수 있다.
- 다시 찍기·파일 교체가 정상 동작하며, 제출하는 multipart에는 `front` 사진 1개만 있다.
- 캐릭터 생성 성공 후 기존 동화 만들기 링크로 이어진다. 카메라 사용 불가·오류·기존 세션 안내를 유지한다.

## Existing Patterns / Source of Truth

- `apps/front/app/(trial)/stories/[slug]/capture/page.tsx`: 촬영·첨부·제출·완료 화면.
- `apps/back/src/modules/story-session/story-session.controller.ts`: 정면 필수, 좌우 선택인 기존 API.
- `apps/back/src/modules/story-session/story-session.service.spec.ts`: 정면 단독 입력으로 레퍼런스를 생성하는 기존 검증.
- `.claude/rules/front-code-patterns.md`: 기존 파랑 버튼 위계, 터치 영역 56px, 접근성 안내.

## Design (Minimal Approach + Key Decisions)

사진 하나를 고르고 확인하는 흐름으로 정리한다. 안내는 정면 사진 한 장임을 명시하고 촬영·파일 첨부를 모두 제공한다. 사진 교체·화면 이탈 시 미리보기 URL을 해제한다. 화면 디자인과 API·DB·이미지 생성 모델은 기존 구성을 사용한다.

### Task 1: 촬영 화면 단순화

**Files:** `apps/front/app/(trial)/stories/[slug]/capture/page.tsx`.
**Interfaces:** 기존 `uploadFace(sessionId, formData)`에 `front` 한 장을 보내고 `UploadFaceResponse` 성공 화면으로 전환한다.
- [x] 단일 사진 상태, 정면 안내, 미리보기·다시 찍기 및 단일 multipart 제출을 구현한다.
**Acceptance criteria:** 좌·우 선택 UI 없음, 한 장으로 제출 활성화, 교체 후 새 사진 제출, 완료 후 동화 제작 링크 유지.
**Verification:** 실제 브라우저의 촬영·첨부·다시 찍기·제출 요청 검사와 태블릿/모바일 화면 확인.

### Task 2: 동작·회귀 검증

**Files:** `tasks/todo.md`; 기존 frontend CI와 backend `story-session.service.spec.ts` 실행.
**Interfaces:** 브라우저 API 요청은 합성 응답으로 확인하고 기존 backend 정면 단독 입력 테스트를 실행한다.
- [x] 실제 브라우저에서 카메라·파일 첨부·사진 교체·정면 단독 요청·성공/실패 상태를 검증한다.
- [x] frontend ci:all, backend 정면 입력 관련 tests, diff 검사를 통과하고 결과를 기록한다.
**Acceptance criteria:** 1024×768 및 390×844에서 가로 넘침 없이 조작 가능, `front` 1개 요청 및 생성 완료 링크 확인, 기존 tests·lint·types·build 통과.
**Verification:** `npx --yes pnpm@10.26.2 front ci:all`; `npx --yes pnpm@10.26.2 back test --runInBand --testPathPatterns=story-session.service.spec.ts`; `git diff --check`.

## Risk & Rollback

카메라와 파일 선택의 기존 동작을 회귀 확인한다. 운영 DB·실제 유료 이미지 생성은 브라우저 검증에서 호출하지 않는다. 변경은 촬영 페이지 diff로 되돌릴 수 있다. 커밋·푸시·배포는 수행하지 않는다.

## Verification Story — 2026-09-15

정면 사진 1개의 상태와 미리보기만 사용하며, 좌·우 슬롯과 자동 이동을 제거했다. 성공 후 원본 미리보기를 비우고 다시 찍기·교체·화면 이탈 시 Object URL을 해제한다. 촬영 페이지 이외의 앱 소스는 변경하지 않았다.

| 수용 기준 | 검증 근거 |
|---|---|
| 정면 사진 한 장 안내·좌우 칸 제거 | 실제 화면과 소스 잔존 심볼 검사. 정면 촬영 뒤 미리보기 1개, 제출 활성화 |
| 한 장만 전송 | 카메라 640×640 JPEG, 첨부 1600×1200 PNG→1024×768 JPEG. 검사한 요청 3개 모두 `front.jpg` 1개, `left`/`right` 없음 |
| 사진 교체·다시 찍기 | 촬영→다시 찍기 시 제출 비활성화·카메라 복귀, 파일 변경 및 같은 파일 재선택 성공, 이전 미리보기 URL 해제 확인 |
| 대기·실패·완료 | 요청 중 조작 잠금, 실패 시 role=alert·사진 유지·재시도 활성화. 성공 후 face_ready 화면과 sessionId·autoStart=true를 포함한 동화 제작 링크 확인 |
| 카메라 불가 | 카메라 접근 실패 후 파일 첨부만으로 미리보기·제출 활성화, 오류 안내 해제 확인 |
| 태블릿·모바일 | 1024×768·390×844에서 가로 넘침 없음. 모바일 조작 버튼 높이 56px, 긴 대기 문구 넘침 없음. `/tmp/nerd-single-photo-tablet.png`, `/tmp/nerd-single-photo-mobile.png` 확인 |
| 회귀·실행 상태 | frontend ci:all 통과(79 tests, lint/types/build), backend story-session.service 30 tests 통과, git diff --check 통과. 5502·5501 헬스체크 200 유지 |

브라우저는 합성 카메라·이미지와 API 응답 대체를 사용했고 `/api/v2/**` 실제 네트워크 요청을 차단했다. 운영 DB와 유료 이미지 생성은 호출하지 않았다. 실제 얼굴 사진에 대한 생성 품질은 이번 검증 범위에 포함하지 않았다.

---

# 이전 작업: 동화 낭독·캐릭터 답변 TTS

> 상태: **구현·운영 DB 적용·정적 낭독·캐릭터 답변 TTS 확인 완료 (2026-09-16)**
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
- [x] Task 7 — 전체 검증과 운영 게이트
  - 완료: backend·frontend CI, diff/check, PR #50 병합·배포, 공유 DB 마이그레이션, 실제 OpenRouter TTS 동작.
  - 2026-09-16 사용자가 정적 낭독과 캐릭터 답변 TTS의 실제 동작을 확인했다. 기존 공식 동화·A/B·채팅 흐름을 포함한 TTS 작업을 종료한다.
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
