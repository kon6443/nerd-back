"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { enterAsGuest } from "./auth";
import { shouldAutoEnterAsGuest, suppressGuestAutoEnter } from "./guestAutoEnter";
import type { SessionState } from "./useSession";

/**
 * 비로그인으로 들어온 방문자를 **아무것도 누르지 않아도** 게스트로 입장시킨다.
 *
 * 루트 레이아웃의 `SessionSync` 한 곳에서만 부른다 — 화면마다 붙이면 같은 방문자에게
 * 계정이 여러 개 생긴다.
 *
 * 네 가지 조건을 **모두** 만족할 때만 계정을 만든다. 🚫 하나라도 빼지 말 것:
 *
 * 1. 플래그 두 개가 모두 켜져 있다 (`GUEST_ACCESS_ENABLED` · `GUEST_AUTO_ENTER`)
 * 2. 세션이 **`guest`** 다 — 서버가 401 로 **확인해 준** 비로그인이다.
 *    ⭐ `unknown`(확인 전·네트워크 오류)에는 절대 만들지 않는다. 만들면 **이미 로그인한 사람이
 *    잠깐 끊긴 사이에 임시 계정으로 바뀌어** 자기 동화를 잃은 것처럼 보인다.
 * 3. 로그인·마이페이지 화면이 아니다 (`isAutoEnterExcludedPath`)
 * 4. 이 탭에서 억제되지 않았다 (로그아웃 직후거나 이미 시도함)
 */
export function useGuestAutoEnter(session: SessionState): void {
  const pathname = usePathname();

  useEffect(() => {
    // 판정은 `shouldAutoEnterAsGuest` 가 소유한다 — 네 조건이 테스트로 고정되어 있다.
    if (!shouldAutoEnterAsGuest({ sessionStatus: session.status, pathname })) return;

    // 🚫 **성공한 뒤에 찍지 않는다.** 실패(429·네트워크)가 리렌더마다 재시도를 불러
    //    레이트리밋을 스스로 소진한다. 시도했다는 사실을 먼저 남기고 들어간다.
    suppressGuestAutoEnter("attempted");

    void enterAsGuest().catch(() => {
      // 조용히 포기한다 — 「닉네임 없이 바로 체험하기」 버튼이 폴백이고,
      // 화면은 비로그인 상태 그대로 정상 동작한다.
    });
  }, [session.status, pathname]);
}
