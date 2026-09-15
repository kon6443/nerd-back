import type { MyStorySessionItem } from "@nerd/contracts";

export interface OwnedThumbnailUrls {
  ownerLoginId: string;
  urls: ReadonlyMap<string, string>;
}

let globalThumbnailCache: OwnedThumbnailUrls | null = null;

/** 브라우저 이미지 프리로드 (디코딩까지 선행하여 페인트 지연 0ms 달성) */
export function preloadThumbnailImage(url: string | null | undefined): void {
  if (!url || typeof window === "undefined") return;
  const img = new window.Image();
  img.src = url;
  if (typeof img.decode === "function") {
    img.decode().catch(() => {});
  }
}

/** 캐시된 전역 썸네일 정보 조회 */
export function getCachedThumbnailUrl(storySlug: string, loginId?: string | null): string | undefined {
  if (!globalThumbnailCache) return undefined;
  if (loginId && globalThumbnailCache.ownerLoginId !== loginId) return undefined;
  return globalThumbnailCache.urls.get(storySlug);
}

/** 전역 캐시 갱신 */
export function setCachedThumbnailUrls(cache: OwnedThumbnailUrls): void {
  globalThumbnailCache = cache;
}

/** 완성된 개인화 동화의 1쪽 썸네일만 slug별로 선택한다 (최신 세션 우선). */
export function getCompletedThumbnailUrls(
  sessions: readonly MyStorySessionItem[],
): ReadonlyMap<string, string> {
  const thumbnails = new Map<string, string>();

  for (const session of sessions) {
    if (!session.thumbnailImageUrl) continue;
    // sessions는 최신순이므로 먼저 나온 최신 세션을 우선 보존한다
    if (!thumbnails.has(session.templateSlug)) {
      thumbnails.set(session.templateSlug, session.thumbnailImageUrl);
    }
  }

  return thumbnails;
}

/** 현재 로그인 사용자 소유의 썸네일만 화면에 내보낸다. */
export function getOwnedThumbnailUrl(
  thumbnails: OwnedThumbnailUrls | null,
  currentLoginId: string | null,
  storySlug: string,
): string | undefined {
  if (!thumbnails || !currentLoginId || thumbnails.ownerLoginId !== currentLoginId) {
    return undefined;
  }

  return thumbnails.urls.get(storySlug);
}
