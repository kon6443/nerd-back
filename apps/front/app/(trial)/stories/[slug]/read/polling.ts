/**
 * 폴링의 순수 로직. 훅(`usePolling`)에서 분리해 둔 이유는 vitest 가 `environment: 'node'` 라
 * React 훅은 렌더링 없이 테스트할 수 없기 때문이다 — 판단 규칙만 여기 모아 테스트로 고정한다.
 * (같은 폴더의 `readiness.ts` 와 같은 방식)
 */
import type { AfterStoryResponse } from "@nerd/contracts";

/** 정상일 때의 폴링 간격. */
export const POLL_BASE_MS = 3000;

/** 연속 실패 시 간격 상한. 장애 중에 초당 요청이 쌓이지 않게 한다. */
export const POLL_MAX_MS = 30000;

/** 이 횟수만큼 연속 실패하면 사용자에게 "연결 불안정"을 알린다. */
export const POLL_DEGRADED_THRESHOLD = 3;

/**
 * 다음 폴링까지의 지연. 연속 실패 횟수에 따라 지수적으로 늘리고 상한에서 멈춘다.
 * 성공하면 `failCount` 가 0 으로 돌아가므로 간격도 즉시 기본값으로 복귀한다.
 */
export function nextPollDelay(failCount: number): number {
  if (failCount <= 0) return POLL_BASE_MS;
  return Math.min(POLL_BASE_MS * 2 ** failCount, POLL_MAX_MS);
}

/** 연속 실패가 사용자에게 알릴 수준인지. */
export function isPollDegraded(failCount: number): boolean {
  return failCount >= POLL_DEGRADED_THRESHOLD;
}

/** 비하인드 A/B 결과가 아직 생성 중이라 폴링이 필요한지. */
export function isAfterStoryGenerating(afterStory: AfterStoryResponse | null): boolean {
  if (!afterStory) return false;
  return afterStory.choices.some(
    (choice) => choice.status === "pending" || choice.status === "running",
  );
}
