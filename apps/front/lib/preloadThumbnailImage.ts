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
