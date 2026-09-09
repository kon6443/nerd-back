"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { LoadingView } from "@/components/ui/LoadingView";
import { actionClass } from "@/components/ui/actionStyles";
import { logout } from "@/lib/api/auth";
import { useSession } from "@/lib/api/useSession";

/**
 * 마이페이지 — **아이디 하나만 보여준다.**
 *
 * 이 서비스가 계정에 담는 개인 정보가 아이디뿐이다. 🚫 보여줄 것이 없는 항목(프로필 사진·
 * 닉네임·설정)을 자리만 만들어 두지 않는다 — 빈 화면은 "곧 생긴다" 는 잘못된 신호를 준다.
 *
 * ⚠️ **여기의 로그인 확인은 보안이 아니라 화면 전환용이다.** 실제 보호는 백엔드가 401 을
 * 주는 것이다. 🚫 이 페이지가 막아 준다고 믿고 민감한 데이터를 내려보내지 않는다.
 */
export default function MyPage() {
  const router = useRouter();
  const session = useSession();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    // ⭐ **로그아웃 중에는 가드가 끼어들지 않는다.** 로그아웃도 "guest 로 바뀌는" 사건이라,
    //    막지 않으면 홈으로 보내려는 이동을 이 가드가 가로채 `/login?redirect=/me` 로 튄다
    //    — 브라우저 실측으로 확인했다(2026-09-09).
    if (loggingOut) return;

    // ⚠️ `?redirect=` 를 붙인다. 같은 `(trial)` 그룹의 다른 화면(촬영·리더)이 이미 그 규약을
    //    쓰고 있어, 여기만 빠지면 로그인 후 엉뚱한 곳(`/library`)으로 떨어진다.
    if (session.status === "guest") router.replace("/login?redirect=/me");
  }, [session.status, router, loggingOut]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      // 🚫 실패해도 넘긴다. 서버가 쿠키를 못 지웠어도 사용자가 이 화면에 갇히면 안 된다.
      //
      // 네비 갱신은 `logout()` 이 발행하는 SESSION_CHANGED 이벤트가 맡는다 —
      // `AppHeader` 는 루트 레이아웃의 클라이언트 컴포넌트라 앱 내 이동으로는 다시 조회하지
      // 않기 때문이다(그대로 두면 로그아웃 후에도 「마이페이지」가 남는다).
      router.replace("/");
    }
  }

  if (session.status !== "authenticated") {
    // 확인 전에는 내용을 그리지 않는다 — 로그인 상태가 깜빡이는 것을 막는다.
    // 🚫 빈 `<main>` 을 두지 않는다: 화면을 못 보는 사용자에게 "아무 일도 안 일어난 것" 이 된다.
    return <LoadingView message="확인하고 있어요..." />;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 md:p-8">
      <h1 className="text-3xl font-bold text-ink">마이페이지</h1>

      <Card>
        <dl className="flex items-center gap-4">
          <dt className="text-ink-muted">아이디</dt>
          <dd className="text-lg font-bold text-ink">{session.me.loginId}</dd>
        </dl>
      </Card>

      <div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          // 스타일 소스는 `actionStyles` 한 곳이다 — 🚫 클래스를 옮겨 적지 않는다.
          className={actionClass("primary", "disabled:opacity-60")}
        >
          {loggingOut ? "로그아웃 중…" : "로그아웃"}
        </button>
      </div>
    </main>
  );
}
