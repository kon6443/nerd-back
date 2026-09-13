"use client";

import type { StoryPageView } from "@nerd/contracts";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties, type MouseEvent } from "react";
import { ActionLink } from "@/components/ui/ActionLink";
import { actionClass } from "@/components/ui/actionStyles";
import { BookArtContent, BookTextContent, BookVolume } from "./BookFrame";
import styles from "./BookFrame.module.css";
import { readerHref, readerPageNo, stackWidths, turnDirection, type TurnDirection } from "./readerNav";

/**
 * 시연 리더 — 화면을 꽉 채운 책을 **깜빡임 없이** 한 장씩 넘긴다.
 *
 * ⭐ **쪽 넘김은 라우트 이동이 아니다.** 한때 쪽마다 라우트가 바뀌어 `loading.tsx` 의 골격이 끼어들고,
 * 떠나는 쪽이 이미 사라져 넘어가는 종이에 내용을 그릴 수 없었다(2026-09-13 "깜빡인다" 보고).
 * 그래서 서버가 **모든 쪽을 한 번에** 넘기고, 여기서는 `history.pushState` 로 주소만 바꾼다.
 * Next 라우터가 pushState 를 `usePathname` 에 동기화하므로 새로고침·뒤로가기·주소 공유가 그대로 된다.
 * 🚫 넘김 버튼을 일반 `<Link>` 이동으로 되돌리지 않는다 — 서버 왕복과 골격 화면이 돌아온다.
 *
 * ⭐ **보이는 쪽(`shownPageNo`)과 주소의 쪽(`targetPageNo`)을 따로 둔다.** 둘이 다르면 넘김을 시작하고,
 * 종이가 다 넘어가야 보이는 쪽이 따라간다. 넘기는 중에 또 누르면 주소가 먼저 앞서 가고, 한 장이 끝나는
 * 대로 다음 장이 이어서 넘어간다 — 연타가 씹히지 않는다.
 */
interface Turn {
  from: number;
  to: number;
  direction: TurnDirection;
  /** 넘김 시작 시점의 화면 폭으로 정한다. 넘기는 도중 창 크기가 바뀌어도 한 장은 같은 모양으로 끝낸다. */
  layout: "spread" | "single";
}

/** `BookFrame.module.css` 의 펼침면 전환점(48rem)과 같은 값이어야 한다. */
const SPREAD_QUERY = "(min-width: 48rem)";

/** `animationend` 가 오지 않는 경우(탭 전환 등)의 안전장치. CSS 넘김 시간(700ms)보다 넉넉히 길다. */
const TURN_FALLBACK_MS = 1200;

export function BookReader({
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
  const [shownPageNo, setShownPageNo] = useState(initialPageNo);
  const [turn, setTurn] = useState<Turn | null>(null);
  const targetPageNo = readerPageNo(pathname, slug, pageCount) ?? shownPageNo;

  // 렌더 중 상태 조정 — 주소가 앞서 가 있고 넘기는 중이 아니면 한 장을 시작한다.
  // 이펙트로 옮기면 한 프레임 동안 옛 쪽이 그대로 그려진 뒤 넘김이 시작된다.
  if (!turn && targetPageNo !== shownPageNo) {
    setTurn({
      from: shownPageNo,
      to: targetPageNo,
      direction: turnDirection(shownPageNo, targetPageNo),
      layout: window.matchMedia(SPREAD_QUERY).matches ? "spread" : "single",
    });
  }

  function finishTurn() {
    if (!turn) return;
    setShownPageNo(turn.to);
    setTurn(null);
  }

  useEffect(() => {
    if (!turn) return;
    const timer = window.setTimeout(() => {
      setShownPageNo(turn.to);
      setTurn(null);
    }, TURN_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [turn]);

  // 좌우 방향키로도 넘긴다.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable]")) return;
      const next = event.key === "ArrowRight" ? targetPageNo + 1 : event.key === "ArrowLeft" ? targetPageNo - 1 : null;
      if (next === null || next < 1 || next > pageCount) return;
      event.preventDefault();
      window.history.pushState(null, "", readerHref(slug, next));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [slug, targetPageNo, pageCount]);

  /** 새 탭 열기(⌘·Ctrl·가운데 클릭)는 브라우저에 맡기고, 일반 클릭만 가로챈다. */
  function onTurnClick(event: MouseEvent<HTMLAnchorElement>, pageNo: number) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.history.pushState(null, "", readerHref(slug, pageNo));
  }

  const pageAt = (pageNo: number) => pages[pageNo - 1];
  const art = (pageNo: number) => <BookArtContent pageNo={pageNo} />;
  const text = (pageNo: number) => <BookTextContent pageNo={pageNo}>{pageAt(pageNo).bodyText}</BookTextContent>;

  // 밑에 깔리는 펼침면. 넘기는 중에는 종이가 아직 덮지 않은 면에 떠나는 쪽이, 드러난 면에 도착 쪽이 있다.
  let baseArt = shownPageNo;
  let baseText = shownPageNo;
  if (turn) {
    const nextSpread = turn.layout === "spread" && turn.direction === "next";
    const prevSpread = turn.layout === "spread" && turn.direction === "prev";
    baseArt = nextSpread ? turn.from : turn.to;
    baseText = prevSpread ? turn.from : turn.to;
  }

  // 단면 두께는 주소의 쪽을 따른다 — CSS 전환이 넘김과 같은 시간 동안 두께를 옮긴다.
  const stack = stackWidths(targetPageNo, pageCount);
  const volumeStyle = { "--stack-left": `${stack.left}px`, "--stack-right": `${stack.right}px` } as CSSProperties;

  const isFirst = targetPageNo <= 1;
  const isLast = targetPageNo >= pageCount;
  const characters = pageAt(targetPageNo).characters;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 px-4 py-3 md:h-dvh md:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        {/* ⚠️ 목적지는 서재 목록이 아니라 **이 동화의 상세**다. 라벨을 「서재로」로 두면
            전역 네비의 「서재」와 같은 곳으로 가는 것처럼 보이는데 실제로는 다르다. */}
        <ActionLink href={`/library/${slug}`} variant="ghost" size="compact">
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

      <BookVolume style={volumeStyle}>
        <div className={`${styles.book} ${styles.fill}`}>
          <div className={styles.spread}>
            <div className={styles.art}>{art(baseArt)}</div>
            <div className={styles.page}>{text(baseText)}</div>

            {turn ? (
              <div
                // 쪽 조합이 바뀌면 새 종이로 애니메이션을 처음부터 돌린다.
                key={`${turn.from}-${turn.to}`}
                aria-hidden="true"
                data-turn={turn.direction}
                className={styles.leaf}
                onAnimationEnd={(event) => {
                  // 면의 그림자(::after) 애니메이션도 버블링되어 온다. 종이 자신의 회전이 끝났을 때만 닫는다.
                  if (event.target === event.currentTarget) finishTurn();
                }}
              >
                {turn.layout === "single" ? (
                  <div className={`${styles.face} ${styles.faceStack}`}>
                    <div className={styles.art}>{art(turn.from)}</div>
                    <div className={styles.page}>{text(turn.from)}</div>
                  </div>
                ) : turn.direction === "next" ? (
                  <>
                    <div className={`${styles.page} ${styles.face}`}>{text(turn.from)}</div>
                    <div className={`${styles.art} ${styles.face} ${styles.faceBack}`}>{art(turn.to)}</div>
                  </>
                ) : (
                  <>
                    <div className={`${styles.art} ${styles.face}`}>{art(turn.from)}</div>
                    <div className={`${styles.page} ${styles.face} ${styles.faceBack}`}>{text(turn.to)}</div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </BookVolume>

      <footer className="flex flex-wrap items-center justify-between gap-3">
        {isFirst ? (
          // 🚫 링크를 숨기지 않는다 — 버튼이 사라졌다 나타나면 위치가 흔들려 오터치가 는다.
          <span aria-disabled="true" className={actionClass("ghost", "pointer-events-none opacity-40")}>
            이전
          </span>
        ) : (
          <ActionLink
            href={readerHref(slug, targetPageNo - 1)}
            variant="ghost"
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
          <ActionLink href="/library" variant="accentA">
            다 읽었어요
          </ActionLink>
        ) : (
          <ActionLink
            href={readerHref(slug, targetPageNo + 1)}
            variant="accentA"
            onClick={(event) => onTurnClick(event, targetPageNo + 1)}
          >
            다음 페이지
          </ActionLink>
        )}
      </footer>
    </main>
  );
}
