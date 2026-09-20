import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BookTurn } from "./BookPager";

function renderTurn(layout: "single" | "spread", direction: "next" | "prev") {
  return renderToStaticMarkup(
    <BookTurn
      turn={{ from: 2, to: direction === "next" ? 3 : 1, direction, layout }}
      renderArt={(pageNo) => <span data-art={pageNo} />}
      renderText={(pageNo) => <span data-text={pageNo} />}
      onFinish={() => {}}
    />,
  );
}

describe("넘어가는 책장", () => {
  it.each(["next", "prev"] as const)("모바일 %s: 해당 쪽의 삽화와 본문을 한 벌만 복제한다", (direction) => {
    const html = renderTurn("single", direction);
    const page = direction === "next" ? 2 : 1;
    expect(html.match(/data-art=/g)).toHaveLength(1);
    expect(html.match(/data-text=/g)).toHaveLength(1);
    expect(html).toContain(`data-art="${page}"`);
    expect(html).toContain(`data-text="${page}"`);
    expect(html).toContain(`data-single="${direction}"`);
    expect(html).toContain('aria-hidden="true"');
  });

  it.each(["next", "prev"] as const)("펼침면 %s: 앞뒤 쪽의 내용과 기존 곡면 마디 수를 유지한다", (direction) => {
    const html = renderTurn("spread", direction);
    expect(html.match(/data-art=/g)).toHaveLength(10);
    expect(html.match(/data-text=/g)).toHaveLength(10);
    expect(html).toContain(`data-art="${direction === "next" ? 3 : 2}"`);
    expect(html).toContain(`data-text="${direction === "next" ? 2 : 1}"`);
    expect(html).not.toContain("data-single=");
    expect(html).toContain('aria-hidden="true"');
  });
});
