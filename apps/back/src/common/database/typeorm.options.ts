import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions';
import type { DbEnvVariables } from '@config/env.validation';

/**
 * 부팅 시 DB 연결 재시도 예산. **Swarm healthcheck 가 컨테이너를 죽이는 시점보다 짧아야 한다** —
 * 앱 스택은 start_period 30s + interval 15s × retries 3 = 75s. 이 안에서 TypeORM 이 먼저 포기하고
 * 프로세스가 종료되어야 restart_policy 가 깔끔하게 다음 시도를 시작한다 (D8, tasks-db-mysql.md).
 */
export const DB_CONNECT_RETRY = { attempts: 10, delayMs: 3_000 } as const; // = 30초

/**
 * 접속 옵션 — 앱(`DatabaseModule`)과 마이그레이션 CLI(`config/data-source.ts`)가 공유한다.
 * 한쪽만 고치면 CLI 가 앱과 다른 타임존·문자셋으로 붙는다.
 */
export function buildMysqlConnectionOptions(env: DbEnvVariables): MysqlConnectionOptions {
  return {
    type: 'mysql',
    host: env.DB_HOST,
    port: env.DB_PORT,
    username: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    // UTC 정책 (code-patterns §10). 없으면 DATETIME 을 프로세스 로컬 TZ 로 해석해
    // 같은 행을 로컬(KST)과 운영(UTC)이 다르게 읽는다.
    timezone: 'Z',
    // ⚠️ TypeORM 의 기본값은 UTF8_GENERAL_CI — **utf8mb3** 다. 이모지가 깨진다.
    //    mysql2 의 charset 옵션은 collation 이름을 받으므로 서버와 같은 값을 명시한다.
    charset: 'utf8mb4_0900_ai_ci',
    extra: { connectionLimit: env.DB_POOL_SIZE },
  };
}

/**
 * 마이그레이션 CLI 의 접속 옵션 — 앱과 **같은 `.env` 를 읽지만 계정만 다르다.**
 *
 * `DB_USER`(nerd_app)에는 DDL 권한이 없다. 코드 경로에서 스키마가 바뀔 수 없게 하려는 의도된
 * 제약이라, 마이그레이션만 `DB_MIGRATION_USER`/`DB_MIGRATION_PASSWORD` 로 덮어쓴다.
 * 🚫 이 분리를 없애고 앱 계정에 DDL 을 주지 말 것 — 그러면 앱이 도는 동안 스키마가 바뀔 수 있다.
 *
 * 짝이 어긋나면 **아이디와 비밀번호가 다른 계정의 것으로 섞여** 붙는다. 인증 실패가
 * "비밀번호가 틀렸나?" 로 보여 원인 추적이 길어지므로 접속 전에 먼저 멈춘다.
 *
 * ⚠️ 🚫 **`db:migrate:list` 를 "읽기 전용" 으로 취급하지 않는다.** TypeORM 의 `migration:show` 는
 * 조회 전에 `migrations` 테이블이 없으면 `CREATE TABLE` 을 던진다. 즉 **네 명령 전부 DDL 을 낼 수
 * 있고, 전부 사람이 실행한다.** (2026-09-04 실측: 앱 계정으로 돌려 1142 거부 확인)
 */
export function buildMigrationConnectionOptions(env: DbEnvVariables): MysqlConnectionOptions {
  const hasUser = env.DB_MIGRATION_USER !== undefined;
  const hasPassword = env.DB_MIGRATION_PASSWORD !== undefined;

  if (hasUser !== hasPassword) {
    throw new Error(
      'DB_MIGRATION_USER 와 DB_MIGRATION_PASSWORD 는 함께 채우거나 함께 비워야 한다.\n' +
        '  - 둘 다 채움: 그 계정(nerd_migrator)으로 붙는다. 네 명령 모두 이 상태를 요구한다.\n' +
        '  - 둘 다 비움: 앱 계정(DB_USER)으로 붙어 DDL 이 거부된다(1142). list 도 마찬가지다.\n' +
        '  apps/back/.env 를 확인하세요.',
    );
  }

  const base = buildMysqlConnectionOptions(env);
  if (!hasUser) return base;

  return { ...base, username: env.DB_MIGRATION_USER, password: env.DB_MIGRATION_PASSWORD };
}

export function buildTypeOrmOptions(env: DbEnvVariables): TypeOrmModuleOptions {
  return {
    ...buildMysqlConnectionOptions(env),
    // 🚫 절대 true 로 하지 않는다 — 부팅만으로 상용 스키마가 바뀐다 (전 환경이 같은 DB).
    synchronize: false,
    migrationsRun: false,
    // 모듈이 forFeature 로 등록한 엔티티를 자동 수집한다. 경로 glob 은 dist 배포에서 자주 깨진다.
    autoLoadEntities: true,
    // 🚫 쿼리 로깅을 켜지 않는다 — 공유 로그 스택 인제스트 한도 (CLAUDE.md Never).
    logging: ['error'],
    retryAttempts: DB_CONNECT_RETRY.attempts,
    retryDelay: DB_CONNECT_RETRY.delayMs,
  };
}
