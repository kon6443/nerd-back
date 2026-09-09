/**
 * 화면 배경 — 동화풍 풀밭.
 *
 * 나무·덤불·꽃 같은 반복 요소는 `<defs>` 의 심볼로 두고 `<use>` 로 배치한다.
 * 위치·크기만 바꿔 늘릴 수 있고, 같은 도형이 파일에 여러 벌 생기지 않는다.
 *
 * 🚫 하늘에 `--color-primary-*` 를 쓰지 않는다 — 주색이 그린이라 **하늘이 초록으로 깔린다.**
 * 하늘은 흰색 → `--color-accent-a-soft`(연한 하늘색)다.
 *
 * ⚠️ 디테일을 **화면 아래쪽과 좌우 끝**에 몰아 둔다. 가운데는 카드가 올라오는 자리라
 * 요소를 넣으면 본문과 겹쳐 읽기 어려워진다.
 */
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
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#eef9ff" />
          <stop offset="1" stopColor="var(--color-accent-a-soft)" />
        </linearGradient>

        {/* 둥근 활엽수 — 겹친 원 + 왼쪽 위 하이라이트 */}
        <g id="story-tree-round">
          <rect x="-7" y="18" width="14" height="46" rx="6" fill="#a47b52" />
          <circle cx="-24" cy="4" r="26" fill="#3fa800" />
          <circle cx="24" cy="6" r="24" fill="#3fa800" />
          <circle cx="0" cy="-18" r="32" fill="var(--color-hill-2)" />
          <circle cx="-18" cy="6" r="26" fill="var(--color-hill-2)" />
          <circle cx="18" cy="8" r="23" fill="var(--color-hill-2)" />
          <circle cx="-12" cy="-26" r="13" fill="var(--color-hill-1)" />
        </g>

        {/* 침엽수 — 둥근 삼각 3단 */}
        <g id="story-tree-pine">
          <rect x="-6" y="26" width="12" height="40" rx="5" fill="#a47b52" />
          <path d="M0-56 36 0h-72z" fill="var(--color-hill-2)" />
          <path d="M0-30 44 22h-88z" fill="#4cb800" />
          <path d="M0-6 52 34h-104z" fill="#3fa800" />
          <path d="M-10-44 0-56l10 12z" fill="var(--color-hill-1)" />
        </g>

        <g id="story-bush">
          <circle cx="-18" cy="0" r="17" fill="#3fa800" />
          <circle cx="18" cy="2" r="15" fill="#3fa800" />
          <circle cx="0" cy="-10" r="21" fill="#4cb800" />
          <circle cx="-8" cy="-16" r="8" fill="var(--color-hill-1)" />
        </g>

        {/* 꽃잎 색은 배치하는 쪽이 `color` 로 정한다 */}
        <g id="story-flower">
          <path d="M0 0v-14" stroke="#3fa800" strokeWidth="3" strokeLinecap="round" />
          <circle cx="0" cy="-18" r="6" fill="currentColor" />
          <circle cx="0" cy="-18" r="2.4" fill="#fff6d6" />
        </g>

        <g id="story-mushroom">
          <rect x="-4" y="-6" width="8" height="14" rx="4" fill="#fff6e5" />
          <path d="M-13-6a13 11 0 0 1 26 0z" fill="#ff4b4b" />
          <circle cx="-5" cy="-10" r="2.6" fill="#fff6e5" />
          <circle cx="5" cy="-8" r="2" fill="#fff6e5" />
        </g>

        <g id="story-cloud" fill="#ffffff">
          <circle cx="-34" cy="6" r="20" />
          <circle cx="0" cy="-8" r="28" />
          <circle cx="32" cy="4" r="22" />
          <rect x="-36" y="4" width="70" height="22" rx="11" />
        </g>

        <g id="story-cottage">
          <rect x="-34" y="-6" width="68" height="48" rx="6" fill="#fff6e5" />
          <path d="M-44-6 0-46l44 40z" fill="#ff4b4b" />
          <path d="M-44-6 0-46l6 5-38 35z" fill="#ff6e6e" />
          <rect x="-10" y="14" width="20" height="28" rx="4" fill="#a47b52" />
          <circle cx="19" cy="12" r="8" fill="#84d8ff" />
          <rect x="14" y="-34" width="12" height="20" rx="4" fill="#c97f5a" />
        </g>
      </defs>

      <rect width="1024" height="768" fill="url(#story-sky)" />

      {/* 해 */}
      <circle cx="906" cy="104" r="66" fill="var(--color-gold)" opacity="0.16" />
      <circle cx="906" cy="104" r="46" fill="var(--color-gold)" />
      <circle cx="892" cy="90" r="16" fill="#ffdc5c" />

      <g opacity="0.95">
        <use href="#story-cloud" transform="translate(158 128) scale(1.05)" />
        <use href="#story-cloud" transform="translate(660 92) scale(.8)" />
        <use href="#story-cloud" transform="translate(468 186) scale(.6)" opacity="0.8" />
      </g>

      {/* 새 */}
      <g stroke="#afd9ee" strokeWidth="3.5" fill="none" strokeLinecap="round">
        <path d="M300 158q9-9 18 0M322 152q9-9 18 0" />
        <path d="M742 214q7-7 14 0M760 209q7-7 14 0" />
      </g>

      {/* 먼 언덕 */}
      <path d="M0 508Q168 448 372 496T736 480T1024 516V768H0Z" fill="var(--color-primary-tint)" />
      <path d="M0 508Q168 448 372 496T736 480T1024 516" fill="none" stroke="#c2f5a0" strokeWidth="6" />
      <g opacity="0.55">
        <use href="#story-tree-pine" transform="translate(96 500) scale(.5)" />
        <use href="#story-tree-pine" transform="translate(148 508) scale(.4)" />
        <use href="#story-tree-pine" transform="translate(890 498) scale(.46)" />
      </g>

      {/* 중간 언덕 */}
      <path d="M0 596Q214 528 468 584T828 566T1024 610V768H0Z" fill="var(--color-hill-1)" />
      <path d="M0 596Q214 528 468 584T828 566T1024 610" fill="none" stroke="#b9f58a" strokeWidth="7" />

      <use href="#story-cottage" transform="translate(842 556) scale(.92)" />
      <use href="#story-tree-round" transform="translate(760 552) scale(.72)" />
      <use href="#story-tree-round" transform="translate(936 566) scale(.6)" />
      <use href="#story-tree-pine" transform="translate(126 566) scale(.78)" />
      <use href="#story-tree-round" transform="translate(52 578) scale(.66)" />
      <use href="#story-tree-round" transform="translate(214 584) scale(.54)" />

      {/* 오솔길 */}
      <path d="M300 768Q356 700 330 652T392 596" fill="none" stroke="#ffefc0" strokeWidth="46" strokeLinecap="round" />
      <path d="M300 768Q356 700 330 652T392 596" fill="none" stroke="#fff8e2" strokeWidth="30" strokeLinecap="round" />

      {/* 앞 언덕 */}
      <path d="M0 682Q248 628 552 676T1024 692V768H0Z" fill="var(--color-hill-2)" />
      <path d="M0 682Q248 628 552 676T1024 692" fill="none" stroke="#6edd16" strokeWidth="8" />

      {/* 풀·꽃·버섯 */}
      <g stroke="#3fa800" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.7">
        <path d="M64 726v-16M74 728l6-14M54 728l-5-13" />
        <path d="M494 736v-15M504 738l6-13" />
        <path d="M880 730v-16M890 732l6-14" />
      </g>
      <g color="#ff4b4b">
        <use href="#story-flower" transform="translate(150 740)" />
        <use href="#story-flower" transform="translate(640 748) scale(.9)" />
      </g>
      <g color="var(--color-gold)">
        <use href="#story-flower" transform="translate(196 752) scale(.85)" />
        <use href="#story-flower" transform="translate(806 742)" />
      </g>
      <g color="var(--color-accent-b)">
        <use href="#story-flower" transform="translate(420 750) scale(.9)" />
        <use href="#story-flower" transform="translate(944 754) scale(.85)" />
      </g>
      <use href="#story-mushroom" transform="translate(258 748) scale(.9)" />
      <use href="#story-mushroom" transform="translate(716 758) scale(.75)" />
      <use href="#story-bush" transform="translate(20 716) scale(.8)" />
      <use href="#story-bush" transform="translate(1000 724) scale(.9)" />
    </svg>
  );
}
