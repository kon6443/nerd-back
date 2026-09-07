"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
    <header className="sticky top-0 z-10 bg-primary text-white shadow-sm">
      {/* 태블릿 가로가 기준이지만 base(모바일)에서도 줄바꿈 없이 들어가도록 gap 을 좁게 잡는다. */}
      <nav
        aria-label="주요 메뉴"
        className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 md:px-8"
      >
        <Link
          href="/"
          className="mr-auto flex min-h-touch items-center text-lg font-bold md:text-xl"
        >
          나만의 동화 나라
        </Link>

        <ul className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  // 현재 위치를 보조기술에도 알린다. 색만으로 표시하면 화면을 못 보는 사용자에게는 없는 정보다.
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-touch items-center rounded-pill px-4 text-base font-bold transition ${
                    active ? "bg-white/25" : "hover:bg-white/15"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
