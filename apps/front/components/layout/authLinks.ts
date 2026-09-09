/**
 * 로그인 상태별 인증 링크 — **소스는 여기 한 곳이다.**
 *
 * 헤더의 CTA, 헤더의 네비 항목, 홈 화면의 CTA 세 곳이 같은 값을 쓴다.
 * 🚫 각자 문자열을 적지 않는다 — 실제로 그렇게 갈려서 **로그인한 뒤에도 「로그인하기」가
 * 남는** 문제가 났다(2026-09-09). 래퍼가 아니라 **값**을 공유한다.
 */
export const AUTH_LINK = {
  guest: { href: "/login", label: "로그인", cta: "로그인하기" },
  authenticated: { href: "/me", label: "마이페이지", cta: "마이페이지" },
} as const;

export type AuthLink = (typeof AUTH_LINK)[keyof typeof AUTH_LINK];
