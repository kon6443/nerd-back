import { loginSchema, signupSchema } from '@nerd/contracts';
import { createZodDto } from 'nestjs-zod';

/**
 * 요청 DTO. 스키마는 **`@nerd/contracts` 가 소유한다** — 프론트 폼이 같은 스키마를 쓰므로
 * "프론트는 통과했는데 백엔드가 400" 이 생기지 않는다.
 */
export class SignupRequestDto extends createZodDto(signupSchema) {}

export class LoginRequestDto extends createZodDto(loginSchema) {}
