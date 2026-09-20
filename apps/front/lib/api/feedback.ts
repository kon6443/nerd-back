import type { CreateFeedbackInput, FeedbackResult } from "@nerd/contracts";
import { apiFetch } from "./client";

/**
 * 사용자 피드백 전송 API.
 */
export function sendFeedback(input: CreateFeedbackInput): Promise<FeedbackResult> {
  return apiFetch<FeedbackResult>("/feedbacks", {
    method: "POST",
    json: input,
  });
}
