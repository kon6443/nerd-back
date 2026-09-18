import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 실사 원본 임시 보관 컬럼과 스토리지 고아 객체 정리를 위한 작업 테이블을 추가한다.
 */
export class AddSourcePhotoAndCleanupTasks1789500000000 implements MigrationInterface {
  name = 'AddSourcePhotoAndCleanupTasks1789500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `story_sessions` ADD `source_photo_key` VARCHAR(512) NULL',
    );
    await queryRunner.query(
      'CREATE TABLE `storage_cleanup_tasks` (' +
        '`id` INT UNSIGNED NOT NULL AUTO_INCREMENT, ' +
        '`storage_key` VARCHAR(512) NOT NULL, ' +
        "`status` VARCHAR(16) NOT NULL DEFAULT 'pending', " +
        '`retry_count` INT UNSIGNED NOT NULL DEFAULT 0, ' +
        '`last_error` TEXT NULL, ' +
        '`created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), ' +
        '`updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3), ' +
        'PRIMARY KEY (`id`), ' +
        'INDEX `ix_storage_cleanup_tasks_status` (`status`)' +
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `storage_cleanup_tasks`');
    await queryRunner.query('ALTER TABLE `story_sessions` DROP COLUMN `source_photo_key`');
  }
}
