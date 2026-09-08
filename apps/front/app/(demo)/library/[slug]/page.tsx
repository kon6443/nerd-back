import { storySlugParamsSchema } from "@nerd/contracts";
import { notFound } from "next/navigation";
import { ActionLink } from "@/components/ui/ActionLink";
import { StoryArtwork } from "@/components/story/StoryArtwork";
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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-6 md:px-10 md:py-8">
      <div>
        <ActionLink href="/library" variant="ghost" size="compact">
          서재로 돌아가기
        </ActionLink>
      </div>
      <section className="grid items-center gap-8 rounded-card border-2 border-line bg-surface-raised p-6 md:grid-cols-2 md:p-8">
        <StoryArtwork className="aspect-4/3 rounded-xl" />

        <div className="flex min-w-0 flex-col gap-4">
          <h1 className="text-3xl leading-tight font-bold text-balance break-keep wrap-anywhere text-ink md:text-4xl">
            {story.title}
          </h1>
          {story.summary ? (
            <p className="text-lg leading-relaxed break-keep wrap-anywhere text-ink-muted">
              {story.summary}
            </p>
          ) : null}
          <p className="w-fit rounded-pill bg-primary-tint px-4 py-2 text-sm font-bold text-ink-muted">
            전 {story.pageCount}장
          </p>

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
      </section>

      {story.characters.length > 0 ? (
        <section className="flex flex-col gap-4 px-1" aria-labelledby="characters-title">
          <h2 id="characters-title" className="text-xl font-bold text-ink">
            이야기 속 친구들
          </h2>
          <ul className="flex flex-wrap gap-3">
            {story.characters.map((character) => (
              <li key={character.role}>
                {/* 🚫 persona 는 응답에 없다 — 프롬프트 설계가 노출되면 스포일러의 재료가 된다. */}
                <span className="inline-flex min-h-touch items-center gap-3 rounded-pill border border-line bg-surface-raised px-5 py-3 font-bold text-ink">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="size-6 shrink-0 text-primary-strong"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21v-2a8 8 0 0 1 16 0v2" strokeLinecap="round" />
                  </svg>
                  <span className="wrap-anywhere">{character.displayName}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
