# =============================================================================
# 빌드 스테이지
# =============================================================================
FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN corepack enable

# 의존성 레이어를 소스와 분리해 캐시가 살아남게 한다.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ⚠️ COPY 목록을 함부로 줄이지 말 것.
#    로컬 빌드의 입력은 레포 전체지만 컨테이너 빌드의 입력은 여기 적은 것뿐이다.
#    build 스크립트는 tsc -p tsconfig.build.json 이고, 그 파일이 tsconfig.json 을
#    extends 하므로 두 파일이 모두 있어야 한다. 하나라도 빠지면 TS5058 로 실패한다.
#    빌드 진입 설정을 바꿀 때는 같은 커밋에서 이 목록을 확인한다 (docs/lessons.md).
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN pnpm run build

# =============================================================================
# 프로덕션 스테이지
# =============================================================================
FROM node:22-bookworm-slim

# 날짜 처리 기준을 컨테이너에서 고정한다. 호스트 타임존에 따라 동작이 달라지지 않게 한다.
ENV TZ=UTC
ENV NODE_ENV=production

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist

# 런타임 path alias 해석용. dist 기준 경로 매핑이 들어 있다.
COPY tsconfig.runtime.json ./tsconfig.runtime.json

# 컨테이너 헬스체크 스크립트. slim 이미지에 curl 이 없어 node 로 확인한다.
COPY scripts/healthcheck.mjs ./scripts/healthcheck.mjs

# 루트로 돌리지 않는다. node 이미지가 제공하는 비특권 사용자를 쓴다.
USER node

EXPOSE 5501

# 🚫 HEALTHCHECK 을 여기에 두지 않는다.
#    stack YAML 의 healthcheck 가 이걸 덮어써서 "어느 쪽이 동작하는지" 헷갈리게 된다.
#    헬스체크는 infra/prod_nerd_back.yml 한 곳에서만 정의한다.

ENV TS_NODE_PROJECT=/app/tsconfig.runtime.json

# --enable-source-maps: tsconfig 가 .js.map 을 이미 만들고 있는데 Node 는 이 플래그 없이는
# 쓰지 않는다(실측: dist 236K 중 map 80K 가 사장). 켜두면 500 에러 스택이
# dist/*.js 줄번호 대신 src/*.ts 줄번호를 가리켜 원인 추적이 빨라진다.
# 전역 예외 필터가 500 에 스택을 남기므로 직접적인 이득이다.
CMD ["node", "--enable-source-maps", "-r", "tsconfig-paths/register", "dist/main.js"]
