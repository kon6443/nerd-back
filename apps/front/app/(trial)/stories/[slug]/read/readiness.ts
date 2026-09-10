import type { SessionPagesResponse } from "@nerd/contracts";

type SessionProgress = Pick<
  SessionPagesResponse,
  "isMainStoryReady" | "isAllCompleted" | "status"
>;

/** 본편을 읽을 수 있는 시점인지 판단한다. 비하인드 A/B 삽화는 백그라운드에서 계속 생성될 수 있다. */
export function isReaderReady(progress: SessionProgress): boolean {
  return progress.isMainStoryReady || progress.isAllCompleted || progress.status === "completed";
}
