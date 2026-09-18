import { describe, expect, it } from "vitest";
import React from "react";
import Image from "next/image";
import { renderToString } from "react-dom/server";
import { BookArtContent } from "./BookFrame";
import { StoryArtwork } from "./StoryArtwork";

describe("BookArtContent", () => {
  it("첫 페이지(pageNo: 1)에 imageUrl이 있으면 Image 컴포넌트에 preload=true를 설정한다", () => {
    const element = BookArtContent({
      pageNo: 1,
      imageUrl: "https://storage.local/pages/page-1.webp",
    });

    expect(React.isValidElement(element)).toBe(true);
    expect(element.type).toBe(Image);
    expect(element.props.src).toBe("https://storage.local/pages/page-1.webp");
    expect(element.props.preload).toBe(true);
    expect(element.props.fill).toBe(true);
  });

  it("2쪽 이후 페이지에 imageUrl이 있으면 Image 컴포넌트에 preload=false를 설정한다", () => {
    const element = BookArtContent({
      pageNo: 2,
      imageUrl: "https://storage.local/pages/page-2.webp",
    });

    expect(React.isValidElement(element)).toBe(true);
    expect(element.type).toBe(Image);
    expect(element.props.src).toBe("https://storage.local/pages/page-2.webp");
    expect(element.props.preload).toBe(false);
  });

  it("imageUrl이 null이면 StoryArtwork 대체 화면을 렌더링한다", () => {
    const element = BookArtContent({
      pageNo: 1,
      imageUrl: null,
    });

    expect(React.isValidElement(element)).toBe(true);
    expect(element.type).toBe(StoryArtwork);
  });

  it("imageUrl이 undefined이면 StoryArtwork 대체 화면을 렌더링한다", () => {
    const element = BookArtContent({
      pageNo: 3,
    });

    expect(React.isValidElement(element)).toBe(true);
    expect(element.type).toBe(StoryArtwork);
  });

  it("imageUrl이 빈 문자열이면 StoryArtwork 대체 화면을 렌더링한다", () => {
    const element = BookArtContent({
      pageNo: 1,
      imageUrl: "",
    });

    expect(React.isValidElement(element)).toBe(true);
    expect(element.type).toBe(StoryArtwork);
  });

  it("imageUrl이 공백 문자열이면 StoryArtwork 대체 화면을 렌더링한다", () => {
    const element = BookArtContent({
      pageNo: 1,
      imageUrl: "   ",
    });

    expect(React.isValidElement(element)).toBe(true);
    expect(element.type).toBe(StoryArtwork);
  });

  it("renderToString으로 실제 HTML 변환 시 에러 없이 img 태그를 렌더링한다", () => {
    const html = renderToString(
      <BookArtContent pageNo={1} imageUrl="https://storage.local/pages/page-1.webp" />
    );
    expect(html).toContain("https://storage.local/pages/page-1.webp");
  });
});
