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

describe("브라우저에 남기는 값 ⭐", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  /**
   * 🚫 **아이디가 저장되면 안 된다.** 로그아웃 없이 브라우저를 닫으면 다음 사람이 마이페이지를
   * 열자마자 앞사람의 아이디가 먼저 그려진다(2026-09-10 리뷰). 남기는 것은 로그인 여부뿐이다.
   */
  it("로그인 여부만 남기고 아이디는 남기지 않는다", async () => {
    const stored = new Map<string, string>();
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      localStorage: {
        getItem: (k: string) => stored.get(k) ?? null,
        setItem: (k: string, v: string) => void stored.set(k, v),
        removeItem: (k: string) => void stored.delete(k),
      },
    });
    vi.stubGlobal("document", { documentElement: { dataset: {} } });
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        new Response(JSON.stringify({ code: "SUCCESS", data: { loginId: "userA" }, message: "" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    process.env.BACKEND_INTERNAL_URL = "http://backend:5501";

    const { __loadForTest } = (await import("./useSession")) as unknown as {
      __loadForTest: () => Promise<void>;
    };
    await __loadForTest();

    const raw = stored.get("nerd:session");
    expect(raw).toBeDefined();
    expect(JSON.parse(raw as string)).toEqual({ status: "authenticated" });
    expect(raw).not.toContain("userA");
  });
});
