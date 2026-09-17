import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import type {
  NotificationEvent,
  NotificationPort,
  NotificationSeverity,
} from '../port/notification.port';
import { createLogThrottle } from '../utils/log-throttle';

/**
 * Discord webhook 전송 타임아웃.
 *
 * ⚠️ 알림은 **부가 기능**이다. 오래 매달리면 fire-and-forget 이라도 소켓과 메모리를 붙든다.
 * 다른 외부 호출(채팅·TTS 30초)보다 짧게 잡는다 — 알림이 5초 안에 안 가면 그 알림은 이미 늦었다.
 */
const DISCORD_TIMEOUT_MS = 5_000;

/** 중복 억제 기본 유지 시간. 같은 사건이 반복돼도 이 동안은 한 번만 알린다. */
const DEFAULT_DEDUPE_TTL_SECONDS = 600;

/** Embed 왼쪽 띠 색. 채널에서 훑을 때 등급이 색으로 먼저 읽힌다. */
const SEVERITY_COLOR: Record<NotificationSeverity, number> = {
  critical: 0xe53935,
  warning: 0xfb8c00,
  info: 0x1e88e5,
};

const SEVERITY_MARK: Record<NotificationSeverity, string> = {
  critical: '🔴',
  warning: '🟠',
  info: '🔵',
};

/**
 * Discord webhook 알림 어댑터.
 *
 * ## 설계 요지
 * - **도메인을 막지 않는다.** 전송 실패는 전부 삼키고 로그만 남긴다.
 * - **레플리카 3개에서 한 번만 보낸다.** Redis `SET NX EX` 로 첫 레플리카만 통과시킨다.
 * - **Redis 가 죽으면 보낸다(fail-open).** 장애 알림이 Redis 장애 때문에 사라지는 것이 최악이다.
 *
 * 🚫 webhook URL 을 로그·에러 메시지·응답 어디에도 남기지 않는다 — URL 자체가 시크릿이다.
 */
@Injectable()
export class DiscordNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger(DiscordNotificationAdapter.name);
  /** 전송 실패 로그 억제 — 채널이 죽으면 실패가 사건 수만큼 쌓인다. */
  private readonly failureLog = createLogThrottle(60_000);

  constructor(
    private readonly webhookUrl: string,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  notify(event: NotificationEvent): void {
    // 🚫 호출측에 Promise 를 돌려주지 않는다. 알림 지연이 도메인 API 지연이 되면 안 된다.
    void this.deliver(event).catch((error: unknown) => {
      this.logFailure(error);
    });
  }

  private async deliver(event: NotificationEvent): Promise<void> {
    if (!(await this.shouldSend(event))) return;

    let response: Response;
    try {
      response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Discord 는 `embeds` 가 **빈 배열이면 400** 이다. 우리는 항상 1개를 담는다.
        body: JSON.stringify({ embeds: [this.buildEmbed(event)] }),
        signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
      });
    } catch (error: unknown) {
      const isTimeout = error instanceof Error && error.name === 'TimeoutError';
      throw new Error(isTimeout ? `전송 타임아웃 ${DISCORD_TIMEOUT_MS}ms` : '전송 연결 실패');
    }

    if (!response.ok) {
      // 🚫 응답 본문을 읽어 메시지에 담지 않는다 — 외부 API 응답 본문 로깅 금지(루트 CLAUDE.md).
      //    상태코드만으로 충분히 진단된다(401/404 = URL 문제, 429 = 한도, 5xx = Discord 장애).
      throw new Error(`Discord 응답 ${response.status}`);
    }
  }

  /**
   * 이 사건을 지금 보내도 되는가.
   *
   * `dedupeKey` 가 없으면 항상 보낸다 — 호출측이 중복을 감수하겠다고 밝힌 것이다.
   */
  private async shouldSend(event: NotificationEvent): Promise<boolean> {
    if (!event.dedupeKey) return true;

    const ttl = event.dedupeTtlSeconds ?? DEFAULT_DEDUPE_TTL_SECONDS;
    try {
      // `NX` 라 먼저 도착한 레플리카 하나만 'OK' 를 받는다.
      const acquired = await this.redis.set(
        `notify:dedupe:${event.dedupeKey}`,
        '1',
        'EX',
        ttl,
        'NX',
      );
      return acquired === 'OK';
    } catch {
      // ⭐ **fail-open.** Redis 가 죽었다고 장애 알림까지 막으면 그때가 가장 알림이 필요한 순간이다.
      //    중복 3건이 유실 1건보다 낫다.
      return true;
    }
  }

  private buildEmbed(event: NotificationEvent) {
    const fields = Object.entries(event.context ?? {}).map(([name, value]) => ({
      name,
      value: String(value),
      inline: true,
    }));

    return {
      title: `${SEVERITY_MARK[event.severity]} ${event.title}`,
      description: event.summary,
      color: SEVERITY_COLOR[event.severity],
      timestamp: new Date().toISOString(),
      ...(fields.length > 0 ? { fields } : {}),
    };
  }

  private logFailure(error: unknown): void {
    const { log, suppressed } = this.failureLog.consume(Date.now());
    if (!log) return;
    const omitted = suppressed > 0 ? ` (직전 1분간 ${suppressed}건 생략)` : '';
    const message = error instanceof Error ? error.message : String(error);
    // 🚫 webhook URL 을 남기지 않는다.
    this.logger.warn(`Discord 알림 전송 실패${omitted}: ${message}`);
  }
}
