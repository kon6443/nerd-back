"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getCachedThumbnailUrl, preloadThumbnailImage } from "@/app/(demo)/library/libraryStories";
import { StoryArtwork } from "@/components/story/StoryArtwork";
import { findMySessionBySlug } from "@/lib/api";

interface StoryDetailArtworkProps {
  slug: string;
  isCreateMode: boolean;
}

/**
 * 동화 상세 표지 삽화.
 * 제작 모드(`mode=create`)에서 로그인 사용자의 완성된 개인화 동화가 있으면 1쪽 썸네일을 표시하고,
 * 그 외(일반 모드 또는 미완성 세션)에는 기본 삽화(StoryArtwork)를 렌더링한다.
 */
export function StoryDetailArtwork({ slug, isCreateMode }: StoryDetailArtworkProps) {
  // 서재 목록에서 이미 캐시된 썸네일이 있다면 초기 렌더링 시 0ms 즉시 표시
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(() => {
    if (!isCreateMode || typeof window === "undefined") return null;
    return getCachedThumbnailUrl(slug) ?? null;
  });

  useEffect(() => {
    if (!isCreateMode) return;

    let active = true;
    findMySessionBySlug(slug)
      .then((session) => {
        if (!active) return;
        if (session?.thumbnailImageUrl) {
          setThumbnailUrl(session.thumbnailImageUrl);
          preloadThumbnailImage(session.thumbnailImageUrl);
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [isCreateMode, slug]);

  if (isCreateMode && thumbnailUrl) {
    return (
      <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl border border-line bg-surface-raised shadow-sm">
        <Image
          src={thumbnailUrl}
          alt=""
          fill
          priority
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover transition-opacity duration-300"
          unoptimized
        />
      </div>
    );
  }

  return <StoryArtwork className="aspect-4/3 rounded-xl" />;
}
