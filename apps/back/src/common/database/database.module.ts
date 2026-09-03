import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { addTransactionalDataSource, deleteDataSourceByName } from 'typeorm-transactional';
import { buildTypeOrmOptions } from './typeorm.options';

/**
 * typeorm-transactional 레지스트리의 등록 이름. 이름 없이 `DataSource` 를 넘기면
 * 라이브러리가 `'default'` 로 등록한다.
 */
export const TRANSACTIONAL_DATA_SOURCE_NAME = 'default';

/**
 * `TypeOrmModule` 의 `dataSourceFactory`. `@Transactional` 이 트랜잭션을 전파하려면
 * `DataSource` 가 typeorm-transactional 에 등록되어 있어야 한다.
 * `initialize()` 는 Nest 가 이 반환값으로 호출한다.
 *
 * ⚠️ **Nest 는 연결에 실패하면 재시도마다 이 factory 를 다시 호출한다.** 레지스트리는 같은 이름의
 * 중복 등록을 `already added` 로 거부하므로, 이전 등록을 지우지 않으면 2회차부터 **DB 에 접속해
 * 보기도 전에** 그 에러로 실패한다. 재시도 간격은 그대로라 30초를 버티는 것처럼 보이지만 실제
 * 접속 시도는 `DB_CONNECT_RETRY` 10회 중 **1회뿐**이다 — 부팅 도중 DB 가 늦게 떠도 앱은 그것을
 * 영영 보지 못하고 죽는다. 2026-09-03 컨테이너 실측: 수정 전 접속 시도 1회, 수정 후 10회.
 *
 * 실패한 `DataSource` 를 재사용하지 않고 등록을 지운 뒤 새로 만든다.
 */
export function createTransactionalDataSource(options?: DataSourceOptions): Promise<DataSource> {
  if (!options) {
    throw new Error('TypeORM 옵션이 비어 있다 — useFactory 를 확인하세요.');
  }

  deleteDataSourceByName(TRANSACTIONAL_DATA_SOURCE_NAME);

  return Promise.resolve(addTransactionalDataSource(new DataSource(options)));
}

/**
 * DB 연결.
 *
 * **Redis 와 달리 DB 는 핵심 의존이다.** 연결 실패가 재시도 예산(`DB_CONNECT_RETRY`, 30초)을 넘기면
 * 부팅이 실패하고 프로세스가 종료된다 — 그 뒤는 Swarm `restart_policy`(앱 스택, 무제한)가 맡아
 * DB 가 돌아오면 앱이 스스로 살아난다. Redis 처럼 "죽어도 기동" 하지 않는 이유는 tasks-db-mysql.md D8:
 * DB 없이는 대부분 기능이 의미가 없고, 살아 있는 척하는 앱보다 명확히 죽은 앱이 감시하기 쉽다.
 *
 * 런타임 DB 장애는 다르다 — 이미 뜬 앱은 살아 있고(liveness 는 프로세스만 본다) 쿼리만 실패하다가,
 * DB 가 돌아오면 풀이 새 커넥션을 만들어 자연히 회복한다.
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildTypeOrmOptions({
          DB_HOST: config.getOrThrow<string>('DB_HOST'),
          DB_PORT: config.getOrThrow<number>('DB_PORT'),
          DB_USER: config.getOrThrow<string>('DB_USER'),
          DB_PASSWORD: config.getOrThrow<string>('DB_PASSWORD'),
          DB_NAME: config.getOrThrow<string>('DB_NAME'),
          DB_POOL_SIZE: config.getOrThrow<number>('DB_POOL_SIZE'),
        }),
      dataSourceFactory: createTransactionalDataSource,
    }),
  ],
})
export class DatabaseModule {}
