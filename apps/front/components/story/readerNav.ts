/**
 * 시연 리더의 경로·넘김 판정 — 렌더에서 떼어 낸 순수 로직이다(테스트 대상).
 *
 * ⭐ **리더 경로 규칙은 여기 한 곳이다.** 리더(`BookReader`)는 주소에서 쪽을 읽고, 전역 헤더
 * (`AppHeader`)는 같은 규칙으로 몰입 화면인지 판단한다. 🚫 두 곳에 정규식을 따로 적지 않는다.
 */

export type TurnDirection = "next" | "prev";

/**
 * 책이 좌우 펼침면이 되는 전환점.
 * ⚠️ `BookFrame.module.css` 의 `@media (min-width: 48rem)` 과 **같은 값이어야 한다.**
 * 넘김 모양(`BookPager`)과 대화 dock 가능 여부(`ChatSurface`)가 이 값으로 갈린다.
 */
export const SPREAD_QUERY = "(min-width: 48rem)";

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

/**
 * 지금 쪽 기준으로 **미리 받아 둘 삽화 URL** 을 고른다.
 *
 * ⭐ 넘김이 시작되는 순간 도착 쪽 삽화가 이미 있어야 한다. 없으면 넘어가는 종이 뒷면이
 * 비어 보인다(`front-code-patterns.md` 리더 절).
 *
 * 🚫 전 쪽을 한꺼번에 고르지 않는다 — 첫 화면 대역폭을 늘려 **정작 지금 볼 쪽이 늦어진다.**
 * 다음 쪽을 가장 먼저 두는 이유는 대부분의 사람이 앞으로 넘기기 때문이다.
 */
export function adjacentArtUrls(
  artUrls: ReadonlyArray<string | null | undefined>,
  currentPageNo: number,
): string[] {
  const offsets = [1, -1, 2];
  const picked: string[] = [];
  for (const offset of offsets) {
    const url = artUrls[currentPageNo - 1 + offset];
    // 같은 URL 이 두 번 들어가지 않게 한다 — 쪽 수가 적으면 인덱스가 겹칠 수 있다.
    if (url && !picked.includes(url)) picked.push(url);
  }
  return picked;
}
