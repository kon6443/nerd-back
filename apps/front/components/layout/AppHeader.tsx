"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AUTH_LINK } from "./authLinks";
import { AuthCta } from "./AuthCta";

/**
 * 전역 상단 네비게이션.
 *
 * `'use client'` 인 이유는 현재 위치 표시(`usePathname`) 하나다.
 *
 * ⭐ **로그인 상태를 여기서 읽지 않는다.** 인증 칸은 두 문구를 다 렌더하고 CSS 가 `<html data-session>`
 * 으로 하나만 보인다(`globals.css`). 상태로 분기해 한쪽만 그리면 JS 로드 전까지 칸이 비어
 * 새로고침마다 깜빡인다(2026-09-09). 확인 요청은 `SessionSync` 가 한 번 낸다 —
 * 🚫 여기에 데이터 조회를 추가하지 않는다. 전 화면에 걸린다.
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

/**
 * 인증 칸의 두 자리. 클래스 이름을 **리터럴로 적는다** — `` `session-${status}` `` 처럼 조립하면
 * `session-guest` 로 전수 검색해도 이 파일이 안 잡혀, 스타일시트의 클래스를 바꿀 때 헤더만
 * 조용히 깨진다(2026-09-10 리뷰에서 실제로 이 파일이 검색에서 빠졌다).
 */
const AUTH_NAV_SLOTS = [
  { status: "guest", className: "session-guest" },
  { status: "authenticated", className: "session-authenticated" },
] as const;

/** 네비 항목 한 칸의 스타일. 실제 링크와 확인 전 자리표시가 **같은 폭**이어야 해서 한 곳에 둔다. */
function navLinkClass(active: boolean): string {
  return `flex min-h-touch min-w-touch items-center justify-center rounded-pill px-3 text-sm font-bold transition-colors motion-reduce:transition-none sm:px-4 sm:text-base ${
    active ? "bg-primary-strong text-white" : "text-ink-muted hover:bg-primary-tint hover:text-ink"
  }`;
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
          {COMMON_LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  // 현재 위치를 보조기술에도 알린다. 색만으로 표시하면 화면을 못 보는 사용자에게는 없는 정보다.
                  aria-current={active ? "page" : undefined}
                  className={navLinkClass(active)}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
          {/* ⚠️ 넓은 화면에서는 오른쪽 CTA 가 같은 역할을 하므로 인증 칸만 숨긴다.
              칸은 항상 있다 — 응답 뒤에 `<li>` 를 추가하면 네비 폭이 바뀌어 오른쪽 CTA 까지 밀린다. */}
          <li className="lg:hidden">
            {AUTH_NAV_SLOTS.map(({ status, className }) => {
              const link = AUTH_LINK[status];
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={status}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`${className} ${navLinkClass(active)}`}
                >
                  {link.label}
                </Link>
              );
            })}
          </li>
        </ul>

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
