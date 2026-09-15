"use client";

import type { StoryPageView } from "@nerd/contracts";
import { usePathname } from "next/navigation";
import { useCallback, useMemo, useState, type MouseEvent } from "react";
import { ActionLink } from "@/components/ui/ActionLink";
import { actionClass } from "@/components/ui/actionStyles";
import { BookArtContent, BookTextContent } from "./BookFrame";
import { BookPager, READER_BAR } from "./BookPager";
import { readerHref, readerPageNo } from "./readerNav";
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

  const requestPage = useCallback(
    (pageNo: number) => {
      window.history.pushState(null, "", readerHref(slug, pageNo));
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
  const characters = pages[targetPageNo - 1].characters;
  const activePage = pages[targetPageNo - 1];
  const narrationPreloads = useMemo(
    () => [activePage.narrationAudioUrl, pages[targetPageNo]?.narrationAudioUrl],
    [activePage.narrationAudioUrl, pages, targetPageNo],
  );
  const narration = useNarration({
    pageKey: `demo:${slug}:${targetPageNo}`,
    audioUrl: activePage.narrationAudioUrl,
    preloadUrls: narrationPreloads,
  });

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 px-4 py-3 md:h-dvh md:px-6">
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
            내 얼굴로 체험하기
          </ActionLink>
        </div>
      </header>

      <BookPager
        pageNo={targetPageNo}
        pageCount={pageCount}
        onRequestPage={requestPage}
        renderArt={(pageNo) => <BookArtContent pageNo={pageNo} />}
        renderText={(pageNo) => (
          <BookTextContent pageNo={pageNo}>{pages[pageNo - 1].bodyText}</BookTextContent>
        )}
        renderTextControls={() => (
          <NarrationPlayer
            audioUrl={activePage.narrationAudioUrl}
            enabled={narration.enabled}
            onPlay={narration.play}
            onPause={narration.pause}
            onRestart={narration.restart}
          />
        )}
      />

      <footer className={READER_BAR}>
        {isFirst ? (
          // 🚫 링크를 숨기지 않는다 — 버튼이 사라졌다 나타나면 위치가 흔들려 오터치가 는다.
          <span aria-disabled="true" className={actionClass("secondary", "pointer-events-none opacity-40")}>
            이전
          </span>
        ) : (
          <ActionLink
            href={readerHref(slug, targetPageNo - 1)}
            variant="secondary"
            onClick={(event) => onTurnClick(event, targetPageNo - 1)}
          >
            이전
          </ActionLink>
        )}

        <p className="order-last w-full text-center text-ink-muted md:order-none md:w-auto md:flex-1">
          {characters.length > 0
            ? `이 장면에는 ${characters.map((character) => character.displayName).join(" · ")} 가 있어요.`
            : null}
        </p>

        {isLast ? (
          <ActionLink href="/library" variant="primary">
            다 읽었어요
          </ActionLink>
        ) : (
          <ActionLink
            href={readerHref(slug, targetPageNo + 1)}
            variant="primary"
            onClick={(event) => onTurnClick(event, targetPageNo + 1)}
          >
            다음 페이지
          </ActionLink>
        )}
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
