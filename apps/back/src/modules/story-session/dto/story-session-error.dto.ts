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

export const FaceNotReadyErrorResponseDto = defineDomainError({
  code: 'FACE_NOT_READY',
  status: 400,
  message: '얼굴 사진을 먼저 등록해 주세요.',
  name: 'FaceNotReadyErrorResponseDto',
});

export const PageNotFoundErrorResponseDto = defineDomainError({
  code: 'PAGE_NOT_FOUND',
  status: 404,
  message: '요청한 페이지를 찾을 수 없습니다.',
  name: 'PageNotFoundErrorResponseDto',
});

export const PageNotFailedErrorResponseDto = defineDomainError({
  code: 'PAGE_NOT_FAILED',
  status: 400,
  message: '실패한 페이지만 재시도할 수 있습니다.',
  name: 'PageNotFailedErrorResponseDto',
});

export const FirstBranchAlreadyChosenErrorResponseDto = defineDomainError({
  code: 'FIRST_BRANCH_ALREADY_CHOSEN',
  status: 409,
  message: '첫 비하인드 선택은 변경할 수 없습니다.',
  name: 'FirstBranchAlreadyChosenErrorResponseDto',
});
