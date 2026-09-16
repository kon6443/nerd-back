"use client";

import type { StorySummary } from "@nerd/contracts";
import { useEffect, useState } from "react";
import { StoryCard } from "@/components/story/StoryCard";
import { ActionLink } from "@/components/ui/ActionLink";
import { getMySessions } from "@/lib/api";
import { useSession } from "@/lib/api/useSession";
import { getLibraryStoryHref } from "@/lib/libraryMode";
import { STORY_GRID, StoryListSkeleton } from "./LibraryShell";
import {
  getCompletedThumbnailUrls,
  getCachedThumbnailUrls,
  getOwnedThumbnailUrl,
  preloadThumbnailImage,
  setCachedThumbnailUrls,
  type OwnedThumbnailUrls,
} from "./libraryStories";

interface LibraryStoryListProps {
  stories: StorySummary[];
  isCreateMode: boolean;
}

export function LibraryStoryList({ stories, isCreateMode }: LibraryStoryListProps) {
  const authSession = useSession();
  const currentLoginId =
    authSession.status === "authenticated" ? authSession.me.loginId : null;
  const [thumbnails, setThumbnails] = useState<OwnedThumbnailUrls | null>(() =>
    currentLoginId ? getCachedThumbnailUrls(currentLoginId) : null,
  );
  const [loadedThumbnailLoginId, setLoadedThumbnailLoginId] = useState<string | null>(() =>
    currentLoginId && getCachedThumbnailUrls(currentLoginId) ? currentLoginId : null,
  );

  useEffect(() => {
    if (authSession.status === "unknown") {
      return;
    }
    if (!currentLoginId) {
      return;
    }

    if (getCachedThumbnailUrls(currentLoginId)) {
      return;
    }

    let active = true;

    getMySessions()
      .then((sessions) => {
        if (!active) return;
        const urls = getCompletedThumbnailUrls(sessions);
        const owned: OwnedThumbnailUrls = {
          ownerLoginId: currentLoginId,
          urls,
        };
        setCachedThumbnailUrls(owned);
        setThumbnails(owned);
        setLoadedThumbnailLoginId(currentLoginId);
        // 첫 화면의 우선 카드만 디코딩한다. 나머지는 이미지의 lazy 로딩과 hover/touch 프리로드에 맡긴다.
        for (const url of stories
          .slice(0, 2)
          .map((story) => urls.get(story.slug))
          .filter((url): url is string => Boolean(url))) {
          preloadThumbnailImage(url);
        }
      })
      .catch((error: unknown) => {
        // 인증 후 조회가 실패하면 기본 삽화를 유지한다.
        if (active) {
          setThumbnails(null);
          setLoadedThumbnailLoginId(currentLoginId);
        }
        console.warn("서재 개인화 썸네일 조회 실패:", error);
      });

    return () => {
      active = false;
    };
  }, [authSession.status, currentLoginId, stories]);

  const currentCachedThumbnails = currentLoginId
    ? getCachedThumbnailUrls(currentLoginId)
    : null;
  const visibleThumbnails =
    currentCachedThumbnails ??
    (thumbnails?.ownerLoginId === currentLoginId ? thumbnails : null);
  const waitingForPersonalizedThumbnails =
    authSession.status === "unknown" ||
    (authSession.status === "authenticated" &&
      !currentCachedThumbnails &&
      loadedThumbnailLoginId !== currentLoginId);

  if (waitingForPersonalizedThumbnails) {
    return <StoryListSkeleton count={stories.length} />;
  }

  return (
    <ul className={STORY_GRID}>
      {stories.map((story, index) => {
        const thumbnailUrl = getOwnedThumbnailUrl(visibleThumbnails, currentLoginId, story.slug);
        return (
          <li
            key={story.slug}
            className="min-w-0"
            onMouseEnter={() => preloadThumbnailImage(thumbnailUrl)}
            onTouchStart={() => preloadThumbnailImage(thumbnailUrl)}
          >
            <StoryCard
              title={story.title}
              description={story.summary ?? undefined}
              imageUrl={thumbnailUrl}
              priority={index < 2}
              action={
                <ActionLink
                  href={getLibraryStoryHref(story.slug, isCreateMode)}
                  variant="primary"
                  size="compact"
                  className="w-full"
                >
                  동화 펼쳐 보기
                </ActionLink>
              }
            />
          </li>
        );
      })}
    </ul>
  );
}
