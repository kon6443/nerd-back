import { storyPageParamsSchema, storySlugParamsSchema } from '@nerd/contracts';
import { createZodDto } from 'nestjs-zod';

/**
 * 경로 파라미터 DTO.
 *
 * 스키마는 **`@nerd/contracts` 가 소유한다** — 프론트의 폼·링크 생성이 같은 스키마를 쓰므로
 * "프론트는 통과했는데 백엔드가 400" 이 구조적으로 생기지 않는다.
 * 여기서는 그 스키마를 Nest 가 아는 형태로 감싸기만 한다. `createZodDto` 가 Swagger 스키마도 만든다.
 */
export class StorySlugParamsDto extends createZodDto(storySlugParamsSchema) {}

export class StoryPageParamsDto extends createZodDto(storyPageParamsSchema) {}
