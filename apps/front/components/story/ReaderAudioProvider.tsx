"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { ReaderAudioController } from "./audioController";
import type { ReaderAudioSnapshot } from "./audioController";

const ReaderAudioContext = createContext<ReaderAudioController | null>(null);
const EMPTY_AUDIO_SNAPSHOT: ReaderAudioSnapshot = {
  kind: null,
  url: null,
  status: "idle",
  currentTime: 0,
  duration: 0,
};
const getEmptyAudioSnapshot = () => EMPTY_AUDIO_SNAPSHOT;
const subscribeToNothing = () => () => undefined;

export function ReaderAudioProvider({ children }: { children: ReactNode }) {
  const [controller] = useState<ReaderAudioController | null>(() =>
    typeof Audio === "undefined" ? null : new ReaderAudioController(new Audio()),
  );

  useEffect(() => {
    return () => controller?.destroy();
  }, [controller]);

  return <ReaderAudioContext value={controller}>{children}</ReaderAudioContext>;
}

export function useReaderAudio(): ReaderAudioController | null {
  return useContext(ReaderAudioContext);
}

export function useReaderAudioSnapshot() {
  const controller = useReaderAudio();
  return useSyncExternalStore(
    controller?.subscribe ?? subscribeToNothing,
    controller?.getSnapshot ?? getEmptyAudioSnapshot,
    controller?.getServerSnapshot ?? getEmptyAudioSnapshot,
  );
}
