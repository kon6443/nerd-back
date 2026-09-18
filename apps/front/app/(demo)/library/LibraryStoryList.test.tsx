import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import type { StorySummary } from "@nerd/contracts";
import { LibraryStoryList } from "./LibraryStoryList";
import * as useSessionModule from "@/lib/api/useSession";
import * as apiModule from "@/lib/api";

vi.mock("@/lib/preloadThumbnailImage", () => ({
  preloadThumbnailImage: vi.fn(),
}));

// 목록이 진입 연출을 위해 라우터를 쓴다. `renderToString` 에는 App Router 컨텍스트가 없어
// `useRouter()` 가 "invariant expected app router to be mounted" 로 던진다.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn() }),
}));

const mockStories: StorySummary[] = [
  {
    slug: "jack",
    title: "잭과 콩나무",
    summary: "잭의 모험",
    coverImageKey: "covers/jack.png",
    coverImageUrl: "https://storage.local/jack.png",
  },
];

describe("LibraryStoryList", () => {
  it("비로그인 시연 모드에서는 시연 스튜디오(/stories/{slug}/capture?demo=true)로 라우팅한다", () => {
    vi.spyOn(useSessionModule, "useSession").mockReturnValue({ status: "guest" });

    const html = renderToString(<LibraryStoryList stories={mockStories} isCreateMode={false} />);

    expect(html).toContain('href="/stories/jack/capture?demo=true"');
    expect(html).toContain("동화 펼쳐 보기");
  });

  it("비로그인 제작 모드에서는 캡처 촬영(/stories/{slug}/capture)으로 라우팅한다", () => {
    vi.spyOn(useSessionModule, "useSession").mockReturnValue({ status: "guest" });

    const html = renderToString(<LibraryStoryList stories={mockStories} isCreateMode={true} />);

    expect(html).toContain('href="/stories/jack/capture"');
    expect(html).toContain("이 동화로 만들기");
  });

  it("로그인 상태에서 세션 확인 전이라도 시연 모드는 시연 스튜디오로 즉시 라우팅한다", () => {
    vi.spyOn(useSessionModule, "useSession").mockReturnValue({
      status: "authenticated",
      me: { loginId: "tester" },
    });
    vi.spyOn(apiModule, "getMySessions").mockResolvedValue([]);

    const demoHtml = renderToString(<LibraryStoryList stories={mockStories} isCreateMode={false} />);
    expect(demoHtml).toContain('href="/stories/jack/capture?demo=true"');

    const createHtml = renderToString(<LibraryStoryList stories={mockStories} isCreateMode={true} />);
    expect(createHtml).toContain('href="/library/jack?mode=create"');
  });

  it("로그인 상태에서 이미 얼굴로 만든 동화가 있는 경우라도 시연 모드는 시연 스튜디오로 라우팅하고 제작 모드는 동화 상세로 라우팅한다", () => {
    vi.spyOn(useSessionModule, "useSession").mockReturnValue({
      status: "authenticated",
      me: { loginId: "tester" },
    });

    const demoHtml = renderToString(
      <LibraryStoryList
        stories={mockStories}
        isCreateMode={false}
        initialCompletedSlugs={new Set(["jack"])}
      />,
    );
    expect(demoHtml).toContain('href="/stories/jack/capture?demo=true"');

    const createHtml = renderToString(
      <LibraryStoryList
        stories={mockStories}
        isCreateMode={true}
        initialCompletedSlugs={new Set(["jack"])}
      />,
    );
    expect(createHtml).toContain('href="/library/jack?mode=create"');
  });

  it("로그인 상태에서 얼굴로 만든 동화가 없는 경우 시연은 시연 스튜디오, 제작은 캡처로 라우팅한다", () => {
    vi.spyOn(useSessionModule, "useSession").mockReturnValue({
      status: "authenticated",
      me: { loginId: "tester" },
    });

    const demoHtml = renderToString(
      <LibraryStoryList
        stories={mockStories}
        isCreateMode={false}
        initialCompletedSlugs={new Set()}
      />,
    );
    expect(demoHtml).toContain('href="/stories/jack/capture?demo=true"');

    const createHtml = renderToString(
      <LibraryStoryList
        stories={mockStories}
        isCreateMode={true}
        initialCompletedSlugs={new Set()}
      />,
    );
    expect(createHtml).toContain('href="/stories/jack/capture"');
  });
});
