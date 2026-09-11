import { describe, expect, it } from "vitest";
import type { AfterStoryResponse, SessionPageStatus, StoryBranchKey } from "@nerd/contracts";
import {
  isAfterStoryGenerating,
  isPollDegraded,
  nextPollDelay,
  POLL_BASE_MS,
  POLL_MAX_MS,
} from "./polling";

function choice(branchKey: StoryBranchKey, status: SessionPageStatus) {
  return {
    branchKey,
    title: "제목",
    description: "설명",
    pageNo: 6 as const,
    bodyText: "본문",
    status,
    imageUrl: null,
    errorMessage: null,
  };
}

function afterStory(a: SessionPageStatus, b: SessionPageStatus): AfterStoryResponse {
  return {
    sessionId: "00000000-0000-4000-8000-000000000000",
    firstBranchChoice: null,
    choices: [choice("a", a), choice("b", b)],
  };
}

describe("폴링 간격", () => {
  it("정상일 때는 기본 간격을 쓴다", () => {
    expect(nextPollDelay(0)).toBe(POLL_BASE_MS);
  });

  it("연속 실패하면 간격이 두 배씩 늘어난다", () => {
    expect(nextPollDelay(1)).toBe(6000);
    expect(nextPollDelay(2)).toBe(12000);
    expect(nextPollDelay(3)).toBe(24000);
  });

  it("아무리 실패해도 상한을 넘지 않는다 — 장애 중에 요청이 쌓이면 안 된다", () => {
    expect(nextPollDelay(4)).toBe(POLL_MAX_MS);
    expect(nextPollDelay(50)).toBe(POLL_MAX_MS);
  });
});

describe("연결 불안정 안내", () => {
  it("한두 번 실패로는 사용자를 놀라게 하지 않는다", () => {
    expect(isPollDegraded(0)).toBe(false);
    expect(isPollDegraded(2)).toBe(false);
  });

  it("연속 3회부터 사용자에게 알린다", () => {
    expect(isPollDegraded(3)).toBe(true);
    expect(isPollDegraded(9)).toBe(true);
  });
});

describe("비하인드 폴링 필요 여부", () => {
  it("아직 조회 전이면 폴링하지 않는다", () => {
    expect(isAfterStoryGenerating(null)).toBe(false);
  });

  it("한쪽이라도 생성 중이면 폴링한다", () => {
    expect(isAfterStoryGenerating(afterStory("succeeded", "running"))).toBe(true);
    expect(isAfterStoryGenerating(afterStory("pending", "succeeded"))).toBe(true);
  });

  it("양쪽이 끝나면 폴링을 멈춘다 — 실패도 끝난 상태다(재시도는 사용자가 누른다)", () => {
    expect(isAfterStoryGenerating(afterStory("succeeded", "succeeded"))).toBe(false);
    expect(isAfterStoryGenerating(afterStory("succeeded", "failed"))).toBe(false);
  });
});
