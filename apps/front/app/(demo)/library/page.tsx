import { ActionLink } from "@/components/ui/ActionLink";
import { Card } from "@/components/ui/Card";
import { fetchStories } from "@/lib/api";
import { isLibraryCreateMode } from "@/lib/libraryMode";
import { LibraryShell } from "./LibraryShell";
import { LibraryStoryList } from "./LibraryStoryList";
import room from "@/components/layout/StoryRoom.module.css";

/**
 * 서재 — 시연 모드의 첫 진입.
 *
 * ⚠️ **빌드 시점에 백엔드를 부르지 않는다.** `force-dynamic` 이 없으면 Next 가 프리렌더하려고
 * 빌드 중에 fetch 를 시도하고, 백엔드가 없는 CI·컨테이너 빌드에서 실패한다.
 */
export const dynamic = "force-dynamic";

/**
 * 실제 목록이 준비된 뒤 한 번에 표시한다. 한 권짜리 route skeleton과
 * 로그인 확인용 skeleton을 거치지 않으며, 주요 진입 링크가 목록을 미리 요청한다.
 */
export default async function LibraryPage({ searchParams }: PageProps<"/library">) {
  const isCreateMode = isLibraryCreateMode((await searchParams).mode);
  const stories = await fetchStories();

  if (stories.length === 0) {
    // 백엔드는 `published` 만 내보낸다. 픽스처가 draft 면 여기가 비어 보이는 게 정상이다.
    return (
      <LibraryShell>
        <Card className={`flex flex-col items-center gap-5 text-center ${room.message}`}>
          <p className="text-xl font-bold text-ink">아직 준비된 동화가 없어요.</p>
          <p className="text-ink-muted">새로운 이야기가 준비되면 이곳에서 만날 수 있어요.</p>
          <ActionLink href="/" variant="secondary">
            홈으로 가기
          </ActionLink>
        </Card>
      </LibraryShell>
    );
  }

  return (
    <LibraryShell>
      <LibraryStoryList stories={stories} isCreateMode={isCreateMode} />
    </LibraryShell>
  );
}
