"use client";

import { useRouter } from "next/navigation";
import { ActionLink } from "@/components/ui/ActionLink";
import { Card } from "@/components/ui/Card";
import { actionClass } from "@/components/ui/actionStyles";
import { LibraryShell } from "./LibraryShell";

/**
 * ⚠️ **prop 이름은 `reset` 이다.** Next 의 에러 경계가 넘기는 이름이 그것이고
 * (`next/dist/client/components/error-boundary` 의 타입·런타임 모두), `retry` 로 받으면 값이
 * `undefined` 라 타입은 통과하는데 **버튼이 아무 반응도 하지 않는다**. 실제로 그랬다(2026-09-10 리뷰).
 *
 * ⭐ 성공·로딩과 **같은 틀**을 쓴다. 에러만 화면을 통째로 갈아치우면 제목까지 사라져 다른 페이지로
 * 이동한 것처럼 보인다.
 */
export default function LibraryError({ reset }: { reset: () => void }) {
  const router = useRouter();

  /**
   * ⚠️ **`reset()` 만으로는 다시 불러오지 않는다.** 목록은 서버 컴포넌트가 가져오므로 경계 상태만
   * 지워봐야 같은 결과가 다시 그려진다 — 브라우저에서 눌러 보니 요청이 한 번도 더 나가지 않았다
   * (2026-09-10 실측: `/stories` 호출 1회 그대로). `router.refresh()` 로 서버 데이터를 다시 받고,
   * `reset()` 으로 경계를 푼다. 🚫 둘 중 하나만 부르지 않는다.
   */
  function retry() {
    router.refresh();
    reset();
  }

  return (
    <LibraryShell>
      <Card className="flex flex-col items-center gap-5 py-12 text-center">
        {/* 오류는 색이 아니라 역할로 알린다 — 화면을 못 보는 사용자에게 즉시 읽힌다. */}
        <div role="alert">
          <p className="text-xl font-bold text-ink">동화를 불러오지 못했어요.</p>
          <p className="mt-2 text-ink-muted">연결 상태를 확인하고 다시 시도해 주세요.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={retry} className={actionClass("primary")}>
            다시 시도
          </button>
          <ActionLink href="/" variant="ghost">
            홈으로 가기
          </ActionLink>
        </div>
      </Card>
    </LibraryShell>
  );
}
