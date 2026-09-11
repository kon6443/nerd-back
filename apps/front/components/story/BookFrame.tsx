import type { ReactNode } from "react";
import Image from "next/image";
import { StoryArtwork } from "@/components/story/StoryArtwork";
import styles from "./BookFrame.module.css";

/**
 * 리더의 페이지 프레임 — 삽화 + 본문 + 하단 조작.
 *
 * ⭐ **기준 뷰포트는 태블릿 가로(1024×768)다.** 시안이 전부 가로라 `md:` 이상에서 좌우 2단으로
 * 펼치고, base(모바일)는 세로 스택으로 **축소 대응**한다. 🚫 이 방향을 뒤집지 않는다 —
 * Tailwind 는 `min-width` 기반이라 뒤집으면 유틸리티 전부와 싸우게 된다.
 *
 * 책 프레임은 카드와 다른 표면·제본 효과를 쓴다. 카드 컨테이너에 얹지 않고 이 컴포넌트가
 * 테두리·반경·그림자를 직접 소유한다.
 *
 * 이벤트 핸들러를 받지 않아 **서버 컴포넌트로 쓸 수 있다.**
 */
export interface BookFrameProps {
  pageNo: number;
  /**
   * 삽화의 **표시용 URL**. 🚫 오브젝트 키를 그대로 넘기지 않는다 — 키 → URL 변환은
   * 호출하는 쪽의 책임이다. 없으면 삽화 준비 안내를 표시한다.
   */
  imageUrl?: string;
  /** 현재 삽화가 브라우저에서 완전히 로드된 뒤 호출한다. 다음 장 프리로드 등에 사용한다. */
  onImageLoad?: () => void;
  children: ReactNode;
  /** 이전/다음 같은 조작. 없으면 렌더하지 않는다. */
  footer?: ReactNode;
}

/**
 * 본문이 도착하기 전의 책 프레임.
 *
 * ⭐ **같은 CSS 모듈을 쓴다.** 대기 화면을 Tailwind 로 따로 그리면 책의 테두리·반경·그림자·최소
 * 높이가 두 벌이 되어 한쪽만 바뀐다. 틀이 그대로 있어야 본문이 들어올 때 화면이 튀지 않는다.
 */
export function BookFrameSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex w-full animate-pulse flex-col gap-4 motion-reduce:animate-none"
    >
      <div className={styles.book}>
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
  );
}

export function BookFrame({ pageNo, imageUrl, onImageLoad, children, footer }: BookFrameProps) {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className={styles.book}>
        <div className={styles.spread}>
          <div className={styles.art}>
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                priority={pageNo === 1}
                className="object-cover"
                onLoad={onImageLoad}
                unoptimized={imageUrl.startsWith("data:")}
              />
            ) : (
              <StoryArtwork className="h-full" />
            )}
          </div>

          <div className={styles.page}>
            {/* 본문의 줄바꿈은 콘텐츠가 정한다 — `whitespace-pre-line` 이 없으면 한 문단으로 뭉친다. */}
            <p className={styles.text}>{children}</p>
            <p className={styles.pageNumber}>{pageNo}쪽</p>
          </div>
        </div>
      </div>
      {footer ? (
        <div className="flex flex-wrap items-center justify-between gap-3">{footer}</div>
      ) : null}
    </div>
  );
}
