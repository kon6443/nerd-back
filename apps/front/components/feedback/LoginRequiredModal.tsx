"use client";

import Link from "next/link";
import { useEffect } from "react";

interface LoginRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginRequiredModal({ isOpen, onClose }: LoginRequiredModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-night/40 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-required-title"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-line bg-paper p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-strong">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <div>
            <h3 id="login-required-title" className="text-lg font-extrabold text-ink">
              로그인이 필요한 기능입니다
            </h3>
            <p className="mt-1 text-sm text-ink-muted">
              피드백을 보내시려면 로그인이 필요합니다. 로그인 페이지로 이동하시겠습니까?
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-xl px-4 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface hover:text-ink"
          >
            취소
          </button>
          <Link
            href="/login"
            onClick={onClose}
            className="flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-paper transition-colors hover:bg-primary-strong"
          >
            로그인하러 가기
          </Link>
        </div>
      </div>
    </div>
  );
}
