import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FeedbackModal } from "./FeedbackModal";
import { LoginRequiredModal } from "./LoginRequiredModal";

describe("FeedbackModal", () => {
  it("isOpen 이 false 이면 렌더링되지 않는다", () => {
    const html = renderToStaticMarkup(<FeedbackModal isOpen={false} onClose={() => {}} />);
    expect(html).toBe("");
  });

  it("isOpen 이 true 이면 다이얼로그와 입력 폼 요소들이 렌더링된다", () => {
    const html = renderToStaticMarkup(<FeedbackModal isOpen={true} onClose={() => {}} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("피드백 보내기");
    expect(html).toContain("버그 신고");
    expect(html).toContain("기능 제안");
    expect(html).toContain("사용성/디자인");
    expect(html).toContain("기타");
    expect(html).toContain('id="feedback-title"');
    expect(html).toContain('id="feedback-content"');
    expect(html).toContain("보내기");
  });
});

describe("LoginRequiredModal", () => {
  it("isOpen 이 false 이면 렌더링되지 않는다", () => {
    const html = renderToStaticMarkup(<LoginRequiredModal isOpen={false} onClose={() => {}} />);
    expect(html).toBe("");
  });

  it("isOpen 이 true 이면 로그인 안내 문구와 로그인 링크를 렌더링한다", () => {
    const html = renderToStaticMarkup(<LoginRequiredModal isOpen={true} onClose={() => {}} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain("로그인이 필요한 기능입니다");
    expect(html).toContain('href="/login"');
    expect(html).toContain("로그인하러 가기");
  });
});
