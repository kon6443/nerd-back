"use client";

import { usePathname } from "next/navigation";
import { ActionLink } from "@/components/ui/ActionLink";
import type { ActionSize } from "@/components/ui/actionStyles";
import { AUTH_LINK } from "./authLinks";

/**
 * 헤더의 인증 CTA. 두 링크를 렌더하고 첫 페인트 전에 설정된 data-session으로
 * 하나만 표시해 hydration 때의 빈칸과 깜빡임을 막는다. usePathname은 현재 위치만 표시한다.
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
    <>
      <ActionLink
        href={AUTH_LINK.guest.href}
        variant="secondary"
        size={size}
        className={`session-guest ${className}`}
        aria-current={pathname === AUTH_LINK.guest.href ? "page" : undefined}
      >
        {AUTH_LINK.guest.cta}
      </ActionLink>
      <ActionLink
        href={AUTH_LINK.authenticated.href}
        variant="secondary"
        size={size}
        className={`session-authenticated ${className}`}
        aria-current={pathname === AUTH_LINK.authenticated.href ? "page" : undefined}
      >
        {AUTH_LINK.authenticated.cta}
      </ActionLink>
    </>
  );
}
