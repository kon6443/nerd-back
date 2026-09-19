import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSpeechRecognition, SpeechInputController, type SpeechRecognitionLike } from "./speechInput";

class Recognition implements SpeechRecognitionLike {
  static latest: Recognition;
  lang = "";
  continuous = true;
  interimResults = false;
  maxAlternatives = 0;
  onstart: SpeechRecognitionLike["onstart"] = null;
  onresult: SpeechRecognitionLike["onresult"] = null;
  onerror: SpeechRecognitionLike["onerror"] = null;
  onend: SpeechRecognitionLike["onend"] = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  constructor() { Recognition.latest = this; }
  result(parts: Array<[string, boolean]>) {
    this.onresult?.({ results: parts.map(([transcript, isFinal]) => ({ 0: { transcript }, isFinal })) });
  }
}

describe("캐릭터 질문 음성 입력", () => {
  let controller: SpeechInputController;
  let onMessage: ReturnType<typeof vi.fn<(message: string) => void>>;
  beforeEach(() => {
    controller = new SpeechInputController(Recognition);
    onMessage = vi.fn();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("서버 초기 상태는 미지원으로 고정하고 클라이언트 지원 여부는 종료 후에도 보존한다", () => {
    const serverSnapshot = controller.getServerSnapshot();
    const notify = vi.fn();
    const unsubscribe = controller.subscribe(notify);
    expect(serverSnapshot.supported).toBe(false);
    expect(controller.getSnapshot().supported).toBe(true);
    controller.start("", onMessage);
    Recognition.latest.onstart?.();
    controller.cancel();
    expect(controller.getSnapshot()).toMatchObject({ supported: true, phase: "idle" });
    expect(controller.getServerSnapshot()).toBe(serverSnapshot);
    expect(notify).toHaveBeenCalledTimes(3);
    unsubscribe();
    controller.start("", onMessage);
    Recognition.latest.onerror?.({ error: "network" });
    expect(controller.getSnapshot().supported).toBe(true);
    expect(notify).toHaveBeenCalledTimes(3);
  });

  it("표준/접두사 API를 감지하고 insecure/미지원 환경에서는 시작하지 않는다", () => {
    vi.stubGlobal("window", { isSecureContext: true, SpeechRecognition: Recognition });
    expect(getSpeechRecognition()).toBe(Recognition);
    vi.stubGlobal("window", { isSecureContext: true, webkitSpeechRecognition: Recognition });
    expect(getSpeechRecognition()).toBe(Recognition);
    vi.stubGlobal("window", { isSecureContext: false, SpeechRecognition: Recognition });
    expect(getSpeechRecognition()).toBeUndefined();
    vi.stubGlobal("window", { isSecureContext: true });
    expect(getSpeechRecognition()).toBeUndefined();
    const unsupported = new SpeechInputController(undefined);
    unsupported.start("기존 질문", onMessage);
    expect(unsupported.supported).toBe(false);
    expect(unsupported.getSnapshot().phase).toBe("idle");
    expect(onMessage).not.toHaveBeenCalled();
  });

  it("한국어 단발 인식이며 사용자가 시작하기 전에는 마이크를 생성하지 않는다", () => {
    const factory = vi.fn(function () { return new Recognition(); });
    const input = new SpeechInputController(factory);
    expect(factory).not.toHaveBeenCalled();
    input.start("", onMessage);
    expect(Recognition.latest).toMatchObject({ lang: "ko-KR", continuous: false, interimResults: true, maxAlternatives: 1 });
    input.start("", onMessage);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(input.getSnapshot().phase).toBe("starting");
    Recognition.latest.onstart?.();
    expect(input.getSnapshot().phase).toBe("listening");
  });

  it("중간 결과는 별도 표시하고 누적 확정 결과를 기존 초안에 중복 없이 붙인다", () => {
    controller.start("안녕!", onMessage);
    const recognition = Recognition.latest;
    recognition.onstart?.();
    recognition.result([["어떤 기분", false]]);
    expect(onMessage).not.toHaveBeenCalled();
    expect(controller.getSnapshot().interim).toBe("어떤 기분");
    recognition.result([["어떤 기분이야?", true], ["내가", false]]);
    expect(onMessage).toHaveBeenLastCalledWith("안녕! 어떤 기분이야?");
    recognition.result([["어떤 기분이야?", true], ["내가 도와줄까?", true]]);
    expect(onMessage).toHaveBeenLastCalledWith("안녕! 어떤 기분이야? 내가 도와줄까?");
    recognition.onend?.();
    expect(controller.getSnapshot()).toMatchObject({ phase: "idle", interim: "" });
    expect(controller.getSnapshot().notice).toContain("확인");
    expect(recognition.onresult).toBeNull();
  });

  it("300자 초과는 안내와 함께 제한하고 인식을 종료한다", () => {
    controller.start("가".repeat(290), onMessage);
    Recognition.latest.result([["나".repeat(30), true]]);
    expect(onMessage.mock.lastCall?.[0]).toHaveLength(300);
    expect(Recognition.latest.abort).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().notice).toContain("300자");
    onMessage.mockClear();
    controller.start("가".repeat(300), onMessage);
    expect(controller.getSnapshot().phase).toBe("idle");
    expect(onMessage).not.toHaveBeenCalled();
  });

  it("확정되지 않은 말로 초안을 바꾸지 않고 무음을 안내한다", () => {
    controller.start("기존 질문", onMessage);
    Recognition.latest.result([["임시", false]]);
    Recognition.latest.onend?.();
    expect(controller.getSnapshot().notice).toContain("목소리가 들리지");
    expect(onMessage).not.toHaveBeenCalled();
  });

  it.each([
    ["not-allowed", "권한"], ["service-not-allowed", "권한"],
    ["audio-capture", "마이크"], ["network", "인터넷"],
    ["no-speech", "목소리"], ["language-not-supported", "한국어"], ["aborted", "멈췄어요"],
  ])("%s 오류 후 초안을 보존하고 키보드 입력 상태로 복귀한다", (error, notice) => {
    controller.start("기존 질문", onMessage);
    Recognition.latest.onerror?.({ error });
    expect(controller.getSnapshot()).toMatchObject({ phase: "idle", interim: "" });
    expect(controller.getSnapshot().notice).toContain(notice);
    expect(onMessage).not.toHaveBeenCalled();
    expect(Recognition.latest.abort).toHaveBeenCalledOnce();
  });

  it("말하기 끝내기는 마지막 확정 결과까지 기다리며 다시 누르면 취소한다", () => {
    controller.start("", onMessage);
    Recognition.latest.onstart?.();
    controller.stop();
    expect(Recognition.latest.stop).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().phase).toBe("stopping");
    Recognition.latest.result([["마지막 질문", true]]);
    expect(onMessage).toHaveBeenLastCalledWith("마지막 질문");
    controller.stop();
    expect(Recognition.latest.abort).toHaveBeenCalledOnce();
    expect(controller.getSnapshot().phase).toBe("idle");
  });

  it("권한 대기 취소 및 취소 후 재시작에서 이전 이벤트가 새 초안을 건드리지 않는다", () => {
    controller.start("첫 장면", onMessage);
    const previous = Recognition.latest;
    const lateResult = previous.onresult;
    const lateStart = previous.onstart;
    const lateEnd = previous.onend;
    controller.stop();
    expect(previous.abort).toHaveBeenCalledOnce();
    expect(previous.stop).not.toHaveBeenCalled();
    controller.start("새 장면", onMessage);
    lateStart?.();
    lateResult?.({ results: [{ 0: { transcript: "이전 질문" }, isFinal: true }] });
    lateEnd?.();
    expect(onMessage).not.toHaveBeenCalled();
    expect(controller.getSnapshot().phase).toBe("starting");
    Recognition.latest.result([["안녕", true]]);
    expect(onMessage).toHaveBeenLastCalledWith("새 장면 안녕");
    controller.cancel();
    expect(Recognition.latest.onresult).toBeNull();
  });

  it("동기적 start/stop 실패에도 마이크와 상태를 정리한다", () => {
    class BrokenStart extends Recognition {
      start = vi.fn(() => { throw new DOMException("denied", "NotAllowedError"); });
    }
    const input = new SpeechInputController(BrokenStart);
    input.start("", onMessage);
    expect(input.getSnapshot().notice).toContain("권한");
    expect(Recognition.latest.abort).toHaveBeenCalledOnce();
    controller.start("", onMessage);
    Recognition.latest.onstart?.();
    Recognition.latest.stop.mockImplementation(() => { throw new Error("ended"); });
    controller.stop();
    expect(controller.getSnapshot().phase).toBe("idle");
    expect(Recognition.latest.abort).toHaveBeenCalledOnce();
  });
});
