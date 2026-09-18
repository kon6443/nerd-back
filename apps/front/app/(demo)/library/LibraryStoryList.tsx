"use client";

import { useEffect, useState } from "react";
import type { StorySummary } from "@nerd/contracts";
import { StoryCard } from "@/components/story/StoryCard";
import room from "@/components/layout/StoryRoom.module.css";
import { ActionLink } from "@/components/ui/ActionLink";
import { preloadThumbnailImage } from "@/lib/preloadThumbnailImage";
import { getLibraryStoryHref } from "@/lib/libraryMode";
import { useSession } from "@/lib/api/useSession";
import { getMySessions } from "@/lib/api";
import { STORY_GRID } from "./LibraryShell";

const EMPTY_SLUGS: ReadonlySet<string> = new Set();

interface LibraryStoryListProps {
  stories: StorySummary[];
  isCreateMode: boolean;
  initialCompletedSlugs?: ReadonlySet<string>;
}

export function LibraryStoryList({
  stories,
  isCreateMode,
  initialCompletedSlugs,
}: LibraryStoryListProps) {
  const authSession = useSession();
  const [completedSlugs, setCompletedSlugs] = useState<ReadonlySet<string>>(
    initialCompletedSlugs ?? EMPTY_SLUGS,
  );
  const [sessionsLoaded, setSessionsLoaded] = useState(initialCompletedSlugs !== undefined);

  useEffect(() => {
    // 시연 모드(!isCreateMode)는 내 얼굴 동화 존재 여부와 무관하게 템플릿 본동화로 직행하므로 세션 조회가 불필요하다.
    if (!isCreateMode || authSession.status !== "authenticated") {
      return;
    }

    let active = true;

    getMySessions()
      .then((sessions) => {
        if (!active) return;
        const slugs = new Set(
          sessions
            .filter((s) => s.status !== "draft")
            .map((s) => s.templateSlug),
        );
        setCompletedSlugs(slugs);
      })
      .catch((err) => {
        console.warn("내 세션 조회 실패:", err);
      })
      .finally(() => {
        if (active) setSessionsLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [authSession.status, isCreateMode]);

  const isAuthenticated = authSession.status === "authenticated";
  const isLoaded = isCreateMode && isAuthenticated ? sessionsLoaded : true;
  const activeSlugs = isCreateMode && isAuthenticated ? completedSlugs : EMPTY_SLUGS;

  // 서재는 모든 방문자에게 템플릿 고유 표지만 일관되게 보여준다.
  return (
    <ul className={STORY_GRID}>
      {stories.map((story, index) => {
        const hasCompletedStory = !isCreateMode
          ? false
          : isAuthenticated
            ? isLoaded
              ? activeSlugs.has(story.slug)
              : undefined
            : false;

        return (
          <li
            key={story.slug}
            className={`min-w-0 ${room.storyTheme}`}
            data-story={story.slug}
            onMouseEnter={() => preloadThumbnailImage(story.coverImageUrl)}
            onTouchStart={() => preloadThumbnailImage(story.coverImageUrl)}
          >
            <StoryCard
              title={story.title}
              description={story.summary ?? undefined}
              imageUrl={story.coverImageUrl ?? undefined}
              imageFit="contain"
              priority={index < 2}
              action={
                <ActionLink
                  href={getLibraryStoryHref(story.slug, isCreateMode, hasCompletedStory)}
                  variant="primary"
                  size="compact"
                  className="w-full"
                >
                  {isCreateMode ? "이 동화로 만들기" : "동화 펼쳐 보기"}
                </ActionLink>
              }
            />
          </li>
        );
      })}
    </ul>
  );
}
