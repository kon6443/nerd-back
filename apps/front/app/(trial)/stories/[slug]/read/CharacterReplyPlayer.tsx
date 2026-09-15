"use client";

import { useEffect } from "react";
import type { StoryReplyAudioStatus } from "@nerd/contracts";
import { actionClass } from "@/components/ui/actionStyles";
import { useReaderAudio, useReaderAudioSnapshot } from "@/components/story/ReaderAudioProvider";

export function CharacterReplyPlayer({
  displayName,
  audioUrl,
  audioStatus,
  autoPlay,
  retrying,
  onAutoPlayed,
  onRetry,
  onInteraction,
}: {
  displayName: string;
  audioUrl: string | null;
  audioStatus: StoryReplyAudioStatus;
  autoPlay: boolean;
  retrying: boolean;
  onAutoPlayed: () => void;
  onRetry: () => Promise<void>;
  onInteraction: () => void;
}) {
  const controller = useReaderAudio();
  const audio = useReaderAudioSnapshot();
  const isCurrent = audio.kind === "character" && audio.url === audioUrl;
  const isPlaying = isCurrent && audio.status === "playing";

  useEffect(() => {
    if (!autoPlay || !audioUrl || !controller) return;
    onInteraction();
    onAutoPlayed();
    void controller.play(audioUrl, "character");
  }, [audioUrl, autoPlay, controller, onAutoPlayed, onInteraction]);

  if (audioStatus === "pending") {
    return (
      <p role="status" className="mt-3 text-sm font-medium text-ink-muted">
        {displayName}의 목소리를 준비하고 있어요…
      </p>
    );
  }
  if (audioStatus === "failed") {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <p role="alert" className="text-sm text-ink-muted">음성만 준비하지 못했어요.</p>
        <button
          type="button"
          disabled={retrying}
          onClick={() => {
            onInteraction();
            void onRetry();
          }}
          className={actionClass("secondary", "min-h-touch", "compact")}
        >
          {retrying ? "다시 만드는 중…" : "음성 다시 만들기"}
        </button>
      </div>
    );
  }
  if (audioStatus === "completed" && !audioUrl) {
    return (
      <button
        type="button"
        disabled={retrying}
        onClick={() => {
          onInteraction();
          void onRetry();
        }}
        className={actionClass("secondary", "mt-3 min-h-touch", "compact")}
      >
        {retrying ? "음성을 확인하는 중…" : "답변 음성 다시 불러오기"}
      </button>
    );
  }
  if (audioStatus !== "completed" || !audioUrl) return null;

  return (
    <button
      type="button"
      onClick={() => {
        onInteraction();
        if (isPlaying) controller?.pause();
        else void controller?.play(audioUrl, "character", isCurrent && audio.status === "ended");
      }}
      className={actionClass("secondary", "mt-3 min-h-touch", "compact")}
      aria-label={isPlaying ? `${displayName} 답변 음성 일시정지` : `${displayName} 답변 음성 듣기`}
    >
      {isPlaying ? "답변 음성 일시정지" : "답변 음성 듣기"}
    </button>
  );
}
