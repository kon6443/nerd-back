import {
  createSessionSchema,
  afterStoryRetryParamsSchema,
  sessionIdParamsSchema,
  sessionPageParamsSchema,
  selectAfterStoryChoiceSchema,
} from '@nerd/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateSessionRequestDto extends createZodDto(createSessionSchema) {}
export class SessionIdParamsDto extends createZodDto(sessionIdParamsSchema) {}
export class SessionPageParamsDto extends createZodDto(sessionPageParamsSchema) {}
export class AfterStoryRetryParamsDto extends createZodDto(afterStoryRetryParamsSchema) {}
export class SelectAfterStoryChoiceDto extends createZodDto(selectAfterStoryChoiceSchema) {}
