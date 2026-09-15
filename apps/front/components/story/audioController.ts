export type ReaderAudioKind = "narration" | "character";
export type ReaderAudioStatus = "idle" | "loading" | "playing" | "paused" | "ended" | "error";

export interface ReaderAudioSnapshot {
  kind: ReaderAudioKind | null;
  url: string | null;
  status: ReaderAudioStatus;
  currentTime: number;
  duration: number;
}

export interface AudioElementLike {
  src: string;
  preload: string;
  currentTime: number;
  readonly duration: number;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

const INITIAL_SNAPSHOT: ReaderAudioSnapshot = {
  kind: null,
  url: null,
  status: "idle",
  currentTime: 0,
  duration: 0,
};

/** 리더 안의 내레이션과 캐릭터 답변이 공유하는 유일한 실제 오디오 재생기. */
export class ReaderAudioController {
  private snapshot: ReaderAudioSnapshot = INITIAL_SNAPSHOT;
  private readonly listeners = new Set<() => void>();
  private playVersion = 0;
  private readonly eventHandlers: Record<string, () => void>;

  constructor(private readonly audio: AudioElementLike) {
    audio.preload = "metadata";
    this.eventHandlers = {
      play: () => this.updateFromAudio("playing"),
      playing: () => this.updateFromAudio("playing"),
      pause: () => {
        if (this.snapshot.status !== "idle" && this.snapshot.status !== "ended") {
          this.updateFromAudio("paused");
        }
      },
      timeupdate: () => this.updateFromAudio(this.snapshot.status),
      durationchange: () => this.updateFromAudio(this.snapshot.status),
      loadedmetadata: () => this.updateFromAudio(this.snapshot.status),
      canplay: () => this.updateFromAudio(this.snapshot.status),
      seeking: () => this.updateFromAudio(this.snapshot.status),
      seeked: () => this.updateFromAudio(this.snapshot.status),
      ended: () => this.updateFromAudio("ended"),
      error: () => this.updateFromAudio("error"),
    };
    this.attach();
  }

  private attached = false;

  attach(): void {
    if (this.attached) return;
    for (const [event, handler] of Object.entries(this.eventHandlers)) {
      this.audio.addEventListener(event, handler);
    }
    this.attached = true;
  }

  detach(): void {
    if (!this.attached) return;
    for (const [event, handler] of Object.entries(this.eventHandlers)) {
      this.audio.removeEventListener(event, handler);
    }
    this.attached = false;
  }

  getSnapshot = (): ReaderAudioSnapshot => this.snapshot;
  getServerSnapshot = (): ReaderAudioSnapshot => INITIAL_SNAPSHOT;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async play(url: string, kind: ReaderAudioKind, restart = false): Promise<boolean> {
    this.attach();
    const version = ++this.playVersion;
    const changed = this.snapshot.url !== url;
    if (changed) {
      this.audio.pause();
      this.audio.src = url;
      this.audio.load();
    }
    if (restart) this.audio.currentTime = 0;
    this.update({
      kind,
      url,
      status: "loading",
      currentTime: this.audio.currentTime,
      duration: Number.isFinite(this.audio.duration) ? this.audio.duration : 0,
    });
    try {
      await this.audio.play();
      if (version === this.playVersion) this.updateFromAudio("playing");
      return true;
    } catch {
      if (version === this.playVersion) this.updateFromAudio("error");
      return false;
    }
  }

  pause(): void {
    this.playVersion += 1;
    this.audio.pause();
    if (this.snapshot.status !== "idle") this.updateFromAudio("paused");
  }

  stop(): void {
    this.pause();
    this.audio.currentTime = 0;
    this.update(INITIAL_SNAPSHOT);
  }

  destroy(): void {
    this.stop();
    this.detach();
    this.listeners.clear();
  }

  private updateFromAudio(status: ReaderAudioStatus): void {
    this.update({
      ...this.snapshot,
      status,
      currentTime: this.audio.currentTime,
      duration: Number.isFinite(this.audio.duration) ? this.audio.duration : 0,
    });
  }

  private update(next: ReaderAudioSnapshot): void {
    this.snapshot = next;
    this.listeners.forEach((listener) => listener());
  }
}

export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const wholeSeconds = Math.floor(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}
