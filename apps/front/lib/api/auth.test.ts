import { describe, expect, it } from "vitest";
import { validateLogin, validateSignup } from "./auth";

describe("validateSignup — 백엔드와 같은 스키마", () => {
  it("올바른 입력은 오류가 없다", () => {
    expect(validateSignup({ loginId: "tester", password: "pw12345678" })).toEqual({});
  });

  it("아이디 형식 오류를 필드에 붙인다", () => {
    const errors = validateSignup({ loginId: "AB", password: "pw12345678" });

    expect(errors.loginId).toBeTruthy();
    expect(errors.password).toBeUndefined();
  });

  it("짧은 비밀번호를 잡는다", () => {
    expect(validateSignup({ loginId: "tester", password: "short" }).password).toBeTruthy();
  });

  it("필드마다 첫 메시지만 남긴다 — 입력칸 아래 한 줄씩 보여주므로", () => {
    const errors = validateSignup({ loginId: "", password: "" });

    expect(Object.keys(errors).sort()).toEqual(["loginId", "password"]);
    expect(typeof errors.loginId).toBe("string");
  });
});

describe("validateLogin — 가입 규칙을 적용하지 않는다 ⭐", () => {
  it("가입 규칙에 안 맞는 아이디도 통과시킨다", () => {
    // 여기서 형식 오류를 보여주면 그 표시가 곧 "그런 아이디는 없다" 는 신호가 된다.
    expect(validateLogin({ loginId: "AB", password: "x" })).toEqual({});
  });

  it("비어 있는 것만 잡는다", () => {
    const errors = validateLogin({ loginId: "", password: "" });

    expect(errors.loginId).toBe("아이디를 입력해 주세요.");
    expect(errors.password).toBe("비밀번호를 입력해 주세요.");
  });
});
