import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { StorySessionActions } from "./StorySessionActions";
import * as useSessionModule from "@/lib/api/useSession";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

describe("StorySessionActions", () => {
  it("비로그인 시연 모드에서는 시연 동화 읽기 버튼을 렌더링한다", () => {
    vi.spyOn(useSessionModule, "useSession").mockReturnValue({ status: "guest" });

    const html = renderToString(<StorySessionActions slug="jack" isCreateMode={false} />);

    expect(html).toContain('href="/library/jack/1"');
    expect(html).toContain("시연 동화 읽기");
  });

  it("비로그인 제작 모드에서는 내 얼굴로 만들기(/stories/{slug}/capture) 버튼을 렌더링한다", () => {
    vi.spyOn(useSessionModule, "useSession").mockReturnValue({ status: "guest" });

    const html = renderToString(<StorySessionActions slug="jack" isCreateMode={true} />);

    expect(html).toContain('href="/stories/jack/capture"');
    expect(html).toContain("내 얼굴로 만들기");
  });

  it("로그인 상태에서 완성된 세션이 있는 경우 시연 모드에서는 내 얼굴 동화 읽기와 시연 동화 읽기를 모두 제공한다", () => {
    vi.spyOn(useSessionModule, "useSession").mockReturnValue({
      status: "authenticated",
      me: { loginId: "tester" },
    });

    const html = renderToString(
      <StorySessionActions
        slug="jack"
        isCreateMode={false}
        initialSession={{
          id: "s1",
          templateId: 1,
          templateSlug: "jack",
          templateTitle: "잭과 콩나무",
          status: "completed",
          referenceImageUrl: "https://storage.local/face.webp",
          thumbnailImageUrl: null,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        }}
      />,
    );

    expect(html).toContain('href="/stories/jack/read?sessionId=s1"');
    expect(html).toContain("내 얼굴 동화 읽기");
    expect(html).toContain('href="/library/jack/1"');
    expect(html).toContain("시연 동화 읽기");
    expect(html).toContain("다른 얼굴로 다시 만들기");
  });

  it("로그인 상태에서 완성된 세션이 있는 경우 제작 모드에서는 시연 동화 읽기를 제외하고 노출한다", () => {
    vi.spyOn(useSessionModule, "useSession").mockReturnValue({
      status: "authenticated",
      me: { loginId: "tester" },
    });

    const html = renderToString(
      <StorySessionActions
        slug="jack"
        isCreateMode={true}
        initialSession={{
          id: "s1",
          templateId: 1,
          templateSlug: "jack",
          templateTitle: "잭과 콩나무",
          status: "completed",
          referenceImageUrl: "https://storage.local/face.webp",
          thumbnailImageUrl: null,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        }}
      />,
    );

    expect(html).toContain('href="/stories/jack/read?sessionId=s1"');
    expect(html).toContain("내 얼굴 동화 읽기");
    expect(html).not.toContain("시연 동화 읽기");
    expect(html).toContain("다른 얼굴로 다시 만들기");
  });

  it("제작 중인 세션이 있는 경우 제작 중인 동화 이어보기 버튼을 렌더링한다", () => {
    vi.spyOn(useSessionModule, "useSession").mockReturnValue({
      status: "authenticated",
      me: { loginId: "tester" },
    });

    const html = renderToString(
      <StorySessionActions
        slug="jack"
        isCreateMode={false}
        initialSession={{
          id: "s2",
          templateId: 1,
          templateSlug: "jack",
          templateTitle: "잭과 콩나무",
          status: "generating",
          referenceImageUrl: null,
          thumbnailImageUrl: null,
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        }}
      />,
    );

    expect(html).toContain('href="/stories/jack/read?sessionId=s2&amp;autoStart=true"');
    expect(html).toContain("제작 중인 동화 이어보기");
    expect(html).toContain("취소하고 새로 만들기");
  });

  it("슬러그에 특수문자가 포함된 경우 URL 인코딩을 적용한다", () => {
    vi.spyOn(useSessionModule, "useSession").mockReturnValue({ status: "guest" });

    const demoHtml = renderToString(<StorySessionActions slug="story/one" isCreateMode={false} />);
    expect(demoHtml).toContain('href="/library/story%2Fone/1"');

    const createHtml = renderToString(<StorySessionActions slug="story/one" isCreateMode={true} />);
    expect(createHtml).toContain('href="/stories/story%2Fone/capture"');
  });
});
