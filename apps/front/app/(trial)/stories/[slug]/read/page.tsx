"use client";

import { Suspense, use, useCallback, useEffect, useRef, useState } from "react";
import { preconnect } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { StatusEmblem } from "@/components/ui/StatusEmblem";
import { CenteredPage } from "@/components/ui/CenteredPage";
import { LoadingView } from "@/components/ui/LoadingView";
import { actionClass, FOCUS_RING } from "@/components/ui/actionStyles";
import { BookArtContent, BookTextContent } from "@/components/story/BookFrame";
import { BookPager, READER_BAR } from "@/components/story/BookPager";
import { isReaderReady } from "./readiness";
import { isAfterStoryGenerating } from "./polling";
import { usePolling } from "./usePolling";
import { BranchView } from "./BranchView";
import { CharacterChat } from "./CharacterChat";
import { EndView } from "./EndView";
import { GeneratingView } from "./GeneratingView";
import { ChatLauncher } from "./ChatLauncher";
import { ChatSurface } from "./ChatSurface";
import { ReaderPreviewSettings } from "./ReaderPreviewSettings";
import { parseReaderOptions } from "./readerOptions";
import { useCharacterChat } from "./useCharacterChat";
import { createChatDraftStore } from "./chat-drafts";
import { SESSION_CHANGED_EVENT, UNAUTHORIZED_EVENT } from "@/lib/api/client";
import {
  ApiError,
  fetchAfterStory,
  fetchStoryDetail,
  fetchStoryPages,
  fetchSessionPages,
  personalizeSession,
  retryAfterStoryPage,
  retrySessionPage,
  selectAfterStoryChoice,
} from "@/lib/api";
import type {
  AfterStoryResponse,
  SessionPagesResponse,
  StoryBranchKey,
  StoryChatBranchKey,
  StoryDetail,
  StoryPageView,
} from "@nerd/contracts";

/** 대화 표면의 제목 — 껍데기가 이 id 로 자기 이름을 가리킨다. */
const CHAT_TITLE_ID = "character-chat-title";

interface PageProps {
  params: Promise<{ slug: string }>;
}

type ViewState = "loading" | "generating" | "reader" | "branch" | "end";

function getFirstPageImageUrl(sessionPages: SessionPagesResponse) {
  return sessionPages.pages.find(
    (page) => page.branchKey === "common" && page.pageNo === 1,
  )?.imageUrl;
}

function StoryReadContent({ params }: PageProps) {
  const { slug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId");
  const autoStart = searchParams.get("autoStart") === "true";

  const [chatDrafts] = useState(createChatDraftStore);
  useEffect(() => {
    const clearDrafts = () => chatDrafts.clear();
    window.addEventListener(SESSION_CHANGED_EVENT, clearDrafts);
    window.addEventListener(UNAUTHORIZED_EVENT, clearDrafts);
    return () => {
      chatDrafts.clear();
      window.removeEventListener(SESSION_CHANGED_EVENT, clearDrafts);
      window.removeEventListener(UNAUTHORIZED_EVENT, clearDrafts);
    };
  }, [chatDrafts]);

  const [viewState, setViewState] = useState<ViewState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [storyPages, setStoryPages] = useState<StoryPageView[]>([]);
  const [sessionPages, setSessionPages] = useState<SessionPagesResponse | null>(null);
  const [afterStory, setAfterStory] = useState<AfterStoryResponse | null>(null);
  const [currentPageNo, setCurrentPageNo] = useState(1);
  const [activeBranchKey, setActiveBranchKey] = useState<StoryBranchKey | null>(null);
  const [isAfterStoryLoading, setIsAfterStoryLoading] = useState(false);
  const [isSelectingBranch, setIsSelectingBranch] = useState<StoryBranchKey | null>(null);
  const [afterStoryError, setAfterStoryError] = useState("");
  const [retryingPageNo, setRetryingPageNo] = useState<number | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const preloadedImagesRef = useRef(
    new Map<string, { image: HTMLImageElement; loaded: Promise<void> }>(),
  );
  const preconnectedOriginsRef = useRef(new Set<string>());

  const preloadImages = useCallback((imageUrls: Array<string | null | undefined>) => {
    const loads: Promise<void>[] = [];

    for (const imageUrl of imageUrls) {
      if (!imageUrl) continue;

      const existing = preloadedImagesRef.current.get(imageUrl);
      if (existing) {
        loads.push(existing.loaded);
        continue;
      }

      try {
        const url = new URL(imageUrl);
        if (
          (url.protocol === "http:" || url.protocol === "https:") &&
          !preconnectedOriginsRef.current.has(url.origin)
        ) {
          preconnect(url.origin);
          preconnectedOriginsRef.current.add(url.origin);
        }
      } catch {
        // data URL과 상대 URL은 별도 오리진 연결이 필요하지 않다.
      }

      const image = new Image();
      image.decoding = "async";
      const loaded = new Promise<void>((resolve) => {
        const timeoutId = window.setTimeout(resolve, 10_000);
        const settle = () => {
          window.clearTimeout(timeoutId);
          resolve();
        };

        image.onload = () => {
          void image.decode().catch(() => undefined).finally(settle);
        };
        image.onerror = () => {
          preloadedImagesRef.current.delete(imageUrl);
          settle();
        };
      });
      preloadedImagesRef.current.set(imageUrl, { image, loaded });
      image.src = imageUrl;
      loads.push(loaded);
    }

    return Promise.all(loads).then(() => undefined);
  }, []);
  // ⏳ 디자인 후보를 주소로 고른다(한시적 — `readerOptions.ts`).
  const readerOptions = parseReaderOptions(searchParams);

  const [chatOpen, setChatOpen] = useState(false);
  // 넘김이 도는 동안 `dock` 을 여닫으면 책 폭이 변해 넘어가던 종이가 튄다(길이는 CSS 가 소유).
  const [turning, setTurning] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const chatWasOpen = useRef(false);

  const chatBranchKey: StoryChatBranchKey =
    currentPageNo === 6 && activeBranchKey ? activeBranchKey : "common";

  // ⭐ **리더가 대화 상태를 소유한다.** 표면을 닫아도 답변 폴링이 살아 있어야 한다.
  const chat = useCharacterChat({
    sessionId,
    pageNo: currentPageNo,
    branchKey: chatBranchKey,
    drafts: chatDrafts,
  });

  const dockLocked = readerOptions.chat === "dock" && turning;

  const closeChat = useCallback(() => {
    // ⚠️ 여는 것만 막으면 폭 변화의 절반만 막은 것이다 — 닫을 때도 책이 넓어진다.
    if (dockLocked) return;
    setChatOpen(false);
  }, [dockLocked]);

  // 닫은 뒤 포커스를 런처로 되돌린다. `<dialog>` 는 브라우저가 해 주지만 `dock`(aside)은 아니다.
  // 🚫 첫 렌더에는 옮기지 않는다 — 화면에 들어오자마자 포커스가 튄다.
  useEffect(() => {
    if (chatOpen) {
      chatWasOpen.current = true;
      return;
    }
    if (chatWasOpen.current) launcherRef.current?.focus();
  }, [chatOpen]);

  // 몰입 화면에서는 전역 헤더를 숨긴다 — CSS 가 `<html data-reader>` 를 보고 고른다.
  // 🚫 `AppHeader` 에서 쿼리를 읽지 않는다. 전 화면에 Suspense 경계가 생긴다.
  useEffect(() => {
    if (!readerOptions.immersive || viewState !== "reader") return;
    document.documentElement.dataset.reader = "immersive";
    return () => {
      delete document.documentElement.dataset.reader;
    };
  }, [readerOptions.immersive, viewState]);

  /**
   * 리더의 좌우 방향키가 부르는 쪽 이동(`BookPager`).
   * 🚫 6쪽으로 직행시키지 않는다 — A/B 를 고르기 전에는 존재하지 않는 쪽이다.
   *    비하인드는 하단 「비하인드 선택하기」가 여는 선택 화면을 거친다.
   */
  const requestPage = useCallback((pageNo: number) => {
    if (pageNo >= 6) return;
    setActiveBranchKey(null);
    setCurrentPageNo(pageNo);
  }, []);

  const noSessionError = !sessionId ? "세션 정보가 없습니다. 얼굴 사진을 먼저 등록해 주세요." : "";
  const activeError = errorMsg || noSessionError;

  // 초기 데이터 로드 및 파이프라인 기동
  useEffect(() => {
    if (!sessionId) {
      return;
    }

    let active = true;

    async function init() {
      try {
        // 1. 동화 상세 정보 로드
        const detail = await fetchStoryDetail(slug);
        if (!active) return;
        setStory(detail);

        // 2. 본편 전 쪽 본문을 **한 번에** 받는다.
        //    ⭐ 이후 쪽을 오가도 추가 요청이 없다 — 넘김 뒷면에 도착 쪽 본문이 항상 준비돼 있다.
        //    🚫 쪽마다 부르지 않는다. 그러면 어느 쪽을 먼저 받을지 정하는 로직이 화면에 생기고,
        //       동시 호출을 피하려는 순차 루프까지 따라온다 — 둘 다 API 모양 때문에 생긴 코드였다.
        try {
          const pages = await fetchStoryPages(slug);
          if (active) setStoryPages(pages);
        } catch (err) {
          console.warn("본문 사전 로드 지연:", err);
        }

        // 3. autoStart 플래그가 있으면 개인화 생성 시작 호출 (API 10, 멱등성 보장)
        if (autoStart) {
          try {
            await personalizeSession(sessionId!);
          } catch (err: unknown) {
            // 이미 생성 중이거나 완료된 경우 계속 진행
            if (err instanceof ApiError && err.status !== 409 && err.status !== 202) {
              console.warn("personalizeSession note:", err.message);
            }
          }
        }

        // 4. 세션 페이지 진행 상태 조회 (API 11)
        const sessionData = await fetchSessionPages(sessionId!);
        if (!active) return;
        setSessionPages(sessionData);

        if (isReaderReady(sessionData)) {
          await preloadImages([getFirstPageImageUrl(sessionData)]);
          if (!active) return;
          setViewState("reader");
        } else {
          setViewState("generating");
        }
      } catch (err: unknown) {
        if (!active) return;
        if (err instanceof ApiError) {
          if (err.isUnauthorized) {
            router.push(`/login?redirect=/stories/${slug}/read?sessionId=${sessionId}`);
            return;
          }
          setErrorMsg(err.message);
        } else {
          setErrorMsg("동화 정보를 불러오는 중 오류가 발생했습니다.");
        }
      }
    }

    void init();

    return () => {
      active = false;
    };
  }, [slug, sessionId, autoStart, router, retryTrigger, preloadImages]);

  // 진행 상태 폴링 (generating 상태일 때).
  // 완료를 받으면 viewState 가 바뀌어 enabled 가 false 가 되므로 폴링은 스스로 멈춘다.
  const { degraded: pagesPollDegraded } = usePolling({
    enabled: sessionId !== null && viewState === "generating",
    // `enabled` 가 sessionId 존재를 보장한다 — 타입 좁히기가 콜백 안까지 전파되지 않아
    // 이 파일의 다른 호출부와 같은 방식(`!`)으로 맞춘다.
    fetcher: () => fetchSessionPages(sessionId!),
    onData: (data) => {
      setSessionPages(data);
      if (isReaderReady(data)) {
        void preloadImages([getFirstPageImageUrl(data)]).then(() => {
          // 폴링으로 본편 완료를 처음 받는 경로도 초기 조회와 똑같이 독서 화면으로 전환한다.
          // 이 전환이 없으면 5/7 상태에서 폴링만 멈춰 생성 화면이 그대로 남는다.
          setViewState("reader");
        });
      }
    },
  });

  // 비하인드 선택 화면에서는 A/B 결과의 생성 상태만 가볍게 갱신한다.
  const { degraded: afterStoryPollDegraded } = usePolling({
    enabled: sessionId !== null && viewState === "branch" && isAfterStoryGenerating(afterStory),
    fetcher: () => fetchAfterStory(sessionId!),
    onData: setAfterStory,
  });

  // 선택 화면이 열리면 준비된 A/B 결과를 미리 받아 어느 쪽을 골라도 바로 보여 준다.
  useEffect(() => {
    if (viewState !== "branch" || !afterStory) return;
    void preloadImages(afterStory.choices.map((choice) => choice.imageUrl));
  }, [viewState, afterStory, preloadImages]);

  // 특정 실패 페이지 단독 재시도
  async function handleRetry(pageNo: number) {
    if (!sessionId) return;
    setRetryingPageNo(pageNo);
    try {
      await retrySessionPage(sessionId, pageNo);
      // 로컬 상태 즉시 pending으로 반영
      setSessionPages((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: "generating",
          isAllCompleted: false,
          pages: prev.pages.map((p) =>
            p.pageNo === pageNo && p.branchKey === "common"
              ? { ...p, status: "pending", errorMessage: null }
              : p,
          ),
        };
      });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        alert(`재시도 실패: ${err.message}`);
      }
    } finally {
      setRetryingPageNo(null);
    }
  }

  async function loadAfterStory() {
    if (!sessionId) return;
    setIsAfterStoryLoading(true);
    setAfterStoryError("");
    try {
      setAfterStory(await fetchAfterStory(sessionId));
    } catch (err: unknown) {
      setAfterStoryError(err instanceof ApiError ? err.message : "비하인드 이야기를 불러오지 못했어요.");
    } finally {
      setIsAfterStoryLoading(false);
    }
  }

  function openBranchScreen() {
    setActiveBranchKey(null);
    setViewState("branch");
    void loadAfterStory();
  }

  async function handleBranchChoice(branchKey: StoryBranchKey) {
    if (!afterStory) return;
    const choice = afterStory.choices.find((item) => item.branchKey === branchKey);
    if (!choice || choice.status !== "succeeded") return;

    setIsSelectingBranch(branchKey);
    setAfterStoryError("");
    try {
      if (afterStory.firstBranchChoice === null) {
        const result = await selectAfterStoryChoice(sessionId!, branchKey);
        setAfterStory((previous) =>
          previous ? { ...previous, firstBranchChoice: result.branchKey } : previous,
        );
      }
      setActiveBranchKey(branchKey);
      setCurrentPageNo(6);
      setViewState("reader");
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        setAfterStoryError("첫 선택이 이미 저장되었어요. 저장된 결과를 불러옵니다.");
        await loadAfterStory();
        return;
      }
      setAfterStoryError(err instanceof ApiError ? err.message : "선택을 저장하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setIsSelectingBranch(null);
    }
  }

  async function handleAfterStoryRetry(branchKey: StoryBranchKey) {
    if (!sessionId) return;
    setIsSelectingBranch(branchKey);
    setAfterStoryError("");
    try {
      await retryAfterStoryPage(sessionId, branchKey);
      setAfterStory((previous) =>
        previous
          ? {
              ...previous,
              choices: previous.choices.map((choice) =>
                choice.branchKey === branchKey
                  ? { ...choice, status: "pending", errorMessage: null, imageUrl: null }
                  : choice,
              ) as AfterStoryResponse["choices"],
            }
          : previous,
      );
    } catch (err: unknown) {
      setAfterStoryError(err instanceof ApiError ? err.message : "다시 만들기를 시작하지 못했어요.");
    } finally {
      setIsSelectingBranch(null);
    }
  }

  // ==========================================
  // 1. 에러 및 초기 로딩 뷰
  // ==========================================
  if (activeError) {
    return (
      <CenteredPage>
        <Card className="flex flex-col items-center gap-4">
          <StatusEmblem tone="danger">⚠️</StatusEmblem>
          <h1 className="text-xl font-bold text-ink">문제가 발생했어요</h1>
          <p className="text-sm text-neutral-600">{activeError}</p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {errorMsg && (
              <button
                type="button"
                onClick={() => {
                  setErrorMsg("");
                  setRetryTrigger((prev) => prev + 1);
                }}
                className={actionClass("primary")}
              >
                다시 시도하기
              </button>
            )}
            <Link
              href={`/stories/${slug}/capture`}
              className={actionClass(errorMsg ? "ghost" : "primary")}
            >
              얼굴 다시 등록하기
            </Link>
            <Link href={`/library/${slug}`} className={actionClass("ghost")}>
              동화 소개로
            </Link>
          </div>
        </Card>
      </CenteredPage>
    );
  }

  if (viewState === "loading" || !story) {
    return (
      <LoadingView message="동화 정보를 준비하고 있어요..." />
    );
  }

  // ==========================================
  // 2. 생성 중 대기 화면 (v-generating)
  // ==========================================
  if (viewState === "generating") {
    return (
      <GeneratingView
        slug={slug}
        sessionPages={sessionPages}
        pagesPollDegraded={pagesPollDegraded}
        retryingPageNo={retryingPageNo}
        isSelectingBranch={isSelectingBranch}
        handleRetry={handleRetry}
        handleAfterStoryRetry={handleAfterStoryRetry}
      />
    );
  }

  // ==========================================
  // 3. 비하인드 이야기 분기 화면 (v-branch)
  // ==========================================
  if (viewState === "branch") {
    return (
      <BranchView
        afterStory={afterStory}
        isAfterStoryLoading={isAfterStoryLoading}
        isSelectingBranch={isSelectingBranch}
        afterStoryError={afterStoryError}
        afterStoryPollDegraded={afterStoryPollDegraded}
        handleBranchChoice={handleBranchChoice}
        handleAfterStoryRetry={handleAfterStoryRetry}
        onSkip={() => setViewState("end")}
        onBackToStory={() => {
          setCurrentPageNo(5);
          setViewState("reader");
        }}
      />
    );
  }

  // ==========================================
  // 4. 완독 축하 화면 (v-end)
  // ==========================================
  if (viewState === "end") {
    return (
      <EndView
        sessionPages={sessionPages}
        onRestart={() => {
          setCurrentPageNo(1);
          setViewState("reader");
        }}
      />
    );
  }

  // ==========================================
  // 5. 개인화 동화 리더 화면 (v-reader)
  // ==========================================
  const activeAfterStory = activeBranchKey
    ? afterStory?.choices.find((choice) => choice.branchKey === activeBranchKey)
    : undefined;
  const totalPages = 6;

  // ⭐ **쪽 하나가 아니라 쪽 번호로 조회한다.** 넘김 중에는 떠나는 쪽과 도착 쪽을 동시에 그려야 해서
  //    "현재 쪽" 변수 하나로는 부족하다(`BookPager`).
  /** 쪽 → 합성 삽화 URL. 6쪽은 고른 A/B 결과에서 온다. */
  function imageUrlAt(pageNo: number): string | undefined {
    if (pageNo === 6) return activeAfterStory?.imageUrl ?? undefined;
    // ⚠️ `branchKey` 를 함께 본다 — 목록에는 6쪽 a·b 도 들어 있어 쪽 번호만으로는 갈리지 않는다.
    return (
      sessionPages?.pages.find((page) => page.branchKey === "common" && page.pageNo === pageNo)
        ?.imageUrl ?? undefined
    );
  }

  /** 쪽 → 본문. 아직 못 받았으면 안내 문구가 자리를 지킨다 — 틀이 흔들리지 않는다. */
  function bodyTextAt(pageNo: number): string {
    const source =
      pageNo === 6 ? activeAfterStory : storyPages.find((page) => page.pageNo === pageNo);
    return source?.bodyText || "본문을 불러오는 중입니다...";
  }

  const isFirstPage = currentPageNo <= 1;
  const isBehindPage = currentPageNo === 6;

  /**
   * 첫 삽화가 뜨는 순간 **나머지 삽화를 전부** 받아 둔다(비하인드 A/B 포함).
   * ⭐ 다음 한 장만 받으면 넘김 뒷면에 삽화가 늦게 도착해 빈 종이가 스친다. 6~7장뿐이고
   *    이미지 요청은 스토리지로 직접 가므로 API 레이트리밋과 무관하다.
   */
  function preloadRemainingArtwork() {
    if (!sessionPages) return;
    void preloadImages(sessionPages.pages.map((page) => page.imageUrl));
  }

  // `dock` 은 책 옆에 나란히 놓인다 — 열리면 책 칸이 그만큼 좁아진다.
  const dockOpen = readerOptions.chat === "dock" && chatOpen;

  // 🚫 클래스를 JSX 안에서 조립하지 않는다 — 후보를 지울 때 조건을 하나씩 찾아다니게 된다.
  //    아래 여백은 하단 가운데 플로팅 바의 자리다. 없으면 그 바가 책의 조작줄을 덮는다.
  //    ⚠️ 좁은 화면에서는 「보기 설정」과 런처가 **두 줄로 접히므로** 더 많이 비운다.
  const mainClass = [
    "mx-auto flex w-full flex-1 gap-4 px-4 pt-5 pb-40 md:px-8 md:pt-6 md:pb-24",
    readerOptions.immersive ? "max-w-7xl md:h-dvh" : "max-w-5xl",
    dockOpen ? "flex-col md:flex-row" : "flex-col",
  ].join(" ");

  return (
    <>
      <main className={mainClass}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <header className={READER_BAR}>
          <button
            onClick={() => setViewState("generating")}
            className={actionClass("ghost", "text-sm")}
          >
            ← 제작 현황 보기
          </button>

          <h1 className="order-first w-full text-xl font-bold text-balance break-keep wrap-anywhere text-ink md:order-none md:w-auto md:flex-1 md:text-center">
            {story.title}
            {isBehindPage && (
              <span className="ml-2 rounded-pill bg-magic-strong/10 px-2 py-0.5 text-xs text-magic-strong">
                비하인드
              </span>
            )}
          </h1>

          <p
            className="rounded-pill bg-surface-raised px-4 py-2 text-sm font-bold text-ink-muted shadow-sm"
            aria-live="polite"
          >
            {currentPageNo} / {totalPages}
          </p>
        </header>

        {/* 펼친 책 — 시연 리더와 **같은** 넘김 엔진을 쓴다. 하드커버 표지·종이 단면은 `BookVolume` 이 그린다. */}
        <BookPager
          pageNo={currentPageNo}
          pageCount={totalPages}
          fill={readerOptions.immersive}
          onRequestPage={requestPage}
          onTurningChange={setTurning}
          renderArt={(pageNo) => (
            <BookArtContent
              pageNo={pageNo}
              imageUrl={imageUrlAt(pageNo)}
              onImageLoad={preloadRemainingArtwork}
            />
          )}
          renderText={(pageNo) => (
            <BookTextContent pageNo={pageNo}>{bodyTextAt(pageNo)}</BookTextContent>
          )}
        />

        <div className={READER_BAR}>
          {isFirstPage ? (
            <span
              aria-disabled="true"
              className={actionClass("ghost", "pointer-events-none opacity-40")}
            >
              이전
            </span>
          ) : currentPageNo === 6 ? (
            <button onClick={openBranchScreen} className={actionClass("ghost")}>
              선택지로
            </button>
          ) : (
            <button
              onClick={() => setCurrentPageNo((prev) => Math.max(1, prev - 1))}
              className={actionClass("ghost")}
            >
              이전
            </button>
          )}

          {/* 도트 인디케이터 (1~6쪽) */}
          <div className="flex items-center">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => {
              const isCur = num === currentPageNo;
              const isBehind = num > 4;
              return (
                <button
                  key={num}
                  onClick={() => {
                    if (num === 6) {
                      openBranchScreen();
                      return;
                    }
                    setActiveBranchKey(null);
                    setCurrentPageNo(num);
                  }}
                  title={`${num}쪽`}
                  // 🚫 title 에만 기대지 않는다 — 스크린리더가 일관되게 읽지 않는다.
                  //    현재 위치도 색으로만 표시하면 화면을 못 보는 사용자에게는 없는 정보다.
                  aria-label={`${num}쪽으로 이동`}
                  aria-current={isCur ? "true" : undefined}
                  // ⭐ 보이는 점(10px)은 그대로 두고 **히트 영역만** 넓힌다. 10px 짜리 점을
                  //    직접 누르게 하면 아이 손가락으로는 거의 맞출 수 없다.
                  //    ⚠️ 56px(`--spacing-touch`) 규약에는 못 미친다 — 6개가 한 줄에 들어가야 해
                  //    30px 로 절충했다(기존 대비 3배). 대신 컨테이너 gap 을 없애 총폭을 억제했다.
                  className={`group grid place-items-center rounded-full p-2.5 ${FOCUS_RING}`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-2.5 rounded-full transition-all motion-reduce:transition-none ${
                      isCur
                        ? "w-6 bg-primary"
                        : isBehind
                        ? "w-2.5 bg-magic/40 group-hover:bg-magic"
                        : "w-2.5 bg-line group-hover:bg-ink-muted"
                    }`}
                  />
                </button>
              );
            })}
        </div>

        {/* 다음 버튼 분기 처리 */}
        {currentPageNo === 5 ? (
          <button
            onClick={openBranchScreen}
            className={actionClass("accentA", "font-bold")}
          >
            비하인드 선택하기 →
          </button>
        ) : currentPageNo >= totalPages ? (
          <button
            onClick={() => setViewState("end")}
            className={actionClass("primary", "font-bold")}
          >
            다 읽었어요 🎉
          </button>
        ) : (
          <button
            onClick={() => setCurrentPageNo((prev) => Math.min(totalPages, prev + 1))}
            className={actionClass("accentA")}
          >
            다음 페이지 →
          </button>
        )}
      </div>

        </div>

        <ChatSurface
          kind={readerOptions.chat}
          open={chatOpen}
          onClose={closeChat}
          closeDisabled={dockLocked}
          titleId={CHAT_TITLE_ID}
        >
          <CharacterChat
            chat={chat}
            loginHref={`/login?redirect=${encodeURIComponent(`/stories/${slug}/read?sessionId=${sessionId}`)}`}
          />
        </ChatSurface>
      </main>

      {/*
        화면 **아래 가운데**. 구석에 두었더니 몰입 화면에서 눈에 들어오지 않았다(2026-09-14 피드백).
        ⭐ 위치는 이 컨테이너가 **혼자** 소유한다 — 버튼마다 `fixed` 를 달면 둘이 따로 놀고,
        안전영역·겹침을 두 곳에서 관리하게 된다.
        `pointer-events-none` 은 버튼 사이 빈 곳으로 책을 계속 누를 수 있게 한다(자식만 되살린다).
      */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-30 flex flex-wrap items-end justify-center gap-3 px-4">
        <ReaderPreviewSettings options={readerOptions} />
        {chatOpen ? null : (
          <ChatLauncher
            chat={chat}
            onOpen={() => setChatOpen(true)}
            buttonRef={launcherRef}
            disabled={dockLocked}
          />
        )}
      </div>
    </>
  );
}

export default function StoryReadPage({ params }: PageProps) {
  // ⚠️ 폴백에 스피너만 두면 화면을 못 보는 사용자에게는 **아무 일도 안 일어난 것**과 같다.
  //    `LoadingView` 가 `role="status"` 문구를 함께 준다.
  return (
    <Suspense fallback={<LoadingView message="동화를 준비하고 있어요..." />}>
      <StoryReadContent params={params} />
    </Suspense>
  );
}
