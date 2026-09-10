import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Slice 6: 공통 본편과 A/B 결과를 같은 페이지 번호로 보관할 수 있게 한다.
 * 기존 선형 콘텐츠와 개인화 결과는 모두 `common`으로 보존한다.
 */
export class AddBehindStoryBranches1788728400000 implements MigrationInterface {
  name = 'AddBehindStoryBranches1788728400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('story_pages', 'branch_key'))) {
      await queryRunner.query(
        "ALTER TABLE `story_pages` ADD COLUMN `branch_key` VARCHAR(16) NOT NULL DEFAULT 'common' AFTER `page_no`",
      );
    }
    if (!(await this.hasIndex(queryRunner, 'story_pages', 'ix_story_pages_template'))) {
      // 기존 복합 UNIQUE 인덱스는 template_id FK에도 쓰인다. 독립 인덱스를 먼저 제공해야 교체할 수 있다.
      await queryRunner.query('ALTER TABLE `story_pages` ADD KEY `ix_story_pages_template` (`template_id`)');
    }
    if (await this.hasIndex(queryRunner, 'story_pages', 'uq_story_pages_template_page_no')) {
      await queryRunner.query('ALTER TABLE `story_pages` DROP INDEX `uq_story_pages_template_page_no`');
    }
    if (!(await this.hasIndex(queryRunner, 'story_pages', 'uq_story_pages_template_page_branch'))) {
      await queryRunner.query(
        'ALTER TABLE `story_pages` ADD UNIQUE KEY `uq_story_pages_template_page_branch` (`template_id`, `page_no`, `branch_key`)',
      );
    }

    if (!(await queryRunner.hasColumn('session_page_images', 'branch_key'))) {
      await queryRunner.query(
        "ALTER TABLE `session_page_images` ADD COLUMN `branch_key` VARCHAR(16) NOT NULL DEFAULT 'common' AFTER `page_no`",
      );
    }
    if (!(await this.hasIndex(queryRunner, 'session_page_images', 'ix_session_page_images_session'))) {
      await queryRunner.query('ALTER TABLE `session_page_images` ADD KEY `ix_session_page_images_session` (`session_id`)');
    }
    if (await this.hasIndex(queryRunner, 'session_page_images', 'uq_session_page_images_session_page')) {
      await queryRunner.query('ALTER TABLE `session_page_images` DROP INDEX `uq_session_page_images_session_page`');
    }
    if (!(await this.hasIndex(queryRunner, 'session_page_images', 'uq_session_page_images_session_page_branch'))) {
      await queryRunner.query(
        'ALTER TABLE `session_page_images` ADD UNIQUE KEY `uq_session_page_images_session_page_branch` (`session_id`, `page_no`, `branch_key`)',
      );
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`story_after_story_choices\` (
        \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`template_id\` INT UNSIGNED NOT NULL,
        \`branch_key\` VARCHAR(16) NOT NULL,
        \`title\` VARCHAR(200) NOT NULL,
        \`description\` VARCHAR(500) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_story_after_story_choices_template_branch\` (\`template_id\`, \`branch_key\`),
        CONSTRAINT \`fk_story_after_story_choices_template\` FOREIGN KEY (\`template_id\`)
          REFERENCES \`story_templates\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`session_branch_choices\` (
        \`id\` VARCHAR(36) NOT NULL,
        \`session_id\` VARCHAR(36) NOT NULL,
        \`branch_key\` VARCHAR(16) NOT NULL,
        \`selected_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_session_branch_choices_session\` (\`session_id\`),
        CONSTRAINT \`fk_session_branch_choices_session\` FOREIGN KEY (\`session_id\`)
          REFERENCES \`story_sessions\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `session_branch_choices`');
    await queryRunner.query('DROP TABLE IF EXISTS `story_after_story_choices`');
    await queryRunner.query('ALTER TABLE `session_page_images` DROP INDEX `uq_session_page_images_session_page_branch`');
    await queryRunner.query('ALTER TABLE `session_page_images` DROP COLUMN `branch_key`');
    await queryRunner.query('ALTER TABLE `session_page_images` ADD UNIQUE KEY `uq_session_page_images_session_page` (`session_id`, `page_no`)');
    await queryRunner.query('ALTER TABLE `session_page_images` DROP INDEX `ix_session_page_images_session`');
    await queryRunner.query('ALTER TABLE `story_pages` DROP INDEX `uq_story_pages_template_page_branch`');
    await queryRunner.query('ALTER TABLE `story_pages` DROP COLUMN `branch_key`');
    await queryRunner.query('ALTER TABLE `story_pages` ADD UNIQUE KEY `uq_story_pages_template_page_no` (`template_id`, `page_no`)');
    await queryRunner.query('ALTER TABLE `story_pages` DROP INDEX `ix_story_pages_template`');
  }

  private async hasIndex(queryRunner: QueryRunner, tableName: string, indexName: string): Promise<boolean> {
    const table = await queryRunner.getTable(tableName);
    return table?.indices.some((index) => index.name === indexName) ?? false;
  }
}
