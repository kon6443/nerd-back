/**
 * 시연 모드에서 사전 합성된 에셋이 존재하는 경우 해당 정적 경로를 반환하고,
 * 아직 미준비된 페이지는 원본 템플릿 URL로 안전하게 폴백한다.
 */
export function getDemoStoryImageUrl(
  slug: string,
  demoParam: string | null,
  pageNo: number,
  fallbackUrl: string | null,
): string | null {
  if (!demoParam || (demoParam !== "male" && demoParam !== "female")) {
    return fallbackUrl;
  }

  // 잭과 콩나무 1~5쪽 사전 합성 에셋
  if (slug === "jack-and-beanstalk" && pageNo >= 1 && pageNo <= 5) {
    return `/demo/stories/jack-and-beanstalk/${demoParam}/page-${pageNo}.jpg`;
  }

  return fallbackUrl;
}
