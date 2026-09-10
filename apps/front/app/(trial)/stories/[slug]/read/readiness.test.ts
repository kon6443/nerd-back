import { describe, expect, it } from "vitest";
import { isReaderReady } from "./readiness";

describe("독서 화면 진입 조건", () => {
  it("본편 5장이 준비되면 비하인드 생성 중이어도 독서를 시작한다", () => {
    expect(
      isReaderReady({
        isMainStoryReady: true,
        isAllCompleted: false,
        status: "generating",
      }),
    ).toBe(true);
  });

  it("모든 삽화가 완료되면 독서를 시작한다", () => {
    expect(
      isReaderReady({
        isMainStoryReady: false,
        isAllCompleted: true,
        status: "generating",
      }),
    ).toBe(true);
  });

  it("아직 본편이 준비되지 않았으면 생성 화면에 머문다", () => {
    expect(
      isReaderReady({
        isMainStoryReady: false,
        isAllCompleted: false,
        status: "generating",
      }),
    ).toBe(false);
  });
});
