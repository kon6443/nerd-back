import { describe, expect, it, vi } from "vitest";
import LibraryCaptureRedirectPage from "./page";
import * as navigation from "next/navigation";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("LibraryCaptureRedirectPage", () => {
  it("기본 slug를 /stories/{slug}/capture 로 리다이렉트한다", async () => {
    await LibraryCaptureRedirectPage({
      params: Promise.resolve({ slug: "jack" }),
    });

    expect(navigation.redirect).toHaveBeenCalledWith("/stories/jack/capture");
  });

  it("특수문자가 포함된 slug를 인코딩하여 리다이렉트한다", async () => {
    await LibraryCaptureRedirectPage({
      params: Promise.resolve({ slug: "story/one" }),
    });

    expect(navigation.redirect).toHaveBeenCalledWith("/stories/story%2Fone/capture");
  });
});
