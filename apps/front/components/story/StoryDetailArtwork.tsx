"use client";

import { useEffect, useState } from "react";
import {
  getCachedThumbnailUrl,
  getCachedThumbnailUrls,
} from "@/app/(demo)/library/libraryStories";
import { StoryCover } from "@/components/story/StoryCard";
import { findMySessionBySlug } from "@/lib/api";
import { useSession } from "@/lib/api/useSession";
import { preloadThumbnailImage } from "@/lib/preloadThumbnailImage";

interface StoryDetailArtworkProps {
  slug: string;
  title: string;
  coverImageUrl?: string | null;
  isCreateMode: boolean;
}

/**
 * 동화 상세 표지 삽화.
 * 제작 모드(`mode=create`)에서 로그인 사용자의 완성된 개인화 동화가 있으면 1쪽 썸네일을 표시하고,
 * 그 외에는 DB에 연결된 기본 표지를 표시하며, 표지가 없으면 제목이 새겨진 책을 렌더링한다.
 */
export function StoryDetailArtwork({ slug, title, coverImageUrl, isCreateMode }: StoryDetailArtworkProps) {
  const authSession = useSession();
  const currentLoginId = authSession.status === "authenticated" ? authSession.me.loginId : null;

  /**
   * 조회 결과. **누구 것인지 함께 들고 있는다** — 계정이 바뀌면 그 즉시 무효가 되어야 한다.
   */
  const [fetched, setFetched] = useState<{ slug: string; loginId: string; url: string | null } | null>(null);

  // 서재 목록이 채워 둔 전역 캐시. 🚫 `loginId` 를 반드시 넘긴다 — 빼면 소유자 검사가
  // 통째로 생략되어(선택 인자다) 같은 탭에서 계정을 바꿨을 때 **앞사람 아이의 얼굴**이 보인다.
  // 🚫 effect 에서 setState 로 옮겨 담지 않는다 — 렌더 중 파생이면 계정이 바뀌는 순간
  //    저절로 무효가 되고, 지우는 것을 잊을 자리 자체가 없다.
  const cachedThumbnails = currentLoginId ? getCachedThumbnailUrls(currentLoginId) : null;
  const cachedUrl = currentLoginId ? (getCachedThumbnailUrl(slug, currentLoginId) ?? null) : null;
  const thumbnailUrl =
    fetched?.slug === slug && fetched.loginId === currentLoginId ? fetched.url : cachedUrl;

  useEffect(() => {
    if (!isCreateMode || !currentLoginId) return;
    // 목록에서 이미 현재 사용자의 전체 세션을 조회했다면, 썸네일이 없는 경우도
    // 확정된 결과다. 상세 화면에서 같은 `/sessions/my` 요청을 반복하지 않는다.
    if (cachedThumbnails) return;

    let active = true;
    // ⚠️ 로그인한 사람만 부른다 — 이 컴포넌트는 `(demo)` 공개 경로에 있어 방문자 대부분이
    //    비로그인이다. 게이트가 없으면 방문 1회마다 `GET /sessions/my` 가 401 로 쌓인다
    //    (`StorySessionActions` 가 같은 이유로 이미 게이트를 둔다).
    findMySessionBySlug(slug)
      .then((session) => {
        if (!active) return;
        const url = session?.thumbnailImageUrl ?? null;
        setFetched({ slug, loginId: currentLoginId, url });
        if (url) preloadThumbnailImage(url);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [isCreateMode, slug, currentLoginId, cachedThumbnails]);

  const personalizedUrl = isCreateMode ? thumbnailUrl : null;
  return (
    <StoryCover
      title={title}
      imageUrl={personalizedUrl ?? coverImageUrl ?? undefined}
      imageFit={personalizedUrl ? "cover" : "contain"}
      priority
    />
  );
}
