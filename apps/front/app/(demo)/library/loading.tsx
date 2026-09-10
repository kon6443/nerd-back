import { LibraryShell, StoryListSkeleton } from "./LibraryShell";

/**
 * ⚠️ **`page.tsx` 와 같은 틀을 그린다.** 예전에는 여기서 화면 한가운데 안내 카드를 띄웠는데,
 * 목록이 도착하면 제목까지 포함해 화면이 통째로 바뀌어 새로고침마다 깜빡였다(2026-09-10).
 * 🚫 여기에만 다른 화면을 두지 않는다.
 */
export default function LibraryLoading() {
  return (
    <LibraryShell>
      {/* 스켈레톤은 눈으로만 읽힌다. 화면을 못 보는 사용자에게는 이 문구가 그 역할을 한다. */}
      <p role="status" className="sr-only">
        동화 목록을 불러오는 중입니다.
      </p>
      <StoryListSkeleton />
    </LibraryShell>
  );
}
