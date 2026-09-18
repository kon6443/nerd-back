import { describe, expect, it, vi } from "vitest";
import React from "react";
import Image from "next/image";
import type { StoryPageView } from "@nerd/contracts";
import { renderToString } from "react-dom/server";
import type { ComponentProps } from "react";
import { BookReader } from "./BookReader";
import { BookArtContent } from "./BookFrame";
import type { BookPager } from "./BookPager";
import { StoryArtwork } from "./StoryArtwork";

type BookPagerProps = ComponentProps<typeof BookPager>;

// BookPager 와 useNarration, next/navigation 을 목킹하여 BookReader 의 프롭 배선 및 안전성을 검증한다.
let capturedPagerProps: BookPagerProps | null = null;

vi.mock("next/navigation", () => ({
  usePathname: () => "/library/test-story/1",
}));

vi.mock("./BookPager", () => ({
  BookPager: (props: BookPagerProps) => {
    capturedPagerProps = props;
    return <div data-testid="book-pager" />;
  },
  READER_BAR: "reader-bar",
}));

vi.mock("./useNarration", () => ({
  useNarration: () => ({
    enabled: false,
    play: vi.fn(),
    pause: vi.fn(),
    restart: vi.fn(),
  }),
}));

const mockPages: StoryPageView[] = [
  {
    pageNo: 1,
    bodyText: "첫 번째 페이지 본문입니다.",
    baseImageKey: "templates/test/page-1.png",
    baseImageUrl: "https://storage.local/templates/test/page-1.webp",
    narrationAudioUrl: "https://storage.local/audio/1.mp3",
    personaTargetRole: "hero",
    characters: [{ role: "hero", displayName: "주인공", hitbox: null }],
  },
  {
    pageNo: 2,
    bodyText: "두 번째 페이지 본문입니다.",
    baseImageKey: null,
    baseImageUrl: null,
    narrationAudioUrl: null,
    personaTargetRole: null,
    characters: [],
  },
];

describe("BookReader", () => {
  it("renderArt 콜백이 각 페이지의 baseImageUrl을 BookArtContent에 전달한다", () => {
    renderToString(
      <BookReader
        slug="test-story"
        title="테스트 동화"
        pages={mockPages}
        initialPageNo={1}
      />
    );

    if (!capturedPagerProps) throw new Error("capturedPagerProps is null");

    // 1페이지: baseImageUrl 존재 -> Image 컴포넌트 렌더링 (preload=true)
    const art1 = capturedPagerProps.renderArt(1);
    if (!React.isValidElement<{ pageNo: number; imageUrl?: string | null }>(art1)) {
      throw new Error("art1 is not a valid ReactElement");
    }
    expect(art1.type).toBe(BookArtContent);
    expect(art1.props.pageNo).toBe(1);
    expect(art1.props.imageUrl).toBe("https://storage.local/templates/test/page-1.webp");

    const artContent1 = BookArtContent(art1.props);
    if (!React.isValidElement<{ src: string; preload?: boolean }>(artContent1)) {
      throw new Error("artContent1 is not a valid ReactElement");
    }
    expect(artContent1.type).toBe(Image);
    expect(artContent1.props.src).toBe("https://storage.local/templates/test/page-1.webp");
    expect(artContent1.props.preload).toBe(true);

    // 2페이지: baseImageUrl null -> BookArtContent 에 null 전달 -> StoryArtwork 렌더링
    const art2 = capturedPagerProps.renderArt(2);
    if (!React.isValidElement<{ pageNo: number; imageUrl?: string | null }>(art2)) {
      throw new Error("art2 is not a valid ReactElement");
    }
    expect(art2.type).toBe(BookArtContent);
    expect(art2.props.pageNo).toBe(2);
    expect(art2.props.imageUrl).toBeNull();

    const artContent2 = BookArtContent(art2.props);
    if (!React.isValidElement(artContent2)) {
      throw new Error("artContent2 is not a valid ReactElement");
    }
    expect(artContent2.type).toBe(StoryArtwork);
  });

  it("renderText 콜백이 각 페이지의 bodyText를 전달한다", () => {
    renderToString(
      <BookReader
        slug="test-story"
        title="테스트 동화"
        pages={mockPages}
        initialPageNo={1}
      />
    );

    if (!capturedPagerProps) throw new Error("capturedPagerProps is null");

    const text1 = capturedPagerProps.renderText(1);
    if (!React.isValidElement<{ children: React.ReactNode }>(text1)) {
      throw new Error("text1 is not a valid ReactElement");
    }
    expect(text1.props.children).toBe("첫 번째 페이지 본문입니다.");

    const text2 = capturedPagerProps.renderText(2);
    if (!React.isValidElement<{ children: React.ReactNode }>(text2)) {
      throw new Error("text2 is not a valid ReactElement");
    }
    expect(text2.props.children).toBe("두 번째 페이지 본문입니다.");
  });

  it("pages가 비어있거나 범위를 벗어난 pageNo 접근 시에도 크래시 없이 안전하게 폴백한다", () => {
    renderToString(
      <BookReader
        slug="test-story"
        title="빈 동화"
        pages={[]}
        initialPageNo={1}
      />
    );

    if (!capturedPagerProps) throw new Error("capturedPagerProps is null");

    // 존재하지 않는 1페이지 요청
    const artOut = capturedPagerProps.renderArt(1);
    if (!React.isValidElement<{ pageNo: number; imageUrl?: string | null }>(artOut)) {
      throw new Error("artOut is not a valid ReactElement");
    }
    expect(artOut.props.imageUrl).toBeUndefined();
    const artContent = BookArtContent(artOut.props);
    if (!React.isValidElement(artContent)) {
      throw new Error("artContent is not a valid ReactElement");
    }
    expect(artContent.type).toBe(StoryArtwork);

    const textOut = capturedPagerProps.renderText(1);
    if (!React.isValidElement<{ children: React.ReactNode }>(textOut)) {
      throw new Error("textOut is not a valid ReactElement");
    }
    expect(textOut.props.children).toBe("");
  });

  it("onRequestPage 호출 시 에러 없이 동작하고 NarrationPlayer에 audioUrl이 전달된다", () => {
    const html = renderToString(
      <BookReader
        slug="test-story"
        title="테스트 동화"
        pages={mockPages}
        initialPageNo={1}
      />
    );

    if (!capturedPagerProps) throw new Error("capturedPagerProps is null");

    // BookPager에 onRequestPage 콜백이 전달되었고 호출해도 예외가 발생하지 않는다
    expect(() => capturedPagerProps?.onRequestPage(2)).not.toThrow();

    // NarrationPlayer 렌더링 컨트롤 콜백 검증
    const controls = capturedPagerProps.renderTextControls?.(1);
    if (!React.isValidElement<{ audioUrl?: string | null }>(controls)) {
      throw new Error("controls is not a valid ReactElement");
    }
    expect(controls.props.audioUrl).toBe("https://storage.local/audio/1.mp3");

    // 헤더에 쪽 번호 및 제목이 렌더링된다
    const cleanHtml = html.replace(/<!--.*?-->/g, "");
    expect(cleanHtml).toContain("테스트 동화");
    expect(cleanHtml).toContain("1 / 2");
    expect(cleanHtml).toContain("내 얼굴로 만들기");
  });
});
