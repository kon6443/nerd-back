import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageCleanupTask } from '../../entities/storage-cleanup-task.entity';
import { StorageModule } from './storageModule';
import { StorageCleanupService } from './storage-cleanup.service';

/**
 * 고아 스토리지 객체 및 삭제 실패 작업을 영속적으로 관리하고 재시도하는 모듈.
 */
@Module({
  imports: [TypeOrmModule.forFeature([StorageCleanupTask]), StorageModule],
  providers: [StorageCleanupService],
  exports: [StorageCleanupService],
})
export class StorageCleanupModule {}
