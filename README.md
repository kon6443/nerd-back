# nerd-front

Next.js 16 + React 19 프론트엔드.

> **이 문서는 사실과 사용법만 담는다** — 스택, 실행법, 환경 변수, 명령어.
> 결정의 근거·배포 설계는 [`docs/tasks/`](docs/tasks/)로 분리되어 있다. 같은 내용을 두 곳에 쓰지 않는다.

**현재 상태**: 스켈레톤. CI/CD 구축 진행 중 — 아래 ⬜ 표시는 **아직 적용되지 않은** 항목이다.

---

## 기술 스택

| 구분 | 선택 |
|---|---|
| 런타임 | Node 22 LTS (ARM64) |
| 프레임워크 | Next.js 16 · **App Router** |
| UI | React 19 |
| 스타일 | Tailwind CSS 4 |
| 번들러 | Turbopack (Next 16 기본) |
| 패키지 매니저 | pnpm |
| 테스트 | **미도입** |
| 배포 | ⬜ Docker Swarm on ARM64 |

---

## 시작하기

### 사전 요구사항

Node 22 LTS · pnpm

### 실행

```bash
pnpm install
pnpm dev
```

⬜ 포트는 **5502**로 정해졌으나 아직 적용되지 않았다. 현재는 Next 기본값 3000으로 뜬다.

---

## 환경 변수

값의 **성격**(공개/비밀)과 **확정 시점**(빌드/런타임)이 위치를 정한다. **이 둘을 섞으면 반드시 사고가 난다.**

| 위치 | 담는 것 | 시점 | git |
|---|---|---|---|
| `.env.production` | **`NEXT_PUBLIC_*` 만** | 빌드타임 | **커밋한다** |
| `.env.local` | 로컬 개발용 전부 | 로컬 | ignore |
| ⬜ stack YAML `environment:` | 비밀 **아닌** 런타임 값 | 런타임 | 커밋한다 |
| ⬜ 서버 `nerd-front.prod.env` | **민감한** 런타임 값 | 런타임 | 저장소에 두지 않는다 |

### 🚫 서버 env 파일에 `NEXT_PUBLIC_*`를 넣어도 브라우저에 반영되지 않는다

`NEXT_PUBLIC_*`는 **`next build` 시점에 클라이언트 번들에 인라인**된다. 서버 env 파일은 서버 프로세스의 `process.env`만 바꾼다.

증상은 "설정했는데 브라우저에서 `undefined`"이고, 원인이 파일이 아니라 **시점**에 있어 찾기 어렵다. **값을 바꾸려면 이미지를 다시 빌드해야 한다.**

→ `NEXT_PUBLIC_` 접두사가 붙은 값은 **`.env.production`에만** 둔다.

### `.env.production`은 커밋한다

`next build`가 읽으려면 Docker 빌드 컨텍스트에 있어야 하고, `NEXT_PUBLIC_*`는 정의상 브라우저가 받는 값이라 숨길 수 없다.

🚫 **이 파일에 비밀을 넣지 않는다.** **이 저장소는 public이다** — 커밋 이력에 영구 보존될 뿐 아니라 즉시 전 세계에 공개된다. 되돌리려면 이력 재작성과 자격증명 폐기가 필요하다.

### `.env`가 아니라 `.env.local`을 쓴다

`.env`는 **프로덕션 빌드에서도 로드**된다. `.env.production`에 없고 `.env`에만 있는 키가 있으면 상용 번들에 개발 값이 섞인다.

### ⚠️ `PORT`는 `.env` 계열에서 동작하지 않는다

> `PORT` cannot be set in `.env` as booting up the HTTP server happens before any other code is initialized. — Next.js 공식 문서

HTTP 서버 부팅이 env 파일 로딩보다 먼저다. `.env`에 `PORT`를 써도 **조용히 무시되고** 기본값으로 뜬다. 포트는 `package.json` scripts가 소유한다.

---

## 주요 명령어

```bash
pnpm dev                 # 개발 서버
pnpm build               # 프로덕션 빌드
pnpm start               # 빌드 결과 실행
pnpm lint                # eslint
```

⬜ 아래는 CI/CD 구축과 함께 추가된다.

```bash
pnpm check:types         # next typegen && tsc --noEmit
pnpm check:stubs         # TODO/FIXME/.only 잔존 차단
pnpm ci:core             # lint → check:types → build
pnpm ci:all              # + check:stubs  (PR 전 필수)
```

⚠️ `next typegen`이 `tsc --noEmit`보다 **먼저** 실행돼야 한다. Next 16은 라우트 타입을 `.next/types`에 생성하는데, 없으면 타입 검사가 라우트를 검증하지 못한다.

---

## 문서

| 파일 | 언제 여는가 |
|---|---|
| [`docs/tasks/`](docs/tasks/) | 결정의 근거·진행 상황을 확인할 때 |
| [`docs/tasks/tasks-frontend-cicd.md`](docs/tasks/tasks-frontend-cicd.md) | CI/CD·컨테이너·배포 설계를 볼 때 |
| `AGENTS.md` | Next.js가 `next dev` 실행 시 자동 생성·갱신한다. 사람이 쓴 규약이 아니다 |

배포 인프라의 일반 규약(Swarm·Caddy·롤백·이름 규칙)은 **`nerd-back` 저장소의 `docs/deploy.md`가 정본**이다. 여기서는 프론트에서 달라지는 것만 다룬다.

---

## 커밋

`type(scope): 한국어 설명` — type: `feat` `fix` `refactor` `test` `docs` `chore`

- 한 커밋 = 한 의도. 포맷팅 전용 변경과 행위 변경을 섞지 않는다.
- **본문에 "왜"를 남긴다.** 제목이 "무엇"이면 본문이 "왜"다.
