import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { API_PREFIX, DOCS_PATH } from '@common/constants/app.constants';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // bufferLogs — Pino 로거가 준비되기 전의 부팅 로그를 버려지지 않게 모아둔다.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.flushLogs();

  app.setGlobalPrefix(API_PREFIX);

  // 리버스 프록시 뒤에 있으므로 X-Forwarded-* 를 신뢰해야 req.ip 가 실제 클라이언트를 가리킨다.
  app.set('trust proxy', 1);

  // helmet 의 기본 CSP 는 인라인 스크립트를 막아 Swagger UI 를 깨뜨린다.
  // API 응답(JSON)에는 CSP 가 무의미하므로 문서 경로만 제외하고 적용한다.
  const secureHeaders = helmet();
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith(DOCS_PATH)) return next();
    return secureHeaders(req, res, next);
  });

  app.use(compression());
  app.use(cookieParser());

  // 롤링 업데이트 시 진행 중인 요청을 마치고 내려가게 한다.
  app.enableShutdownHooks();

  const config = app.get(ConfigService);

  const origins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    // 목록이 비어 있으면 크로스 오리진을 허용하지 않는다 (와일드카드로 열지 않는다).
    origin: origins.length > 0 ? origins : false,
    credentials: true,
  });

  // Swagger 는 전 환경에 노출한다. 상용 환경이 하나뿐이고, API 설계를 공개하는 편이 낫다.
  // 대신 레이트리밋과 예산 가드레일이 앞단에 반드시 있어야 한다.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('nerd-back API')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup(
    `${API_PREFIX}/docs`,
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  const port = config.get<number>('PORT') ?? 5501;
  await app.listen(port, '0.0.0.0');
}

bootstrap().catch((error: unknown) => {
  // 로거가 준비되기 전에 실패할 수 있으므로 console 로 남긴다.
  console.error('부팅 실패:', error);
  process.exit(1);
});
