import { describe, expect, it } from "vitest";
import { getLibraryHref, getLibraryStoryHref, isLibraryCreateMode } from "./libraryMode";

describe("libraryMode", () => {
  it("mode 값이 정확히 create인 경우만 제작 모드로 판정한다", () => {
    expect(isLibraryCreateMode("create")).toBe(true);
    expect(isLibraryCreateMode(undefined)).toBe(false);
    expect(isLibraryCreateMode(null)).toBe(false);
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
    expect(getLibraryStoryHref("red-riding-hood", false)).toBe("/library/red-riding-hood/1");
  });

  it("상세 링크의 slug를 URL 경로에 맞게 인코딩한다", () => {
    expect(getLibraryStoryHref("story/one", true)).toBe("/library/story%2Fone?mode=create");
    expect(getLibraryStoryHref("story/one", false)).toBe("/library/story%2Fone/1");
  });

  describe("hasCompletedStory 기반 라우팅 분기", () => {
    it("시연 모드는 내 얼굴 동화 존재 여부와 무관하게 템플릿 본동화 1쪽으로 라우팅한다", () => {
      expect(getLibraryStoryHref("jack", false, false)).toBe("/library/jack/1");
      expect(getLibraryStoryHref("jack", false, true)).toBe("/library/jack/1");
      expect(getLibraryStoryHref("jack", false, undefined)).toBe("/library/jack/1");
      expect(getLibraryStoryHref("story/one", false, true)).toBe("/library/story%2Fone/1");
    });

    it("얼굴로 만든 동화가 없을 때 제작 모드는 캡처 촬영 페이지로 라우팅한다", () => {
      expect(getLibraryStoryHref("jack", true, false)).toBe("/stories/jack/capture");
      expect(getLibraryStoryHref("story/one", true, false)).toBe("/stories/story%2Fone/capture");
    });

    it("이미 얼굴로 만든 동화가 있을 때 제작 모드는 동화 상세(/library/{동화}?mode=create)로 라우팅한다", () => {
      expect(getLibraryStoryHref("jack", true, true)).toBe("/library/jack?mode=create");
      expect(getLibraryStoryHref("story/one", true, true)).toBe("/library/story%2Fone?mode=create");
    });
  });
});
