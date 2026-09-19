import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { preconnect } from "react-dom";
import { createImagePreloader } from "./imagePreloader";

vi.mock("react-dom", () => ({ preconnect: vi.fn() }));

class TestImage {
  src = "";
  decoding = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decode = vi.fn(() => Promise.resolve());
}

describe("reader image preloader", () => {
  let images: TestImage[];
  let preloader: ReturnType<typeof createImagePreloader>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(preconnect).mockClear();
    images = [];
    vi.stubGlobal("Image", function () {
      const image = new TestImage();
      images.push(image);
      return image;
    });
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    preloader = createImagePreloader();
  });

  afterEach(() => {
    preloader.clear();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shares pending and completed requests and skips empty URLs", async () => {
    const first = preloader.preload([null, undefined, "", "/one.webp"]);
    const second = preloader.preload(["/one.webp"]);
    expect(images).toHaveLength(1);
    images[0].onload?.();
    await Promise.all([first, second, preloader.preload(["/one.webp"])]);
    expect(images).toHaveLength(1);
    expect(images[0].onload).toBeNull();
    expect(images[0].onerror).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("connects each HTTP origin once and does not preconnect relative/data URLs", async () => {
    const loaded = preloader.preload(["https://art.local/1.webp", "https://art.local/2.webp", "/3.webp", "data:image/gif;base64,test"]);
    expect(preconnect).toHaveBeenCalledTimes(1);
    expect(preconnect).toHaveBeenCalledWith("https://art.local");
    preloader.clear();
    await loaded;
  });

  it("cancels pending requests and timers while retaining completed image sources", async () => {
    const complete = preloader.preload(["/complete.webp"]);
    images[0].onload?.();
    await complete;
    const pending = preloader.preload(["/pending.webp"]);
    preloader.clear();
    await pending;
    expect(images[0].src).toBe("/complete.webp");
    expect(images[1].src).toMatch(/^data:image\/gif;base64,/);
    expect(images[1].onload).toBeNull();
    expect(images[1].onerror).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("allows effect replay after clearing and ignores a previous decode completion", async () => {
    let finishDecode!: () => void;
    const first = preloader.preload(["/one.webp"]);
    images[0].decode.mockReturnValue(new Promise<void>(resolve => { finishDecode = resolve; }));
    images[0].onload?.();
    preloader.clear();
    await first;
    const second = preloader.preload(["/one.webp"]);
    finishDecode();
    await Promise.resolve();
    expect(images).toHaveLength(2);
    expect(images[1].onload).not.toBeNull();
    images[1].onload?.();
    await second;
  });

  it("releases a failed request so the same URL can be retried", async () => {
    const first = preloader.preload(["/one.webp"]);
    images[0].onerror?.();
    await first;
    const second = preloader.preload(["/one.webp"]);
    expect(images).toHaveLength(2);
    images[1].onload?.();
    await second;
  });

  it("settles and cancels a timed-out request without blocking the reader forever", async () => {
    const loaded = preloader.preload(["/slow.webp"]);
    await vi.advanceTimersByTimeAsync(10_000);
    await loaded;
    expect(images[0].src).toMatch(/^data:image\/gif;base64,/);
    expect(vi.getTimerCount()).toBe(0);
    const retry = preloader.preload(["/slow.webp"]);
    expect(images).toHaveLength(2);
    images[1].onload?.();
    await retry;
  });

  it("keeps the existing fallback behavior when image decoding rejects", async () => {
    const loaded = preloader.preload(["/decode.webp"]);
    images[0].decode.mockRejectedValue(new Error("decode failed"));
    images[0].onload?.();
    await loaded;
    expect(vi.getTimerCount()).toBe(0);
    expect(images[0].onload).toBeNull();
  });
});
