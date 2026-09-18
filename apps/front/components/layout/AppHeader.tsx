"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isReaderPath } from "@/components/story/readerNav";
import { AUTH_LINK } from "./authLinks";
import { AuthCta } from "./AuthCta";

const COMMON_LINKS = [
  { href: "/", label: "홈" },
  { href: "/library", label: "서재" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/library" && pathname.startsWith("/stories/")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const AUTH_NAV_SLOTS = [
  { status: "guest", className: "session-guest" },
  { status: "authenticated", className: "session-authenticated" },
] as const;

function navLinkClass(active: boolean): string {
  return `flex min-h-touch min-w-touch items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition-colors motion-reduce:transition-none sm:px-6 sm:text-base ${
    active ? "bg-primary-tint text-primary-strong" : "text-ink-muted hover:bg-surface hover:text-ink"
  }`;
}

/** 세션은 SessionSync가 확인한다. 두 인증 슬롯은 첫 페인트부터 CSS로 선택한다. */
export function AppHeader() {
  const pathname = usePathname();
  if (isReaderPath(pathname)) return null;

  return (
    <header data-app-header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur-sm">
      <nav aria-label="주요 메뉴" className="mx-auto flex min-h-[76px] w-full max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-5 py-2 sm:flex-nowrap sm:px-6">
        <Link href="/" className="mr-auto flex min-h-11 min-w-0 items-center gap-2.5 text-lg font-extrabold tracking-tight text-book-cover-strong md:text-xl">
          <span className="grid size-9 shrink-0 -rotate-6 place-items-center rounded-[5px_10px_10px_5px] border-l-4 border-night bg-primary-strong text-paper shadow-[2px_3px_0_var(--color-paper-edge)]" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 5.5c2.7-.7 5.3-.2 8 1.5v12c-2.7-1.7-5.3-2.2-8-1.5zM20 5.5c-2.7-.7-5.3-.2-8 1.5v12c2.7-1.7 5.3-2.2 8-1.5z" />
            </svg>
          </span>
          <span className="truncate">동화나라</span>
        </Link>
        <ul className="order-3 flex w-full items-center gap-1 sm:order-none sm:w-auto">
          {COMMON_LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <li key={link.href}>
                <Link href={link.href} prefetch={link.href === "/library" ? true : undefined} aria-current={active ? "page" : undefined} className={navLinkClass(active)}>
                  {active && <span aria-hidden="true" className="size-1.5 rounded-full bg-primary-strong" />}
                  {link.label}
                </Link>
              </li>
            );
          })}
          <li className="lg:hidden">
            {AUTH_NAV_SLOTS.map(({ status, className }) => {
              const link = AUTH_LINK[status];
              const active = isActive(pathname, link.href);
              return <Link key={status} href={link.href} aria-current={active ? "page" : undefined} className={`${className} ${navLinkClass(active)}`}>{link.label}</Link>;
            })}
          </li>
        </ul>
        <div className="hidden lg:block"><AuthCta size="compact" /></div>
      </nav>
    </header>
  );
}
