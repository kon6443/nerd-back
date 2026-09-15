import type { MyStorySessionItem } from "@nerd/contracts";
import { describe, expect, it } from "vitest";
import { getCompletedThumbnailUrls, getOwnedThumbnailUrl } from "./libraryStories";

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

    expect(thumbnails.get("jack")).toBe("https://storage.local/page-1.png");
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
