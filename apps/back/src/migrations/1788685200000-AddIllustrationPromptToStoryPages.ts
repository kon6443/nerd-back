import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * story_pages 테이블에 삽화 생성 지시문(illustration_prompt) 컬럼 추가.
 *
 * 🚫 실행은 사람이 한다 (pnpm db:migrate:up, 계정 DB_MIGRATION_*).
 */
export class AddIllustrationPromptToStoryPages1788685200000 implements MigrationInterface {
  name = 'AddIllustrationPromptToStoryPages1788685200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`story_pages\`
      ADD COLUMN \`illustration_prompt\` TEXT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`story_pages\`
      DROP COLUMN \`illustration_prompt\`;
    `);
  }
}
