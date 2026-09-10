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

/**
 * ⚠️ **호출부에서 `key={slug}` 를 준다.** 안 주면 다른 동화로 이동해도 React 가 같은 인스턴스를
 * 재사용해 이전 동화의 조회 결과가 남고, 새 화면에 **이전 동화의 세션 ID 가 박힌 링크**가 잠깐
 * 그려진다. 🚫 효과 안에서 상태를 되돌리는 방식으로 대신하지 않는다 — 렌더가 한 번 더 돌고
 * eslint 가 막는다(`setState synchronously within an effect`).
 */

export function StorySessionActions({ slug }: StorySessionActionsProps) {
  const router = useRouter();
  const authSession = useSession();
  const [mySession, setMySession] = useState<MyStorySessionItem | null>(null);
  // `null` 은 "아직 모른다"와 "없다"를 구분하지 못한다. 조회가 끝났는지를 따로 든다.
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  /**
   * ⚠️ **로그인한 사람만 부른다.** 이 화면은 `(demo)` 그룹의 **공개 경로**라 방문자 대부분이
   * 비로그인이다. 게이트를 빼고 마운트 즉시 부르게 했더니 비로그인 방문 1회마다
   * `GET /sessions/my` 가 한 번씩 나갔고 백엔드가 `AuthGuard` 로 막아 **전부 401** 이었다
   * (2026-09-10 실측: `/library/jack` 1회 방문에 `/stories/jack` 1 · `/auth/me` 1 · `/sessions/my` 1).
   * 실패가 확정된 요청을 공개 페이지마다 보내지 않는다.
   *
   * 대가는 `GET /auth/me` 다음에 이 요청이 도는 **직렬 대기**다. 그동안 CTA 자리는 투명 자리표시가
   * 지키므로 화면이 흔들리지는 않는다. 🚫 마이페이지처럼 병렬로 바꾸지 않는다 — 그 화면은
   * 로그인 전용이라 비로그인 요청이 애초에 없다.
   */
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
  //    ⚠️ **비로그인은 세션 조회를 하지 않으므로 `sessionsLoaded` 가 영영 false 다.** 그래서
  //    로그인한 경우에만 그 값을 본다. 이 조건을 빼면 비로그인 방문자의 CTA 가 투명 자리표시로
  //    남아 아무 버튼도 보이지 않는다.
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
