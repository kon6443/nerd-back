import { randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from '@common/redis/redis.module';

/**
 * 세션 저장소.
 *
 * 🚫 **인메모리로 두지 않는다.** 레플리카가 3개라 로그인한 레플리카에서만 인증이 되고
 * 나머지 둘에서는 로그아웃된 것처럼 보인다.
 *
 * JWT 를 쓰지 않는 이유: Redis 는 이미 있고, **무효화가 된다**(로그아웃·강제 만료).
 * 무상태성은 서버가 세션을 들고 있지 않다는 뜻이지 Redis 를 쓰면 안 된다는 뜻이 아니다.
 */
const SESSION_PREFIX = 'sess:';

/**
 * 세션 수명. 시연·체험용 서비스라 재로그인 부담을 줄이는 쪽으로 잡았다.
 * ⚠️ 늘리면 탈취된 세션의 유효 기간도 같이 늘어난다.
 */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

/** 쿠키 이름. 프론트가 직접 읽지 않는다(httpOnly) — 서버만 쓴다. */
export const SESSION_COOKIE = 'sid';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async create(userId: number): Promise<string> {
    const sid = randomBytes(32).toString('base64url');
    await this.redis.set(`${SESSION_PREFIX}${sid}`, String(userId), 'EX', SESSION_TTL_SECONDS);
    return sid;
  }

  /**
   * ⚠️ **fail-closed 다.** Redis 를 못 읽으면 인증을 통과시키지 않는다.
   *
   * 레이트리밋은 fail-open 이지만(못 세면 통과) 인증은 반대다 — 확인할 수 없으면 거절한다.
   * 🚫 이 방향을 뒤집지 말 것. Redis 장애가 곧 전면 인증 우회가 된다.
   */
  async resolveUserId(sid: string): Promise<number | null> {
    try {
      const raw = await this.redis.get(`${SESSION_PREFIX}${sid}`);
      if (raw === null) return null;

      const userId = Number(raw);
      return Number.isInteger(userId) ? userId : null;
    } catch (error) {
      // 🚫 세션 값·sid 를 로그에 남기지 않는다. 남기면 로그가 곧 세션 탈취 수단이 된다.
      this.logger.warn(`세션 조회 실패 — 인증을 거절한다: ${(error as Error).message}`);
      return null;
    }
  }

  /** 로그아웃. 이미 없어도 성공으로 본다 — 멱등이어야 재시도가 안전하다. */
  async destroy(sid: string): Promise<void> {
    try {
      await this.redis.del(`${SESSION_PREFIX}${sid}`);
    } catch (error) {
      // 지우지 못해도 TTL 이 결국 만료시킨다. 로그아웃 응답까지 실패시키지는 않는다.
      this.logger.warn(`세션 삭제 실패 — TTL 만료에 맡긴다: ${(error as Error).message}`);
    }
  }
}
