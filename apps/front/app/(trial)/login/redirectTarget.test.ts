import { describe, expect, it } from "vitest";
import { DEFAULT_REDIRECT, safeRedirectPath } from "./redirectTarget";

describe("로그인 후 돌아갈 목적지", () => {
  it("사이트 안의 경로는 그대로 쓴다", () => {
    expect(safeRedirectPath("/me")).toBe("/me");
    expect(safeRedirectPath("/stories/jack/read?sessionId=1")).toBe(
      "/stories/jack/read?sessionId=1",
    );
  });

  it("값이 없으면 기본 목적지로 보낸다", () => {
    expect(safeRedirectPath(null)).toBe(DEFAULT_REDIRECT);
    expect(safeRedirectPath("")).toBe(DEFAULT_REDIRECT);
  });

  // ⭐ `startsWith("/")` 만 검사하면 전부 통과해 **외부 사이트로 나간다.**
  //    로그인 직후 피싱 사이트로 튕기는 흐름이 되므로 여기서 막는다.
  it.each([
    ["프로토콜 상대 URL", "//evil.example"],
    ["역슬래시 변형", "/\\evil.example"],
    ["절대 URL", "https://evil.example"],
    ["스킴 없는 호스트", "evil.example"],
  ])("%s 는 기본 목적지로 되돌린다 ⭐", (_label, hostile) => {
    expect(safeRedirectPath(hostile)).toBe(DEFAULT_REDIRECT);
  });

  it("경로 안의 슬래시는 막지 않는다", () => {
    expect(safeRedirectPath("/library/jack")).toBe("/library/jack");
  });
});
