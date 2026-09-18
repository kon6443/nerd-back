import { describe, expect, it } from "vitest";
import { COMMON_LINKS, isActive } from "./AppHeader";

describe("AppHeader 네비게이션", () => {
  it("공통 링크에 홈, 서재(mode=create), 서재 둘러보기가 포함되어 있다", () => {
    expect(COMMON_LINKS).toEqual([
      { href: "/", label: "홈" },
      { href: "/library?mode=create", label: "서재" },
      { href: "/library", label: "서재 둘러보기" },
    ]);
  });

  describe("isActive 활성화 상태 판정", () => {
    function mockSearchParams(params: Record<string, string> = {}) {
      return {
        get(key: string) {
          return params[key] ?? null;
        },
      };
    }

    it("홈(/)에서는 홈 링크만 활성화된다", () => {
      expect(isActive("/", "/")).toBe(true);
      expect(isActive("/", "/library?mode=create")).toBe(false);
      expect(isActive("/", "/library")).toBe(false);
    });

    it("서재 페이지에서 mode=create 쿼리가 있을 때 '서재'만 활성화된다", () => {
      const searchParams = mockSearchParams({ mode: "create" });
      expect(isActive("/library", "/library?mode=create", searchParams)).toBe(true);
      expect(isActive("/library", "/library", searchParams)).toBe(false);
      expect(isActive("/library", "/", searchParams)).toBe(false);
    });

    it("서재 페이지에서 mode=create 쿼리가 없을 때 '서재 둘러보기'만 활성화된다", () => {
      const emptyParams = mockSearchParams();
      expect(isActive("/library", "/library", emptyParams)).toBe(true);
      expect(isActive("/library", "/library?mode=create", emptyParams)).toBe(false);
      expect(isActive("/library", "/", emptyParams)).toBe(false);

      // searchParams가 undefined일 때도 둘러보기 활성화
      expect(isActive("/library", "/library", undefined)).toBe(true);
      expect(isActive("/library", "/library?mode=create", undefined)).toBe(false);
    });

    it("동화 상세 경로(/library/[slug])에서도 mode=create 여부에 따라 분기된다", () => {
      const createParams = mockSearchParams({ mode: "create" });
      expect(isActive("/library/little-prince", "/library?mode=create", createParams)).toBe(true);
      expect(isActive("/library/little-prince", "/library", createParams)).toBe(false);

      const emptyParams = mockSearchParams();
      expect(isActive("/library/little-prince", "/library", emptyParams)).toBe(true);
      expect(isActive("/library/little-prince", "/library?mode=create", emptyParams)).toBe(false);
    });

    it("시연 모드 뷰어 경로(/library/[slug]/[pageNo])는 '서재 둘러보기'로 판정된다", () => {
      expect(isActive("/library/little-prince/1", "/library")).toBe(true);
      expect(isActive("/library/little-prince/1", "/library?mode=create")).toBe(false);
    });

    it("제작 모드 경로(/stories/[slug]/capture)는 '서재'로 판정된다", () => {
      expect(isActive("/stories/little-prince/capture", "/library?mode=create")).toBe(true);
      expect(isActive("/stories/little-prince/capture", "/library")).toBe(false);
    });

    it("시연 모드 동화 읽기 경로(/stories/[slug]/read?demo=female)는 '서재 둘러보기'로 판정된다", () => {
      const demoParams = mockSearchParams({ demo: "female" });
      expect(isActive("/stories/red-riding-hood/read", "/library", demoParams)).toBe(true);
      expect(isActive("/stories/red-riding-hood/read", "/library?mode=create", demoParams)).toBe(false);

      const maleParams = mockSearchParams({ demo: "male" });
      expect(isActive("/stories/red-riding-hood/read", "/library", maleParams)).toBe(true);
      expect(isActive("/stories/red-riding-hood/read", "/library?mode=create", maleParams)).toBe(false);
    });

    it("시연 스튜디오 경로(/stories/[slug]/capture?demo=true)도 '서재 둘러보기'로 판정된다", () => {
      const demoParams = mockSearchParams({ demo: "true" });
      expect(isActive("/stories/red-riding-hood/capture", "/library", demoParams)).toBe(true);
      expect(isActive("/stories/red-riding-hood/capture", "/library?mode=create", demoParams)).toBe(false);
    });

    it("인증 관련 경로(/login, /me)에서는 서재 링크들이 비활성화된다", () => {
      expect(isActive("/login", "/library?mode=create")).toBe(false);
      expect(isActive("/login", "/library")).toBe(false);
      expect(isActive("/me", "/library?mode=create")).toBe(false);
      expect(isActive("/me", "/library")).toBe(false);
    });
  });
});
