"use client";

import type { AfterStoryResponse, StoryBranchKey } from "@nerd/contracts";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { actionClass } from "@/components/ui/actionStyles";

/**
 * 비하인드 A/B 선택.
 *
 * ⚠️ **첫 선택만 영구 보존된다**(`firstBranchChoice`). 다시 읽을 때는 둘 다 열리므로,
 * 이미 고른 적이 있으면 그 사실을 문구로 알린다 — 안 그러면 "왜 또 고르지" 가 된다.
 */
export function BranchView({
  afterStory,
  isAfterStoryLoading,
  isSelectingBranch,
  afterStoryError,
  afterStoryPollDegraded,
  handleBranchChoice,
  handleAfterStoryRetry,
  onSkip,
  onBackToStory,
}: {
  afterStory: AfterStoryResponse | null;
  isAfterStoryLoading: boolean;
  isSelectingBranch: StoryBranchKey | null;
  afterStoryError: string;
  afterStoryPollDegraded: boolean;
  handleBranchChoice: (branchKey: StoryBranchKey) => void;
  handleAfterStoryRetry: (branchKey: StoryBranchKey) => void;
  /** 비하인드를 건너뛰고 완독으로. */
  onSkip: () => void;
  /** 본편 마지막 쪽으로 되돌아가기. */
  onBackToStory: () => void;
}) {
  const savedChoice = afterStory?.firstBranchChoice;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 py-8 text-center">
      {/* 되돌아가기는 **텍스트 버튼(tertiary)** 이고 화면 왼쪽 위에 둔다 — 아래쪽은 언덕 그림 위라 글자가 묻혔다. */}
      <button
        type="button"
        onClick={onBackToStory}
        className={actionClass("tertiary", "-ml-3 self-start", "compact")}
      >
        ← 5쪽으로 돌아가기
      </button>
      <div className="rounded-full bg-magic-strong/10 p-5 text-4xl shadow-inner">
        🌙
      </div>

      <div>
        {/* 톤을 적어 둔다 — 기본값에 기대면 `Badge` 기본이 바뀔 때 이 화면 색이 조용히 따라 바뀐다. */}
        <Badge tone="info">특별 수록: 비하인드 스토리</Badge>
        <h1 className="mt-3 text-3xl font-bold text-ink">
          그날 밤, 이야기는 어떻게 되었을까요?
        </h1>
        <p className="mt-2 text-base text-ink-muted">
          마음에 드는 선택지를 눌러 뒷이야기를 만나 보세요.
        </p>
      </div>

      {isAfterStoryLoading ? (
        <Card className="w-full max-w-md text-ink-muted">
          <p role="status">선택지를 준비하고 있어요...</p>
        </Card>
      ) : afterStory ? (
        <div className="flex w-full max-w-md flex-col gap-3">
          {savedChoice && (
            <p className="rounded-lg bg-primary-soft px-3 py-2 text-sm font-semibold text-ink">
              처음 고른 이야기는 {savedChoice.toUpperCase()}예요. 다시 읽을 때는 두 결과를 모두 볼 수 있어요.
            </p>
          )}
          {afterStory.choices.map((choice) => {
            const isReady = choice.status === "succeeded";
            const isSelecting = isSelectingBranch === choice.branchKey;
            return (
              <Card key={choice.branchKey} className="border-2 border-magic/40 bg-surface text-left">
                <p className="text-xs font-bold tracking-wider text-magic-strong">선택 {choice.branchKey.toUpperCase()}</p>
                <h2 className="mt-1 text-lg font-bold text-ink">{choice.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{choice.description}</p>
                {choice.status === "failed" && (
                  <div className="mt-3 flex flex-col gap-2">
                    <p className="text-sm font-medium text-red-600">
                      이 이야기를 아직 준비하지 못했어요. 다시 만들 수 있어요.
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleAfterStoryRetry(choice.branchKey)}
                      disabled={isSelectingBranch !== null}
                      className={actionClass("secondary", "w-full py-2 text-base disabled:pointer-events-none disabled:opacity-45")}
                    >
                      {isSelecting ? "다시 만드는 중..." : "이 결과 다시 만들기"}
                    </button>
                  </div>
                )}
                {choice.status === "pending" || choice.status === "running" ? (
                  <p className="mt-3 text-sm font-medium text-ink-muted">삽화를 준비하고 있어요...</p>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleBranchChoice(choice.branchKey)}
                  disabled={!isReady || isSelectingBranch !== null}
                  className={actionClass("primary", "mt-4 w-full py-3 disabled:pointer-events-none disabled:opacity-45")}
                >
                  {isSelecting ? "선택 저장 중..." : `${choice.title} →`}
                </button>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="w-full max-w-md border-red-200 text-red-700">
          비하인드 선택지를 준비하지 못했어요.
        </Card>
      )}

      {afterStoryPollDegraded && (
        <p className="max-w-md text-sm font-medium text-amber-700" role="status">
          연결이 불안정해요. 생성 상태를 계속 다시 확인하고 있어요.
        </p>
      )}

      {afterStoryError && (
        <p className="max-w-md text-sm font-medium text-red-600" role="alert">{afterStoryError}</p>
      )}

      {/* ⭐ 이 화면의 주인공은 선택 A·B 다 — 「건너뛰기」는 그보다 낮은 **세 번째 선택**이라 작은 secondary.
          「돌아가기」는 선택이 아니라 이동이라 위쪽의 텍스트 버튼으로 뺐다(2026-09-14 요청). */}
      <button type="button" onClick={onSkip} className={actionClass("secondary", "", "compact")}>
        건너뛰기
      </button>
    </main>
  );
}
