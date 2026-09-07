import { StoryCard } from "@/components/story/StoryCard";
import { ActionLink } from "@/components/ui/ActionLink";
import { fetchStories } from "@/lib/api";

/**
 * 서재 — 시연 모드의 첫 진입.
 *
 * ⚠️ **빌드 시점에 백엔드를 부르지 않는다.** `force-dynamic` 이 없으면 Next 가 프리렌더하려고
 * 빌드 중에 fetch 를 시도하고, 백엔드가 없는 CI·컨테이너 빌드에서 실패한다.
 */
export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const stories = await fetchStories();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6 md:p-8">
      <h1 className="text-3xl font-bold text-ink">동화 목록</h1>

      {stories.length === 0 ? (
        // 백엔드는 `published` 만 내보낸다. 픽스처가 draft 면 여기가 비어 보이는 게 정상이다.
        <p className="text-ink-muted">아직 준비된 동화가 없어요.</p>
      ) : (
        <ul className="flex flex-wrap gap-5">
          {stories.map((story) => (
            <li key={story.slug}>
              <StoryCard
                title={story.title}
                description={story.summary ?? undefined}
                action={
                  <ActionLink href={`/library/${story.slug}`} className="w-full px-6 text-base">
                    읽어보기
                  </ActionLink>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
