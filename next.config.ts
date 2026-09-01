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
