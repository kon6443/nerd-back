"use client";

import Link from "next/link";
import type { SessionPagesResponse, StoryBranchKey } from "@nerd/contracts";
import { actionClass, FOCUS_RING } from "@/components/ui/actionStyles";

/**
 * 개인화 제작 현황 — 쪽마다 진행 상태와 단독 재시도를 보여 준다.
 *
 * 🚫 폴링·재시도 **로직은 여기 두지 않는다.** 리더가 소유하고 이 화면은 받은 것만 그린다 —
 * 화면이 자기 폴링을 가지면 리더의 것과 두 벌이 되어 요청이 배로 나간다.
 */
export function GeneratingView({
  slug,
  sessionPages,
  pagesPollDegraded,
  retryingPageNo,
  isSelectingBranch,
  handleRetry,
  handleAfterStoryRetry,
}: {
  slug: string;
  sessionPages: SessionPagesResponse | null;
  /** 폴링이 연속 실패하는 중. "멈춘 것" 과 "느린 것" 을 사용자가 구분할 수 있어야 한다. */
  pagesPollDegraded: boolean;
  retryingPageNo: number | null;
  isSelectingBranch: StoryBranchKey | null;
  handleRetry: (pageNo: number) => void;
  handleAfterStoryRetry: (branchKey: StoryBranchKey) => void;
}) {
  const total = sessionPages?.totalPages || 7;
  const completed = sessionPages?.completedPages || 0;
  const progressPercent = Math.min(100, Math.round((completed / total) * 100));
  const generationPages = sessionPages?.pages ?? [];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 py-8 text-center">
      {/* 마법 오라 애니메이션 */}
      <div className="relative flex h-40 w-40 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-magic opacity-20" />
        <div className="absolute -inset-2 animate-pulse rounded-full bg-primary-soft opacity-60" />
        <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-surface shadow-xl">
          <span className="animate-bounce text-5xl">🎨</span>
        </div>
        <span className="absolute -top-1 -right-1 text-2xl animate-spin">✨</span>
        <span className="absolute -bottom-1 -left-1 text-2xl">📖</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-ink md:text-3xl">나만의 동화책을 만들고 있어요</h1>
        <p className="mt-2 text-sm text-ink-muted">
          AI가 동화 속 장면에 아이의 얼굴과 표정을 마법처럼 합성하고 있어요.
        </p>
      </div>

      {/* 폴링이 연속 실패할 때만 뜬다 — "멈춘 것"과 "느린 것"을 사용자가 구분할 수 있어야 한다. */}
      {pagesPollDegraded && (
        <p className="max-w-md text-sm font-medium text-amber-700" role="status">
          연결이 불안정해요. 진행 상황을 계속 다시 확인하고 있어요.
        </p>
      )}

      {/* 진행률 프로그레스 바 */}
      <div className="w-full max-w-md">
        <div className="mb-2 flex items-center justify-between text-xs font-bold text-ink-muted">
          <span>제작 진행률 ({completed}/{total}장)</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-4 w-full overflow-hidden rounded-pill border-2 border-line bg-white shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-accent-a via-primary to-magic transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 페이지별 진행 단계 카드 리스트 */}
      <div className="w-full max-w-md rounded-card border-2 border-line bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-left text-xs font-bold text-ink-muted uppercase tracking-wider">
          페이지별 제작 현황
        </h2>
        <div className="flex flex-col gap-2">
          {generationPages.map((item) => {
            const isBehind = item.branchKey !== "common";
            const pageLabel = isBehind
              ? `6쪽 비하인드 ${item.branchKey.toUpperCase()}`
              : `${item.pageNo}쪽`;
            const status = item?.status || "pending";

            return (
              <div
                key={`${item.branchKey}-${item.pageNo}`}
                className="flex items-center justify-between rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink">
                    {pageLabel}
                  </span>
                  {item?.imageUrl && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      삽화 준비 완료
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {status === "succeeded" && (
                    <span className="font-bold text-emerald-600">✓ 완성</span>
                  )}
                  {status === "running" && (
                    <span className="flex items-center gap-1 font-bold text-primary animate-pulse">
                      <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                      그리는 중...
                    </span>
                  )}
                  {status === "pending" && (
                    <span className="text-xs text-neutral-400">대기 중</span>
                  )}
                  {status === "failed" && (
                    <button
                      onClick={() =>
                        void (isBehind
                          ? handleAfterStoryRetry(item.branchKey as StoryBranchKey)
                          : handleRetry(item.pageNo))
                      }
                      disabled={retryingPageNo === item.pageNo || isSelectingBranch !== null}
                      // 색은 디자이너 영역이라 그대로 두고 **누를 수 있는 크기와 포커스 표시**만 보강했다.
                      // ⚠️ 여기도 56px 규약에는 미달한다 — 페이지 목록 한 줄 안에 들어가야 한다.
                      className={`min-h-[40px] rounded-btn bg-red-100 px-3 text-sm font-bold text-red-600 hover:bg-red-200 disabled:pointer-events-none disabled:opacity-50 ${FOCUS_RING}`}
                    >
                      {retryingPageNo === item.pageNo || isSelectingBranch === item.branchKey
                        ? "재시도 중..."
                        : "다시 만들기"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 완료 액션 버튼 */}
      <div className="flex w-full max-w-md flex-col gap-3">
        <p className="text-xs text-ink-muted">
          본편 5장이 준비되면 바로 읽을 수 있어요. 한 장이 실패하더라도 해당 페이지만 다시 만들 수 있습니다.
        </p>

        <Link href={`/library/${slug}`} className={actionClass("secondary", "w-full")}>
          동화 소개로 돌아가기
        </Link>
      </div>
    </main>
  );
}
