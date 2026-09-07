import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@entities/user.entity';

/** `AuthGuard` 가 `request.user` 에 넣어 둔 값. 가드 없이는 비어 있다. */
export interface AuthenticatedRequest extends Request {
  user?: User;
}

/**
 * 인증된 사용자를 핸들러 인자로 받는다.
 *
 * ⚠️ **`AuthGuard` 가 붙은 라우트에서만 쓴다.** 가드 없이 쓰면 `undefined` 가 온다 —
 * 그래서 반환 타입을 `User` 로 단언하지 않고, 가드가 보장한다는 사실을 주석으로 남긴다.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User | undefined =>
    ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
