"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getSpeechRecognition, SpeechInputController } from "./speechInput";

export function useSpeechInput({ enabled, role }: { enabled: boolean; role: string }) {
  const [controller] = useState(() => new SpeechInputController(getSpeechRecognition()));
  const snapshot = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot,
  );

  useEffect(() => {
    if (!enabled) controller.cancel();
    const onVisibilityChange = () => {
      if (document.hidden) controller.cancel();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", controller.cancel);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", controller.cancel);
      controller.cancel();
    };
  }, [controller, enabled, role]);

  return { controller, ...snapshot, active: snapshot.phase !== "idle" };
}
