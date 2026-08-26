import { plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

export enum AppEnv {
  LOCAL = 'LOCAL',
  PROD = 'PROD',
}

/**
 * 부팅 시 검증하는 환경변수 스키마.
 *
 * 누락·형식 오류면 **기동을 중단한다.** 런타임에 undefined 로 새어나가면
 * 원인이 한참 뒤 엉뚱한 곳에서 드러나기 때문이다.
 */
export class EnvVariables {
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
}

export function validateEnv(config: Record<string, unknown>): EnvVariables {
  const validated = plainToInstance(EnvVariables, config, {
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
        '.env.example 을 참고해 누락된 값을 채운 뒤 다시 실행하세요.',
    );
  }

  return validated;
}
