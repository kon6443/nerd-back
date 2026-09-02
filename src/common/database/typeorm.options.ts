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
