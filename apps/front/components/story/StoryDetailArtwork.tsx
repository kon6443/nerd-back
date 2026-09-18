"use client";

import { StoryCover } from "@/components/story/StoryCard";

interface StoryDetailArtworkProps {
  slug?: string;
  title: string;
  coverImageUrl?: string | null;
  isCreateMode?: boolean;
}

/**
 * 동화 상세 표지 삽화.
 * 서재에서는 템플릿 기본 표지를 항상 표시하며, 표지가 없으면 제목이 새겨진 책을 렌더링한다.
 */
export function StoryDetailArtwork({ title, coverImageUrl }: StoryDetailArtworkProps) {
  return (
    <StoryCover
      title={title}
      imageUrl={coverImageUrl ?? undefined}
      imageFit="contain"
      priority
    />
  );
}
