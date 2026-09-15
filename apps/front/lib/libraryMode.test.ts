import { describe, expect, it } from "vitest";
import { getLibraryHref, getLibraryStoryHref, isLibraryCreateMode } from "./libraryMode";

describe("libraryMode", () => {
  it("mode 값이 정확히 create인 경우만 제작 모드로 판정한다", () => {
    expect(isLibraryCreateMode("create")).toBe(true);
    expect(isLibraryCreateMode(undefined)).toBe(false);
    expect(isLibraryCreateMode("trial")).toBe(false);
    expect(isLibraryCreateMode(["create"])).toBe(false);
    expect(isLibraryCreateMode(["create", "trial"])).toBe(false);
  });

  it("제작 모드를 서재와 동화 상세 링크에만 보존한다", () => {
    expect(getLibraryHref(true)).toBe("/library?mode=create");
    expect(getLibraryHref(false)).toBe("/library");
    expect(getLibraryStoryHref("red-riding-hood", true)).toBe(
      "/library/red-riding-hood?mode=create",
    );
    expect(getLibraryStoryHref("red-riding-hood", false)).toBe("/library/red-riding-hood");
  });

  it("상세 링크의 slug를 URL 경로에 맞게 인코딩한다", () => {
    expect(getLibraryStoryHref("story/one", true)).toBe("/library/story%2Fone?mode=create");
  });
});
