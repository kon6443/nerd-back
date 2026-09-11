import type { ReactNode } from "react";
import Image from "next/image";
import { Card } from "@/components/ui/Card";
import { StoryArtwork } from "@/components/story/StoryArtwork";

/**
 * 동화 카드.
 *
 * ⭐ **시안의 세 화면이 같은 구조다** — 홈의 「나의 동화 앨범」, 서재 목록, 비하인드 A/B 선택.
 * 전부 썸네일 + 제목 + 부제 + 설명 + 액션이다. 하나로 잡지 않으면 카드 컴포넌트가 3벌 생긴다.
 *
 * 이벤트 핸들러를 받지 않아 **서버 컴포넌트로 쓸 수 있다.** 상호작용은 `action` 슬롯에
 * 클라이언트 컴포넌트를 넣어 처리한다 — 선택 버튼이 필요한 화면만 클라이언트가 된다.
 */
type Variant = "album" | "library" | "choice";

/** 비하인드 A/B 는 색으로 구분한다(시안). 나머지는 중립. */
const variantTone = {
  album: "neutral",
  library: "neutral",
  choice: "neutral",
} as const;

const variantLayout: Record<Variant, string> = {
  album: "w-44",
  library: "h-full w-full",
  choice: "w-full max-w-sm",
};

export interface StoryCardProps {
  variant?: Variant;
  title: string;
  /** 비하인드 카드의 부제(`늑대의 방문:` 같은 것). 없으면 렌더하지 않는다. */
  subtitle?: string;
  description?: string;
  /**
   * 썸네일의 **표시용 URL**. 🚫 오브젝트 키를 그대로 넘기지 않는다 —
   * 키 → URL 변환은 호출하는 쪽의 책임이다.
   */
  imageUrl?: string;
  /** `accentA`(비하인드 A) · `accentB`(비하인드 B). 지정하지 않으면 중립. */
  tone?: "neutral" | "accentA" | "accentB";
  action?: ReactNode;
}

export function StoryCard({
  variant = "library",
  title,
  subtitle,
  description,
  imageUrl,
  tone,
  action,
}: StoryCardProps) {
  return (
    <Card tone={tone ?? variantTone[variant]} className={variantLayout[variant]}>
      <div className="flex h-full flex-col gap-4">
        {imageUrl ? (
          <div className="relative aspect-4/3 w-full overflow-hidden rounded-card">
            <Image
              src={imageUrl}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 320px"
              className="object-cover"
              unoptimized={imageUrl.startsWith("data:")}
            />
          </div>
        ) : (
          <StoryArtwork className="aspect-4/3 w-full rounded-xl" />
        )}

        <div className="flex flex-col gap-1">
          {subtitle ? <p className="text-sm font-bold text-ink-muted">{subtitle}</p> : null}
          <h2 className="break-keep text-xl font-bold text-balance wrap-anywhere text-ink">{title}</h2>
          {description ? (
            <p className="break-keep text-sm leading-relaxed wrap-anywhere text-ink-muted">{description}</p>
          ) : null}
        </div>

        {action ? <div className="mt-auto pt-1">{action}</div> : null}
      </div>
    </Card>
  );
}
