import { afterEach, describe, expect, it, vi } from "vitest";
import { logout } from "./auth";
import {
  isAutoEnterExcludedPath,
  isGuestAutoEnterSuppressed,
  shouldAutoEnterAsGuest,
  suppressGuestAutoEnter,
} from "./guestAutoEnter";

/** vitest 환경이 node 라 window 가 없다. 저장소만 흉내 낸다. */
function stubWindow(extra: Record<string, unknown> = {}) {
  const store = new Map<string, string>();
  vi.stubGlobal("window", {
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
    ...extra,
  });
  return store;
}

describe("isAutoEnterExcludedPath — 자동 입장을 하면 안 되는 화면", () => {
  it("로그인 화면을 제외한다 ⭐", () => {
    // 🚫 여기서 자동 입장이 돌면 로그인 폼이 「이미 로그인됨」 으로 판정해 즉시 튕긴다.
    //    그러면 **아무도 자기 계정으로 로그인할 수 없다.**
    expect(isAutoEnterExcludedPath("/login")).toBe(true);
  });

  it("마이페이지를 제외한다 — 로그아웃 버튼이 있는 화면이다", () => {
    expect(isAutoEnterExcludedPath("/me")).toBe(true);
  });

  it("하위 경로까지 제외한다", () => {
    expect(isAutoEnterExcludedPath("/login/help")).toBe(true);
  });

  it("접두사만 겹치는 경로는 막지 않는다 ⭐", () => {
    // `startsWith("/me")` 로만 판정하면 `/members` 가 통째로 막힌다.
    expect(isAutoEnterExcludedPath("/members")).toBe(false);
    expect(isAutoEnterExcludedPath("/login-help")).toBe(false);
  });

  it("체험 경로에서는 자동 입장한다", () => {
    expect(isAutoEnterExcludedPath("/")).toBe(false);
    expect(isAutoEnterExcludedPath("/library")).toBe(false);
    expect(isAutoEnterExcludedPath("/stories/jack-and-beanstalk/capture")).toBe(false);
  });
});

describe("자동 입장 억제 마크", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("기본은 억제되지 않는다", () => {
    stubWindow();
    expect(isGuestAutoEnterSuppressed()).toBe(false);
  });

  it("한 번 시도하면 다시 시도하지 않는다 ⭐", () => {
    // 🚫 실패를 재시도하면 레이트리밋(분당 10)을 스스로 소진한다.
    stubWindow();
    suppressGuestAutoEnter("attempted");
    expect(isGuestAutoEnterSuppressed()).toBe(true);
  });

  it("저장소가 막혀 있어도 터지지 않는다", () => {
    // 사생활 모드에서 sessionStorage 접근이 예외를 던지는 브라우저가 있다.
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem() {
          throw new Error("blocked");
        },
        setItem() {
          throw new Error("blocked");
        },
      },
    });

    expect(() => suppressGuestAutoEnter("attempted")).not.toThrow();
    expect(isGuestAutoEnterSuppressed()).toBe(false);
  });

  it("서버 렌더에서는 항상 억제다 — 쿠키는 브라우저에서만 심는다", () => {
    vi.stubGlobal("window", undefined);
    expect(isGuestAutoEnterSuppressed()).toBe(true);
  });
});

describe("shouldAutoEnterAsGuest — 계정을 만들어도 되는 순간인가", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("확인된 비로그인 + 체험 경로에서만 만든다", () => {
    stubWindow();
    expect(shouldAutoEnterAsGuest({ sessionStatus: "guest", pathname: "/library" })).toBe(true);
  });

  it("⭐ 아직 확인 전(unknown)에는 절대 만들지 않는다", () => {
    // 네트워크 오류로 `GET /auth/me` 를 못 끝낸 상태도 `unknown` 이다. 여기서 만들면
    // **이미 로그인한 사람이** 잠깐 끊긴 사이에 임시 계정으로 바뀌어 자기 동화를 잃은 것처럼 보인다.
    stubWindow();
    expect(shouldAutoEnterAsGuest({ sessionStatus: "unknown", pathname: "/library" })).toBe(false);
  });

  it("이미 로그인했으면 만들지 않는다", () => {
    stubWindow();
    expect(shouldAutoEnterAsGuest({ sessionStatus: "authenticated", pathname: "/library" })).toBe(
      false,
    );
  });

  it("로그인 화면에서는 만들지 않는다 ⭐", () => {
    stubWindow();
    expect(shouldAutoEnterAsGuest({ sessionStatus: "guest", pathname: "/login" })).toBe(false);
  });

  it("억제된 탭에서는 만들지 않는다 (로그아웃 직후·이미 시도함)", () => {
    stubWindow();
    suppressGuestAutoEnter("logged-out");
    expect(shouldAutoEnterAsGuest({ sessionStatus: "guest", pathname: "/library" })).toBe(false);
  });
});

describe("logout — 자동 입장이 로그아웃을 되돌리지 못하게", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("로그아웃하면 이 탭의 자동 입장이 멈춘다 ⭐", async () => {
    // 🚫 막지 않으면 로그아웃 직후 새 임시 계정이 생겨 헤더가 「마이페이지」로 되돌아간다.
    stubWindow({ dispatchEvent: vi.fn() });
    vi.stubGlobal("fetch", () => Promise.resolve(new Response(null, { status: 204 })));

    await logout();

    expect(isGuestAutoEnterSuppressed()).toBe(true);
  });

  it("로그아웃 요청이 실패해도 멈춘다", async () => {
    stubWindow({ dispatchEvent: vi.fn() });
    vi.stubGlobal("fetch", () => Promise.resolve(new Response(null, { status: 500 })));

    await expect(logout()).rejects.toThrow();

    expect(isGuestAutoEnterSuppressed()).toBe(true);
  });
});
