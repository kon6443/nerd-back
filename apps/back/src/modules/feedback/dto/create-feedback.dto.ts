import { createFeedbackSchema } from '@nerd/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateFeedbackDto extends createZodDto(createFeedbackSchema) {}
