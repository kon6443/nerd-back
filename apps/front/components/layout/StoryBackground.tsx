/** 시안의 하늘·구름·언덕을 반응형 화면 배경으로 쓴다. */
export function StoryBackground() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      viewBox="0 0 1024 768"
      preserveAspectRatio="xMidYMax slice"
    >
      <defs>
        <linearGradient id="story-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--color-primary-tint)" />
          <stop offset="1" stopColor="var(--color-primary-soft)" />
        </linearGradient>
      </defs>
      <rect width="1024" height="768" fill="url(#story-sky)" />
      <g fill="white" opacity="0.8">
        <ellipse cx="150" cy="118" rx="66" ry="30" />
        <ellipse cx="200" cy="106" rx="46" ry="24" />
        <ellipse cx="860" cy="150" rx="76" ry="32" />
        <ellipse cx="916" cy="136" rx="48" ry="23" />
      </g>
      <path
        d="M0 640Q170 556 370 618T700 596T1024 652V768H0Z"
        fill="var(--color-hill-1)"
        opacity="0.72"
      />
      <path d="M0 690Q230 616 480 676T820 658T1024 704V768H0Z" fill="var(--color-hill-1)" />
      <path d="M0 736Q280 686 590 730T1024 740V768H0Z" fill="var(--color-hill-2)" />
    </svg>
  );
}
