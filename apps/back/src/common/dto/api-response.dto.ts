import { ApiProperty } from '@nestjs/swagger';
import { SUCCESS_CODE } from '../constants/app.constants';

/**
 * 성공 응답의 Swagger 스키마 베이스.
 *
 * ⚠️ **명세용 타입 선언 전용이다.** `new` 로 만들어 반환하지 않는다.
 * 컨트롤러는 객체 리터럴을 그대로 반환한다:
 *
 * ```ts
 * return { code: SUCCESS_CODE, data: result, message: '' };
 * ```
 *
 * 상속 DTO 가 `data` 를 정의한다.
 */
export class ApiSuccessResponseDto {
  @ApiProperty({ example: SUCCESS_CODE })
  code: string;

  @ApiProperty({ example: '', description: '사용자에게 보여줄 메시지. 보통 빈 문자열.' })
  message: string;
}
