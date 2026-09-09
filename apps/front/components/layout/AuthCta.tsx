"use client";

import { usePathname } from "next/navigation";
import { ActionLink } from "@/components/ui/ActionLink";
import { useSession } from "@/lib/api/useSession";
import { AUTH_LINK } from "./authLinks";

/**
 * 로그인 상태를 따르는 주요 CTA — 헤더와 홈 화면이 **같은 것**을 쓴다.
 *
 * ⭐ **서버 컴포넌트 화면에서도 쓸 수 있도록 이것만 클라이언트다.** 홈 전체를 `'use client'` 로
 * 바꾸면 버튼 하나 때문에 히어로까지 클라이언트 번들에 실린다.
 *
 * `aria-current` 를 **스스로 계산한다.** 호출부가 넘기게 두면 헤더만 넘기고 홈은 빠지는 식으로
 * 갈린다 — 실제로 그렇게 두 벌이 될 뻔했다.
 *
 * 확인 전(`unknown`)에는 아무것도 그리지 않는다. 곧바로 「로그인하기」를 그리면 이미 로그인한
 * 사용자에게 그 문구가 깜빡 보이고, 그게 "로그인이 안 됐나?" 로 읽힌다.
 */
export function AuthCta({ className }: { className?: string }) {
  const pathname = usePathname();
  const session = useSession();
  if (session.status === "unknown") return null;

  const link = AUTH_LINK[session.status];
  return (
    <ActionLink
      href={link.href}
      variant="gold"
      className={className}
      aria-current={pathname === link.href ? "page" : undefined}
    >
      {link.cta}
    </ActionLink>
  );
}
