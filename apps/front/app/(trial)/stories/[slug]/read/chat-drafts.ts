import type { StoryChatBranchKey } from "@nerd/contracts";

export type ChatDraft = { role: string; message: string };

/** 리더 하나의 수명 동안만 유지한다. 브라우저 영구 저장소에는 질문을 쓰지 않는다. */
export function createChatDraftStore() {
  const drafts = new Map<string, ChatDraft>();
  const key = (sessionId: string, pageNo: number, branchKey: StoryChatBranchKey) =>
    `${sessionId}:${pageNo}:${branchKey}`;
  return {
    get: (sessionId: string, pageNo: number, branchKey: StoryChatBranchKey) =>
      drafts.get(key(sessionId, pageNo, branchKey)),
    set: (sessionId: string, pageNo: number, branchKey: StoryChatBranchKey, draft: ChatDraft) => {
      drafts.set(key(sessionId, pageNo, branchKey), draft);
    },
    delete: (sessionId: string, pageNo: number, branchKey: StoryChatBranchKey) => {
      drafts.delete(key(sessionId, pageNo, branchKey));
    },
    clear: () => drafts.clear(),
  };
}

export type ChatDraftStore = ReturnType<typeof createChatDraftStore>;
