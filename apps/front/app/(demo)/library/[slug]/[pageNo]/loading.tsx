import { BookFrameSkeleton } from "@/components/story/BookFrame";

/**
 * 시연 리더의 대기 화면.
 *
 * ⚠️ **이 파일이 없으면 부모(`library/loading.tsx`)의 폴백이 대신 쓰인다.** 그러면 책을 펼치는데
 * **서재 목록 껍데기**가 먼저 뜬다 — 실측으로 확인했다(2026-09-10: `/library/jack/1` 이 153ms 에
 * 목록 껍데기를 보였다). 🚫 자식 라우트를 부모 폴백에 맡기지 않는다.
 *
 * ⚠️ 「동화 소개」 링크는 slug 를 알아야 해서 여기서 그릴 수 없다. 대신 헤더 **자리**를 같은 높이로
 * 잡아 본문이 들어올 때 책이 위아래로 밀리지 않게 한다.
 */
export default function StoryPageLoading() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-5 md:px-8 md:py-6">
      <p role="status" className="sr-only">
        동화를 펼치는 중입니다.
      </p>
      <header
        aria-hidden="true"
        className="flex animate-pulse flex-wrap items-center justify-between gap-3 motion-reduce:animate-none"
      >
        <div className="min-h-touch w-28 rounded-btn bg-line" />
        <div className="order-first h-7 w-2/3 rounded bg-line md:order-none md:w-64" />
        <div className="h-10 w-20 rounded-pill bg-line" />
      </header>
      <BookFrameSkeleton />
    </main>
  );
}
