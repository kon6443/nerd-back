import { ValidationError, ValidationPipe } from '@nestjs/common';
import { ApiValidationErrorResponseDto } from '../dto/common-error.dto';

/** 중첩 DTO 까지 내려가 `필드: 메시지` 형태로 평탄화한다. */
function flatten(errors: ValidationError[], parent = ''): string[] {
  return errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) => `${path}: ${message}`);
    const children = error.children?.length ? flatten(error.children, path) : [];
    return [...own, ...children];
  });
}

/**
 * 전역 ValidationPipe.
 *
 * ⚠️ **프로덕션(APP_PIPE)과 E2E 가 이 함수 하나를 공유한다.**
 * 한쪽에서만 설정을 바꾸면 E2E 가 프로덕션과 다른 규칙으로 검증하게 되므로
 * 검증 규칙을 바꿀 때는 이 파일만 고친다.
 *
 * - `forbidNonWhitelisted` 로 DTO 에 없는 필드가 오면 에러를 낸다. 조용히 무시하지 않는다.
 * - `enableImplicitConversion` 이 켜져 있어 쿼리·파라미터 숫자 변환에
 *   `@Type(() => Number)` 가 필요 없다.
 */
export function createGlobalValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    exceptionFactory: (errors: ValidationError[]) =>
      new ApiValidationErrorResponseDto(undefined, flatten(errors)),
  });
}
