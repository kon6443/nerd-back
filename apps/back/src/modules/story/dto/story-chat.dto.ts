import { ApiProperty } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { storyChatInputSchema, storyChatParamsSchema, storyChatQuerySchema } from '@nerd/contracts';
import type { StoryChatExchange, StoryChatStatus, StoryChatView } from '@nerd/contracts';

export class StoryChatParamsDto extends createZodDto(storyChatParamsSchema) {}
export class StoryChatQueryDto extends createZodDto(storyChatQuerySchema) {}

export class StoryChatCharacterDto {
  @ApiProperty()
  role: string;
  @ApiProperty()
  displayName: string;
}

export class StoryChatInputDto extends createZodDto(storyChatInputSchema) {}

export class StoryChatExchangeDto implements StoryChatExchange {
  @ApiProperty()
  role: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty({ maxLength: 300 })
  message: string;

  @ApiProperty({ type: String, nullable: true })
  reply: string | null;
}

export class StoryChatViewDto implements StoryChatView {
  @ApiProperty({ type: [StoryChatCharacterDto] })
  characters: StoryChatCharacterDto[];

  @ApiProperty({ enum: ['available', 'pending', 'completed', 'failed', 'unavailable'] })
  status: StoryChatStatus;

  @ApiProperty({ enum: [0, 1], description: '보관된 동화의 해당 페이지 전체 남은 질문 횟수' })
  remainingMessages: 0 | 1;

  @ApiProperty({ type: StoryChatExchangeDto, nullable: true })
  exchange: StoryChatExchangeDto | null;
}
