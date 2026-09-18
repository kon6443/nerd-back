"use client";

import { StoryRoom } from "@/components/layout/StoryRoom";
import room from "@/components/layout/StoryRoom.module.css";
import Link from "next/link";
import { StoryBookScene } from "@/components/story/StoryBookScene";
import { StoryIcon } from "@/components/ui/StoryIcon";
import NextImage from "next/image";
import type { SessionPagesResponse } from "@nerd/contracts";
import { actionClass } from "@/components/ui/actionStyles";

/** 완독 축하. 표지는 1쪽 삽화를 그대로 쓴다 — 별도 표지 이미지는 없다. */
export function EndView({
  sessionPages,
  onRestart,
  isDemo = false,
  storySlug,
}: {
  sessionPages: SessionPagesResponse | null;
  onRestart: () => void;
  isDemo?: boolean;
  storySlug?: string;
}) {
  const coverImage = sessionPages?.pages.find((p) => p.pageNo === 1)?.imageUrl;

  return (
    <StoryRoom className={room.readingState}>
      <span className="rounded-full border border-paper-edge bg-paper p-4 text-gold-strong">
        <StoryIcon name="star" className="size-9" />
      </span>

      <div>
        <h1 className="text-3xl font-bold text-ink">
          {isDemo ? "동화 속 주인공이 되어보러 갈까요? ✨" : "동화책을 모두 읽었어요!"}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {isDemo
            ? "단 한 장의 사진으로 세상에 하나뿐인 나만의 이야기를 만들어 보세요."
            : "내가 주인공이 된 세상에 단 하나뿐인 특별한 모험이었습니다."}
        </p>
      </div>

      {coverImage ? (
        <div className={room.completionCover}>
          <NextImage
            src={coverImage}
            alt="동화 표지"
            fill
            sizes="256px"
            className="object-cover"
            unoptimized
          />
        </div>
      ) : (
        <StoryBookScene />
      )}

      {isDemo ? (
        <div className="flex w-full flex-col gap-3">
          <Link
            href={`/stories/${storySlug || ""}/capture`}
            className={actionClass("primary", "w-full text-base font-bold")}
          >
            지금 내 사진으로 진짜 동화 만들기
          </Link>
          <button onClick={onRestart} className={actionClass("secondary", "w-full")}>
            처음부터 다시 읽기
          </button>
          <Link href="/library" className={actionClass("tertiary", "w-full text-center")}>
            서재로 돌아가기
          </Link>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-3">
          <Link href="/library" className={actionClass("primary", "w-full")}>
            서재로 돌아가기
          </Link>
          <button onClick={onRestart} className={actionClass("secondary", "w-full")}>
            처음부터 다시 읽기
          </button>
        </div>
      )}
    </StoryRoom>
  );
}
