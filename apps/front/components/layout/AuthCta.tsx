"use client";

import { usePathname } from "next/navigation";
import { ActionLink } from "@/components/ui/ActionLink";
import { AUTH_LINK } from "./authLinks";

/**
 * 로그인 상태를 따르는 주요 CTA — 헤더와 홈 화면이 **같은 것**을 쓴다.
 *
 * ⭐ **두 문구를 다 렌더하고 CSS 가 하나만 보인다** (`globals.css` 의 `.session-*`, `<html data-session>`).
 * 세션 값으로 분기해 한쪽만 그리면 JS 가 로드될 때까지 칸이 비고, 새로고침마다 깜빡인다
 * (2026-09-09 배포 환경 보고). 속성은 첫 페인트 전에 `layout.tsx` 의 스크립트가 올린다.
 *
 * `'use client'` 인 이유는 `aria-current` 계산(`usePathname`) 하나다. 호출부가 넘기게 두면 헤더만 넘기고
 * 홈은 빠지는 식으로 갈린다 — 실제로 그렇게 두 벌이 될 뻔했다.
 */
export function AuthCta({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  return (
    <>
      <ActionLink
        href={AUTH_LINK.guest.href}
        variant="gold"
        className={`session-guest ${className}`}
        aria-current={pathname === AUTH_LINK.guest.href ? "page" : undefined}
      >
        {AUTH_LINK.guest.cta}
      </ActionLink>
      <ActionLink
        href={AUTH_LINK.authenticated.href}
        variant="gold"
        className={`session-authenticated ${className}`}
        aria-current={pathname === AUTH_LINK.authenticated.href ? "page" : undefined}
      >
        {AUTH_LINK.authenticated.cta}
      </ActionLink>
    </>
  );
}
