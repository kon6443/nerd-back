"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionLink } from "@/components/ui/ActionLink";
import { actionClass } from "@/components/ui/actionStyles";
import { deleteSession, findMySessionBySlug } from "@/lib/api";
import { useSession } from "@/lib/api/useSession";
import type { MyStorySessionItem } from "@nerd/contracts";
import { classifySessionStatus } from "./sessionStatus";

interface StorySessionActionsProps {
  slug: string;
}

export function StorySessionActions({ slug }: StorySessionActionsProps) {
  const router = useRouter();
  const authSession = useSession();
  const [mySession, setMySession] = useState<MyStorySessionItem | null>(null);
  // `null` 은 "아직 모른다"와 "없다"를 구분하지 못한다. 조회가 끝났는지를 따로 든다.
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (authSession.status !== "authenticated") {
      return;
    }

    let active = true;

    findMySessionBySlug(slug)
      .then((matched) => {
        if (active) setMySession(matched);
      })
      .catch((err) => {
        console.warn("내 세션 조회 실패:", err);
      })
      .finally(() => {
        if (active) setSessionsLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [authSession.status, slug]);

  const currentSession = authSession.status === "authenticated" ? mySession : null;
  // 🚫 `status === "generating" || status === "face_ready"` 를 여기서 다시 적지 않는다 — 분류는 `sessionStatus.ts` 가 소유한다.
  const stage = currentSession ? classifySessionStatus(currentSession.status) : null;

  // ⭐ 어떤 버튼 세트를 보일지 정해지기 전에는 **자리만** 잡는다. 먼저 「내 얼굴로 만들기」를
  //    그려 놓고 조회가 끝나면 「내 얼굴 동화 읽기」로 갈아끼우면, 새로고침마다 버튼이 바뀌고
  //    바뀌는 순간 잘못 누를 수 있다(2026-09-09 헤더와 같은 증상). 비로그인은 확인 즉시 정해진다.
  const resolving =
    authSession.status === "unknown" || (authSession.status === "authenticated" && !sessionsLoaded);

  async function handleResetAndRecreate() {
    if (!currentSession) return;
    const ok = window.confirm(
      "기존에 제작된 동화책을 삭제하고 새로운 얼굴로 다시 만드시겠습니까?\n(기존에 합성된 삽화는 영구 삭제됩니다)",
    );
    if (!ok) return;

    setIsDeleting(true);
    setErrorMsg("");

    try {
      await deleteSession(currentSession.id);
      router.push(`/stories/${slug}/capture`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "동화책 초기화에 실패했습니다.";
      setErrorMsg(msg);
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      {errorMsg && (
        <p className="text-sm font-semibold text-danger-strong">{errorMsg}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {resolving ? (
          /* 0. 확인 중 — 기본 세트와 같은 높이의 투명 자리표시. 눌리지 않고 보조기술에도 안 읽힌다. */
          <>
            <span aria-hidden="true" className={actionClass("primary", "invisible")}>
              시연 동화 읽기
            </span>
            <span aria-hidden="true" className={actionClass("accentA", "invisible")}>
              📷 내 얼굴로 만들기
            </span>
          </>
        ) : /* 1. 이미 완성된 동화가 있는 경우 */
        currentSession && stage === "completed" ? (
          <>
            <ActionLink
              href={`/stories/${slug}/read?sessionId=${currentSession.id}`}
              variant="gold"
              size="default"
              className="font-bold shadow-md"
            >
              📖 내 얼굴 동화 읽기
            </ActionLink>
            <ActionLink href={`/library/${slug}/1`} variant="ghost" size="default">
              시연 동화 읽기
            </ActionLink>
            <button
              type="button"
              onClick={handleResetAndRecreate}
              disabled={isDeleting}
              className={actionClass(
                "ghost",
                "text-sm text-neutral-600 hover:text-rose-600 hover:border-rose-300 disabled:opacity-50",
                "compact",
              )}
            >
              {isDeleting ? "초기화 중..." : "🔄 다른 얼굴로 다시 만들기"}
            </button>
          </>
        ) : currentSession && stage === "generating" ? (
          /* 2. 현재 생성 중인 경우 */
          <>
            <ActionLink
              href={`/stories/${slug}/read?sessionId=${currentSession.id}&autoStart=true`}
              variant="accentA"
              size="default"
              className="font-bold"
            >
              ⏳ 제작 중인 동화 이어보기
            </ActionLink>
            <ActionLink href={`/library/${slug}/1`} variant="ghost" size="default">
              시연 동화 읽기
            </ActionLink>
            <button
              type="button"
              onClick={handleResetAndRecreate}
              disabled={isDeleting}
              className={actionClass(
                "ghost",
                "text-sm text-neutral-600 hover:text-rose-600 disabled:opacity-50",
                "compact",
              )}
            >
              {isDeleting ? "취소 중..." : "취소하고 새로 만들기"}
            </button>
          </>
        ) : currentSession && stage === "failed" ? (
          /* 3. 생성이 실패한 경우 */
          <>
            <ActionLink
              href={`/stories/${slug}/read?sessionId=${currentSession.id}`}
              variant="accentB"
              size="default"
              className="font-bold"
            >
              ⚠️ 제작 재시도하기
            </ActionLink>
            <ActionLink href={`/library/${slug}/1`} variant="ghost" size="default">
              시연 동화 읽기
            </ActionLink>
            <button
              type="button"
              onClick={handleResetAndRecreate}
              disabled={isDeleting}
              className={actionClass(
                "ghost",
                "text-sm text-neutral-600 hover:text-rose-600 disabled:opacity-50",
                "compact",
              )}
            >
              {isDeleting ? "삭제 중..." : "삭제하고 새로 만들기"}
            </button>
          </>
        ) : (
          /* 4. 아직 세션이 없거나(비로그인 포함) draft 상태인 경우 */
          <>
            <ActionLink href={`/library/${slug}/1`}>시연 동화 읽기</ActionLink>
            <ActionLink href={`/stories/${slug}/capture`} variant="accentA">
              📷 내 얼굴로 만들기
            </ActionLink>
          </>
        )}
      </div>
    </div>
  );
}
