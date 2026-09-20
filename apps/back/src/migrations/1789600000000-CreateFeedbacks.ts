import type { MigrationInterface, QueryRunner } from 'typeorm';

/** 사용자 피드백 테이블 생성. 전 환경 공유 DB이므로 실행은 담당자가 한다. */
export class CreateFeedbacks1789600000000 implements MigrationInterface {
  name = 'CreateFeedbacks1789600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`feedbacks\` (
        \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`user_id\` INT UNSIGNED NOT NULL,
        \`category\` VARCHAR(32) NOT NULL,
        \`title\` VARCHAR(50) NOT NULL,
        \`content\` TEXT NOT NULL,
        \`page_url\` VARCHAR(255) NULL,
        \`device_info\` JSON NULL,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        KEY \`ix_feedbacks_user\` (\`user_id\`),
        CONSTRAINT \`fk_feedbacks_user\` FOREIGN KEY (\`user_id\`)
          REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `feedbacks`');
  }
}
