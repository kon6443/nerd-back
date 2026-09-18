"use client";

import type { StorySummary } from "@nerd/contracts";
import { StoryCard } from "@/components/story/StoryCard";
import room from "@/components/layout/StoryRoom.module.css";
import { ActionLink } from "@/components/ui/ActionLink";
import { preloadThumbnailImage } from "@/lib/preloadThumbnailImage";
import { getLibraryStoryHref } from "@/lib/libraryMode";
import { STORY_GRID } from "./LibraryShell";

interface LibraryStoryListProps {
  stories: StorySummary[];
  isCreateMode: boolean;
}

export function LibraryStoryList({ stories, isCreateMode }: LibraryStoryListProps) {
  // 서재는 모든 방문자에게 템플릿 고유 표지만 일관되게 보여준다.
  return (
    <ul className={STORY_GRID}>
      {stories.map((story, index) => (
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
            priority
            action={
              <ActionLink
                href={getLibraryStoryHref(story.slug, isCreateMode)}
                variant="primary"
                size="compact"
                className="w-full"
              >
                {isCreateMode ? "이 동화로 만들기" : "동화 펼쳐 보기"}
              </ActionLink>
            }
          />
        </li>
      ))}
    </ul>
  );
}
