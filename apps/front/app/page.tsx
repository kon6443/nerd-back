import { ActionLink } from "@/components/ui/ActionLink";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 p-8 text-center">
      <h1 className="text-4xl font-bold text-ink">나만의 동화 나라</h1>
      <p className="text-lg text-ink-muted">동화 속 주인공이 되어보세요!</p>

      <ActionLink href="/library">동화 보러 가기</ActionLink>
    </main>
  );
}
