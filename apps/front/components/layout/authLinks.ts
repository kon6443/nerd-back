/** 헤더의 CTA와 네비게이션이 같은 인증 목적지·문구를 공유한다. */
export const AUTH_LINK = {
  guest: { href: "/login", label: "로그인", cta: "로그인하기" },
  authenticated: { href: "/me", label: "마이페이지", cta: "마이페이지" },
} as const;

/** 홈에서 동화 제작으로 들어가는 공통 링크. 동화를 고른 뒤 필요한 인증을 진행한다. */
export const HOME_CREATE_CTA = {
  href: "/library?mode=create",
  cta: "내 얼굴로 만들기",
} as const;

export type AuthLink = (typeof AUTH_LINK)[keyof typeof AUTH_LINK];
