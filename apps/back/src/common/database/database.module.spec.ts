import { DataSource } from 'typeorm';
import {
  addTransactionalDataSource,
  deleteDataSourceByName,
  getDataSourceByName,
} from 'typeorm-transactional';
import {
  TRANSACTIONAL_DATA_SOURCE_NAME,
  createTransactionalDataSource,
} from './database.module';
import { buildMysqlConnectionOptions } from './typeorm.options';

const OPTIONS = buildMysqlConnectionOptions({
  DB_HOST: 'prod_nerd_db_mysql',
  DB_PORT: 3306,
  DB_USER: 'nerd_app',
  DB_PASSWORD: 'secret',
  DB_NAME: 'nerd',
  DB_POOL_SIZE: 10,
});

// `new DataSource()` 는 연결하지 않는다. 실제 접속은 `forbid-db` 매퍼가 막는다.
describe('createTransactionalDataSource', () => {
  afterEach(() => {
    deleteDataSourceByName(TRANSACTIONAL_DATA_SOURCE_NAME);
  });

  it('연결 재시도로 여러 번 호출돼도 실패하지 않는다 ⭐', async () => {
    // Nest 는 연결 실패 시 재시도마다 factory 를 다시 부른다. 여기서 던지면 DB 에 접속해 보기도 전에
    // 실패해, 재시도 10회 중 실제 접속 시도가 1회로 줄어든다 (DB_CONNECT_RETRY).
    const first = await createTransactionalDataSource(OPTIONS);
    const second = await createTransactionalDataSource(OPTIONS);

    // 실패한 DataSource 를 재사용하지 않는다 — 재시도마다 새로 만든다.
    expect(second).not.toBe(first);
    // 레지스트리도 새 것을 가리켜야 @Transactional 이 살아 있는 커넥션으로 전파된다.
    expect(getDataSourceByName(TRANSACTIONAL_DATA_SOURCE_NAME)).toBe(second);
  });

  it('옵션이 비어 있으면 이유를 담아 실패한다', () => {
    expect(() => createTransactionalDataSource(undefined)).toThrow('TypeORM 옵션이 비어 있다');
  });

  it('라이브러리는 같은 이름의 중복 등록을 거부한다 — 위 방어가 필요한 이유', () => {
    // 이 전제가 깨지면(라이브러리가 멱등해지면) 방어를 걷어낼 수 있다. 그때 이 테스트가 알려준다.
    addTransactionalDataSource(new DataSource(OPTIONS));

    expect(() => addTransactionalDataSource(new DataSource(OPTIONS))).toThrow('has already added');
  });
});
