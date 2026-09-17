import { describe, expect, it } from "vitest";
import { ensureMinimumTarget, projectCoverHitbox } from "./characterHotspotGeometry";

describe("projectCoverHitbox", () => {
  it("같은 비율에서는 정규 좌표를 그대로 픽셀 좌표로 바꾼다", () => {
    expect(
      projectCoverHitbox(
        { x: 0.25, y: 0.2, width: 0.5, height: 0.6 },
        { width: 1000, height: 1000 },
        { width: 400, height: 400 },
      ),
    ).toEqual({ left: 100, top: 80, width: 200, height: 240 });
  });

  it("정사각 이미지를 가로 컨테이너에 cover하면 위아래 크롭을 반영한다", () => {
    expect(
      projectCoverHitbox(
        { x: 0.1, y: 0.25, width: 0.3, height: 0.5 },
        { width: 1000, height: 1000 },
        { width: 400, height: 200 },
      ),
    ).toEqual({ left: 40, top: 0, width: 120, height: 200 });
  });

  it("세로 이미지를 가로 컨테이너에 cover하고 화면 밖 부분을 안전하게 자른다", () => {
    expect(
      projectCoverHitbox(
        { x: 0.2, y: 0.3, width: 0.6, height: 0.3 },
        { width: 600, height: 1200 },
        { width: 600, height: 300 },
      ),
    ).toEqual({ left: 120, top: 0, width: 360, height: 270 });
  });

  it("크롭 뒤 보이는 영역이 없거나 크기가 잘못되면 null이다", () => {
    expect(
      projectCoverHitbox(
        { x: 0, y: 0, width: 1, height: 0.1 },
        { width: 600, height: 1200 },
        { width: 600, height: 300 },
      ),
    ).toBeNull();
    expect(
      projectCoverHitbox(
        { x: 0, y: 0, width: 1, height: 1 },
        { width: 0, height: 1200 },
        { width: 600, height: 300 },
      ),
    ).toBeNull();
  });
});

describe("ensureMinimumTarget", () => {
  it("작은 영역을 중심 기준으로 넓히고 경계를 넘지 않는다", () => {
    expect(
      ensureMinimumTarget(
        { left: 2, top: 3, width: 20, height: 30 },
        { width: 200, height: 100 },
        56,
      ),
    ).toEqual({ left: 0, top: 0, width: 56, height: 56 });
  });
});
