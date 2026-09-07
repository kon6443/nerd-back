import type { HttpStatus } from '@nestjs/common';
import { ApiErrorResponseDto } from '../dto/api-error.dto';

/**
 * 에러 경로는 **code 와 status 를 정확히 고정한다** (code-patterns §9).
 *
 * 느슨하게 받으면(`expect([401, 404]).toContain(status)`) 그 차이가 곧 방어의 유무일 때
 * 테스트가 조용히 무력해진다. 그리고 **정상 반환도 실패로 처리한다** — 던지지 않는 것은
 * 통과가 아니다.
 */
export async function expectDomainError(
  promise: Promise<unknown>,
  code: string,
  status: HttpStatus,
): Promise<void> {
  const error: unknown = await promise.then(
    () => {
      throw new Error(`${code} 가 발생해야 하는데 정상 반환됐다`);
    },
    (caught: unknown) => caught,
  );

  expect(error).toBeInstanceOf(ApiErrorResponseDto);
  const domainError = error as ApiErrorResponseDto;
  expect(domainError.code).toBe(code);
  expect(domainError.getStatus()).toBe(status);
}
