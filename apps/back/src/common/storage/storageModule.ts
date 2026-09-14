import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LocalStorageAdapter } from '../adapters/local-storage.adapter';
import { S3StorageAdapter } from '../adapters/s3-storage.adapter';
import { STORAGE_PORT } from '../port/storage.port';

/** 오브젝트 저장소 선택을 한 곳에서 소유해 모든 기능이 같은 환경 규칙을 사용하게 한다. */
@Module({
  imports: [ConfigModule],
  providers: [
    S3StorageAdapter,
    LocalStorageAdapter,
    {
      provide: STORAGE_PORT,
      useFactory: (
        config: ConfigService,
        s3: S3StorageAdapter,
        local: LocalStorageAdapter,
      ) => (config.get<string>('STORAGE_PROVIDER') === 's3' ? s3 : local),
      inject: [ConfigService, S3StorageAdapter, LocalStorageAdapter],
    },
  ],
  exports: [STORAGE_PORT],
})
export class StorageModule {}
