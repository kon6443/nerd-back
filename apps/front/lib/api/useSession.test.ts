import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * ⭐ 검증 대상은 **요청이 공유되는가** 다.
 *
 * 헤더·헤더 안의 CTA·화면의 CTA 가 동시에 붙으면 예전 구현은 각자 조회해
 * 한 페이지에 `GET /auth/me` 가 3번 나갔다(2026-09-09 실측). 모듈 스코프 저장소가
 * 그것을 한 번으로 줄인다.
 *
 * ⚠️ 훅 자체는 렌더가 필요해 여기서 부르지 않는다(vitest 환경이 node 다). 대신 훅이 쓰는
 * **적재 함수의 동시 호출 합치기**를 검증한다 — 3번이 1번이 되는 핵심이 그 부분이다.
 */
describe("세션 조회 합치기", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function loadModuleWithFetch(impl: () => Promise<Response>) {
    vi.stubGlobal("fetch", vi.fn(impl));
    vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    process.env.BACKEND_INTERNAL_URL = "http://backend:5501";
    return import("./useSession");
  }

  it("동시에 세 번 요청해도 fetch 는 한 번이다 ⭐", async () => {
    const body = JSON.stringify({ code: "SUCCESS", data: { loginId: "t" }, message: "" });
    let resolve!: (r: Response) => void;
    const pending = new Promise<Response>((r) => {
      resolve = r;
    });

    await loadModuleWithFetch(() => pending);
    const { __loadForTest } = (await import("./useSession")) as unknown as {
      __loadForTest: () => Promise<void>;
    };

    // 응답이 오기 전에 셋이 동시에 붙는 상황을 만든다.
    const all = Promise.all([__loadForTest(), __loadForTest(), __loadForTest()]);
    resolve(new Response(body, { status: 200, headers: { "Content-Type": "application/json" } }));
    await all;

    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
  });
});
