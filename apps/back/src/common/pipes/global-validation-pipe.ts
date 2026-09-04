import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { ZodSchemaDeclarationException, createZodValidationPipe } from 'nestjs-zod';
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
const ZodPipe = createZodValidationPipe({
  strictSchemaDeclaration: true,
  createValidationException: (error: unknown) =>
    new ApiValidationErrorResponseDto(undefined, toValidationDetails(error)),
});

/** 스키마 미선언을 알아볼 수 있게 만드는 래퍼. ↓ `GlobalValidationPipe` 주석 참조. */
function describeParam(metadata: ArgumentMetadata): string {
  const kind = { body: '@Body', query: '@Query', param: '@Param', custom: '커스텀 데코레이터' }[
    metadata.type
  ];
  const arg = metadata.data ? `'${metadata.data}'` : '';
  const type = metadata.metatype?.name ?? '(타입 없음)';
  return `${kind}(${arg}) 파라미터 (선언 타입: ${type})`;
}

/**
 * 검증 DTO 를 선언하지 않은 파라미터. **개발자 실수**이지 사용자 입력 문제가 아니다.
 *
 * 🚫 **`HttpException` 을 상속하지 않는다.** 전역 필터의 3단은 `HttpException` 의 `message` 를
 * **응답 바디에 그대로 싣는다** — 상속하면 이 개발자용 메시지(내부 구조·파일 경로)가 클라이언트로
 * 나간다. 일반 `Error` 로 두면 4단이 받아 고정 메시지만 내보내고, 스택은 `error` 레벨로 남는다.
 * 즉 **사용자에게는 아무것도, 로그에는 전부** 가 된다.
 */
class SchemaDeclarationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaDeclarationError';
  }
}

/**
 * nestjs-zod 파이프를 감싸 **스키마 미선언 사고를 읽을 수 있게** 만든다.
 *
 * `strictSchemaDeclaration` 이 던지는 `ZodSchemaDeclarationException` 은 **메시지가 없고**
 * `InternalServerErrorException` 이라 필터 3단을 타서 `Internal Server Error` 만 남는다.
 * 원인이 "검증 DTO 를 안 썼다" 라는 것이 로그 어디에도 보이지 않는다.
 *
 * 그래서 사유를 담은 `SchemaDeclarationError` 로 바꿔 던진다 — 응답은 그대로 일반 500 이고
 * 로그에만 원인이 남는다.
 */
class GlobalValidationPipe implements PipeTransform {
  private readonly inner = new ZodPipe();

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    try {
      return this.inner.transform(value, metadata);
    } catch (error) {
      if (error instanceof ZodSchemaDeclarationException) {
        throw new SchemaDeclarationError(
          `검증 스키마가 선언되지 않았다 — ${describeParam(metadata)}. ` +
            `스키마를 @nerd/contracts 에 두고 createZodDto 로 감싼 DTO 를 파라미터 타입으로 쓴다 ` +
            `(back-code-patterns.md §4).`,
        );
      }
      throw error;
    }
  }
}

export function createGlobalValidationPipe(): PipeTransform {
  return new GlobalValidationPipe();
}
