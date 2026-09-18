import { describe, expect, it } from "vitest";
import { getDemoStoryImageUrl } from "./demoStoryAssets";

describe("getDemoStoryImageUrl", () => {
  it("시연 모드가 아니거나 유효하지 않은 프리셋인 경우 원본 fallbackUrl을 반환한다", () => {
    expect(getDemoStoryImageUrl("jack-and-beanstalk", null, 1, "https://orig.png")).toBe(
      "https://orig.png",
    );
    expect(getDemoStoryImageUrl("jack-and-beanstalk", "unknown", 1, "https://orig.png")).toBe(
      "https://orig.png",
    );
  });

  it("잭과 콩나무 1~5쪽은 남/녀 프리셋에 맞는 정적 합성 이미지 경로를 반환한다", () => {
    for (let page = 1; page <= 5; page++) {
      expect(getDemoStoryImageUrl("jack-and-beanstalk", "male", page, "https://orig.png")).toBe(
        `/demo/stories/jack-and-beanstalk/male/page-${page}.jpg`,
      );
      expect(getDemoStoryImageUrl("jack-and-beanstalk", "female", page, "https://orig.png")).toBe(
        `/demo/stories/jack-and-beanstalk/female/page-${page}.jpg`,
      );
    }
  });

  it("아직 합성 이미지가 없는 페이지(예: 6쪽)나 다른 동화는 원본 fallbackUrl을 반환한다", () => {
    expect(getDemoStoryImageUrl("jack-and-beanstalk", "male", 6, "https://orig.png")).toBe(
      "https://orig.png",
    );
    expect(getDemoStoryImageUrl("red-riding-hood", "female", 1, "https://orig.png")).toBe(
      "https://orig.png",
    );
  });
});
