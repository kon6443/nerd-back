import {
  ImageTooLargeErrorResponseDto,
  InvalidImageFormatErrorResponseDto,
} from '../../modules/story-session/dto/story-session-error.dto';

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export type SupportedImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

/**
 * 매직바이트를 통해 실제 이미지 형식을 검증한다.
 * ⚠️ 확장자나 Content-Type 헤더는 클라이언트에서 위조되므로 반드시 버퍼의 첫 바이트를 검사한다.
 */
export function validateImageBuffer(buffer: Buffer): SupportedImageMimeType {
  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new ImageTooLargeErrorResponseDto('이미지 크기는 5MB 이하여야 합니다.');
  }

  if (buffer.length < 12) {
    throw new InvalidImageFormatErrorResponseDto('유효하지 않은 이미지 파일입니다.');
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WEBP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  throw new InvalidImageFormatErrorResponseDto(
    '지원하지 않는 이미지 형식이거나 손상된 파일입니다 (JPEG, PNG, WEBP 만 지원).',
  );
}
