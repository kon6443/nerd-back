import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { BookStack, StoryRoom } from "@/components/layout/StoryRoom";
import room from "@/components/layout/StoryRoom.module.css";
import book from "@/components/story/StoryCard.module.css";

/**
 * 서재의 고정 틀 — 제목과 안내는 **데이터를 기다리지 않는다.**
 *
 * ⭐ `loading.tsx` 와 `page.tsx` 가 **같은 틀**을 쓴다. 로딩 화면이 다르게 생기면 목록이 도착할 때
 * 화면이 통째로 바뀌고, 그것이 새로고침마다 보이던 깜빡임이다(2026-09-10 보고).
 * 🚫 한쪽만 고치지 않는다 — 두 화면이 갈리는 순간 깜빡임이 되돌아온다.
 */
export function LibraryShell({ children }: { children: ReactNode }) {
  return (
    <StoryRoom>
      <header className={room.libraryHeading}>
        <div>
          <h1>서재</h1>
          <p>어떤 이야기를 읽어 볼까요? 로그인 없이 동화를 펼쳐 보세요.</p>
        </div>
        <BookStack className={room.libraryBooks} />
      </header>
      {children}
    </StoryRoom>
  );
}

/** 목록 격자. 실제 목록과 스켈레톤이 **같은 격자**를 써야 카드가 채워질 때 자리가 흔들리지 않는다. */
export const STORY_GRID = room.shelf;

/**
 * 목록이 도착하기 전 자리를 지키는 카드.
 *
 * `StoryCard` 와 같은 구조다 — 4:3 썸네일, 제목, 설명 두 줄, 하단 버튼.
 * 🚫 문구 한 줄로 대신하지 않는다. 목록이 채워지는 순간 아래가 통째로 밀린다.
 *
 * 한 장만 그려 데이터 개수를 약속하지 않는다. 표지 비율·padding·격자는 실제 카드와 공유한다.
 */
export function StoryListSkeleton() {
  return (
    <ul className={STORY_GRID} aria-hidden="true">
      <li className="min-w-0">
        <Card inset="snug" className={`h-full w-full animate-pulse motion-reduce:animate-none ${book.card}`}>
          <div className="flex h-full flex-col gap-4">
            <div className={book.cover}><div className={book.blankCover} /></div>
            <div className="flex flex-col gap-2">
              <div className="h-7 w-2/3 rounded bg-line" />
              <div className="h-4 w-full rounded bg-line" />
              <div className="h-4 w-4/5 rounded bg-line" />
            </div>
            <div className="mt-auto pt-1">
              <div className="min-h-touch w-full rounded-btn bg-line" />
            </div>
          </div>
        </Card>
      </li>
    </ul>
  );
}
