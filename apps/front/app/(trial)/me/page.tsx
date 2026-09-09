"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { LoadingView } from "@/components/ui/LoadingView";
import { ActionLink } from "@/components/ui/ActionLink";
import { actionClass } from "@/components/ui/actionStyles";
import { deleteSession, getMySessions } from "@/lib/api";
import { logout } from "@/lib/api/auth";
import { useSession } from "@/lib/api/useSession";
import type { MyStorySessionItem } from "@nerd/contracts";

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

  useEffect(() => {
    if (session.status !== "authenticated") return;
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
  }, [session.status]);

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

  if (session.status !== "authenticated") {
    return <LoadingView message="확인하고 있어요..." />;
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-ink">마이페이지</h1>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className={actionClass("ghost", "text-sm disabled:opacity-60", "compact")}
        >
          {loggingOut ? "로그아웃 중…" : "로그아웃"}
        </button>
      </div>

      <Card>
        <dl className="flex items-center gap-4">
          <dt className="text-ink-muted">아이디</dt>
          <dd className="text-lg font-bold text-ink">{session.me.loginId}</dd>
        </dl>
      </Card>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-ink">내가 만든 동화책</h2>
          <ActionLink href="/library" variant="ghost" size="compact">
            📚 서재 가기
          </ActionLink>
        </div>

        {loadingSessions ? (
          <p className="text-sm text-ink-muted">동화 목록을 불러오는 중입니다...</p>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {mySessions.map((s) => {
              const isCompleted = s.status === "completed";
              const isGenerating = s.status === "generating" || s.status === "face_ready";
              const isFailed = s.status === "failed";
              const isDeleting = deletingSessionId === s.id;

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
                        <span
                          className={`rounded-pill px-2.5 py-0.5 text-xs font-bold ${
                            // 🚫 원색 유틸리티(emerald·amber·rose)를 쓰지 않는다 — 팔레트를 바꾸면
                            //    이 배지만 옛 색으로 남는다. 🚫 dark: 도 쓰지 않는다(다크모드 미사용).
                            isCompleted
                              ? "bg-primary-tint text-primary-strong"
                              : isGenerating
                              ? "bg-accent-a-soft text-accent-a-strong"
                              : isFailed
                              ? "bg-danger-soft text-danger-strong"
                              : "bg-surface text-ink-muted"
                          }`}
                        >
                          {isCompleted
                            ? "완성됨"
                            : isGenerating
                            ? "제작 중"
                            : isFailed
                            ? "제작 실패"
                            : "등록 중"}
                        </span>
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
