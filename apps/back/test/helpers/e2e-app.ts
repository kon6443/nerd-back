import type { INestApplication, ModuleMetadata } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { TerminusModule } from '@nestjs/terminus';
import { DataSource } from 'typeorm';
import { API_PREFIX, TRUST_PROXY_HOPS } from '@common/constants/app.constants';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import { createGlobalValidationPipe } from '@common/pipes/global-validation-pipe';
import { REDIS_CLIENT } from '@common/redis/redis.module';
import { HealthController } from '@modules/health/health.controller';

/**
 * E2E 전용 앱 팩토리.
 *
 * 🚫 **`AppModule` 을 import 하지 않는다.** AppModule 을 그대로 쓰면 부팅만으로
 * 외부 시스템(Redis·DB)에 실제로 붙는다. E2E 는 자기 완결적이어야 한다 —
 * CI 에서 외부 의존이 없어도 돌아가야 하고, 로컬에서 상용 자원을 건드리면 안 된다.
 *
 * 대신 전역 파이프·필터는 **프로덕션과 같은 것**을 붙인다. 그렇지 않으면 E2E 가
 * 프로덕션과 다른 규칙으로 검증하게 되어 통과가 아무것도 보증하지 않는다.
 */
/**
 * E2E 전용 서명 키. 🚫 실제 키를 쓰지 않는다 — 테스트가 env 에 의존하면 CI 에서만 깨진다.
 * 값 자체에 의미는 없고 **길이 조건(32자)만 맞추면 된다.**
 */
export const E2E_SESSION_SECRET = 'e2e-session-secret-0123456789abcdef';

export interface E2eAppOptions {
  /** Redis 스텁. 기본값은 정상 응답. */
  redisPing?: () => Promise<string>;
  /** DB 스텁 — `dataSource.query('SELECT 1')` 자리. 기본값은 정상 응답. */
  dbQuery?: () => Promise<unknown>;
  /**
   * 헬스체크 외에 추가로 마운트할 도메인 컨트롤러.
   *
   * ⚠️ 도메인 **모듈**을 import 하지 않는다. 모듈은 `TypeOrmModule.forFeature` 를 물고 있어
   * 실 DataSource 를 요구한다. 컨트롤러·서비스만 올리고 Repository 는 `providers` 로 스텁한다
   * (`getRepositoryToken(Entity)` 토큰).
   */
  controllers?: ModuleMetadata['controllers'];
  /** 위 컨트롤러가 의존하는 서비스와 Repository 스텁. */
  providers?: ModuleMetadata['providers'];
}

export async function createE2eApp(options: E2eAppOptions = {}): Promise<INestApplication> {
  const ping = options.redisPing ?? (() => Promise.resolve('PONG'));
  const query = options.dbQuery ?? (() => Promise.resolve([{ '1': 1 }]));

  const moduleRef = await Test.createTestingModule({
    imports: [TerminusModule],
    controllers: [HealthController, ...(options.controllers ?? [])],
    providers: [
      { provide: REDIS_CLIENT, useValue: { ping } },
      // @InjectDataSource() 의 기본 토큰은 DataSource 클래스다. 실 DataSource 는 만들지 않는다.
      { provide: DataSource, useValue: { query } },
      ...(options.providers ?? []),
    ],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });

  // 프로덕션과 같은 상수를 쓴다 (근거는 TRUST_PROXY_HOPS 주석).
  app.set('trust proxy', TRUST_PROXY_HOPS);

  // ⚠️ 프로덕션(`main.ts`)과 **같은 미들웨어**를 붙인다. 없으면 `req.signedCookies` 가 undefined 라
  //    세션 인증 E2E 가 프로덕션과 다른 것을 검증하게 된다.
  // ⭐ **서명 키를 넘기는 것까지 같아야 한다.** 키가 없으면 서명 쿠키가 아예 동작하지 않아
  //    E2E 가 "인증이 되는 것처럼" 통과하거나 전부 401 이 된다 — 둘 다 프로덕션과 다른 검증이다.
  app.use(cookieParser(E2E_SESSION_SECRET));

  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(createGlobalValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();
  return app;
}
