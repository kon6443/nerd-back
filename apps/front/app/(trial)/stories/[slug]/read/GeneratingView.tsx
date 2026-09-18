"use client";

import { useEffect, useState } from "react";
import { StoryRoom } from "@/components/layout/StoryRoom";
import room from "@/components/layout/StoryRoom.module.css";
import Link from "next/link";
import { StoryBookScene } from "@/components/story/StoryBookScene";
import type { SessionPagesResponse, StoryBranchKey } from "@nerd/contracts";
import { actionClass, FOCUS_RING } from "@/components/ui/actionStyles";

const MAGIC_MESSAGES = [
  "아이의 사랑스러운 표정을 동화 속에 쏙 담고 있어요 ✨",
  "마법 붓으로 동화 속 장면에 알록달록 색채를 입히고 있어요 🎨",
  "동화나라 친구들이 새로운 주인공을 반갑게 맞이하고 있어요 📖",
  "세상에 단 하나뿐인 특별한 이야기를 정성스레 엮는 중이에요 🪄",
  "거의 다 그려졌어요! 조금만 기다려 주시면 마법이 펼쳐져요 🌟",
];

const DEMO_MAGIC_MESSAGES = [
  "동화나라의 문을 똑똑 두드리고 있어요... ✨",
  "주인공 마법을 가루처럼 뿌리는 중... 🪄",
  "세상에 단 하나뿐인 이야기가 펼쳐집니다! 🌟",
];

/**
 * 개인화 제작 현황 — 쪽마다 진행 상태와 단독 재시도를 보여 준다.
 *
 * 🚫 폴링·재시도 **로직은 여기 두지 않는다.** 리더가 소유하고 이 화면은 받은 것만 그린다 —
 * 화면이 자기 폴링을 가지면 리더의 것과 두 벌이 되어 요청이 배로 나간다.
 */
export function GeneratingView({
  slug,
  sessionPages,
  pagesPollDegraded = false,
  retryingPageNo = null,
  isSelectingBranch = null,
  handleRetry = () => {},
  handleAfterStoryRetry = () => {},
  canOpenReader = false,
  onOpenReader = () => {},
  isDemo = false,
}: {
  slug: string;
  sessionPages: SessionPagesResponse | null;
  /** 폴링이 연속 실패하는 중. "멈춘 것" 과 "느린 것" 을 사용자가 구분할 수 있어야 한다. */
  pagesPollDegraded?: boolean;
  retryingPageNo?: number | null;
  isSelectingBranch?: StoryBranchKey | null;
  handleRetry?: (pageNo: number) => void;
  handleAfterStoryRetry?: (branchKey: StoryBranchKey) => void;
  /** 본편이 준비돼 지금 읽으러 갈 수 있는가. */
  canOpenReader?: boolean;
  onOpenReader?: () => void;
  isDemo?: boolean;
}) {
  const [magicMsgIndex, setMagicMsgIndex] = useState(0);
  const [demoProgress, setDemoProgress] = useState(15);

  const activeMessages = isDemo ? DEMO_MAGIC_MESSAGES : MAGIC_MESSAGES;

  useEffect(() => {
    const interval = isDemo ? 1200 : 3800;
    const timer = setInterval(() => {
      setMagicMsgIndex((prev) => (prev + 1) % activeMessages.length);
    }, interval);
    return () => clearInterval(timer);
  }, [isDemo, activeMessages.length]);

  useEffect(() => {
    if (!isDemo) return;
    const progressTimer = setInterval(() => {
      setDemoProgress((prev) => {
        if (prev >= 95) return 98;
        return prev + 25;
      });
    }, 600);
    return () => clearInterval(progressTimer);
  }, [isDemo]);

  const total = sessionPages?.totalPages || 7;
  const completed = sessionPages?.completedPages || 0;
  const progressPercent = isDemo
    ? demoProgress
    : Math.min(100, Math.round((completed / total) * 100));
  const generationPages = sessionPages?.pages ?? [];
  // 세션 전체가 실패로 판정된 상태. 이걸 보지 않으면 제목이 계속 "만들고 있어요" 라
  // **끝난 실패를 진행 중으로 읽게 된다.**
  const hasFailed = !isDemo && sessionPages?.status === "failed";
  const failedCount = generationPages.filter((item) => item.status === "failed").length;

  return (
    <StoryRoom className={room.readingState} storySlug={slug}>
      <StoryBookScene open={!hasFailed} progress={progressPercent} />

      <div>
        <h1 className="text-2xl font-bold text-ink md:text-3xl">
          {isDemo
            ? "동화 속 세상으로 떠나고 있어요!"
            : hasFailed
              ? "만들다가 멈췄어요"
              : "나만의 동화책을 만들고 있어요"}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {isDemo
            ? "잠시 후 멋진 주인공이 된 내 모습이 나타나요 ✨"
            : hasFailed
              ? "아래에서 멈춘 장을 다시 만들 수 있어요."
              : "AI가 동화 속 장면에 아이의 얼굴과 표정을 마법처럼 합성하고 있어요."}
        </p>
      </div>

      {/* 실시간 마법 진행 메시지 롤링 */}
      {!hasFailed && (
        <div className="flex min-h-[46px] w-full max-w-md items-center justify-center rounded-card border border-primary/30 bg-primary-soft/50 px-4 py-2.5 text-center text-sm font-semibold text-primary-strong shadow-xs">
          <span key={magicMsgIndex} className="animate-fade-in transition-all duration-300">
            {activeMessages[magicMsgIndex]}
          </span>
        </div>
      )}

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

      {/* 첫 페이지 준비 완료 시 즉시 읽기 가능 배너 */}
      {canOpenReader && !hasFailed && (
        <div className="flex w-full max-w-md flex-col items-center gap-2 rounded-card border-2 border-primary bg-primary-soft/60 p-3.5 text-center shadow-sm">
          <p className="text-sm font-bold text-primary-strong">
            🎉 앞쪽 이야기가 먼저 준비되었어요!
          </p>
          <p className="text-xs text-ink-muted">
            나머지 장면들이 그려지는 동안 먼저 읽기를 시작할 수 있어요.
          </p>
          <button
            type="button"
            onClick={onOpenReader}
            className={actionClass("primary", "w-full py-2.5 text-sm")}
          >
            지금 바로 읽으러 가기
          </button>
        </div>
      )}

      {/* 진행률 프로그레스 바 & 예상 시간 */}
      <div className="w-full max-w-md">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-ink-muted">
          <span className="flex items-center gap-1.5">
            {!hasFailed && completed < total && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
            )}
            제작 진행률 ({completed}/{total}장)
          </span>
          <span className="text-primary-strong">{progressPercent}%</span>
        </div>
        <div role="progressbar" aria-label="동화 제작 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent} className="h-3.5 w-full overflow-hidden rounded-pill bg-line shadow-inner">
          <div
            className={`h-full origin-left rounded-pill bg-primary transition-transform duration-500 ease-out motion-reduce:transition-none ${!hasFailed && completed < total ? "animate-pulse" : ""}`}
            style={{ transform: `scaleX(${Math.max(0.04, progressPercent / 100)})` }}
          />
        </div>
        {!hasFailed && !isDemo && completed < total && (
          <p className="mt-2 text-right text-[11px] font-medium text-ink-muted">
            ⏳ 한 권 제작에 약 30초~1분이 걸려요. 잠시만 기다려 주세요!
          </p>
        )}
        {isDemo && (
          <p className="mt-2 text-center text-xs font-medium text-primary-strong animate-pulse">
            🪄 마법을 부리는 중... 곧 동화가 시작돼요!
          </p>
        )}
      </div>

      {/* 페이지별 진행 단계 카드 리스트 (정식 제작 모드 전용) */}
      {!isDemo && (
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
              const isRunning = status === "running";

              return (
                <div
                  key={`${item.branchKey}-${item.pageNo}`}
                  className={`rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    isRunning
                      ? "border-primary/40 bg-primary-soft/20 shadow-xs"
                      : "border-line bg-surface-raised"
                  }`}
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
                        <span className="flex items-center gap-1 font-bold text-primary-strong">
                          <span className="inline-block">✓</span> 완성
                        </span>
                      )}
                      {isRunning && (
                        <span className="flex items-center gap-1.5 font-bold text-primary-strong">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                          </span>
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

                  {status === "failed" && item.errorMessage && (
                    <p className="mt-1 text-left text-xs text-danger-strong">{item.errorMessage}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 완료 액션 버튼 */}
      <div className="flex w-full max-w-md flex-col gap-3">
        {!isDemo && (
          <p className="text-xs text-ink-muted">
            본편 5장이 준비되면 바로 읽을 수 있어요. 한 장이 실패하더라도 해당 페이지만 다시 만들 수 있습니다.
          </p>
        )}

        {/* 폴링의 자동 복귀를 막았으므로(리더 `statusPinned`) 돌아갈 길을 여기서 준다. */}
        {canOpenReader && (
          <button type="button" onClick={onOpenReader} className={actionClass("primary", "w-full")}>
            지금 바로 읽으러 가기
          </button>
        )}

        <Link
          href={isDemo ? "/library" : `/library/${slug}`}
          className={actionClass("secondary", "w-full")}
        >
          {isDemo ? "서재로 돌아가기" : "동화 소개로 돌아가기"}
        </Link>
      </div>
    </StoryRoom>
  );
}
