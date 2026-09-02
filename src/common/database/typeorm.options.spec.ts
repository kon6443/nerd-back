import {
  DB_CONNECT_RETRY,
  buildMysqlConnectionOptions,
  buildTypeOrmOptions,
} from './typeorm.options';

const ENV = {
  DB_HOST: 'prod_nerd_db_mysql',
  DB_PORT: 3306,
  DB_USER: 'nerd_app',
  DB_PASSWORD: 'secret',
  DB_NAME: 'nerd',
  DB_POOL_SIZE: 10,
};

/** 앱 스택 healthcheck: start_period 30s + interval 15s × retries 3. 이보다 먼저 포기해야 한다. */
const HEALTHCHECK_KILL_MS = (30 + 15 * 3) * 1_000;

describe('TypeORM 옵션', () => {
  it('타임존은 Z, 문자셋은 utf8mb4 계열이다 ⭐', () => {
    // 기본값에 맡기면 로컬 TZ 해석 + utf8mb3 — 둘 다 조용히 데이터를 망친다.
    const opts = buildMysqlConnectionOptions(ENV);

    expect(opts.timezone).toBe('Z');
    expect(opts.charset).toBe('utf8mb4_0900_ai_ci');
  });

  it('풀 크기는 env 를 따른다', () => {
    expect(buildMysqlConnectionOptions(ENV).extra).toEqual({ connectionLimit: 10 });
  });

  it('synchronize · migrationsRun 은 false 다 ⭐', () => {
    // 전 환경이 같은 DB 다. true 면 부팅이 곧 상용 스키마 변경이다.
    const opts = buildTypeOrmOptions(ENV);

    expect(opts.synchronize).toBe(false);
    expect(opts.migrationsRun).toBe(false);
  });

  it('쿼리 로깅은 error 만 남긴다', () => {
    expect(buildTypeOrmOptions(ENV).logging).toEqual(['error']);
  });

  it('재시도 예산이 healthcheck 종료 시한 안에 끝난다', () => {
    const total = DB_CONNECT_RETRY.attempts * DB_CONNECT_RETRY.delayMs;

    expect(total).toBeLessThan(HEALTHCHECK_KILL_MS);
  });
});
