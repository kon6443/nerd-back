export type LibraryModeValue = string | string[] | null | undefined;

/** URL의 mode 값이 정확히 하나의 `create`일 때만 제작 흐름이다. */
export function isLibraryCreateMode(mode: LibraryModeValue): boolean {
  return mode === "create";
}

export function getLibraryHref(isCreateMode: boolean): string {
  return isCreateMode ? "/library?mode=create" : "/library";
}

/**
 * 서재 카드 액션 버튼의 목적지 URL을 결정한다.
 *
 * - 시연 모드 (!isCreateMode):
 *   내 얼굴 동화 존재 여부와 무관하게 무조건 템플릿 본동화 1쪽(`/library/{slug}/1`)으로 이동한다.
 * - 제작 모드 (isCreateMode):
 *   - 이미 얼굴로 만든 동화가 있는 경우: `/library/{slug}?mode=create` (동화 상세에서 이어보기/다시 만들기 선택)
 *   - 아직 얼굴로 만들지 않은 경우: `/stories/{slug}/capture` (얼굴 촬영 화면으로 직행)
 *   - 세션 확인 중: 안전한 기본 경로 `/library/{slug}?mode=create`
 */
export function getLibraryStoryHref(
  slug: string,
  isCreateMode: boolean,
  hasCompletedStory?: boolean,
): string {
  const encodedSlug = encodeURIComponent(slug);

  // 시연 모드: 내 얼굴 동화가 있더라도 무조건 템플릿 본 동화 1쪽으로 바로 이동
  if (!isCreateMode) {
    return `/library/${encodedSlug}/1`;
  }

  // 제작 모드 (isCreateMode === true)
  if (hasCompletedStory === true) {
    return `/library/${encodedSlug}?mode=create`;
  }
  if (hasCompletedStory === false) {
    return `/stories/${encodedSlug}/capture`;
  }
  return `/library/${encodedSlug}?mode=create`;
}
