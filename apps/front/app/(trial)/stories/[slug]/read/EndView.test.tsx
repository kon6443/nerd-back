import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { EndView } from "./EndView";
import * as useSessionModule from "@/lib/api/useSession";

describe("EndView", () => {
  it("시연 모드(isDemo)이고 비로그인(guest) 상태일 때, 로그인 유도 경로로 연결된다", () => {
    vi.spyOn(useSessionModule, "useSession").mockReturnValue({ status: "guest" });

    const html = renderToString(
      <EndView
        sessionPages={null}
        onRestart={() => {}}
        isDemo={true}
        storySlug="jack-and-beanstalk"
      />,
    );

    expect(html).toContain("동화 속 주인공이 되어보러 갈까요? ✨");
    expect(html).toContain("단 한 장의 사진으로 세상에 하나뿐인 나만의 이야기를 만들어 보세요.");
    expect(html).toContain(
      `href="${`/login?redirect=${encodeURIComponent("/stories/jack-and-beanstalk/capture")}`}"`,
    );
    expect(html).toContain("지금 내 사진으로 진짜 동화 만들기");
    expect(html).toContain("로그인 후 바로 내 사진으로 세상에 하나뿐인 동화를 만들 수 있어요.");
  });

  it("시연 모드(isDemo)이고 로그인(authenticated) 상태일 때, 곧바로 capture 경로로 연결된다", () => {
    vi.spyOn(useSessionModule, "useSession").mockReturnValue({
      status: "authenticated",
      me: { loginId: "tester" },
    });

    const html = renderToString(
      <EndView
        sessionPages={null}
        onRestart={() => {}}
        isDemo={true}
        storySlug="jack-and-beanstalk"
      />,
    );

    expect(html).toContain('href="/stories/jack-and-beanstalk/capture"');
    expect(html).toContain("지금 내 사진으로 진짜 동화 만들기");
    expect(html).not.toContain("로그인 후 바로 내 사진으로");
  });

  it("일반 완독 모드일 때는 기본 완독 메시지와 서재 버튼이 렌더링된다", () => {
    vi.spyOn(useSessionModule, "useSession").mockReturnValue({
      status: "authenticated",
      me: { loginId: "tester" },
    });

    const html = renderToString(
      <EndView sessionPages={null} onRestart={() => {}} isDemo={false} />,
    );

    expect(html).toContain("동화책을 모두 읽었어요!");
    expect(html).toContain("서재로 돌아가기");
  });
});
