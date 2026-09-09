import type { ReactNode } from "react";

/**
 * 가운데 정렬 단일 컬럼 화면 — 로딩·오류·짧은 안내가 쓴다.
 *
 * ⚠️ `PageMessage` 와 역할이 다르다: 그쪽은 **제목·설명·복귀 버튼이 있는 카드**고,
 * 이건 **틀만** 준다. 문구 구조가 정해진 화면은 `PageMessage` 를 쓴다.
 */
export function CenteredPage({ children, ...rest }: { children: ReactNode } & { "aria-busy"?: boolean }) {
  return (
    <main
      {...rest}
      className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center p-6 text-center"
    >
      {children}
    </main>
  );
}
