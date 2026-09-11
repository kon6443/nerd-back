"use client";

import { Suspense, use, useCallback, useEffect, useRef, useState } from "react";
import { preconnect } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { StatusEmblem } from "@/components/ui/StatusEmblem";
import { Badge } from "@/components/ui/Badge";
import { CenteredPage } from "@/components/ui/CenteredPage";
import { LoadingView } from "@/components/ui/LoadingView";
import { actionClass, FOCUS_RING } from "@/components/ui/actionStyles";
import { BookFrame } from "@/components/story/BookFrame";
import { isReaderReady } from "./readiness";
import { isAfterStoryGenerating } from "./polling";
import { usePolling } from "./usePolling";
import {
  ApiError,
  fetchAfterStory,
  fetchStoryDetail,
  fetchStoryPage,
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
  StoryDetail,
  StoryPageView,
} from "@nerd/contracts";

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

        // 2. 1페이지 본문 우선 로드 (전체 페이지 동시 호출로 인한 429 방지)
        try {
          const page1 = await fetchStoryPage(slug, 1);
          if (active) setStoryPages([page1]);
        } catch (err) {
          console.warn("1페이지 사전 로드 지연:", err);
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

  // 독서 중 현재 페이지 본문 온디맨드 로드
  useEffect(() => {
    if (viewState !== "reader" || !story) return;
    // 🚫 6쪽(비하인드)은 본편 API 로 가져오지 않는다 — 템플릿에 branchKey 'a'/'b' 로만 존재해
    //    `GET /stories/:slug/pages/6`(branchKey 'common' 고정 조회)은 **항상 404** 다.
    //    본문은 activeAfterStory 가 준다 (아래 렌더 분기와 같은 조건).
    if (currentPageNo === 6) return;
    if (storyPages.some((p) => p.pageNo === currentPageNo)) return;

    let active = true;
    async function loadPage() {
      try {
        const page = await fetchStoryPage(slug, currentPageNo);
        if (!active) return;
        setStoryPages((prev) => [...prev.filter((p) => p.pageNo !== currentPageNo), page]);
      } catch (err) {
        console.error(`${currentPageNo}페이지 로드 오류:`, err);
      }
    }
    void loadPage();
    return () => {
      active = false;
    };
  }, [slug, currentPageNo, viewState, story, storyPages]);

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
    const total = sessionPages?.totalPages || 7;
    const completed = sessionPages?.completedPages || 0;
    const progressPercent = Math.min(100, Math.round((completed / total) * 100));
    const generationPages = sessionPages?.pages ?? [];

    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 py-8 text-center">
        {/* 마법 오라 애니메이션 */}
        <div className="relative flex h-40 w-40 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-magic opacity-20" />
          <div className="absolute -inset-2 animate-pulse rounded-full bg-primary-soft opacity-60" />
          <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-surface shadow-xl">
            <span className="animate-bounce text-5xl">🎨</span>
          </div>
          <span className="absolute -top-1 -right-1 text-2xl animate-spin">✨</span>
          <span className="absolute -bottom-1 -left-1 text-2xl">📖</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-ink md:text-3xl">나만의 동화책을 만들고 있어요</h1>
          <p className="mt-2 text-sm text-ink-muted">
            AI가 동화 속 장면에 아이의 얼굴과 표정을 마법처럼 합성하고 있어요.
          </p>
        </div>

        {/* 폴링이 연속 실패할 때만 뜬다 — "멈춘 것"과 "느린 것"을 사용자가 구분할 수 있어야 한다. */}
        {pagesPollDegraded && (
          <p className="max-w-md text-sm font-medium text-amber-700" role="status">
            연결이 불안정해요. 진행 상황을 계속 다시 확인하고 있어요.
          </p>
        )}

        {/* 진행률 프로그레스 바 */}
        <div className="w-full max-w-md">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-ink-muted">
            <span>제작 진행률 ({completed}/{total}장)</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-pill border-2 border-line bg-white shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-accent-a via-primary to-magic transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* 페이지별 진행 단계 카드 리스트 */}
        <div className="w-full max-w-md rounded-card border-2 border-line bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-left text-xs font-bold text-ink-muted uppercase tracking-wider">
            페이지별 제작 현황
          </h2>
          <div className="flex flex-col gap-2">
            {generationPages.map((item) => {
              const isBehind = item.branchKey !== "common";
              const pageLabel = isBehind
                ? `6쪽 비하인드 ${item.branchKey.toUpperCase()}`
                : `${item.pageNo}쪽`;
              const status = item?.status || "pending";

              return (
                <div
                  key={`${item.branchKey}-${item.pageNo}`}
                  className="flex items-center justify-between rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink">
                      {pageLabel}
                    </span>
                    {item?.imageUrl && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        삽화 준비 완료
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {status === "succeeded" && (
                      <span className="font-bold text-emerald-600">✓ 완성</span>
                    )}
                    {status === "running" && (
                      <span className="flex items-center gap-1 font-bold text-primary animate-pulse">
                        <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                        그리는 중...
                      </span>
                    )}
                    {status === "pending" && (
                      <span className="text-xs text-neutral-400">대기 중</span>
                    )}
                    {status === "failed" && (
                      <button
                        onClick={() =>
                          void (isBehind
                            ? handleAfterStoryRetry(item.branchKey as StoryBranchKey)
                            : handleRetry(item.pageNo))
                        }
                        disabled={retryingPageNo === item.pageNo || isSelectingBranch !== null}
                        // 색은 디자이너 영역이라 그대로 두고 **누를 수 있는 크기와 포커스 표시**만 보강했다.
                        // ⚠️ 여기도 56px 규약에는 미달한다 — 페이지 목록 한 줄 안에 들어가야 한다.
                        className={`min-h-[40px] rounded-btn bg-red-100 px-3 text-sm font-bold text-red-600 hover:bg-red-200 disabled:pointer-events-none disabled:opacity-50 ${FOCUS_RING}`}
                      >
                        {retryingPageNo === item.pageNo || isSelectingBranch === item.branchKey
                          ? "재시도 중..."
                          : "다시 만들기"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 완료 액션 버튼 */}
        <div className="flex w-full max-w-md flex-col gap-3">
          <p className="text-xs text-ink-muted">
            본편 5장이 준비되면 바로 읽을 수 있어요. 한 장이 실패하더라도 해당 페이지만 다시 만들 수 있습니다.
          </p>

          <Link href={`/library/${slug}`} className={actionClass("ghost", "w-full")}>
            동화 소개로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  // ==========================================
  // 3. 비하인드 이야기 분기 화면 (v-branch)
  // ==========================================
  if (viewState === "branch") {
    const savedChoice = afterStory?.firstBranchChoice;

    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 py-8 text-center">
        <div className="rounded-full bg-magic-strong/10 p-5 text-4xl shadow-inner">
          🌙
        </div>

        <div>
          {/* 톤을 적어 둔다 — 기본값에 기대면 `Badge` 기본이 바뀔 때 이 화면 색이 조용히 따라 바뀐다. */}
          <Badge tone="info">특별 수록: 비하인드 스토리</Badge>
          <h1 className="mt-3 text-3xl font-bold text-ink">
            그날 밤, 이야기는 어떻게 되었을까요?
          </h1>
          <p className="mt-2 text-base text-ink-muted">
            마음에 드는 선택지를 눌러 뒷이야기를 만나 보세요.
          </p>
        </div>

        {isAfterStoryLoading ? (
          <Card className="w-full max-w-md text-ink-muted">
            <p role="status">선택지를 준비하고 있어요...</p>
          </Card>
        ) : afterStory ? (
          <div className="flex w-full max-w-md flex-col gap-3">
            {savedChoice && (
              <p className="rounded-lg bg-primary-soft px-3 py-2 text-sm font-semibold text-ink">
                처음 고른 이야기는 {savedChoice.toUpperCase()}예요. 다시 읽을 때는 두 결과를 모두 볼 수 있어요.
              </p>
            )}
            {afterStory.choices.map((choice) => {
              const isReady = choice.status === "succeeded";
              const isSelecting = isSelectingBranch === choice.branchKey;
              return (
                <Card key={choice.branchKey} className="border-2 border-magic/40 bg-surface text-left">
                  <p className="text-xs font-bold tracking-wider text-magic-strong">선택 {choice.branchKey.toUpperCase()}</p>
                  <h2 className="mt-1 text-lg font-bold text-ink">{choice.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{choice.description}</p>
                  {choice.status === "failed" && (
                    <div className="mt-3 flex flex-col gap-2">
                      <p className="text-sm font-medium text-red-600">
                        이 이야기를 아직 준비하지 못했어요. 다시 만들 수 있어요.
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleAfterStoryRetry(choice.branchKey)}
                        disabled={isSelectingBranch !== null}
                        className={actionClass("ghost", "w-full py-2 text-base disabled:pointer-events-none disabled:opacity-45")}
                      >
                        {isSelecting ? "다시 만드는 중..." : "이 결과 다시 만들기"}
                      </button>
                    </div>
                  )}
                  {choice.status === "pending" || choice.status === "running" ? (
                    <p className="mt-3 text-sm font-medium text-ink-muted">삽화를 준비하고 있어요...</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleBranchChoice(choice.branchKey)}
                    disabled={!isReady || isSelectingBranch !== null}
                    className={actionClass("accentA", "mt-4 w-full py-3 disabled:pointer-events-none disabled:opacity-45")}
                  >
                    {isSelecting ? "선택 저장 중..." : `${choice.title} →`}
                  </button>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="w-full max-w-md border-red-200 text-red-700">
            비하인드 선택지를 준비하지 못했어요.
          </Card>
        )}

        {afterStoryPollDegraded && (
          <p className="max-w-md text-sm font-medium text-amber-700" role="status">
            연결이 불안정해요. 생성 상태를 계속 다시 확인하고 있어요.
          </p>
        )}

        {afterStoryError && (
          <p className="max-w-md text-sm font-medium text-red-600" role="alert">{afterStoryError}</p>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => setViewState("end")} className={actionClass("ghost")}>
            건너뛰기
          </button>
          <button
            type="button"
            onClick={() => {
              setCurrentPageNo(5);
              setViewState("reader");
            }}
            className={actionClass("ghost")}
          >
            ← 5쪽으로 돌아가기
          </button>
        </div>
      </main>
    );
  }

  // ==========================================
  // 4. 완독 축하 화면 (v-end)
  // ==========================================
  if (viewState === "end") {
    const coverImage = sessionPages?.pages.find((p) => p.pageNo === 1)?.imageUrl;

    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-4 py-8 text-center">
        <div className="text-5xl animate-bounce">🎉</div>

        <div>
          <h1 className="text-3xl font-bold text-ink">동화책을 모두 읽었어요!</h1>
          <p className="mt-2 text-sm text-ink-muted">
            내가 주인공이 된 세상에 단 하나뿐인 특별한 모험이었습니다.
          </p>
        </div>

        {coverImage && (
          <div className="h-64 w-64 overflow-hidden rounded-card border-4 border-white shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverImage} alt="동화 표지" decoding="async" className="h-full w-full object-cover" />
          </div>
        )}

        <div className="flex w-full flex-col gap-3">
          <button
            onClick={() => {
              setCurrentPageNo(1);
              setViewState("reader");
            }}
            className={actionClass("primary", "w-full py-3")}
          >
            처음부터 다시 읽기
          </button>
          <Link href="/library" className={actionClass("ghost", "w-full")}>
            서재로 돌아가기
          </Link>
        </div>
      </main>
    );
  }

  // ==========================================
  // 5. 개인화 동화 리더 화면 (v-reader)
  // ==========================================
  const activeAfterStory = activeBranchKey
    ? afterStory?.choices.find((choice) => choice.branchKey === activeBranchKey)
    : undefined;
  const currentStoryPage = storyPages.find((p) => p.pageNo === currentPageNo);
  const currentPageData = currentPageNo === 6 ? activeAfterStory : currentStoryPage;
  const currentSessionPage = currentPageNo === 6 ? activeAfterStory : sessionPages?.pages.find((p) => p.pageNo === currentPageNo);
  const totalPages = 6;
  const isFirstPage = currentPageNo <= 1;
  const isBehindPage = currentPageNo === 6;

  function preloadFollowingPages() {
    if (!sessionPages) return;

    if (currentPageNo < 5) {
      const nextPage = sessionPages.pages.find(
        (page) => page.branchKey === "common" && page.pageNo === currentPageNo + 1,
      );
      void preloadImages([nextPage?.imageUrl]);
      return;
    }

    if (currentPageNo === 5) {
      void preloadImages(
        sessionPages.pages
          .filter((page) => page.pageNo === 6 && page.branchKey !== "common")
          .map((page) => page.imageUrl),
      );
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-5 md:px-8 md:py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
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

      {/* 좌우 2단 책 프레임 (합성 삽화 + 본문) */}
      <BookFrame
        pageNo={currentPageNo}
        imageUrl={currentSessionPage?.imageUrl || undefined}
        onImageLoad={preloadFollowingPages}
        footer={
          <>
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
          </>
        }
      >
        {currentPageData?.bodyText || "본문을 불러오는 중입니다..."}
      </BookFrame>

      {/* 등장인물 안내 */}
      {currentPageNo !== 6 && currentStoryPage?.characters && currentStoryPage.characters.length > 0 ? (
        <p className="text-center text-xs text-ink-muted">
          이 장면에 등장하는 인물:{" "}
          <span className="font-semibold text-ink">
            {currentStoryPage.characters.map((c) => c.displayName).join(" · ")}
          </span>
        </p>
      ) : null}
    </main>
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
