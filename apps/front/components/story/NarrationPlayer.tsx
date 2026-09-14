"use client";

import { actionClass } from "@/components/ui/actionStyles";
import { formatAudioTime } from "./audioController";
import { useReaderAudioSnapshot } from "./ReaderAudioProvider";

export function NarrationPlayer({
  audioUrl,
  enabled,
  onPlay,
  onPause,
  onRestart,
}: {
  audioUrl: string | null;
  enabled: boolean;
  onPlay: () => void;
  onPause: () => void;
  onRestart: () => void;
}) {
  const audio = useReaderAudioSnapshot();
  const isCurrent = audio.kind === "narration" && audio.url === audioUrl;
  const isPlaying = isCurrent && audio.status === "playing";
  const progress = isCurrent && audio.duration > 0 ? (audio.currentTime / audio.duration) * 100 : 0;
  const statusMessage = isPlaying
    ? "낭독을 재생하고 있어요."
    : isCurrent && audio.status === "error"
      ? "낭독을 재생하지 못했어요."
      : isCurrent && (audio.status === "paused" || audio.status === "ended")
        ? "낭독이 멈췄어요."
        : "";

  if (!audioUrl) {
    return (
      <p role="status" className="mt-4 text-sm font-medium text-ink-muted">
        이 페이지는 음성이 준비되지 않았어요.
      </p>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
      <button
        type="button"
        onClick={isPlaying && enabled ? onPause : onPlay}
        className={actionClass("secondary", "min-h-touch", "compact")}
        aria-label={isPlaying && enabled ? "낭독 일시정지" : "이 페이지 읽어주기"}
      >
        {isPlaying && enabled ? "일시정지" : "읽어주기"}
      </button>
      <button
        type="button"
        onClick={onRestart}
        className={actionClass("secondary", "min-h-touch", "compact")}
        aria-label="낭독 처음부터 듣기"
      >
        처음부터
      </button>
      <div className="min-w-28 flex-1" aria-hidden="true">
        <div className="h-2 overflow-hidden rounded-pill bg-line">
          {/* 진행 표시는 버튼이 아니라 위치다 — 초록(GNB 전용)이 아니라 하단바 진행 점과 같은 파랑. */}
          <div className="h-full bg-accent-a" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      </div>
      <p className="text-sm tabular-nums text-ink-muted">
        {formatAudioTime(isCurrent ? audio.currentTime : 0)} / {formatAudioTime(isCurrent ? audio.duration : 0)}
      </p>
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {statusMessage}
      </p>
    </div>
  );
}
