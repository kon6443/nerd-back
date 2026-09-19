"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SessionPagesResponse, StoryBranchKey } from "@nerd/contracts";
import { actionClass, FOCUS_RING } from "@/components/ui/actionStyles";
import { StoryJourneyScene } from "@/components/story/StoryJourneyScene/StoryJourneyScene";
import styles from "./GeneratingView.module.css";

const FAIRY_TALE_TIPS = [
  "작은 늑대는 사실 새콤달콤한 사과를 가장 좋아한대요! 🍎",
  "마법의 콩은 밤새 구름 위 거인의 성까지 쑥쑥 자라나요! 🌱",
  "빨간 모자의 바구니에는 할머니께 드릴 딸기 파이가 들어있어요 🥧",
  "마법 지팡이는 소중한 마음을 담아 휘두를 때 빛이 난대요 ✨",
  "동화나라의 새들은 신나는 모험 소식을 가장 먼저 전해준답니다 🕊️",
  "구름을 타고 높이 날아오르면 소원 별을 만날 수 있어요 🌟",
];

const DEMO_TIPS = [
  "스마트폰 렌즈를 통과해 마법의 동화나라로 떠나요! 🚀",
  "구름 위를 둥실둥실 날아가는 중이에요... ☁️",
  "세상에 단 하나뿐인 특별한 이야기가 곧 시작돼요! ✨",
];

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
  pagesPollDegraded?: boolean;
  retryingPageNo?: number | null;
  isSelectingBranch?: StoryBranchKey | null;
  handleRetry?: (pageNo: number) => void;
  handleAfterStoryRetry?: (branchKey: StoryBranchKey) => void;
  canOpenReader?: boolean;
  onOpenReader?: () => void;
  isDemo?: boolean;
}) {
  const [tipIndex, setTipIndex] = useState(0);
  const [demoProgress, setDemoProgress] = useState(15);
  const [showDetails, setShowDetails] = useState(false);

  const tips = isDemo ? DEMO_TIPS : FAIRY_TALE_TIPS;

  // 팁 롤링 (4초마다 변경)
  useEffect(() => {
    const timer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [tips.length]);

  // 시연 모드 가상 프로그레스 진행
  useEffect(() => {
    if (!isDemo) return;
    const progressTimer = setInterval(() => {
      setDemoProgress((prev) => (prev >= 95 ? 98 : prev + 20));
    }, 600);
    return () => clearInterval(progressTimer);
  }, [isDemo]);

  const total = sessionPages?.totalPages || 7;
  const completed = sessionPages?.completedPages || 0;
  const progressPercent = isDemo
    ? demoProgress
    : Math.min(100, Math.round((completed / total) * 100));
  const generationPages = sessionPages?.pages ?? [];
  const hasFailed = !isDemo && sessionPages?.status === "failed";
  const failedCount = generationPages.filter((item) => item.status === "failed").length;

  return (
    <div className={styles.journeyScreen}>
      {/* 3D 동화 여행 시네마틱 씬 (셀카 ➔ 폰 화면 다이브 ➔ 성/나무 ➔ 마법 불빛 ➔ 무한 구름 비행) */}
      <StoryJourneyScene />

      {/* 상단 알림 영역: 5쪽 본편 준비 완료 시 즉시 읽기 진입 배너 */}
      <div className="w-full">
        {canOpenReader && !hasFailed && (
          <div className={styles.readyBanner}>
            <div className="text-center">
              <p className="text-sm font-bold text-ink">
                🎉 앞쪽 이야기가 먼저 완성되었어요!
              </p>
              <p className="text-xs text-ink-muted">
                나머지 장면들이 그려지는 동안 먼저 읽으러 가볼까요?
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenReader}
              className={actionClass("primary", "w-full py-2.5 text-sm shadow-md font-bold")}
            >
              지금 바로 읽으러 가기
            </button>
          </div>
        )}

        {/* 세션 전체 실패 알림 */}
        {hasFailed && (
          <div className={`${styles.readyBanner} border-danger bg-danger-soft`}>
            <p className="text-sm font-bold text-danger-strong" role="alert">
              {failedCount > 0
                ? `${failedCount}장을 만들지 못했어요. 아래에서 다시 만들어 주세요.`
                : "만들기가 중단됐어요. 잠시 후 다시 시도해 주세요."}
            </p>
          </div>
        )}

        {/* 연결 지연 알림 */}
        {pagesPollDegraded && (
          <div className="mx-auto mt-2 max-w-sm rounded-md bg-black/50 px-3 py-1.5 text-center text-xs text-amber-200 backdrop-blur-sm">
            연결이 불안정해요. 진행 상황을 계속 다시 확인하고 있어요.
          </div>
        )}
      </div>

      {/* 세부 진행 현황 서랍 (정식 모드에서 토글 시 노출) */}
      {!isDemo && showDetails && (
        <div className={styles.detailDrawer}>
          <div className="mb-3 flex items-center justify-between border-b border-white/20 pb-2">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              페이지별 상세 현황
            </h2>
            <button
              type="button"
              onClick={() => setShowDetails(false)}
              className="text-xs text-slate-300 hover:text-white"
            >
              닫기 ✕
            </button>
          </div>
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
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-200">{pageLabel}</span>
                    {item?.imageUrl && (
                      <span className="rounded bg-indigo-500/30 px-1.5 py-0.5 text-[10px] text-indigo-200">
                        삽화 완료
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {status === "succeeded" && (
                      <span className="font-bold text-emerald-400">✓ 완성</span>
                    )}
                    {isRunning && (
                      <span className="font-bold text-amber-300 animate-pulse">그리는 중...</span>
                    )}
                    {status === "pending" && (
                      <span className="text-slate-400">대기 중</span>
                    )}
                    {status === "failed" && (
                      <button
                        onClick={() =>
                          void (isBehind
                            ? handleAfterStoryRetry(item.branchKey as StoryBranchKey)
                            : handleRetry(item.pageNo))
                        }
                        disabled={retryingPageNo === item.pageNo || isSelectingBranch !== null}
                        className={`rounded bg-red-600 px-2 py-1 font-bold text-white hover:bg-red-500 ${FOCUS_RING}`}
                      >
                        다시 만들기
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 하단 판타지 HUD 바 */}
      <footer className={styles.hudBar}>
        {/* 좌측: 동화 팁 롤링 */}
        <div className={styles.tipContainer}>
          <span className={styles.tipBadge}>TIP</span>
          <p key={tipIndex} className={`${styles.tipText} animate-fade-in`}>
            {tips[tipIndex]}
          </p>
        </div>

        {/* 우측: 마법 프로그레스 바 & 세부 버튼 */}
        <div className={styles.gaugeContainer}>
          <div className={styles.gaugeInfo}>
            <span>
              {!hasFailed && completed < total && (
                <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-ping rounded-full bg-amber-400" />
              )}
              {isDemo ? "마법 시연 중" : `제작 중 (${completed}/${total}장)`}
            </span>
            <span className={styles.gaugePercent}>{progressPercent}%</span>
          </div>

          <div
            role="progressbar"
            aria-label="동화 제작 진행률"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
            className={styles.gaugeTrack}
          >
            <div
              className={styles.gaugeFill}
              style={{ width: `${Math.max(5, progressPercent)}%` }}
            />
          </div>

          {!isDemo && (
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              className={styles.detailToggleBtn}
              title="페이지별 세부 진행 현황"
            >
              {showDetails ? "현황 닫기" : "상세 현황"}
            </button>
          )}

          <Link
            href={isDemo ? "/library" : `/library/${slug}`}
            className="text-xs text-slate-300 underline hover:text-white"
          >
            {isDemo ? "서재로" : "소개로"}
          </Link>
        </div>
      </footer>
    </div>
  );
}
