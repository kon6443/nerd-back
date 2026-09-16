"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getCachedThumbnailUrl, preloadThumbnailImage } from "@/app/(demo)/library/libraryStories";
import { StoryArtwork } from "@/components/story/StoryArtwork";
import { findMySessionBySlug } from "@/lib/api";
import { useSession } from "@/lib/api/useSession";

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
  const authSession = useSession();
  const currentLoginId = authSession.status === "authenticated" ? authSession.me.loginId : null;

  /**
   * 조회 결과. **누구 것인지 함께 들고 있는다** — 계정이 바뀌면 그 즉시 무효가 되어야 한다.
   */
  const [fetched, setFetched] = useState<{ loginId: string; url: string | null } | null>(null);

  // 서재 목록이 채워 둔 전역 캐시. 🚫 `loginId` 를 반드시 넘긴다 — 빼면 소유자 검사가
  // 통째로 생략되어(선택 인자다) 같은 탭에서 계정을 바꿨을 때 **앞사람 아이의 얼굴**이 보인다.
  // 🚫 effect 에서 setState 로 옮겨 담지 않는다 — 렌더 중 파생이면 계정이 바뀌는 순간
  //    저절로 무효가 되고, 지우는 것을 잊을 자리 자체가 없다.
  const cachedUrl = currentLoginId ? (getCachedThumbnailUrl(slug, currentLoginId) ?? null) : null;
  const thumbnailUrl = fetched?.loginId === currentLoginId ? fetched.url : cachedUrl;

  useEffect(() => {
    if (!isCreateMode || !currentLoginId) return;

    let active = true;
    // ⚠️ 로그인한 사람만 부른다 — 이 컴포넌트는 `(demo)` 공개 경로에 있어 방문자 대부분이
    //    비로그인이다. 게이트가 없으면 방문 1회마다 `GET /sessions/my` 가 401 로 쌓인다
    //    (`StorySessionActions` 가 같은 이유로 이미 게이트를 둔다).
    findMySessionBySlug(slug)
      .then((session) => {
        if (!active) return;
        const url = session?.thumbnailImageUrl ?? null;
        setFetched({ loginId: currentLoginId, url });
        if (url) preloadThumbnailImage(url);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [isCreateMode, slug, currentLoginId]);

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
