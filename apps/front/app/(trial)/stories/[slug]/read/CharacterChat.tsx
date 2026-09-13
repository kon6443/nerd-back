"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  STORY_CHAT_MAX_MESSAGE_LENGTH,
  storyChatInputSchema,
  type StoryChatView,
  type StoryChatBranchKey,
} from "@nerd/contracts";
import { ActionLink } from "@/components/ui/ActionLink";
import { actionClass } from "@/components/ui/actionStyles";
import { ApiError, UNAUTHORIZED_EVENT, SESSION_CHANGED_EVENT } from "@/lib/api/client";
import { fetchStoryChat, sendStoryChat } from "@/lib/api/story-chat";

import type { ChatDraftStore } from "./chat-drafts";

type ChatState = StoryChatView | "loading" | "login" | "error";

export function CharacterChat({
  sessionId,
  pageNo,
  branchKey,
  drafts,
  loginHref,
  onNext,
  nextLabel,
}: {
  sessionId: string;
  pageNo: number;
  branchKey: StoryChatBranchKey;
  drafts: ChatDraftStore;
  loginHref: string;
  onNext: () => void;
  nextLabel: string;
}) {
  const [state, setState] = useState<ChatState>("loading");
  const [draft] = useState(() => drafts.get(sessionId, pageNo, branchKey));
  const [role, setRole] = useState(draft?.role ?? "");
  const [message, setMessage] = useState(draft?.message ?? "");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const submitting = useRef(false);
  const mounted = useRef(false);
  const requestVersion = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const refresh = useCallback(
    (signal?: AbortSignal): Promise<StoryChatView | undefined> => {
      if (submitting.current) return Promise.resolve(undefined);
      const version = ++requestVersion.current;
      return fetchStoryChat(sessionId, pageNo, branchKey, signal).then(
        (next): StoryChatView | undefined => {
          if (!mounted.current || signal?.aborted || version !== requestVersion.current) return;
          setState(next);
          setRole((current) =>
            next.characters.some((character) => character.role === current)
              ? current
              : (next.characters[0]?.role ?? ""),
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
          setState(cause instanceof ApiError && cause.isUnauthorized ? "login" : "error");
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

  const status = typeof state === "string" ? state : state.status;
  useEffect(() => {
    if (status !== "pending") return;
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
  }, [status, refresh]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || status !== "available") return;
    const parsed = storyChatInputSchema.safeParse({ role, message });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "질문을 확인해 주세요.");
      inputRef.current?.focus();
      return;
    }
    submitting.current = true;
    const version = ++requestVersion.current;
    setSending(true);
    setError("");
    try {
      const next = await sendStoryChat(sessionId, pageNo, branchKey, parsed.data);
      if (mounted.current && version === requestVersion.current) {
        setState(next);
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
    setRole(nextRole);
    setMessage(nextMessage);
    setError("");
    drafts.set(sessionId, pageNo, branchKey, { role: nextRole, message: nextMessage });
  }

  const characters = typeof state === "object" ? state.characters : [];
  const exchange = typeof state === "object" ? state.exchange : null;
  const selected = characters.find((character) => character.role === role);
  const busy = sending || status === "pending";
  const remaining = sending ? 0 : typeof state === "object" ? state.remainingMessages : null;

  return (
    <section
      aria-labelledby="character-chat-title"
      className="rounded-card border-2 border-primary bg-surface-raised p-5 shadow-sm md:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="character-chat-title"
          tabIndex={-1}
          className="scroll-mt-40 text-xl font-bold text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-strong sm:scroll-mt-24"
        >
          등장인물에게 물어봐요
        </h2>
        <p role="status" className="rounded-pill bg-primary-tint px-4 py-2 font-bold text-ink">
          {remaining === null
            ? "페이지마다 질문 1번"
            : remaining === 1 && characters.length === 0
              ? "이 장면은 읽어 볼까요?"
              : remaining === 1
                ? "질문 1번 남았어요"
                : "질문을 보냈어요"}
        </p>
      </div>
      <p id="chat-limit" className="mt-3 text-ink-muted">
        이 페이지에서 질문은 모두 합쳐 1번이에요. 대화는 이 책에 저장돼요.
      </p>

      {status === "login" ? (
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <p className="text-ink">로그인하면 등장인물과 이야기할 수 있어요.</p>
          <ActionLink href={loginHref} variant="primary" size="compact">
            로그인하기
          </ActionLink>
        </div>
      ) : status === "loading" ? (
        <p className="mt-5 text-ink-muted" role="status">
          대화 이용 상태를 확인하고 있어요.
        </p>
      ) : status === "error" || status === "unavailable" ? (
        <div className="mt-5">
          <p role="alert" className="text-ink">
            지금은 대화를 준비하지 못했어요. 잠시 후 다시 확인해 주세요.
          </p>
          <button
            type="button"
            onClick={() => {
              setState("loading");
              void refresh();
            }}
            className={actionClass("ghost", "mt-4", "compact")}
          >
            이용 상태 다시 확인
          </button>
        </div>
      ) : (
        <>
          {status === "available" && characters.length === 0 ? (
            <p className="mt-5 text-ink-muted">
              이 장면에는 대화할 등장인물이 없어요. 다음 장면으로 이야기를 이어 가요.
            </p>
          ) : null}
          {status === "available" && characters.length > 0 ? (
            <form
              method="post"
              onSubmit={submit}
              className="mt-5 flex flex-col gap-4"
              aria-busy={sending}
            >
              <fieldset disabled={sending}>
                <legend className="mb-3 font-bold text-ink">누구에게 물어볼까요?</legend>
                <div className="flex flex-wrap gap-3">
                  {characters.map((character) => (
                    <label
                      key={character.role}
                      className="flex min-h-touch cursor-pointer items-center gap-3 rounded-pill border-2 border-primary px-5 text-ink has-checked:border-primary-strong has-checked:bg-primary-tint has-focus-visible:ring-4 has-focus-visible:ring-magic-strong"
                    >
                      <input
                        type="radio"
                        name="character"
                        value={character.role}
                        checked={role === character.role}
                        onChange={() => updateDraft(character.role, message)}
                        className="size-5 accent-primary-strong"
                      />
                      <span className="font-bold break-keep wrap-anywhere">
                        {character.displayName}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {message.length === 0 ? (
                <div>
                  <p className="mb-2 text-sm text-ink-muted">
                    이렇게 물어볼까요? 고른 뒤 바꿔 써도 돼요.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["지금 어떤 기분이야?", "내가 도와줄까?"].map((question) => (
                      <button
                        key={question}
                        type="button"
                        disabled={sending}
                        className={actionClass("ghost", "", "compact")}
                        onClick={() => {
                          updateDraft(role, question);
                          inputRef.current?.focus();
                        }}
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div>
                <label htmlFor="character-question" className="mb-2 block font-bold text-ink">
                  {selected?.displayName}에게 궁금한 점
                </label>
                <textarea
                  ref={inputRef}
                  id="character-question"
                  rows={3}
                  value={message}
                  onChange={(event) => {
                    updateDraft(role, event.target.value);
                  }}
                  disabled={sending}
                  maxLength={STORY_CHAT_MAX_MESSAGE_LENGTH}
                  placeholder="궁금한 점을 적어 봐."
                  aria-invalid={Boolean(error)}
                  aria-describedby={`chat-limit chat-length chat-send-note${error ? " chat-input-error" : ""}`}
                  className="min-h-touch w-full resize-y rounded-2xl border-2 border-primary bg-white p-4 text-base text-ink placeholder:text-ink-muted focus:border-primary-strong focus:outline-none focus:ring-2 focus:ring-primary-strong disabled:opacity-60"
                />
                <p id="chat-length" className="mt-1 text-right text-sm text-ink-muted">
                  {message.length} / {STORY_CHAT_MAX_MESSAGE_LENGTH}자
                </p>
                {error ? (
                  <p
                    id="chat-input-error"
                    role="alert"
                    className="mt-2 font-bold text-accent-b-strong"
                  >
                    {error}
                  </p>
                ) : null}
              </div>
              <p id="chat-send-note" className="text-sm text-ink-muted">
                질문을 보내면 1회가 사용돼요. 답변을 받지 못해도 다시 질문할 수 없어요.
              </p>
              <button
                type="submit"
                disabled={sending}
                className={actionClass("primary", "self-start")}
              >
                {sending ? "답변을 기다리고 있어요…" : "질문 보내기"}
              </button>
            </form>
          ) : null}

          {exchange ? (
            <div className="mt-5 space-y-4 break-words" aria-live="polite">
              <div className="ml-auto max-w-2xl rounded-2xl bg-primary-tint p-4">
                <p className="mb-1 text-sm font-bold text-ink-muted">
                  내 질문 · {exchange.displayName}에게
                </p>
                <p className="whitespace-pre-wrap text-ink">{exchange.message}</p>
              </div>
              {exchange.reply ? (
                <div className="max-w-2xl rounded-2xl border-2 border-primary p-4">
                  <p className="mb-1 font-bold text-ink">{exchange.displayName}</p>
                  <p className="whitespace-pre-wrap text-ink">{exchange.reply}</p>
                </div>
              ) : null}
            </div>
          ) : null}
          {busy && !sending ? (
            <p role="status" className="mt-4 text-ink-muted">
              등장인물이 답변을 생각하고 있어요.
            </p>
          ) : null}
          {status === "completed" ? (
            <p className="mt-4 font-bold text-ink-muted">
              다음에 이 책을 열어도 우리 대화를 다시 볼 수 있어요.
            </p>
          ) : null}
          {status === "failed" ? (
            <p role="alert" className="mt-4 text-ink">
              답변이 도착하지 못했어요. 질문은 책에 남아 있지만 이 페이지에서 다시 보낼 수는 없어요.
              다음 장면으로 이야기를 이어 가요.
            </p>
          ) : null}
        </>
      )}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-sm text-ink-muted">대화하지 않고 다음 장면으로 가도 괜찮아요.</p>
        <button type="button" onClick={onNext} className={actionClass("accentA", "", "compact")}>
          {nextLabel}
        </button>
      </div>
    </section>
  );
}
