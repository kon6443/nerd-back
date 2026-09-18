import type { StoryDetail, StoryPageView, StorySummary } from "@nerd/contracts";
import { apiFetch } from "./client";

/**
 * 동화 조회 호출.
 *
 * 경로 조립을 화면마다 하지 않고 여기 모은다 — `/stories/${slug}` 를 세 화면이 각자 쓰면
 * 백엔드가 경로를 바꿀 때 한 곳을 빠뜨린다.
 */

/**
 * ⭐ **경로 조각은 반드시 인코딩한다.** slug·pageNo 는 사용자가 주소창에서 바꿀 수 있는 값이라
 * 그대로 이어붙이면 `/` 하나로 경로가 갈라져 엉뚱한 엔드포인트를 부른다.
 */
function storyPath(slug: string, suffix = ""): string {
  return `/stories/${encodeURIComponent(slug)}${suffix}`;
}

export function fetchStories(signal?: AbortSignal): Promise<StorySummary[]> {
  return apiFetch<StorySummary[]>("/stories", {
    signal,
    // 공개 동화 목록과 표지 서명 URL은 5분 단위로 Next.js 서버 캐시를 활용해 0ms 로 즉시 응답한다.
    next: { revalidate: 300 },
  });
}

export function fetchStoryDetail(slug: string): Promise<StoryDetail> {
  return apiFetch<StoryDetail>(storyPath(slug));
}

/**
 * 본편 **전 쪽**을 한 번에.
 *
 * ⭐ 리더는 진입할 때 이것 하나만 부른다 — 이후 쪽을 오가도 추가 요청이 없다.
 * 중간 쪽으로 바로 들어와도 요청 수는 같다(1회).
 * 🚫 쪽마다 `fetchStoryPage` 를 부르지 않는다. 그러면 한 권에 5회가 나가고, 어느 쪽을 먼저
 * 받을지 정하는 우선순위 로직이 화면 쪽에 생긴다.
 */
export function fetchStoryPages(slug: string): Promise<StoryPageView[]> {
  return apiFetch<StoryPageView[]>(storyPath(slug, "/pages"));
}

/** 한 쪽만 필요할 때. 리더는 `fetchStoryPages` 를 쓴다. */
export function fetchStoryPage(slug: string, pageNo: number): Promise<StoryPageView> {
  return apiFetch<StoryPageView>(storyPath(slug, `/pages/${encodeURIComponent(String(pageNo))}`));
}
