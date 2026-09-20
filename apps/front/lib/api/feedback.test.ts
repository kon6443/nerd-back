import { describe, expect, it, vi } from "vitest";
import { sendFeedback } from "./feedback";
import * as client from "./client";

describe("sendFeedback", () => {
  it("POST /feedbacks 로 입력 데이터를 전송한다", async () => {
    const spy = vi.spyOn(client, "apiFetch").mockResolvedValue({
      id: 1,
      category: "bug",
      title: "버그 제보",
      createdAt: "2026-09-20T00:00:00.000Z",
    });

    const input = {
      category: "bug" as const,
      title: "버그 제보",
      content: "화면이 깨집니다.",
      pageUrl: "/home",
    };

    const result = await sendFeedback(input);

    expect(spy).toHaveBeenCalledWith("/feedbacks", {
      method: "POST",
      json: input,
    });
    expect(result.id).toBe(1);
    expect(result.category).toBe("bug");
  });
});
