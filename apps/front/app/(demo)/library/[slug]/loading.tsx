import { ActionLink } from "@/components/ui/ActionLink";

/**
 * 동화 상세의 대기 화면.
 *
 * ⚠️ **이 파일이 없으면 부모(`library/loading.tsx`)의 폴백이 대신 쓰인다.** 그러면 상세를 여는데
 * **서재 목록 껍데기**(「서재 / 어떤 이야기를 읽어 볼까요?」와 목록 스켈레톤)가 먼저 뜨고 상세로
 * 통째로 바뀐다 — 실측으로 확인했다(2026-09-10: 153ms 목록 껍데기 → 2042ms 상세).
 * 🚫 자식 라우트를 부모 폴백에 맡기지 않는다. 세그먼트마다 자기 모양을 그린다.
 *
 * 「서재로 돌아가기」는 데이터가 필요 없으므로 **진짜 링크로** 둔다. 기다리는 동안에도 누를 수 있다.
 */
export default function StoryDetailLoading() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-6 md:px-10 md:py-8">
      <div>
        <ActionLink href="/library" variant="ghost" size="compact">
          서재로 돌아가기
        </ActionLink>
      </div>
      <p role="status" className="sr-only">
        동화 정보를 불러오는 중입니다.
      </p>
      <section
        aria-hidden="true"
        className="grid animate-pulse items-center gap-8 rounded-card border-2 border-line bg-surface-raised p-6 motion-reduce:animate-none md:grid-cols-2 md:p-8"
      >
        <div className="aspect-4/3 w-full rounded-xl bg-line" />
        <div className="flex min-w-0 flex-col gap-4">
          <div className="h-10 w-3/4 rounded bg-line" />
          <div className="flex flex-col gap-2">
            <div className="h-5 w-full rounded bg-line" />
            <div className="h-5 w-5/6 rounded bg-line" />
          </div>
          <div className="h-9 w-24 rounded-pill bg-line" />
          <div className="flex flex-wrap gap-3 pt-2">
            <div className="min-h-touch w-40 rounded-btn bg-line" />
            <div className="min-h-touch w-32 rounded-btn bg-line" />
          </div>
        </div>
      </section>
    </main>
  );
}
