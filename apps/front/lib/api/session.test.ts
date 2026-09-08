import { describe, expect, it, vi, beforeEach } from "vitest";
import { createSession, uploadFace } from "./session";
import * as client from "./client";

describe("session api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("createSession 은 /sessions 로 POST 요청을 보낸다", async () => {
    const apiFetchSpy = vi.spyOn(client, "apiFetch").mockResolvedValue({
      id: "session-123",
      templateSlug: "cloud-village",
      status: "draft",
      referenceImageUrl: null,
      createdAt: "2026-09-08T00:00:00.000Z",
      updatedAt: "2026-09-08T00:00:00.000Z",
    });

    const result = await createSession({ templateSlug: "cloud-village" });

    expect(apiFetchSpy).toHaveBeenCalledWith("/sessions", {
      method: "POST",
      json: { templateSlug: "cloud-village" },
    });
    expect(result.id).toBe("session-123");
    expect(result.status).toBe("draft");
  });

  it("uploadFace 는 /sessions/:id/face 로 FormData 를 보낸다", async () => {
    const apiFetchSpy = vi.spyOn(client, "apiFetch").mockResolvedValue({
      id: "session-123",
      status: "face_ready",
      referenceImageUrl: "https://storage.local/ref.png",
    });

    const formData = new FormData();
    const result = await uploadFace("session-123", formData);

    expect(apiFetchSpy).toHaveBeenCalledWith("/sessions/session-123/face", {
      method: "POST",
      body: formData,
    });
    expect(result.status).toBe("face_ready");
    expect(result.referenceImageUrl).toBe("https://storage.local/ref.png");
  });
});
