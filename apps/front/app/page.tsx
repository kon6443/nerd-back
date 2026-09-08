import { ActionLink } from "@/components/ui/ActionLink";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-5 py-12 text-center sm:px-8 md:py-16">
      <p className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-pill border border-line bg-surface-raised/90 px-4 text-sm font-semibold text-ink-muted shadow-sm">
        <span className="h-2.5 w-2.5 rounded-full bg-accent-a" aria-hidden="true" />
        4–9세 · 태블릿 가로
      </p>
      <h1 className="max-w-3xl text-balance text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl md:text-6xl">
        <span className="md:block">동화 속 주인공이</span>{" "}
        <span className="md:block">바로 나예요</span>
      </h1>
      <p className="mt-5 max-w-xl text-pretty text-base leading-7 text-ink-muted sm:text-lg">
        시연 동화를 펼치고, 이야기 속 주인공을 만나 보세요.
      </p>
      <div className="mt-8 flex w-full max-w-xl flex-col justify-center gap-3 sm:flex-row">
        <ActionLink href="/library" variant="accentA" className="w-full sm:w-auto">
          시연 동화 보기
        </ActionLink>
        <ActionLink href="/login" variant="gold" className="w-full sm:w-auto">
          로그인하기
        </ActionLink>
      </div>
      <p className="mt-4 text-sm font-medium text-ink-muted">시연은 로그인 없이 바로 볼 수 있어요.</p>
    </main>
  );
}
