/**
 * 리더의 **보기 옵션** — 2026-09-21 에 조합이 확정되어 고정값이 되었다.
 *
 * 대화는 **시트**(모바일 아래 · 넓은 화면 오른쪽), 화면은 **몰입 끔**(전역 헤더를 그대로 둔다).
 * 원래는 여러 안을 주소(`?chat=`·`?immersive=`)로 바꿔 보는 한시적 장치였고, 고르는 화면
 * (`ReaderPreviewSettings`)과 주소 해석은 선택이 끝나면서 화면에서 내렸다.
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

/** 리더가 실제로 쓰는 값. 주소로도 바꾸지 않는다. */
export const FIXED_READER_OPTIONS: ReaderOptions = { chat: "sheet", immersive: false };

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
