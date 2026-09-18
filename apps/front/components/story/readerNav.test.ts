import { describe, expect, it } from "vitest";
import { STACK_MAX_PX, STACK_MIN_PX, isReaderPath, readerHref, readerPageNo, stackWidths, turnDirection, adjacentArtUrls } from "./readerNav";

describe("isReaderPath", () => {
  it("쪽 번호까지 있는 경로만 리더다", () => {
    expect(isReaderPath("/library/red-riding-hood/2")).toBe(true);
    expect(isReaderPath("/library/red-riding-hood/2/")).toBe(true);
    expect(isReaderPath("/library/red-riding-hood")).toBe(false);
    expect(isReaderPath("/library")).toBe(false);
    expect(isReaderPath("/stories/red-riding-hood/read")).toBe(false);
  });
});

describe("readerPageNo", () => {
  it("이 동화의 범위 안 쪽 번호를 읽는다", () => {
    expect(readerPageNo("/library/jack/3", "jack", 5)).toBe(3);
  });

  it("다른 동화·범위 밖·형식 오류는 null", () => {
    expect(readerPageNo("/library/other/3", "jack", 5)).toBeNull();
    expect(readerPageNo("/library/jack/0", "jack", 5)).toBeNull();
    expect(readerPageNo("/library/jack/6", "jack", 5)).toBeNull();
    expect(readerPageNo("/library/jack", "jack", 5)).toBeNull();
  });

  it("readerHref 가 만든 주소를 되읽는다 — 인코딩이 필요한 slug 포함", () => {
    expect(readerPageNo(readerHref("a b", 2), "a b", 5)).toBe(2);
  });
});

describe("turnDirection", () => {
  it("쪽 번호가 커지면 다음, 작아지면 이전", () => {
    expect(turnDirection(1, 2)).toBe("next");
    expect(turnDirection(4, 1)).toBe("prev");
  });
});

describe("stackWidths", () => {
  it("첫 쪽은 오른쪽이, 마지막 쪽은 왼쪽이 두껍다", () => {
    expect(stackWidths(1, 5)).toEqual({ left: STACK_MIN_PX, right: STACK_MAX_PX });
    expect(stackWidths(5, 5)).toEqual({ left: STACK_MAX_PX, right: STACK_MIN_PX });
  });

  it("두 쪽 두께의 합은 늘 같다 — 책 전체 두께가 변하지 않는다", () => {
    for (let pageNo = 1; pageNo <= 7; pageNo++) {
      const { left, right } = stackWidths(pageNo, 7);
      expect(left + right).toBe(STACK_MIN_PX + STACK_MAX_PX);
    }
  });

  it("한 쪽짜리·범위 밖 입력에도 한도 안에 머문다", () => {
    expect(stackWidths(1, 1)).toEqual({ left: STACK_MIN_PX, right: STACK_MAX_PX });
    expect(stackWidths(99, 5)).toEqual({ left: STACK_MAX_PX, right: STACK_MIN_PX });
  });
});

describe("미리 받을 인접 삽화", () => {
  const urls = ["/p1.webp", "/p2.webp", "/p3.webp", "/p4.webp", "/p5.webp"];

  // ⭐ 대부분 앞으로 넘긴다. 다음 쪽이 가장 먼저여야 한다.
  it("다음 쪽을 가장 먼저 고른다 ⭐", () => {
    expect(adjacentArtUrls(urls, 2)[0]).toBe("/p3.webp");
  });

  it("다음·이전·다다음을 고른다", () => {
    expect(adjacentArtUrls(urls, 2)).toEqual(["/p3.webp", "/p1.webp", "/p4.webp"]);
  });

  // 🚫 전 쪽을 받으면 첫 화면 대역폭을 뺏겨 지금 볼 쪽이 늦어진다.
  it("전 쪽을 다 고르지 않는다", () => {
    expect(adjacentArtUrls(urls, 1).length).toBeLessThan(urls.length);
  });

  it("범위를 벗어난 쪽은 건너뛴다", () => {
    expect(adjacentArtUrls(urls, 1)).toEqual(["/p2.webp", "/p3.webp"]);
    expect(adjacentArtUrls(urls, 5)).toEqual(["/p4.webp"]);
  });

  it("삽화가 없는 쪽(null)은 건너뛴다", () => {
    expect(adjacentArtUrls(["/p1.webp", null, "/p3.webp"], 1)).toEqual(["/p3.webp"]);
  });

  // 쪽이 적으면 오프셋이 같은 URL 을 가리킬 수 있다.
  it("같은 URL 을 두 번 고르지 않는다", () => {
    const two = ["/a.webp", "/b.webp"];
    expect(adjacentArtUrls(two, 1)).toEqual(["/b.webp"]);
  });

  it("빈 목록에도 견딘다", () => {
    expect(adjacentArtUrls([], 1)).toEqual([]);
  });
});
