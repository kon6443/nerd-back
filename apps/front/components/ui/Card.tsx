import type { ReactNode } from "react";

/**
 * 카드 컨테이너. **도메인을 모른다** — 동화·세션 타입을 알아야 하면 `components/story/` 로 간다.
 *
 * 서버 컴포넌트로 쓸 수 있게 이벤트 핸들러를 받지 않는다. 상호작용이 필요하면 `action` 슬롯에
 * 클라이언트 컴포넌트를 넣는다.
 */
type Tone = "neutral" | "accentA" | "accentB";

/**
 * 카드의 R·padding 조합. **안에 둥근 요소(버튼·썸네일)가 모서리 가까이 붙는 카드는 `snug`** 를 쓴다.
 *
 * 안쪽 모서리는 바깥 R에서 padding을 뺀다. `snug`는 R 24 · padding 16으로 안쪽 8px를 만든다.
 * 🚫 padding 을 `className` 으로 덧대지 않는다 — 규칙이 깨진다. 모양은 `inset` 으로 고른다.
 */
type Inset = "default" | "snug";

const insetStyles: Record<Inset, string> = {
  default: "[--card-radius:var(--radius-card)] [--card-padding:1.25rem]",
  snug: "[--card-radius:1.5rem] [--card-padding:1rem]",
};

/**
 * 카드 **안쪽** 둥근 요소(썸네일 등)의 R.
 * 카드의 실제 토큰과 padding을 따라 함께 줄어든다.
 */
export const CARD_NESTED_RADIUS = "rounded-[calc(var(--card-radius)-var(--card-padding))]";

/**
 * 카드 안 **버튼**의 R 을 내려준다. 버튼을 감싼 요소(또는 카드 자신)에 붙이면 자손 버튼이 물려받는다
 * (`actionStyles.ts` 의 `--btn-radius`). 버튼에 직접 `rounded-*` 를 덧대지 않기 위한 통로다.
 */
export const CARD_NESTED_BUTTON_RADIUS = "[--btn-radius:calc(var(--card-radius)-var(--card-padding))]";

const toneStyles: Record<Tone, string> = {
  neutral: "border-line bg-surface-raised",
  accentA: "border-accent-a bg-accent-a-soft",
  accentB: "border-accent-b bg-accent-b-soft",
};

export interface CardProps {
  tone?: Tone;
  inset?: Inset;
  className?: string;
  children: ReactNode;
}

export function Card({ tone = "neutral", inset = "default", className = "", children }: CardProps) {
  return (
    <div
      className={`rounded-(--card-radius) border p-(--card-padding) shadow-sm ${insetStyles[inset]} ${toneStyles[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
