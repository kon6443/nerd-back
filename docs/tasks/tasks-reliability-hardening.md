# 제작 진행 피드백과 전수조사 결함 수정

> 상태: **진행 중** (착수 2026-09-16)
> 발단: 전수조사(세션 1회) + 사용자 질문 「이미지 생성이 오래 걸리는데 진행 피드백·실패 표시가 되는가」
> 이 문서가 이 작업의 **SSOT** 다. 진행 상황·결정 근거는 전부 여기에 적는다.
> 브랜치: `fix/generation-feedback-and-hardening` — `main`(`8be01d2`, PR #55) 에서 분기.

---

## 파악 결과 — 제작 진행 피드백은 이미 있다

사용자 질문에 대한 답부터. **로딩바도 페이지별 현황도 이미 구현되어 있다.**

| 계층 | 무엇을 주는가 | 위치 |
|---|---|---|
| 백엔드 | `status`(draft/face_ready/generating/completed/failed) · `totalPages` · `completedPages` · `isMainStoryReady` · `isAllCompleted` · 페이지별 `status`/`imageUrl`/`errorMessage` | `GET /sessions/:id/pages` — `story-session.service.ts:585` |
| 계약 | `sessionPagesResponseSchema` | `packages/contracts/src/session.ts:83` |
| 폴링 | 겹침 없는 `setTimeout` 재귀 + 연속 실패 시 `degraded` | `read/usePolling.ts` |
| 화면 | 진행률 바 · 페이지별 카드(완성/그리는 중/대기/실패) · 실패 시 「다시 만들기」 · 연결 불안정 경고 | `read/GeneratingView.tsx` |

**소요 시간**: 이미지 장당 1분 이상(`lib/api/client.ts:71` 주석, qwen-image-3). 템플릿 7장을 `CHUNK_SIZE = 4` 로 2청크 처리하므로 정상 경로에서도 **2분 이상**이 든다.

### 그래서 진짜 문제는 "실패가 실패로 보이지 않는 것"

오래 걸리는 것 자체는 화면이 설명한다. 문제는 **끝나지 않는 경우를 사용자가 구분할 수 없다**는 것이다. 네 갈래다.

1. **얼굴 미등록(`FACE_NOT_READY`)** — 프론트가 에러를 `console.warn` 으로 삼켜(`read/page.tsx:293`), 진행률 0%인 "만들고 있어요" 화면이 영원히 돈다.
2. **파이프라인 선행 실패** — 스토리지 다운 등으로 레퍼런스 다운로드가 실패하면 최상위 `catch` 가 로그만 남기고(`story-session.service.ts:774`) 세션은 `generating`, 페이지는 전부 `pending` 으로 굳는다. 재시도 API 는 `pending` 을 거절한다(`:663`).
3. **이미지 생성 무한 대기** — 이미지 `fetch` 에만 `AbortSignal.timeout` 이 없어(`openrouter-image.adapter.ts:227`) 한 장이 매달리면 `await Promise.all`(`:720`)이 풀리지 않아 진행률이 중간에서 멈춘다.
4. **세션 전체 실패를 화면이 알리지 않는다** — `checkAndUpdateSessionCompletion` 은 `status='failed'` 로 전이시키는데(`:869`), `GeneratingView` 는 페이지별 상태만 보고 제목은 계속 "나만의 동화책을 만들고 있어요" 다. 백엔드가 주는 `errorMessage` 도 화면에 렌더되지 않는다.

---

## Goal & Acceptance Criteria

**달성할 것**: 제작이 실패하거나 멈췄을 때 사용자가 **그 사실을 알고 다음 행동을 할 수 있다.** 더불어 전수조사에서 나온 명백한 결함을 고친다.

**수용 기준**
- 얼굴 미등록 세션으로 리더에 들어오면 무한 로딩이 아니라 **원인과 다음 행동**이 보인다.
- 파이프라인이 선행 단계에서 실패하면 세션이 `failed` 로 전이하고, 사용자는 재시도할 수 있다.
- 이미지 생성 한 장이 매달려도 정해진 시간 안에 실패로 떨어져 나머지 장이 계속 진행된다.
- 세션 전체가 실패하면 제작 현황 화면이 "만들고 있어요"가 아니라 실패를 말한다.
- `pnpm ci:core` 통과, 경고 수를 늘리지 않는다.

**비목표 — 이번에 하지 않는다** (판단이 필요해 사용자 확인 대기)
- A/B 두 분기 선제 생성(`:710`) 유지 여부 — 유료 호출 2배지만 의도일 수 있다
- 레이트리밋 실제 값(20/120) vs 문서(5/60) 중 무엇이 정본인지
- `DIRECT_FACE_MODE` 운영 값과 Swagger 설명 불일치
- 얼굴 재업로드 시 기존 `succeeded` 삽화 무효화 — **동작 변경**이라 제품 결정이 필요
- 삽화 깜빡임(`BookPager.tsx:254`) — 브라우저 필름스트립 검증이 선행되어야 한다
- S3 키 접두사 비대칭 — 운영 버킷 실물 확인 필요

---

## Existing Patterns / Source of Truth

- **중복키 처리**: `isMysqlDuplicateKey` + `createOrResumeSession:292` · `story-chat.service.ts:114` 가 기존 패턴. `back-code-patterns.md` §14 「조회해서 없으면 저장으로 막지 않는다」.
- **외부 호출 타임아웃**: `STORY_CHAT_TIMEOUT_MS`(30s) · `OPENROUTER_TTS_TIMEOUT_MS`(30s) 를 모듈 상수로 두고 `AbortSignal.timeout` 에 넘긴다.
- **에러 노출 정책**: 내부 사정을 담은 예외는 `HttpException` 을 상속하지 않는다 — 필터 4단이 고정 메시지로 덮는다 (`lessons.md` 2026-09-04).
- **전역 필터 예외 케이스**: 응답 형식을 바꾸는 장치는 통과 케이스를 테스트로 고정한다 (`lessons.md` 2026-08-26).
- **회수 임계**: `STALE_RUNNING_MS = 10분`. 새 타임아웃은 이보다 **확실히 작아야** claim 회수와 정합한다.

---

## Design (Minimal Approach + Key Decisions)

**접근 요지**: 실패를 만들어내는 쪽(백엔드)에서 상태를 정확히 전이시키고, 보여주는 쪽(프론트)에서 그 상태를 그대로 그린다. 새 계약 필드를 늘리지 않고 **이미 있는 `status`·`errorMessage` 를 쓴다.**

**주요 결정**
- **이미지 타임아웃 120초** — TTS·채팅은 30초지만 이미지는 장당 1분 이상이 정상이다(`client.ts:71`). 2청크 × 120초 = 4분으로 `STALE_RUNNING_MS`(10분) 안에 들어온다. 30초로 맞추면 정상 요청을 죽인다.
- **파이프라인 선행 실패는 세션을 `failed` 로** — 페이지 행을 건드리지 않는다. `pending` 인 채로 두면 재시도가 막히므로, 재시도 게이트 쪽을 넓히는 대신 세션 상태로 신호를 준다. 페이지 행 일괄 변경은 다른 레플리카가 집은 것을 빼앗을 수 있다.
- **provider 오류 원문은 사용자에게 보내지 않는다** — 저장·응답에는 고정 메시지, 로그에는 상태코드만. 루트 `CLAUDE.md` 「외부 API 본문 로깅 금지」 + `lessons.md` 2026-09-04 유출 전례.

**트레이드오프**: 오류 원문을 지우면 운영 디버깅이 어려워진다. 상태코드와 `actionName` 은 남겨 최소 추적을 유지한다.

---

## Implementation Steps (Thin Vertical Slices)

### Slice 1 — 제작이 멈추지 않게 (백엔드) ✅ 2026-09-16
- [x] 1-1 이미지 생성 `fetch` 에 `IMAGE_GENERATION_TIMEOUT_MS = 120_000` 적용 — `openrouter-image.adapter.ts`. 타임아웃·연결 실패를 사용자 문구로 변환
- [x] 1-2 파이프라인 최상위 `catch` → `markPipelineFailed()` — 세션 `failed` + **`pending` 페이지만** `failed`(`running` 은 회수에 맡긴다). `save` 가 아니라 `update` 를 써서 동시 `uploadFace` 의 변경을 덮지 않는다
- [x] 1-3 provider 오류 원문을 응답·로그에서 제거 — 402/429 구분은 **로그에만** 남긴다
- [x] Verify: `pnpm back ci:core` **통과** (30 suites / 274 tests, 기존 270 + 신규 4)

**결정 기록**
- 기존 테스트 3건이 `'OpenRouter 크레딧이 부족합니다 (402)'` 같은 **문구 자체**를 고정하고 있었다. 그 문구가 사용자 브라우저까지 나가는 것이 결함이므로 테스트를 새 불변조건(**원문 미유출**)으로 갱신했다. `toThrow` 는 부분 일치라 뒤에 원문이 덧붙어도 통과하므로 `toMatchObject` 로 정확 일치를 요구한다.
- 타임아웃 시그널 전달 자체를 테스트로 고정했다 — 회귀하면 조용히 무한 대기로 돌아가고, 그건 화면에서만 드러난다.

### Slice 2 — 실패가 화면에 보이게 (프론트) ✅ 2026-09-16
- [x] 2-1 `personalizeSession` 실패를 `setErrorMsg` 로 올린다 — 기존 에러 화면에 이미 있는 「얼굴 다시 등록하기」가 그대로 복구 경로가 된다. **정상 흐름을 깨지 않음을 백엔드에서 확인**: `draft` 만 `FACE_NOT_READY` 를 던지고 `generating`·`completed` 는 멱등하게 성공을 준다(`story-session.service.ts:504-524`)
- [x] 2-2 `GeneratingView` — 세션 `status === 'failed'` 면 제목·문구를 실패로 바꾸고 배너(`role="alert"`) 표시, 페이지별 `errorMessage` 렌더
- [x] 2-3 `statusPinned` 플래그로 자동 복귀 억제 + `GeneratingView` 에 「지금 바로 읽으러 가기」 추가 (자동 복귀를 막았으니 **돌아갈 길을 대신 준다**)
- [x] Verify: `pnpm front lint` · `check:types` · `test` **통과** (15 files / 91 tests)

**미검증**: `statusPinned` 는 컴포넌트 상태라 현재 테스트 인프라(`environment: 'node'`, 컴포넌트 테스트 0건)로는 고정할 수 없다. 화면 확인이 남는다.

### Slice 3 — 명백한 백엔드 결함 ✅ 2026-09-16
- [x] 3-1 `FileFieldsInterceptor` 에 `limits: { fileSize: MAX_IMAGE_SIZE_BYTES, files: 3 }` — 상수를 `image-validator` 에서 가져와 **서비스 검증과 같은 값**을 쓴다(두 값이 갈리면 400/413 이 설명되지 않는다)
- [x] 3-2 `personalize` 페이지 행 생성과 `selectAfterStoryChoice` 에 `isMysqlDuplicateKey` 적용 — 경합을 500 이 아니라 **멱등한 정상 응답**으로 되돌린다
- [x] 3-3 `deleteSession` 이 삭제 **전에** 키를 모아 스토리지 객체를 정리. 스토리지 실패는 DB 삭제를 되돌리지 않는다(스토리지는 롤백되지 않으므로 지워진 것을 되살리는 쪽이 나쁘다)
- [x] 3-4 조회 경로 4곳을 `getOptionalPresignedUrl` 로 통일 — 업로드 직후 반환(`:517`)은 **제외**(그 URL 이 응답의 목적이라 조용한 `null` 은 성공으로 오해된다)
- [x] 3-5 로컬 스토리지 MIME 을 확장자로 추론 — 기존에는 SVG 외 전부 `image/png` 라 **`STORAGE_PROVIDER` 기본값(`local`)에서 낭독 mp3 재생이 조용히 실패**했다
- [x] Verify: `pnpm back ci:core` **통과** (30 suites / 276 tests)

### Slice 4 — 명백한 프론트 결함 ✅ 2026-09-16
- [x] 4-1 `safeRedirectPath()` 신설 — `//evil.example`(프로토콜 상대 URL)·`/\evil.example` 차단. 검증을 한 곳으로 모으고 **테스트 7건으로 고정**. 로그인 성공 경로도 `push` → `replace` 로 바꿔 뒤로가기가 막힌 것처럼 보이던 것을 함께 해소
- [x] 4-2 `StoryDetailArtwork` — 캐시 조회에 `loginId` 전달(소유자 검사 복구). 캐시를 **렌더 중 파생**으로 바꿔 계정이 바뀌면 저절로 무효가 되게 했다(지우는 것을 잊을 자리를 없앤다)
- [x] 4-3 본문 로드 실패를 바깥 `catch` 로 올려 기존 에러 화면(「다시 시도하기」)에 연결
- [x] 4-4 `BookPager` 키보드 핸들러에 `document.querySelector("dialog[open]")` 가드 — `<dialog showModal()>` 은 배경을 inert 로 만들지만 `window` 리스너는 그대로 받는다. dock 모드(`<dialog>` 아님)는 영향 없다
- [x] 4-5 `NarrationPlayer` — 실패를 `sr-only` 밖으로 꺼내 화면에 표시
- [x] 4-6 마이페이지 목록 실패에 오류 카드 + 「다시 불러오기」. 401 은 기존 리다이렉트에 맡긴다
- [x] 4-7 촬영 「동화로 돌아가기」를 `getLibraryStoryHref(slug, true)` 로 — **진입 경로 5곳이 모두 제작 흐름임을 grep 으로 확인**하고 상수 `true` 를 택했다
- [x] 4-8 `StoryDetailArtwork` 에 로그인 게이트 추가(공개 경로 401 누적 제거) + `handleLogout` 에 `catch`
- [x] Verify: `pnpm front lint` · `check:types` · `test` **통과** (16 files / 98 tests, 기존 91 + 신규 7)

### Slice 5 — 핫스팟 좌표와 터치 타깃 ✅ 2026-09-16
- [x] 5-1 `BookPager` 의 밑장에 `data-art-hold` 표시를 달고, `CharacterHotspots` 가 **그 장을 건너뛰고** 현재 쪽 `<img>` 를 집게 했다. 기존에는 `querySelector("img")` 가 문서 순서상 첫 번째 — 즉 넘김 잔상용 **직전 쪽 이미지** — 를 집어, 쪽마다 원본 해상도가 다르면 말풍선이 어긋나고 `load` 리스너도 엉뚱한 요소에 붙었다
- [x] 5-2 CSS 하한을 44px → **56px** 로 올려 `MINIMUM_TARGET_SIZE`(JS) 와 일치시켰다. 보통은 JS 인라인 스타일이 크기를 정하지만 컨테이너가 작아 클램프될 때는 이 하한이 남아, 그 경우에만 조용히 규약(아이 손가락 56px)을 밑돌았다
- [x] Verify: `pnpm front lint` · `check:types` · `test` 통과

> PR #55 가 이 컴포넌트를 리팩토링했지만(상향식 DOM 순회·모듈 CSS 분리) **두 문제는 그대로 남아 있었다.** 결합도는 낮아졌어도 "첫 `<img>` 를 집는다" 는 전제는 바뀌지 않았기 때문이다.

### Slice 6 — 에러 코드 분기 ✅ 2026-09-16
계약(`envelope.ts`)은 *"프론트가 `switch` 로 분기할 때 오타를 컴파일러가 잡게 하는 것이 목적"* 이라고 적고 있는데, 실제로 코드로 분기하는 곳이 **0곳**이었다. 그 자리를 채웠다.

- [x] 6-1 `lib/api/errorPresentation.ts` 신설 — `errorRecovery()`(retry / register-face / sign-in / none) · `errorMessage()` · `validationDetails()`. **테스트 11건**으로 고정
  - 문구를 다시 쓰지 않는다. 백엔드가 이미 한국어 메시지를 준다 — 여기서 정하는 것은 **다시 시도해도 되는가, 어디로 보내야 하는가** 다. 예외는 `TOO_MANY_REQUESTS`(429) 하나로, 백엔드 문구가 사용자에게 설명이 되지 않는다
  - `ErrorCode` 는 **닫힌 집합이 아니다**(전역 필터가 HttpStatus 이름을 그대로 낸다) — 모든 분기에 기본값을 뒀고 그 사실을 테스트로도 남겼다
- [x] 6-2 리더 에러 화면이 `recovery` 에 따라 버튼을 바꾼다. **다시 보내도 같은 답이 오는 실패**(없는 세션·이미 완료·`PAGE_NOT_FAILED`)에는 「다시 시도하기」를 띄우지 않는다 — 눌러 보고 또 실패하는 경험만 주기 때문이다. `FACE_NOT_READY` 면 「얼굴 등록하러 가기」가 주 버튼이 된다
- [x] 6-3 촬영 화면의 `err.status === 409` 를 `err.code === "STORY_ALREADY_COMPLETED"` 로 — 409 는 「이미 질문함」·「아이디 중복」에도 쓰이므로 숫자로는 구분되지 않는다
- [x] 6-4 가입 폼에 `details`(필드별 사유) 표시. ⚠️ **로그인에는 적용하지 않는다** — "아이디 형식이 틀렸다" 표시가 곧 계정 존재 여부의 신호가 된다(`front-code-patterns.md` §9)
- [x] Verify: `pnpm front lint`(경고 0) · `check:types` · `test` **통과** (17 files / **109** tests)

---

## Tests / Verification

- [ ] 추가할 테스트: 파이프라인 선행 실패 → 세션 `failed` (백 단위), 타임아웃 시그널 전달 (백 단위), 오픈 리다이렉트 방어 (프론트 단위), 썸네일 소유자 검사 (프론트 단위)
- [ ] 실행 명령: 슬라이스마다 `pnpm back|front ci:core`, 마지막에 `pnpm ci:core`
- [ ] **검증 못 하는 경로**: `front build` 와 `back test:e2e` 는 이 샌드박스가 포트 바인딩을 막아 실행 불가(`node -e "require('net').createServer().listen(0)"` 도 실패). 사용자 환경에서 확인해야 한다.
- [ ] **화면은 코드로 검증하지 않는다** — `lessons.md` 2026-09-14. 화면 변경분은 브라우저 확인이 남는다.

## Risk & Rollback

- **위험**: 타임아웃 값이 짧으면 정상 생성을 죽인다. 120초 근거는 `client.ts:71` 주석("1분 이상")뿐이라 실측이 아니다 → 운영 관찰 후 조정.
- **위험**: 세션을 `failed` 로 전이시키면 기존에 "조용히 멈춰 있던" 세션이 실패로 보인다. 이는 의도된 변화다.
- **롤백**: 슬라이스별 격리 커밋. 각 슬라이스가 독립적으로 되돌려진다.

## 리뷰 지적과 대응 (2026-09-16 `/review`)

자체 리뷰에서 **내가 만든 회귀 3건**을 찾아 고쳤다.

| 지적 | 근거 | 대응 |
|---|---|---|
| `getOptionalPresignedUrl` 의 로그가 **3초 폴링 × 페이지 수 × 레플리카 3** 으로 폭증 | 호출처가 `getSessionPages` 의 `templatePages.map` 안(`:645`). `POLL_BASE_MS = 3000` | `createLogThrottle(60_000)` 적용 — 기존 패턴(`redis.module.ts:45`) |
| `deleteSession` 의 스토리지 삭제가 **트랜잭션 안**이라 DB 커밋 실패 시 그림만 사라짐 | `@Transactional()` 이 메서드 전체를 감싸는데 스토리지 삭제가 본문 끝 = 커밋 전 | `deleteSessionRows()`(트랜잭션, DB만)로 분리하고 스토리지 삭제는 그 뒤로 |
| multer `limits` 를 `MAX_IMAGE_SIZE_BYTES` 와 같게 둬서 5MB 초과가 **400 → 500** 으로 퇴행 | `MulterError` 는 `HttpException` 이 아니라 전역 필터 4단(`INTERNAL_SERVER_ERROR`)으로 떨어진다 | 한도를 `×2` 로 올려 **판정은 서비스(400 `IMAGE_TOO_LARGE`)가, 메모리 방어는 multer 가** 맡게 분리 |

추가로 `INVALID_CREDENTIALS`(401)가 `errorRecovery` 에서 `sign-in` 으로 분류되던 것을 `none` 으로 고쳤다 — 이미 로그인 화면에 있는 사람에게 "로그인하러 가기" 는 제자리를 가리킨다.

**격리 반증**: `@Transactional()` 이 private self-call 에서도 동작하는지가 위 두 번째 대응의 전제였다. `typeorm-transactional/dist/decorators/transactional.js` 를 읽어 **`descriptor.value` 를 직접 교체**(프록시가 아닌 프로토타입 메서드 래핑)하는 것을 확인했다 — 반증 실패, 결론 유지.

## 실환경 검증 (2026-09-16, 읽기 전용)

`pnpm back dev`(SSH 터널 → 공유 DB) + `pnpm front dev` 로 기동해 **쓰기 없이** 확인했다.

| 확인 | 결과 |
|---|---|
| liveness / readiness | 200 / `db: up`·`redis: down`(로컬 Redis 미기동) — **Redis 가 죽어도 liveness 200** 규약 성립 |
| 폴링 경로(`GET /sessions/:id/pages`) | 7장 전부 `succeeded`, 서명 URL 정상 발급, `errorMessage: null` |
| `UNAUTHORIZED` · `SESSION_NOT_FOUND` · `PAGE_NOT_FAILED` · `INVALID_CREDENTIALS` | 전부 계약대로 (`code`/`message`/`timestamp`, `statusCode` 없음) |
| `VALIDATION_FAILED` 의 `details` | `["id: 유효하지 않은 세션 ID입니다."]` — `validationDetails()` 가 파싱하는 `string[]` 형태와 **일치 실측** |
| 프론트 SSR | `/` · `/library` · `/login` 전부 200 |

⚠️ **A/B 선제 생성이 실증됐다** — 완료 세션의 `a/6`·`b/6` 삽화가 **둘 다** `succeeded` 다. 사용자는 분기 하나만 고르므로 유료 이미지 생성이 2배다(비목표로 남긴 항목, 판단 필요).

🚫 **여전히 미검증**: 화면(시각). 브라우저 자동화 도구가 이 환경에 없어(`playwright`·`puppeteer` 모두 미설치) 핫스팟 좌표·실패 배너는 사람이 봐야 한다.

## Verification Story

- **무엇이 바뀌었는가**: 제작이 멈추는 세 갈래(외부 API 무한 대기 · 파이프라인 선행 실패 · 얼굴 미등록)를 각각 타임아웃·상태 전이·에러 표시로 끊고, 그 결과를 `GeneratingView` 가 실패로 그리게 했다. 더불어 업로드 크기 제한, 경합 500, 스토리지 고아 객체, 오픈 리다이렉트, 썸네일 소유자 검사 등 전수조사에서 나온 명백한 결함을 고쳤다. 14개 파일 수정 + 2개 신설, 약 +471/−93 줄.
- **어떻게 확인했는가**: `pnpm back ci:core` 통과(30 suites / **276** tests, 착수 시 270) · `pnpm front lint`(경고 0)·`check:types`·`test` 통과(17 files / **109** tests, 착수 시 91). 새 불변조건을 테스트로 고정했다 — provider 원문 미유출, 타임아웃 시그널 전달, 파이프라인 실패 전이, 실패 사유에 내부 예외 미포함, 스토리지 정리, 스토리지 실패가 DB 삭제를 되돌리지 않음, 오픈 리다이렉트 차단, 그리고 에러 코드→행동 매핑 11건.

### 남은 항목 (게이트 분류)

**머지 전 차단** — 없음. 코드 결함은 전부 같은 브랜치에 담았다.

**배포 직후 조치** — 없음.

**후속 (별건 등재)**
- `front build` · `back test:e2e` **미검증** — 이 샌드박스가 포트 바인딩을 막는다(`node -e "require('net').createServer().listen(0)"` 도 실패). 사용자 환경에서 `pnpm ci:all` 로 확인이 필요하다.
- **화면 확인 미수행** — `GeneratingView` 실패 배너, 낭독 실패 문구, 「지금 바로 읽으러 가기」, 촬영 돌아가기는 전부 브라우저로 본 사람이 없다 (`lessons.md` 2026-09-14).
- 비목표로 남긴 6건(A/B 선제 생성 · 레이트리밋 값 · `DIRECT_FACE_MODE` · 얼굴 재업로드 · 삽화 깜빡임 · S3 prefix) — 제품/운영 판단이 필요하다.
- **에러 코드 분기를 더 넓힐 여지** — 지금 코드로 분기하는 곳은 리더 에러 화면·촬영·가입 폼이다. 대화(`useCharacterChat`)와 마이페이지는 아직 `status`/메시지에 의존한다.
- **`coverImageKey` 미사용** — 백엔드가 공식 동화 표지 키를 주는데 URL 로 바꾸는 코드가 없어 표지가 항상 SVG 플레이스홀더다.
- 루트 `tasks/plan.md`·`tasks/todo.md` 가 git 추적 중이며 `docs/tasks/` SSOT 규약과 이중화되어 있다.

## Lessons (해당 시)

- 아직 `docs/lessons.md` 에 올릴 **새로운** 작업 방식 교훈은 없다. 이번에 걸린 것들은 이미 등재된 항목의 재확인이었다:
  - 「에러 메시지를 친절하게 만들었더니 내부 구조가 응답으로 샜다」(2026-09-04) — 이번에는 전역 필터를 **거치지 않는 성공 응답 본문**으로 새는 변종이었다. 기존 항목에 한 줄 덧붙일 가치가 있다.
  - 「검사가 조용히 틀린 답을 낸다」 계열 — 조사 중 `check:types` 실패 27건이 전부 낡은 `contracts/dist` 탓이었고, 백그라운드 명령의 종료코드를 그대로 읽어 빌드 실패를 통과로 오독했다.

---

## 진행 로그

- **2026-09-16** 문서 생성. 전수조사 결과와 사용자 질문을 하나의 작업으로 묶었다.
- **2026-09-16** `main` 을 `8be01d2`(PR #55 — 캐릭터 핫스팟 말풍선 핀 고도화·모듈화)로 최신화하고 `fix/generation-feedback-and-hardening` 분기. PR #55 이후에도 핫스팟 좌표가 `.artHold` 의 **직전 쪽 이미지**를 집는 문제와 터치 타깃 44↔56 불일치는 남아 있음을 확인했다(비목표 아님 — 후속 슬라이스 후보).
- **2026-09-16** Slice 1~4 완료.
- **2026-09-16** Slice 5(핫스팟 좌표·터치 타깃) · Slice 6(에러 코드 분기) 완료. 커밋하지 않았다 — 사용자 지시 대기.
