/**
 * API 응답 봉투 — 프론트와 백엔드가 공유하는 **계약**이다.
 *
 * 🚫 이 파일의 형태를 한쪽에서만 바꾸지 않는다. 여기가 SSOT 이고,
 * 백엔드 전역 필터와 프론트 fetch 래퍼가 둘 다 이것을 따른다.
 */

/** 성공 응답의 `code` 값. 컨트롤러가 객체 리터럴로 직접 반환한다. */
export const SUCCESS_CODE = 'SUCCESS';

export interface ApiSuccess<T> {
  code: typeof SUCCESS_CODE;
  data: T;
  /** 사용자에게 보여줄 메시지. 보통 빈 문자열. */
  message: string;
}

/**
 * 우리가 `defineDomainError` 로 **직접 정의한** 에러 코드.
 *
 * 프론트가 `switch` 로 분기할 때 오타를 컴파일러가 잡게 하는 것이 목적이다.
 * 코드를 추가하면 여기에도 넣는다 — 안 넣으면 프론트가 그 분기를 알 수 없다.
 */
export const DOMAIN_ERROR_CODES = [
  'VALIDATION_FAILED',
  'TOO_MANY_REQUESTS',
  'INTERNAL_SERVER_ERROR',
  'STORY_NOT_FOUND',
  'STORY_PAGE_NOT_FOUND',
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

/**
 * 실제로 도착할 수 있는 에러 코드.
 *
 * ⚠️ **닫힌 집합이 아니다.** 전역 필터의 3단 분기가 도메인 에러가 아닌 `HttpException` 을
 * **HttpStatus enum 이름**(`NOT_FOUND` `BAD_GATEWAY` …)으로 매핑하므로, 우리가 정의하지 않은
 * 코드도 도착할 수 있다. `(string & {})` 는 자동완성을 유지하면서 그 사실을 타입에 남긴다.
 *
 * 🚫 그래서 프론트의 `switch` 에는 **반드시 default 분기**가 있어야 한다.
 */
export type ErrorCode = DomainErrorCode | (string & {});

/**
 * 에러 응답 본문.
 *
 * ⚠️ **`statusCode` 필드는 없다.** HTTP 상태와 `code` 로 분기한다.
 */
export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  /** ISO 8601 UTC (`Z` suffix). 오프셋을 붙이지 않는다. */
  timestamp: string;
  /** 검증 실패 항목 등 부가 정보. 있을 때만 포함된다. */
  details?: unknown;
}

/** 검증 실패 시 `details` 에 담기는 형태 — `필드: 메시지` 문자열 배열. */
export type ValidationDetails = string[];

export function isDomainErrorCode(code: string): code is DomainErrorCode {
  return (DOMAIN_ERROR_CODES as readonly string[]).includes(code);
}
