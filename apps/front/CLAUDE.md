@AGENTS.md

# apps/front (Next.js) — AI 에이전트 규약

> 위 `AGENTS.md` 는 **Next 가 자동 생성·재작성하는 파일**이다. 손으로 고치지 않고 import 만 한다.
> 공통 규약·금지·Git 컨벤션·DoD 는 **저장소 루트의 [`CLAUDE.md`](../../CLAUDE.md)** 가 소유한다. 여기는 **프론트에서만 다른 것**만 적는다.
> 코드 규약은 [`.claude/rules/front-code-patterns.md`](../../.claude/rules/front-code-patterns.md) — `app/`·`scripts/`·`next.config.ts` 를 읽는 순간 자동 로드된다.
> 결정과 근거(포트·환경변수 4분류·URL 배치·메모리·CI/CD)는 [`docs/tasks/tasks-frontend-cicd.md`](../../docs/tasks/tasks-frontend-cicd.md) 가 SSOT.

## Never — 프론트 고유

| 금지 | 이유 |
|---|---|
| `NEXT_PUBLIC_*` 를 서버 env 파일·stack YAML 에 넣기 | 값은 **빌드 시점에 번들에 박힌다.** 서버 파일은 서버 프로세스의 `process.env` 만 바꾼다 → "설정했는데 브라우저에서 `undefined`". `.env.production` 에만 둔다 |
| `.env.production` 에 도메인·비밀 기입 | 브라우저에 노출되고 **저장소가 public 이라 즉시 공개된다.** 도메인은 인프라 식별 정보다 (루트 `CLAUDE.md`) |
| Dockerfile 의 `ENV HOSTNAME=0.0.0.0` 제거 | 루프백에만 바인딩되어 overlay 안의 Caddy 가 닿지 못한다. **컨테이너는 정상 기동하고 내부 헬스체크도 통과한다** — 밖에서만 안 되는, 가장 찾기 어려운 실패다 |
| Dockerfile 의 `public` · `.next/static` COPY 제거 | standalone 은 이 둘을 복사하지 않는다. 페이지 HTML 은 뜨는데 CSS·JS·이미지가 전부 404 |
| `next.config.ts` 의 `outputFileTracingRoot` 제거 | 워크스페이스 루트가 추론되어 산출물이 `.next/standalone/apps/front/server.js` 로 깊어지고 Dockerfile COPY 와 어긋난다 |
| Caddy matcher 를 `/api/*` 로 넓히기 | 프론트 헬스체크(`/api/health`)가 백엔드로 흘러가 컨테이너가 영원히 unhealthy → 재시작 루프 |

## Commands

- 검증: `pnpm front ci:core`(lint → check:types → build) · PR 직전 `pnpm front ci:all`(+ 스텁 검사 + 헬스 경로 검사). **루트에서 부른다**
- 실행: `pnpm front dev` → `localhost:5502`
- **테스트 프레임워크가 없다** (의도된 미도입). 그래서 `ci:core` 에 `test` 단계가 없다
- 로컬 env 는 `apps/front/.env.local`. ⚠️ **`PORT` 는 `.env` 계열 어디에 넣어도 무시된다** — HTTP 서버 부팅이 env 로딩보다 먼저다. 포트는 `package.json` scripts 와 Dockerfile `ENV` 가 소유한다
- ⚠️ `next build` 는 Google Fonts 를 받아오므로 **네트워크가 필요하다**. 오프라인·프록시 환경에서는 빌드가 실패한다

## Common Pitfalls — 프론트 고유

공통 함정은 루트 `CLAUDE.md`, 코드 수준 규약은 `front-code-patterns.md` 에 있다.

1. **standalone 서버는 기동 시점에 `public/` 을 스캔한다** — 런타임에 파일을 추가해도 서빙되지 않는다. 이걸 모르면 "sharp 가 컨테이너에서 안 된다" 고 오진한다. **원본 파일 서빙이 되는지 먼저 확인**하면 원인이 즉시 갈린다.
2. **`update_config.monitor` 는 `start_period` 보다 길어야 한다** — 짧으면 새 태스크가 healthy 로 판정되기 전에 다음 레플리카 교체로 넘어가 `start-first` 무중단 보장이 깨진다. 프론트는 `start_period 60s` / `monitor 90s` 다.
3. **레플리카 3개 + `start-first` 는 롤링 중 구·신 이미지를 공존시킨다** — `deploymentId`(커밋 SHA)가 없으면 클라이언트가 사라진 청크를 요청한다(version skew). ISR·Server Action 을 도입하면 Redis cacheHandler 와 암호화 키 고정이 **필수**가 된다.
4. **`pnpm-workspace.yaml` 은 이 디렉터리에 두지 않는다** — pnpm 이 `apps/front` 를 별도 워크스페이스 루트로 잡는다. `ignoredBuiltDependencies` 는 루트 파일에 있고, 컨테이너에는 들어오지 않는다(Dockerfile 주석 참조).
