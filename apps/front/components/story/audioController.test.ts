import { describe, expect, it, vi } from "vitest";
import {
  formatAudioTime,
  ReaderAudioController,
  type AudioElementLike,
} from "./audioController";

function createAudio() {
  const listeners = new Map<string, Set<() => void>>();
  const audio: AudioElementLike = {
    src: "",
    preload: "",
    currentTime: 0,
    duration: 12,
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    load: vi.fn(),
    addEventListener: vi.fn((event, listener) => {
      const bucket = listeners.get(event) ?? new Set();
      bucket.add(listener);
      listeners.set(event, bucket);
    }),
    removeEventListener: vi.fn(),
  };
  return { audio, emit: (event: string) => listeners.get(event)?.forEach((listener) => listener()) };
}

describe("ReaderAudioController", () => {
  it("내레이션에서 캐릭터 답변으로 바꾸면 같은 오디오에서 기존 재생을 멈춘다", async () => {
    const { audio } = createAudio();
    const controller = new ReaderAudioController(audio);

    await controller.play("narration.mp3", "narration");
    await controller.play("reply.mp3", "character");

    expect(audio.pause).toHaveBeenCalledTimes(2);
    expect(audio.load).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot()).toMatchObject({
      kind: "character",
      url: "reply.mp3",
      status: "playing",
    });
  });

  it("재생 거절을 오류 상태로 바꾸고 호출자에게 false를 돌려준다", async () => {
    const { audio } = createAudio();
    vi.mocked(audio.play).mockRejectedValueOnce(new Error("autoplay blocked"));
    const controller = new ReaderAudioController(audio);

    await expect(controller.play("narration.mp3", "narration")).resolves.toBe(false);
    expect(controller.getSnapshot().status).toBe("error");
  });

  it("시간을 분:초로 표시한다", () => {
    expect(formatAudioTime(0)).toBe("0:00");
    expect(formatAudioTime(65.9)).toBe("1:05");
    expect(formatAudioTime(Number.NaN)).toBe("0:00");
  });
});
