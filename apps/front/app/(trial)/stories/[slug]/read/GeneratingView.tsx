"use client";

import { StoryRoom } from "@/components/layout/StoryRoom";
import room from "@/components/layout/StoryRoom.module.css";
import Link from "next/link";
import { StoryBookScene } from "@/components/story/StoryBookScene";
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
  canOpenReader,
  onOpenReader,
}: {
  slug: string;
  sessionPages: SessionPagesResponse | null;
  /** 폴링이 연속 실패하는 중. "멈춘 것" 과 "느린 것" 을 사용자가 구분할 수 있어야 한다. */
  pagesPollDegraded: boolean;
  retryingPageNo: number | null;
  isSelectingBranch: StoryBranchKey | null;
  handleRetry: (pageNo: number) => void;
  handleAfterStoryRetry: (branchKey: StoryBranchKey) => void;
  /** 본편이 준비돼 지금 읽으러 갈 수 있는가. */
  canOpenReader: boolean;
  onOpenReader: () => void;
}) {
  const total = sessionPages?.totalPages || 7;
  const completed = sessionPages?.completedPages || 0;
  const progressPercent = Math.min(100, Math.round((completed / total) * 100));
  const generationPages = sessionPages?.pages ?? [];
  // 세션 전체가 실패로 판정된 상태. 이걸 보지 않으면 제목이 계속 "만들고 있어요" 라
  // **끝난 실패를 진행 중으로 읽게 된다.**
  const hasFailed = sessionPages?.status === "failed";
  const failedCount = generationPages.filter((item) => item.status === "failed").length;

  return (
    <StoryRoom className={room.readingState} storySlug={slug}>
      <StoryBookScene open={!hasFailed} progress={progressPercent} />

      <div>
        <h1 className="text-2xl font-bold text-ink md:text-3xl">
          {hasFailed ? "만들다가 멈췄어요" : "나만의 동화책을 만들고 있어요"}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {hasFailed
            ? "아래에서 멈춘 장을 다시 만들 수 있어요."
            : "AI가 동화 속 장면에 아이의 얼굴과 표정을 마법처럼 합성하고 있어요."}
        </p>
      </div>

      {/* 세션 전체 실패는 진행률만으로는 드러나지 않는다 — 명시적으로 말한다. */}
      {hasFailed && (
        <p
          className="max-w-md rounded-card border-2 border-danger bg-danger-soft px-4 py-3 text-sm font-medium text-danger-strong"
          role="alert"
        >
          {failedCount > 0
            ? `${failedCount}장을 만들지 못했어요. 「다시 만들기」를 눌러 주세요.`
            : "만들기가 중단됐어요. 잠시 후 다시 시도해 주세요."}
        </p>
      )}

      {/* 폴링이 연속 실패할 때만 뜬다 — "멈춘 것"과 "느린 것"을 사용자가 구분할 수 있어야 한다. */}
      {pagesPollDegraded && (
        <p className="max-w-md text-sm font-medium text-gold-strong" role="status">
          연결이 불안정해요. 진행 상황을 계속 다시 확인하고 있어요.
        </p>
      )}

      {/* 진행률 프로그레스 바 */}
      <div className="w-full max-w-md">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-ink-muted">
          <span>제작 진행률 ({completed}/{total}장)</span>
          <span>{progressPercent}%</span>
        </div>
        <div role="progressbar" aria-label="동화 제작 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent} className="h-3 w-full overflow-hidden rounded-pill bg-line shadow-inner">
          <div
            className="h-full origin-left rounded-pill bg-primary transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{ transform: `scaleX(${progressPercent / 100})` }}
          />
        </div>
      </div>

      {/* 페이지별 진행 단계 카드 리스트 */}
      <div className="w-full max-w-md rounded-card border-2 border-line bg-surface-raised p-4 shadow-sm">
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
                className="rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-ink">
                    {pageLabel}
                  </span>
                  {item?.imageUrl && (
                    <span className="rounded-full bg-primary-tint px-2 py-0.5 text-xs font-semibold text-primary-strong">
                      삽화 준비 완료
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {status === "succeeded" && (
                    <span className="font-bold text-primary-strong">✓ 완성</span>
                  )}
                  {status === "running" && (
                    <span className="flex items-center gap-1 font-bold text-primary-strong">
                      <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                      그리는 중...
                    </span>
                  )}
                  {status === "pending" && (
                    <span className="text-xs text-ink-muted">대기 중</span>
                  )}
                  {status === "failed" && (
                    <button
                      onClick={() =>
                        void (isBehind
                          ? handleAfterStoryRetry(item.branchKey as StoryBranchKey)
                          : handleRetry(item.pageNo))
                      }
                      disabled={retryingPageNo === item.pageNo || isSelectingBranch !== null}
                      className={`min-h-touch rounded-btn bg-danger-soft px-3 text-sm font-bold text-danger-strong hover:bg-danger-soft disabled:pointer-events-none disabled:opacity-50 ${FOCUS_RING}`}
                    >
                      {retryingPageNo === item.pageNo || isSelectingBranch === item.branchKey
                        ? "재시도 중..."
                        : "다시 만들기"}
                    </button>
                  )}
                </div>
                </div>

                {/* 백엔드가 사유를 주는데 화면에 안 그리면 사용자는 "왜" 를 알 수 없다.
                    ⚠️ 이 값은 사용자용 문구다 — 내부 예외 원문이 들어오지 않도록
                    백엔드에서 고정 문구로 걸러진다(`openrouter-image.adapter.ts`). */}
                {status === "failed" && item.errorMessage && (
                  <p className="mt-1 text-left text-xs text-danger-strong">{item.errorMessage}</p>
                )}
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

        {/* 폴링의 자동 복귀를 막았으므로(리더 `statusPinned`) 돌아갈 길을 여기서 준다. */}
        {canOpenReader && (
          <button type="button" onClick={onOpenReader} className={actionClass("primary", "w-full")}>
            지금 바로 읽으러 가기
          </button>
        )}

        <Link
          href={`/library/${slug}`}
          className={actionClass("secondary", "w-full")}
        >
          동화 소개로 돌아가기
        </Link>
      </div>
    </StoryRoom>
  );
}
