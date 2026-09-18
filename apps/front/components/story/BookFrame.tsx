import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { StoryArtwork } from "@/components/story/StoryArtwork";
import styles from "./BookFrame.module.css";

/**
 * 책을 이루는 **조각들** — 겉틀(`BookVolume`)·삽화 면·본문 면·대기 골격.
 * 이것들을 조립해 실제로 책을 그리고 넘기는 것은 `BookPager` 다.
 *
 * ⭐ **기준 뷰포트는 태블릿 가로(1024×768)다.** 시안이 전부 가로라 `md:` 이상에서 좌우 2단으로
 * 펼치고, base(모바일)는 세로 스택으로 **축소 대응**한다. 🚫 이 방향을 뒤집지 않는다 —
 * Tailwind 는 `min-width` 기반이라 뒤집으면 유틸리티 전부와 싸우게 된다.
 *
 * 책은 카드와 다른 표면·제본 효과를 쓴다. 카드 컨테이너에 얹지 않고 이 파일의 CSS 모듈이
 * 테두리·반경·그림자를 직접 소유한다.
 *
 * 🚫 여기에 "책 한 판"을 그리는 컴포넌트를 다시 만들지 않는다. 한때 `BookFrame` 이 그 일을 했는데,
 * 넘김이 생기면서 시연·체험이 각각 다른 방식으로 조립하게 되어 **쓰이지 않는 세 번째 조립품**이
 * 되었다(2026-09-14 제거). 조립은 `BookPager` 한 곳이다.
 */

/**
 * 본문이 도착하기 전의 책 골격.
 *
 * ⭐ **같은 CSS 모듈을 쓴다.** 대기 화면을 Tailwind 로 따로 그리면 책의 테두리·반경·그림자·최소
 * 높이가 두 벌이 되어 한쪽만 바뀐다. 틀이 그대로 있어야 본문이 들어올 때 화면이 튀지 않는다.
 */
/**
 * 펼친 하드커버 책의 틀 — 표지와 양옆 종이 단면을 깔고 그 위에 책(`children`)을 올린다.
 * 리더와 그 대기 화면이 **같은 틀**을 쓴다. 한쪽만 그리면 본문이 들어올 때 책 폭이 변한다.
 * 단면 두께는 `style` 의 `--stack-left` / `--stack-right` 로 받는다(없으면 CSS 기본값 — 첫 쪽 모양).
 */
export function BookVolume({ style, children }: { style?: CSSProperties; children: ReactNode }) {
  return (
    <div className={styles.volume} style={style}>
      <div aria-hidden="true" className={styles.cover} />
      <div aria-hidden="true" className={`${styles.stack} ${styles.stackLeft}`} />
      <div aria-hidden="true" className={`${styles.stack} ${styles.stackRight}`} />
      {children}
    </div>
  );
}

function SkeletonVolume({ fill, children }: { fill: boolean; children: ReactNode }) {
  return fill ? <BookVolume>{children}</BookVolume> : <>{children}</>;
}

export function BookFrameSkeleton({ fill = false }: { fill?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`flex w-full animate-pulse flex-col gap-4 motion-reduce:animate-none ${fill ? "min-h-0 flex-1" : ""}`}
    >
      <SkeletonVolume fill={fill}>
        <div className={`${styles.book} ${fill ? styles.fill : ""}`}>
          <div className={styles.surface}>
            <div className={styles.spread}>
              <div className={`${styles.art} bg-line`} />
              <div className={styles.page}>
                {/* 본문의 .text 와 같은 자동 여백 — 골격과 실제 본문의 세로 위치를 맞춘다. */}
                <div className="my-auto flex flex-col gap-5">
                  <div className="h-6 w-full rounded bg-line" />
                  <div className="h-6 w-11/12 rounded bg-line" />
                  <div className="h-6 w-4/5 rounded bg-line" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </SkeletonVolume>
    </div>
  );
}

/**
 * 삽화 면의 **내용**. 틀(`.art`)은 부르는 쪽이 둔다 — 리더는 같은 내용을 넘어가는 종이의 한 면에도 그린다.
 * 🚫 리더에서 삽화 마크업을 따로 적지 않는다. 두 벌이 되면 한쪽만 바뀐다.
 */
export function BookArtContent({
  pageNo,
  imageUrl,
}: {
  pageNo: number;
  /**
   * 삽화의 **표시용 URL**. 🚫 오브젝트 키를 그대로 넘기지 않는다 — 키 → URL 변환은
   * 호출하는 쪽의 책임이다. 없으면 삽화 준비 안내를 표시한다.
   */
  imageUrl?: string | null;
}) {
  return imageUrl && imageUrl.trim() ? (
    <Image
      src={imageUrl.trim()}
      alt=""
      fill
      sizes="(max-width: 768px) 100vw, 50vw"
      preload={pageNo === 1}
      className="object-cover"
      unoptimized
    />
  ) : (
    <StoryArtwork className="h-full" />
  );
}

/** 본문 면의 **내용**. 위와 같은 이유로 틀(`.page`)과 떼어 둔다. */
export function BookTextContent({ pageNo, children }: { pageNo: number; children: ReactNode }) {
  return (
    <>
      {/* 본문의 줄바꿈은 콘텐츠가 정한다 — `whitespace-pre-line` 이 없으면 한 문단으로 뭉친다. */}
      <p className={styles.text}>{children}</p>
      <p className={styles.pageNumber}>{pageNo}쪽</p>
    </>
  );
}
