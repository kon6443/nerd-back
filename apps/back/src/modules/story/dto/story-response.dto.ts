import { ApiProperty } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '@common/dto/api-response.dto';
import type { StoryCharacterHitbox } from '@entities/story-page-character.entity';

/**
 * ⚠️ 이 파일의 클래스는 **Swagger 명세용 타입 선언 전용**이다. `new` 로 만들어 반환하지 않는다.
 * 컨트롤러는 `{ code, data, message }` 객체 리터럴을 그대로 반환하고, 서비스는 이 형태를
 * **타입으로만** 참조한다 (code-patterns §2).
 */

export class StorySummaryDto {
  @ApiProperty({ example: 'little-red-riding-hood' })
  slug: string;

  @ApiProperty({ example: '빨간 모자' })
  title: string;

  @ApiProperty({ nullable: true, description: '한 줄 소개' })
  summary: string | null;

  @ApiProperty({
    nullable: true,
    description: '대표 이미지의 오브젝트 키. URL 이 아니다 — 변환은 클라이언트에 노출되는 시점에 한다.',
  })
  coverImageKey: string | null;
}

export class StoryCharacterSummaryDto {
  @ApiProperty({ example: 'wolf', description: '배역 키. 대화 API 의 경로가 이 값을 쓴다.' })
  role: string;

  @ApiProperty({ example: '늑대' })
  displayName: string;
}

export class StoryDetailDto extends StorySummaryDto {
  @ApiProperty({ example: 12, description: '본편 페이지 수' })
  pageCount: number;

  @ApiProperty({ type: [StoryCharacterSummaryDto], description: '등장인물. persona 는 내보내지 않는다.' })
  characters: StoryCharacterSummaryDto[];
}

export class StoryPageCharacterDto extends StoryCharacterSummaryDto {
  @ApiProperty({
    nullable: true,
    description: '터치 영역. 0~1 로 정규화된 비율이다 (픽셀이 아니다).',
    example: { x: 0.4, y: 0.55, width: 0.2, height: 0.3 },
  })
  hitbox: StoryCharacterHitbox | null;
}

export class StoryPageDto {
  @ApiProperty({ example: 1 })
  pageNo: number;

  @ApiProperty({ description: '본문' })
  bodyText: string;

  @ApiProperty({ nullable: true, description: '개인화 전 기본 삽화의 오브젝트 키' })
  baseImageKey: string | null;

  @ApiProperty({
    nullable: true,
    description: '이 페이지에서 사용자 얼굴로 개인화할 배역. null 이면 개인화 대상이 아니다.',
    example: 'protagonist',
  })
  personaTargetRole: string | null;

  @ApiProperty({ type: [StoryPageCharacterDto], description: '대화 가능한 등장인물' })
  characters: StoryPageCharacterDto[];
}

export class StoryListResponseDto extends ApiSuccessResponseDto {
  @ApiProperty({ type: [StorySummaryDto] })
  data: StorySummaryDto[];
}

export class StoryDetailResponseDto extends ApiSuccessResponseDto {
  @ApiProperty({ type: StoryDetailDto })
  data: StoryDetailDto;
}

export class StoryPageResponseDto extends ApiSuccessResponseDto {
  @ApiProperty({ type: StoryPageDto })
  data: StoryPageDto;
}
