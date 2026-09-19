import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { SessionPagesResponse } from "@nerd/contracts";
import { GeneratingView } from "./GeneratingView";

vi.mock("@/components/story/StoryJourneyScene/StoryJourneyScene", () => ({
  StoryJourneyScene: () => <div data-testid="journey-animation" />,
}));

const pages: SessionPagesResponse = {
  sessionId: "00000000-0000-4000-8000-000000000001",
  status: "generating",
  isMainStoryReady: false,
  isAllCompleted: false,
  totalPages: 7,
  completedPages: 2,
  pages: [],
};

function render(props: Partial<React.ComponentProps<typeof GeneratingView>> = {}) {
  return renderToStaticMarkup(<GeneratingView slug="jack-and-beanstalk" sessionPages={pages} {...props} />);
}

describe("loading progress", () => {
  it("shows the actual percentage and completed pages below the animation", () => {
    const html = render();
    expect(html).toContain('aria-valuenow="29"');
    expect(html).toContain("29%");
    expect(html).toContain("7장 중 2장 완성");
    expect(html.indexOf('role="progressbar"')).toBeGreaterThan(html.indexOf('data-testid="journey-animation"'));
  });

  it("keeps partial progress above the reader action when the main story is ready", () => {
    const html = render({ canOpenReader: true, sessionPages: { ...pages, completedPages: 5, isMainStoryReady: true } });
    expect(html).toContain('aria-valuenow="71"');
    expect(html).toContain("71%");
    expect(html).toContain("동화 읽으러 가기");
    expect(html.indexOf('role="progressbar"')).toBeLessThan(html.indexOf("동화 읽으러 가기"));
  });

  it("preserves completed progress together with the failure message", () => {
    const html = render({ sessionPages: { ...pages, status: "failed" } });
    expect(html).toContain('aria-valuenow="29"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("만들기가 잠시 멈췄어요");
  });

  it("keeps a completed bar visible alongside the reader action", () => {
    const html = render({ canOpenReader: true, sessionPages: { ...pages, completedPages: 7, status: "completed", isAllCompleted: true } });
    expect(html).toContain('aria-valuenow="100"');
    expect(html).toContain("100%");
    expect(html).toContain("동화 읽으러 가기");
  });

  it("does not invent a percentage before progress is known", () => {
    const html = render({ sessionPages: null });
    expect(html).toContain('role="progressbar"');
    expect(html).not.toContain("aria-valuenow");
    expect(html).toContain("진행 상황 확인 중");
  });

  it("waits for demo image readiness before displaying completed progress", () => {
    const sessionPages = { ...pages, completedPages: 7, isAllCompleted: true, status: "completed" as const };
    const loading = render({ isDemo: true, sessionPages });
    expect(loading).not.toContain("aria-valuenow");
    expect(loading).toContain("첫 장을 불러오고 있어요");
    const ready = render({ isDemo: true, canOpenReader: true, sessionPages });
    expect(ready).toContain('aria-valuenow="100"');
    expect(ready).toContain("동화 읽으러 가기");
  });
});
