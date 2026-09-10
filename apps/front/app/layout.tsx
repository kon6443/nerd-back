import type { Metadata, Viewport } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { SessionSync } from "@/components/layout/SessionSync";
import { StoryBackground } from "@/components/layout/StoryBackground";
import { SESSION_STORAGE_KEY } from "@/lib/api/sessionStorageKey";
import "./globals.css";

/**
 * ⭐ **첫 페인트 전에** 기억해 둔 로그인 상태를 `<html data-session>` 에 올린다.
 *
 * 서버 HTML 은 로그인 상태를 모른다(쿠키를 읽으면 페이지가 사용자별로 달라져 캐시를 잃는다).
 * React 가 알게 되는 것은 JS 로드 뒤라, 그때까지 헤더의 인증 칸이 비어 새로고침마다 깜빡였다.
 * 블로킹 인라인 스크립트는 뒤따르는 마크업이 그려지기 전에 실행되므로 이 구간이 사라진다.
 * 문구 선택은 `globals.css` 의 `.session-*` 규칙이, 확인 뒤 동기화는 `useSession` 이 맡는다.
 *
 * 🚫 `next/script` 로 바꾸지 않는다 — 로더를 거치면 블로킹이 보장되지 않는다.
 */
const SESSION_HINT_SCRIPT = `try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(SESSION_STORAGE_KEY)}));if(s&&(s.status==="guest"||s.status==="authenticated"))document.documentElement.dataset.session=s.status}catch(e){}`;

export const metadata: Metadata = {
  title: "나만의 동화 나라",
  description: "내가 주인공이 되는 동화",
};

/**
 * ⚠️ **태블릿 가로가 기준 뷰포트**다(1024×768). 시안 5장이 전부 가로다.
 * `maximumScale` 을 막지 않는다 — 확대는 접근성 수단이라 잠그면 안 된다.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // `suppressHydrationWarning`: 아래 스크립트가 React 보다 먼저 `data-session` 을 붙인다. 의도된 차이다.
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      {/* 헤더가 sticky 라 본문이 그 아래로 흐른다. 🚫 body 에 padding-top 을 주지 않는다 —
          헤더 높이를 두 곳에서 관리하게 되어 폰트가 바뀌면 어긋난다. */}
      <body className="flex min-h-dvh flex-col">
        {/* 반드시 body 의 첫 자식이다 — 헤더보다 뒤에 두면 헤더가 먼저 그려진다. */}
        <script dangerouslySetInnerHTML={{ __html: SESSION_HINT_SCRIPT }} />
        <SessionSync />
        <StoryBackground />
        <AppHeader />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
