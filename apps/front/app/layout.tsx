import type { Metadata, Viewport } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { StoryBackground } from "@/components/layout/StoryBackground";
import "./globals.css";

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
    <html lang="ko" className="h-full antialiased">
      {/* 헤더가 sticky 라 본문이 그 아래로 흐른다. 🚫 body 에 padding-top 을 주지 않는다 —
          헤더 높이를 두 곳에서 관리하게 되어 폰트가 바뀌면 어긋난다. */}
      <body className="flex min-h-dvh flex-col">
        <StoryBackground />
        <AppHeader />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">{children}</div>
      </body>
    </html>
  );
}
