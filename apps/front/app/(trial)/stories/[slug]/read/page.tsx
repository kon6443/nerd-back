"use client";

import { Suspense, use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { actionClass } from "@/components/ui/actionStyles";
import { BookFrame } from "@/components/story/BookFrame";
import {
  ApiError,
  fetchStoryDetail,
  fetchStoryPage,
  fetchSessionPages,
  personalizeSession,
  retrySessionPage,
} from "@/lib/api";
import type {
  SessionPagesResponse,
  StoryDetail,
  StoryPageView,
} from "@nerd/contracts";

interface PageProps {
  params: Promise<{ slug: string }>;
}

type ViewState = "loading" | "generating" | "reader" | "branch" | "end";

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
  const [currentPageNo, setCurrentPageNo] = useState(1);
  const [retryingPageNo, setRetryingPageNo] = useState<number | null>(null);
  const [isReadyToRead, setIsReadyToRead] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

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

        // 2. 동화 전체 페이지 본문 병렬 로드 (1..pageCount)
        const pageCount = detail.pageCount || 6;
        const pagePromises = Array.from({ length: pageCount }, (_, idx) =>
          fetchStoryPage(slug, idx + 1),
        );
        const pages = await Promise.all(pagePromises);
        if (!active) return;
        setStoryPages(pages);

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

        if (sessionData.isAllCompleted || sessionData.status === "completed") {
          setIsReadyToRead(true);
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
  }, [slug, sessionId, autoStart, router]);

  // 진행 상태 3초 주기 폴링 (generating 상태일 때)
  useEffect(() => {
    if (!sessionId || viewState !== "generating") {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const currentSessionId = sessionId;

    async function poll() {
      try {
        const data = await fetchSessionPages(currentSessionId);
        setSessionPages(data);

        if (data.isAllCompleted || data.status === "completed") {
          setIsReadyToRead(true);
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } catch (err: unknown) {
        console.error("폴링 오류:", err);
      }
    }

    // 3초 간격 폴링
    pollingRef.current = setInterval(poll, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [sessionId, viewState]);

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
            p.pageNo === pageNo ? { ...p, status: "pending", errorMessage: null } : p,
          ),
        };
      });
      setIsReadyToRead(false);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        alert(`재시도 실패: ${err.message}`);
      }
    } finally {
      setRetryingPageNo(null);
    }
  }

  // ==========================================
  // 1. 에러 및 초기 로딩 뷰
  // ==========================================
  if (activeError) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center p-6 text-center">
        <Card className="flex flex-col items-center gap-4">
          <div className="rounded-full bg-red-100 p-4 text-3xl">⚠️</div>
          <h1 className="text-xl font-bold text-ink">문제가 발생했어요</h1>
          <p className="text-sm text-neutral-600">{activeError}</p>
          <div className="flex gap-3 pt-2">
            <Link href={`/stories/${slug}/capture`} className={actionClass("primary")}>
              얼굴 다시 등록하기
            </Link>
            <Link href={`/library/${slug}`} className={actionClass("ghost")}>
              동화 소개로
            </Link>
          </div>
        </Card>
      </main>
    );
  }

  if (viewState === "loading" || !story) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="font-bold text-ink">동화 정보를 준비하고 있어요...</p>
        </div>
      </main>
    );
  }

  // ==========================================
  // 2. 생성 중 대기 화면 (v-generating)
  // ==========================================
  if (viewState === "generating") {
    const total = sessionPages?.totalPages || story.pageCount || 6;
    const completed = sessionPages?.completedPages || 0;
    const progressPercent = Math.min(100, Math.round((completed / total) * 100));

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
          <h1 className="text-2xl font-bold text-ink md:text-3xl">
            {isReadyToRead
              ? "동화책이 모두 완성되었어요! 🎉"
              : "나만의 동화책을 만들고 있어요"}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {isReadyToRead
              ? "아이의 얼굴이 담긴 특별한 이야기책이 준비되었습니다."
              : "AI가 동화 속 장면에 아이의 얼굴과 표정을 마법처럼 합성하고 있어요."}
          </p>
        </div>

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
            {Array.from({ length: total }, (_, i) => i + 1).map((pageNo) => {
              const item = sessionPages?.pages.find((p) => p.pageNo === pageNo);
              const isBehind = pageNo > 4;
              const status = item?.status || "pending";

              return (
                <div
                  key={pageNo}
                  className="flex items-center justify-between rounded-lg border border-line bg-surface-raised px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink">
                      {pageNo}쪽 {isBehind ? "(비하인드)" : ""}
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
                        onClick={() => void handleRetry(pageNo)}
                        disabled={retryingPageNo === pageNo}
                        className="rounded bg-red-100 px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-200"
                      >
                        {retryingPageNo === pageNo ? "재시도 중..." : "다시 만들기"}
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
          {isReadyToRead ? (
            <button
              onClick={() => {
                setCurrentPageNo(1);
                setViewState("reader");
              }}
              className={actionClass("primary", "w-full py-4 text-lg font-bold shadow-lg")}
            >
              📖 동화책 읽으러 가기
            </button>
          ) : (
            <p className="text-xs text-ink-muted">
              잠시만 기다려 주세요. 한 장이 실패하더라도 해당 페이지만 다시 만들 수 있습니다.
            </p>
          )}

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
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-4 py-8 text-center">
        <div className="rounded-full bg-magic-strong/10 p-5 text-4xl shadow-inner">
          🌙
        </div>

        <div>
          <span className="rounded-pill bg-primary-soft px-3 py-1 text-xs font-bold text-primary">
            특별 수록: 비하인드 스토리
          </span>
          <h1 className="mt-3 text-3xl font-bold text-ink">
            그날 밤, 이야기는 어떻게 되었을까요?
          </h1>
          <p className="mt-2 text-base text-ink-muted">
            본편의 모험이 무사히 끝나고, 밤하늘 아래 펼쳐지는 신비로운 뒷이야기가 이어집니다.
          </p>
        </div>

        <Card className="w-full max-w-md border-2 border-magic/40 bg-surface text-left">
          <h2 className="text-lg font-bold text-ink">✨ 이어지는 이야기 (5~6쪽)</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            주인공의 용기 있는 행동 뒤에 찾아온 따스한 기적과 비밀스러운 모험을 확인해 보세요.
          </p>
          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                setCurrentPageNo(5);
                setViewState("reader");
              }}
              className={actionClass("accentA", "w-full py-3")}
            >
              비하인드 이야기 읽기 →
            </button>
          </div>
        </Card>

        <button
          onClick={() => {
            setCurrentPageNo(4);
            setViewState("reader");
          }}
          className={actionClass("ghost")}
        >
          ← 4쪽으로 돌아가기
        </button>
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
            <img src={coverImage} alt="동화 표지" className="h-full w-full object-cover" />
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
  const currentPageData = storyPages.find((p) => p.pageNo === currentPageNo);
  const currentSessionPage = sessionPages?.pages.find((p) => p.pageNo === currentPageNo);
  const totalPages = story.pageCount || 6;
  const isFirstPage = currentPageNo <= 1;
  const isBehindPage = currentPageNo > 4;

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
        footer={
          <>
            {isFirstPage ? (
              <span
                aria-disabled="true"
                className={actionClass("ghost", "pointer-events-none opacity-40")}
              >
                이전
              </span>
            ) : (
              <button
                onClick={() => setCurrentPageNo((prev) => Math.max(1, prev - 1))}
                className={actionClass("ghost")}
              >
                이전
              </button>
            )}

            {/* 도트 인디케이터 (1~6쪽) */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => {
                const isCur = num === currentPageNo;
                const isBehind = num > 4;
                return (
                  <button
                    key={num}
                    onClick={() => setCurrentPageNo(num)}
                    title={`${num}쪽`}
                    className={`h-2.5 w-2.5 rounded-full transition-all ${
                      isCur
                        ? "w-6 bg-primary"
                        : isBehind
                        ? "bg-magic/40 hover:bg-magic"
                        : "bg-line hover:bg-ink-muted"
                    }`}
                  />
                );
              })}
            </div>

            {/* 다음 버튼 분기 처리 */}
            {currentPageNo === 4 ? (
              <button
                onClick={() => setViewState("branch")}
                className={actionClass("accentA", "font-bold")}
              >
                비하인드 이야기 보기 →
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
      {currentPageData?.characters && currentPageData.characters.length > 0 ? (
        <p className="text-center text-xs text-ink-muted">
          이 장면에 등장하는 인물:{" "}
          <span className="font-semibold text-ink">
            {currentPageData.characters.map((c) => c.displayName).join(" · ")}
          </span>
        </p>
      ) : null}
    </main>
  );
}

export default function StoryReadPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </main>
      }
    >
      <StoryReadContent params={params} />
    </Suspense>
  );
}
