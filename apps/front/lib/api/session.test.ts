import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createSession,
  deleteSession,
  fetchAfterStory,
  fetchSessionPages,
  findMySessionBySlug,
  getMySessions,
  personalizeSession,
  retrySessionPage,
  retryAfterStoryPage,
  selectAfterStoryChoice,
  uploadFace,
} from "./session";
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

  it("personalizeSession 은 /sessions/:id/personalize 로 POST 요청을 보낸다", async () => {
    const apiFetchSpy = vi.spyOn(client, "apiFetch").mockResolvedValue({
      id: "session-123",
      status: "generating",
      totalPages: 6,
    });

    const result = await personalizeSession("session-123");

    expect(apiFetchSpy).toHaveBeenCalledWith("/sessions/session-123/personalize", {
      method: "POST",
    });
    expect(result.id).toBe("session-123");
    expect(result.status).toBe("generating");
    expect(result.totalPages).toBe(6);
  });

  it("fetchSessionPages 는 /sessions/:id/pages 로 GET 요청을 보낸다", async () => {
    const apiFetchSpy = vi.spyOn(client, "apiFetch").mockResolvedValue({
      sessionId: "session-123",
      status: "generating",
      totalPages: 6,
      completedPages: 3,
      isAllCompleted: false,
      pages: [
        {
          pageNo: 1,
          status: "succeeded",
          imageUrl: "https://storage.local/page-1.png",
          errorMessage: null,
          updatedAt: "2026-09-08T00:00:00.000Z",
        },
      ],
    });

    const result = await fetchSessionPages("session-123");

    expect(apiFetchSpy).toHaveBeenCalledWith("/sessions/session-123/pages", {
      method: "GET",
    });
    expect(result.sessionId).toBe("session-123");
    expect(result.completedPages).toBe(3);
    expect(result.pages[0].status).toBe("succeeded");
  });

  it("retrySessionPage 는 /sessions/:id/pages/:pageNo/retry 로 POST 요청을 보낸다", async () => {
    const apiFetchSpy = vi.spyOn(client, "apiFetch").mockResolvedValue({
      sessionId: "session-123",
      pageNo: 2,
      status: "pending",
    });

    const result = await retrySessionPage("session-123", 2);

    expect(apiFetchSpy).toHaveBeenCalledWith("/sessions/session-123/pages/2/retry", {
      method: "POST",
    });
    expect(result.sessionId).toBe("session-123");
    expect(result.pageNo).toBe(2);
    expect(result.status).toBe("pending");
  });

  it("fetchAfterStory 는 비하인드 선택지와 결과 상태를 조회한다", async () => {
    const apiFetchSpy = vi.spyOn(client, "apiFetch").mockResolvedValue({
      sessionId: "session-123",
      firstBranchChoice: null,
      choices: [],
    });

    await fetchAfterStory("session-123");

    expect(apiFetchSpy).toHaveBeenCalledWith("/sessions/session-123/after-story", {
      method: "GET",
    });
  });

  it("selectAfterStoryChoice 는 최초 A/B 선택을 저장한다", async () => {
    const apiFetchSpy = vi.spyOn(client, "apiFetch").mockResolvedValue({
      sessionId: "session-123",
      branchKey: "a",
      isFirstChoice: true,
    });

    await selectAfterStoryChoice("session-123", "a");

    expect(apiFetchSpy).toHaveBeenCalledWith("/sessions/session-123/after-story/choice", {
      method: "POST",
      json: { branchKey: "a" },
    });
  });

  it("retryAfterStoryPage 는 실패한 A/B 결과만 재시도한다", async () => {
    const apiFetchSpy = vi.spyOn(client, "apiFetch").mockResolvedValue({
      sessionId: "session-123",
      pageNo: 6,
      branchKey: "b",
      status: "pending",
    });

    await retryAfterStoryPage("session-123", "b");

    expect(apiFetchSpy).toHaveBeenCalledWith("/sessions/session-123/after-story/b/retry", {
      method: "POST",
    });
  });

  it("getMySessions 는 /sessions/my 로 GET 요청을 보낸다", async () => {
    const apiFetchSpy = vi.spyOn(client, "apiFetch").mockResolvedValue([
      {
        id: "session-123",
        templateId: 1,
        templateSlug: "red-riding-hood",
        templateTitle: "빨간 모자",
        status: "completed",
        referenceImageUrl: "https://storage.local/ref.png",
        createdAt: "2026-09-08T00:00:00.000Z",
        updatedAt: "2026-09-08T00:00:00.000Z",
      },
    ]);

    const result = await getMySessions();

    expect(apiFetchSpy).toHaveBeenCalledWith("/sessions/my", {
      method: "GET",
    });
    expect(result).toHaveLength(1);
    expect(result[0].templateSlug).toBe("red-riding-hood");
  });

  it("deleteSession 은 /sessions/:id 로 DELETE 요청을 보낸다", async () => {
    const apiFetchSpy = vi.spyOn(client, "apiFetch").mockResolvedValue(undefined);

    await deleteSession("session-123");

    expect(apiFetchSpy).toHaveBeenCalledWith("/sessions/session-123", {
      method: "DELETE",
    });
  });
  /**
   * ⭐ 이 헬퍼는 서재 상세·촬영 화면 **세 곳**이 각자 적던 "목록에서 slug 로 찾기" 를 모은 것이다.
   * 없을 때 `undefined` 가 아니라 `null` 을 주기로 했으므로 그 계약을 고정한다.
   */
  it("findMySessionBySlug 는 목록에서 slug 가 같은 세션을 찾는다", async () => {
    vi.spyOn(client, "apiFetch").mockResolvedValue([
      { id: "s1", templateId: 1, templateSlug: "jack", templateTitle: "잭", status: "completed", referenceImageUrl: null, createdAt: "", updatedAt: "" },
      { id: "s2", templateId: 2, templateSlug: "hood", templateTitle: "모자", status: "draft", referenceImageUrl: null, createdAt: "", updatedAt: "" },
    ]);

    await expect(findMySessionBySlug("hood")).resolves.toMatchObject({ id: "s2" });
  });

  it("findMySessionBySlug 는 없으면 undefined 가 아니라 null 을 준다", async () => {
    vi.spyOn(client, "apiFetch").mockResolvedValue([]);

    await expect(findMySessionBySlug("없는-동화")).resolves.toBeNull();
  });
});
