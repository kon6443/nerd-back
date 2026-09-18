import { fetchStoryPage } from "@/lib/api/story";
import { preloadThumbnailImage } from "@/lib/preloadThumbnailImage";

/**
 * 서재에서 책이 펼쳐질 때 속지에 깔 **첫 쪽 삽화**.
 *
 * ⭐ **연출이 시작되기 전에 받아 둔다.** 삽화는 템플릿 원본이라 2MB 가 넘는다 — 누른 뒤에 받기
 * 시작하면 1.1초짜리 연출이 끝나도록 도착하지 않아 빈 종이만 보인다. 카드에 마우스를 올리거나
 * 손을 대는 순간이 **의도가 드러나는 가장 이른 시점**이라 거기서 시작한다.
 *
 * 🚫 목록을 그릴 때 전부 미리 받지 않는다. 동화가 늘어날수록 첫 화면에서 수십 MB 를 끌어오게
 * 되고, 정작 지금 보이는 표지가 뒤로 밀린다.
 *
 * 🚫 `fetchStoryPages`(전 쪽)를 쓰지 않는다. 여기서 필요한 것은 1쪽 하나다.
 */

type PageArtFetcher = (slug: string) => Promise<string | null>;

/** 표준에 아직 없는 필드라 좁게 선언해서 쓴다. 🚫 `any` 로 열지 않는다. */
interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * 미리 받아도 되는 회선인가.
 *
 * ⚠️ **삽화는 템플릿 원본이라 2.3MB 다.** 장식용 연출 하나를 위해 데이터 절약을 켠 사용자나
 * 2G 회선에서 그 용량을 당겨오는 것은 남는 장사가 아니다. 이때는 미리 받지 않고, 연출은
 * 줄 쳐진 빈 종이로 돈다 — 보이는 것만 수수해질 뿐 이동은 그대로다.
 */
function canPrefetchOverNetwork(): boolean {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (!connection) return true;
  if (connection.saveData) return false;
  return !(connection.effectiveType === "slow-2g" || connection.effectiveType === "2g");
}

/** slug → 첫 쪽 삽화 URL. `null` 은 "물어봤는데 없더라" 다(다시 묻지 않는다). */
const resolved = new Map<string, string | null>();
/** 같은 동화에 대한 중복 요청을 막는다. 마우스가 카드 위를 몇 번 지나가도 요청은 한 번이다. */
const pending = new Map<string, Promise<string | null>>();

const defaultFetcher: PageArtFetcher = async (slug) => {
  const page = await fetchStoryPage(slug, 1);
  return page.baseImageUrl ?? null;
};

/** 이미 받아 둔 삽화 URL. 아직 모르면 `undefined`. */
export function getFirstPageArt(slug: string): string | undefined {
  return resolved.get(slug) ?? undefined;
}

/**
 * 첫 쪽 삽화를 받아 두고 브라우저 캐시에 올린다.
 *
 * 실패는 조용히 삼킨다 — 삽화가 없으면 속지가 빈 종이로 보일 뿐 연출도 이동도 멀쩡하다.
 * 🚫 그렇다고 실패를 캐시에 남기지 않는다. 일시적인 네트워크 오류였다면 다음 기회에 다시 받는다.
 */
export function prefetchFirstPageArt(slug: string, fetcher: PageArtFetcher = defaultFetcher): Promise<string | null> {
  const known = resolved.get(slug);
  if (known !== undefined) return Promise.resolve(known);
  if (!canPrefetchOverNetwork()) return Promise.resolve(null);

  const inFlight = pending.get(slug);
  if (inFlight) return inFlight;

  const request = fetcher(slug)
    .then((url) => {
      resolved.set(slug, url);
      // 서명 URL 이라 브라우저 캐시를 태우려면 실제로 한 번 받아 둬야 한다.
      preloadThumbnailImage(url);
      return url;
    })
    .catch(() => null)
    .finally(() => {
      pending.delete(slug);
    });

  pending.set(slug, request);
  return request;
}

/** 테스트 전용. 모듈 전역 캐시를 비운다. */
export function resetFirstPageArtCache(): void {
  resolved.clear();
  pending.clear();
}
