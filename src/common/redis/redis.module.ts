import {
  Global,
  Inject,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

/**
 * 공유 Redis 클라이언트.
 *
 * 설계 원칙: **Redis 가 죽어도 앱은 기동하고 HTTP 는 계속 응답한다.**
 * 심사 기간 무중단이 요구사항이므로 부가 기능의 장애가 전체를 내리게 두지 않는다.
 *
 * - `lazyConnect` — 생성 시점에 연결하지 않는다. 연결 실패가 부팅을 막지 않는다.
 * - `enableOfflineQueue: false` — 끊긴 동안 명령을 무한 대기 큐에 쌓지 않고 즉시 실패시킨다.
 *   쌓아두면 복구 시점에 오래된 명령이 한꺼번에 터지고, 그 사이 요청은 타임아웃까지 매달린다.
 * - `maxRetriesPerRequest: 2` — 빠르게 포기하고 호출자가 폴백하게 한다.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const logger = new Logger('RedisClient');
        const password = config.get<string>('REDIS_PASSWORD');

        const client = new Redis({
          host: config.get<string>('REDIS_HOST'),
          port: config.get<number>('REDIS_PORT'),
          ...(password ? { password } : {}),
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 2,
        });

        // 에러 핸들러를 붙이지 않으면 ioredis 의 error 이벤트가 unhandled 로 프로세스를 죽인다.
        client.on('error', (error: Error) => {
          logger.warn(`Redis 오류 — 부가 기능만 축소된다: ${error.message}`);
        });
        client.on('ready', () => logger.log('Redis 연결됨'));

        // 연결 실패가 부팅을 막지 않도록 프로미스를 여기서 흡수한다.
        client.connect().catch((error: Error) => {
          logger.warn(`Redis 초기 연결 실패 — 축소 모드로 계속한다: ${error.message}`);
        });

        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnApplicationShutdown {
  private readonly logger = new Logger(RedisModule.name);

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  /**
   * 롤링 업데이트로 컨테이너가 교체될 때 커넥션을 정리한다.
   * 정리에 실패해도 종료를 막지 않는다 — 종료가 지연되면 배포가 멈춘다.
   */
  async onApplicationShutdown(): Promise<void> {
    try {
      await this.client.quit();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Redis 종료 처리 생략: ${message}`);
    }
  }
}
