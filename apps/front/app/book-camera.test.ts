import { describe, expect, it } from "vitest";
import { bookCamera } from "@/app/book-camera";

describe("bookCamera", () => {
  it("고정된 책 전체에서 성문 앞 눈높이까지 가까워진다", () => {
    for (const aspect of [390 / 711, 1440 / 823]) {
      const frames = [0, 0.25, 0.5, 0.75, 1].map(entry => bookCamera(entry, aspect));
      const distances = frames.map(({ position }) => Math.hypot(position[0] - 1.4, position[1] - 1.04, position[2] + 0.6));
      distances.slice(1).forEach((distance, i) => expect(distance).toBeLessThan(distances[i]));
      expect(frames[4].position).toEqual([1.4, 1.08, 0.05]);
      expect(frames[4].target).toEqual([1.4, 1.04, -0.6]);
      expect(frames[4].offset.x).toBeCloseTo(0);
      expect(frames[4].offset.y).toBeCloseTo(0);
    }
  });

  it("모바일에서도 시작 시 책의 전체 폭을 담는다", () => {
    const mobile = bookCamera(0, 390 / 711);
    const desktop = bookCamera(0, 1440 / 823);
    expect(mobile.position[2]).toBeGreaterThan(desktop.position[2]);
    expect(mobile.offset.x).toBe(0);
    expect(desktop.offset.x).toBeLessThan(0);
  });

  it("출발·가운데·도착 구간에서 순간적으로 튀지 않는다", () => {
    for (const p of [0.001, 0.25, 0.5, 0.75, 0.999]) {
      const before = bookCamera(p - 0.001, 390 / 711);
      const after = bookCamera(p + 0.001, 390 / 711);
      expect(Math.hypot(...after.position.map((v, i) => v - before.position[i]))).toBeLessThan(0.12);
    }
  });

  it("경계 밖 입력은 안전한 시점으로 제한한다", () => {
    expect(bookCamera(-1, 1.75)).toEqual(bookCamera(0, 1.75));
    expect(bookCamera(2, 1.75)).toEqual(bookCamera(1, 1.75));
    expect(bookCamera(Number.NaN, 0).position.every(Number.isFinite)).toBe(true);
  });
});
