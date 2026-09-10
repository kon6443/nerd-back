import type { StorySessionStatus } from "@nerd/contracts";
import type { BadgeTone } from "@/components/ui/Badge";

/**
 * 세션 상태 → 화면이 다루는 4단계.
 *
 * 백엔드 상태는 5개(`draft` `face_ready` `generating` `completed` `failed`)지만 화면은 넷만 구분한다 —
 * `face_ready` 와 `generating` 은 사용자에게 똑같이 "만들고 있다" 다.
 *
 * ⭐ **이 분류를 화면마다 다시 쓰지 않는다.** 마이페이지와 서재 상세가 각자 `s.status === ...` 를
 * 세 줄씩 적고 있었고, 상태가 하나 늘면 두 곳을 같이 고쳐야 했다(2026-09-09 전수조사).
 */
export type SessionStage = "completed" | "generating" | "failed" | "draft";

export function classifySessionStatus(status: StorySessionStatus): SessionStage {
  switch (status) {
    case "completed":
      return "completed";
    case "generating":
    case "face_ready":
      return "generating";
    case "failed":
      return "failed";
    case "draft":
      return "draft";
  }
}

/** 단계별 배지 문구와 색. 색은 토큰 톤이다 — 🚫 여기서 팔레트 클래스를 직접 적지 않는다. */
export const SESSION_STAGE_BADGE: Record<SessionStage, { label: string; tone: BadgeTone }> = {
  completed: { label: "완성됨", tone: "success" },
  generating: { label: "제작 중", tone: "progress" },
  failed: { label: "제작 실패", tone: "danger" },
  draft: { label: "등록 중", tone: "muted" },
};
