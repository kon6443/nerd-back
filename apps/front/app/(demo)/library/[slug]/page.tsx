import { storySlugParamsSchema } from "@nerd/contracts";
import { notFound } from "next/navigation";
import { StoryDetailArtwork } from "@/components/story/StoryDetailArtwork";
import { getLibraryHref, isLibraryCreateMode } from "@/lib/libraryMode";
import { StorySessionActions } from "@/components/story/StorySessionActions";
import roomStyles from "@/components/layout/StoryRoom.module.css";
import { fetchStoryDetail, orNotFound } from "@/lib/api";
import { StoryDetailShell } from "./StoryDetailShell";
import styles from "./StoryDetail.module.css";

/**
 * 동화 상세 — 읽기 전에 무엇을 읽는지 보여준다.
 *
 * ⚠️ **빌드 시점에 백엔드를 부르지 않는다.** `force-dynamic` 이 없으면 Next 가 프리렌더하려고
 * 빌드 중에 fetch 를 시도하고, 백엔드가 없는 CI·컨테이너 빌드에서 실패한다.
 */
export const dynamic = "force-dynamic";

export default async function StoryDetailPage({ params, searchParams }: PageProps<"/library/[slug]">) {
  const parsed = storySlugParamsSchema.safeParse(await params);
  // 주소창에서 아무 값이나 넣을 수 있다. 형식이 아니면 백엔드를 부르지 않고 끝낸다 —
  // 검증 스키마는 백엔드와 **같은 것**이라 두 곳의 판정이 갈리지 않는다.
  if (!parsed.success) notFound();

  const isCreateMode = isLibraryCreateMode((await searchParams).mode);
  const story = await orNotFound(fetchStoryDetail(parsed.data.slug));

  return (
    <StoryDetailShell backHref={getLibraryHref(isCreateMode)} storySlug={story.slug}>
      {/* 소개와 등장인물은 같은 밝은 패널 안에 둔다(2026-09-14 요청). */}
      <section className={styles.hero}>
        <div className={styles.book}>
          <StoryDetailArtwork slug={story.slug} title={story.title} coverImageUrl={story.coverImageUrl} isCreateMode={isCreateMode} />
        </div>

        <div className={styles.intro}>
          <h1>{story.title}</h1>
          {story.summary ? (
            <p className={styles.summary}>
              {story.summary}
            </p>
          ) : null}
          <p className={styles.pageCount}>
            전 {story.pageCount}장
          </p>

          {story.pageCount > 0 ? (
            // `key` 로 동화가 바뀌면 새로 마운트시킨다 — 이전 동화의 세션이 남지 않게.
            <StorySessionActions key={story.slug} slug={story.slug} isCreateMode={isCreateMode} primaryClassName={roomStyles.primary} />
          ) : (
            // 페이지가 아직 안 들어온 동화다. 링크를 걸면 첫 페이지에서 404 를 만난다.
            <p className={styles.summary}>아직 페이지가 준비되지 않았어요.</p>
          )}
        </div>
      </section>

      {story.characters.length > 0 ? (
        <section className={styles.characters} aria-labelledby="characters-title">
          <h2 id="characters-title">
            이야기 속 친구들
          </h2>
          <ul className="flex flex-wrap gap-3">
            {story.characters.map((character) => (
              <li key={character.role}>
                {/* 🚫 persona 는 응답에 없다 — 프롬프트 설계가 노출되면 스포일러의 재료가 된다. */}
                <span className={styles.character}>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="size-6 shrink-0"
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
    </StoryDetailShell>
  );
}
