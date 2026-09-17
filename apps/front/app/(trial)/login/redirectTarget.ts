/** 로그인 후 돌아갈 기본 목적지. */
export const DEFAULT_REDIRECT = "/library";

/**
 * `?redirect=` 로 받은 목적지를 **우리 사이트 안의 경로일 때만** 돌려준다.
 *
 * 🚫 `startsWith("/")` 만으로는 부족하다 — `//evil.com` 은 **프로토콜 상대 URL** 이라
 *    슬래시로 시작하면서도 외부 사이트로 나간다. `/\evil.com` 처럼 역슬래시를 섞는 변형도
 *    브라우저에 따라 같은 결과가 된다. 로그인 직후 외부로 튕기는 흐름은 그대로 피싱이 된다.
 *
 * 규칙: 슬래시 하나로 시작하고, 두 번째 글자가 `/` 나 `\` 가 아니어야 한다.
 */
export function safeRedirectPath(redirect: string | null | undefined): string {
  if (!redirect) return DEFAULT_REDIRECT;
  if (!redirect.startsWith("/")) return DEFAULT_REDIRECT;
  if (redirect.length > 1 && (redirect[1] === "/" || redirect[1] === "\\")) {
    return DEFAULT_REDIRECT;
  }
  return redirect;
}
