import type { MigrationInterface, QueryRunner } from 'typeorm';

/** 개인 동화·장면당 하나의 대화. 전 환경 공유 DB이므로 실행은 담당자가 한다. */
export class CreateStoryPageChats1789138800000 implements MigrationInterface {
  name = 'CreateStoryPageChats1789138800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`story_page_chats\` (
        \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`user_id\` INT UNSIGNED NOT NULL,
        \`session_id\` VARCHAR(36) NOT NULL,
        \`page_id\` INT UNSIGNED NOT NULL,
        \`role\` VARCHAR(64) NOT NULL,
        \`display_name\` VARCHAR(100) NOT NULL,
        \`message\` VARCHAR(300) NOT NULL,
        \`reply\` TEXT NULL,
        \`status\` VARCHAR(16) NOT NULL DEFAULT 'pending',
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_story_page_chats_session_page\` (\`session_id\`, \`page_id\`),
        KEY \`ix_story_page_chats_user\` (\`user_id\`),
        CONSTRAINT \`fk_story_page_chats_session\` FOREIGN KEY (\`session_id\`)
          REFERENCES \`story_sessions\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_story_page_chats_user\` FOREIGN KEY (\`user_id\`)
          REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_story_page_chats_page\` FOREIGN KEY (\`page_id\`)
          REFERENCES \`story_pages\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `story_page_chats`');
  }
}
