"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import {
  storyChatInputSchema,
  type StoryCharacterSummary,
  type StoryChatBranchKey,
  type StoryChatExchange,
  type StoryChatStatus,
  type StoryChatView,
} from "@nerd/contracts";
import { ApiError, SESSION_CHANGED_EVENT, UNAUTHORIZED_EVENT } from "@/lib/api/client";
import { fetchStoryChat, retryStoryChatAudio, sendStoryChat } from "@/lib/api/story-chat";

import type { ChatDraftStore } from "./chat-drafts";

/**
 * 등장인물 대화의 상태·폴링·전송 — **화면 모양을 모른다.**
 *
 * ⭐ **리더가 이 훅을 소유하고 런처와 시트에 함께 내린다.** 대화 표면을 닫아도 답변은 계속
 * 도착해야 하는데, 컴포넌트 안에 상태를 두면 닫는 순간 언마운트되어 폴링이 끊긴다. 그러면
 * 사용자는 답을 영영 못 본다 — 질문 기회는 이미 써 버렸는데도.
 *
 * ⭐ **장면이 바뀌면 스스로 초기화한다.** 전에는 부모가 `key` 로 리마운트시켰지만, 이제 리더가
 * 상태를 들고 있어 그 수단을 쓸 수 없다. 렌더 중 상태 조정으로 같은 일을 한다.
 */
export type CharacterChatStatus = StoryChatStatus | "loading" | "login" | "error";

type ChatState = StoryChatView | "loading" | "login" | "error";

export interface CharacterChatController {
  status: CharacterChatStatus;
  characters: StoryCharacterSummary[];
  exchange: StoryChatExchange | null;
  /** 지금 고른 등장인물. 아직 목록이 없으면 `undefined`. */
  selected: StoryCharacterSummary | undefined;
  /** 서버가 알려 준 남은 질문 수. 확인 전에는 `null`. */
  remainingMessages: 0 | 1 | null;
  role: string;
  message: string;
  error: string;
  /** 전송 요청이 떠 있는 중. */
  sending: boolean;
  /** 전송 중이거나 답변을 기다리는 중 — 런처 배지가 이 값을 쓴다. */
  busy: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  submit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  /** 삽화 속 캐릭터를 대화 상대로 고른다. */
  selectRole: (nextRole: string) => void;
  updateDraft: (nextRole: string, nextMessage: string) => void;
  /** 「이용 상태 다시 확인」. */
  recheck: () => void;
  retryAudio: () => Promise<void>;
  retryingAudio: boolean;
  autoPlayReply: boolean;
  markReplyPlayed: () => void;
}

export function useCharacterChat({
  sessionId,
  pageNo,
  branchKey,
  drafts,
}: {
  /**
   * 세션이 없으면(주소에 `sessionId` 가 없을 때) 아무것도 조회하지 않는다.
   * 🚫 훅 호출 자체를 조건부로 만들지 않는다 — 리더는 세션이 확정되기 전에도 렌더된다.
   */
  sessionId: string | null;
  pageNo: number;
  branchKey: StoryChatBranchKey;
  drafts: ChatDraftStore;
}): CharacterChatController {
  const [state, setState] = useState<ChatState>("loading");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [retryingAudio, setRetryingAudio] = useState(false);
  const [autoPlayReply, setAutoPlayReply] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(false);
  const requestVersion = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 장면(세션 · 쪽 · 분기)이 바뀌면 초안을 다시 읽고 처음 상태로 돌아간다.
  // 🚫 이펙트로 옮기지 않는다 — 한 프레임 동안 옛 장면의 질문이 새 장면에 그려진다.
  const sceneKey = `${sessionId}:${pageNo}:${branchKey}`;
  const [shownSceneKey, setShownSceneKey] = useState<string | null>(null);
  if (shownSceneKey !== sceneKey) {
    const draft = sessionId ? drafts.get(sessionId, pageNo, branchKey) : undefined;
    setShownSceneKey(sceneKey);
    setState("loading");
    setRole(draft?.role ?? "");
    setMessage(draft?.message ?? "");
    setError("");
    setAutoPlayReply(false);
  }

  const refresh = useCallback(
    (signal?: AbortSignal): Promise<StoryChatView | undefined> => {
      if (submitting.current || !sessionId) return Promise.resolve(undefined);
      const version = ++requestVersion.current;
      return fetchStoryChat(sessionId, pageNo, branchKey, signal).then(
        (next): StoryChatView | undefined => {
          if (!mounted.current || signal?.aborted || version !== requestVersion.current) return;
          setState(next);
          setRole((current) =>
            next.characters.some((character) => character.role === current)
              ? current
              : (next.exchange?.role ?? next.characters[0]?.role ?? ""),
          );
          if (
            next.status === "pending" ||
            next.status === "completed" ||
            next.status === "failed"
          ) {
            drafts.delete(sessionId, pageNo, branchKey);
            setMessage("");
          }
          return next;
        },
        (cause: unknown): undefined => {
          if (!mounted.current || signal?.aborted || version !== requestVersion.current) return;
          setState((current) => {
            if (cause instanceof ApiError && cause.isUnauthorized) return "login";
            return typeof current === "object" && current.exchange?.reply ? current : "error";
          });
        },
      );
    },
    [sessionId, pageNo, branchKey, drafts],
  );

  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void refresh(controller.signal);
    const onFocus = () => {
      void refresh(controller.signal);
    };
    const onUnauthorized = () => {
      requestVersion.current += 1;
      drafts.clear();
      setState("login");
      setMessage("");
      setError("");
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    window.addEventListener(SESSION_CHANGED_EVENT, onUnauthorized);
    return () => {
      mounted.current = false;
      controller.abort();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
      window.removeEventListener(SESSION_CHANGED_EVENT, onUnauthorized);
    };
  }, [refresh, drafts]);

  const status: CharacterChatStatus = typeof state === "string" ? state : state.status;
  const replyAudioPending =
    typeof state === "object" && state.exchange?.replyAudioStatus === "pending";
  useEffect(() => {
    if (status !== "pending" && !replyAudioPending) return;
    const controller = new AbortController();
    // 느린 조회를 겹쳐 보내면 requestVersion이 계속 바뀌어 모든 응답이 폐기된다.
    // 이전 조회가 끝난 뒤 다음 조회를 예약한다.
    async function poll() {
      await refresh(controller.signal);
      if (!controller.signal.aborted) timer = window.setTimeout(poll, 3000);
    }
    let timer = window.setTimeout(poll, 3000);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [replyAudioPending, status, refresh]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || status !== "available") return;
    const parsed = storyChatInputSchema.safeParse({ role, message });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "질문을 확인해 주세요.");
      inputRef.current?.focus();
      return;
    }
    if (!sessionId) return;
    submitting.current = true;
    const version = ++requestVersion.current;
    setSending(true);
    setError("");
    try {
      const next = await sendStoryChat(sessionId, pageNo, branchKey, parsed.data);
      if (mounted.current && version === requestVersion.current) {
        setState(next);
        setAutoPlayReply(
          next.exchange?.replyAudioStatus === "pending" ||
            (next.exchange?.replyAudioStatus === "completed" &&
              next.exchange.replyAudioUrl !== null),
        );
        drafts.delete(sessionId, pageNo, branchKey);
        setMessage("");
      }
    } catch (cause) {
      if (!mounted.current || version !== requestVersion.current) return;
      if (cause instanceof ApiError && cause.isUnauthorized) {
        setState("login");
        setMessage("");
      } else {
        // POST를 다시 보내지 않는다. 응답 유실·다른 탭 선점 시 서버의 이용 상태만 확인한다.
        setState("loading");
        submitting.current = false;
        const restored = await refresh();
        if (restored?.status === "available") {
          setError("질문을 보내지 못했어요. 질문 기회는 남아 있으니 잠시 후 다시 보내 주세요.");
        }
      }
    } finally {
      submitting.current = false;
      if (mounted.current) setSending(false);
    }
  }

  function updateDraft(nextRole: string, nextMessage: string) {
    if (!sessionId) return;
    setRole(nextRole);
    setMessage(nextMessage);
    setError("");
    drafts.set(sessionId, pageNo, branchKey, { role: nextRole, message: nextMessage });
  }

  function selectRole(nextRole: string) {
    setRole(nextRole);
    setError("");
    if (sessionId) drafts.set(sessionId, pageNo, branchKey, { role: nextRole, message });
  }

  function recheck() {
    setState("loading");
    void refresh();
  }

  async function retryAudio() {
    if (!sessionId || retryingAudio) return;
    setRetryingAudio(true);
    setError("");
    try {
      const next = await retryStoryChatAudio(sessionId, pageNo, branchKey);
      if (!mounted.current) return;
      setState(next);
      setAutoPlayReply(true);
    } catch (cause) {
      if (!mounted.current) return;
      setError(cause instanceof ApiError ? cause.message : "음성을 다시 만들지 못했어요.");
    } finally {
      if (mounted.current) setRetryingAudio(false);
    }
  }

  const characters = typeof state === "object" ? state.characters : [];
  const exchange = typeof state === "object" ? state.exchange : null;

  return {
    status,
    characters,
    exchange,
    selected: characters.find((character) => character.role === role),
    remainingMessages: sending ? 0 : typeof state === "object" ? state.remainingMessages : null,
    role,
    message,
    error,
    sending,
    busy: sending || status === "pending",
    inputRef,
    submit,
    selectRole,
    updateDraft,
    recheck,
    retryAudio,
    retryingAudio,
    autoPlayReply,
    markReplyPlayed: () => setAutoPlayReply(false),
  };
}
