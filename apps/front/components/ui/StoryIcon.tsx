import type { ReactNode } from "react";

const paths = {
  book: <><path d="M12 6C9 4 5 4 3 5v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-2-1-6-1-9 1Zm0 0v14" /><path d="m6 9 3 1m6 0 3-1" /></>,
  camera: <><path d="m8 5 1-2h6l1 2h4a1 1 0 0 1 1 1v13H3V6a1 1 0 0 1 1-1Z" /><circle cx="12" cy="12" r="4" /></>,
  star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  trash: <><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" /></>,
  warning: <><path d="m12 3 10 18H2Z" /><path d="M12 9v5m0 3v.1" /></>,
  check: <path d="m5 12 4 4L19 6" />,
} satisfies Record<string, ReactNode>;

/** 라벨 옆 장식 아이콘. 접근 가능한 이름은 부모의 실제 문구가 제공한다. */
export function StoryIcon({ name, className = "" }: { name: keyof typeof paths; className?: string }) {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={`size-5 shrink-0 ${className}`}>{paths[name]}</svg>;
}
