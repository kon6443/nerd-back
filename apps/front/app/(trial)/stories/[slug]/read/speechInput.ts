import { STORY_CHAT_MAX_MESSAGE_LENGTH } from "@nerd/contracts";

interface RecognitionResult {
  isFinal: boolean;
  readonly [index: number]: { transcript: string };
}

/** Web Speech API는 아직 TypeScript의 기본 DOM 타입에 포함되지 않는다. */
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};

export function getSpeechRecognition(): RecognitionConstructor | undefined {
  if (typeof window === "undefined" || !window.isSecureContext) return undefined;
  const browser = window as SpeechWindow;
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}

interface SpeechInputSnapshot {
  supported: boolean;
  phase: "idle" | "starting" | "listening" | "stopping";
  interim: string;
  notice: string;
}

const INITIAL_SNAPSHOT: SpeechInputSnapshot = {
  supported: false,
  phase: "idle",
  interim: "",
  notice: "",
};
const NO_SPEECH = "목소리가 들리지 않았어요. 마이크를 눌러 다시 말하거나 글로 적어 주세요.";

function errorNotice(error: string): string {
  switch (error) {
    case "not-allowed":
    case "service-not-allowed":
      return "마이크 또는 음성 인식 권한이 꺼져 있어요. 브라우저 설정에서 허용하거나 글로 적어 주세요.";
    case "audio-capture":
      return "마이크를 사용할 수 없어요. 연결 상태와 다른 앱의 마이크 사용을 확인해 주세요.";
    case "network":
      return "음성 인식에 연결하지 못했어요. 인터넷 연결을 확인하거나 글로 적어 주세요.";
    case "no-speech":
      return NO_SPEECH;
    case "language-not-supported":
      return "이 브라우저에서는 한국어 음성 인식을 사용할 수 없어요. 글로 적어 주세요.";
    default:
      return "음성 입력이 멈췄어요. 마이크를 다시 누르거나 글로 적어 주세요.";
  }
}

export class SpeechInputController {
  private snapshot: SpeechInputSnapshot;
  private readonly listeners = new Set<() => void>();
  private recognition: SpeechRecognitionLike | null = null;

  constructor(private readonly Recognition: RecognitionConstructor | undefined) {
    this.snapshot = { ...INITIAL_SNAPSHOT, supported: Boolean(Recognition) };
  }

  get supported() {
    return this.snapshot.supported;
  }
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => INITIAL_SNAPSHOT;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private update(snapshot: Omit<SpeechInputSnapshot, "supported">) {
    this.snapshot = { ...snapshot, supported: this.supported };
    this.listeners.forEach((listener) => listener());
  }

  private release(abort: boolean) {
    const recognition = this.recognition;
    this.recognition = null;
    if (!recognition) return;
    recognition.onstart = null;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    // 브라우저가 종료 이벤트를 동기적으로 보내도 이전 초안을 변경하지 못한다.
    if (abort) {
      try {
        recognition.abort();
      } catch {
        // 이미 종료된 인식기는 정리되어 있다.
      }
    }
  }

  private finish(notice: string, abort = true) {
    this.release(abort);
    this.update({ ...INITIAL_SNAPSHOT, notice });
  }

  start(initialMessage: string, onMessage: (message: string) => void) {
    if (!this.Recognition || this.recognition) return;
    if (initialMessage.length >= STORY_CHAT_MAX_MESSAGE_LENGTH) {
      this.update({ ...INITIAL_SNAPSHOT, notice: "질문은 300자까지예요. 조금 줄인 뒤 말해 주세요." });
      return;
    }
    this.update({ ...INITIAL_SNAPSHOT, phase: "starting" });
    try {
      const recognition = new this.Recognition();
      this.recognition = recognition;
      recognition.lang = "ko-KR";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      let receivedFinal = false;
      recognition.onstart = () => {
        if (this.recognition !== recognition) return;
        this.update({ ...this.snapshot, phase: "listening" });
      };
      recognition.onresult = ({ results }) => {
        if (this.recognition !== recognition) return;
        const final: string[] = [];
        const interim: string[] = [];
        for (let i = 0; i < results.length; i += 1) {
          const result = results[i];
          const transcript = result[0]?.transcript.trim();
          if (transcript) (result.isFinal ? final : interim).push(transcript);
        }
        // results는 누적 목록이다. 시작 시의 초안에 합쳐 중복 삽입을 막는다.
        if (final.length > 0) {
          receivedFinal = true;
          const separator = initialMessage && !/\s$/.test(initialMessage) ? " " : "";
          const message = `${initialMessage}${separator}${final.join(" ")}`;
          onMessage(message.slice(0, STORY_CHAT_MAX_MESSAGE_LENGTH).replace(/[\uD800-\uDBFF]$/, ""));
          if (message.length >= STORY_CHAT_MAX_MESSAGE_LENGTH) {
            this.finish("질문은 300자까지 담았어요. 내용을 확인해 주세요.");
            return;
          }
        }
        this.update({ ...this.snapshot, interim: interim.join(" ").slice(0, STORY_CHAT_MAX_MESSAGE_LENGTH) });
      };
      recognition.onerror = ({ error }) => {
        if (this.recognition !== recognition) return;
        this.finish(errorNotice(error));
      };
      recognition.onend = () => {
        if (this.recognition !== recognition) return;
        this.finish(receivedFinal ? "말한 내용을 확인하고 질문을 보내 주세요." : NO_SPEECH, false);
      };
      recognition.start();
    } catch (cause) {
      const error = cause instanceof Error && cause.name === "NotAllowedError"
        ? "not-allowed"
        : "start-failed";
      this.finish(errorNotice(error));
    }
  }

  stop() {
    if (!this.recognition) return;
    // 권한 대기 중이거나 결과를 마무리하는 중이면 취소할 수 있다.
    if (this.snapshot.phase !== "listening") {
      this.cancel();
      return;
    }
    this.update({ ...this.snapshot, phase: "stopping" });
    try {
      this.recognition.stop();
    } catch {
      this.finish(errorNotice("stop-failed"));
    }
  }

  cancel = () => {
    this.finish("");
  };
}
