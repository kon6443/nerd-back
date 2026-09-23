"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import type { SessionPagesResponse, StoryBranchKey } from "@nerd/contracts";
import { actionClass } from "@/components/ui/actionStyles";
import { StoryJourneyScene } from "@/components/story/StoryJourneyScene/StoryJourneyScene";
import styles from "./GeneratingView.module.css";

export const STALE_RUNNING_THRESHOLD_MS = 180_000; // 3분

export function isStaleRunning(
  item: { status: string; updatedAt?: string },
  now: number,
): boolean {
  if (item.status !== "running" || !item.updatedAt) return false;
  const updated = new Date(item.updatedAt).getTime();
  if (Number.isNaN(updated)) return false;
  return now - updated >= STALE_RUNNING_THRESHOLD_MS;
}

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
  const [motionPaused, setMotionPaused] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  const titleId = useId();
  const total = sessionPages?.totalPages ?? 0;
  const completed = Math.min(total, Math.max(0, sessionPages?.completedPages ?? 0));
  const generationPages = sessionPages?.pages ?? [];
  const hasFailed = !isDemo && sessionPages?.status === "failed";
  const ready = canOpenReader && !hasFailed;
  const allCompleted = sessionPages?.isAllCompleted || sessionPages?.status === "completed";
  const progressPercent = total > 0 && (!isDemo || ready) ? Math.round(completed / total * 100) : undefined;
  const progressLabel = hasFailed ? "만들기가 잠시 멈췄어요"
    : progressPercent === 100 ? "동화 준비 완료" : isDemo ? "체험 동화 준비 중" : "동화를 만들고 있어요";
  const progressDescription = isDemo && !ready ? "첫 장을 불러오고 있어요"
    : progressPercent === undefined ? "진행 상황 확인 중" : `${total}장 중 ${completed}장 완성`;
  const failedCount = generationPages.filter(item => item.status === "failed" || isStaleRunning(item, now)).length;
  const title = hasFailed ? "이야기를 만들다 잠깐 멈췄어요" : ready ? "이야기 속으로 떠나볼까요?" : "동화나라로 떠나는 중이에요";
  const description = hasFailed
    ? failedCount > 0 ? "괜찮아요. 아래에서 멈춘 장면을 다시 만들 수 있어요." : "잠시 후 다시 확인하거나 동화 소개로 돌아가 주세요."
    : ready
      ? allCompleted ? "준비가 끝났어요. 이제 책을 펼쳐 보세요." : "앞쪽 이야기가 완성됐어요. 먼저 읽어볼 수 있어요."
      : isDemo ? "동화를 준비하는 동안, 작은 모험을 함께 떠나요." : failedCount > 0 ? "일부 장면이 오래 걸리고 있어요. 아래 현황에서 다시 만들 수 있어요." : "한 장, 한 장. 동화 속에 너의 자리를 만들고 있어요.";

  return (
    <main className={styles.journeyScreen} aria-labelledby={titleId}>
      <div className={styles.content}>
        <header className={styles.heading}>
          <p className={styles.eyebrow}>{isDemo ? "동화 미리 만나기" : "나만의 동화 만들기"}</p>
          <h1 id={titleId}>{title}</h1>
          <p className={styles.description} role="status">{description}</p>
        </header>

        <div className={styles.stage}>
          <StoryJourneyScene paused={motionPaused || hasFailed} />
        </div>

        <div className={styles.statusArea}>
          <div className={styles.progressSection}>
            <div className={styles.progressLabel}>
              <span>{progressLabel}</span>
              {progressPercent !== undefined && <strong className={styles.progressPercent}>{progressPercent}%</strong>}
            </div>
            <div className={styles.progressTrack} role="progressbar"
              aria-label={isDemo ? "체험 동화 준비 상태" : "동화 제작 진행률"}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}
              aria-valuetext={progressDescription} data-paused={motionPaused || hasFailed}>
              {progressPercent === undefined ? (
                <div className={styles.progressIndeterminate} />
              ) : (
                <div className={styles.progressFill} style={{ transform: `scaleX(${progressPercent / 100})` }} />
              )}
            </div>
            <p className={styles.pageCount}>{progressDescription}</p>
          </div>
          {hasFailed ? (
            <p className={styles.error} role="alert">
              {failedCount > 0 ? `${failedCount}장을 다시 만들어야 해요.` : "만들기를 이어갈 수 없어요. 잠시 후 다시 확인해 주세요."}
            </p>
          ) : ready ? (
            <button type="button" onClick={onOpenReader} className={actionClass("primary", styles.readButton)}>
              동화 읽으러 가기 <span aria-hidden="true">→</span>
            </button>
          ) : null}
          {pagesPollDegraded && (
            <p className={styles.connectionNotice} role="status">연결이 잠깐 느려요. 진행 상황을 다시 확인하고 있어요.</p>
          )}
          {!isDemo && generationPages.length > 0 && (
            <details className={styles.details} key={hasFailed ? "failed" : "progress"} open={hasFailed || failedCount > 0 || undefined}>
              <summary>만들기 현황 보기{failedCount > 0 && ` · 다시 만들기 ${failedCount}장`}</summary>
              <ul className={styles.pageList}>
                {generationPages.map(item => {
                  const isBehind = item.branchKey !== "common";
                  const retrying = retryingPageNo === item.pageNo || (isBehind && isSelectingBranch === item.branchKey);
                  const stale = isStaleRunning(item, now);
                  const retryable = item.status === "failed" || stale;
                  return (
                    <li key={`${item.branchKey}-${item.pageNo}`}>
                      <span>{isBehind ? `비하인드 ${item.branchKey.toUpperCase()}` : `${item.pageNo}쪽`}</span>
                      {retryable ? (
                        <button type="button" disabled={retryingPageNo !== null || isSelectingBranch !== null}
                          aria-label={`${isBehind ? `비하인드 ${item.branchKey.toUpperCase()}` : `${item.pageNo}쪽`} 다시 만들기`}
                          className={actionClass("secondary", styles.retryButton, "compact")}
                          onClick={() => void (isBehind ? handleAfterStoryRetry(item.branchKey as StoryBranchKey) : handleRetry(item.pageNo))}>
                          {retrying ? "다시 만드는 중" : stale && item.status !== "failed" ? "지연됨 · 다시 만들기" : "다시 만들기"}
                        </button>
                      ) : (
                        <span className={item.status === "succeeded" ? styles.complete : styles.pending}>
                          {item.status === "succeeded" ? "완성" : item.status === "running" ? "그리는 중" : "차례를 기다려요"}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </details>
          )}
        </div>
        <footer className={styles.footer}>
          <Link href={isDemo ? "/library" : `/library/${slug}`}>{isDemo ? "서재로 돌아가기" : "동화 소개로"}</Link>
          {!hasFailed && <>
            <span className={styles.footerDivider} aria-hidden="true" />
            <button className={styles.motionControl} type="button" onClick={() => setMotionPaused(value => !value)} aria-pressed={motionPaused}>
              {motionPaused ? "풍경 움직이기" : "풍경 잠시 멈추기"}
            </button>
          </>}
        </footer>
      </div>
    </main>
  );
}
