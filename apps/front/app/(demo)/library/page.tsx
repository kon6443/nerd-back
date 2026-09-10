import { StoryCard } from "@/components/story/StoryCard";
import { ActionLink } from "@/components/ui/ActionLink";
import { Card } from "@/components/ui/Card";
import { fetchStories } from "@/lib/api";
import { LibraryShell, STORY_GRID } from "./LibraryShell";

/**
 * 서재 — 시연 모드의 첫 진입.
 *
 * ⚠️ **빌드 시점에 백엔드를 부르지 않는다.** `force-dynamic` 이 없으면 Next 가 프리렌더하려고
 * 빌드 중에 fetch 를 시도하고, 백엔드가 없는 CI·컨테이너 빌드에서 실패한다.
 */
export const dynamic = "force-dynamic";

/**
 * ⭐ **깜빡임은 `loading.tsx` 가 같은 틀을 그려서 해결한다.** 예전에는 로딩이 화면 한가운데 안내
 * 카드였고, 목록이 오면 제목까지 포함해 화면이 통째로 바뀌었다(2026-09-10 보고).
 *
 * 목록만 `Suspense` 로 감싸 껍데기를 먼저 흘리는 방식도 **된다.** 한때 이 자리에 "그렇게 하면
 * 에러 화면이 영영 안 뜬다" 고 적혀 있었으나, 재측정해 보니 **두 구조 모두 백엔드 500 에서
 * `error.tsx` 가 1초 안에 뜬다**(2026-09-10). 앞선 관측은 죽은 서버가 포트를 잡고 있어 옛 빌드를
 * 본 것이었다. 여기서 최상단 `await` 를 쓰는 이유는 에러 때문이 아니라 **`loading.tsx` 가 이미
 * 같은 틀을 그려서 구조가 더 단순하기 때문**이다.
 */
export default async function LibraryPage() {
  const stories = await fetchStories();

  if (stories.length === 0) {
    // 백엔드는 `published` 만 내보낸다. 픽스처가 draft 면 여기가 비어 보이는 게 정상이다.
    return (
      <LibraryShell>
        <Card className="flex flex-col items-center gap-5 py-12 text-center">
          <p className="text-xl font-bold text-ink">아직 준비된 동화가 없어요.</p>
          <p className="text-ink-muted">새로운 이야기가 준비되면 이곳에서 만날 수 있어요.</p>
          <ActionLink href="/" variant="ghost">
            홈으로 가기
          </ActionLink>
        </Card>
      </LibraryShell>
    );
  }

  return (
    <LibraryShell>
      <ul className={STORY_GRID}>
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
    </LibraryShell>
  );
}
