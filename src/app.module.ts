import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Redis } from 'ioredis';
import { THROTTLE_LONG, THROTTLE_SHORT } from '@common/constants/throttle.constants';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { CustomThrottlerGuard } from '@common/guards/custom-throttler.guard';
import { LoggerModule } from '@common/logger/logger.module';
import { createGlobalValidationPipe } from '@common/pipes/global-validation-pipe';
import { REDIS_CLIENT, RedisModule } from '@common/redis/redis.module';
import { validateEnv } from '@config/env.validation';
import { HealthModule } from '@modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // 누락·형식 오류면 기동에 실패한다. 런타임에 undefined 로 새지 않게 한다.
      validate: validateEnv,
    }),
    LoggerModule,
    RedisModule,

    // 레플리카가 3개이므로 스토리지가 Redis 여야 한다.
    // 메모리 스토리지를 쓰면 레플리카별로 따로 세어 실효 한도가 3배가 된다.
    ThrottlerModule.forRootAsync({
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => ({
        throttlers: [THROTTLE_SHORT, THROTTLE_LONG],
        storage: new ThrottlerStorageRedisService(redis),
      }),
    }),

    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: CustomThrottlerGuard },
    // 프로덕션과 E2E 가 같은 함수를 쓴다 (createGlobalValidationPipe 주석 참조).
    { provide: APP_PIPE, useFactory: createGlobalValidationPipe },
  ],
})
export class AppModule {}
