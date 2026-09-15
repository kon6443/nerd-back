export type LibraryModeValue = string | string[] | undefined;

/** URL의 mode 값이 정확히 하나의 `create`일 때만 제작 흐름이다. */
export function isLibraryCreateMode(mode: LibraryModeValue): boolean {
  return mode === "create";
}

export function getLibraryHref(isCreateMode: boolean): string {
  return isCreateMode ? "/library?mode=create" : "/library";
}

export function getLibraryStoryHref(slug: string, isCreateMode: boolean): string {
  const pathname = `/library/${encodeURIComponent(slug)}`;
  return isCreateMode ? `${pathname}?mode=create` : pathname;
}
