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

  // ⭐ 골격(제목·로그아웃·아이디 카드·목록 제목)은 세션 확인 전에도 그린다.
  //    확인 전에 전체 화면 로딩을 보이고 그 뒤 페이지를 통째로 갈아끼우면, 새로고침마다
  //    「로딩 → 페이지 → 목록 로딩 → 목록」으로 두 번 튄다(2026-09-09 배포 환경 보고).
  //    사용자 데이터가 들어가는 칸만 확인 뒤에 채우고, 로딩은 목록 영역 한 곳에서만 보인다.
  const authenticated = session.status === "authenticated";
  const loading = !authenticated || loadingSessions;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-ink">마이페이지</h1>
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut || !authenticated}
          className={actionClass("ghost", "text-sm disabled:opacity-60", "compact")}
        >
          {loggingOut ? "로그아웃 중…" : "로그아웃"}
        </button>
      </div>

      <Card>
        <dl className="flex items-center gap-4">
          <dt className="text-ink-muted">아이디</dt>
          {/* 확인 전에는 같은 높이의 빈 칸만 둔다 — 값이 들어올 때 카드 높이가 변하지 않게. */}
          <dd className="min-h-7 text-lg font-bold text-ink">{authenticated ? session.me.loginId : ""}</dd>
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
          // 목록이 들어올 자리의 최소 높이를 잡아 둔다. 문구만 두면 목록이 채워질 때 아래가 크게 밀린다.
          <p role="status" className="flex min-h-40 items-center justify-center text-sm text-ink-muted">
            동화 목록을 불러오는 중입니다...
          </p>
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
