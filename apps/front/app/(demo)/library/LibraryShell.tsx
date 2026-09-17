import type { ReactNode } from "react";
import { BookStack, StoryRoom } from "@/components/layout/StoryRoom";
import room from "@/components/layout/StoryRoom.module.css";

/**
 * 서버가 조회한 실제 동화 목록과 함께 표시하는 서재의 고정 틀.
 * 목록 준비 전에는 이전 화면을 유지해 한 권짜리 대체 화면으로 전환하지 않는다.
 */
export function LibraryShell({ children }: { children: ReactNode }) {
  return (
    <StoryRoom className={room.library}>
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

/** 서재 목록 격자. */
export const STORY_GRID = room.shelf;
