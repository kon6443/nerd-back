import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';
import type { ClassConstructor } from 'class-transformer';

export enum AppEnv {
  LOCAL = 'LOCAL',
  PROD = 'PROD',
}

/**
 * DB 접속 변수. 앱(`EnvVariables`)과 마이그레이션 CLI(`config/data-source.ts`)가 **같은 스키마**를 쓴다 —
 * CLI 는 Redis 등 앱 변수가 없는 `.env.migration` 으로 돌기 때문에 따로 검증할 수 있어야 한다.
 *
 * 배포에서는 서버 .env 가 스택 DNS(`prod_nerd_db_mysql`)를, 로컬에서는 SSH 터널(`127.0.0.1`)을 가리킨다.
 * 전 환경이 같은 서버 DB 를 쓴다 — 로컬용 DB 는 없다.
 */
export class DbEnvVariables {
  @IsString()
  @IsNotEmpty()
  DB_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT: number = 3306;

  @IsString()
  @IsNotEmpty()
  DB_USER: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME: string;

  /**
   * 커넥션 풀 크기. **레플리카 3 × 이 값 + 운영·마이그레이션 여유가 MySQL `max_connections`(100) 안에
   * 들어야 한다.** 2 OCPU 에서 동시에 실행되는 쿼리는 어차피 소수라, 키워도 대기열이 DB 안으로 옮겨갈 뿐이다.
   */
  @IsInt()
  @Min(1)
  @Max(30)
  DB_POOL_SIZE: number = 10;
}

/**
 * 부팅 시 검증하는 환경변수 스키마.
 *
 * 누락·형식 오류면 **기동을 중단한다.** 런타임에 undefined 로 새어나가면
 * 원인이 한참 뒤 엉뚱한 곳에서 드러나기 때문이다.
 */
export class EnvVariables extends DbEnvVariables {
  @IsEnum(AppEnv, { message: 'ENV 는 LOCAL 또는 PROD 여야 한다.' })
  ENV: AppEnv;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 5501;

  @IsString()
  LOG_LEVEL: string = 'info';

  /** 쉼표로 구분한 허용 오리진. 빈 문자열이면 크로스 오리진 요청을 허용하지 않는다. */
  @IsString()
  CORS_ORIGINS: string = '';

  @IsString()
  REDIS_HOST: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  REDIS_PORT: number = 6379;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  /** Swarm 이 {{.Task.Slot}} 으로 주입한다. 단일 실행 작업의 가드에 쓴다. */
  @IsInt()
  @Min(1)
  TASK_SLOT: number = 1;

  /**
   * 엣지 백스톱 레이트리밋 활성화. **기본 비활성.**
   *
   * Nest 가드가 닿지 않는 경로(Swagger·스펙 JSON·404)를 덮는 기능인데, 모든 요청을 지나가는
   * 미들웨어이므로 한도를 잘못 잡으면 정상 트래픽이 429 를 받는다. 그래서 코드로 먼저 내리고
   * **켜는 시점은 운영이 통제**한다 (배포 직후 조치 게이트).
   *
   * ⚠️ 타입이 boolean 이 아니라 문자열인 이유: `enableImplicitConversion` 이 켜져 있어
   *    boolean 으로 선언하면 class-transformer 가 문자열 `'false'` 를 **truthy 로 변환**해
   *    끈 상태가 켜진 상태로 뒤집힌다. 문자열로 받고 비교하는 쪽이 안전하다.
   */
  @IsOptional()
  @IsIn(['true', 'false'], {
    message: "EDGE_THROTTLE_ENABLED 는 'true' 또는 'false' 여야 한다.",
  })
  EDGE_THROTTLE_ENABLED: string = 'false';
}

/** 위 플래그가 켜졌는지. 문자열 비교를 한 곳에만 둔다. */
export function isEdgeThrottleEnabled(value: string | undefined): boolean {
  return value === 'true';
}

function validateAs<T extends object>(
  schema: ClassConstructor<T>,
  config: Record<string, unknown>,
  exampleFile: string,
): T {
  const validated = plainToInstance(schema, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
    forbidUnknownValues: false,
  });

  if (errors.length > 0) {
    const detail = errors
      .map((e) => `  - ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');

    throw new Error(
      `환경변수 검증에 실패했다. 기동을 중단한다.\n${detail}\n\n` +
        `${exampleFile} 을 참고해 누락된 값을 채운 뒤 다시 실행하세요.`,
    );
  }

  return validated;
}

export function validateEnv(config: Record<string, unknown>): EnvVariables {
  return validateAs(EnvVariables, config, '.env.example');
}

/** 마이그레이션 CLI 용 — DB 변수만 검증한다. */
export function validateDbEnv(config: Record<string, unknown>): DbEnvVariables {
  return validateAs(DbEnvVariables, config, '.env.migration.example');
}
