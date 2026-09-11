import type { ReactNode } from "react";

/**
 * 결과 화면 맨 위의 **큰 이모지 원형**. 성공·안내·오류 화면이 같은 모양을 공유한다.
 *
 * ⭐ 세 화면이 각자 `rounded-full bg-*-100 p-4 text-3xl` 을 적고 있었다. 크기나 여백을
 * 조정할 때 세 곳을 찾아다녀야 했고, 실제로 한 곳만 바뀌기 쉬운 형태였다.
 *
 * 🚫 이모지를 보조기술에 읽히지 않는다 — 바로 아래 제목과 설명이 같은 내용을 글로 전한다.
 * 이모지 이름("경고 표시")까지 읽히면 같은 말을 두 번 듣게 된다.
 *
 * ⚠️ 색은 **기존 화면 그대로** 옮겨 온 것이다. 경고·성공 계열 디자인 토큰이 아직 없어
 * Tailwind 팔레트를 쓴다 — 토큰이 생기면 **이 파일만** 고치면 세 화면에 함께 반영된다.
 */
export type StatusEmblemTone = "notice" | "success" | "danger";

const toneStyles: Record<StatusEmblemTone, string> = {
  notice: "bg-amber-100",
  success: "bg-emerald-100",
  danger: "bg-red-100",
};

export function StatusEmblem({
  tone,
  children,
}: {
  tone: StatusEmblemTone;
  children: ReactNode;
}) {
  return (
    <div aria-hidden="true" className={`rounded-full p-4 text-3xl ${toneStyles[tone]}`}>
      {children}
    </div>
  );
}
