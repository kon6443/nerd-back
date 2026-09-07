import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchStories, fetchStoryDetail, fetchStoryPage } from "./story";

/** 서버 컨텍스트로 돌리기 위해 baseURL 을 준다 (vitest environment 는 node 라 window 가 없다). */
process.env.BACKEND_INTERNAL_URL = "http://backend:5501";

function mockOk(data: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ code: "SUCCESS", data, message: "" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function calledUrl(spy: ReturnType<typeof mockOk>): string {
  return String(spy.mock.calls[0]?.[0]);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("동화 조회 경로", () => {
  it("목록은 prefix 를 붙인 /stories 를 부른다", async () => {
    const spy = mockOk([]);

    await fetchStories();

    expect(calledUrl(spy)).toBe("http://backend:5501/api/v2/stories");
  });

  it("상세는 slug 를 경로에 넣는다", async () => {
    const spy = mockOk({ slug: "dev-cloud-village" });

    await fetchStoryDetail("dev-cloud-village");

    expect(calledUrl(spy)).toBe("http://backend:5501/api/v2/stories/dev-cloud-village");
  });

  it("페이지는 slug 와 pageNo 를 경로에 넣는다", async () => {
    const spy = mockOk({ pageNo: 3 });

    await fetchStoryPage("dev-cloud-village", 3);

    expect(calledUrl(spy)).toBe("http://backend:5501/api/v2/stories/dev-cloud-village/pages/3");
  });

  it("slug 를 인코딩한다 ⭐ — 주소창에서 바꿔도 경로가 갈라지지 않는다", async () => {
    // 인코딩하지 않으면 `/stories/a/../auth/me` 같은 입력이 다른 엔드포인트를 부른다.
    const spy = mockOk({});

    await fetchStoryDetail("a/../auth/me");

    expect(calledUrl(spy)).toBe("http://backend:5501/api/v2/stories/a%2F..%2Fauth%2Fme");
  });

  it("봉투를 벗겨 data 만 돌려준다", async () => {
    mockOk([{ slug: "dev-cloud-village", title: "구름 마을", summary: null, coverImageKey: null }]);

    await expect(fetchStories()).resolves.toEqual([
      { slug: "dev-cloud-village", title: "구름 마을", summary: null, coverImageKey: null },
    ]);
  });
});
