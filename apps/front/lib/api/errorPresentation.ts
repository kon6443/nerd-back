import type { DomainErrorCode, ErrorCode, ValidationDetails } from "@nerd/contracts";
import { ApiError } from "./client";

/**
 * 에러 코드를 **화면이 할 수 있는 일**로 번역한다.
 *
 * 백엔드는 이미 한국어 메시지를 주므로 문구를 여기서 다시 쓰지 않는다. 여기서 정하는 것은
 * 문구가 답해 주지 못하는 것 — **다시 시도해도 되는가, 어디로 보내야 하는가** 다.
 * 그 둘을 화면마다 `status` 숫자로 재발명하면 규칙이 화면 수만큼 갈린다.
 *
 * ⚠️ `ErrorCode` 는 **닫힌 집합이 아니다** — 전역 필터가 도메인 에러가 아닌 `HttpException` 을
 * HttpStatus enum 이름으로 매핑하므로 우리가 정의하지 않은 코드도 도착한다
 * (`packages/contracts/src/envelope.ts`). 그래서 모든 분기에 기본값이 있다.
 */

/** 사용자가 스스로 할 수 있는 다음 행동. */
export type ErrorRecovery =
  /** 같은 요청을 다시 보내면 될 수 있다 (일시적 장애·혼잡). */
  | "retry"
  /** 얼굴 사진을 먼저 등록해야 한다. */
  | "register-face"
  /** 로그인이 필요하다. */
  | "sign-in"
  /** 사용자가 바꿀 수 있는 것이 없다 (이미 완료됨·없는 리소스 등). */
  | "none";

/**
 * 재시도가 의미 있는 도메인 코드.
 *
 * 🚫 400·404 계열을 넣지 않는다 — 같은 요청을 다시 보내도 같은 답이 온다.
 *    「다시 시도하기」를 띄우면 사용자가 눌러 보고 또 실패하는 경험만 준다.
 */
const RETRYABLE_CODES: ReadonlySet<DomainErrorCode> = new Set([
  "TOO_MANY_REQUESTS",
  "INTERNAL_SERVER_ERROR",
  "STORY_CHAT_UNAVAILABLE",
]);

export function errorRecovery(error: unknown): ErrorRecovery {
  if (!(error instanceof ApiError)) {
    // 네트워크 실패·JSON 파싱 실패 등. 원인이 일시적일 가능성이 높다.
    return "retry";
  }

  switch (error.code as DomainErrorCode) {
    case "FACE_NOT_READY":
    case "FACE_REQUIRED":
      return "register-face";
    case "UNAUTHORIZED":
      return "sign-in";
    // ⚠️ 401 이지만 `sign-in` 이 아니다 — 이미 로그인 화면에 있는 사람이 받는 답이라
    //    "로그인하러 가기" 는 제자리를 가리킨다. 아래 `isUnauthorized` 분기보다 먼저 가른다.
    case "INVALID_CREDENTIALS":
      return "none";
    default:
      break;
  }

  if (error.isUnauthorized) return "sign-in";
  if (isRetryableCode(error.code)) return "retry";
  // 5xx 는 도메인 코드가 아니어도 일시적이다 (전역 필터의 HttpStatus 이름 매핑 포함).
  if (error.status >= 500) return "retry";
  return "none";
}

function isRetryableCode(code: ErrorCode): boolean {
  return RETRYABLE_CODES.has(code as DomainErrorCode);
}

/**
 * 429 는 백엔드 메시지가 사용자에게 설명이 되지 않는 대표적인 경우다.
 * 그 외에는 백엔드 문구를 그대로 쓴다 — 우리가 다시 쓰면 두 벌이 되어 어긋난다.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  if (error.code === "TOO_MANY_REQUESTS") {
    return "요청이 몰리고 있어요. 잠시 후 다시 시도해 주세요.";
  }
  return error.message || fallback;
}

/**
 * 검증 실패의 필드별 사유. 백엔드가 `details` 로 주는데 쓰는 곳이 없어
 * 사용자는 늘 "요청 값이 올바르지 않습니다." 한 줄만 봤다.
 */
export function validationDetails(error: unknown): ValidationDetails {
  if (!(error instanceof ApiError) || !error.isValidationFailed) return [];
  if (!Array.isArray(error.details)) return [];
  return error.details.filter((item): item is string => typeof item === "string");
}
