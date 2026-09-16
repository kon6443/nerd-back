import { describe, expect, it } from "vitest";
import { ApiError } from "./client";
import { errorMessage, errorRecovery, validationDetails } from "./errorPresentation";

function apiError(status: number, code: string, message = "서버 문구", details?: unknown) {
  return new ApiError(status, code, message, details);
}

describe("에러를 화면이 할 수 있는 일로 번역하기", () => {
  describe("errorRecovery", () => {
    it("얼굴이 준비되지 않았으면 얼굴 등록으로 보낸다 ⭐", () => {
      expect(errorRecovery(apiError(400, "FACE_NOT_READY"))).toBe("register-face");
      expect(errorRecovery(apiError(400, "FACE_REQUIRED"))).toBe("register-face");
    });

    it("인증이 필요하면 로그인으로 보낸다", () => {
      expect(errorRecovery(apiError(401, "UNAUTHORIZED"))).toBe("sign-in");
      // 도메인 코드가 아니어도 401 이면 같은 결론이다.
      expect(errorRecovery(apiError(401, "SOMETHING_ELSE"))).toBe("sign-in");
    });

    // 같은 401 이지만 결론이 다르다 — 이미 로그인 화면에 있는 사람에게
    // "로그인하러 가기" 를 권하면 제자리를 가리킨다.
    it("로그인 실패는 401 이어도 로그인으로 보내지 않는다 ⭐", () => {
      expect(errorRecovery(apiError(401, "INVALID_CREDENTIALS"))).toBe("none");
    });

    it("혼잡·일시 장애는 재시도를 권한다", () => {
      expect(errorRecovery(apiError(429, "TOO_MANY_REQUESTS"))).toBe("retry");
      expect(errorRecovery(apiError(500, "INTERNAL_SERVER_ERROR"))).toBe("retry");
      expect(errorRecovery(apiError(503, "STORY_CHAT_UNAVAILABLE"))).toBe("retry");
    });

    // ⭐ 같은 요청을 다시 보내도 같은 답이 오는 것에 「다시 시도하기」를 띄우면,
    //    사용자는 눌러 보고 또 실패하는 경험만 얻는다.
    it("다시 보내도 결과가 같은 실패에는 재시도를 권하지 않는다 ⭐", () => {
      expect(errorRecovery(apiError(404, "SESSION_NOT_FOUND"))).toBe("none");
      expect(errorRecovery(apiError(409, "STORY_ALREADY_COMPLETED"))).toBe("none");
      expect(errorRecovery(apiError(400, "PAGE_NOT_FAILED"))).toBe("none");
      expect(errorRecovery(apiError(400, "IMAGE_TOO_LARGE"))).toBe("none");
    });

    it("정의하지 않은 코드의 5xx 도 일시적으로 본다", () => {
      // `ErrorCode` 는 닫힌 집합이 아니다 — 전역 필터가 HttpStatus 이름을 그대로 낸다.
      expect(errorRecovery(apiError(502, "BAD_GATEWAY"))).toBe("retry");
      expect(errorRecovery(apiError(400, "BAD_REQUEST"))).toBe("none");
    });

    it("ApiError 가 아닌 실패(네트워크 등)는 재시도로 본다", () => {
      expect(errorRecovery(new TypeError("Failed to fetch"))).toBe("retry");
    });
  });

  describe("errorMessage", () => {
    it("429 는 사용자가 이해할 문구로 바꾼다", () => {
      expect(errorMessage(apiError(429, "TOO_MANY_REQUESTS", "Too Many Requests"), "기본")).toBe(
        "요청이 몰리고 있어요. 잠시 후 다시 시도해 주세요.",
      );
    });

    it("그 외에는 백엔드 문구를 그대로 쓴다 — 두 벌로 만들지 않는다", () => {
      expect(errorMessage(apiError(404, "SESSION_NOT_FOUND", "세션을 찾을 수 없습니다."), "기본")).toBe(
        "세션을 찾을 수 없습니다.",
      );
    });

    it("ApiError 가 아니면 호출부가 준 기본 문구를 쓴다", () => {
      expect(errorMessage(new Error("network"), "잠시 후 다시 시도해 주세요.")).toBe(
        "잠시 후 다시 시도해 주세요.",
      );
    });
  });

  describe("validationDetails", () => {
    it("검증 실패의 필드별 사유를 꺼낸다", () => {
      const error = apiError(400, "VALIDATION_FAILED", "요청 값이 올바르지 않습니다.", [
        "loginId: 4자 이상이어야 합니다.",
      ]);
      expect(validationDetails(error)).toEqual(["loginId: 4자 이상이어야 합니다."]);
    });

    it("details 가 없거나 형태가 다르면 빈 배열이다", () => {
      expect(validationDetails(apiError(400, "VALIDATION_FAILED"))).toEqual([]);
      expect(validationDetails(apiError(400, "VALIDATION_FAILED", "m", { a: 1 }))).toEqual([]);
      expect(validationDetails(apiError(404, "SESSION_NOT_FOUND"))).toEqual([]);
    });
  });
});
