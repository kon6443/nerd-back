import type {
  AfterStoryResponse,
  CreateSessionInput,
  MyStorySessionItem,
  PersonalizeSessionResponse,
  RetryPageResponse,
  RetryAfterStoryResponse,
  SelectAfterStoryChoiceResponse,
  SessionPagesResponse,
  StoryBranchKey,
  StorySessionSummary,
  UploadFaceResponse,
} from "@nerd/contracts";
import { apiFetch } from "./client";

/**
 * 사용자의 모든 동화 제작 세션 목록을 조회한다 (마이페이지 / 서재 연동).
 */
export async function getMySessions(): Promise<MyStorySessionItem[]> {
  return apiFetch<MyStorySessionItem[]>("/sessions/my", {
    method: "GET",
  });
}

/**
 * 이 동화(slug)에 대한 내 세션 하나. 없으면 `null`.
 *
 * ⭐ 사용자 × 동화 1권당 세션은 최대 1개다(`UNIQUE(user_id, template_id)`). 서재 상세·촬영 화면이
 * 같은 "목록에서 slug 로 찾기"를 각자 적고 있었다 — 한 곳으로 모은다.
 */
export async function findMySessionBySlug(slug: string): Promise<MyStorySessionItem | null> {
  const sessions = await getMySessions();
  return sessions.find((s) => s.templateSlug === slug) ?? null;
}

/**
 * 동화 세션을 삭제한다 (초기화 및 다른 얼굴로 새로 만들기).
 */
export async function deleteSession(sessionId: string): Promise<void> {
  return apiFetch<void>(`/sessions/${sessionId}`, {
    method: "DELETE",
  });
}

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

/**
 * 동화 페이지 개인화 비동기 삽화 생성을 시작한다 (API 10: 202 Accepted).
 */
export async function personalizeSession(sessionId: string): Promise<PersonalizeSessionResponse> {
  return apiFetch<PersonalizeSessionResponse>(`/sessions/${sessionId}/personalize`, {
    method: "POST",
  });
}

/**
 * 세션의 페이지별 생성 진행률과 완료된 서명 URL 목록을 조회한다 (API 11: Polling).
 */
export async function fetchSessionPages(sessionId: string): Promise<SessionPagesResponse> {
  return apiFetch<SessionPagesResponse>(`/sessions/${sessionId}/pages`, {
    method: "GET",
  });
}

/**
 * 생성이 실패한 특정 페이지만 핀포인트로 재시도한다 (API 12).
 */
export async function retrySessionPage(
  sessionId: string,
  pageNo: number,
): Promise<RetryPageResponse> {
  return apiFetch<RetryPageResponse>(`/sessions/${sessionId}/pages/${pageNo}/retry`, {
    method: "POST",
  });
}

/** 비하인드 A/B 선택지와 각 결과 페이지의 준비 상태를 조회한다. */
export async function fetchAfterStory(sessionId: string): Promise<AfterStoryResponse> {
  return apiFetch<AfterStoryResponse>(`/sessions/${sessionId}/after-story`, {
    method: "GET",
  });
}

/** 아직 선택하지 않은 세션의 첫 A/B 선택을 영구 기록한다. */
export async function selectAfterStoryChoice(
  sessionId: string,
  branchKey: StoryBranchKey,
): Promise<SelectAfterStoryChoiceResponse> {
  return apiFetch<SelectAfterStoryChoiceResponse>(`/sessions/${sessionId}/after-story/choice`, {
    method: "POST",
    json: { branchKey },
  });
}

/** 실패한 비하인드 A/B 결과 6쪽을 다시 생성한다. */
export async function retryAfterStoryPage(
  sessionId: string,
  branchKey: StoryBranchKey,
): Promise<RetryAfterStoryResponse> {
  return apiFetch<RetryAfterStoryResponse>(`/sessions/${sessionId}/after-story/${branchKey}/retry`, {
    method: "POST",
  });
}
