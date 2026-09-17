"use client";

import type { StorySummary } from "@nerd/contracts";
import { useEffect, useState } from "react";
import { StoryCard } from "@/components/story/StoryCard";
import room from "@/components/layout/StoryRoom.module.css";
import { ActionLink } from "@/components/ui/ActionLink";
import { getMySessions } from "@/lib/api";
import { useSession } from "@/lib/api/useSession";
import { preloadThumbnailImage } from "@/lib/preloadThumbnailImage";
import { getLibraryStoryHref } from "@/lib/libraryMode";
import { STORY_GRID } from "./LibraryShell";
import {
  getCompletedThumbnailUrls,
  getCachedThumbnailUrls,
  getOwnedThumbnailUrl,
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

  // 공개 동화는 SSR부터 보여 준다. 인증/개인화 조회는 같은 카드의 표지만 갱신한다.
  return (
    <ul className={STORY_GRID}>
      {stories.map((story, index) => {
        const thumbnailUrl = getOwnedThumbnailUrl(visibleThumbnails, currentLoginId, story.slug);
        return (
          <li
            key={story.slug}
            className={`min-w-0 ${room.storyTheme}`}
            data-story={story.slug}
            onMouseEnter={() => preloadThumbnailImage(thumbnailUrl)}
            onTouchStart={() => preloadThumbnailImage(thumbnailUrl)}
          >
            <StoryCard
              title={story.title}
              description={story.summary ?? undefined}
              imageUrl={thumbnailUrl ?? story.coverImageUrl ?? undefined}
              imageFit={thumbnailUrl ? "cover" : "contain"}
              priority={index < 2}
              action={
                <ActionLink
                  href={getLibraryStoryHref(story.slug, isCreateMode)}
                  variant="primary"
                  size="compact"
                  className={`w-full ${room.primary}`}
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
