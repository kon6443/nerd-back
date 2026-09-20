import { GUEST_ACCESS_ENABLED, GUEST_AUTO_ENTER } from "@nerd/contracts";

/**
 * 자동 게스트 입장의 **판정과 억제 마크**.
 *
 * 훅(`useGuestAutoEnter`)과 `logout()` 이 함께 쓰는데, 훅은 `auth.ts` 를 부르고 `auth.ts` 도 이 억제를
 * 불러야 한다. 🚫 한 파일에 두면 **순환 import** 가 된다 — 그래서 의존성이 없는 이 파일로 떼어 뒀다.
 *
 * 저장소는 `sessionStorage` 다(`localStorage` 가 아니다). 탭을 닫으면 사라지므로 **다음 방문자는
 * 다시 자동 입장**한다 — 공용 PC 에서 앞사람의 로그아웃이 뒷사람을 영구히 막지 않게.
 */
const SUPPRESS_KEY = "nerd:guest-auto-enter";

/**
 * 자동 입장이 **플래그상 켜져 있는가.**
 *
 * ⭐ 🚫 화면에서 `GUEST_AUTO_ENTER` 를 직접 보지 말고 **반드시 이 값을 본다.**
 * 두 플래그의 관계(`GUEST_ACCESS_ENABLED` 가 상위 스위치)를 화면마다 다시 적으면 조합이 어긋난다 —
 * 실제로 마이페이지가 `GUEST_AUTO_ENTER` 만 보다가, `GUEST_ACCESS_ENABLED=false` 로 게스트 기능을
 * 통째로 끈 상태에서 **로그아웃 버튼까지 사라지는** 결함이 있었다(2026-09-20 리뷰에서 발견).
 */
export const GUEST_AUTO_ENTER_ACTIVE = GUEST_ACCESS_ENABLED && GUEST_AUTO_ENTER;

/** 자동 입장을 하지 않는 경로. 하위 경로까지 포함한다. */
const EXCLUDED_PREFIXES = ["/login", "/me"] as const;

/**
 * ⭐ **로그인 화면을 반드시 뺀다.** 여기서 자동 입장이 돌면 로그인 폼이 「이미 로그인됨」 으로 판정해
 * 곧바로 다른 화면으로 튕기고, **아무도 자기 계정으로 로그인할 수 없게 된다.**
 * 마이페이지도 같은 이유로 뺀다 — 로그아웃 버튼이 있는 화면이다.
 */
export function isAutoEnterExcludedPath(pathname: string): boolean {
  return EXCLUDED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * 이 탭에서 자동 입장을 멈춘다.
 *
 * - `"logged-out"` — 로그아웃 직후. 막지 않으면 **로그아웃이 안 되는 것처럼 보인다.**
 * - `"attempted"` — 이미 한 번 시도함. 실패했더라도 다시 걸지 않는다(레이트리밋 폭주 방지).
 */
export function suppressGuestAutoEnter(reason: "logged-out" | "attempted"): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SUPPRESS_KEY, reason);
  } catch {
    // 사생활 모드 등으로 저장이 막혀도 화면은 정상이어야 한다.
    // 그 경우 자동 입장이 한 번 더 일어날 수 있을 뿐이다.
  }
}

export function isGuestAutoEnterSuppressed(): boolean {
  // 서버 렌더에서는 항상 억제다 — 쿠키를 심는 일은 브라우저에서만 한다.
  if (typeof window === "undefined") return true;
  try {
    return window.sessionStorage.getItem(SUPPRESS_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * 지금 자동 입장을 해도 되는가. **훅에서 조건을 인라인으로 두지 않고 여기로 뺀 이유**는
 * 테스트 환경이 SSR(`renderToString`)이라 `useEffect` 가 돌지 않아, 훅 안에 두면 이 판정을
 * 검증할 방법이 없기 때문이다.
 *
 * 🚫 `sessionStatus` 를 `SessionState` 타입으로 받지 않는다 — `useSession` 을 import 하면
 *    `auth.ts` 를 거쳐 이 파일로 돌아오는 순환이 된다. 의존성 0 을 유지한다.
 */
export function shouldAutoEnterAsGuest(input: {
  sessionStatus: "unknown" | "guest" | "authenticated";
  pathname: string;
}): boolean {
  if (!GUEST_AUTO_ENTER_ACTIVE) return false;
  // ⭐ `guest` 는 서버가 401 로 **확인해 준** 비로그인이다. `unknown` 은 아직 모르는 것이고,
  //    거기서 계정을 만들면 **이미 로그인한 사람이** 네트워크가 잠깐 끊긴 사이에 임시 계정으로
  //    바뀌어 자기 동화를 잃은 것처럼 보인다.
  if (input.sessionStatus !== "guest") return false;
  if (isAutoEnterExcludedPath(input.pathname)) return false;
  if (isGuestAutoEnterSuppressed()) return false;
  return true;
}
