import {
  DB_CONNECT_RETRY,
  buildMigrationConnectionOptions,
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

describe('마이그레이션 CLI 접속 옵션', () => {
  it('DB_MIGRATION_* 이 없으면 앱 계정 그대로다 — DDL 은 DB 가 거부한다(1142)', () => {
    expect(buildMigrationConnectionOptions(ENV).username).toBe('nerd_app');
  });

  it('DB_MIGRATION_* 이 있으면 그 계정으로 덮어쓴다 ⭐', () => {
    // 앱 계정에 DDL 이 없는 것이 방어의 핵심이다. 이 덮어쓰기가 사라지면
    // db:migrate:up 이 권한 오류로 실패하거나, 앱 계정에 DDL 을 주는 잘못된 수정을 부른다.
    const opts = buildMigrationConnectionOptions({
      ...ENV,
      DB_MIGRATION_USER: 'nerd_migrator',
      DB_MIGRATION_PASSWORD: 'migrator-secret',
    });

    expect(opts.username).toBe('nerd_migrator');
    expect(opts.password).toBe('migrator-secret');
    // 계정만 갈린다 — 나머지는 앱과 같아야 한다 (§12: 옵션은 한 곳).
    expect(opts.host).toBe(ENV.DB_HOST);
    expect(opts.timezone).toBe('Z');
    expect(opts.charset).toBe('utf8mb4_0900_ai_ci');
  });

  it.each([
    ['USER 만', { DB_MIGRATION_USER: 'nerd_migrator' }],
    ['PASSWORD 만', { DB_MIGRATION_PASSWORD: 'migrator-secret' }],
  ])('%s 채우면 접속 전에 던진다 — 계정이 섞인 채로 붙지 않게', (_label, partial) => {
    expect(() => buildMigrationConnectionOptions({ ...ENV, ...partial })).toThrow(
      /함께 채우거나 함께 비워야/,
    );
  });

  it('메시지가 줄바꿈으로 시작한다 — TypeORM 이 앞에 붙이는 틀린 원인과 붙지 않게', () => {
    // CLI 는 이 예외를 `Unable to open file: "...js". <메시지>` 로 감싼다. 한 줄로 붙으면
    // 사람이 "빌드가 안 됐나?" 부터 확인하게 된다.
    expect(() =>
      buildMigrationConnectionOptions({ ...ENV, DB_MIGRATION_USER: 'nerd_migrator' }),
    ).toThrow(/^\n\n\[\.env 설정 오류\]/);
  });
});
