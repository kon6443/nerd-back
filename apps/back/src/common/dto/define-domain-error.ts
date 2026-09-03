import { ApiErrorResponseDto } from './api-error.dto';

interface DomainErrorConfig {
  /** 기계가 분기하는 코드. UPPER_SNAKE. */
  code: string;
  status: number;
  /** 기본 메시지. 생성 시 인자로 덮어쓸 수 있다. */
  message: string;
  /** 클래스 이름. 스택트레이스와 Swagger 스키마 이름에 쓰인다. */
  name: string;
}

export type DomainErrorClass = new (message?: string, details?: unknown) => ApiErrorResponseDto;

/**
 * 도메인 에러 클래스를 만든다.
 *
 * ```ts
 * export const SessionNotFoundErrorResponseDto = defineDomainError({
 *   code: 'SESSION_NOT_FOUND',
 *   status: 404,
 *   message: '세션을 찾을 수 없습니다.',
 *   name: 'SessionNotFoundErrorResponseDto',
 * });
 *
 * throw new SessionNotFoundErrorResponseDto();                  // 기본 메시지
 * throw new SessionNotFoundErrorResponseDto('만료된 세션입니다.'); // 메시지 override
 * ```
 *
 * 에러를 이 팩토리로만 정의하면 code 가 한 곳에 모여 프론트와의 계약이 흔들리지 않는다.
 */
export function defineDomainError(config: DomainErrorConfig): DomainErrorClass {
  const DomainError = class extends ApiErrorResponseDto {
    constructor(message?: string, details?: unknown) {
      super({
        code: config.code,
        status: config.status,
        message: message ?? config.message,
        details,
      });
    }
  };

  // 스택트레이스에 익명 클래스로 찍히지 않게 이름을 박는다.
  Object.defineProperty(DomainError, 'name', { value: config.name });

  return DomainError;
}
