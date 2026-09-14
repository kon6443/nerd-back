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
/**
 * ⭐ **버튼 위계는 네 가지뿐이다**(2026-09-14 결정). 색 이름이 아니라 **위계 이름**으로 부른다 —
 * 화면이 "무슨 색"이 아니라 "얼마나 중요한가"를 고르게 하려는 것이다.
 *
 * | 위계 | 모양 | 쓰는 곳 |
 * |---|---|---|
 * | `primary` | 파랑 | 한 화면(한 묶음)의 **가장 중요한 동작 하나** |
 * | `secondary` | 흰색 | 그다음 동작 |
 * | `dark` | 초록빛이 섞인 검정 | secondary 인데 **흰 면·사진 위에서 묻힐 때** |
 * | `tertiary` | 텍스트 | 되돌아가기·건너뛰기처럼 눈에 덜 띄어야 하는 동작 |
 *
 * 🚫 **초록·노랑·보라 CTA 를 만들지 않는다.** 초록은 GNB(현재 위치 표시)만 쓴다 — CTA 에도 쓰면 "지금 여기"와
 * "누르세요"가 같은 색이 된다. 노랑은 서비스 전체에서 버튼으로 쓰지 않는다.
 * 🚫 나란히 놓인 두 버튼을 둘 다 `primary` 로 두지 않는다. 둘 중 무엇이 중요한지 정하고 하나를 내린다.
 */
export type ActionVariant = "primary" | "secondary" | "dark" | "tertiary";
export type ActionSize = "default" | "compact";

/**
 * ⭐ `--btn-lip` 은 **버튼 아래 그림자(립) 색**이다. variant 마다 자기 짙은 색을 넣고
 * `LIFT` 가 그것으로 그림자를 그린다. 색과 립이 갈리면 눌린 느낌이 깨지므로 **같이 정한다.**
 */
const variantStyles: Record<ActionVariant, string> = {
  primary: "bg-accent-a text-white [--btn-lip:var(--color-accent-a-strong)] hover:brightness-105",
  secondary: "border-2 border-line bg-surface-raised text-ink [--btn-lip:#d4d4d4] hover:bg-surface",
  dark: "bg-night text-white [--btn-lip:var(--color-night-strong)] hover:brightness-125",
  tertiary: "text-ink-muted underline-offset-4 hover:text-ink hover:underline",
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
  `inline-flex min-h-touch items-center justify-center rounded-btn font-extrabold transition-[filter,transform,box-shadow] motion-reduce:transition-none ${FOCUS_RING} disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50`;

/**
 * 누르면 립만큼 내려앉는 입체감. **텍스트 버튼(`tertiary`)에는 주지 않는다** — 면이 없는데 그림자가 생긴다.
 * 🚫 BASE 에 되돌려 넣고 tertiary 에서 덮어쓰지 않는다. Tailwind 는 클래스 순서가 아니라 생성 순서로
 * 이겨서, 같은 속성을 두 번 주면 어느 쪽이 적용될지 보장되지 않는다.
 */
const LIFT =
  "shadow-[0_4px_0_var(--btn-lip)] active:translate-y-1 active:shadow-none motion-reduce:active:translate-y-0 disabled:active:translate-y-0";

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
  const lift = variant === "tertiary" ? "" : LIFT;
  return `${BASE} ${lift} ${sizeStyles[size]} ${variantStyles[variant]} ${extra}`.trim();
}
