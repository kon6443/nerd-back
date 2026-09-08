import type { CreateSessionInput, StorySessionSummary, UploadFaceResponse } from "@nerd/contracts";
import { apiFetch } from "./client";

/**
 * 동화 제작 세션을 생성하거나 기존 미완료 세션을 재사용한다.
 */
export async function createSession(input: CreateSessionInput): Promise<StorySessionSummary> {
  return apiFetch<StorySessionSummary>("/sessions", {
    method: "POST",
    json: input,
  });
}

/**
 * 얼굴 사진(정면 1장 필수 + 좌/우 선택)을 업로드하고 캐릭터 레퍼런스 이미지를 생성한다.
 */
export async function uploadFace(
  sessionId: string,
  formData: FormData,
): Promise<UploadFaceResponse> {
  return apiFetch<UploadFaceResponse>(`/sessions/${sessionId}/face`, {
    method: "POST",
    body: formData,
  });
}
