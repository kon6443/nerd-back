"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ActionLink } from "@/components/ui/ActionLink";
import { actionClass } from "@/components/ui/actionStyles";
import { deleteSession, getMySessions } from "@/lib/api";
import { useSession } from "@/lib/api/useSession";
import type { MyStorySessionItem } from "@nerd/contracts";

interface StorySessionActionsProps {
  slug: string;
}

export function StorySessionActions({ slug }: StorySessionActionsProps) {
  const router = useRouter();
  const authSession = useSession();
  const [mySession, setMySession] = useState<MyStorySessionItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (authSession.status !== "authenticated") {
      return;
    }

    let active = true;

    getMySessions()
      .then((sessions) => {
        if (!active) return;
        const matched = sessions.find((s) => s.templateSlug === slug) ?? null;
        setMySession(matched);
      })
      .catch((err) => {
        console.warn("내 세션 조회 실패:", err);
      });

    return () => {
      active = false;
    };
  }, [authSession.status, slug]);

  const currentSession = authSession.status === "authenticated" ? mySession : null;

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
        {/* 1. 이미 완성된 동화가 있는 경우 */}
        {currentSession?.status === "completed" ? (
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
        ) : currentSession?.status === "generating" || currentSession?.status === "face_ready" ? (
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
        ) : currentSession?.status === "failed" ? (
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
