"use client";

import { usePathname } from "next/navigation";
import { ActionLink } from "@/components/ui/ActionLink";
import type { ActionSize } from "@/components/ui/actionStyles";
import { AUTH_LINK } from "./authLinks";

/**
 * 헤더의 로그인 CTA. 로그인 전에만 보인다 — 첫 페인트 전에 설정된 data-session 으로 CSS 가 표시를 고른다.
 * 로그인 후의 「마이페이지」는 강조하지 않고 일반 메뉴 링크로 둔다(AppHeader). usePathname은 현재 위치만 표시한다.
 */
export function AuthCta({
  className = "",
  size = "default",
}: {
  className?: string;
  size?: ActionSize;
}) {
  const pathname = usePathname();
  return (
    <ActionLink
      href={AUTH_LINK.guest.href}
      variant="secondary"
      size={size}
      className={`session-guest ${className}`}
      aria-current={pathname === AUTH_LINK.guest.href ? "page" : undefined}
    >
      {AUTH_LINK.guest.cta}
    </ActionLink>
  );
}
