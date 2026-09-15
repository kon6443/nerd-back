"use client";

import type { RefObject } from "react";
import { actionClass } from "@/components/ui/actionStyles";
import type { CharacterChatController } from "./useCharacterChat";

/**
 * 대화를 여는 플로팅 버튼.
 *
 * ⭐ **아이콘만 두지 않는다.** 말풍선 하나로는 "여기서 무엇이 열리는지" 가 전달되지 않는다 —
 * 라벨을 함께 둔 확장형이 이해도가 높고, 스크린리더에도 같은 문구가 그대로 간다.
 *
 * ⭐ **라벨이 곧 상태 표시다.** 시트를 닫아도 답변은 계속 도착하므로(`useCharacterChat`),
 * 사용자가 닫아 둔 동안 무슨 일이 일어나는지 알려 줄 곳이 여기뿐이다. 문구 변화는
 * `aria-live` 로 읽힌다 — 🚫 색 점만으로 알리지 않는다.
 *
 * ⭐ **위계는 secondary(`dark`)다.** 하단바 오른쪽 끝의 「다음」이 primary 이고, 대화는 그 옆의 도구다.
 * 흰 바 위에서 흰 버튼은 묻혀서 초록빛 검정을 쓴다(2026-09-14 버튼 위계 결정 — `actionStyles.ts`).
 *
 * ⚠️ **자기 위치를 정하지 않는다.** 화면 어디에 놓일지는 리더의 하단 바가 소유한다 — 여기서
 * `fixed` 를 쓰면 나란히 놓인 「보기 설정」과 좌표를 각자 관리하게 되고, 안전영역·겹침 계산이 두 벌이 된다.
 * 조작줄과의 겹침 방지도 리더 컨테이너의 아래 여백이 맡는다(버튼 높이를 여기서 알 수 없다).
 */
function launcherLabel(chat: CharacterChatController): string {
  if (chat.status === "login") return "로그인하고 대화하기";
  if (chat.busy) return "답변을 기다리는 중…";
  if (chat.status === "completed") return "나눈 이야기 보기";
  if (chat.status === "failed") return "대화 보기";
  if (chat.status === "available" && chat.characters.length === 0) return "이 장면의 등장인물";
  return "등장인물에게 물어보기";
}

/** 눈에 띄는 점을 붙일 때 — **아직 물어볼 수 있거나**, 답변을 기다리는 중. */
function hasNudge(chat: CharacterChatController): boolean {
  if (chat.busy) return true;
  return chat.status === "available" && chat.characters.length > 0 && chat.remainingMessages === 1;
}

export function ChatLauncher({
  chat,
  onOpen,
  buttonRef,
  disabled = false,
}: {
  chat: CharacterChatController;
  onOpen: () => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
  /**
   * 넘김이 도는 동안 `dock` 을 열지 못하게 막는다 — 여는 순간 책 폭이 변해 넘어가던 종이가 튄다.
   * 🚫 조용히 무시하지 않는다. 눌렀는데 아무 일도 없으면 고장으로 읽힌다.
   */
  disabled?: boolean;
}) {
  const nudge = hasNudge(chat);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onOpen}
      disabled={disabled}
      className={actionClass("dark", "gap-2 px-4 md:px-6", "compact")}
    >
      <svg viewBox="0 0 24 24" className="size-6 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-5.5A8 8 0 0 1 11 4h2a8 8 0 0 1 8 8z" strokeLinejoin="round" />
      </svg>
      {/* 좁은 화면에서는 말풍선만 남긴다 — 바 한 줄에 「이전」·「다음」과 함께 서야 한다. 문구는 읽힌다. */}
      <span aria-live="polite" className="sr-only md:not-sr-only">
        {launcherLabel(chat)}
      </span>
      {nudge ? (
        <span
          aria-hidden="true"
          className={`size-2.5 shrink-0 rounded-full bg-gold ${chat.busy ? "animate-pulse motion-reduce:animate-none" : ""}`}
        />
      ) : null}
    </button>
  );
}
