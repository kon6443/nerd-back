import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 개인화 동화 페이지별 삽화 테이블 (Slice 4).
 *
 * 세션 내 페이지 번호 유일성: UNIQUE KEY `uq_session_page_images_session_page` (`session_id`, `page_no`)
 * 🚫 실행은 사람이 한다 (pnpm db:migrate:up, 계정 DB_MIGRATION_*).
 */
export class CreateSessionPageImages1788642000000 implements MigrationInterface {
  name = 'CreateSessionPageImages1788642000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`session_page_images\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`session_id\` VARCHAR(36) NOT NULL,
        \`page_no\` SMALLINT UNSIGNED NOT NULL,
        \`status\` ENUM('pending', 'running', 'succeeded', 'failed') NOT NULL DEFAULT 'pending',
        \`image_key\` VARCHAR(512) NULL,
        \`error_message\` VARCHAR(512) NULL,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_session_page_images_session_page\` (\`session_id\`, \`page_no\`),
        CONSTRAINT \`fk_session_page_images_session\` FOREIGN KEY (\`session_id\`) REFERENCES \`story_sessions\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `session_page_images`');
  }
}
