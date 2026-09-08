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
