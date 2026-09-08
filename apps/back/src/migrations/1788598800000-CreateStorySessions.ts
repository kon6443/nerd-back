import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 개인화 동화 제작 세션 테이블 (Slice 3).
 *
 * 1인당 동화 템플릿 1회 생성 제한: UNIQUE KEY `uq_story_sessions_user_template` (`user_id`, `template_id`)
 * 🚫 실행은 사람이 한다 (pnpm db:migrate:up, 계정 DB_MIGRATION_*).
 */
export class CreateStorySessions1788598800000 implements MigrationInterface {
  name = 'CreateStorySessions1788598800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`story_sessions\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`user_id\` INT UNSIGNED NOT NULL,
        \`template_id\` INT UNSIGNED NOT NULL,
        \`status\` ENUM('draft', 'face_ready', 'generating', 'completed', 'failed') NOT NULL DEFAULT 'draft',
        \`reference_image_key\` VARCHAR(512) NULL,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_story_sessions_user_template\` (\`user_id\`, \`template_id\`),
        CONSTRAINT \`fk_story_sessions_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_story_sessions_template\` FOREIGN KEY (\`template_id\`) REFERENCES \`story_templates\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `story_sessions`');
  }
}
