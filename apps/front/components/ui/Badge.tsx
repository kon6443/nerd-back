import type { ReactNode } from "react";

/**
 * 상태·분류를 나타내는 작은 알약. 🚫 클릭 대상이 아니다 — 그건 `ActionLink` 다.
 *
 * 톤은 **의미**로 고른다(성공·진행·실패·중립). 🚫 팔레트 클래스(`emerald-*` `rose-*`)를 소비처에서
 * 직접 쓰지 않는다 — 마이페이지가 그렇게 배지를 손으로 다시 그리고 있었고, 다크모드 클래스까지
 * 딸려 왔다(2026-09-09 전수조사). 색은 `globals.css` 토큰만 쓴다.
 */
export type BadgeTone = "info" | "success" | "danger" | "muted";

/**
 * ⭐ **색은 디자이너가 정한 값이다. 여기서 바꾸지 않는다.**
 * 출처는 두 곳이고 서로 일치한다 — 프로토타입 `docs/design/my-story-flow.html` 의 `.badge` 규칙과,
 * 그것을 화면에 적용한 커밋 `7b91280`(듀오링고 톤 전환)이다.
 *
 * | 톤 | 디자이너 정의 |
 * |---|---|
 * | `info` | `.badge` 기본 — 파랑(Macaw). 팔레트 교체 전 기본 배지도 파랑이었다 |
 * | `success` | `.badge.ok` — 초록 |
 * | `danger` | `.badge.bad` — 빨강. 의미색이라 강조색과 역할이 다르다 |
 * | `muted` | `.badge.mute` — 중립 |
 *
 * ⚠️ **대비가 WCAG AA(4.5:1)에 못 미치는 톤이 있다** (`info` 2.8:1 · `success` 2.7:1 · `muted` 4.2:1).
 * 12px 굵은 글씨는 「큰 글자」 예외에 해당하지 않는다. 🚫 그렇다고 여기서 임의로 글자색을 바꾸지
 * 않는다 — 색은 디자이너 결정이다. 프로토타입에는 각 톤에 **2px 테두리**가 있어 색면이 더 또렷한데,
 * 화면에 적용된 쪽에는 그것이 빠져 있다. 대비를 손보게 되면 그 테두리부터 디자이너와 맞춘다.
 */
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
