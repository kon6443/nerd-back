import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * 컨테이너 배포용 산출물. `.next/standalone` 에 실행에 필요한 파일만 추린다.
   *
   * runner 스테이지에서 `pnpm install` 을 하지 않는 이유가 이것이다 —
   * @vercel/nft 가 실제로 쓰이는 node_modules 만 골라 담아준다.
   *
   * ⚠️ `public/` 과 `.next/static` 은 **자동으로 복사되지 않는다.**
   *    Dockerfile 에서 별도로 COPY 해야 한다. 빠뜨리면 페이지 HTML 은 뜨는데
   *    CSS·JS·이미지가 전부 404 가 된다.
   */
  output: "standalone",

  /**
   * 빌드 루트. **레포 루트다** (2026-09-04 에 `__dirname` 에서 바꿨다).
   *
   * ⚠️ 이름은 "트레이싱"이지만 **Turbopack 의 모듈 해석 경계이기도 하다.** 이 값을
   * `apps/front` 로 두면 앱 디렉터리 **밖**의 워크스페이스 패키지를 해석하지 못해
   * `Module not found: Can't resolve '@nerd/contracts'` 로 **빌드가 실패한다**
   * (2026-09-04 실측). 공유 패키지를 쓰는 한 이 값은 레포 루트여야 한다.
   *
   * 🚫 그 대가로 산출물이 `.next/standalone/apps/front/server.js` 로 한 단계 깊어진다.
   * **Dockerfile 의 COPY·WORKDIR 이 이 구조에 맞춰져 있으니 이 값을 바꾸면 거기도 고친다.**
   *
   * 추론에 맡기지 않고 명시하는 이유는 그대로다: pnpm 워크스페이스는 앱별 lockfile 과
   * 별개로 루트에도 `pnpm-lock.yaml` 을 만들어(2026-09-03 실측) 추론 결과가 흔들린다.
   *
   * 참고 — `@nerd/contracts` 자체는 Next 가 서버 번들에 인라인하므로 standalone 의
   * node_modules 에는 없다(컨테이너 실측: `require.resolve` 실패, 페이지는 정상 동작).
   * 즉 이 설정이 필요한 이유는 **트레이싱이 아니라 해석**이다.
   */
  outputFileTracingRoot: path.join(__dirname, '..', '..'),

  /**
   * 배포 식별자. CI 가 커밋 short SHA 를 주입한다 (이미지 태그와 같은 값).
   *
   * 레플리카 3개 + `start-first` 롤링에서는 교체 중 구·신 이미지가 **공존**한다.
   * 이 값이 없으면 옛 페이지를 열어둔 클라이언트가 이미 사라진 JS/CSS 청크를
   * 요청해 네비게이션이 깨진다(version skew). 값이 있으면 Next 가 불일치를
   * 감지해 하드 내비게이션으로 전환한다.
   *
   * 로컬 빌드에서는 `undefined` 라 기능이 꺼진다 — 의도된 동작이다.
   */
  deploymentId: process.env.DEPLOYMENT_VERSION,

  /**
   * ⭐ **로컬 전용 백엔드 프록시.** 배포에는 Caddy 가 있지만 로컬에는 없다.
   *
   * 브라우저는 백엔드를 **상대경로**로 부른다(`/api/v2/...`, `lib/api/client.ts`). 배포에서는
   * Caddy 가 그 경로만 백엔드로 분기하므로 오리진이 필요 없다. 그런데 로컬에는 그 분기가 없어
   * 요청이 Next dev 서버로 가고 **전부 404** 가 된다 — 로그인·가입·로그아웃이 통째로 막힌다
   * (2026-09-07 실측: `POST localhost:5502/api/v2/auth/signup` → 404,
   *  대조군 `localhost:5501` → 200).
   *
   * 🚫 서버 컴포넌트는 이 경로를 타지 않는다. 그쪽은 `BACKEND_INTERNAL_URL` 로 직접 부른다.
   *    즉 이 리라이트는 **브라우저발 요청만** 메운다.
   *
   * 🚫 프로덕션에서는 등록하지 않는다. Caddy 가 이미 앞단에서 분기해 Next 까지 오지 않으므로
   *    여기 규칙이 있으면 "어느 쪽이 실제로 동작하는지" 를 헷갈리게 만드는 죽은 설정이 된다.
   *
   * ⚠️ 경로 접두는 `@nerd/contracts` 의 `API_PREFIX` 와 같은 값이어야 한다. next.config 는
   *    Next 자체 로더가 읽으므로 워크스페이스 패키지를 import 하지 않고 문자열로 둔다 —
   *    `API_PREFIX` 를 바꾸면 이 줄도 같이 고친다.
   */
  async rewrites() {
    const target = process.env.BACKEND_INTERNAL_URL;
    if (process.env.NODE_ENV !== "development" || !target) return [];

    return [
      {
        source: "/api/v2/:path*",
        destination: `${target.replace(/\/+$/, "")}/api/v2/:path*`,
      },
    ];
  },

  /**
   * 🚫 `outputFileTracingIncludes` 로 sharp 를 강제 포함하지 않는다.
   *
   * 공식 문서에 `'/*': ['node_modules/sharp/**\/*']` 예시가 있어 넣었다가 뺐다.
   * pnpm 은 최상위에 `node_modules/sharp` 를 두지 않으므로(격리 구조)
   * 그 glob 은 **아무것도 매칭하지 못한다.** 설정이 있어도 하는 일이 없는데
   * "챙겼다"는 착각만 남는다.
   *
   * 2026-09-01 실측: 기본 트레이싱이 pnpm 경로를 따라 sharp 와
   * `@img/sharp-*` 네이티브 바이너리까지 이미 담는다. standalone 을 띄워
   * 래스터 이미지 최적화가 200 으로 동작하는 것을 확인했다.
   */
};

export default nextConfig;
