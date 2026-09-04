import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 순수 로직과 lib/api 래퍼부터 덮는다. 컴포넌트 테스트(jsdom + RTL)는 도입 시점에 추가한다.
    environment: "node",
    include: ["{app,components,lib}/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
  resolve: {
    alias: {
      // ⚠️ contracts 는 **소스로** 해석한다. dist 로 두면 contracts 를 고치고 빌드를 안 했을 때
      //    테스트가 낡은 산출물을 검증한다. `tsc`(check:types·build)는 package.json 의 main 을
      //    따라 dist 를 보고, `prepare` 가 설치 시점에 그걸 만들어 둔다.
      "@nerd/contracts": path.resolve(import.meta.dirname, "../../packages/contracts/src/index.ts"),
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
