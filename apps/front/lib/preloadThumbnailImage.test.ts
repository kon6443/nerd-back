import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("preloadThumbnailImage", () => {
  let preload: typeof import("./preloadThumbnailImage").preloadThumbnailImage;
  const createImage = vi.fn(function () {
    return { src: "", decode: () => Promise.resolve() };
  });
  const url = (index: number) => `https://storage.local/thumbnail-${index}.png`;

  beforeEach(async () => {
    vi.resetModules();
    createImage.mockClear();
    vi.stubGlobal("window", { Image: createImage });
    preload = (await import("./preloadThumbnailImage")).preloadThumbnailImage;
  });

  afterEach(() => vi.unstubAllGlobals());

  it("빈 URL과 서버 환경에서는 이미지를 만들지 않는다", () => {
    preload(null);
    preload(undefined);
    preload("");
    vi.unstubAllGlobals();
    preload(url(0));
    expect(createImage).not.toHaveBeenCalled();
  });

  it("같은 URL은 decode 완료 전후로 중복 요청하지 않는다", async () => {
    preload(url(0));
    preload(url(0));
    await Promise.resolve();
    preload(url(0));
    expect(createImage).toHaveBeenCalledTimes(1);
  });

  it("최근 128개를 넘으면 오래된 URL 기록을 축출한다", () => {
    for (let i = 0; i < 129; i++) preload(url(i));
    preload(url(128));
    expect(createImage).toHaveBeenCalledTimes(129);
    preload(url(0));
    expect(createImage).toHaveBeenCalledTimes(130);
  });

  it("중복 접근한 URL의 최근 사용 순서를 갱신한다", () => {
    for (let i = 0; i < 128; i++) preload(url(i));
    preload(url(0));
    preload(url(128));
    preload(url(0));
    expect(createImage).toHaveBeenCalledTimes(129);
    preload(url(1));
    expect(createImage).toHaveBeenCalledTimes(130);
  });

  it("decode에 실패한 현재 요청은 다음 접근에서 다시 시도한다", async () => {
    createImage.mockImplementationOnce(function () {
      return { src: "", decode: () => Promise.reject(new Error("decode failed")) };
    });
    preload(url(0));
    await Promise.resolve();
    preload(url(0));
    expect(createImage).toHaveBeenCalledTimes(2);
  });

  it("축출된 이전 요청의 늦은 실패가 새 요청의 기록을 지우지 않는다", async () => {
    let rejectPrevious!: (error: Error) => void;
    const previous = new Promise<void>((_, reject) => { rejectPrevious = reject; });
    createImage.mockImplementationOnce(function () {
      return { src: "", decode: () => previous };
    });
    preload(url(0));
    for (let i = 1; i <= 128; i++) preload(url(i));
    preload(url(0));
    expect(createImage).toHaveBeenCalledTimes(130);
    rejectPrevious(new Error("old request failed"));
    await Promise.resolve();
    preload(url(0));
    expect(createImage).toHaveBeenCalledTimes(130);
  });
});
