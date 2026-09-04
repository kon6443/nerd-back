import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedRequest } from '@common/decorators/current-user.decorator';
import { User } from '@entities/user.entity';
import { SESSION_COOKIE, SessionService } from '@modules/auth/session.service';
import { UnauthorizedErrorResponseDto } from '@modules/auth/dto/auth.error.dto';

/**
 * 세션 쿠키로 사용자를 식별한다.
 *
 * ⚠️ 라우트마다 붙인다 — **전역 가드로 만들지 않는다.** 전역으로 두면 공개 라우트마다
 * 예외를 달게 되고, 예외를 깜빡한 라우트는 조용히 막히는 게 아니라 조용히 **열린다**
 * (예외 목록이 곧 공개 목록이 되므로 실수의 방향이 위험한 쪽이다).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sid: unknown = request.cookies?.[SESSION_COOKIE];

    if (typeof sid !== 'string' || sid.length === 0) {
      throw new UnauthorizedErrorResponseDto();
    }

    const userId = await this.sessions.resolveUserId(sid);
    if (userId === null) {
      throw new UnauthorizedErrorResponseDto();
    }

    // 세션은 살아 있는데 사용자가 지워졌을 수 있다. 그 경우도 인증 실패로 본다.
    const user = await this.users.findOneBy({ id: userId });
    if (!user) {
      throw new UnauthorizedErrorResponseDto();
    }

    request.user = user;
    return true;
  }
}
