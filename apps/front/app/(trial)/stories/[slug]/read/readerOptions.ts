/**
 * 리더의 **보기 옵션** — 디자인 후보를 주소로 고른다 (순수 로직, 테스트 대상).
 *
 * ⏳ **한시적이다.** 2026-09-14 에 "여러 안을 실제로 써 보고 고르겠다"는 요청으로 들어왔다.
 * 조합이 정해지면 이 파일과 `ReaderPreviewSettings` 를 지우고 선택값을 상수로 굳힌다
 * (`docs/tasks/tasks-my-story.md` Slice 7 회수 조건).
 *
 * ⭐ **저장소가 아니라 주소에 둔다.** `localStorage` 에 두면 값을 읽는 순간 첫 렌더가 한 번 바뀌어
 * 깜빡인다 — 이 저장소가 반복해서 잡아 온 문제다(`AppHeader` 의 `data-session`). 주소는 첫 렌더부터
 * 값이 확정되고, 링크로 다른 사람에게 그대로 보여 줄 수도 있다.
 */

/** 대화를 담는 껍데기. 내용(`CharacterChat`)은 셋이 공유한다. */
export const CHAT_SURFACES = ["sheet", "modal", "dock"] as const;
export type ChatSurfaceKind = (typeof CHAT_SURFACES)[number];

export const CHAT_SURFACE_LABEL: Record<ChatSurfaceKind, string> = {
  sheet: "시트 (모바일 아래 · 넓은 화면 오른쪽)",
  modal: "가운데 모달",
  dock: "옆에 붙이기 (넓은 화면에서 책이 좁아짐)",
};

export interface ReaderOptions {
  chat: ChatSurfaceKind;
  /** 전역 헤더를 숨기고 책이 화면 높이를 채운다. */
  immersive: boolean;
}

export const DEFAULT_READER_OPTIONS: ReaderOptions = { chat: "sheet", immersive: true };

export const CHAT_PARAM = "chat";
export const IMMERSIVE_PARAM = "immersive";

/** `URLSearchParams` 와 Next 의 `ReadonlyURLSearchParams` 를 모두 받기 위한 최소 형태. */
interface ReadonlyParams {
  get(name: string): string | null;
}

function isChatSurface(value: string | null): value is ChatSurfaceKind {
  return CHAT_SURFACES.includes(value as ChatSurfaceKind);
}

/** 🚫 잘못된 값에 화면을 맡기지 않는다 — 알 수 없는 값은 조용히 기본값으로 떨어뜨린다. */
export function parseReaderOptions(params: ReadonlyParams): ReaderOptions {
  const chat = params.get(CHAT_PARAM);
  return {
    chat: isChatSurface(chat) ? chat : DEFAULT_READER_OPTIONS.chat,
    immersive: params.get(IMMERSIVE_PARAM) === "off" ? false : DEFAULT_READER_OPTIONS.immersive,
  };
}

/**
 * 현재 쿼리에서 **보기 옵션만** 갈아 끼운 새 쿼리를 만든다.
 * ⚠️ `sessionId` 처럼 화면이 살아가는 데 필요한 값이 함께 들어 있다 — 통째로 새로 쓰지 않는다.
 */
export function withReaderOptions(search: string, patch: Partial<ReaderOptions>): string {
  const params = new URLSearchParams(search);
  if (patch.chat !== undefined) params.set(CHAT_PARAM, patch.chat);
  if (patch.immersive !== undefined) params.set(IMMERSIVE_PARAM, patch.immersive ? "on" : "off");
  return params.toString();
}
