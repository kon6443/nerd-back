"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ActionLink } from "@/components/ui/ActionLink";

/**
 * 전역 상단 네비게이션.
 *
 * `'use client'` 인 이유는 **현재 위치 표시 하나뿐이다**(`usePathname`). 데이터를 부르지 않으므로
 * 클라이언트 번들에 얹히는 비용이 작다. 🚫 여기에 데이터 조회를 넣지 않는다 — 넣는 순간
 * 모든 화면이 그 요청을 기다린다.
 *
 * ⭐ **실제로 존재하는 라우트만 넣는다.** 시안에는 `설정`·`내 프로필` 탭이 있지만 그 화면이 아직
 * 없다 — 링크를 먼저 만들면 눌렀을 때 404 다. 화면이 생기는 슬라이스에서 함께 추가한다.
 */
const LINKS = [
  { href: "/", label: "홈" },
  { href: "/library", label: "서재" },
  { href: "/login", label: "로그인" },
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
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <li key={link.href} className={link.href === "/login" ? "lg:hidden" : undefined}>
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
        <div className="hidden lg:block">
          <ActionLink
            href="/login"
            variant="gold"
            aria-current={pathname === "/login" ? "page" : undefined}
          >
            로그인하기
          </ActionLink>
        </div>
      </nav>
    </header>
  );
}
