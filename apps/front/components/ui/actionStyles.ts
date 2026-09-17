/** 모든 경로의 버튼·링크는 같은 의미색, 터치 크기, 포커스와 눌림을 공유한다. */
export type ActionVariant = "primary" | "secondary" | "dark" | "tertiary";
export type ActionSize = "default" | "compact";

export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary focus-visible:ring-offset-2";

const BASE = `story-action inline-flex min-h-touch items-center justify-center rounded-[var(--btn-radius,var(--radius-btn))] font-bold transition-[filter,transform,box-shadow,background-color] duration-200 motion-reduce:transition-none ${FOCUS_RING} disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50`;
const sizeStyles: Record<ActionSize, string> = {
  default: "px-7 py-3 text-base sm:text-lg",
  compact: "px-5 py-2.5 text-sm sm:text-base",
};

/** extra는 배치, size는 크기, variant는 행동 위계를 정한다. */
export function actionClass(
  variant: ActionVariant = "primary",
  extra = "",
  size: ActionSize = "default",
): string {
  return `${BASE} action-${variant} ${sizeStyles[size]} ${extra}`.trim();
}
