import type { StoryCharacterHitbox } from "@nerd/contracts";

export interface Size {
  width: number;
  height: number;
}

export interface PixelRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function isPositiveSize(size: Size): boolean {
  return (
    Number.isFinite(size.width) &&
    Number.isFinite(size.height) &&
    size.width > 0 &&
    size.height > 0
  );
}

/** 가운데 정렬된 `object-fit: cover` 이미지의 정규 히트박스를 화면 픽셀 좌표로 옮긴다. */
export function projectCoverHitbox(
  hitbox: StoryCharacterHitbox,
  image: Size,
  container: Size,
): PixelRect | null {
  if (!isPositiveSize(image) || !isPositiveSize(container)) return null;
  if (![hitbox.x, hitbox.y, hitbox.width, hitbox.height].every(Number.isFinite)) return null;
  if (hitbox.width <= 0 || hitbox.height <= 0) return null;

  const scale = Math.max(container.width / image.width, container.height / image.height);
  const renderedWidth = image.width * scale;
  const renderedHeight = image.height * scale;
  const cropX = (renderedWidth - container.width) / 2;
  const cropY = (renderedHeight - container.height) / 2;

  const rawLeft = hitbox.x * renderedWidth - cropX;
  const rawTop = hitbox.y * renderedHeight - cropY;
  const rawRight = rawLeft + hitbox.width * renderedWidth;
  const rawBottom = rawTop + hitbox.height * renderedHeight;

  const left = Math.max(0, Math.min(container.width, rawLeft));
  const top = Math.max(0, Math.min(container.height, rawTop));
  const right = Math.max(0, Math.min(container.width, rawRight));
  const bottom = Math.max(0, Math.min(container.height, rawBottom));
  if (right <= left || bottom <= top) return null;

  return { left, top, width: right - left, height: bottom - top };
}

/** 작은 캐릭터도 누를 수 있도록 중심을 유지하며 목표 크기까지 넓히고 삽화 경계 안으로 자른다. */
export function ensureMinimumTarget(
  rect: PixelRect,
  container: Size,
  minimumSize: number,
): PixelRect {
  const width = Math.min(container.width, Math.max(rect.width, minimumSize));
  const height = Math.min(container.height, Math.max(rect.height, minimumSize));
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const left = Math.max(0, Math.min(container.width - width, centerX - width / 2));
  const top = Math.max(0, Math.min(container.height - height, centerY - height / 2));
  return { left, top, width, height };
}
