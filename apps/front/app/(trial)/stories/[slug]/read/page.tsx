"use client";

import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { preconnect } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { StatusEmblem } from "@/components/ui/StatusEmblem";
import { CenteredPage } from "@/components/ui/CenteredPage";
import { LoadingView } from "@/components/ui/LoadingView";
import { actionClass } from "@/components/ui/actionStyles";
import { BookArtContent, BookTextContent } from "@/components/story/BookFrame";
import { BookPager, READER_BAR } from "@/components/story/BookPager";
import { NarrationPlayer } from "@/components/story/NarrationPlayer";
import { ReaderAudioProvider } from "@/components/story/ReaderAudioProvider";
import { useNarration } from "@/components/story/useNarration";
import { isReaderReady } from "./readiness";
import { isAfterStoryGenerating } from "./polling";
import { usePolling } from "./usePolling";
import { BranchView } from "./BranchView";
import { CharacterChat } from "./CharacterChat";
import { CharacterHotspots } from "./CharacterHotspots";
import { EndView } from "./EndView";
import { GeneratingView } from "./GeneratingView";
import { ChatSurface } from "./ChatSurface";
import { ReaderPreviewSettings } from "./ReaderPreviewSettings";
import { parseReaderOptions } from "./readerOptions";
import { useCharacterChat } from "./useCharacterChat";
import { createChatDraftStore } from "./chat-drafts";
import { SESSION_CHANGED_EVENT, UNAUTHORIZED_EVENT } from "@/lib/api/client";
import {
  errorMessage,
  errorRecovery,
  type ErrorRecovery,
} from "@/lib/api/errorPresentation";
import { getDemoStoryImageUrl } from "@/lib/demoStoryAssets";
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
  StoryPageCharacter,
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
  const demoParam = searchParams.get("demo");
  const isDemoMode = demoParam === "male" || demoParam === "female";
  const isLoadingParam = searchParams.get("loading") === "true";

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
  /**
   * 사용자가 **직접** 제작 현황을 열었는가.
   *
   * 폴링은 본편이 준비되면 독서 화면으로 전환하는데(`isReaderReady`), 리더에 이미 들어와 있다는
   * 것 자체가 그 조건이 참이라는 뜻이다. 그래서 이 플래그가 없으면 「제작 현황 보기」를 눌러도
   * **첫 폴링(3초) 만에 도로 튕겨 나온다.** 자동 전환은 처음 진입할 때만 필요하다.
   */
  const [statusPinned, setStatusPinned] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  /**
   * 이 실패에서 사용자가 할 수 있는 일. 에러 **코드**가 정한다.
   *
   * 🚫 화면에서 `status` 숫자로 다시 판단하지 않는다 — 같은 규칙이 화면마다 갈린다.
   *    판단은 `lib/api/errorPresentation.ts` 한 곳에 있고 테스트로 고정돼 있다.
   */
  const [recovery, setRecovery] = useState<ErrorRecovery>("retry");
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
  const chatTriggerRef = useRef<HTMLButtonElement>(null);
  const chatWasOpen = useRef(false);

  const chatBranchKey: StoryChatBranchKey =
    currentPageNo === 6 && activeBranchKey ? activeBranchKey : "common";

  const currentDemoCharacters = useMemo(() => {
    if (!isDemoMode) return [];
    const chars = storyPages.find((page) => page.pageNo === currentPageNo)?.characters ?? [];
    return chars.map((c) => ({
      role: c.role,
      displayName: c.displayName,
    }));
  }, [isDemoMode, storyPages, currentPageNo]);

  // ⭐ **리더가 대화 상태를 소유한다.** 표면을 닫아도 답변 폴링이 살아 있어야 한다.
  const chat = useCharacterChat({
    sessionId,
    pageNo: currentPageNo,
    branchKey: chatBranchKey,
    drafts: chatDrafts,
    isDemo: isDemoMode,
    demoCharacters: currentDemoCharacters,
  });

  const narrationAudioUrl =
    currentPageNo === 6
      ? (afterStory?.choices.find((choice) => choice.branchKey === activeBranchKey)
          ?.narrationAudioUrl ?? null)
      : (storyPages.find((page) => page.pageNo === currentPageNo)?.narrationAudioUrl ?? null);
  const narrationPreloads = useMemo(() => {
    if (currentPageNo === 5) {
      return [
        narrationAudioUrl,
        ...(afterStory?.choices.map((choice) => choice.narrationAudioUrl) ?? []),
      ];
    }
    return [
      narrationAudioUrl,
      storyPages.find((page) => page.pageNo === currentPageNo + 1)?.narrationAudioUrl,
    ];
  }, [afterStory, currentPageNo, narrationAudioUrl, storyPages]);
  const narration = useNarration({
    pageKey: `trial:${sessionId}:${currentPageNo}:${activeBranchKey ?? "common"}`,
    audioUrl: narrationAudioUrl,
    preloadUrls: narrationPreloads,
  });
  const pauseNarration = narration.pause;
  const suspendNarration = narration.suspend;
  useEffect(() => {
    if (viewState === "branch") suspendNarration();
    else if (viewState !== "reader") pauseNarration();
  }, [pauseNarration, suspendNarration, viewState]);

  const dockLocked = readerOptions.chat === "dock" && turning;
  const selectChatRole = chat.selectRole;

  const openChatForCharacter = useCallback(
    (role: string, trigger: HTMLButtonElement) => {
      // 정적 hotspot은 넘김 중 사라지지만, 같은 프레임에 시작된 dock 폭 변경도 막는다.
      if (dockLocked) return;
      chatTriggerRef.current = trigger;
      // 이미 보낸 질문이 있으면 저장된 상대를 바꾸지 않고 대화 기록만 다시 연다.
      if (chat.status !== "pending" && chat.status !== "completed" && chat.status !== "failed") {
        selectChatRole(role);
      }
      pauseNarration();
      setChatOpen(true);
    },
    [chat.status, dockLocked, pauseNarration, selectChatRole],
  );

  const closeChat = useCallback(() => {
    // ⚠️ 여는 것만 막으면 폭 변화의 절반만 막은 것이다 — 닫을 때도 책이 넓어진다.
    if (dockLocked) return;
    setChatOpen(false);
  }, [dockLocked]);

  // 닫은 뒤 포커스를 대화를 시작한 캐릭터로 되돌린다. `<dialog>` 는 브라우저가 해 주지만
  // `dock`(aside)은 아니며, 명시해 두면 두 표면의 동작도 같아진다.
  // 🚫 첫 렌더에는 옮기지 않는다 — 화면에 들어오자마자 포커스가 튄다.
  useEffect(() => {
    if (chatOpen) {
      chatWasOpen.current = true;
      return;
    }
    if (chatWasOpen.current && chatTriggerRef.current?.isConnected) chatTriggerRef.current.focus();
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
   * 데모 모드에서는 5쪽이 끝이므로 5쪽을 넘어가면 바로 완독 화면(`end`)으로 이동한다.
   */
  const requestPage = useCallback(
    (pageNo: number) => {
      if (isDemoMode) {
        if (pageNo > 5) {
          setViewState("end");
          return;
        }
        setCurrentPageNo(pageNo);
        return;
      }
      if (pageNo >= 6) return;
      setActiveBranchKey(null);
      setCurrentPageNo(pageNo);
    },
    [isDemoMode],
  );

  const noSessionError =
    !sessionId && !isDemoMode ? "세션 정보가 없습니다. 얼굴 사진을 먼저 등록해 주세요." : "";
  const activeError = errorMsg || noSessionError;
  // 세션 정보 자체가 없으면 재시도할 요청이 없다 — 얼굴 등록이 유일한 길이다.
  const errorRecoveryAction: ErrorRecovery = errorMsg ? recovery : "register-face";

  // 초기 데이터 로드 및 파이프라인 기동
  useEffect(() => {
    if (!sessionId && !isDemoMode) {
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
        const pages = await fetchStoryPages(slug);
        if (!active) return;
        setStoryPages(pages);

        // 3. 시연 모드일 때: Stateless 정적 렌더링 및 3초 마법 연출
        if (isDemoMode) {
          const demoSessionData: SessionPagesResponse = {
            sessionId: "00000000-0000-0000-0000-000000000001",
            status: "completed",
            isMainStoryReady: true,
            isAllCompleted: true,
            totalPages: pages.length,
            completedPages: pages.length,
            pages: pages.map((p) => ({
              pageNo: p.pageNo,
              branchKey: "common",
              imageUrl: getDemoStoryImageUrl(slug, demoParam, p.pageNo, p.baseImageUrl),
              status: "succeeded",
              updatedAt: new Date().toISOString(),
            })),
          };
          setSessionPages(demoSessionData);
          await preloadImages(demoSessionData.pages.map((p) => p.imageUrl));
          if (!active) return;

          if (isLoadingParam) {
            setViewState("generating");
            const timer = setTimeout(() => {
              if (!active) return;
              setViewState("reader");
              router.replace(`/stories/${slug}/read?demo=${demoParam}`);
            }, 60000);
            return () => clearTimeout(timer);
          } else {
            setViewState("reader");
            return;
          }
        }

        // 4. autoStart 플래그가 있으면 개인화 생성 시작 호출 (API 10, 멱등성 보장)
        if (autoStart) {
          try {
            await personalizeSession(sessionId!);
          } catch (err: unknown) {
            if (!active) return;
            setErrorMsg(errorMessage(err, "동화 만들기를 시작하지 못했어요."));
            setRecovery(errorRecovery(err));
            return;
          }
        }

        // 5. 세션 페이지 진행 상태 조회 (API 11)
        const sessionData = await fetchSessionPages(sessionId!);
        if (!active) return;
        setSessionPages(sessionData);

        if (isReaderReady(sessionData)) {
          await preloadImages([getFirstPageImageUrl(sessionData)]);
          if (!active) return;
          setViewState("reader");
          void preloadImages(sessionData.pages.map((page) => page.imageUrl));
        } else {
          setViewState("generating");
        }
      } catch (err: unknown) {
        if (!active) return;
        if (err instanceof ApiError && err.isUnauthorized) {
          router.push(`/login?redirect=/stories/${slug}/read?sessionId=${sessionId}`);
          return;
        }
        setErrorMsg(errorMessage(err, "동화 정보를 불러오는 중 오류가 발생했습니다."));
        setRecovery(errorRecovery(err));
      }
    }

    void init();

    return () => {
      active = false;
    };
  }, [
    slug,
    sessionId,
    autoStart,
    isDemoMode,
    demoParam,
    isLoadingParam,
    router,
    retryTrigger,
    preloadImages,
  ]);

  // 진행 상태 폴링 (generating 상태일 때).
  // 완료를 받으면 viewState 가 바뀌어 enabled 가 false 가 되므로 폴링은 스스로 멈춘다.
  const { degraded: pagesPollDegraded } = usePolling({
    enabled: !isDemoMode && sessionId !== null && viewState === "generating",
    fetcher: () => fetchSessionPages(sessionId!),
    onData: (data) => {
      setSessionPages(data);
      if (!statusPinned && isReaderReady(data)) {
        void preloadImages([getFirstPageImageUrl(data)]).then(() => {
          setViewState("reader");
          void preloadImages(data.pages.map((page) => page.imageUrl));
        });
      }
    },
  });

  // 비하인드 선택 화면에서는 A/B 결과의 생성 상태만 가볍게 갱신한다.
  const { degraded: afterStoryPollDegraded } = usePolling({
    enabled:
      !isDemoMode &&
      sessionId !== null &&
      viewState === "branch" &&
      isAfterStoryGenerating(afterStory),
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
    if (isDemoMode) {
      setViewState("end");
      return;
    }
    narration.suspend();
    setActiveBranchKey(null);
    setViewState("branch");
    void loadAfterStory();
  }


  useEffect(() => {
    if (isDemoMode || viewState !== "reader" || currentPageNo !== 5 || !sessionId || afterStory) return;
    const controller = new AbortController();
    void fetchAfterStory(sessionId, controller.signal).then(setAfterStory, () => undefined);
    return () => controller.abort();
  }, [afterStory, currentPageNo, isDemoMode, sessionId, viewState]);

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
          <StatusEmblem tone="danger" />
          <h1 className="text-xl font-bold text-ink">문제가 발생했어요</h1>
          <p className="text-sm text-ink-muted">{activeError}</p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            {/* 🚫 실패 종류와 상관없이 「다시 시도하기」를 띄우지 않는다 — 다시 보내도 같은 답이
                오는 실패(없는 세션·이미 완료 등)에서는 눌러 보고 또 실패하는 경험만 준다.
                무엇을 띄울지는 에러 **코드**가 정한다(`lib/api/errorPresentation.ts`). */}
            {errorRecoveryAction === "retry" && (
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
              className={actionClass(
                errorRecoveryAction === "register-face" ? "primary" : "secondary",
              )}
            >
              {errorRecoveryAction === "register-face" ? "얼굴 등록하러 가기" : "얼굴 다시 등록하기"}
            </Link>
            <Link
              href={`/library/${slug}`}
              className={actionClass(errorRecoveryAction === "none" ? "primary" : "secondary")}
            >
              동화 소개로
            </Link>
          </div>
        </Card>
      </CenteredPage>
    );
  }

  if (viewState === "loading" || !story) {
    return (
      <LoadingView
        message={
          autoStart
            ? "동화나라에 주인공 마법을 준비하고 있어요..."
            : "동화 정보를 준비하고 있어요..."
        }
      />
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
        canOpenReader={isDemoMode || (sessionPages !== null && isReaderReady(sessionPages))}
        onOpenReader={() => {
          setStatusPinned(false);
          setViewState("reader");
          if (isDemoMode) {
            router.replace(`/stories/${slug}/read?demo=${demoParam}`);
          }
        }}
        isDemo={isDemoMode}
      />
    );
  }

  // ==========================================
  // 3. 비하인드 이야기 분기 화면 (v-branch)
  // ==========================================
  if (viewState === "branch") {
    if (isDemoMode) {
      return (
        <EndView
          sessionPages={sessionPages}
          onRestart={() => {
            setCurrentPageNo(1);
            setViewState("reader");
          }}
          isDemo={isDemoMode}
          storySlug={slug}
        />
      );
    }

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
        isDemo={isDemoMode}
        storySlug={slug}
      />
    );
  }

  // ==========================================
  // 5. 개인화 동화 리더 화면 (v-reader)
  // ==========================================
  const activeAfterStory = activeBranchKey
    ? afterStory?.choices.find((choice) => choice.branchKey === activeBranchKey)
    : undefined;
  const totalPages = isDemoMode ? 5 : 6;

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

  /** 쪽 → 삽화에 실제로 나온 대화 가능한 캐릭터. 6쪽은 고른 A/B 장면의 목록을 쓴다. */
  function charactersAt(pageNo: number): StoryPageCharacter[] {
    if (pageNo === 6) return activeAfterStory?.characters ?? [];
    return storyPages.find((page) => page.pageNo === pageNo)?.characters ?? [];
  }

  const isFirstPage = currentPageNo <= 1;
  const isBehindPage = currentPageNo === 6;

  // `dock` 은 책 옆에 나란히 놓인다 — 열리면 책 칸이 그만큼 좁아진다.
  const dockOpen = readerOptions.chat === "dock" && chatOpen;

  // 🚫 클래스를 JSX 안에서 조립하지 않는다 — 후보를 지울 때 조건을 하나씩 찾아다니게 된다.
  //    아래 여백(`pb-28`)은 화면 하단에 붙은 조작 바의 자리다. 없으면 바가 책 아래를 덮는다.
  const mainClass = [
    "mx-auto flex w-full min-h-0 flex-1 gap-4 px-4 pt-5 pb-28 md:px-8 md:pt-5 md:pb-24",
    readerOptions.immersive ? "max-w-7xl md:h-dvh" : "max-w-5xl",
    dockOpen ? "flex-col md:flex-row" : "flex-col",
  ].join(" ");

  return (
    <>
      <main className={mainClass}>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        {/* 몰입 끔이면 전역 네비게이션(AppHeader)이 보이고 쪽번호는 하단바에 있으므로
             제목·쪽번호를 다시 보여 줄 필요가 없다. 제작 현황 버튼만 조건부로 남긴다. */}
        {readerOptions.immersive ? (
          <header className={READER_BAR}>
            {!isDemoMode && !sessionPages?.isAllCompleted && sessionPages?.status !== "completed" ? (
              <button
                onClick={() => {
                  setStatusPinned(true);
                  setViewState("generating");
                }}
                className={actionClass("secondary", "text-sm")}
              >
                ← 제작 현황 보기
              </button>
            ) : null}

            <h1 className="order-first w-full text-xl font-bold text-balance break-keep wrap-anywhere text-ink md:order-none md:w-auto md:flex-1 md:text-center">
              {story.title}
              {isBehindPage && (
                <span className="ml-2 rounded-pill bg-magic-strong/10 px-2 py-0.5 text-xs text-magic-strong">
                  비하인드
                </span>
              )}
            </h1>

            {/* 넓은 화면에서는 하단바 가운데가 진행을 보여 준다 — 여기는 좁은 화면(바 가운데가 접힘) 전용.
                `aria-live` 는 이 한 곳에만 둔다. 바의 숫자까지 읽히면 쪽마다 두 번 읽힌다. */}
            <p
              className="rounded-pill bg-surface-raised px-4 py-2 text-sm font-bold text-ink-muted shadow-sm sm:sr-only"
              aria-live="polite"
            >
              {currentPageNo} / {totalPages}
            </p>
          </header>
        ) : !isDemoMode && !sessionPages?.isAllCompleted && sessionPages?.status !== "completed" ? (
          <div>
            <button
              onClick={() => {
                setStatusPinned(true);
                setViewState("generating");
              }}
              className={actionClass("secondary", "text-sm")}
            >
              ← 제작 현황 보기
            </button>
          </div>
        ) : null}

        {/* 펼친 책 — 시연 리더와 **같은** 넘김 엔진을 쓴다. 하드커버 표지·종이 단면은 `BookVolume` 이 그린다. */}
        <BookPager
          pageNo={currentPageNo}
          pageCount={totalPages}
          fill
          onRequestPage={requestPage}
          onTurningChange={setTurning}
          renderArt={(pageNo) => <BookArtContent pageNo={pageNo} imageUrl={imageUrlAt(pageNo)} />}
          renderArtControls={(pageNo) => (
            <CharacterHotspots
              imageUrl={imageUrlAt(pageNo)}
              characters={charactersAt(pageNo)}
              selectedRole={chat.role}
              chatOpen={chatOpen}
              onSelect={openChatForCharacter}
              storySlug={slug}
              pageNo={pageNo}
              branchKey={pageNo === 6 ? activeBranchKey : undefined}
            />
          )}
          renderText={(pageNo) => (
            <BookTextContent pageNo={pageNo}>{bodyTextAt(pageNo)}</BookTextContent>
          )}
          renderTextControls={() => (
            <NarrationPlayer
              audioUrl={narrationAudioUrl}
              enabled={narration.enabled}
              onPlay={narration.play}
              onPause={narration.pause}
              onRestart={narration.restart}
            />
          )}
        />


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
            onInteraction={narration.pause}
            loginHref={`/login?redirect=${encodeURIComponent(`/stories/${slug}/read?sessionId=${sessionId}`)}`}
          />
        </ChatSurface>
      </main>

      {/*
        ⭐ **하단바 — 왼쪽 되돌아가기 · 가운데 진행 · 오른쪽 나아가기**(2026-09-14 요청).
        한때 진행 점이 배경(언덕 그림) 위에 떠 있어 묻혔고, 「보기 설정」·대화 버튼은 따로 떠 있었다.
        흰 바 하나에 모아 **자리가 곧 의미**가 되게 한다: 왼쪽=뒤로, 가운데=어디쯤, 오른쪽=앞으로·도구.
        위치는 이 바가 **혼자** 소유한다 — 버튼마다 `fixed` 를 달면 안전영역·겹침을 여러 곳에서 관리하게 된다.
        책과 겹치지 않게 비우는 여백은 `mainClass` 의 `pb-28` 이 맡는다.
      */}
      <nav
        aria-label="동화 읽기 조작"
        className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-line bg-surface-raised/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm"
      >
        {/* 좁은 화면은 가운데가 접히므로 grid 3칸이 아니라 양끝 정렬이다 — 3칸으로 두면 오른쪽 칸이 폭의 절반에 갇혀
            「다음 페이지」가 네 줄로 꺾였다(2026-09-14 390px 실측). */}
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:grid sm:grid-cols-[1fr_auto_1fr] md:gap-4 md:px-8">
          {/* 왼쪽 — 뒤로 */}
          <div className="flex items-center gap-2 justify-self-start">
            {isFirstPage ? (
              // 🚫 버튼을 숨기지 않는다 — 사라졌다 나타나면 위치가 흔들려 오터치가 는다.
              <span
                aria-disabled="true"
                className={actionClass("secondary", "pointer-events-none opacity-40", "compact")}
              >
                이전
              </span>
            ) : currentPageNo === 6 ? (
              <button onClick={openBranchScreen} className={actionClass("secondary", "", "compact")}>
                선택지로
              </button>
            ) : (
              <button
                onClick={() => setCurrentPageNo((prev) => Math.max(1, prev - 1))}
                className={actionClass("secondary", "", "compact")}
              >
                이전
              </button>
            )}
            <ReaderPreviewSettings options={readerOptions} />
          </div>

          {/* 가운데 — 진행 막대. 좁은 화면에서는 상단의 쪽 표시가 대신한다.
              ⭐ 점(도트)이 아니라 **막대**다(2026-09-14 요청) — 점 6개는 작고 흐려 어디쯤인지 한눈에 안 읽혔다.
              🚫 막대로 쪽 이동을 받지 않는다. 이동은 좌우 버튼과 방향키가 맡는다(누를 곳이 한 가지여야 오터치가 준다).
              ⚠️ 1쪽에서도 막대가 비어 보이지 않게 **읽은 쪽까지 포함한** 비율이다(1/6 = 첫 칸이 차 있음). */}
          <div className="hidden items-center gap-3 justify-self-center sm:flex">
            <div
              role="progressbar"
              aria-label="읽은 쪽"
              aria-valuemin={1}
              aria-valuemax={totalPages}
              aria-valuenow={currentPageNo}
              aria-valuetext={`${totalPages}쪽 중 ${currentPageNo}쪽`}
              className="h-2.5 w-40 overflow-hidden rounded-pill bg-line md:w-64"
            >
              <div
                // 진행률은 공통 강조색을 사용하고 숫자와 함께 전달한다.
                className="h-full rounded-pill bg-accent-a transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${(currentPageNo / totalPages) * 100}%` }}
              />
            </div>
            <p className="text-sm font-bold text-ink-muted tabular-nums" aria-hidden="true">
              {currentPageNo} / {totalPages}
            </p>
          </div>

          {/* 오른쪽 — 도구와 앞으로. 가장 오른쪽 끝이 늘 **다음 동작(primary)** 이다. */}
          <div className="flex items-center gap-2 justify-self-end sm:col-start-3">
            {!isDemoMode && currentPageNo === 5 ? (
              // ⚠️ 띄어쓰기는 `gap` 이 만든다. 버튼이 inline-flex 라 글자·span 이 각각 flex 항목이 되어
              //    항목 끝의 공백 문자는 잘린다(「비하인드선택하기→」로 붙어 보였다).
              <button onClick={openBranchScreen} className={actionClass("primary", `gap-1.5 whitespace-nowrap ${BAR_END_BUTTON_WIDTH}`, "compact")}>
                <span className="hidden sm:inline">비하인드</span>
                <span>선택하기</span>
                <span aria-hidden="true">→</span>
              </button>
            ) : currentPageNo >= totalPages ? (
              <button onClick={() => setViewState("end")} className={actionClass("primary", `whitespace-nowrap ${BAR_END_BUTTON_WIDTH}`, "compact")}>
                다 읽었어요
              </button>
            ) : (
              <button
                onClick={() => setCurrentPageNo((prev) => Math.min(totalPages, prev + 1))}
                className={actionClass("primary", `gap-1.5 whitespace-nowrap ${BAR_END_BUTTON_WIDTH}`, "compact")}
              >
                {/* 좁은 화면은 「다음」만 — 바 한 줄에 네 버튼이 서야 한다. 띄어쓰기는 `gap` 이 만든다(위 참고). */}
                <span>다음</span>
                <span className="hidden sm:inline">페이지</span>
                <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}

/**
 * 하단바 오른쪽 두 버튼(「등장인물에게 물어보기」·「다음」)의 **같은 폭**(2026-09-14 요청).
 * 둘이 나란히 서므로 크기가 다르면 한쪽이 더 중요해 보인다 — 중요도는 크기가 아니라 **색**(dark < primary)이 말한다.
 * 좁은 화면은 대화 버튼이 아이콘만 남아 최소 폭만 맞춘다.
 */
const BAR_END_BUTTON_WIDTH = "min-w-24 sm:w-60";

export default function StoryReadPage({ params }: PageProps) {
  // ⚠️ 폴백에 스피너만 두면 화면을 못 보는 사용자에게는 **아무 일도 안 일어난 것**과 같다.
  //    `LoadingView` 가 `role="status"` 문구를 함께 준다.
  return (
    <Suspense fallback={<LoadingView message="동화를 준비하고 있어요..." />}>
      <ReaderAudioProvider>
        <StoryReadContent params={params} />
      </ReaderAudioProvider>
    </Suspense>
  );
}
