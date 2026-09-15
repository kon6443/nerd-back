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

/**
 * 홈 히어로의 **로그인 후** CTA. 로그인한 사람에게 홈에서 권할 다음 행동은 마이페이지가 아니라
 * 동화 만들기다(2026-09-14 요청). 마이페이지는 헤더에 이미 있다.
 * 만들기는 동화를 골라야 시작되므로 서재로 보낸다 — 동화 소개에서 「내 얼굴로 만들기」로 이어진다.
 */
export const HOME_AUTHENTICATED_CTA = {
  href: "/library?mode=create",
  cta: "내 얼굴로 만들기",
} as const;

export type AuthLink = (typeof AUTH_LINK)[keyof typeof AUTH_LINK];
