import type { ReactNode } from "react";

/**
 * 상태·분류를 나타내는 작은 알약. 🚫 클릭 대상이 아니다 — 그건 `ActionLink` 다.
 *
 * 톤은 **의미**로 고른다(성공·진행·실패·중립). 🚫 팔레트 클래스(`emerald-*` `rose-*`)를 소비처에서
 * 직접 쓰지 않는다 — 마이페이지가 그렇게 배지를 손으로 다시 그리고 있었고, 다크모드 클래스까지
 * 딸려 왔다(2026-09-09 전수조사). 색은 `globals.css` 토큰만 쓴다.
 */
export type BadgeTone = "info" | "success" | "danger" | "muted";

/** 상태의 의미는 색과 문구로 함께 전달한다. 색은 전역 의미 토큰을 따른다. */
const toneStyles: Record<BadgeTone, string> = {
  info: "bg-accent-a-soft text-accent-a-strong",
  success: "bg-primary-tint text-primary-strong",
  danger: "bg-danger-soft text-danger-strong",
  muted: "bg-surface text-ink-muted",
};

export function Badge({ tone = "info", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    // 여백도 디자이너가 화면에 적용한 값(`7b91280`)을 따른다. 색만 맞추고 크기가 갈리면
    // 같은 배지가 화면마다 다른 크기가 된다.
    <span className={`rounded-pill px-2.5 py-0.5 text-xs font-bold ${toneStyles[tone]}`}>{children}</span>
  );
}
