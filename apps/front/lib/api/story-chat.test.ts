import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./client";
import { fetchStoryChat, sendStoryChat } from "./story-chat";

vi.mock("./client", () => ({ apiFetch: vi.fn() }));

describe("개인 동화 장면 대화 API", () => {
  beforeEach(() => vi.clearAllMocks());
  it("사용자가 바꿀 수 있는 경로를 인코딩하고 분기를 명시한다", async () => {
    const signal = new AbortController().signal;
    await fetchStoryChat("book/other", 6, "b", signal);
    expect(apiFetch).toHaveBeenCalledWith("/sessions/book%2Fother/pages/6/chat?branchKey=b", {
      cache: "no-store",
      signal,
    });
  });
  it("공유 검증 계약으로 공백을 제거하고 POST를 한 번만 보낸다", async () => {
    await sendStoryChat("book", 1, "common", { role: "wolf", message: "  기분이 어때?  " });
    expect(apiFetch).toHaveBeenCalledWith("/sessions/book/pages/1/chat?branchKey=common", {
      method: "POST",
      json: { role: "wolf", message: "기분이 어때?" },
    });
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
  it("잘못된 질문은 API를 부르기 전에 거절한다", () => {
    expect(() => sendStoryChat("book", 1, "common", { role: "wolf", message: " " })).toThrow();
    expect(() =>
      sendStoryChat("book", 1, "common", { role: "wolf", message: "가".repeat(301) }),
    ).toThrow();
    expect(apiFetch).not.toHaveBeenCalled();
  });
  it("응답이 유실되어도 유료 POST를 자동으로 반복하지 않는다", async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error("connection lost"));
    await expect(sendStoryChat("book", 6, "a", { role: "wolf", message: "질문" })).rejects.toThrow(
      "connection lost",
    );
    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
});
