import { Controller, Get } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { TerminusModule } from '@nestjs/terminus';
import { DataSource } from 'typeorm';
import { Test } from '@nestjs/testing';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import type { Server } from 'node:http';
import request from 'supertest';
import { API_PREFIX, HEALTH_PATH, TRUST_PROXY_HOPS } from '@common/constants/app.constants';
import { THROTTLE_LONG, THROTTLE_SHORT } from '@common/constants/throttle.constants';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { CustomThrottlerGuard } from '@common/guards/custom-throttler.guard';
import { REDIS_CLIENT } from '@common/redis/redis.module';
import { HealthController } from '@modules/health/health.controller';

/**
 * 스토리지 접근 횟수를 세는 스텁. 이 카운터가 계측 지점이다.
 * "스로틀이 적용됐는가" 를 로그나 429 로 추측하지 않고 스토리지 호출 횟수로 확정한다.
 */
// ThrottlerStorageRecord 는 패키지 루트에서 export 되지 않는다.
// dist 내부 경로를 직접 import 하는 것은 깨지기 쉬우므로 같은 형태를 로컬에 선언한다
// (구조적 타이핑으로 ThrottlerStorage 를 만족한다).
interface StorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

class CountingStorage implements ThrottlerStorage {
  calls = 0;

  increment(
    _key: string,
    ttl: number,
    _limit: number,
    _blockDuration: number,
    _throttlerName: string,
  ): Promise<StorageRecord> {
    this.calls += 1;
    return Promise.resolve({
      totalHits: 1,
      timeToExpire: ttl,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  }
}

/** 대조군 — @SkipThrottle 이 없으므로 반드시 스토리지를 타야 한다. */
@Controller('control')
class ControlController {
  @Get()
  ping(): { code: string } {
    return { code: 'SUCCESS' };
  }
}

describe('레이트리밋 제외 (E2E)', () => {
  let app: NestExpressApplication;
  let storage: CountingStorage;

  beforeEach(async () => {
    storage = new CountingStorage();

    const moduleRef = await Test.createTestingModule({
      imports: [
        TerminusModule,
        ThrottlerModule.forRoot({
          throttlers: [THROTTLE_SHORT, THROTTLE_LONG],
          storage,
        }),
      ],
      controllers: [HealthController, ControlController],
      providers: [
        { provide: REDIS_CLIENT, useValue: { ping: () => Promise.resolve('PONG') } },
        // HealthController 가 readiness 용으로 DataSource 를 주입받는다. 실 DB 는 만들지 않는다.
        { provide: DataSource, useValue: { query: () => Promise.resolve([]) } },
        { provide: APP_GUARD, useClass: CustomThrottlerGuard },
      ],
    })
      .overrideProvider(ThrottlerStorage)
      .useValue(storage)
      .compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    // 프로덕션과 같은 trust proxy — req.ip 로 키를 만들므로 값이 다르면 다른 규칙을 검증한다.
    app.set('trust proxy', TRUST_PROXY_HOPS);
    app.setGlobalPrefix(API_PREFIX);
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('대조군: 제외되지 않은 경로는 throttler 를 탄다', async () => {
    await request(app.getHttpServer() as Server)
      .get(`/${API_PREFIX}/control`)
      .expect(200);

    // throttler 2개(short·long) 이므로 요청 1건당 스토리지 2회
    expect(storage.calls).toBe(2);
  });

  it('헬스체크는 throttler 를 전혀 타지 않는다 ⭐', async () => {
    // 인자 없는 @SkipThrottle() 을 쓰면 이 단정이 깨진다.
    // 기본값 { default: true } 는 우리 throttler 이름(short·long)과 매칭되지 않는다.
    for (let i = 0; i < 5; i += 1) {
      await request(app.getHttpServer() as Server)
        .get(HEALTH_PATH)
        .expect(200);
    }

    expect(storage.calls).toBe(0);
  });
});
