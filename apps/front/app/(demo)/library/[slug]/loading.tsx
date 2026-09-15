import { ActionLink } from "@/components/ui/ActionLink";

/**
 * 동화 상세의 대기 화면.
 *
 * ⚠️ **이 파일이 없으면 부모(`library/loading.tsx`)의 폴백이 대신 쓰인다.**
 * 순수 서버 컴포넌트 스켈레톤으로 즉시 로딩 막대와 윤곽을 그린다.
 */
export default function StoryDetailLoading() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-6 md:px-10 md:py-8">
      <div>
        <ActionLink href="/library" variant="secondary" size="compact">
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
          </div>
        </div>
      </section>
    </main>
  );
}
