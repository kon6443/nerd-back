import { z } from 'zod';

/**
 * 환경변수 스키마 — **zod 로 검증한다.**
 *
 * 누락·형식 오류면 **기동을 중단한다.** 런타임에 `undefined` 로 새어나가면 원인이 한참 뒤
 * 엉뚱한 곳에서 드러나기 때문이다.
 *
 * ⚠️ `process.env` 값은 **항상 문자열**이다. 숫자 필드는 `z.coerce` 로 **명시적으로** 변환한다 —
 * 🚫 프레임워크의 암묵 변환에 기대지 않는다.
 * ⚠️ 스키마를 `.strict()` 로 만들지 않는다. `process.env` 에는 우리와 무관한 키가 잔뜩 있어
 *    strict 로 두면 어느 환경에서도 부팅하지 못한다. 모르는 키는 조용히 버린다.
 */

export const AppEnv = {
  LOCAL: 'LOCAL',
  PROD: 'PROD',
} as const;

export type AppEnv = (typeof AppEnv)[keyof typeof AppEnv];

const port = (defaultValue: number) =>
  z.coerce.number().int().min(1).max(65535).default(defaultValue);

const requiredText = z.string().min(1);

/**
 * 선택 변수. **빈 문자열을 "안 채움" 으로 읽는다.**
 *
 * `.env` 에서 `KEY=` 는 빈 문자열로 들어온다 — 사람이 보기엔 안 채운 것이고, 실제로
 * `.env.example` 도 채울 자리를 빈 값으로 배포한다. 이것을 형식 오류로 처리하면
 * `Too small: expected string to have >=1 characters` 같은 zod 기본 메시지가 나가서,
 * 정작 준비해 둔 안내(짝 검사)에 도달하지 못한다 (2026-09-04 실측).
 *
 * 🚫 필수 변수에는 쓰지 않는다 — 거기서는 빈 줄이 곧 "채우다 만 실수" 라 잡아야 한다.
 */
const optionalText = z.preprocess((value) => (value === '' ? undefined : value), z.string().min(1).optional());

/**
 * DB 접속 변수. 앱(`envSchema`)과 마이그레이션 CLI(`config/data-source.ts`)가 **같은 스키마**를 쓴다 —
 * 둘 다 `.env` 한 파일을 읽지만 CLI 에는 Redis 등 앱 변수가 필요 없다 — 그래서 DB 부분만
 * 따로 검증할 수 있어야 한다. 계정은 `DB_MIGRATION_*` 로 갈린다.
 *
 * 배포에서는 서버 .env 가 스택 DNS 를, 로컬에서는 SSH 터널(`127.0.0.1`)을 가리킨다.
 * 전 환경이 같은 서버 DB 를 쓴다 — 로컬용 DB 는 없다.
 */
export const dbEnvSchema = z.object({
  DB_HOST: requiredText,
  DB_PORT: port(3306),
  DB_USER: requiredText,
  DB_PASSWORD: requiredText,
  DB_NAME: requiredText,
  /**
   * 커넥션 풀 크기. **레플리카 3 × 이 값 + 운영·마이그레이션 여유가 MySQL `max_connections`(100) 안에
   * 들어야 한다.** 2 OCPU 에서 동시에 실행되는 쿼리는 어차피 소수라, 키워도 대기열이 DB 안으로 옮겨갈 뿐이다.
   */
  DB_POOL_SIZE: z.coerce.number().int().min(1).max(30).default(10),

  /**
   * 마이그레이션 CLI 전용 계정. **앱과 같은 `.env` 를 읽지만 계정은 다르다.**
   *
   * `DB_USER`(nerd_app)에는 DDL 권한이 없다 — 코드 경로에서 스키마가 바뀔 수 없게 하려는
   * 의도된 제약이다. 🚫 앱 계정에 DDL 을 주어 이 값을 없애지 말 것.
   *
   * ⚠️ **`db:migrate:list` 에도 필요하다.** TypeORM 의 `migration:show` 는 조회 전에
   * `migrations` 테이블이 없으면 `CREATE TABLE` 을 먼저 던진다 — 이름과 달리 읽기 전용이 아니다.
   * 비워 두면 `ER_TABLEACCESS_DENIED_ERROR`(1142) 로 실패한다 (2026-09-04 실측).
   */
  DB_MIGRATION_USER: optionalText,
  DB_MIGRATION_PASSWORD: optionalText,
});

export const envSchema = dbEnvSchema.extend({
  ENV: z.enum([AppEnv.LOCAL, AppEnv.PROD], {
    error: 'ENV 는 LOCAL 또는 PROD 여야 한다.',
  }),
  PORT: port(5501),
  LOG_LEVEL: z.string().default('info'),
  /** 쉼표로 구분한 허용 오리진. 빈 문자열이면 크로스 오리진 요청을 허용하지 않는다. */
  CORS_ORIGINS: z.string().default(''),
  REDIS_HOST: requiredText,
  REDIS_PORT: port(6379),
  REDIS_PASSWORD: z.string().optional(),
  /**
   * 세션 쿠키 서명 키 (`cookie-parser`).
   *
   * ⭐ **레플리카 3개가 같은 값을 써야 한다.** 다르면 A 가 심은 쿠키를 B 가 위조로 보고 거절해
   * "새로고침할 때마다 로그인이 풀린다" 로 드러난다.
   * ⚠️ 값을 바꾸면 **모든 사용자가 로그아웃된다**(서명이 안 맞게 되므로). 서버측 세션이 없는
   * 지금 이것이 유일한 「전체 강제 로그아웃」 수단이다.
   * 🚫 짧게 두지 않는다 — HMAC 키라 길이가 곧 강도다.
   */
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET 은 32자 이상이어야 합니다.'),
  /** Swarm 이 {{.Task.Slot}} 으로 주입한다. 단일 실행 작업의 가드에 쓴다. */
  TASK_SLOT: z.coerce.number().int().min(1).default(1),
  /**
   * 엣지 백스톱 레이트리밋 활성화. **기본 비활성.**
   *
   * Nest 가드가 닿지 않는 경로(Swagger·스펙 JSON·404)를 덮는 기능인데, 모든 요청을 지나가는
   * 미들웨어이므로 한도를 잘못 잡으면 정상 트래픽이 429 를 받는다. 그래서 코드로 먼저 내리고
   * **켜는 시점은 운영이 통제**한다 (배포 직후 조치 게이트).
   *
   * ⚠️ 타입이 boolean 이 아니라 **문자열 리터럴**인 이유: env 값은 항상 문자열이라
   *    `z.coerce.boolean()` 을 쓰면 `'false'` 가 **truthy 로 변환**되어 끈 상태가 켜진 상태로
   *    뒤집힌다. 문자열로 받고 비교하는 쪽이 안전하다. `env.validation.spec.ts` 가 이 동작을 고정한다.
   */
  EDGE_THROTTLE_ENABLED: z
    .enum(['true', 'false'], { error: "EDGE_THROTTLE_ENABLED 는 'true' 또는 'false' 여야 한다." })
    .default('false'),
  /** 회원가입 허용 여부 ('true' | 'false'). 미설정 시 환경 기본값(LOCAL: true, PROD: false)을 따른다. */
  SIGNUP_ENABLED: z
    .enum(['true', 'false'], { error: "SIGNUP_ENABLED 는 'true' 또는 'false' 여야 한다." })
    .optional(),
  /** AI 이미지 생성 어댑터 공급자 (mock | openrouter) */
  IMAGE_PROVIDER: z.enum(['mock', 'openrouter']).default('mock'),
  /** 실제 얼굴 직접 주입 테스트 모드 ('true' | 'false') */
  DIRECT_FACE_MODE: z.enum(['true', 'false']).default('false'),
  /** OpenRouter API 키 */
  OPENROUTER_API_KEY: optionalText,
  /** OpenRouter 이미지 모델 (기본: qwen/qwen-image-3) */
  OPENROUTER_IMAGE_MODEL: z.string().default('qwen/qwen-image-3'),
  /** 스토리지 어댑터 공급자 (local | s3) */
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  S3_ENDPOINT: optionalText,
  S3_PUBLIC_URL: optionalText,
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET_NAME: z.string().default('nerd-storage'),
  S3_ACCESS_KEY_ID: optionalText,
  S3_SECRET_ACCESS_KEY: optionalText,
  STORAGE_KEY_PREFIX: z.string().default('dev/'),
});

export type DbEnvVariables = z.infer<typeof dbEnvSchema>;
export type EnvVariables = z.infer<typeof envSchema>;

/** 위 플래그가 켜졌는지. 문자열 비교를 한 곳에만 둔다. */
export function isEdgeThrottleEnabled(value: string | undefined): boolean {
  return value === 'true';
}

function validateWith<T extends z.ZodType>(
  schema: T,
  config: Record<string, unknown>,
  exampleFile: string,
): z.infer<T> {
  const result = schema.safeParse(config);

  if (!result.success) {
    // 사람이 읽고 바로 고칠 수 있어야 한다 — 어느 키가 왜 틀렸는지를 한 줄씩 보여준다.
    const detail = result.error.issues
      .map((issue) => `  - ${issue.path.map(String).join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `환경변수 검증에 실패했다. 기동을 중단한다.\n${detail}\n\n` +
        `${exampleFile} 을 참고해 누락된 값을 채운 뒤 다시 실행하세요.`,
    );
  }

  return result.data;
}

export function validateEnv(config: Record<string, unknown>): EnvVariables {
  return validateWith(envSchema, config, '.env.example');
}

/** 마이그레이션 CLI 용 — DB 변수만 검증한다. */
export function validateDbEnv(config: Record<string, unknown>): DbEnvVariables {
  return validateWith(dbEnvSchema, config, '.env.example');
}
