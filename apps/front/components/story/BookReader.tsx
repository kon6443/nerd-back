"use client";

import type { StoryPageView } from "@nerd/contracts";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { preloadThumbnailImage } from "@/lib/preloadThumbnailImage";
import { ActionLink } from "@/components/ui/ActionLink";
import { actionClass } from "@/components/ui/actionStyles";
import { BookArtContent, BookTextContent } from "./BookFrame";
import { BookPager, READER_BAR } from "./BookPager";
import { adjacentArtUrls, readerHref, readerPageNo } from "./readerNav";
import { NarrationPlayer } from "./NarrationPlayer";
import { ReaderAudioProvider } from "./ReaderAudioProvider";
import { useNarration } from "./useNarration";

/**
 * 시연 리더 — 화면을 꽉 채운 책을 **깜빡임 없이** 한 장씩 넘긴다.
 *
 * 넘김 자체는 `BookPager` 가 한다. 여기 남은 것은 **주소와 쪽을 잇는 일**이다.
 *
 * ⭐ **쪽 넘김은 라우트 이동이 아니다.** 한때 쪽마다 라우트가 바뀌어 `loading.tsx` 의 골격이 끼어들고,
 * 떠나는 쪽이 이미 사라져 넘어가는 종이에 내용을 그릴 수 없었다(2026-09-13 "깜빡인다" 보고).
 * 그래서 서버가 **모든 쪽을 한 번에** 넘기고, 여기서는 `history.pushState` 로 주소만 바꾼다.
 * Next 라우터가 pushState 를 `usePathname` 에 동기화하므로 새로고침·뒤로가기·주소 공유가 그대로 된다.
 * 🚫 넘김 버튼을 일반 `<Link>` 이동으로 되돌리지 않는다 — 서버 왕복과 골격 화면이 돌아온다.
 */
function BookReaderContent({
  slug,
  title,
  pages,
  initialPageNo,
}: {
  slug: string;
  title: string;
  /** 1쪽부터 **순서대로** 전부. 서버 페이지가 채운다. */
  pages: StoryPageView[];
  initialPageNo: number;
}) {
  const pageCount = pages.length;
  const pathname = usePathname();

  // 주소가 이 동화의 유효한 쪽을 가리키지 않는 순간(다른 라우트로 떠나는 중 등)에는 **마지막 유효한
  // 쪽을 유지한다.** 초기 쪽으로 되돌리면 화면을 떠나는 찰나에 엉뚱한 넘김이 한 장 돈다.
  const [lastValidPageNo, setLastValidPageNo] = useState(initialPageNo);
  const parsedPageNo = readerPageNo(pathname, slug, pageCount);
  const targetPageNo = parsedPageNo ?? lastValidPageNo;
  if (parsedPageNo !== null && parsedPageNo !== lastValidPageNo) {
    setLastValidPageNo(parsedPageNo);
  }

  // ⭐ **인접 쪽 삽화를 미리 받는다.** 서버가 모든 쪽을 한 번에 넘기므로 URL 은 이미 알고 있는데,
  //    예전에는 넘긴 뒤에야 브라우저가 이미지를 요청해 **넘김 중 빈 칸이 스쳤다.**
  //    체험 리더는 진작 전 쪽을 미리 받고 있었다(`read/page.tsx`) — 시연 쪽만 빠져 있었다.
  //    🚫 전 쪽을 한꺼번에 받지 않는다. 첫 화면 대역폭을 늘려 정작 지금 볼 쪽이 늦어진다.
  //    `preloadThumbnailImage` 는 LRU 로 중복을 걸러 주므로 쪽마다 불러도 재요청이 없다.
  useEffect(() => {
    for (const url of adjacentArtUrls(
      pages.map((page) => page.baseImageUrl),
      targetPageNo,
    )) {
      preloadThumbnailImage(url);
    }
  }, [pages, targetPageNo]);

  const requestPage = useCallback(
    (pageNo: number) => {
      if (typeof window !== "undefined") {
        window.history.pushState(null, "", readerHref(slug, pageNo));
      }
    },
    [slug],
  );

  /** 새 탭 열기(⌘·Ctrl·가운데 클릭)는 브라우저에 맡기고, 일반 클릭만 가로챈다. */
  function onTurnClick(event: MouseEvent<HTMLAnchorElement>, pageNo: number) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    requestPage(pageNo);
  }

  const isFirst = targetPageNo <= 1;
  const isLast = targetPageNo >= pageCount;
  const activePage = pages[targetPageNo - 1];
  const characters = activePage?.characters ?? [];
  const narrationPreloads = useMemo(
    () => [activePage?.narrationAudioUrl, pages[targetPageNo]?.narrationAudioUrl],
    [activePage?.narrationAudioUrl, pages, targetPageNo],
  );
  const narration = useNarration({
    pageKey: `demo:${slug}:${targetPageNo}`,
    audioUrl: activePage?.narrationAudioUrl ?? null,
    preloadUrls: narrationPreloads,
  });

  return (
    // 아래 여백은 **고정 하단바의 자리**다(모바일 2줄 ~110px · 넓은 화면 1줄 ~82px). 없으면 바가 책·낭독 조작을 덮는다.
    // ⚠️ `md:flex-none` — 부모가 높이 미정인 flex 라 `flex-1` 만 두면 `h-dvh` 가 무시되고 책이 본문 길이만큼
    //    커져 고정 바 밑으로 들어간다. 높이가 확정돼야 책이 줄고 본문이 쪽 안에서 스크롤된다.
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 px-4 pt-3 pb-32 md:h-dvh md:flex-none md:px-6 md:pb-24">
      <header className={READER_BAR}>
        {/* ⚠️ 목적지는 서재 목록이 아니라 **이 동화의 상세**다. 라벨을 「서재로」로 두면
            전역 네비의 「서재」와 같은 곳으로 가는 것처럼 보이는데 실제로는 다르다. */}
        <ActionLink href={`/library/${slug}`} variant="secondary" size="compact">
          동화 소개
        </ActionLink>
        <h1 className="order-first w-full text-xl font-bold text-balance break-keep wrap-anywhere text-ink md:order-none md:w-auto md:flex-1 md:text-center">
          {title}
        </h1>
        <div className="flex items-center gap-2">
          <p className="rounded-pill bg-surface-raised px-4 py-2 text-sm font-bold text-ink-muted" aria-live="polite">
            {targetPageNo} / {pageCount}
          </p>
          {/* 시연을 읽다가 바로 개인화로 넘어가는 입구. 비로그인이면 촬영 화면이 로그인으로 보낸다
              (`stories/[slug]/capture`) — 여기서 세션을 조회하지 않는다(공개 경로에서 인증 API 금지). */}
          <ActionLink href={`/stories/${slug}/capture`} variant="primary" size="compact">
            내 얼굴로 만들기
          </ActionLink>
        </div>
      </header>

      <BookPager
        pageNo={targetPageNo}
        pageCount={pageCount}
        onRequestPage={requestPage}
        renderArt={(pageNo) => (
          <BookArtContent pageNo={pageNo} imageUrl={pages[pageNo - 1]?.baseImageUrl} />
        )}
        renderText={(pageNo) => (
          <BookTextContent pageNo={pageNo}>{pages[pageNo - 1]?.bodyText ?? ""}</BookTextContent>
        )}
        renderTextControls={() => (
          <NarrationPlayer
            audioUrl={activePage?.narrationAudioUrl ?? null}
            enabled={narration.enabled}
            onPlay={narration.play}
            onPause={narration.pause}
            onRestart={narration.restart}
          />
        )}
      />

      {/*
        ⭐ **흰 고정 하단바**(2026-09-18 요청) — 설명 문구가 풍경 위에 떠 있어 읽히지 않았다. 체험 리더의 하단바와 같은 모양이다.
        이전·다음은 **같은 폭**이다: 모바일은 두 칸을 반씩, 넓은 화면은 양끝 15rem. 크기가 다르면 한쪽이 더 중요해 보인다 —
        중요도는 크기가 아니라 색(secondary < primary)이 말한다.
        설명 줄은 등장인물이 없는 쪽에서도 **자리를 지킨다**(`min-h`) — 쪽마다 바 높이가 바뀌면 책이 출렁인다.
      */}
      <footer className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-line bg-surface-raised/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
        <div className="mx-auto grid w-full max-w-7xl grid-cols-2 items-center gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[15rem_minmax(0,1fr)_15rem] md:gap-x-4 md:px-6">
          {isFirst ? (
            // 🚫 링크를 숨기지 않는다 — 버튼이 사라졌다 나타나면 위치가 흔들려 오터치가 는다.
            <span
              aria-disabled="true"
              className={actionClass("secondary", "row-start-2 w-full pointer-events-none opacity-40 md:row-start-1", "compact")}
            >
              이전
            </span>
          ) : (
            <ActionLink
              href={readerHref(slug, targetPageNo - 1)}
              variant="secondary"
              size="compact"
              className="row-start-2 w-full md:row-start-1"
              onClick={(event) => onTurnClick(event, targetPageNo - 1)}
            >
              이전
            </ActionLink>
          )}

          <p className="col-span-2 row-start-1 min-h-5 text-center text-sm font-medium text-ink break-keep md:col-span-1 md:col-start-2 md:text-base">
            {characters.length > 0
              ? `이 장면에는 ${characters.map((character) => character.displayName).join(" · ")} 가 있어요.`
              : null}
          </p>

          {isLast ? (
            <ActionLink href="/library" variant="primary" size="compact" className="row-start-2 w-full md:col-start-3 md:row-start-1">
              다 읽었어요
            </ActionLink>
          ) : (
            <ActionLink
              href={readerHref(slug, targetPageNo + 1)}
              variant="primary"
              size="compact"
              className="row-start-2 w-full md:col-start-3 md:row-start-1"
              onClick={(event) => onTurnClick(event, targetPageNo + 1)}
            >
              다음 페이지
            </ActionLink>
          )}
        </div>
      </footer>
    </main>
  );
}

export function BookReader(props: {
  slug: string;
  title: string;
  pages: StoryPageView[];
  initialPageNo: number;
}) {
  return (
    <ReaderAudioProvider>
      <BookReaderContent {...props} />
    </ReaderAudioProvider>
  );
}
