import { createSessionSchema, sessionIdParamsSchema } from '@nerd/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateSessionRequestDto extends createZodDto(createSessionSchema) {}
export class SessionIdParamsDto extends createZodDto(sessionIdParamsSchema) {}
