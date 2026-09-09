import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_CHANGED_EVENT } from "./client";
import { logout, validateLogin, validateSignup } from "./auth";

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

describe("logout — 세션 변경 신호", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function stubBrowser(fetchImpl: () => Promise<Response>) {
    const dispatchEvent = vi.fn();
    // vitest 환경이 node 라 window 가 없다. 신호가 브라우저에서만 나가는 것도 함께 검증된다.
    vi.stubGlobal("window", { dispatchEvent });
    vi.stubGlobal("fetch", fetchImpl);
    return dispatchEvent;
  }

  it("성공하면 SESSION_CHANGED 를 발행한다 ⭐", async () => {
    // 🚫 이 신호가 없으면 로그아웃 후에도 네비가 「마이페이지」로 남는다 —
    //    AppHeader 가 루트 레이아웃의 클라이언트 컴포넌트라 다시 조회하지 않기 때문이다.
    const dispatchEvent = stubBrowser(() => Promise.resolve(new Response(null, { status: 204 })));

    await logout();

    const types = dispatchEvent.mock.calls.map((c) => (c[0] as { type: string }).type);
    expect(types).toContain(SESSION_CHANGED_EVENT);
  });

  it("실패해도 발행한다 — 화면이 갇히지 않게", async () => {
    const dispatchEvent = stubBrowser(() => Promise.resolve(new Response(null, { status: 500 })));

    await expect(logout()).rejects.toThrow();

    const types = dispatchEvent.mock.calls.map((c) => (c[0] as { type: string }).type);
    expect(types).toContain(SESSION_CHANGED_EVENT);
  });
});
