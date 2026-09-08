/**
 * 주요 동작(CTA)의 **스타일 소스는 여기 한 곳이다.**
 *
 * 버튼이냐 링크냐는 상황마다 갈리는데(홈의 `동화 보러 가기` 는 네비게이션, 비하인드의
 * `선택하기` 는 동작), 그때마다 클래스를 손으로 옮겨 적으면 **두 벌이 되고 팔레트를 바꿀 때
 * 한쪽만 바뀐다.** 실제로 그렇게 될 뻔했다 — 래퍼가 아니라 **문자열**을 공유한다.
 *
 * 🚫 `cva`·`tailwind-merge`·`clsx` 를 도입하지 않는다. 객체 맵으로 같은 일이 되고,
 * 새 의존성은 승인 대상이다.
 * 🚫 색 리터럴을 쓰지 않는다 — 토큰만 쓴다 (`app/globals.css`).
 */
export type ActionVariant = "primary" | "accentA" | "accentB" | "ghost" | "gold";
export type ActionSize = "default" | "compact";

/** 시안의 색 배정 — 기본은 하늘색, 비하인드 A 는 민트, B 는 코랄. */
const variantStyles: Record<ActionVariant, string> = {
  primary: "bg-primary-strong text-white hover:brightness-90",
  accentA: "bg-accent-a-strong text-white hover:brightness-90",
  accentB: "bg-accent-b-strong text-white hover:brightness-90",
  ghost: "border-2 border-primary bg-surface-raised text-ink hover:bg-primary-tint",
  gold: "bg-gold-strong text-white hover:brightness-90",
};

/** 터치 타깃 최소 56px(`--spacing-touch`). 아이 손가락이 대상이라 WCAG 권장(44px)보다 크다. */
const BASE =
  "inline-flex min-h-touch items-center justify-center rounded-pill font-bold shadow-sm transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-magic-strong focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

const sizeStyles: Record<ActionSize, string> = {
  default: "px-8 text-lg",
  compact: "px-6 text-base",
};

/** `extra` 는 폭·정렬 같은 레이아웃만 추가한다. 크기는 `size` 로 정한다. */
export function actionClass(
  variant: ActionVariant = "primary",
  extra = "",
  size: ActionSize = "default",
): string {
  return `${BASE} ${sizeStyles[size]} ${variantStyles[variant]} ${extra}`.trim();
}
