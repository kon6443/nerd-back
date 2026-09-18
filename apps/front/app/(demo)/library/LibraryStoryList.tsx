"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import type { StorySummary } from "@nerd/contracts";
import { StoryCard } from "@/components/story/StoryCard";
import room from "@/components/layout/StoryRoom.module.css";
import { ActionLink } from "@/components/ui/ActionLink";
import { preloadThumbnailImage } from "@/lib/preloadThumbnailImage";
import { getLibraryStoryHref } from "@/lib/libraryMode";
import { useSession } from "@/lib/api/useSession";
import { getMySessions } from "@/lib/api";
import { getFirstPageArt, prefetchFirstPageArt } from "./firstPageArt";
import { STORY_GRID } from "./LibraryShell";

const EMPTY_SLUGS: ReadonlySet<string> = new Set();

/**
 * 진입 연출 길이. `app/globals.css` 의 `book-enter-*` 키프레임과 **같은 값**이어야 한다.
 * 짧으면 아직 펼쳐지는 중에 화면이 바뀌고, 길면 다 덮인 화면을 들여다보게 된다.
 * 홈의 성문 연출(1450ms)보다 긴 것은 앞에 **세 바퀴 도는 구간**이 붙었기 때문이다.
 */
const ENTER_DURATION_MS = 2200;

/** 화면을 확실히 넘기는 배율. 1.0 이면 다가오는 끝에 모서리로 바깥이 비친다. */
const OVERSCAN = 1.25;

/**
 * 새 화면이 준비되기까지 기다리는 상한.
 *
 * ⚠️ **없으면 화면이 굳는다.** 전환이 끝나기를 기다리는 동안 브라우저가 스냅샷을 덮어 두는데,
 * 라우트 이동이 실패해 이 목록이 끝내 사라지지 않으면 그 덮개가 영영 안 걷힌다.
 */
const COMMIT_TIMEOUT_MS = 2000;

interface LibraryStoryListProps {
  stories: StorySummary[];
  isCreateMode: boolean;
  initialCompletedSlugs?: ReadonlySet<string>;
}

/**
 * 책 둘레에서 차례로 터지는 반짝임.
 *
 * 🚫 난수를 쓰지 않는다. 서버와 클라이언트가 다른 자리를 그리면 hydration 이 어긋나고,
 * 다시 그릴 때마다 별이 튀어 다닌다. 좌표·크기·시작 시각을 **표로 고정**한다.
 * 좌표는 표지 상자 기준이라 음수·100% 초과가 정상이다 — 별은 책 **바깥**에서도 터진다.
 */
const SPARKLES = [
  { x: "-18%", y: "14%", size: "22px", delay: "0ms" },
  { x: "108%", y: "26%", size: "30px", delay: "90ms" },
  { x: "12%", y: "-12%", size: "26px", delay: "170ms" },
  { x: "92%", y: "-8%", size: "18px", delay: "260ms" },
  { x: "-10%", y: "72%", size: "28px", delay: "330ms" },
  { x: "114%", y: "78%", size: "20px", delay: "410ms" },
  { x: "34%", y: "106%", size: "24px", delay: "480ms" },
  { x: "72%", y: "110%", size: "16px", delay: "560ms" },
  { x: "50%", y: "-18%", size: "20px", delay: "640ms" },
  { x: "-4%", y: "44%", size: "16px", delay: "720ms" },
] as const;

/** 오버레이가 책을 다시 그리는 데 필요한, 원래 표지의 자리와 모습. */
interface OpeningBook {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
  x: number;
  y: number;
  /** 표지 그림. 목록에서 이미 받아 둔 것이라 새 요청이 생기지 않는다. */
  coverUrl?: string;
  /** 펼쳐진 지면에 깔 첫 쪽 삽화. 아직 안 왔으면 비운다 — 늦게 오면 그때 떠오른다. */
  artUrl?: string;
}

/**
 * 표지의 현재 자리를 재서, 화면 한가운데를 채우기까지 필요한 변환을 구한다.
 *
 * 🚫 고정 배율을 쓰지 않는다. 카드가 격자 어디에 있고 창이 얼마나 큰지에 따라 필요한 이동량과
 * 배율이 전부 달라서, 고정값이면 어떤 카드는 화면을 못 채우고 어떤 카드는 엉뚱한 데로 날아간다.
 */
function measureBook(cover: HTMLElement, coverUrl?: string, artUrl?: string): OpeningBook | null {
  const rect = cover.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
    scale: Math.max(window.innerWidth / rect.width, window.innerHeight / rect.height) * OVERSCAN,
    x: window.innerWidth / 2 - (rect.left + rect.width / 2),
    y: window.innerHeight / 2 - (rect.top + rect.height / 2),
    coverUrl,
    artUrl,
  };
}

/**
 * 돌고 펼쳐지는 책. **`body` 에 포털한다.**
 *
 * ⚠️ 서재 목록을 감싼 `.room` 이 `overflow: clip` 이라 그 안에서 키우면 잘린다. 고정 배치만으로는
 * 부족하다 — 조상에 `transform`·`filter` 가 하나라도 생기면 고정 요소의 기준이 그리로 옮겨가
 * 다시 갇힌다. 포털은 그 가능성 자체를 없앤다.
 */
function BookEnterOverlay({ book }: { book: OpeningBook }) {
  const [artReady, setArtReady] = useState(false);
  const stage: CSSProperties = {
    left: book.left,
    top: book.top,
    width: book.width,
    height: book.height,
    ["--book-x" as string]: `${book.x}px`,
    ["--book-y" as string]: `${book.y}px`,
    ["--book-scale" as string]: String(book.scale),
  };
  /* 별은 무대 밖에 둔다 — 안에 있으면 확대에 끌려가 화면만 한 덩어리가 된다. */
  const halo: CSSProperties = { left: book.left, top: book.top, width: book.width, height: book.height };

  return (
    <div className="book-enter" aria-hidden="true">
      <div className="book-enter-sparkles" style={halo}>
        <div className="book-enter-glow" />
        {SPARKLES.map((sparkle) => (
          <i
            key={`${sparkle.x}-${sparkle.y}`}
            style={
              {
                ["--sx" as string]: sparkle.x,
                ["--sy" as string]: sparkle.y,
                ["--ss" as string]: sparkle.size,
                ["--sd" as string]: sparkle.delay,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div className="book-enter-stage" style={stage}>
        <div className="book-enter-book">
          {/* 한 바퀴 도는 동안 뒤가 비어 보이지 않게 하는 뒤표지. */}
          <div className="book-enter-shell" />

          {/* 표지 아래에 깔린 첫 쪽. 표지가 열리면 이 면이 드러나 그대로 화면을 채운다. */}
          <div className="book-enter-page">
            {book.artUrl ? (
              // `unoptimized` — 서명 URL 이라 최적화 경로를 태울 수 없고, 이미 브라우저 캐시에
              // 올려 둔 그림을 그대로 그리는 것이 목적이다(`StoryCover` 와 같은 방식).
              <Image
                className="book-enter-art"
                src={book.artUrl}
                alt=""
                fill
                unoptimized
                sizes="100vw"
                data-ready={artReady || undefined}
                onLoad={() => setArtReady(true)}
              />
            ) : null}
            <div className="book-enter-gutter" />
            <div className="book-enter-shade" />
          </div>

          {/* 표지 잎 — 앞면은 표지 그림, 뒷면은 면지다. */}
          <div className="book-enter-leaf">
            <div
              className="book-enter-leaf-face"
              style={book.coverUrl ? { backgroundImage: `url("${book.coverUrl}")` } : undefined}
            />
            <div className="book-enter-leaf-back" />
          </div>
        </div>
      </div>
      <div className="book-enter-wash" />
    </div>
  );
}

export function LibraryStoryList({
  stories,
  isCreateMode,
  initialCompletedSlugs,
}: LibraryStoryListProps) {
  const authSession = useSession();
  const router = useRouter();
  const [completedSlugs, setCompletedSlugs] = useState<ReadonlySet<string>>(
    initialCompletedSlugs ?? EMPTY_SLUGS,
  );
  const [sessionsLoaded, setSessionsLoaded] = useState(initialCompletedSlugs !== undefined);
  const [opening, setOpening] = useState<OpeningBook | null>(null);
  const commitRef = useRef<(() => void) | null>(null);
  /**
   * 연출이 끝나면 라우트를 옮기는 타이머.
   *
   * ⚠️ **정리하지 않으면 떠난 뒤에 끌려온다.** 연출 2.2초 동안 사용자가 뒤로가기나 헤더로
   * 다른 화면에 가 있어도, 타이머가 살아 있으면 그때 `router.push` 가 돌아 **보고 있던 화면에서
   * 동화로 튕긴다.**
   */
  const enterTimerRef = useRef<number | null>(null);
  /** 포인터 기울기를 켤지. 마우스가 있고 감속을 원하지 않을 때만이다(홈과 같은 기준). */
  const tiltEnabled = useRef(false);

  useEffect(() => {
    // 시연 모드(!isCreateMode)는 내 얼굴 동화 존재 여부와 무관하게 템플릿 본동화로 직행하므로 세션 조회가 불필요하다.
    if (!isCreateMode || authSession.status !== "authenticated") {
      return;
    }

    let active = true;

    getMySessions()
      .then((sessions) => {
        if (!active) return;
        const slugs = new Set(
          sessions
            .filter((s) => s.status !== "draft")
            .map((s) => s.templateSlug),
        );
        setCompletedSlugs(slugs);
      })
      .catch((err) => {
        console.warn("내 세션 조회 실패:", err);
      })
      .finally(() => {
        if (active) setSessionsLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [authSession.status, isCreateMode]);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      tiltEnabled.current = fine.matches && !calm.matches;
    };
    sync();
    fine.addEventListener("change", sync);
    calm.addEventListener("change", sync);
    return () => {
      fine.removeEventListener("change", sync);
      calm.removeEventListener("change", sync);
      if (enterTimerRef.current !== null) {
        window.clearTimeout(enterTimerRef.current);
        enterTimerRef.current = null;
      }
      // ⭐ **이 목록이 사라지는 순간이 곧 "새 화면 commit 완료"다.** 고정 시간으로 로딩 완료를
      //    추측하지 않는 것 — 홈의 진입 연출(`HomeWorld.tsx`)이 쓰는 방법과 같다.
      commitRef.current?.();
      commitRef.current = null;
    };
  }, []);

  /**
   * 카드에 관심을 보인 순간 **연출에 필요한 것을 미리 받는다.**
   * 표지는 화면에 이미 있고, 첫 쪽 삽화는 2MB 가 넘어 누른 뒤에 받기 시작하면 늦는다.
   */
  function warmStory(story: StorySummary) {
    preloadThumbnailImage(story.coverImageUrl);
    void prefetchFirstPageArt(story.slug);
  }

  /** 포인터를 따라 책을 기울인다. 값은 카드 안의 상대 위치 -1~1 이고 CSS 가 각도로 바꾼다. */
  function tiltCard(event: ReactPointerEvent<HTMLLIElement>) {
    if (!tiltEnabled.current || opening || event.pointerType === "touch") return;
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width) * 2 - 1));
    const ny = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height) * 2 - 1));
    card.style.setProperty("--book-tilt-nx", nx.toFixed(3));
    card.style.setProperty("--book-tilt-ny", ny.toFixed(3));
  }

  /** 🚫 기울기를 남겨 두지 않는다. 남으면 마우스가 떠난 책만 비뚤어진 채로 서 있다. */
  function restCard(event: ReactPointerEvent<HTMLLIElement>) {
    event.currentTarget.style.removeProperty("--book-tilt-nx");
    event.currentTarget.style.removeProperty("--book-tilt-ny");
  }

  /**
   * 카드의 링크를 가로채, 책이 돌고 펼쳐지고 그 안으로 들어가는 연출을 돌린 뒤 이동한다.
   *
   * 🚫 링크를 버튼으로 바꾸지 않는다. 새 탭 열기·주소 복사·미리보기가 전부 링크의 기능이고,
   * 아래 가드를 통과하지 못하면 **브라우저의 기본 이동이 그대로 일어난다**.
   */
  function openStory(event: MouseEvent<HTMLUListElement>) {
    if (event.defaultPrevented || event.button !== 0 || opening) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
    if (!anchor || anchor.hasAttribute("download") || (anchor.target && anchor.target !== "_self")) return;

    const destination = new URL(anchor.href);
    if (destination.origin !== window.location.origin) return;
    if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;

    // 연출을 원하지 않는 사용자에게는 손대지 않는다 — 이동 자체는 링크가 해낸다.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const card = anchor.closest<HTMLElement>("li");
    const cover = card?.querySelector<HTMLElement>("[data-story-cover]");
    if (!card || !cover) return;

    const slug = card.dataset.story;
    const story = stories.find((item) => item.slug === slug);
    const book = measureBook(cover, story?.coverImageUrl ?? undefined, slug ? getFirstPageArt(slug) : undefined);
    if (!book) return;

    event.preventDefault();
    setOpening(book);

    // 마우스를 올리지 않고 바로 누른 경우(터치·키보드)엔 아직 없다. 연출이 2.2초라 그 사이에
    // 도착하면 지면에 떠오르고, 못 오면 줄 쳐진 빈 종이로 남는다 — 어느 쪽이든 이동은 그대로다.
    if (slug && !book.artUrl) {
      void prefetchFirstPageArt(slug).then((artUrl) => {
        if (artUrl) setOpening((current) => (current ? { ...current, artUrl } : current));
      });
    }

    const href = destination.pathname + destination.search;
    router.prefetch(href);

    // 🚫 연출이 끝나기 **전에** 라우트를 옮기지 않는다. 옮기면 목록이 사라지며 펼쳐지던 책도
    //    함께 사라진다 — 홈이 카메라 비행을 끝까지 돌린 뒤에야 이동하는 이유와 같다.
    enterTimerRef.current = window.setTimeout(() => {
      enterTimerRef.current = null;
      const go = () => {
        commitRef.current = null;
        router.push(href);
      };
      if (!document.startViewTransition) {
        go();
        return;
      }
      // 워시가 덮은 마지막 프레임을 새 라우트가 commit 될 때까지 붙잡는다.
      void document
        .startViewTransition(
          () =>
            new Promise<void>((resolve) => {
              const timer = window.setTimeout(resolve, COMMIT_TIMEOUT_MS);
              commitRef.current = () => {
                window.clearTimeout(timer);
                resolve();
              };
              go();
            }),
        )
        .finished.catch(() => {
          /* 캡처를 지원하지 않아도 라우트 이동은 이미 진행됐다. */
        });
    }, ENTER_DURATION_MS);
  }

  const isAuthenticated = authSession.status === "authenticated";
  const isLoaded = isCreateMode && isAuthenticated ? sessionsLoaded : true;
  const activeSlugs = isCreateMode && isAuthenticated ? completedSlugs : EMPTY_SLUGS;

  // 서재는 모든 방문자에게 템플릿 고유 표지만 일관되게 보여준다.
  return (
    <>
      <ul
        className={`${STORY_GRID} ${opening ? "book-enter-source" : ""}`}
        onClickCapture={openStory}
        aria-busy={opening ? true : undefined}
      >
        {stories.map((story, index) => {
          const hasCompletedStory = !isCreateMode
            ? false
            : isAuthenticated
              ? isLoaded
                ? activeSlugs.has(story.slug)
                : undefined
              : false;

          return (
            <li
              key={story.slug}
              className={`min-w-0 ${room.storyTheme}`}
              data-story={story.slug}
              onMouseEnter={() => warmStory(story)}
              onTouchStart={() => warmStory(story)}
              onPointerMove={tiltCard}
              onPointerLeave={restCard}
            >
              <StoryCard
                title={story.title}
                description={story.summary ?? undefined}
                imageUrl={story.coverImageUrl ?? undefined}
                imageFit="contain"
                priority={index < 2}
                action={
                  <ActionLink
                    href={getLibraryStoryHref(story.slug, isCreateMode, hasCompletedStory)}
                    variant="primary"
                    size="compact"
                    className="w-full"
                  >
                    {isCreateMode ? "이 동화로 만들기" : "동화 펼쳐 보기"}
                  </ActionLink>
                }
              />
            </li>
          );
        })}
      </ul>
      {opening ? createPortal(<BookEnterOverlay book={opening} />, document.body) : null}
      <p className="sr-only" role="status">
        {opening ? "동화를 펼치고 있어요." : ""}
      </p>
    </>
  );
}
