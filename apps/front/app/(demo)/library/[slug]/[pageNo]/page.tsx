import { storyPageParamsSchema } from "@nerd/contracts";
import { notFound } from "next/navigation";
import { BookFrame } from "@/components/story/BookFrame";
import { ActionLink } from "@/components/ui/ActionLink";
import { actionClass } from "@/components/ui/actionStyles";
import { fetchStoryDetail, fetchStoryPage, orNotFound } from "@/lib/api";

/**
 * 시연 리더 — 로그인 없이 읽는다 (`(demo)` 라우트 그룹).
 *
 * ⚠️ **빌드 시점에 백엔드를 부르지 않는다** (서재 페이지와 같은 이유).
 */
export const dynamic = "force-dynamic";

export default async function StoryReaderPage({ params }: PageProps<"/library/[slug]/[pageNo]"> ) {
  const parsed = storyPageParamsSchema.safeParse(await params);
  // `pageNo` 는 경로에서 문자열로 온다. 스키마의 `z.coerce` 가 변환까지 맡는다 —
  // 🚫 여기서 `Number()` 로 따로 바꾸지 않는다. 백엔드와 판정이 갈린다.
  if (!parsed.success) notFound();

  const { slug, pageNo } = parsed.data;

  // 상세를 함께 부르는 이유: **마지막 페이지인지 알아야** 다음 버튼을 무엇으로 바꿀지 정해진다.
  // 다음 페이지를 미리 호출해 404 로 판정하면 매 페이지마다 헛된 요청이 하나씩 는다.
  const [story, page] = await Promise.all([
    orNotFound(fetchStoryDetail(slug)),
    orNotFound(fetchStoryPage(slug, pageNo)),
  ]);

  const isFirst = pageNo <= 1;
  const isLast = pageNo >= story.pageCount;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 p-4 md:p-8">
      <header className="flex items-center justify-between gap-4">
        {/* ⚠️ 목적지는 서재 목록이 아니라 **이 동화의 상세**다. 라벨을 「서재로」로 두면
            전역 네비의 「서재」와 같은 곳으로 가는 것처럼 보이는데 실제로는 다르다. */}
        <ActionLink href={`/library/${slug}`} className="px-6 text-base">
          동화 소개
        </ActionLink>
        <p className="text-lg font-bold text-ink-muted" aria-live="polite">
          {pageNo} / {story.pageCount}
        </p>
      </header>

      <BookFrame
        pageNo={page.pageNo}
        footer={
          <>
            {isFirst ? (
              // 🚫 링크를 숨기지 않는다 — 버튼이 사라졌다 나타나면 위치가 흔들려 오터치가 는다.
              //    같은 `actionClass` 를 써서 모양이 두 벌이 되지 않게 한다.
              <span
                aria-disabled="true"
                className={actionClass("primary", "pointer-events-none opacity-40")}
              >
                이전
              </span>
            ) : (
              <ActionLink href={`/library/${slug}/${pageNo - 1}`}>이전</ActionLink>
            )}

            {isLast ? (
              <ActionLink href="/library" variant="accentA">
                다 읽었어요
              </ActionLink>
            ) : (
              <ActionLink href={`/library/${slug}/${pageNo + 1}`} variant="accentA">
                다음 페이지
              </ActionLink>
            )}
          </>
        }
      >
        {page.bodyText}
      </BookFrame>

      {page.characters.length > 0 ? (
        <p className="text-center text-ink-muted">
          이 장면에는 {page.characters.map((character) => character.displayName).join(" · ")} 가
          있어요.
        </p>
      ) : null}
    </main>
  );
}
