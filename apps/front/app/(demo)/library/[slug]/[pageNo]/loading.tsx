import { BookFrameSkeleton } from "@/components/story/BookFrame";

/**
 * 시연 리더의 대기 화면 — **책을 처음 펼칠 때만** 보인다. 쪽 넘김은 라우트 이동이 아니라 여기를 거치지 않는다.
 *
 * ⚠️ **이 파일이 없으면 부모(`library/loading.tsx`)의 폴백이 대신 쓰인다.** 그러면 책을 펼치는데
 * **서재 목록 껍데기**가 먼저 뜬다 — 실측으로 확인했다(2026-09-10: `/library/jack/1` 이 153ms 에
 * 목록 껍데기를 보였다). 🚫 자식 라우트를 부모 폴백에 맡기지 않는다.
 *
 * ⭐ 틀은 `BookReader` 와 같다(화면을 채우는 책 + 위아래 조작 줄). 달라지면 본문이 들어올 때 책이 튄다.
 */
export default function StoryPageLoading() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 px-4 py-3 md:h-dvh md:px-6">
      <p role="status" className="sr-only">
        동화를 펼치는 중입니다.
      </p>
      <header
        aria-hidden="true"
        className="flex animate-pulse flex-wrap items-center justify-between gap-3 motion-reduce:animate-none"
      >
        <div className="min-h-touch w-28 rounded-btn bg-line" />
        <div className="order-first h-7 w-2/3 rounded bg-line md:order-none md:w-64" />
        {/* 쪽 번호 + 「내 얼굴로 체험하기」 자리. */}
        <div className="flex items-center gap-2">
          <div className="h-10 w-16 rounded-pill bg-line" />
          <div className="h-12 w-40 rounded-btn bg-line" />
        </div>
      </header>
      <BookFrameSkeleton fill />
      <div aria-hidden="true" className="flex animate-pulse items-center justify-between gap-3 motion-reduce:animate-none">
        <div className="min-h-touch w-24 rounded-btn bg-line" />
        <div className="min-h-touch w-36 rounded-btn bg-line" />
      </div>
    </main>
  );
}
