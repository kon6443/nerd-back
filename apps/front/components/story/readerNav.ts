/**
 * 시연 리더의 경로·넘김 판정 — 렌더에서 떼어 낸 순수 로직이다(테스트 대상).
 *
 * ⭐ **리더 경로 규칙은 여기 한 곳이다.** 리더(`BookReader`)는 주소에서 쪽을 읽고, 전역 헤더
 * (`AppHeader`)는 같은 규칙으로 몰입 화면인지 판단한다. 🚫 두 곳에 정규식을 따로 적지 않는다.
 */

export type TurnDirection = "next" | "prev";

const READER_PATH = /^\/library\/([^/]+)\/(\d+)\/?$/;

/** 몰입 읽기 화면인가 — 전역 헤더를 숨길지 정한다. */
export function isReaderPath(pathname: string): boolean {
  return READER_PATH.test(pathname);
}

export function readerHref(slug: string, pageNo: number): string {
  return `/library/${encodeURIComponent(slug)}/${pageNo}`;
}

/**
 * 주소에서 이 동화의 쪽 번호를 읽는다. 다른 동화·범위 밖·형식 오류는 `null` — 부르는 쪽이 현재 쪽을 유지한다.
 * ⚠️ slug 는 인코딩된 채로 비교한다. `readerHref` 가 인코딩해 주소를 만들기 때문이다.
 */
export function readerPageNo(pathname: string, slug: string, pageCount: number): number | null {
  const match = READER_PATH.exec(pathname);
  if (!match || match[1] !== encodeURIComponent(slug)) return null;
  const pageNo = Number(match[2]);
  return pageNo >= 1 && pageNo <= pageCount ? pageNo : null;
}

export function turnDirection(fromPageNo: number, toPageNo: number): TurnDirection {
  return toPageNo > fromPageNo ? "next" : "prev";
}

/**
 * 책장 단면 두께(px) — 읽은 쪽은 왼쪽에, 남은 쪽은 오른쪽에 쌓인다.
 *
 * ⚠️ `STACK_MAX_PX` 는 `BookFrame.module.css` 의 `--stack-max` 와 같은 값이어야 한다. 책은 그만큼
 * 안쪽으로 물러나 자리를 잡아 두므로, 두께가 바뀌어도 책 크기는 그대로다.
 * 양 끝(첫 쪽·마지막 쪽)에도 `STACK_MIN_PX` 를 남긴다 — 표지 안쪽 면지가 보이는 실제 책처럼.
 */
export const STACK_MIN_PX = 4;
export const STACK_MAX_PX = 18;

export function stackWidths(pageNo: number, pageCount: number): { left: number; right: number } {
  const span = STACK_MAX_PX - STACK_MIN_PX;
  const progress = pageCount > 1 ? (Math.min(Math.max(pageNo, 1), pageCount) - 1) / (pageCount - 1) : 0;
  const left = Math.round(STACK_MIN_PX + span * progress);
  return { left, right: STACK_MIN_PX + STACK_MAX_PX - left };
}
