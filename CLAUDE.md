# nerd-back — AI 에이전트 규약

> 사용자 글로벌 규칙(`~/.claude/CLAUDE.md`)이 우선하고, 이 파일은 **프로젝트 고유 사항**만 보완한다.
> 한 줄을 넣기 전에 자문한다 — **"이걸 모르면 내가 틀리게 행동하는가?"** 아니면 넣지 않는다.
> 길어질수록 정작 중요한 금지 규칙의 준수율이 떨어진다.

**문서 경계** — 같은 내용을 두 곳에 쓰지 않는다.

| 문서 | 담당 |
|---|---|
| [`README.md`](README.md) | 사실·사용법 (스택, 명령어, 환경변수, 배포 구성) |
| **이 문서** | 규약·금지·함정 (AI 행동 지침) |
| [`docs/conventions/code-patterns.md`](docs/conventions/code-patterns.md) | 코드 규약 상세 + 실측 카운트 |
| [`docs/lessons.md`](docs/lessons.md) | 작업 방식의 누적 교훈 |
| [`docs/tasks/*.md`](docs/tasks/) | 진행 상황·결정 근거 |

**진행 상황·완료 이력·커버리지 수치를 이 문서에 쓰지 않는다.** 두 곳에 두면 반드시 어긋난다.

---

## 자동 라우팅 표 (MUST OBEY)

트리거가 매칭되면 **작업 시작 전에** 해당 파일을 Read 한다. 둘 이상이면 모두 읽는다.

| 트리거 | 즉시 읽을 파일 |
|---|---|
| **모든 `src` 작업** (신규 모듈·API·테스트) | `docs/conventions/code-patterns.md` |
| 뼈대·인프라·배포 결정의 근거 확인 | `docs/tasks/tasks-backend-skeleton.md` |
| 대규모 리팩터링 착수 전 · 사용자 교정 직후 | `docs/lessons.md` (검토 후 새 교훈 append) |
| 빌드 설정·Dockerfile·CI 변경 | `docs/lessons.md` + `Dockerfile` COPY 블록 주석 |

**면제**: 단일 한 줄 수정, 단순 정보 조회, 1회성 명령 실행.

---

## Never — 어떤 경우에도 하지 않는다

| 금지 | 이유 |
|---|---|
| 시크릿(토큰·키·비밀번호)을 코드·로그·응답·문서에 기입 | 커밋 이력에 영구 보존된다 |
| Caddyfile·`.env`·인프라 식별 정보(도메인·IP·서버 경로·네트워크 이름)를 저장소에 커밋 | 공개 저장소 노출 |
| **외부 API 요청·응답 본문을 로그에 남기기** | 로그 수집 스택이 공유 자원이고 인제스트 한도가 낮다. 토큰 수·모델명·소요시간만 남긴다 |
| 고카디널리티 값(`userId` `requestId` `url`)을 로그 **레이블**로 승격 | 인덱스가 폭증해 공유 중인 조회 성능 전체가 느려진다 |
| 인메모리 변수·타이머로 공유 상태 관리 | 레플리카 3개 — 레플리카별로 갈린다. Redis 를 쓴다 |
| 레이트리밋·카운터를 메모리 스토리지로 | 실효 한도가 3배가 된다 |
| liveness 헬스체크에 외부 의존 검사 추가 | 의존 장애가 재시작 루프와 배포 롤백을 유발한다 |
| `any` · `@ts-ignore` 등 타입 억제 | eslint 가 error 로 막는다. 불가피하면 disable + **사유 주석** |
| E2E 에서 `AppModule` import | 부팅만으로 외부 시스템에 붙는다. `createE2eApp()` 을 쓴다 |
| 사용자 지시 없는 `git commit` · `push` | auto mode 에서도 금지 |
| DB 마이그레이션 **실행** | 전 환경이 동일 DB — 모든 실행이 곧 상용 적용. AI 는 파일 작성까지만 |

## Ask — 실행 전 사용자 승인

| 확인 대상 | 비고 |
|---|---|
| 커밋 · 푸시 · 머지 · 리베이스 · 태그 | `main` 푸시는 곧 자동 배포다 |
| 배포 · `docker` 명령 · `ssh`/`scp` | 운영 서버 영향 |
| 파일·디렉터리 삭제, 비가역 변경 | |
| 새 의존성 추가 | 기존 스택으로 안 풀리는지 먼저 확인 |
| API 계약 변경 (상태코드·에러코드) | 프론트 대응 필요 여부까지 커밋 본문에 명시 |
| 마이그레이션 실행 요청 | 작성은 AI, 실행은 담당자. **완료 조건에서 분리해 명시** |

---

## Commands

전체 목록은 [`README.md`](README.md) 가 SSOT. 작업 시 쓰는 것만:

- 검증: **`pnpm ci:core`**(lint → test → build). PR 직전 **`pnpm ci:all`**(+ 스텁 검사 + E2E)
- 실행: `pnpm dev` → `localhost:5501/api/v2` · Swagger `/api/v2/docs`
- ⚠️ jest 30 에서 `--testPathPattern`(단수)은 동작하지 않는다. **복수형** `--testPathPatterns` 를 쓴다.

## Key Patterns (요약)

> 코드를 쓰기 전에 상세와 실측 카운트는 [`docs/conventions/code-patterns.md`](docs/conventions/code-patterns.md) 를 읽는다.

- **계층**: Repository 클래스 없음(Service 가 `@InjectRepository` 직접). **외부 시스템은 반드시 Port 경유**
- **응답**: `{ code, data, message }` 객체 리터럴 직접 반환. 전역 인터셉터 없음. 상태코드는 정석 REST
- **에러**: `defineDomainError` → 전역 필터가 `{ code, message, timestamp }` 로 통일. 바디에 `statusCode` 없음
- **검증**: `createGlobalValidationPipe()` 하나를 프로덕션·E2E 가 공유 — **이 파일만 고친다**
- **테스트**: mock 주력. E2E 는 외부 의존 없이 돈다
- **외부 의존**: 죽어도 앱은 기동·응답한다. 레이트리밋은 fail-open, 비용 카운터는 fail-closed

## Common Pitfalls to Avoid

1. **전역 필터·인터셉터는 예외 케이스를 만든다** — "모든 응답을 통일한다"를 예외 없이 적용하면 헬스체크 진단 결과처럼 형식을 바꿔선 안 되는 응답이 망가진다. 추가·수정 시 통과 케이스를 테스트로 고정한다 ([lessons](docs/lessons.md)).
2. **로컬 빌드 성공 ≠ 컨테이너 빌드 성공** — 로컬 입력은 레포 전체, 컨테이너 입력은 `COPY` 목록뿐이다. 빌드 진입 설정을 바꾸면 같은 커밋에서 `Dockerfile` 을 확인한다. `ci:all` 은 이 종류를 못 잡아 CI 에 ARM64 빌드 검증 job 을 따로 뒀다.
3. **`tsconfig.json` paths 와 `jest.config.js` moduleNameMapper 는 세트다** — 한쪽만 고치면 해당 alias 를 쓰는 테스트만 조용히 깨진다.
4. **`reflect-metadata` 는 테스트에서도 필요하다** — `main.ts` 에서만 import 하면 spec 이 `Reflect.getMetadata is not a function` 으로 터진다. jest `setupFiles` 에 들어 있다.
5. **에러 경로 테스트는 status·code 를 정확히 고정한다** — 느슨하게 받으면 그 차이가 곧 방어의 유무일 때 테스트가 조용히 무력해진다.
6. **부팅 시 `LegacyRouteConverter: Unsupported route path: "/api/v2/*"` 경고 2줄은 무해하다** — `setGlobalPrefix` + `app.use()` 조합에서 Nest 11 이 Express 5 의 구 와일드카드 문법으로 등록하며 내는 경고다. 실측으로 helmet 헤더 6종·gzip·Swagger CSP 제외가 모두 정상 적용됨을 확인했다. **쫓지 말 것.**
7. **로그를 추가할 때 발생 빈도를 먼저 재라** — 재시도하는 외부 의존의 이벤트 핸들러는 트래픽 0에서도 로그를 쌓는다. `createLogThrottle` 로 감싸고, 요청 0건 유휴 60초 측정으로 검증한다.
8. **HEALTHCHECK 은 stack YAML 한 곳에만** — Dockerfile 에도 두면 stack 이 덮어써서 어느 쪽이 동작하는지 헷갈린다.

## Git & 커밋 컨벤션

- 형식: **`type(scope): 한국어 설명`** — type: `feat` `fix` `refactor` `test` `docs` `chore`
- 한 커밋 = 한 의도. 포맷팅 전용 변경과 행위 변경을 섞지 않는다.
- **본문에 "왜"를 남긴다.** 제목이 "무엇"이면 본문이 "왜"다. revert 는 본문에 원인 1줄 필수.
- API 계약이 바뀌면 본문에 명시한다.

## Definition of Done (이 프로젝트)

글로벌 DoD 에 더해:

1. **`pnpm ci:core` 통과** — 에러 0건, 경고 수를 늘리지 않는다. PR 직전 `pnpm ci:all`
2. **변경 심볼 grep 전수 확인** — 호출처를 빠뜨리지 않았음을 증거로 제시
3. **결정이 바뀌면 코드보다 태스크 문서를 먼저 고친다**
4. 검증 못 한 경로는 **"미검증"으로 명시** — 빌드 통과를 동작 검증으로 포장하지 않는다
5. **Verification Story 1~2줄**
