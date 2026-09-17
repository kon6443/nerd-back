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
- [ ] 로컬 통합 검증을 통과했으며, feature branch push·PR 생성·원격 상태 확인을 진행한다.
**Acceptance criteria:** 로컬 프로젝트 검사 통과, PR URL 제공, main과 병합 가능 여부와 CI 상태를 사실대로 보고한다.
**Verification:** staged paths·diff check·커밋, origin/main 최신 여부 재확인, gh pr view/checks 및 remote branch SHA 확인.

## Integration verification — 최신 main

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
