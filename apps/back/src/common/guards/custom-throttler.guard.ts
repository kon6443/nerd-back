import { ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiErrorResponseDto } from '../dto/api-error.dto';
import { ApiThrottledErrorResponseDto } from '../dto/common-error.dto';
import { resolveClientIp } from '../utils/client-ip';

/**
 * 전역 레이트리밋 가드.
 *
 * 표준 ThrottlerGuard 에서 두 가지를 바꾼다.
 *
 * 1. **429 를 우리 에러 형식으로 던진다.** 전역 필터가 `{ code, message, timestamp }` 로
 *    통일하므로 클라이언트가 보는 형태가 다른 에러와 같아진다.
 *
 * 2. **스토리지 장애 시 fail-open 한다.** Redis 가 끊겼을 때 모든 요청을 500 으로
 *    떨어뜨리면 레이트리밋이라는 부가 기능이 서비스 전체를 내리게 된다. 제한 없이
 *    통과시키는 쪽이 낫다.
 *
 *    ⚠️ 이 판단은 **레이트리밋에만** 적용한다. 비용이 걸린 카운터(외부 API 예산 등)는
 *    반대로 fail-closed 여야 한다 — 셀 수 없으면 쓰지 않는다.
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(CustomThrottlerGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await super.canActivate(context);
    } catch (error) {
      // 정상적인 한도 초과(429)는 그대로 올려보낸다.
      if (error instanceof ApiErrorResponseDto) throw error;

      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`레이트리밋 스토리지 장애 — fail-open 으로 통과시킨다: ${message}`);
      return true;
    }
  }

  protected async throwThrottlingException(): Promise<void> {
    return Promise.reject(new ApiThrottledErrorResponseDto());
  }

  /**
   * 식별자. 해석 규칙과 그 근거는 `resolveClientIp` 가 소유한다.
   *
   * 지금은 상위 클래스의 기본 구현(`return req.ip`)과 **같은 값**을 반환한다. 그래도 이 우회를
   * 남겨 두는 이유는 두 가지다.
   *   1. 엣지 백스톱 미들웨어가 같은 함수를 쓴다 — 각자 구현하면 같은 요청이 두 한도에서
   *      다른 키로 세어진다.
   *   2. 인증 도입 시 `user-{id}` 로 바꿀 지점이 한 곳으로 모인다.
   *
   * 🚫 여기서 `X-Forwarded-For` 를 직접 파싱하지 않는다 — 스푸핑된다 (`resolveClientIp` 주석).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 상위 클래스 시그니처가 Record<string, any> 다
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return Promise.resolve(resolveClientIp(req));
  }
}
