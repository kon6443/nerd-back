import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { Redis } from 'ioredis';
import { DiscordNotificationAdapter } from '../adapters/discord-notification.adapter';
import { NoopNotificationAdapter } from '../adapters/noop-notification.adapter';
import { NOTIFICATION_PORT } from '../port/notification.port';
import { BootstrapNotifier } from './bootstrap-notifier.service';
import { ProcessErrorNotifier } from './process-error-notifier.service';
import { ServerErrorRateMonitor } from './server-error-rate-monitor.service';
import { REDIS_CLIENT } from '../redis/redis.module';

/**
 * 운영 알림 채널 선택을 한 곳에서 소유한다 (`StorageModule` 과 같은 구조).
 *
 * ⭐ **URL 이 없으면 no-op 이다.** 로컬·테스트에서 아무 일도 일어나지 않아야 하고,
 * 운영에서 알림을 끄고 싶으면 **env 를 비우는 것만으로** 코드 변경 없이 꺼진다(롤백 경로).
 */
@Module({
  imports: [ConfigModule],
  providers: [
    NoopNotificationAdapter,
    BootstrapNotifier,
    ProcessErrorNotifier,
    ServerErrorRateMonitor,
    {
      provide: NOTIFICATION_PORT,
      useFactory: (config: ConfigService, redis: Redis, noop: NoopNotificationAdapter) => {
        const logger = new Logger('NotificationModule');
        const webhookUrl = config.get<string>('DISCORD_WEBHOOK_URL');

        // ⭐ 어느 쪽이 선택됐는지 부팅 로그에 남긴다. 없으면 "알림이 안 온다" 를 만났을 때
        //    채널 문제인지 설정 문제인지 가릴 수단이 없다.
        //    🚫 URL 은 남기지 않는다 — 그 자체가 시크릿이다. 설정 **여부**만 알린다.
        if (!webhookUrl) {
          logger.log('운영 알림 채널: 미설정 (DISCORD_WEBHOOK_URL 없음 — 알림이 전송되지 않는다)');
          return noop;
        }

        logger.log('운영 알림 채널: Discord webhook 사용');
        return new DiscordNotificationAdapter(webhookUrl, redis);
      },
      inject: [ConfigService, REDIS_CLIENT, NoopNotificationAdapter],
    },
  ],
  exports: [NOTIFICATION_PORT, ServerErrorRateMonitor],
})
export class NotificationModule {}
