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

/**
 * 색 배정 — 주 동작은 그린, 보조는 블루, 비하인드 B 는 퍼플.
 *
 * ⭐ `--btn-lip` 은 **버튼 아래 그림자(립) 색**이다. variant 마다 자기 짙은 색을 넣고
 * `BASE` 가 그것으로 그림자를 그린다. 색과 립이 갈리면 눌린 느낌이 깨지므로 **같이 정한다.**
 *
 * 🚫 `gold` 에 흰 글자를 쓰지 않는다 — 노랑 위 흰 글자는 읽히지 않는다.
 * 듀오링고도 노란 면에는 진한 글자를 얹는다.
 */
const variantStyles: Record<ActionVariant, string> = {
  primary: "bg-primary text-white [--btn-lip:var(--color-primary-strong)] hover:brightness-105",
  accentA: "bg-accent-a text-white [--btn-lip:var(--color-accent-a-strong)] hover:brightness-105",
  accentB: "bg-accent-b text-white [--btn-lip:var(--color-accent-b-strong)] hover:brightness-105",
  ghost: "border-2 border-line bg-surface-raised text-ink [--btn-lip:#d4d4d4] hover:bg-surface",
  gold: "bg-gold text-ink [--btn-lip:var(--color-gold-strong)] hover:brightness-105",
};

/**
 * 터치 타깃 최소 56px(`--spacing-touch`). 아이 손가락이 대상이라 WCAG 권장(44px)보다 크다.
 *
 * ⭐ 형태가 듀오링고의 정체성이다 — **pill 이 아니라 16px 라운드 사각형 + 아래쪽 립**이고,
 * 누르면 립 두께(4px)만큼 내려앉으며 그림자가 사라진다. `shadow-sm` 으로 바꾸지 말 것.
 */
/**
 * 키보드 포커스 링. **CTA 가 아닌 작은 버튼도 이 문자열을 쓴다.**
 *
 * ⭐ 따로 두는 이유: `actionClass` 는 큰 CTA 의 모양(립·굵은 글씨·56px)까지 함께 주므로
 * 도트 인디케이터나 인라인 재시도처럼 **모양이 달라야 하는 버튼**에는 쓸 수 없다. 그렇다고
 * 링을 손으로 적으면 두 벌이 되어 한쪽만 바뀐다 — 모양은 각자, **포커스 표시는 공유**한다.
 * 🚫 이 값을 복사해 쓰지 않는다. import 한다.
 */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-magic-strong focus-visible:ring-offset-2";

const BASE =
  `inline-flex min-h-touch items-center justify-center rounded-btn font-extrabold shadow-[0_4px_0_var(--btn-lip)] transition-[filter,transform,box-shadow] active:translate-y-1 active:shadow-none motion-reduce:transition-none motion-reduce:active:translate-y-0 ${FOCUS_RING} disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0`;

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
