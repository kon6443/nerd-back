# =============================================================================
# 빌드 스테이지
# =============================================================================
# ⚠️ **빌드 컨텍스트는 레포 루트다** (`apps/back` 이 아니다). 앱이 워크스페이스 패키지
#    `@nerd/contracts` 에 의존하는데 그게 앱 디렉터리 밖이라 컨텍스트를 좁힐 수 없다.
#    그래서 이 파일의 모든 경로는 **레포 루트 기준**이다.
#    제외 목록은 앱이 아니라 **루트 `.dockerignore`** 가 소유한다.
FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN corepack enable

# 매니페스트를 소스보다 먼저 복사해 의존성 레이어를 분리한다. 소스만 바뀌면 이 레이어가 재사용된다.
#
# ⚠️ 워크스페이스 루트 파일 3종(`pnpm-workspace.yaml` · 루트 `package.json` · 루트 lockfile)이
#    모두 있어야 `pnpm install --frozen-lockfile` 이 워크스페이스를 인식한다.
#    `pnpm-workspace.yaml` 의 글롭이 `apps/*` 라 **컨텍스트에 없는 `apps/front` 는 그냥 매칭되지
#    않는다** — 프론트 매니페스트를 복사할 필요가 없는 이유다.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/contracts/package.json packages/contracts/pnpm-lock.yaml ./packages/contracts/
COPY apps/back/package.json apps/back/pnpm-lock.yaml ./apps/back/
# 🚫 `--ignore-scripts` 를 빼지 말 것. `packages/contracts` 의 `prepare`(= build)가
#    **매니페스트만 복사된 이 시점에** 돌아 소스가 없어 실패한다. 로컬에서 `pnpm install` 만으로
#    dist 가 생기게 하려고 둔 스크립트이고, 컨테이너에서는 아래 명시 빌드가 그 역할을 한다.
RUN pnpm install --frozen-lockfile --ignore-scripts

# ⚠️ COPY 목록을 함부로 줄이지 말 것.
#    로컬 빌드의 입력은 레포 전체지만 컨테이너 빌드의 입력은 여기 적은 것뿐이다.
#    `tsc -p tsconfig.build.json` 이 `tsconfig.json` 을 extends 하므로 두 파일이 모두 있어야 한다.
#    하나라도 빠지면 TS5058 로 실패한다. 빌드 진입 설정을 바꿀 때는 같은 커밋에서 이 목록을 확인한다
#    (docs/lessons.md).
COPY packages/contracts/tsconfig.json ./packages/contracts/
COPY packages/contracts/src ./packages/contracts/src
COPY apps/back/tsconfig.json apps/back/tsconfig.build.json ./apps/back/
COPY apps/back/src ./apps/back/src

# `...` 는 **의존 워크스페이스 패키지를 포함**하라는 뜻이다 — contracts 가 먼저 빌드된다.
# 빼면 back 이 존재하지 않는 `@nerd/contracts` 의 dist 를 찾아 TS2307 로 실패한다.
RUN pnpm --filter nerd-back... run build

# =============================================================================
# 프로덕션 스테이지
# =============================================================================
FROM node:22-bookworm-slim

# 날짜 처리 기준을 컨테이너에서 고정한다. 호스트 타임존에 따라 동작이 달라지지 않게 한다.
ENV TZ=UTC
ENV NODE_ENV=production

WORKDIR /app

RUN corepack enable

# 여기서도 **워크스페이스로** 설치한다. `apps/back/package.json` 이 `@nerd/contracts` 를
# `workspace:*` 로 참조하므로, 워크스페이스 밖에서 설치하면 프로토콜을 해석하지 못해 실패한다.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/contracts/package.json packages/contracts/pnpm-lock.yaml ./packages/contracts/
COPY apps/back/package.json apps/back/pnpm-lock.yaml ./apps/back/
# 🚫 `--ignore-scripts` 를 빼지 말 것. `--prod` 는 devDeps 를 설치하지 않으므로 contracts 의
#    `prepare` 가 `tsc: not found` 로 죽는다. 이 스테이지는 빌드하지 않고 dist 를 받아 온다.
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# contracts 는 **빌드 산출물만** 넣는다. 런타임에 소스가 필요하지 않다.
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/apps/back/dist ./apps/back/dist

# 런타임 path alias 해석용. `baseUrl: ./dist` 가 이 파일 위치 기준이라 dist 옆에 있어야 한다.
COPY apps/back/tsconfig.runtime.json ./apps/back/tsconfig.runtime.json

# 컨테이너 헬스체크 스크립트. slim 이미지에 curl 이 없어 node 로 확인한다.
COPY apps/back/scripts/healthcheck.mjs ./apps/back/scripts/healthcheck.mjs

# 루트로 돌리지 않는다. node 이미지가 제공하는 비특권 사용자를 쓴다.
USER node

# ⚠️ 앱 디렉터리로 내려간다. **stack YAML 의 healthcheck 가 상대경로**
#    (`node scripts/healthcheck.mjs`)라 WORKDIR 이 여기여야 그대로 동작한다 — 이 값을 바꾸면
#    `infra/prod_nerd_back.yml` 도 같이 고쳐야 한다.
WORKDIR /app/apps/back

EXPOSE 5501

# 🚫 HEALTHCHECK 을 여기에 두지 않는다.
#    stack YAML 의 healthcheck 가 이걸 덮어써서 "어느 쪽이 동작하는지" 헷갈리게 된다.
#    헬스체크는 infra/prod_nerd_back.yml 한 곳에서만 정의한다.

ENV TS_NODE_PROJECT=/app/apps/back/tsconfig.runtime.json

# --enable-source-maps: tsconfig 가 .js.map 을 이미 만들고 있는데 Node 는 이 플래그 없이는
# 쓰지 않는다(실측: dist 236K 중 map 80K 가 사장). 켜두면 500 에러 스택이
# dist/*.js 줄번호 대신 src/*.ts 줄번호를 가리켜 원인 추적이 빨라진다.
# 전역 예외 필터가 500 에 스택을 남기므로 직접적인 이득이다.
CMD ["node", "--enable-source-maps", "-r", "tsconfig-paths/register", "dist/main.js"]
