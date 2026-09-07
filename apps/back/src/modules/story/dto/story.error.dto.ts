import { HttpStatus } from '@nestjs/common';
import { defineDomainError } from '@common/dto/define-domain-error';

/**
 * 동화를 찾을 수 없다.
 *
 * ⚠️ **미공개(`draft`) 동화도 이 에러로 답한다.** "존재하지만 공개 전"과 "없음"을 구분해
 * 알려주면 slug 를 바꿔가며 미공개 콘텐츠의 존재를 확인할 수 있다.
 */
export const StoryNotFoundErrorResponseDto = defineDomainError({
  code: 'STORY_NOT_FOUND',
  status: HttpStatus.NOT_FOUND,
  message: '동화를 찾을 수 없습니다.',
  name: 'StoryNotFoundErrorResponseDto',
});

/** 동화는 있지만 해당 번호의 페이지가 없다. */
export const StoryPageNotFoundErrorResponseDto = defineDomainError({
  code: 'STORY_PAGE_NOT_FOUND',
  status: HttpStatus.NOT_FOUND,
  message: '해당 페이지를 찾을 수 없습니다.',
  name: 'StoryPageNotFoundErrorResponseDto',
});
