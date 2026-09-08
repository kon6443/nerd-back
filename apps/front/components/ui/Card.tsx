import type { ReactNode } from "react";

/**
 * 카드 컨테이너. **도메인을 모른다** — 동화·세션 타입을 알아야 하면 `components/story/` 로 간다.
 *
 * 서버 컴포넌트로 쓸 수 있게 이벤트 핸들러를 받지 않는다. 상호작용이 필요하면 `action` 슬롯에
 * 클라이언트 컴포넌트를 넣는다.
 */
type Tone = "neutral" | "accentA" | "accentB";

const toneStyles: Record<Tone, string> = {
  neutral: "border-line bg-surface-raised",
  accentA: "border-accent-a bg-accent-a-soft",
  accentB: "border-accent-b bg-accent-b-soft",
};

export interface CardProps {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}

export function Card({ tone = "neutral", className = "", children }: CardProps) {
  return (
    <div
      className={`rounded-card border-2 p-5 shadow-sm ${toneStyles[tone]} ${className}`}
    >
      {children}
    </div>
  );
}
