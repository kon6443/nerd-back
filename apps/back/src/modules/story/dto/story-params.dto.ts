import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Matches, Min } from 'class-validator';

/**
 * slug 형식. 소문자·숫자·하이픈만 받는다.
 *
 * 형식을 좁히는 것 자체가 방어다 — 경로 조각이 그대로 조회 조건에 들어가므로, 여기서 걸러야
 * 이상한 입력이 서비스 계층까지 내려가지 않는다.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class StorySlugParamsDto {
  @ApiProperty({ example: 'little-red-riding-hood', description: '동화 식별자' })
  @Matches(SLUG_PATTERN, { message: 'slug 형식이 올바르지 않습니다.' })
  slug: string;
}

export class StoryPageParamsDto extends StorySlugParamsDto {
  /** 전역 ValidationPipe 의 `enableImplicitConversion` 이 문자열을 number 로 바꾼다. */
  @ApiProperty({ example: 1, description: '1부터 시작하는 본편 페이지 번호' })
  @IsInt({ message: 'pageNo 는 정수여야 합니다.' })
  @Min(1, { message: 'pageNo 는 1 이상이어야 합니다.' })
  pageNo: number;
}
