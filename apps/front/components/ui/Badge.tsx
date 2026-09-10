import type { ReactNode } from "react";

/**
 * 상태·분류를 나타내는 작은 알약. 🚫 클릭 대상이 아니다 — 그건 `ActionLink` 다.
 *
 * 톤은 **의미**로 고른다(성공·진행·실패·중립). 🚫 팔레트 클래스(`emerald-*` `rose-*`)를 소비처에서
 * 직접 쓰지 않는다 — 마이페이지가 그렇게 배지를 손으로 다시 그리고 있었고, 다크모드 클래스까지
 * 딸려 왔다(2026-09-09 전수조사). 색은 `globals.css` 토큰만 쓴다.
 */
export type BadgeTone = "primary" | "success" | "progress" | "danger" | "muted";

/**
 * 값은 듀오링고 톤 전환(2026-09-09) 때 마이페이지가 인라인으로 고른 것과 같다 — 그 화면을
 * 이 컴포넌트로 바꾸면서 색 선택만 여기로 옮겼다. 화면은 이제 톤 이름만 고른다.
 *
 * ⚠️ `accent-*` 는 강조색이고 `danger` 는 의미색이다. 실패를 강조색으로 칠하지 않는다 —
 * 팔레트가 바뀌면 강조색은 따라 바뀌지만 "실패는 빨강" 은 바뀌면 안 된다.
 */
const toneStyles: Record<BadgeTone, string> = {
  primary: "bg-primary-soft text-primary",
  success: "bg-primary-tint text-primary-strong",
  progress: "bg-accent-a-soft text-accent-a-strong",
  danger: "bg-danger-soft text-danger-strong",
  muted: "bg-surface text-ink-muted",
};

export function Badge({ tone = "primary", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={`rounded-pill px-3 py-1 text-xs font-bold ${toneStyles[tone]}`}>{children}</span>
  );
}
