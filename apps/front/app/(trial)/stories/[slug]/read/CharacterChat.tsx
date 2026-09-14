"use client";

import { STORY_CHAT_MAX_MESSAGE_LENGTH } from "@nerd/contracts";
import { ActionLink } from "@/components/ui/ActionLink";
import { actionClass } from "@/components/ui/actionStyles";

import type { CharacterChatController } from "./useCharacterChat";

/**
 * 등장인물 대화의 **내용물**. 상태는 `useCharacterChat` 이, 껍데기(시트·모달·dock)는 `ChatSurface` 가 갖는다.
 *
 * ⭐ **여기에 테두리·제목·바깥 여백을 두지 않는다.** 세 껍데기가 같은 내용을 담아야 하는데, 내용이
 * 자기 테두리를 그리면 껍데기마다 이중 테두리가 생기거나 한쪽만 어긋난다.
 *
 * 🚫 「다음 페이지」 버튼을 여기 두지 않는다. 쪽 이동은 책 하단 조작줄이 **단독으로** 소유한다 —
 * 두 곳에 두면 대화를 닫은 사람과 연 사람이 서로 다른 버튼을 누르게 되고 라벨이 갈린다.
 */
export function CharacterChat({
  chat,
  loginHref,
}: {
  chat: CharacterChatController;
  loginHref: string;
}) {
  const {
    status,
    characters,
    exchange,
    selected,
    remainingMessages,
    role,
    message,
    error,
    sending,
    busy,
    inputRef,
    submit,
    updateDraft,
    recheck,
  } = chat;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id="chat-limit" className="text-ink-muted">
          이 페이지에서 질문은 모두 합쳐 1번이에요. 대화는 이 책에 저장돼요.
        </p>
        <p role="status" className="rounded-pill bg-primary-tint px-4 py-2 font-bold text-ink">
          {remainingMessages === null
            ? "페이지마다 질문 1번"
            : remainingMessages === 1 && characters.length === 0
              ? "이 장면은 읽어 볼까요?"
              : remainingMessages === 1
                ? "질문 1번 남았어요"
                : "질문을 보냈어요"}
        </p>
      </div>

      {status === "login" ? (
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-ink">로그인하면 등장인물과 이야기할 수 있어요.</p>
          <ActionLink href={loginHref} variant="primary" size="compact">
            로그인하기
          </ActionLink>
        </div>
      ) : status === "loading" ? (
        <p className="text-ink-muted" role="status">
          대화 이용 상태를 확인하고 있어요.
        </p>
      ) : status === "error" || status === "unavailable" ? (
        <div>
          <p role="alert" className="text-ink">
            지금은 대화를 준비하지 못했어요. 잠시 후 다시 확인해 주세요.
          </p>
          <button type="button" onClick={recheck} className={actionClass("secondary", "mt-4", "compact")}>
            이용 상태 다시 확인
          </button>
        </div>
      ) : (
        <>
          {status === "available" && characters.length === 0 ? (
            <p className="text-ink-muted">
              이 장면에는 대화할 등장인물이 없어요. 다음 장면으로 이야기를 이어 가요.
            </p>
          ) : null}
          {status === "available" && characters.length > 0 ? (
            <form
              method="post"
              onSubmit={submit}
              className="flex flex-col gap-4"
              aria-busy={sending}
            >
              <fieldset disabled={sending}>
                <legend className="mb-3 font-bold text-ink">누구에게 물어볼까요?</legend>
                <div className="flex flex-wrap gap-3">
                  {characters.map((character) => (
                    <label
                      key={character.role}
                      className="flex min-h-touch cursor-pointer items-center gap-3 rounded-pill border-2 border-line px-5 text-ink has-checked:border-accent-a has-checked:bg-accent-a-soft has-focus-visible:ring-4 has-focus-visible:ring-magic-strong"
                    >
                      <input
                        type="radio"
                        name="character"
                        value={character.role}
                        checked={role === character.role}
                        onChange={() => updateDraft(character.role, message)}
                        className="size-5 accent-accent-a"
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
                        className={actionClass("secondary", "", "compact")}
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
              <button type="submit" disabled={sending} className={actionClass("primary", "self-start")}>
                {sending ? "답변을 기다리고 있어요…" : "질문 보내기"}
              </button>
            </form>
          ) : null}

          {exchange ? (
            <div className="space-y-4 break-words" aria-live="polite">
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
            <p role="status" className="text-ink-muted">
              등장인물이 답변을 생각하고 있어요.
            </p>
          ) : null}
          {status === "completed" ? (
            <p className="font-bold text-ink-muted">
              다음에 이 책을 열어도 우리 대화를 다시 볼 수 있어요.
            </p>
          ) : null}
          {status === "failed" ? (
            <p role="alert" className="text-ink">
              답변이 도착하지 못했어요. 질문은 책에 남아 있지만 이 페이지에서 다시 보낼 수는 없어요.
              다음 장면으로 이야기를 이어 가요.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
