"use client";

import type { StorySummary } from "@nerd/contracts";
import { useEffect, useState } from "react";
import { StoryCard } from "@/components/story/StoryCard";
import { ActionLink } from "@/components/ui/ActionLink";
import { getMySessions } from "@/lib/api";
import { useSession } from "@/lib/api/useSession";
import { getLibraryStoryHref } from "@/lib/libraryMode";
import { STORY_GRID } from "./LibraryShell";
import {
  getCompletedThumbnailUrls,
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
  const [thumbnails, setThumbnails] = useState<OwnedThumbnailUrls | null>(() => {
    if (typeof window === "undefined") return null;
    // 이전 방문에서 캐시된 썸네일이 있다면 0ms 즉시 표시
    return null;
  });

  // 1. 세션 정보를 인증 완료를 기다리지 않고 마운트 즉시 병렬 요청 (쿠키 기반)
  useEffect(() => {
    let active = true;

    getMySessions()
      .then((sessions) => {
        if (!active) return;
        const urls = getCompletedThumbnailUrls(sessions);
        // 브라우저 백그라운드 디코딩 프리로드 — 카드 표시 및 상세 이동 시 0ms 즉시 표시
        for (const url of urls.values()) {
          preloadThumbnailImage(url);
        }

        const owned: OwnedThumbnailUrls = {
          ownerLoginId: currentLoginId ?? "anonymous",
          urls,
        };
        setCachedThumbnailUrls(owned);
        setThumbnails(owned);
      })
      .catch((error: unknown) => {
        // 비로그인 상태이거나 실패 시 기본 삽화 유지
        console.warn("서재 개인화 썸네일 조회 실패:", error);
      });

    return () => {
      active = false;
    };
  }, [currentLoginId]);

  return (
    <ul className={STORY_GRID}>
      {stories.map((story, index) => {
        const thumbnailUrl = getOwnedThumbnailUrl(thumbnails, currentLoginId, story.slug);
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
