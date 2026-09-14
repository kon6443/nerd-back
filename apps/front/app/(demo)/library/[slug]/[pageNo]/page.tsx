import { storyPageParamsSchema } from "@nerd/contracts";
import { notFound } from "next/navigation";
import { BookReader } from "@/components/story/BookReader";
import { fetchStoryDetail, fetchStoryPage, orNotFound } from "@/lib/api";

/**
 * 시연 리더 — 로그인 없이 읽는다 (`(demo)` 라우트 그룹).
 *
 * ⚠️ **빌드 시점에 백엔드를 부르지 않는다** (서재 페이지와 같은 이유).
 */
export const dynamic = "force-dynamic";

export default async function StoryReaderPage({ params }: PageProps<"/library/[slug]/[pageNo]">) {
  const parsed = storyPageParamsSchema.safeParse(await params);
  // `pageNo` 는 경로에서 문자열로 온다. 스키마의 `z.coerce` 가 변환까지 맡는다 —
  // 🚫 여기서 `Number()` 로 따로 바꾸지 않는다. 백엔드와 판정이 갈린다.
  if (!parsed.success) notFound();

  const { slug, pageNo } = parsed.data;
  const story = await orNotFound(fetchStoryDetail(slug));
  if (pageNo > story.pageCount) notFound();

  // ⭐ **모든 쪽을 한 번에 받는다.** 리더는 쪽 넘김을 라우트 이동 없이 하고, 넘어가는 종이의 앞뒤에
  // 떠나는 쪽과 도착하는 쪽을 함께 그린다(`BookReader`). 쪽마다 받으면 넘길 때마다 골격 화면이 끼어든다.
  // 요청 수: 한 번 방문에 상세 1 + 쪽 N. 예전(쪽마다 상세+쪽 2회)보다 끝까지 읽을 때 오히려 적다.
  // ⚠️ 쪽이 하나라도 실패하면 리더 전체가 `error.tsx` 로 간다 — 중간 쪽이 빈 책을 보이지 않는다.
  const pages = await Promise.all(
    Array.from({ length: story.pageCount }, (_, index) => fetchStoryPage(slug, index + 1)),
  );

  return <BookReader slug={slug} title={story.title} pages={pages} initialPageNo={pageNo} />;
}
