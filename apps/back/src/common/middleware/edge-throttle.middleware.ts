import { HttpStatus, Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { NextFunction, Request, Response } from 'express';
import { HEALTH_PATH, READY_PATH } from '../constants/app.constants';
import { THROTTLE_EDGE } from '../constants/throttle.constants';
import { ApiThrottledErrorResponseDto } from '../dto/common-error.dto';
import { resolveClientIp } from '../utils/client-ip';
import { nowUtc, toIsoUtc } from '../utils/date.utils';
import { createLogThrottle } from '../utils/log-throttle';

/**
 * 헬스체크는 백스톱에서 제외한다.
 *
 * ⚠️ **여기에 헬스체크가 걸리면 Swarm 이 컨테이너를 unhealthy 로 판정해 재시작 루프에 빠지고,
 *    배포가 롤백된다.** 10~30초 간격 폴링이 IP 하나로 몰리므로 실제로 걸릴 수 있다.
 *    `startsWith` 가 아니라 정확히 일치하는 두 경로만 뺀다 — `/health-something` 같은
 *    엉뚱한 경로까지 무제한으로 열리지 않게 하기 위해서다.
 */
const SKIPPED_PATHS: ReadonlySet<string> = new Set([HEALTH_PATH, READY_PATH]);

export interface EdgeThrottleOptions {
  /** `ThrottlerModule` 이 제공하는 스토리지. 레플리카 3개이므로 Redis 여야 한다. */
  storage: ThrottlerStorage;
  /** 기본값 `THROTTLE_EDGE.limit`. 테스트에서 낮춰 잡는다. */
  limit?: number;
  /** 기본값 `THROTTLE_EDGE.ttl` (ms). */
  ttlMs?: number;
}

/**
 * 엣지 백스톱 레이트리밋 미들웨어 팩토리.
 *
 * Nest 가드가 닿지 않는 경로(↑ `THROTTLE_EDGE`)까지 덮는다. 가드를 대체하지 않고
 * **더 느슨한 별도 예산**으로 겹친다 — 예산이 다르므로 이중 계상이 실효 한도를 깎지 않는다.
 *
 * 🚫 이 파일은 **프로덕션(`main.ts`)과 E2E 가 같은 팩토리를 호출해야 한다.**
 *    한쪽만 배선하면 E2E 가 프로덕션과 다른 규칙으로 검증하게 되어 통과가 아무것도 보증하지 않는다.
 *
 * 스토리지 장애 시 **fail-open** 한다. 레이트리밋이라는 부가 기능이 서비스 전체를 내리게 하지
 * 않는다 (`CustomThrottlerGuard` 와 같은 판단). 비용이 걸린 카운터는 반대로 fail-closed 다.
 */
export function createEdgeThrottle(
  options: EdgeThrottleOptions,
): (req: Request, res: Response, next: NextFunction) => void {
  const limit = options.limit ?? THROTTLE_EDGE.limit;
  const ttlMs = options.ttlMs ?? THROTTLE_EDGE.ttl;

  const logger = new Logger('EdgeThrottle');
  // 스토리지가 계속 죽어 있으면 요청마다 로그가 쌓인다. 첫 발생만 남기고 이후는 억제한다.
  const failOpenLog = createLogThrottle(60_000);
  /**
   * 차단 로그.
   *
   * ⚠️ **이 로그가 없으면 차단이 완전히 보이지 않는다.** 실측(2026-08-28): express 미들웨어는
   *    `app.use()` 로 등록되어 **모듈 미들웨어(pino-http)보다 먼저** 실행되므로, 여기서 응답을
   *    끝내면 액세스 로그에 아무것도 남지 않는다. 한도를 잘못 잡아 정상 사용자가 429 를 받아도
   *    알 수 없게 되므로, 차단은 반드시 여기서 직접 남긴다.
   *
   * IP 는 남기지 않는다 — 필요한 신호는 "어디가 얼마나 막히는가" 이고, 누구인지는 프록시
   * 액세스 로그가 이미 갖고 있다. 앱 로그에 개인정보를 늘리지 않는다.
   */
  const blockLog = createLogThrottle(60_000);

  return function edgeThrottle(req: Request, res: Response, next: NextFunction): void {
    if (SKIPPED_PATHS.has(req.path)) {
      next();
      return;
    }

    // 가드와 반드시 같은 키 체계를 쓴다. 접두사는 가드의 throttler(short·long)와 통을 분리한다.
    const key = `${THROTTLE_EDGE.name}-${resolveClientIp(req)}`;

    options.storage
      .increment(key, ttlMs, limit, 0, THROTTLE_EDGE.name)
      .then((record) => {
        if (record.totalHits > limit) {
          const blocked = blockLog.consume(nowUtc().getTime());
          if (blocked.log) {
            const suffix = blocked.suppressed > 0 ? ` (억제 ${blocked.suppressed}건)` : '';
            logger.warn(
              `엣지 백스톱 차단 — ${req.method} ${req.path} · 한도 ${limit}/${ttlMs / 1000}s${suffix}`,
            );
          }

          // 전역 예외 필터는 Nest 파이프라인 안에서만 동작한다. 이 미들웨어는 그 밖이므로
          // 같은 형태 `{ code, message, timestamp }` 를 직접 만든다.
          const error = new ApiThrottledErrorResponseDto();
          res.status(HttpStatus.TOO_MANY_REQUESTS).json({
            code: error.code,
            message: error.message,
            timestamp: toIsoUtc(nowUtc()),
          });
          return;
        }
        next();
      })
      .catch((error: unknown) => {
        const decision = failOpenLog.consume(nowUtc().getTime());
        if (decision.log) {
          const message = error instanceof Error ? error.message : String(error);
          const suffix = decision.suppressed > 0 ? ` (억제 ${decision.suppressed}건)` : '';
          logger.warn(`엣지 백스톱 스토리지 장애 — fail-open 으로 통과시킨다: ${message}${suffix}`);
        }
        next();
      });
  };
}
