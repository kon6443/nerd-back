import type { ReactNode } from "react";

/** 상태·분류를 나타내는 작은 알약. 🚫 클릭 대상이 아니다 — 그건 `ActionLink` 다. */
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-pill bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
      {children}
    </span>
  );
}
