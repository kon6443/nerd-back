import type { MyStorySessionItem } from "@nerd/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCachedThumbnailUrls,
  getCompletedThumbnailUrls,
  getOwnedThumbnailUrl,
  setCachedThumbnailUrls,
} from "./libraryStories";

function session(
  overrides: Partial<MyStorySessionItem> & Pick<MyStorySessionItem, "id" | "templateSlug">,
): MyStorySessionItem {
  return {
    templateId: 1,
    templateTitle: "동화",
    status: "completed",
    referenceImageUrl: null,
    thumbnailImageUrl: null,
    createdAt: "2026-09-15T00:00:00.000Z",
    updatedAt: "2026-09-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("getCompletedThumbnailUrls", () => {
  it("완료 세션의 개인화 1쪽 URL을 동화 slug에 매칭한다", () => {
    const thumbnails = getCompletedThumbnailUrls([
      session({
        id: "completed",
        templateSlug: "red-riding-hood",
        thumbnailImageUrl: "https://storage.local/page-1.png",
      }),
    ]);

    expect(thumbnails.get("red-riding-hood")).toBe("https://storage.local/page-1.png");
    expect(thumbnails.get("another-story")).toBeUndefined();
  });

  it("썸네일 URL이 없는 세션은 기본 삽화를 위해 제외한다", () => {
    const thumbnails = getCompletedThumbnailUrls([
      session({
        id: "generating",
        templateSlug: "jack",
        status: "generating",
        thumbnailImageUrl: "https://storage.local/page-1.png",
      }),
      session({ id: "missing", templateSlug: "hood", thumbnailImageUrl: null }),
    ]);

    expect(thumbnails.get("jack")).toBeUndefined();
    expect(thumbnails.get("hood")).toBeUndefined();
  });
});

describe("getOwnedThumbnailUrl", () => {
  const ownedThumbnails = {
    ownerLoginId: "first_user",
    urls: new Map([["jack", "https://storage.local/first-user-page-1.png"]]),
  };

  it("현재 로그인 사용자가 소유한 썸네일만 반환한다", () => {
    expect(getOwnedThumbnailUrl(ownedThumbnails, "first_user", "jack")).toBe(
      "https://storage.local/first-user-page-1.png",
    );
  });

  it("로그아웃하거나 사용자가 바뀌면 이전 썸네일을 노출하지 않는다", () => {
    expect(getOwnedThumbnailUrl(ownedThumbnails, null, "jack")).toBeUndefined();
    expect(getOwnedThumbnailUrl(ownedThumbnails, "next_user", "jack")).toBeUndefined();
  });
});

describe("getCachedThumbnailUrls", () => {
  it("현재 로그인 사용자 캐시만 반환한다", () => {
    const cache = {
      ownerLoginId: "first_user",
      urls: new Map([["jack", "https://storage.local/first-user-page-1.png"]]),
    };
    setCachedThumbnailUrls(cache);

    expect(getCachedThumbnailUrls("first_user")).toBe(cache);
    expect(getCachedThumbnailUrls("next_user")).toBeNull();
  });
});

describe("preloadThumbnailImage", () => {
  let preload: typeof import("./libraryStories").preloadThumbnailImage;
  const createImage = vi.fn(function () {
    return { src: "", decode: () => Promise.resolve() };
  });
  const url = (index: number) => `https://storage.local/thumbnail-${index}.png`;

  beforeEach(async () => {
    vi.resetModules();
    createImage.mockClear();
    vi.stubGlobal("window", { Image: createImage });
    preload = (await import("./libraryStories")).preloadThumbnailImage;
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
