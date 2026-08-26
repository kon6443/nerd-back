import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiErrorResponseDto } from '../dto/api-error.dto';

interface ErrorBody {
  code: string;
  message: string;
  timestamp: string;
  details?: unknown;
}

/** 필터가 정규화한 응답, 또는 원본을 그대로 통과시킬 응답. */
type Resolved =
  | { status: number; body: ErrorBody; passthrough?: false }
  | { status: number; body: unknown; passthrough: true; label: string };

/**
 * HttpStatus 숫자를 UPPER_SNAKE 코드 문자열로 바꾼다. (429 → TOO_MANY_REQUESTS)
 *
 * HttpStatus 는 숫자 enum 이라 역방향 매핑까지 들어 있으므로 값이 number 인 항목만 본다.
 */
function statusToCode(status: number): string {
  const match = Object.entries(HttpStatus).find(
    ([, value]) => typeof value === 'number' && value === status,
  );
  return match ? match[0] : 'HTTP_ERROR';
}

/**
 * 헬스체크 결과 페이로드인지 판별한다.
 *
 * Terminus 는 검사 실패를 `ServiceUnavailableException` 으로 던지는데, 그 응답 본문이
 * **어느 의존이 왜 죽었는지를 담은 진단 결과 그 자체**다. 우리 에러 봉투로 덮으면
 * 그 정보가 사라져 readiness 엔드포인트가 쓸모없어진다.
 *
 * 판별을 좁게 유지하기 위해 `status` 와 `details` 를 모두 가진 객체만 통과시킨다.
 */
function isHealthCheckPayload(payload: unknown): payload is Record<string, unknown> {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'status' in payload &&
    'details' in payload
  );
}

/**
 * 모든 예외를 `{ code, message, timestamp }` 로 통일한다. `details` 는 있을 때만 포함된다.
 *
 * 4단으로 분기한다:
 *   1. ApiErrorResponseDto  → DTO 가 들고 있는 code·message·details
 *   2. 헬스체크 페이로드     → 원본 그대로 통과 (진단 정보를 보존한다)
 *   3. 일반 HttpException   → 상태코드를 코드 문자열로 매핑
 *   4. 그 외               → INTERNAL_SERVER_ERROR + 고정 메시지 (원본을 노출하지 않는다)
 *
 * ⚠️ 응답 바디에 `statusCode` 필드를 넣지 않는다. HTTP 상태와 `code` 로 분기한다.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const resolved = this.resolve(exception);
    const where = `${request.method} ${request.originalUrl ?? request.url}`;

    if (resolved.passthrough) {
      this.logger.warn(`${where} → ${resolved.status} ${resolved.label}`);
      response.status(resolved.status).json(resolved.body);
      return;
    }

    // 500 이상은 원인 추적이 필요하므로 스택을 남긴다. 그 외는 경고로 충분하다.
    if (resolved.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${where} → ${resolved.status} ${resolved.body.code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `${where} → ${resolved.status} ${resolved.body.code}: ${resolved.body.message}`,
      );
    }

    response.status(resolved.status).json(resolved.body);
  }

  private resolve(exception: unknown): Resolved {
    const timestamp = new Date().toISOString();

    // 1단 — 도메인 에러
    if (exception instanceof ApiErrorResponseDto) {
      const body: ErrorBody = {
        code: exception.code,
        message: exception.message,
        timestamp,
      };
      if (exception.details !== undefined) body.details = exception.details;
      return { status: exception.getStatus(), body };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      // 2단 — 헬스체크 진단 결과는 형식을 바꾸지 않는다.
      if (isHealthCheckPayload(payload)) {
        return { status, body: payload, passthrough: true, label: 'HEALTH_CHECK_FAILED' };
      }

      // 3단 — 일반 HttpException
      return {
        status,
        body: { code: statusToCode(status), message: exception.message, timestamp },
      };
    }

    // 4단 — 예상 못 한 예외. 내부 정보를 응답에 흘리지 않는다.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: 'INTERNAL_SERVER_ERROR',
        message: '요청을 처리하는 중 오류가 발생했습니다.',
        timestamp,
      },
    };
  }
}
