import type { ReactNode } from "react";
import styles from "./StoryRoom.module.css";

/** 홈의 종이·표지 재질을 잇는 페이지 배경. 별도 canvas나 animation loop가 없다. */
export function StoryRoom({ children, className = "", storySlug }: { children: ReactNode; className?: string; storySlug?: string }) {
  return (
    <main className={`${styles.room} ${styles.storyTheme} ${className}`} data-story={storySlug}>
      <div className={styles.window} aria-hidden="true"><span /><span /></div>
      <div className={styles.content}>{children}</div>
    </main>
  );
}

export function BookEmblem() {
  return (
    <svg viewBox="0 0 96 96" fill="none" aria-hidden="true" focusable="false">
      <path d="M48 27c-10-8-22-8-31-5v43c10-3 21-2 31 6 10-8 21-9 31-6V22c-9-3-21-3-31 5Zm0 0v44" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M25 34c5-1 10 0 15 3m-15 8c5-1 10 0 15 3m16-11c5-3 10-4 15-3m-15 14c5-3 10-4 15-3M48 6v8M32 10l4 7M64 10l-4 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m48 82 3 4-3 4-3-4Z" fill="currentColor" />
    </svg>
  );
}

/** CSS perspective로 만든 장식용 책. 입력/스크린리더 경로에는 참여하지 않는다. */
export function BookStack({ className = "" }: { className?: string }) {
  return (
    <div className={`${styles.books} ${className}`} aria-hidden="true">
      <div className={styles.bottomBook} />
      <div className={styles.middleBook} />
      <div className={styles.standingBook}>
        <div className={styles.bookFace}>
          <span className={styles.ribbon} />
          <span className={styles.bookName}>베이비북스</span>
          <BookEmblem />
          <span className={styles.bookRule} />
        </div>
      </div>
    </div>
  );
}
