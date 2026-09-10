import type { ReactNode } from "react";

/**
 * 상태·분류를 나타내는 작은 알약. 🚫 클릭 대상이 아니다 — 그건 `ActionLink` 다.
 *
 * 톤은 **의미**로 고른다(성공·진행·실패·중립). 🚫 팔레트 클래스(`emerald-*` `rose-*`)를 소비처에서
 * 직접 쓰지 않는다 — 마이페이지가 그렇게 배지를 손으로 다시 그리고 있었고, 다크모드 클래스까지
 * 딸려 왔다(2026-09-09 전수조사). 색은 `globals.css` 토큰만 쓴다.
 */
export type BadgeTone = "primary" | "success" | "warning" | "danger" | "muted";

const toneStyles: Record<BadgeTone, string> = {
  primary: "bg-primary-soft text-primary",
  success: "bg-accent-a-soft text-accent-a-strong",
  warning: "bg-gold/20 text-gold-strong",
  danger: "bg-accent-b-soft text-accent-b-strong",
  muted: "border border-line bg-surface text-ink-muted",
};

export function Badge({ tone = "primary", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`rounded-pill px-3 py-1 text-xs font-bold ${toneStyles[tone]}`}>{children}</span>
  );
}
