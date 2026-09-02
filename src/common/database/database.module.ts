import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { addTransactionalDataSource } from 'typeorm-transactional';
import { buildTypeOrmOptions } from './typeorm.options';

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
      // @Transactional 이 트랜잭션을 전파하려면 DataSource 를 typeorm-transactional 에 등록해야 한다.
      // initialize() 는 Nest 가 이 반환값으로 호출한다 (재시도 포함).
      dataSourceFactory: (options) => {
        if (!options) {
          throw new Error('TypeORM 옵션이 비어 있다 — useFactory 를 확인하세요.');
        }
        return Promise.resolve(addTransactionalDataSource(new DataSource(options)));
      },
    }),
  ],
})
export class DatabaseModule {}
