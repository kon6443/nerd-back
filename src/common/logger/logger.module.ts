import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule, type Params } from 'nestjs-pino';
import pino from 'pino';
import { LOG_IGNORED_PATHS } from '../constants/app.constants';

/**
 * 마스킹 대상 경로.
 *
 * Pino 내장 `redact` 를 쓴다 — 경로가 컴파일되어 빠르다.
 * 재귀 순회 함수를 직접 만들지 않는 이유는 모든 로그마다 페이로드 전체를 훑게 되어
 * 큰 응답을 다룰 때 비용이 붙기 때문이다. 큰 본문은 애초에 로그에 넣지 않는 규칙으로 막는다.
 */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwd',
  '*.token',
  '*.secret',
  '*.apiKey',
  '*.api_key',
  '*.accessToken',
  '*.access_token',
  '*.refreshToken',
  '*.refresh_token',
  '*.credentials',
  '*.authorization',
];

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): Params => {
        const isLocal = config.get<string>('ENV') === 'LOCAL';
        const level = config.get<string>('LOG_LEVEL') ?? 'info';

        const base = {
          level,
          timestamp: pino.stdTimeFunctions.isoTime,
          redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
          serializers: {
            req: (req: { id?: unknown; method?: string; url?: string }) => ({
              id: req.id,
              method: req.method,
              url: req.url,
            }),
            res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
            err: pino.stdSerializers.err,
          },
          // 리버스 프록시가 넣어준 요청 ID 를 승계한다. 없으면 만든다.
          genReqId: (req: { headers?: Record<string, unknown> }) =>
            (req.headers?.['x-request-id'] as string | undefined) ??
            `req-${process.hrtime.bigint().toString(36)}`,
          // 헬스체크는 10~30초 간격으로 폴링되므로 그대로 두면 로그가 이것들로만 채워진다.
          autoLogging: {
            ignore: (req: { url?: string; originalUrl?: string }) => {
              const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
              return LOG_IGNORED_PATHS.some((ignored) => path.startsWith(ignored));
            },
          },
        };

        if (isLocal) {
          return {
            pinoHttp: {
              ...base,
              // transport 를 쓰면 formatters.level 함수를 넘길 수 없다 (worker thread 제약).
              // pino-pretty 가 자체적으로 level 을 문자열로 출력하므로 문제 없다.
              transport: {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'SYS:standard',
                  ignore: 'pid,hostname',
                  singleLine: false,
                },
              },
            },
          };
        }

        // 배포 — JSON stdout. 로그 수집 에이전트가 이 형식을 그대로 파싱한다.
        return {
          pinoHttp: {
            ...base,
            formatters: {
              level: (label: string) => ({ level: label }),
            },
          },
        };
      },
    }),
  ],
})
export class LoggerModule {}
