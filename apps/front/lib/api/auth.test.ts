import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_CHANGED_EVENT } from "./client";
import { enterAsGuest, logout, validateLogin, validateSignup } from "./auth";

function stubBrowser(fetchImpl: () => Promise<Response>) {
  const dispatchEvent = vi.fn();
  // vitest 환경이 node 라 window 가 없다. 신호가 브라우저에서만 나가는 것도 함께 검증된다.
  vi.stubGlobal("window", { dispatchEvent });
  vi.stubGlobal("fetch", fetchImpl);
  return dispatchEvent;
}

function dispatchedTypes(dispatchEvent: ReturnType<typeof vi.fn>): string[] {
  return dispatchEvent.mock.calls.map((c) => (c[0] as { type: string }).type);
}

describe("validateSignup — 백엔드와 같은 스키마", () => {
  it("올바른 입력은 오류가 없다", () => {
    expect(validateSignup({ loginId: "tester", password: "pw12345678" })).toEqual({});
  });

  it("닉네임 형식 오류를 필드에 붙인다", () => {
    const errors = validateSignup({ loginId: "AB", password: "pw12345678" });

    expect(errors.loginId).toBeTruthy();
    expect(errors.password).toBeUndefined();
  });

  it("한글 닉네임을 받는다 ⭐", () => {
    // 🚫 화면이 「닉네임」 이라고 부르면서 한글을 막으면, 대부분의 사용자가 첫 입력에서 막힌다.
    expect(validateSignup({ loginId: "민수", password: "pw12345678" })).toEqual({});
    expect(validateSignup({ loginId: "동화친구", password: "pw12345678" })).toEqual({});
  });

  it("두 글자 이름을 막지 않는다 ⭐", () => {
    // 한글 이름은 두 글자가 흔하다. 하한이 4자면 한글 허용이 사실상 무의미해진다.
    expect(validateSignup({ loginId: "민수", password: "pw12345678" }).loginId).toBeUndefined();
    expect(validateSignup({ loginId: "수", password: "pw12345678" }).loginId).toBeTruthy();
  });

  it("게스트 접두사는 사람이 쓸 수 없다 ⭐", () => {
    // 🚫 막지 않으면 그 계정이 마이페이지에서 게스트로 오인되어
    //    「로그아웃하면 다시 들어올 수 없다」 는 거짓 경고를 본다.
    const errors = validateSignup({ loginId: "guest_hacker", password: "pw12345678" });

    expect(errors.loginId).toBeTruthy();
    expect(errors.password).toBeUndefined();
  });

  it("대문자는 계속 막는다", () => {
    // DB collation 이 대소문자를 무시해 `Kim` 과 `kim` 이 같은 계정이 된다 (loginIdSchema 주석).
    expect(validateSignup({ loginId: "Minsu", password: "pw12345678" }).loginId).toBeTruthy();
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

    expect(errors.loginId).toBe("닉네임을 입력해 주세요.");
    expect(errors.password).toBe("비밀번호를 입력해 주세요.");
  });
});

describe("logout — 세션 변경 신호", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("성공하면 SESSION_CHANGED 를 발행한다 ⭐", async () => {
    // 🚫 이 신호가 없으면 로그아웃 후에도 네비가 「마이페이지」로 남는다 —
    //    AppHeader 가 루트 레이아웃의 클라이언트 컴포넌트라 다시 조회하지 않기 때문이다.
    const dispatchEvent = stubBrowser(() => Promise.resolve(new Response(null, { status: 204 })));

    await logout();

    expect(dispatchedTypes(dispatchEvent)).toContain(SESSION_CHANGED_EVENT);
  });

  it("실패해도 발행한다 — 화면이 갇히지 않게", async () => {
    const dispatchEvent = stubBrowser(() => Promise.resolve(new Response(null, { status: 500 })));

    await expect(logout()).rejects.toThrow();

    expect(dispatchedTypes(dispatchEvent)).toContain(SESSION_CHANGED_EVENT);
  });
});

describe("enterAsGuest — 입력 없이 들어가기", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("본문 없이 POST 하고 세션 변경을 알린다 ⭐", async () => {
    // 🚫 알리지 않으면 입장은 됐는데 헤더가 「로그인」 그대로 남는다 (signup·login 과 같은 이유).
    const calls: [string, RequestInit][] = [];
    const dispatchEvent = stubBrowser(() => Promise.resolve(new Response(null, { status: 204 })));
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      calls.push([url, init]);
      return Promise.resolve(
        new Response(JSON.stringify({ code: "SUCCESS", data: { loginId: "guest_abcdefghij" }, message: "" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      );
    });

    await expect(enterAsGuest()).resolves.toEqual({ loginId: "guest_abcdefghij" });

    const [url, init] = calls[0];
    expect(url).toContain("/auth/guest");
    expect(init.method).toBe("POST");
    // 서버가 자격증명을 만든다 — 보낼 것이 없다.
    expect(init.body).toBeUndefined();
    expect(dispatchedTypes(dispatchEvent)).toContain(SESSION_CHANGED_EVENT);
  });
});
