import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { CharacterChat } from "./CharacterChat";
import type { CharacterChatController } from "./useCharacterChat";
import { useSpeechInput } from "./useSpeechInput";
import type { SpeechInputController } from "./speechInput";

vi.mock("./useSpeechInput", () => ({
  useSpeechInput: vi.fn(),
}));

const dummyChat: CharacterChatController = {
  status: "available",
  characters: [{ role: "jack", displayName: "잭" }],
  exchange: null,
  selected: { role: "jack", displayName: "잭" },
  remainingMessages: 1,
  role: "jack",
  message: "기존 질문",
  error: "",
  sending: false,
  busy: false,
  inputRef: { current: null },
  submit: vi.fn(),
  selectRole: vi.fn(),
  updateDraft: vi.fn(),
  recheck: vi.fn(),
  retryAudio: vi.fn(),
  retryingAudio: false,
  autoPlayReply: false,
  markReplyPlayed: vi.fn(),
};

describe("CharacterChat 실시간 음성 입력 UI", () => {
  it("음성 인식 중 실시간 변환 내용(interim)이 textarea에 표시되고 별도 표시창은 렌더링되지 않는다", () => {
    vi.mocked(useSpeechInput).mockReturnValue({
      controller: {
        start: vi.fn(),
        stop: vi.fn(),
        cancel: vi.fn(),
      } as unknown as SpeechInputController,
      supported: true,
      phase: "listening",
      interim: "어디 가니?",
      notice: "",
      active: true,
    });

    const html = renderToString(
      <CharacterChat
        chat={dummyChat}
        loginHref="/login"
        onInteraction={() => {}}
        active={true}
      />,
    );

    // textarea에 기존 질문과 결합된 실시간 텍스트가 표시됨
    expect(html).toContain("기존 질문 어디 가니?");
    // textarea는 음성 인식 중 readOnly 상태
    expect(html).toContain('readOnly=""');
    // 글자 수 카운터에 실시간 변환 텍스트 길이가 반영됨 ("기존 질문 어디 가니?".length === 12)
    expect(html).toContain("12<!-- --> / <!-- -->300<!-- -->자");
    // 별도의 '듣는 중:' 영역은 렌더링되지 않음
    expect(html).not.toContain("듣는 중:");
  });

  it("음성 인식이 비활성(idle)일 때는 기존 message가 그대로 textarea에 표시된다", () => {
    vi.mocked(useSpeechInput).mockReturnValue({
      controller: {
        start: vi.fn(),
        stop: vi.fn(),
        cancel: vi.fn(),
      } as unknown as SpeechInputController,
      supported: true,
      phase: "idle",
      interim: "",
      notice: "",
      active: false,
    });

    const html = renderToString(
      <CharacterChat
        chat={dummyChat}
        loginHref="/login"
        onInteraction={() => {}}
        active={true}
      />,
    );

    expect(html).toContain("기존 질문");
    expect(html).not.toContain("readonly");
    expect(html).toContain("5<!-- --> / <!-- -->300<!-- -->자");
    expect(html).not.toContain("듣는 중:");
  });
});
