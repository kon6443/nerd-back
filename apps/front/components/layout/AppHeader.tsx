"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/api/useSession";
import { AUTH_LINK } from "./authLinks";
import { AuthCta } from "./AuthCta";

/**
 * 전역 상단 네비게이션.
 *
 * `'use client'` 인 이유는 두 가지다 — 현재 위치 표시(`usePathname`)와 **로그인 상태**(`useSession`).
 *
 * ⚠️ 후자는 요청을 하나 만든다(`GET /auth/me`). 전 화면에 걸리므로 늘리지 않는다 —
 * 🚫 여기에 다른 데이터 조회를 추가하지 않는다. 렌더를 막지는 않는다: 확인 전에는 인증 칸만
 * 비우고 나머지는 그대로 그린다.
 *
 * ⭐ **실제로 존재하는 라우트만 넣는다.** 시안의 `설정` 탭은 그 화면이 없어 넣지 않았다 —
 * 링크를 먼저 만들면 눌렀을 때 404 다.
 */
const COMMON_LINKS = [
  { href: "/", label: "홈" },
  { href: "/library", label: "서재" },
] as const;


/**
 * `/library` 는 하위 경로(`/library/[slug]/...`)에서도 활성으로 본다.
 * 반면 `/` 는 정확히 일치할 때만 — 안 그러면 모든 경로에서 홈이 활성이 된다.
 */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppHeader() {
  const pathname = usePathname();
  const session = useSession();

  // 확인 전에는 인증 칸을 그리지 않는다. 곧바로 「로그인」을 그리면 이미 로그인한 사용자에게
  // 로그아웃된 화면이 깜빡 보인다.
  const authLink = session.status === "unknown" ? null : AUTH_LINK[session.status];
  const links = authLink ? [...COMMON_LINKS, authLink] : COMMON_LINKS;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface-raised/90 shadow-sm backdrop-blur-sm">
      <nav
        aria-label="주요 메뉴"
        className="mx-auto flex min-h-[76px] w-full max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 sm:flex-nowrap sm:px-6"
      >
        <Link
          href="/"
          className="mr-auto flex min-h-touch min-w-0 items-center gap-2 text-lg font-extrabold tracking-tight text-ink md:text-xl"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-primary-strong text-white" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9">
              <path d="M4 5.5c2.7-.7 5.3-.2 8 1.5v12c-2.7-1.7-5.3-2.2-8-1.5z" />
              <path d="M20 5.5c-2.7-.7-5.3-.2-8 1.5v12c2.7-1.7 5.3-2.2 8-1.5z" />
            </svg>
          </span>
          <span className="truncate">동화나라</span>
        </Link>

        <ul className="order-3 flex w-full items-center gap-1 sm:order-none sm:w-auto">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              // ⚠️ 넓은 화면에서는 오른쪽 CTA 가 같은 역할을 하므로 인증 칸만 숨긴다.
              //    🚫 `href === "/login"` 으로 판정하지 않는다 — 로그인하면 href 가 `/me` 로
              //    바뀌어 조건이 빗나가고 **네비와 CTA 가 둘 다 보인다.**
              <li key={link.href} className={link.href === authLink?.href ? "lg:hidden" : undefined}>
                <Link
                  href={link.href}
                  // 현재 위치를 보조기술에도 알린다. 색만으로 표시하면 화면을 못 보는 사용자에게는 없는 정보다.
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-touch min-w-touch items-center justify-center rounded-pill px-3 text-sm font-bold transition-colors motion-reduce:transition-none sm:px-4 sm:text-base ${
                    active
                      ? "bg-primary-strong text-white"
                      : "text-ink-muted hover:bg-primary-tint hover:text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <span className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-accent-a bg-accent-a-soft px-3 text-sm font-semibold text-ink">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4z" />
            <path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6z" />
          </svg>
          시연 모드
        </span>
        {/* ⭐ 이 CTA 가 넓은 화면에서 **유일하게 보이는 인증 UI** 다. 하드코딩해 두면 로그인한
            뒤에도 「로그인하기」가 남아 "로그인이 안 됐나?" 로 읽힌다 — 실제로 그렇게 보고됐다.
            확인 전(`unknown`)에는 그리지 않아 상태가 깜빡이지 않게 한다. */}
        {/* 🚫 여기서 CTA 를 다시 그리지 않는다 — `AuthCta` 가 상태·문구·aria-current 를 모두
            소유한다. 두 곳에서 그리면 한쪽만 고쳐져 갈린다. */}
        <div className="hidden lg:block">
          <AuthCta />
        </div>
      </nav>
    </header>
  );
}
