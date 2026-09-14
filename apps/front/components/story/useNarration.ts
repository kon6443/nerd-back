"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReaderAudio } from "./ReaderAudioProvider";

export function useNarration({
  pageKey,
  audioUrl,
  preloadUrls,
}: {
  pageKey: string;
  audioUrl: string | null;
  preloadUrls: Array<string | null | undefined>;
}) {
  const audio = useReaderAudio();
  const [enabled, setEnabled] = useState(false);
  const playedPageKey = useRef<string | null>(null);
  const observedPageKey = useRef(pageKey);
  const preloads = useRef(new Map<string, HTMLAudioElement>());

  useEffect(() => {
    if (typeof Audio === "undefined") return;
    for (const url of preloadUrls) {
      if (!url || preloads.current.has(url)) continue;
      const preload = new Audio();
      preload.preload = "metadata";
      preload.src = url;
      preloads.current.set(url, preload);
    }
  }, [preloadUrls]);

  useEffect(() => {
    if (!audio) return;
    if (observedPageKey.current !== pageKey) {
      observedPageKey.current = pageKey;
      audio.pause();
    }
    if (!enabled || playedPageKey.current === pageKey) return;
    playedPageKey.current = pageKey;
    if (audioUrl) void audio.play(audioUrl, "narration");
    else audio.pause();
  }, [audio, audioUrl, enabled, pageKey]);

  const pause = useCallback(() => {
    setEnabled(false);
    audio?.pause();
  }, [audio]);

  /** 선택 화면처럼 음성 없는 중간 화면에서 자동 이어읽기 의도는 유지한 채 현재 음성만 멈춘다. */
  const suspend = useCallback(() => {
    audio?.pause();
  }, [audio]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) pause();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      audio?.pause();
    };
  }, [audio, pause]);

  const play = useCallback(() => {
    if (!audioUrl || !audio) return;
    playedPageKey.current = pageKey;
    setEnabled(true);
    void audio.play(audioUrl, "narration");
  }, [audio, audioUrl, pageKey]);

  const restart = useCallback(() => {
    if (!audioUrl || !audio) return;
    playedPageKey.current = pageKey;
    setEnabled(true);
    void audio.play(audioUrl, "narration", true);
  }, [audio, audioUrl, pageKey]);

  return { enabled, play, pause, suspend, restart };
}
