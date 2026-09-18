import { getMetadataArgsStorage, type QueryRunner } from 'typeorm';
import { StorySession } from '../entities/story-session.entity';
import { StorageCleanupTask } from '../entities/storage-cleanup-task.entity';
import { AddSourcePhotoAndCleanupTasks1789500000000 } from './1789500000000-AddSourcePhotoAndCleanupTasks';

describe('임시 실사 및 정리 작업 마이그레이션 (DB 실행 없음)', () => {
  const migration = new AddSourcePhotoAndCleanupTasks1789500000000();

  it('마이그레이션 SQL과 엔티티 metadata가 같은 컬럼을 정의한다', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await migration.up({ query } as unknown as QueryRunner);

    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      'ALTER TABLE `story_sessions` ADD `source_photo_key` VARCHAR(512) NULL',
      'CREATE TABLE `storage_cleanup_tasks` (`id` INT UNSIGNED NOT NULL AUTO_INCREMENT, `storage_key` VARCHAR(512) NOT NULL, `status` VARCHAR(16) NOT NULL DEFAULT \'pending\', `retry_count` INT UNSIGNED NOT NULL DEFAULT 0, `last_error` TEXT NULL, `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), PRIMARY KEY (`id`), INDEX `ix_storage_cleanup_tasks_status` (`status`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci',
    ]);

    const columns = getMetadataArgsStorage().columns;
    expect(
      columns.find(
        (column) => column.target === StorySession && column.propertyName === 'sourcePhotoKey',
      )?.options,
    ).toMatchObject({ name: 'source_photo_key', type: 'varchar', length: 512, nullable: true });

    expect(
      columns.find(
        (column) =>
          column.target === StorageCleanupTask && column.propertyName === 'storageKey',
      )?.options,
    ).toMatchObject({ name: 'storage_key', type: 'varchar', length: 512 });

    expect(
      columns.find(
        (column) => column.target === StorageCleanupTask && column.propertyName === 'status',
      )?.options,
    ).toMatchObject({ name: 'status', type: 'varchar', length: 16, default: 'pending' });
  });

  it('rollback은 추가한 컬럼과 테이블을 역순으로 제거한다', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await migration.down({ query } as unknown as QueryRunner);

    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      'DROP TABLE `storage_cleanup_tasks`',
      'ALTER TABLE `story_sessions` DROP COLUMN `source_photo_key`',
    ]);
  });
});
