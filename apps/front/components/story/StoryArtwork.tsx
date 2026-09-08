interface StoryArtworkProps {
  className?: string;
}

/**
 * 이미지 URL이 아직 없는 동화의 장식용 표지.
 * PR #22의 하늘·언덕 모티프를 사용하되 실제 장면 삽화로 오해하지 않도록 안내한다.
 */
export function StoryArtwork({ className = "" }: StoryArtworkProps) {
  return (
    <div className={`relative isolate overflow-hidden bg-primary-soft ${className}`}>
      <svg
        viewBox="0 0 512 620"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <rect width="512" height="620" fill="var(--color-primary-tint)" />
        <g fill="var(--color-surface-raised)" opacity=".85">
          <ellipse cx="108" cy="156" rx="66" ry="26" />
          <ellipse cx="148" cy="143" rx="43" ry="23" />
          <ellipse cx="412" cy="217" rx="60" ry="25" />
          <ellipse cx="376" cy="201" rx="40" ry="22" />
        </g>
        <path
          d="M0 496 Q128 452 256 484 T512 472 L512 620 L0 620Z"
          fill="var(--color-accent-a)"
          opacity=".25"
        />
        <path
          d="M0 542 Q150 506 300 536 T512 528 L512 620 L0 620Z"
          fill="var(--color-accent-a)"
          opacity=".35"
        />
      </svg>
      <div className="relative flex h-full min-h-48 flex-col items-center justify-center gap-4 p-6 text-center">
        <svg
          viewBox="0 0 120 100"
          fill="none"
          className="h-24 w-28 text-primary-strong"
          aria-hidden="true"
        >
          <path
            d="M60 23C44 11 25 12 9 19v62c19-7 35-5 51 6 16-11 32-13 51-6V19c-16-7-35-8-51 4Z"
            fill="var(--color-surface)"
          />
          <path
            d="M60 23C44 11 25 12 9 19v62c19-7 35-5 51 6 16-11 32-13 51-6V19c-16-7-35-8-51 4Zm0 0v64"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d="M22 34c9-2 16-1 24 3m-24 9c9-2 16-1 24 3m28-12c8-4 16-5 24-3m-24 15c8-4 16-5 24-3"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            opacity=".45"
          />
        </svg>
        <p className="text-sm font-medium text-ink-muted">삽화를 준비하고 있어요</p>
      </div>
    </div>
  );
}
