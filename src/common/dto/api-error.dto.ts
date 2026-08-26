import { HttpException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 도메인 에러의 베이스. `defineDomainError` 가 이 클래스를 상속해 만든다.
 *
 * HttpException 을 상속하므로 그냥 throw 하면 되고, 전역 HttpExceptionFilter 가
 * `{ code, message, timestamp }` 로 형식을 통일한다.
 */
export class ApiErrorResponseDto extends HttpException {
  readonly code: string;
  readonly details?: unknown;

  constructor(args: { code: string; status: number; message: string; details?: unknown }) {
    super(args.message, args.status);
    this.code = args.code;
    this.details = args.details;
  }
}

/**
 * 에러 응답 본문의 Swagger 스키마.
 *
 * ⚠️ 응답 바디에 `statusCode` 필드는 **없다.** HTTP 상태와 `code` 로 분기한다.
 */
export class ApiErrorBodyDto {
  @ApiProperty({ example: 'RESOURCE_NOT_FOUND', description: '기계가 분기하는 에러 코드' })
  code: string;

  @ApiProperty({ example: '요청한 리소스를 찾을 수 없습니다.', description: '사용자에게 보여줄 메시지' })
  message: string;

  @ApiProperty({ example: '2026-08-26T10:00:00.000Z', description: 'ISO 8601' })
  timestamp: string;

  @ApiProperty({
    required: false,
    description: '검증 실패 항목 등 부가 정보. 있을 때만 포함된다.',
  })
  details?: unknown;
}
