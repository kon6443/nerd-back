import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

/**
 * 리더의 페이지 프레임 — 삽화 + 본문 + 하단 조작.
 *
 * ⭐ **기준 뷰포트는 태블릿 가로(1024×768)다.** 시안이 전부 가로라 `md:` 이상에서 좌우 2단으로
 * 펼치고, base(모바일)는 세로 스택으로 **축소 대응**한다. 🚫 이 방향을 뒤집지 않는다 —
 * Tailwind 는 `min-width` 기반이라 뒤집으면 유틸리티 전부와 싸우게 된다.
 *
 * 프레임 클래스를 직접 쓰지 않고 `Card` 를 감싼다 — 테두리·반경·그림자가 카드와 같아야 하고,
 * 두 벌로 두면 팔레트를 바꿀 때 한쪽만 바뀐다.
 *
 * 이벤트 핸들러를 받지 않아 **서버 컴포넌트로 쓸 수 있다.**
 */
export interface BookFrameProps {
  pageNo: number;
  /**
   * 삽화의 **표시용 URL**. 🚫 오브젝트 키를 그대로 넘기지 않는다 — 키 → URL 변환은
   * 호출하는 쪽의 책임이다. 없으면 페이지 번호 플레이스홀더를 그린다(D1 미확정).
   */
  imageUrl?: string;
  children: ReactNode;
  /** 이전/다음 같은 조작. 없으면 렌더하지 않는다. */
  footer?: ReactNode;
}

export function BookFrame({ pageNo, imageUrl, children, footer }: BookFrameProps) {
  return (
    <Card className="w-full">
      <div className="flex flex-col gap-6 md:flex-row md:items-stretch md:gap-8">
        {imageUrl ? (
          // 스토리지가 미확정(D1)이라 next/image 의 도메인 허용 목록을 아직 정할 수 없다.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="aspect-4/3 w-full rounded-card object-cover md:w-1/2"
          />
        ) : (
          <div
            className="flex aspect-4/3 w-full items-center justify-center rounded-card bg-primary-soft md:w-1/2"
            aria-hidden="true"
          >
            <span className="text-5xl font-bold text-primary-strong">{pageNo}</span>
          </div>
        )}

        <div className="flex flex-1 flex-col justify-between gap-6 md:w-1/2">
          {/* 본문의 줄바꿈은 콘텐츠가 정한다 — `whitespace-pre-line` 이 없으면 한 문단으로 뭉친다. */}
          <p className="whitespace-pre-line text-xl leading-relaxed text-ink md:text-2xl">
            {children}
          </p>
          {footer ? <div className="flex flex-wrap items-center gap-3">{footer}</div> : null}
        </div>
      </div>
    </Card>
  );
}
