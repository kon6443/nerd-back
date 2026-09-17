import type { MyStorySessionItem } from "@nerd/contracts";

export interface OwnedThumbnailUrls {
  ownerLoginId: string;
  urls: ReadonlyMap<string, string>;
}

let globalThumbnailCache: OwnedThumbnailUrls | null = null;
const MAX_PRELOADED_THUMBNAILS = 128;
const preloadedThumbnailUrls = new Map<string, symbol>();

/** 최근 128개 URL의 중복 프리로드를 막는다. 이미지 객체는 보관하지 않는다. */
export function preloadThumbnailImage(url: string | null | undefined): void {
  if (!url || typeof window === "undefined") return;
  const existing = preloadedThumbnailUrls.get(url);
  if (existing) {
    preloadedThumbnailUrls.delete(url);
    preloadedThumbnailUrls.set(url, existing);
    return;
  }
  const request = Symbol();
  preloadedThumbnailUrls.set(url, request);
  if (preloadedThumbnailUrls.size > MAX_PRELOADED_THUMBNAILS) {
    const oldest = preloadedThumbnailUrls.keys().next().value;
    if (oldest !== undefined) preloadedThumbnailUrls.delete(oldest);
  }
  const img = new window.Image();
  img.src = url;
  if (typeof img.decode === "function") {
    img.decode().catch(() => {
      // 축출 후 같은 URL을 다시 요청했으면 이전 decode 실패는 새 기록을 지우지 않는다.
      if (preloadedThumbnailUrls.get(url) === request) preloadedThumbnailUrls.delete(url);
    });
  }
}

/** 같은 로그인 사용자가 서재 상세으로 이동할 때 재요청 전 썸네일을 재사용한다. */
export function getCachedThumbnailUrl(
  storySlug: string,
  loginId: string,
): string | undefined {
  if (!globalThumbnailCache || globalThumbnailCache.ownerLoginId !== loginId) return undefined;
  return globalThumbnailCache.urls.get(storySlug);
}

/** 같은 로그인 사용자의 서재 목록을 첫 렌더에 재사용한다. */
export function getCachedThumbnailUrls(loginId: string): OwnedThumbnailUrls | null {
  if (!globalThumbnailCache || globalThumbnailCache.ownerLoginId !== loginId) return null;
  return globalThumbnailCache;
}

/** 로그인 사용자별 서재 썸네일 캐시를 갱신한다. */
export function setCachedThumbnailUrls(cache: OwnedThumbnailUrls): void {
  globalThumbnailCache = cache;
}

/** 완성된 개인화 동화의 1쪽 썸네일만 slug별로 선택한다 (최신 세션 우선). */
export function getCompletedThumbnailUrls(
  sessions: readonly MyStorySessionItem[],
): ReadonlyMap<string, string> {
  const thumbnails = new Map<string, string>();

  for (const session of sessions) {
    if (session.status !== "completed" || !session.thumbnailImageUrl) continue;
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
