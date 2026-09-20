"use client";

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { isReaderPath } from "@/components/story/readerNav";
import { isLibraryCreateMode } from "@/lib/libraryMode";
import { AUTH_LINK } from "./authLinks";
import { AuthCta } from "./AuthCta";

export const COMMON_LINKS = [
  { href: "/", label: "홈" },
  { href: "/stories/jack-and-beanstalk/capture?demo=true", label: "빠른 체험하기" },
  { href: "/library?mode=create", label: "내 얼굴로 만들기" },
] as const;

export function isActive(
  pathname: string,
  href: string,
  searchParams?: { get(key: string): string | null } | null,
): boolean {
  if (href === "/") return pathname === "/";

  const isCreateMode = isLibraryCreateMode(searchParams?.get("mode"));
  const isDemo = Boolean(searchParams?.get("demo"));

  if (href === "/library?mode=create") {
    if (pathname.startsWith("/stories/")) {
      return !isDemo;
    }
    if (pathname === "/library" || pathname.startsWith("/library/")) {
      return isCreateMode;
    }
    return false;
  }

  if (href === "/stories/jack-and-beanstalk/capture?demo=true") {
    if (pathname.startsWith("/stories/")) {
      return isDemo;
    }
    if (pathname === "/library" || pathname.startsWith("/library/")) {
      return !isCreateMode;
    }
    return false;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

const AUTH_NAV_SLOTS = [
  { status: "guest", className: "session-guest" },
  { status: "authenticated", className: "session-authenticated" },
] as const;

function navLinkClass(active: boolean): string {
  return `flex min-h-touch min-w-touch items-center justify-center gap-1.5 rounded-xl px-1 text-[0.8125rem] font-bold transition-colors motion-reduce:transition-none sm:gap-2 sm:px-6 sm:text-base ${
    active ? "bg-primary-tint text-primary-strong" : "text-ink-muted hover:bg-surface hover:text-ink"
  }`;
}

function CommonNavLinksItems({
  pathname,
  searchParams,
}: {
  pathname: string;
  searchParams?: { get(key: string): string | null } | null;
}) {
  return (
    <>
      {COMMON_LINKS.map((link) => {
        const active = isActive(pathname, link.href, searchParams);
        return (
          <li key={link.href} className="min-w-0">
            <Link
              href={link.href}
              prefetch={link.href.startsWith("/library") || link.href.startsWith("/stories/") ? true : undefined}
              aria-current={active ? "page" : undefined}
              className={navLinkClass(active)}
            >
              {active && <span aria-hidden="true" className="hidden size-1.5 rounded-full bg-primary-strong sm:inline-block" />}
              {link.label}
            </Link>
          </li>
        );
      })}
    </>
  );
}

function CommonNavLinksWithParams({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams();
  return <CommonNavLinksItems pathname={pathname} searchParams={searchParams} />;
}

function CommonNavLinks({ pathname }: { pathname: string }) {
  return (
    <Suspense fallback={<CommonNavLinksItems pathname={pathname} />}>
      <CommonNavLinksWithParams pathname={pathname} />
    </Suspense>
  );
}

/** 세션은 SessionSync가 확인한다. 두 인증 슬롯은 첫 페인트부터 CSS로 선택한다. */
export function AppHeader() {
  const pathname = usePathname();
  if (isReaderPath(pathname)) return null;

  return (
    <header data-app-header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur-sm">
      <nav aria-label="주요 메뉴" className="flex min-h-[76px] w-full flex-wrap items-center gap-x-3 gap-y-2 px-[var(--layout-gutter)] py-2 sm:flex-nowrap">
        <Link href="/" className="mr-auto flex min-h-11 min-w-0 items-center gap-2.5">
          <Image
            src="/babybooks-logo.png"
            alt=""
            width={1385}
            height={1136}
            sizes="52px"
            loading="eager"
            className="h-auto w-[52px] shrink-0 mix-blend-multiply"
          />
          <Image
            src="/babybooks-wordmark.png"
            alt="베이비북스"
            width={1484}
            height={578}
            sizes="(min-width: 768px) 128px, 112px"
            loading="eager"
            className="h-auto w-28 shrink-0 mix-blend-multiply md:w-32"
          />
        </Link>
        <ul className="order-3 grid w-full grid-cols-4 items-center gap-1 sm:order-none sm:flex sm:w-auto">
          <CommonNavLinks pathname={pathname} />
          {/* 로그인 전에는 넓은 화면에서 「로그인하기」 버튼(AuthCta)을 따로 두고, 로그인 후 「마이페이지」는
              강조 없이 다른 메뉴와 같은 모양으로 둔다. */}
          <li className="min-w-0">
            {AUTH_NAV_SLOTS.map(({ status, className }) => {
              const link = AUTH_LINK[status];
              const active = isActive(pathname, link.href);
              const hideWide = status === "guest" ? "lg:hidden" : "";
              return <Link key={status} href={link.href} aria-current={active ? "page" : undefined} className={`${className} ${hideWide} ${navLinkClass(active)}`}>{link.label}</Link>;
            })}
          </li>
        </ul>
        <div className="hidden lg:block"><AuthCta size="compact" /></div>
      </nav>
    </header>
  );
}
