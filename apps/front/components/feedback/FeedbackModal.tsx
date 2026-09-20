"use client";

import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CATEGORY_LABELS,
  type FeedbackCategory,
} from "@nerd/contracts";
import { useEffect, useState, useTransition } from "react";
import { sendFeedback } from "@/lib/api";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  if (!isOpen) return null;
  return <FeedbackModalDialog onClose={onClose} />;
}

function FeedbackModalDialog({ onClose }: { onClose: () => void }) {
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  // 성공 상태일 때 2.5초 후 자동 닫힘
  useEffect(() => {
    if (!isSuccess) return;
    const timer = setTimeout(() => {
      onClose();
    }, 2500);
    return () => clearTimeout(timer);
  }, [isSuccess, onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle) {
      setErrorMessage("제목을 입력해 주세요.");
      return;
    }
    if (trimmedTitle.length > 50) {
      setErrorMessage("제목은 최대 50자까지 입력 가능합니다.");
      return;
    }
    if (trimmedContent.length < 5) {
      setErrorMessage("내용은 최소 5자 이상 입력해 주세요.");
      return;
    }
    if (trimmedContent.length > 1000) {
      setErrorMessage("내용은 최대 1,000자까지 입력 가능합니다.");
      return;
    }

    startTransition(async () => {
      try {
        const pageUrl = typeof window !== "undefined" ? window.location.pathname : undefined;
        const deviceInfo =
          typeof window !== "undefined"
            ? {
                userAgent: navigator.userAgent,
                screenResolution: `${window.innerWidth}x${window.innerHeight}`,
              }
            : undefined;

        await sendFeedback({
          category,
          title: trimmedTitle,
          content: trimmedContent,
          pageUrl,
          deviceInfo,
        });

        setIsSuccess(true);
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "피드백 전송에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-night/40 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-line bg-paper p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {isSuccess ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary-tint text-primary-strong">
              <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="mt-4 text-xl font-extrabold text-ink">소중한 피드백 감사합니다!</h3>
            <p className="mt-2 text-sm text-ink-muted">
              보내주신 의견은 서비스 개선에 소중히 활용하겠습니다.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 min-h-10 rounded-xl bg-primary px-6 text-sm font-bold text-paper transition-colors hover:bg-primary-strong"
            >
              확인
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-hidden="true">💬</span>
                <h3 id="feedback-modal-title" className="text-lg font-extrabold text-ink">
                  피드백 보내기
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="닫기"
                className="flex size-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface hover:text-ink"
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {/* 카테고리 선택 */}
              <div>
                <label className="block text-xs font-bold text-ink-muted">유형 선택</label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {FEEDBACK_CATEGORIES.map((cat) => {
                    const active = category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategory(cat)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                          active
                            ? "bg-primary text-paper shadow-xs"
                            : "bg-surface text-ink-muted hover:bg-line hover:text-ink"
                        }`}
                      >
                        {FEEDBACK_CATEGORY_LABELS[cat]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 제목 입력 */}
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="feedback-title" className="block text-xs font-bold text-ink-muted">
                    제목 <span className="text-danger">*</span>
                  </label>
                  <span className="text-[0.75rem] text-ink-muted">{title.length}/50</span>
                </div>
                <input
                  id="feedback-title"
                  type="text"
                  maxLength={50}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="요약 제목을 입력해 주세요"
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted/50 focus:border-primary focus:bg-paper focus:outline-none"
                  disabled={isPending}
                />
              </div>

              {/* 내용 입력 */}
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="feedback-content" className="block text-xs font-bold text-ink-muted">
                    내용 <span className="text-danger">*</span>
                  </label>
                  <span className="text-[0.75rem] text-ink-muted">{content.length}/1000</span>
                </div>
                <textarea
                  id="feedback-content"
                  rows={5}
                  maxLength={1000}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="불편하셨던 점이나 제안하고 싶은 내용을 자유롭게 적어주세요 (최소 5자)"
                  className="mt-1.5 w-full resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted/50 focus:border-primary focus:bg-paper focus:outline-none"
                  disabled={isPending}
                />
              </div>

              {errorMessage ? (
                <div className="rounded-xl bg-danger-soft px-3 py-2 text-xs font-medium text-danger-strong">
                  {errorMessage}
                </div>
              ) : null}

              {/* 하단 버튼 */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isPending}
                  className="min-h-10 rounded-xl px-4 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface hover:text-ink disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex min-h-10 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-paper transition-colors hover:bg-primary-strong disabled:opacity-50"
                >
                  {isPending ? (
                    <div className="flex items-center gap-1.5">
                      <svg className="size-4 animate-spin text-paper" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      <span>보내는 중...</span>
                    </div>
                  ) : (
                    "보내기"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
