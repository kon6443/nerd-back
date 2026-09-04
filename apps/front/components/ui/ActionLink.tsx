import Link from "next/link";
import type { ComponentProps } from "react";
import { type ActionVariant, actionClass } from "./actionStyles";

/**
 * 화면을 이동하는 CTA. 스타일은 `actionStyles` 가 소유한다.
 *
 * 이벤트 핸들러를 받지 않아 **서버 컴포넌트에서 그대로 쓸 수 있다.**
 * 동작(제출·선택)이 필요하면 `<button>` 쪽 래퍼를 그때 만들고 **같은 `actionClass` 를 쓴다** —
 * 🚫 클래스를 옮겨 적지 않는다.
 */
interface ActionLinkProps extends Omit<ComponentProps<typeof Link>, "className"> {
  variant?: ActionVariant;
  className?: string;
}

export function ActionLink({ variant = "primary", className = "", ...props }: ActionLinkProps) {
  // ⚠️ 스프레드를 **먼저** 둔다. 뒤에 두면 런타임에 흘러든 className 이 스타일을 통째로
  //    덮어쓴다(타입은 막지만 느슨하게 스프레드된 객체는 못 막는다).
  return <Link {...props} className={actionClass(variant, className)} />;
}
