import { storySlugParamsSchema } from "@nerd/contracts";
import { notFound } from "next/navigation";
import { ActionLink } from "@/components/ui/ActionLink";
import { Card } from "@/components/ui/Card";
import { fetchStoryDetail, orNotFound } from "@/lib/api";

/**
 * 동화 상세 — 읽기 전에 무엇을 읽는지 보여준다.
 *
 * ⚠️ **빌드 시점에 백엔드를 부르지 않는다.** `force-dynamic` 이 없으면 Next 가 프리렌더하려고
 * 빌드 중에 fetch 를 시도하고, 백엔드가 없는 CI·컨테이너 빌드에서 실패한다.
 */
export const dynamic = "force-dynamic";

export default async function StoryDetailPage({ params }: PageProps<"/library/[slug]">) {
  const parsed = storySlugParamsSchema.safeParse(await params);
  // 주소창에서 아무 값이나 넣을 수 있다. 형식이 아니면 백엔드를 부르지 않고 끝낸다 —
  // 검증 스키마는 백엔드와 **같은 것**이라 두 곳의 판정이 갈리지 않는다.
  if (!parsed.success) notFound();

  const story = await orNotFound(fetchStoryDetail(parsed.data.slug));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
        <div
          className="aspect-4/3 w-full rounded-card bg-primary-soft md:w-64 md:shrink-0"
          aria-hidden="true"
        />

        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold text-ink md:text-4xl">{story.title}</h1>
          {story.summary ? <p className="text-lg text-ink-muted">{story.summary}</p> : null}
          <p className="text-ink-muted">전 {story.pageCount}장</p>

          {story.pageCount > 0 ? (
            <div className="flex flex-wrap gap-3 pt-2">
              <ActionLink href={`/library/${story.slug}/1`}>시연 동화 읽기</ActionLink>
              <ActionLink href={`/stories/${story.slug}/capture`} variant="accentA">
                📷 내 얼굴로 만들기
              </ActionLink>
            </div>
          ) : (
            // 페이지가 아직 안 들어온 동화다. 링크를 걸면 첫 페이지에서 404 를 만난다.
            <p className="pt-2 text-ink-muted">아직 페이지가 준비되지 않았어요.</p>
          )}
        </div>
      </div>

      {story.characters.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-ink">등장인물</h2>
          <ul className="flex flex-wrap gap-3">
            {story.characters.map((character) => (
              <li key={character.role}>
                {/* 🚫 persona 는 응답에 없다 — 프롬프트 설계가 노출되면 스포일러의 재료가 된다. */}
                <Card className="px-5 py-3">
                  <span className="font-bold text-ink">{character.displayName}</span>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
