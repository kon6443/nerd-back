import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ApiErrorBodyDto } from '../dto/api-error.dto';

/**
 * 공통 에러 응답을 Swagger 에 붙인다.
 *
 * 엔드포인트마다 같은 스키마를 반복 선언하지 않기 위한 것이다.
 * 도메인 고유 에러는 각 모듈의 `*.error.dto.ts` 에 정의한 뒤 별도로 명시한다.
 */
function commonError(status: HttpStatus, description: string, code: string) {
  return applyDecorators(
    ApiResponse({
      status,
      description: `${description} (code: \`${code}\`)`,
      type: ApiErrorBodyDto,
    }),
  );
}

export const ApiCommonValidationResponse = () =>
  commonError(HttpStatus.BAD_REQUEST, '요청 값 검증 실패', 'VALIDATION_FAILED');

export const ApiCommonUnauthorizedResponse = () =>
  commonError(HttpStatus.UNAUTHORIZED, '인증이 필요하다', 'UNAUTHORIZED');

export const ApiCommonForbiddenResponse = () =>
  commonError(HttpStatus.FORBIDDEN, '권한이 없다', 'FORBIDDEN');

export const ApiCommonThrottledResponse = () =>
  commonError(HttpStatus.TOO_MANY_REQUESTS, '레이트리밋 초과', 'TOO_MANY_REQUESTS');

export const ApiCommonInternalServerErrorResponse = () =>
  commonError(HttpStatus.INTERNAL_SERVER_ERROR, '서버 내부 오류', 'INTERNAL_SERVER_ERROR');
