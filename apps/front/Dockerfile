# =============================================================================
# 빌드 스테이지
# =============================================================================
# ⚠️ **빌드 컨텍스트는 레포 루트다** (`apps/front` 가 아니다). 앱이 워크스페이스 패키지
#    `@nerd/contracts` 에 의존하는데 그게 앱 디렉터리 밖이라 컨텍스트를 좁힐 수 없다.
#    그래서 이 파일의 모든 경로는 **레포 루트 기준**이다.
#    제외 목록은 앱이 아니라 **루트 `.dockerignore`** 가 소유한다.
FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN corepack enable

# 매니페스트를 소스보다 먼저 복사해 의존성 레이어를 분리한다. 소스만 바뀌면 이 레이어가 재사용된다.
#
# ⚠️ `pnpm-workspace.yaml` 의 `ignoredBuiltDependencies: [sharp, unrs-resolver]` 는 **빌드 스크립트
#    실행 여부만** 정하는데, pnpm 10 은 기본적으로 빌드 스크립트를 막고 경고만 낸다. sharp 0.33+ 는
#    prebuilt 바이너리를 optional dependency 로 받아 postinstall 이 필요 없다(2026-09-01 실측).
# 🚫 `--ignore-scripts` 를 빼지 말 것. `packages/contracts` 의 `prepare`(= build)가 매니페스트만
#    복사된 이 시점에 돌아 소스가 없어 실패한다. 빌드는 아래 명시 단계가 맡는다.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/contracts/package.json packages/contracts/pnpm-lock.yaml ./packages/contracts/
COPY apps/front/package.json apps/front/pnpm-lock.yaml ./apps/front/
RUN pnpm install --frozen-lockfile --ignore-scripts

# ⚠️ COPY 목록을 함부로 줄이지 말 것.
#    로컬 빌드의 입력은 레포 전체지만 컨테이너 빌드의 입력은 여기 적은 것뿐이다.
#    빌드 진입 설정(next.config·tsconfig·postcss)을 바꿀 때 이 목록을 확인한다.
COPY packages/contracts/tsconfig.json ./packages/contracts/
COPY packages/contracts/src ./packages/contracts/src
COPY apps/front/next.config.ts apps/front/tsconfig.json apps/front/postcss.config.mjs ./apps/front/
COPY apps/front/app ./apps/front/app
COPY apps/front/components ./apps/front/components
COPY apps/front/lib ./apps/front/lib
COPY apps/front/public ./apps/front/public

# `.env.production`(NEXT_PUBLIC_* 전용). **와일드카드가 핵심이다** —
# 매칭이 0개여도 COPY 는 실패하지 않으므로, 파일이 없는 지금도 빌드가 되고
# 파일이 생기면 Dockerfile 을 고치지 않아도 자동으로 들어온다.
#
# 🚫 이 줄을 `COPY apps/front/.env.production ./apps/front/` 로 바꾸지 말 것. 파일이 없으면 빌드가 깨진다.
# 🚫 이 줄을 지우지 말 것. 없으면 `next build` 가 NEXT_PUBLIC_* 를 못 읽어
#    **빌드는 성공하는데 값만 조용히 빠진다.** 로컬 빌드는 레포 전체가 입력이라
#    정상 동작해서 차이가 드러나지 않는다 (2026-09-01 실측으로 확인).
#
# 루트 `.dockerignore` 가 `**/.env.*` 를 막고 `!apps/front/.env.production` 만 통과시키므로
# 이 와일드카드가 로컬 개발용 env 를 함께 끌어오지 않는다.
COPY apps/front/.env.production* ./apps/front/

# 롤링 업데이트 중 구·신 이미지가 공존할 때의 version skew 를 막는다.
# next.config.ts 의 deploymentId 가 이 값을 읽는다. CI 가 커밋 short SHA 를 준다.
ARG DEPLOYMENT_VERSION
ENV DEPLOYMENT_VERSION=$DEPLOYMENT_VERSION

ENV NEXT_TELEMETRY_DISABLED=1

# `...` 는 **의존 워크스페이스 패키지를 포함**하라는 뜻이다 — contracts 가 먼저 빌드된다.
# 빼면 next build 가 존재하지 않는 `@nerd/contracts` 의 dist 를 찾아 실패한다.
RUN pnpm --filter nerd-front... run build

# =============================================================================
# 실행 스테이지
# =============================================================================
FROM node:22-bookworm-slim

# 날짜 처리 기준을 컨테이너에서 고정한다. 호스트 타임존에 따라 동작이 달라지지 않게 한다.
ENV TZ=UTC
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

ENV PORT=5502

# 🚫 **빠뜨리면 안 된다.** standalone server.js 는 이 값이 없으면 루프백에만 바인딩되어
#    overlay 안의 Caddy 가 닿지 못한다. 컨테이너는 정상 기동하고 내부 헬스체크도
#    통과하므로 **밖에서만 안 되는** 형태로 드러난다.
ENV HOSTNAME=0.0.0.0

# glibc malloc 의 arena 단편화를 억제한다. sharp(libvips)가 V8 힙 밖에서 할당하는데,
# 멀티스레드 네이티브 할당이 arena 를 늘려 RSS 가 반환되지 않고 계속 증가한다.
# 즉시 터지지 않고 며칠 뒤 OOM 되는 형태라 원인 추적이 어렵다 (sharp 공식 권장).
ENV MALLOC_ARENA_MAX=2

WORKDIR /app

# ⚠️ standalone 은 `public` 과 `.next/static` 을 **자동으로 담지 않는다.**
#    빠뜨리면 페이지 HTML 은 뜨는데 CSS·JS·이미지가 전부 404 가 된다.
#
# ⚠️ `outputFileTracingRoot` 가 **레포 루트**라 standalone 안이 레포 구조 그대로다 —
#    `apps/front/server.js` 가 한 단계 깊다. 그래서 정적 자산도 `apps/front/` 아래에 넣어야
#    server.js 가 찾는다. (그 값이 레포 루트여야 하는 이유는 next.config.ts 주석 참조 —
#    Turbopack 이 워크스페이스 패키지를 해석하려면 필요하다.)
#
# 🚫 여기서 `pnpm install` 을 하지 않는다. standalone 산출물이 @vercel/nft 로 추린
#    node_modules(sharp 와 @img 네이티브 바이너리 포함)를 이미 담고 있다.
#    `@nerd/contracts` 는 Next 가 서버 번들에 인라인하므로 여기 없어도 된다(컨테이너 실측).
COPY --from=builder --chown=node:node /app/apps/front/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/front/.next/static ./apps/front/.next/static
COPY --from=builder --chown=node:node /app/apps/front/public ./apps/front/public

# 컨테이너 헬스체크 스크립트. slim 이미지에 curl 이 없어 node 로 확인한다.
COPY --chown=node:node apps/front/scripts/healthcheck.mjs ./apps/front/scripts/healthcheck.mjs

# 루트로 돌리지 않는다. node 이미지가 제공하는 비특권 사용자를 쓴다.
USER node

# ⚠️ 앱 디렉터리로 내려간다. **stack YAML 의 healthcheck 가 상대경로**
#    (`node scripts/healthcheck.mjs`)라 WORKDIR 이 여기여야 그대로 동작한다 — 이 값을 바꾸면
#    `infra/prod_nerd_front.yml` 도 같이 고쳐야 한다.
WORKDIR /app/apps/front

EXPOSE 5502

# 🚫 HEALTHCHECK 을 여기에 두지 않는다.
#    stack YAML 의 healthcheck 가 이걸 덮어써서 "어느 쪽이 동작하는지" 헷갈리게 된다.
#    헬스체크는 infra/prod_nerd_front.yml 한 곳에서만 정의한다.

CMD ["node", "server.js"]
