import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { TerminusModule } from '@nestjs/terminus';
import { API_PREFIX, TRUST_PROXY_HOPS } from '@common/constants/app.constants';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { createGlobalValidationPipe } from '@common/pipes/global-validation-pipe';
import { REDIS_CLIENT } from '@common/redis/redis.module';
import { HealthController } from '@modules/health/health.controller';

/**
 * E2E 전용 앱 팩토리.
 *
 * 🚫 **`AppModule` 을 import 하지 않는다.** AppModule 을 그대로 쓰면 부팅만으로
 * 외부 시스템(Redis, 그리고 나중에 DB)에 실제로 붙는다. E2E 는 자기 완결적이어야 한다 —
 * CI 에서 외부 의존이 없어도 돌아가야 하고, 로컬에서 상용 자원을 건드리면 안 된다.
 *
 * 대신 전역 파이프·필터는 **프로덕션과 같은 것**을 붙인다. 그렇지 않으면 E2E 가
 * 프로덕션과 다른 규칙으로 검증하게 되어 통과가 아무것도 보증하지 않는다.
 */
export interface E2eAppOptions {
  /** Redis 스텁. 기본값은 정상 응답. */
  redisPing?: () => Promise<string>;
}

export async function createE2eApp(options: E2eAppOptions = {}): Promise<INestApplication> {
  const ping = options.redisPing ?? (() => Promise.resolve('PONG'));

  const moduleRef = await Test.createTestingModule({
    imports: [TerminusModule],
    controllers: [HealthController],
    providers: [{ provide: REDIS_CLIENT, useValue: { ping } }],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });

  // 프로덕션과 같은 상수를 쓴다 (근거는 TRUST_PROXY_HOPS 주석).
  app.set('trust proxy', TRUST_PROXY_HOPS);

  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(createGlobalValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();
  return app;
}
