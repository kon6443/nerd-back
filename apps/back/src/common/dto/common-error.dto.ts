import { HttpStatus } from '@nestjs/common';
import { defineDomainError } from './define-domain-error';

/** 전역 ValidationPipe 가 던진다. details 에 실패 항목이 담긴다. */
export const ApiValidationErrorResponseDto = defineDomainError({
  code: 'VALIDATION_FAILED',
  status: HttpStatus.BAD_REQUEST,
  message: '요청 값이 올바르지 않습니다.',
  name: 'ApiValidationErrorResponseDto',
});

/** 레이트리밋 초과. */
export const ApiThrottledErrorResponseDto = defineDomainError({
  code: 'TOO_MANY_REQUESTS',
  status: HttpStatus.TOO_MANY_REQUESTS,
  message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  name: 'ApiThrottledErrorResponseDto',
});
