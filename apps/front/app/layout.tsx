import type { Metadata, Viewport } from "next";
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
