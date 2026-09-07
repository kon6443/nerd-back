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

export function fetchStories(): Promise<StorySummary[]> {
  return apiFetch<StorySummary[]>("/stories");
}

export function fetchStoryDetail(slug: string): Promise<StoryDetail> {
  return apiFetch<StoryDetail>(storyPath(slug));
}

export function fetchStoryPage(slug: string, pageNo: number): Promise<StoryPageView> {
  return apiFetch<StoryPageView>(storyPath(slug, `/pages/${encodeURIComponent(String(pageNo))}`));
}
