import {
  storyChatInputSchema,
  type StoryChatInput,
  type StoryChatView,
  type StoryChatBranchKey,
} from "@nerd/contracts";
import { apiFetch } from "./client";

function chatPath(sessionId: string, pageNo: number, branchKey: StoryChatBranchKey): string {
  return `/sessions/${encodeURIComponent(sessionId)}/pages/${encodeURIComponent(String(pageNo))}/chat?branchKey=${encodeURIComponent(branchKey)}`;
}

export function fetchStoryChat(
  sessionId: string,
  pageNo: number,
  branchKey: StoryChatBranchKey,
  signal?: AbortSignal,
): Promise<StoryChatView> {
  return apiFetch<StoryChatView>(chatPath(sessionId, pageNo, branchKey), {
    cache: "no-store",
    signal,
  });
}

export function sendStoryChat(
  sessionId: string,
  pageNo: number,
  branchKey: StoryChatBranchKey,
  input: StoryChatInput,
): Promise<StoryChatView> {
  return apiFetch<StoryChatView>(chatPath(sessionId, pageNo, branchKey), {
    method: "POST",
    json: storyChatInputSchema.parse(input),
  });
}

export function retryStoryChatAudio(
  sessionId: string,
  pageNo: number,
  branchKey: StoryChatBranchKey,
): Promise<StoryChatView> {
  const path = chatPath(sessionId, pageNo, branchKey).replace("?", "/audio?");
  return apiFetch<StoryChatView>(path, { method: "POST" });
}
