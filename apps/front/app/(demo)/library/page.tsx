import { StoryCard } from "@/components/story/StoryCard";
import { ActionLink } from "@/components/ui/ActionLink";
import { Card } from "@/components/ui/Card";
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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-7 px-5 py-8 md:px-10 md:py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-ink md:text-4xl">서재</h1>
        <p className="text-base leading-relaxed text-ink-muted">
          어떤 이야기를 읽어 볼까요? 로그인 없이 동화를 펼쳐 보세요.
        </p>
      </div>

      {stories.length === 0 ? (
        // 백엔드는 `published` 만 내보낸다. 픽스처가 draft 면 여기가 비어 보이는 게 정상이다.
        <Card className="flex flex-col items-center gap-5 py-12 text-center">
          <p className="text-xl font-bold text-ink">아직 준비된 동화가 없어요.</p>
          <p className="text-ink-muted">새로운 이야기가 준비되면 이곳에서 만날 수 있어요.</p>
          <ActionLink href="/" variant="ghost">
            홈으로 가기
          </ActionLink>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3">
          {stories.map((story) => (
            <li key={story.slug} className="min-w-0">
              <StoryCard
                title={story.title}
                description={story.summary ?? undefined}
                action={
                  <ActionLink
                    href={`/library/${story.slug}`}
                    variant="accentA"
                    size="compact"
                    className="w-full"
                  >
                    동화 펼쳐 보기
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
