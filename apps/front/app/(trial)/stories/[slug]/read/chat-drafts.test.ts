import { describe, expect, it } from "vitest";
import { createChatDraftStore } from "./chat-drafts";

describe("리더의 임시 질문 초안", () => {
  it("책·페이지·분기에 따라 질문과 배역을 분리한다", () => {
    const drafts = createChatDraftStore();
    drafts.set("book", 1, "common", { role: "wolf", message: "기분이 어때?" });
    drafts.set("book", 6, "a", { role: "wolf", message: "A의 질문" });
    drafts.set("book", 6, "b", { role: "rabbit", message: "B의 질문" });
    expect(drafts.get("book", 1, "common")).toEqual({ role: "wolf", message: "기분이 어때?" });
    expect(drafts.get("book", 6, "a")?.message).toBe("A의 질문");
    expect(drafts.get("book", 6, "b")?.role).toBe("rabbit");
    expect(drafts.get("other", 1, "common")).toBeUndefined();
    expect(drafts.get("book", 2, "common")).toBeUndefined();
  });
  it("질문을 사용하면 해당 장면만 지우고 인증 변경 시 전체를 지운다", () => {
    const drafts = createChatDraftStore();
    const draft = { role: "wolf", message: "질문" };
    drafts.set("book", 6, "a", draft);
    drafts.set("book", 6, "b", draft);
    drafts.delete("book", 6, "a");
    expect(drafts.get("book", 6, "a")).toBeUndefined();
    expect(drafts.get("book", 6, "b")).toEqual(draft);
    drafts.clear();
    expect(drafts.get("book", 6, "b")).toBeUndefined();
  });
  it("다른 리더 인스턴스나 새로고침으로 전달하지 않는다", () => {
    const drafts = createChatDraftStore();
    drafts.set("book", 1, "common", { role: "wolf", message: "질문" });
    expect(createChatDraftStore().get("book", 1, "common")).toBeUndefined();
  });
});
