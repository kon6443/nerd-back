import { HttpStatus } from '@nestjs/common';
import { defineDomainError } from '@common/dto/define-domain-error';

export const StoryCharacterNotFoundErrorResponseDto = defineDomainError({
  code: 'STORY_CHARACTER_NOT_FOUND',
  status: HttpStatus.NOT_FOUND,
  message: '이 페이지에서 대화할 수 없는 등장인물이에요.',
  name: 'StoryCharacterNotFoundErrorResponseDto',
});

export const StoryChatAlreadyUsedErrorResponseDto = defineDomainError({
  code: 'STORY_CHAT_ALREADY_USED',
  status: HttpStatus.CONFLICT,
  message: '이 페이지에서는 이미 한 번 질문했어요. 기존 대화를 확인해 주세요.',
  name: 'StoryChatAlreadyUsedErrorResponseDto',
});

export const StoryChatUnavailableErrorResponseDto = defineDomainError({
  code: 'STORY_CHAT_UNAVAILABLE',
  status: HttpStatus.SERVICE_UNAVAILABLE,
  message: '지금은 대화를 불러올 수 없어요. 잠시 후 이용 상태를 확인해 주세요.',
  name: 'StoryChatUnavailableErrorResponseDto',
});
