import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { NOTIFICATION_PORT, type NotificationPort } from '../port/notification.port';

/** 집계 창. 이 길이 안의 5xx 건수를 센다. */
const WINDOW_MS = 5 * 60 * 1000;

/**
 * 이 건수에 도달하면 한 번 알린다.
 *
 * ⚠️ **절대 건수**로 센다. 에러율(%)은 트래픽이 적을 때 요동친다 — 요청 2건 중 1건이 실패하면
 * 50% 지만 사람이 할 일은 없다. 이 서비스 규모에서는 "5분에 10건" 이 더 정확한 신호다.
 */
const THRESHOLD = 10;

/**
 * 5xx 급증 감지.
 *
 * ## 설계 요지
 * - **응답 경로를 막지 않는다.** 호출측은 `void` 로 부르고, 여기서 모든 실패를 삼킨다.
 *   에러 응답을 돌려주는 길목이라 여기서 지연되면 장애가 두 배로 보인다.
 * - **카운터는 Redis 다.** 레플리카 3개가 각자 세면 실효 임계치가 3배가 된다
 *   (레이트리밋과 같은 이유 — `back-code-patterns.md` §6).
 * - **임계치에 "도달한 순간" 한 번만 알린다**(`=== THRESHOLD`). 넘은 뒤로는 조용하다가
 *   다음 창에서 다시 도달하면 또 알린다. 창 자체가 중복 억제 역할을 한다.
 *
 * 🚫 경로별로 나누지 않는다 — URL 에 세션 ID 가 들어가 고카디널리티가 된다
 *    (루트 `CLAUDE.md` Never). "어디가 터졌는지" 는 로그에서 찾는다.
 */
@Injectable()
export class ServerErrorRateMonitor {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(NOTIFICATION_PORT) private readonly notifications: NotificationPort,
  ) {}

  /**
   * 5xx 한 건을 기록하고, 두 가지를 판단한다 — **처음 났는가 / 많이 나는가**.
   *
   * 두 신호는 서로 보완한다. 급증은 "지금 서비스가 나쁘다" 를, 첫 발생은 "새 버그가 생겼다" 를
   * 말한다. 배포 직후에는 후자가 먼저 울린다.
   *
   * 🚫 던지지 않는다. 호출측(전역 예외 필터)은 이미 에러를 처리하는 중이라,
   *    여기서 던지면 **에러 처리 중의 에러**가 되어 원래 응답까지 망가진다.
   *
   * @param route 라우트 **패턴**(`POST /sessions/:id/pages`). 🚫 실제 URL 을 넘기지 않는다 —
   *              세션 ID 가 들어가 고카디널리티가 되고 개인 식별에도 쓰인다.
   */
  async record(route?: string): Promise<void> {
    await this.recordFirstOccurrence(route);
    await this.recordSpike();
  }

  /**
   * 이 라우트에서 처음 난 5xx 인가.
   *
   * 억제를 길게(6시간) 잡는다 — 같은 버그가 하루 종일 울리면 그것도 노이즈다.
   * "새로 생겼다" 만 알리면 충분하고, 계속 나는 것은 급증 감지가 맡는다.
   */
  private async recordFirstOccurrence(route?: string): Promise<void> {
    if (!route) return;

    this.notifications.notify({
      severity: 'critical',
      title: '새 서버 오류',
      summary: '이 경로에서 500 이 발생했습니다. 로그에서 스택을 확인하세요.',
      context: { 경로: route },
      dedupeKey: `server-error-first:${route}`,
      dedupeTtlSeconds: 6 * 3600,
    });
  }

  private async recordSpike(): Promise<void> {
    try {
      // 고정 창 — 창 번호를 키에 넣어 만료를 Redis 에 맡긴다.
      // 슬라이딩 창(ZSET)은 더 정확하지만 알림 용도에는 과하다.
      const windowKey = Math.floor(Date.now() / WINDOW_MS);
      const key = `alert:5xx:${windowKey}`;

      const count = await this.redis.incr(key);
      if (count === 1) {
        // 창 하나가 지나면 저절로 사라진다. 여유를 조금 둬 경계에서 잘리지 않게 한다.
        await this.redis.expire(key, Math.ceil((WINDOW_MS * 2) / 1000));
      }

      // `>=` 가 아니라 `===` 다 — 넘어선 뒤 들어오는 건건마다 알리면 채널이 덮인다.
      if (count === THRESHOLD) {
        this.notifications.notify({
          severity: 'critical',
          title: '서버 오류 급증',
          summary:
            '5xx 응답이 임계치를 넘었습니다. 로그에서 어느 경로·원인인지 확인하세요.',
          context: { 건수: count, 집계창: `${WINDOW_MS / 60_000}분` },
          // 창 번호를 키에 넣어 **창마다 한 번**만 나가게 한다.
          dedupeKey: `server-error-spike:${windowKey}`,
          dedupeTtlSeconds: Math.ceil(WINDOW_MS / 1000),
        });
      }
    } catch {
      // Redis 가 죽었다면 그 자체가 5xx 의 원인일 수 있다. 여기서 더 할 수 있는 일이 없고,
      // Redis 장애는 자체 로그(`RedisClient`)가 이미 알린다.
    }
  }
}
