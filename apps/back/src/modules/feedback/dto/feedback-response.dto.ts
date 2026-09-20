import { ApiProperty } from '@nestjs/swagger';
import type { FeedbackCategory, FeedbackResult } from '@nerd/contracts';

export class FeedbackResponseDto implements FeedbackResult {
  @ApiProperty({ example: 1, description: '피드백 고유 ID' })
  id: number;

  @ApiProperty({ example: 'bug', description: '피드백 유형 (bug, feature, ux, other)' })
  category: FeedbackCategory;

  @ApiProperty({ example: '버튼 클릭이 안 돼요', description: '피드백 제목' })
  title: string;

  @ApiProperty({ example: '2026-09-20T06:00:00.000Z', description: '생성 시각' })
  createdAt: string;
}
