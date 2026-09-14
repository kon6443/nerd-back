import { describe, expect, it } from "vitest";
import {
  DEFAULT_READER_OPTIONS,
  parseReaderOptions,
  withReaderOptions,
} from "./readerOptions";

describe("parseReaderOptions", () => {
  it("값이 없으면 기본값이다", () => {
    expect(parseReaderOptions(new URLSearchParams())).toEqual(DEFAULT_READER_OPTIONS);
  });

  it("아는 값만 받아들인다", () => {
    expect(parseReaderOptions(new URLSearchParams("chat=dock")).chat).toBe("dock");
    expect(parseReaderOptions(new URLSearchParams("chat=modal")).chat).toBe("modal");
  });

  it("모르는 값은 기본값으로 떨어진다", () => {
    expect(parseReaderOptions(new URLSearchParams("chat=carousel")).chat).toBe(
      DEFAULT_READER_OPTIONS.chat,
    );
    expect(parseReaderOptions(new URLSearchParams("immersive=yes")).immersive).toBe(true);
  });

  it("몰입은 off 로만 끈다", () => {
    expect(parseReaderOptions(new URLSearchParams("immersive=off")).immersive).toBe(false);
    expect(parseReaderOptions(new URLSearchParams("immersive=on")).immersive).toBe(true);
  });
});

describe("withReaderOptions", () => {
  it("다른 쿼리를 보존한다", () => {
    // ⚠️ sessionId 가 날아가면 리더가 통째로 에러 화면이 된다.
    const next = withReaderOptions("sessionId=abc&autoStart=true", { chat: "dock" });
    const params = new URLSearchParams(next);
    expect(params.get("sessionId")).toBe("abc");
    expect(params.get("autoStart")).toBe("true");
    expect(params.get("chat")).toBe("dock");
  });

  it("주어진 축만 갈아 끼운다", () => {
    const next = withReaderOptions("chat=modal&immersive=off", { immersive: true });
    const params = new URLSearchParams(next);
    expect(params.get("chat")).toBe("modal");
    expect(params.get("immersive")).toBe("on");
  });
});
