import type { PipeTransform } from '@nestjs/common';
import { createZodValidationPipe } from 'nestjs-zod';
import { ApiValidationErrorResponseDto } from '../dto/common-error.dto';

/** zod 오류 항목의 최소 형태. ↓ `toValidationDetails` 주석 참조 — 타입을 직접 좁힌다. */
interface ZodLikeIssue {
  path: PropertyKey[];
  message: string;
}

function isZodLikeIssue(value: unknown): value is ZodLikeIssue {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { path?: unknown }).path) &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

/**
 * 검증 오류를 `필드: 메시지` 배열로 평탄화한다.
 *
 * ⚠️ **`instanceof ZodError` 를 쓰지 않는다.** 워크스페이스가 앱별 `node_modules` 를 쓰므로
 * (`sharedWorkspaceLockfile: false`) **스키마를 만든 zod 와 여기서 import 할 zod 가 다른
 * 인스턴스일 수 있다.** 그러면 `instanceof` 가 조용히 `false` 가 되어 `details` 가 빈 배열이 되고,
 * 검증은 도는데 실패 사유만 사라지는 가장 찾기 어려운 형태로 나타난다. 구조로 판별한다.
 */
export function toValidationDetails(error: unknown): string[] {
  const issues = (error as { issues?: unknown } | null | undefined)?.issues;
  if (!Array.isArray(issues)) return [];

  return issues.filter(isZodLikeIssue).map((issue) => {
    const path = issue.path.map(String).join('.');
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}

/**
 * 전역 검증 파이프 — **스키마는 `@nerd/contracts` 가 소유한다.**
 *
 * ⚠️ **프로덕션(`APP_PIPE`)과 E2E 가 이 함수 하나를 공유한다.** 한쪽에서만 설정을 바꾸면
 * E2E 가 프로덕션과 다른 규칙으로 검증하게 되므로 **이 파일만 고친다.** (class-validator 시절과 같은 규칙이다.)
 *
 * - 실패는 `VALIDATION_FAILED` · 400 이고 `details` 에 `필드: 메시지` 배열이 담긴다.
 *   🚫 **이 형식을 바꾸지 않는다** — 프론트와의 계약이고, 바뀌면 이미 붙은 화면이 조용히 깨진다.
 * - `strictSchemaDeclaration` 을 켠다. nestjs-zod DTO 가 아닌 값을 검증하려 하면 **에러로 막는다** —
 *   "검증한다고 생각했는데 안 하고 있었다" 를 도구가 잡게 하려는 것이다. `forbidNonWhitelisted` 와 같은 취지다.
 * - 정의에 없는 필드는 스키마의 `.strict()` 가 막는다. 조용히 무시하지 않는다.
 * - 🚫 암묵 형변환에 기대지 않는다. 경로·쿼리의 숫자는 스키마에서 **명시적으로** 변환한다(`z.coerce`).
 */
const GlobalZodValidationPipe = createZodValidationPipe({
  strictSchemaDeclaration: true,
  createValidationException: (error: unknown) =>
    new ApiValidationErrorResponseDto(undefined, toValidationDetails(error)),
});

export function createGlobalValidationPipe(): PipeTransform {
  return new GlobalZodValidationPipe();
}
