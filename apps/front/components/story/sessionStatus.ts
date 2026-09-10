import type { StorySessionStatus } from "@nerd/contracts";
import type { BadgeTone } from "@/components/ui/Badge";

/**
 * 세션 상태 → 화면이 다루는 4단계.
 *
 * 백엔드 상태는 5개(`draft` `face_ready` `generating` `completed` `failed`)지만 **목록·CTA 화면은**
 * 넷만 구분한다 — `face_ready` 와 `generating` 은 사용자에게 똑같이 "만들고 있다" 다.
 *
 * ⚠️ **모든 화면이 이 분류로 충분한 것은 아니다.** 촬영 화면은 `face_ready` 를 따로 본다 —
 * 레퍼런스 미리보기를 되살리려면 그 상태를 구분해야 하기 때문이다. 그 화면은 원래 상태를
 * 직접 보며, 그것이 맞다. 🚫 여기 분류를 그 화면에 억지로 끼워 맞추지 않는다.
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

/**
 * 단계별 배지 문구와 톤. 🚫 여기서 팔레트 클래스를 직접 적지 않는다 — 색은 `Badge` 가 소유하고,
 * 그 값은 디자이너가 정한 것이다.
 *
 * 이 짝은 커밋 `7b91280`(디자이너)이 마이페이지에 적용한 것과 같다 — 완성은 초록, 제작 중은 파랑,
 * 실패는 빨강, 등록 중은 중립이다.
 */
export const SESSION_STAGE_BADGE: Record<SessionStage, { label: string; tone: BadgeTone }> = {
  completed: { label: "완성됨", tone: "success" },
  generating: { label: "제작 중", tone: "info" },
  failed: { label: "제작 실패", tone: "danger" },
  draft: { label: "등록 중", tone: "muted" },
};
