import { defineDomainError } from '../../../common/dto/define-domain-error';

export const StoryAlreadyCompletedErrorResponseDto = defineDomainError({
  code: 'STORY_ALREADY_COMPLETED',
  status: 409,
  message: '이미 제작이 완료된 동화입니다. (1인 1권 제한)',
  name: 'StoryAlreadyCompletedErrorResponseDto',
});

export const SessionNotFoundErrorResponseDto = defineDomainError({
  code: 'SESSION_NOT_FOUND',
  status: 404,
  message: '동화 제작 세션을 찾을 수 없습니다.',
  name: 'SessionNotFoundErrorResponseDto',
});

export const InvalidImageFormatErrorResponseDto = defineDomainError({
  code: 'INVALID_IMAGE_FORMAT',
  status: 400,
  message: '지원하지 않는 이미지 형식이거나 손상된 파일입니다. (JPEG, PNG, WEBP 지원)',
  name: 'InvalidImageFormatErrorResponseDto',
});

export const ImageTooLargeErrorResponseDto = defineDomainError({
  code: 'IMAGE_TOO_LARGE',
  status: 400,
  message: '이미지 파일 크기는 5MB 이하여야 합니다.',
  name: 'ImageTooLargeErrorResponseDto',
});

export const FaceRequiredErrorResponseDto = defineDomainError({
  code: 'FACE_REQUIRED',
  status: 400,
  message: '정면 얼굴 사진은 필수입니다.',
  name: 'FaceRequiredErrorResponseDto',
});
