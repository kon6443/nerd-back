import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFirstPageArt, prefetchFirstPageArt, resetFirstPageArtCache } from "./firstPageArt";

describe("firstPageArt", () => {
  beforeEach(() => {
    resetFirstPageArtCache();
  });

  it("같은 동화를 여러 번 요청해도 한 번만 부른다", async () => {
    // 카드 위를 마우스가 몇 번 지나가든 2MB 짜리 삽화를 다시 받지 않는다.
    const fetcher = vi.fn().mockResolvedValue("https://example.test/page-1.webp");

    const [a, b] = await Promise.all([
      prefetchFirstPageArt("jack", fetcher),
      prefetchFirstPageArt("jack", fetcher),
    ]);
    await prefetchFirstPageArt("jack", fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a).toBe("https://example.test/page-1.webp");
    expect(b).toBe("https://example.test/page-1.webp");
    expect(getFirstPageArt("jack")).toBe("https://example.test/page-1.webp");
  });

  it("삽화가 없는 동화는 없다고 기억하고 다시 묻지 않는다", async () => {
    const fetcher = vi.fn().mockResolvedValue(null);

    await prefetchFirstPageArt("empty", fetcher);
    await prefetchFirstPageArt("empty", fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(getFirstPageArt("empty")).toBeUndefined();
  });

  it("데이터 절약 모드에서는 2.3MB 짜리 삽화를 당겨오지 않는다", async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, "connection");
    Object.defineProperty(navigator, "connection", { value: { saveData: true }, configurable: true });
    const fetcher = vi.fn().mockResolvedValue("https://example.test/page-1.webp");

    expect(await prefetchFirstPageArt("jack", fetcher)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();

    if (original) Object.defineProperty(navigator, "connection", original);
    else Reflect.deleteProperty(navigator, "connection");
  });

  it("실패는 캐시하지 않는다 — 다음 기회에 다시 받는다", async () => {
    // 🚫 일시적인 네트워크 오류를 "삽화 없음"으로 굳히면 그 동화만 영영 빈 종이로 펼쳐진다.
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce("https://example.test/page-1.webp");

    expect(await prefetchFirstPageArt("flaky", fetcher)).toBeNull();
    expect(await prefetchFirstPageArt("flaky", fetcher)).toBe("https://example.test/page-1.webp");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
