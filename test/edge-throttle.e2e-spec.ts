import { Controller, Get, Logger } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TerminusModule } from '@nestjs/terminus';
import { Test } from '@nestjs/testing';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
import type { Server } from 'node:http';
import request from 'supertest';
import { API_PREFIX, HEALTH_PATH, TRUST_PROXY_HOPS } from '@common/constants/app.constants';
import { THROTTLE_LONG, THROTTLE_SHORT } from '@common/constants/throttle.constants';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { CustomThrottlerGuard } from '@common/guards/custom-throttler.guard';
import { createEdgeThrottle } from '@common/middleware/edge-throttle.middleware';
import { REDIS_CLIENT } from '@common/redis/redis.module';
import { HealthController } from '@modules/health/health.controller';

interface StorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

/** 키별로 실제 누적한다. 백스톱이 한도를 넘겼는지 판정하려면 카운트가 살아 있어야 한다. */
class AccumulatingStorage implements ThrottlerStorage {
  readonly hits = new Map<string, number>();

  increment(
    key: string,
    ttl: number,
    _limit: number,
    _blockDuration: number,
    _throttlerName: string,
  ): Promise<StorageRecord> {
    const next = (this.hits.get(key) ?? 0) + 1;
    this.hits.set(key, next);
    return Promise.resolve({
      totalHits: next,
      timeToExpire: ttl,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  }

  /** 엣지 백스톱이 만든 키의 누적 합. 가드(short·long)가 만든 키는 제외한다. */
  edgeHits(): number {
    let sum = 0;
    for (const [key, value] of this.hits) if (key.startsWith('edge-')) sum += value;
    return sum;
  }
}

/** 스토리지가 항상 실패하는 상황 — fail-open 을 검증한다. */
class FailingStorage implements ThrottlerStorage {
  increment(): Promise<StorageRecord> {
    return Promise.reject(new Error('스토리지 다운'));
  }
}

@Controller('control')
class ControlController {
  @Get()
  ping(): { code: string } {
    return { code: 'SUCCESS' };
  }
}

const EDGE_LIMIT = 3;

async function createApp(storage: ThrottlerStorage): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      TerminusModule,
      ThrottlerModule.forRoot({ throttlers: [THROTTLE_SHORT, THROTTLE_LONG], storage }),
    ],
    controllers: [HealthController, ControlController],
    providers: [
      { provide: REDIS_CLIENT, useValue: { ping: () => Promise.resolve('PONG') } },
      { provide: APP_GUARD, useClass: CustomThrottlerGuard },
    ],
  })
    .overrideProvider(ThrottlerStorage)
    .useValue(storage)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  // 프로덕션과 같은 trust proxy — req.ip 계산이 달라지면 키 검증이 무의미해진다.
  app.set('trust proxy', TRUST_PROXY_HOPS);
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalFilters(new HttpExceptionFilter());

  // 프로덕션(main.ts)과 **같은 팩토리**를 쓴다. 한쪽만 배선하면 E2E 가 다른 규칙을 검증한다.
  // Swagger 보다 먼저 등록해야 문서 경로가 덮인다 — main.ts 와 같은 순서다.
  app.use(createEdgeThrottle({ storage, limit: EDGE_LIMIT }));

  SwaggerModule.setup(
    `${API_PREFIX}/docs`,
    app,
    SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('e2e').build()),
  );

  await app.init();
  return app;
}

describe('엣지 백스톱 레이트리밋 (E2E)', () => {
  describe('정상 스토리지', () => {
    let app: NestExpressApplication;
    let storage: AccumulatingStorage;

    beforeEach(async () => {
      storage = new AccumulatingStorage();
      app = await createApp(storage);
    });

    afterEach(async () => {
      await app.close();
    });

    it('404 경로가 한도를 넘기면 429 를 준다 ⭐', async () => {
      const server = app.getHttpServer() as Server;
      const path = `/${API_PREFIX}/no-such-route`;

      for (let i = 0; i < EDGE_LIMIT; i += 1) {
        await request(server).get(path).expect(404);
      }

      const blocked = await request(server).get(path).expect(429);
      expect(blocked.body).toMatchObject({ code: 'TOO_MANY_REQUESTS' });
      expect(blocked.body).toHaveProperty('timestamp');
      // 전역 필터와 같은 형태여야 한다 — 바디에 statusCode 를 넣지 않는다.
      expect(blocked.body).not.toHaveProperty('statusCode');
    });

    it('Swagger 문서 경로가 한도를 넘기면 429 를 준다 ⭐', async () => {
      const server = app.getHttpServer() as Server;
      const path = `/${API_PREFIX}/docs-json`;

      for (let i = 0; i < EDGE_LIMIT; i += 1) {
        await request(server).get(path).expect(200);
      }

      await request(server).get(path).expect(429);
    });

    it('헬스체크는 백스톱을 전혀 타지 않는다 ⭐', async () => {
      // 여기에 걸리면 Swarm 이 unhealthy 로 판정해 재시작 루프에 빠지고 배포가 롤백된다.
      const server = app.getHttpServer() as Server;

      for (let i = 0; i < EDGE_LIMIT + 5; i += 1) {
        await request(server).get(HEALTH_PATH).expect(200);
      }

      expect(storage.edgeHits()).toBe(0);
    });

    it('위조된 X-Forwarded-For 로 한도를 우회할 수 없다 ⭐', async () => {
      // 프로덕션 형태를 그대로 모사한다: Caddy 는 XFF 를 **append** 하므로 앱에는
      // `<클라이언트가 보낸 값>, <실제 IP>` 가 도착한다. trust proxy=1 이면 req.ip 는
      // 오른쪽(실제 IP)을 집는다.
      //
      // 첫 값을 매 요청 바꿔도 **같은 통**에 세어져야 한다. 만약 XFF 첫 값으로 키를
      // 만들면 요청마다 새 통이 되어 이 테스트가 통과하지 못한다.
      const server = app.getHttpServer() as Server;
      const path = `/${API_PREFIX}/no-such-route`;
      const REAL_IP = '203.0.113.9';

      for (let i = 0; i < EDGE_LIMIT; i += 1) {
        await request(server)
          .get(path)
          .set('X-Forwarded-For', `10.0.0.${i}, ${REAL_IP}`)
          .expect(404);
      }

      await request(server)
        .get(path)
        .set('X-Forwarded-For', `10.0.0.99, ${REAL_IP}`)
        .expect(429);

      // 통이 하나만 만들어졌음을 키로 확인한다 (위조 값이 키에 섞이지 않았다).
      const edgeKeys = [...storage.hits.keys()].filter((k) => k.startsWith('edge-'));
      expect(edgeKeys).toEqual([`edge-${REAL_IP}`]);
    });

    it('차단은 반드시 로그로 남는다 ⭐', async () => {
      // 실측(2026-08-28): app.use 미들웨어는 pino-http(모듈 미들웨어)보다 먼저 실행되므로
      // 여기서 응답을 끝내면 액세스 로그에 아무것도 남지 않는다. 이 로그가 유일한 신호다.
      // restoreMocks: true 이므로 복원은 jest 가 한다.
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const server = app.getHttpServer() as Server;
      const path = `/${API_PREFIX}/no-such-route`;

      for (let i = 0; i < EDGE_LIMIT + 1; i += 1) {
        await request(server).get(path);
      }

      const messages = warn.mock.calls.map((call) => String(call[0]));
      expect(messages.some((m) => m.includes('엣지 백스톱 차단'))).toBe(true);
      // 경로는 남기고 IP 는 남기지 않는다 (개인정보를 앱 로그에 늘리지 않는다).
      expect(messages.some((m) => m.includes(path))).toBe(true);
    });

    it('가드가 커버하는 경로에도 백스톱이 함께 적용된다 (예산은 분리)', async () => {
      await request(app.getHttpServer() as Server)
        .get(`/${API_PREFIX}/control`)
        .expect(200);

      // 백스톱 1회 + 가드 2회(short·long) — 키 접두사로 통이 분리돼 있다.
      expect(storage.edgeHits()).toBe(1);
      expect(storage.hits.size).toBeGreaterThan(1);
    });
  });

  describe('스토리지 장애', () => {
    let app: NestExpressApplication;

    beforeEach(async () => {
      app = await createApp(new FailingStorage());
    });

    afterEach(async () => {
      await app.close();
    });

    it('스토리지가 죽어도 요청을 막지 않는다 (fail-open) ⭐', async () => {
      // 레이트리밋이라는 부가 기능이 서비스 전체를 내리게 하지 않는다.
      const server = app.getHttpServer() as Server;

      for (let i = 0; i < EDGE_LIMIT + 2; i += 1) {
        await request(server)
          .get(`/${API_PREFIX}/control`)
          .expect(200);
      }
    });
  });
});
