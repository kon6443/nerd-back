"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ActionLink } from "@/components/ui/ActionLink";
import { actionClass } from "@/components/ui/actionStyles";
import { SESSION_STAGE_BADGE, classifySessionStatus } from "@/components/story/sessionStatus";
import { deleteSession, getMySessions } from "@/lib/api";
import { logout } from "@/lib/api/auth";
import { useSession } from "@/lib/api/useSession";
import type { MyStorySessionItem } from "@nerd/contracts";

/**
 * 목록 격자. ⭐ **스켈레톤과 실제 목록이 같은 값을 쓰도록 한 곳에 둔다** — 한쪽만 고치면
 * 자리가 어긋나고, 그 어긋남이 곧 깜빡임이다(서재의 `STORY_GRID` 와 같은 이유).
 */
const SESSION_GRID = "grid grid-cols-1 gap-4 sm:grid-cols-2";

/**
 * 목록이 도착하기 전 자리를 지키는 카드.
 *
 * ⭐ **실제 카드와 같은 구조·같은 크기여야 한다.** 문구 한 줄만 두면 목록이 채워지는 순간 아래가
 * 통째로 밀려 내려가고, 그것이 새로고침마다 보이는 깜빡임의 정체다(2026-09-10).
 * 🚫 이 파일 밖으로 올리지 않는다 — 두 번째 화면이 쓰는 순간 `components/` 로 옮긴다.
 */
function SessionCardSkeleton() {
  return (
    <Card className="flex animate-pulse flex-col justify-between gap-4 p-5 shadow-sm motion-reduce:animate-none">
      <div className="flex gap-4">
        <div className="h-20 w-20 shrink-0 rounded-lg bg-line" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="h-5 w-16 rounded-pill bg-line" />
          <div className="h-6 w-3/4 rounded bg-line" />
          <div className="h-4 w-1/2 rounded bg-line" />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-2">
        <div className="min-h-touch w-28 rounded-btn bg-line" />
        <div className="min-h-touch w-20 rounded-btn bg-line" />
      </div>
    </Card>
  );
}

export default function MyPage() {
  const router = useRouter();
  const session = useSession();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mySessions, setMySessions] = useState<MyStorySessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (loggingOut) return;
    if (session.status === "guest") router.replace("/login?redirect=/me");
  }, [session.status, router, loggingOut]);

  // ⭐ **세션 확인을 기다리지 않는다.** 기다리면 `GET /auth/me` 다음에 `GET /sessions/my` 가 도는
  //    직렬이 되어 화면이 두 번 바뀐다. 목록은 인증이 필요하지만, 비로그인이면 401 이 오고 위
  //    effect 가 로그인 화면으로 보내므로 잃는 것이 없다. 🚫 `session.status` 를 의존성에 넣지 않는다 —
  //    넣으면 상태가 정해지는 순간 한 번 더 요청이 나간다.
  useEffect(() => {
    let active = true;
    getMySessions()
      .then((data) => {
        if (active) setMySessions(data);
      })
      .catch((err) => {
        console.warn("내 동화 목록 조회 실패:", err);
      })
      .finally(() => {
        if (active) setLoadingSessions(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      router.replace("/");
    }
  }

  async function handleDeleteSession(id: string, title: string) {
    const ok = window.confirm(
      `"${title}" 동화책을 삭제하시겠습니까?\n삭제 후 다른 얼굴로 다시 제작할 수 있습니다.`,
    );
    if (!ok) return;

    setDeletingSessionId(id);
    try {
      await deleteSession(id);
      setMySessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "동화책 삭제에 실패했습니다.");
    } finally {
      setDeletingSessionId(null);
    }
  }

  // ⭐ 골격(제목·로그아웃·아이디 카드·목록 제목)은 세션 확인 전에도 그린다.
  //    확인 전에 전체 화면 로딩을 보이고 그 뒤 페이지를 통째로 갈아끼우면 새로고침마다 크게 튄다.
  //    🚫 **비어 있는 칸을 두지 않는다** — 값이 들어오는 순간 주변이 밀리면 그것이 곧 깜빡임이다.
  //    사용자 데이터가 들어갈 자리에는 **최종 모양과 같은 크기의 스켈레톤**을 둔다(2026-09-10).
  const authenticated = session.status === "authenticated";
  const loading = !authenticated || loadingSessions;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-ink">마이페이지</h1>
        <button
          type="button"
          onClick={handleLogout}
          // 🚫 확인 전이라고 비활성으로 두지 않는다 — 확인이 끝나는 순간 흐렸다가 진해져 깜빡인다.
          //    이 화면은 비로그인이면 어차피 로그인으로 보내므로 누를 사람은 로그인한 사용자뿐이다.
          disabled={loggingOut}
          className={actionClass("ghost", "text-sm disabled:opacity-60", "compact")}
        >
          {loggingOut ? "로그아웃 중…" : "로그아웃"}
        </button>
      </div>

      <Card>
        <dl className="flex items-center gap-4">
          <dt className="text-ink-muted">아이디</dt>
          <dd className="flex min-h-7 items-center text-lg font-bold text-ink">
            {authenticated ? (
              session.me.loginId
            ) : (
              <span
                aria-hidden="true"
                className="inline-block h-5 w-24 animate-pulse rounded bg-line motion-reduce:animate-none"
              />
            )}
          </dd>
        </dl>
      </Card>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-ink">내가 만든 동화책</h2>
          <ActionLink href="/library" variant="ghost" size="compact">
            📚 서재 가기
          </ActionLink>
        </div>

        {loading ? (
          <>
            {/* 스켈레톤은 눈으로만 읽히는 신호다. 화면을 못 보는 사용자에게는 이 문구가 그 역할을 한다. */}
            <p role="status" className="sr-only">
              동화 목록을 불러오는 중입니다.
            </p>
            {/* ⚠️ **한 장만 그린다.** 여러 장을 그려 놓으면 동화를 아직 안 만든 사람에게 없는
                내용을 약속했다가 안내 카드 하나로 줄어든다 — 그 줄어듦이 곧 깜빡임이다
                (2026-09-10 실측: 스켈레톤 2장 → 안내 카드 1장). 늘어나는 쪽은 덜 튄다. */}
            <div className={SESSION_GRID} aria-hidden="true">
              <SessionCardSkeleton />
            </div>
          </>
        ) : mySessions.length === 0 ? (
          <Card className="flex flex-col items-center gap-4 py-8 text-center">
            <p className="text-lg font-bold text-ink">아직 만든 나만의 동화책이 없어요.</p>
            <p className="text-sm text-ink-muted">
              서재에서 마음에 드는 동화를 골라 아이의 얼굴로 주인공 동화를 만들어 보세요.
            </p>
            <ActionLink href="/library" variant="accentA">
              📷 첫 동화책 만들기
            </ActionLink>
          </Card>
        ) : (
          <div className={SESSION_GRID}>
            {mySessions.map((s) => {
              const stage = classifySessionStatus(s.status);
              const isCompleted = stage === "completed";
              const isGenerating = stage === "generating";
              const isFailed = stage === "failed";
              const isDeleting = deletingSessionId === s.id;
              const badge = SESSION_STAGE_BADGE[stage];

              return (
                <Card key={s.id} className="flex flex-col justify-between gap-4 p-5 shadow-sm">
                  <div className="flex gap-4">
                    {s.referenceImageUrl ? (
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-line bg-neutral-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={s.referenceImageUrl}
                          alt={s.templateTitle}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-2xl">
                        📖
                      </div>
                    )}

                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {/* 색은 `Badge` 가 톤으로 소유한다. main 이 같은 자리에서 원색 유틸리티를
                            토큰으로 바꿨고(듀오링고 톤), 그 색 선택을 톤 정의로 옮겼다. */}
                        <Badge tone={badge.tone}>{badge.label}</Badge>
                      </div>
                      <h3 className="truncate text-lg font-bold text-ink">{s.templateTitle}</h3>
                      <p className="text-xs text-ink-muted">
                        {new Date(s.createdAt).toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    {isCompleted ? (
                      <Link
                        href={`/stories/${s.templateSlug}/read?sessionId=${s.id}`}
                        className={actionClass("gold", "text-sm", "compact")}
                      >
                        📖 읽기
                      </Link>
                    ) : isGenerating ? (
                      <Link
                        href={`/stories/${s.templateSlug}/read?sessionId=${s.id}&autoStart=true`}
                        className={actionClass("accentA", "text-sm", "compact")}
                      >
                        ⏳ 이어보기
                      </Link>
                    ) : isFailed ? (
                      <Link
                        href={`/stories/${s.templateSlug}/read?sessionId=${s.id}`}
                        className={actionClass("accentB", "text-sm", "compact")}
                      >
                        ⚠️ 재시도
                      </Link>
                    ) : (
                      <Link
                        href={`/stories/${s.templateSlug}/capture`}
                        className={actionClass("accentA", "text-sm", "compact")}
                      >
                        📷 계속 만들기
                      </Link>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteSession(s.id, s.templateTitle)}
                      disabled={isDeleting}
                      className={actionClass(
                        "ghost",
                        "text-sm text-neutral-600 hover:text-rose-600 hover:border-rose-300 disabled:opacity-50",
                        "compact",
                      )}
                    >
                      {isDeleting ? "삭제 중..." : "🗑️ 삭제"}
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
