"use client";

import { useSession } from "@/lib/api/useSession";

/**
 * 화면은 없다. 루트 레이아웃에 한 번 붙어 **로그인 확인을 시작하고 `<html data-session>` 을 동기화**한다.
 *
 * 헤더·CTA 는 더 이상 세션 값을 읽지 않는다(문구 선택은 CSS 가 속성으로 한다 — `globals.css`).
 * 그래서 누군가는 `useSession` 을 마운트해야 확인 요청이 나가는데, 그 역할만 맡는 것이 이것이다.
 * 🚫 헤더 안에서 값을 버리는 `useSession()` 호출로 대신하지 않는다 — 읽는 사람이 왜 부르는지 모른다.
 */
export function SessionSync() {
  useSession();
  return null;
}
