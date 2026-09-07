import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * My Story 동화 **콘텐츠** 스키마 생성 (Slice 1).
 *
 * 목적 하나 = 사전 제작 콘텐츠 4개 테이블. 사용자별 진행 상태(세션·개인화 결과)는
 * 다른 마이그레이션이 만든다 — 두 관심사는 수명주기도 쓰기 주체도 다르다.
 *
 * 🚫 **실행은 사람이 한다** (`pnpm db:migrate:up`, 계정 `DB_MIGRATION_*`). 전 환경이 같은 DB 라
 * 실행이 곧 상용 적용이다 (`apps/back/CLAUDE.md` Never).
 *
 * **멱등 작성** — MySQL 은 DDL 이 암묵 커밋이라 중간에 실패하면 부분 적용 상태로 남는다.
 * 트랜잭션이 되돌려 주지 않으므로 `IF NOT EXISTS` / `IF EXISTS` 가 유일한 방어다.
 * 그래야 실패 지점부터 다시 돌릴 수 있다 (code-patterns §12).
 */
export class CreateStoryContentTables1788512400000 implements MigrationInterface {
  name = 'CreateStoryContentTables1788512400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 시각 컬럼은 DATETIME(3). 🚫 TIMESTAMP 를 쓰지 않는다 — 세션 TZ 기준으로 자동 변환되어
    // 환경마다 값이 달라지고 2038-01-19 이후를 표현하지 못한다 (code-patterns §10).
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`story_templates\` (
        \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`slug\` VARCHAR(64) NOT NULL,
        \`title\` VARCHAR(200) NOT NULL,
        \`summary\` VARCHAR(500) NULL,
        \`cover_image_key\` VARCHAR(512) NULL,
        \`status\` VARCHAR(20) NOT NULL DEFAULT 'draft',
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_story_templates_slug\` (\`slug\`),
        KEY \`ix_story_templates_status\` (\`status\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    // status 를 ENUM 이 아니라 VARCHAR 로 둔 이유: 값을 하나 늘릴 때마다 ALTER TABLE 이 필요하고,
    // MySQL ENUM 은 내부적으로 정수 순서에 묶여 있어 값 순서를 바꾸면 기존 행의 의미가 달라진다.
    // 허용 값은 앱 상수(STORY_TEMPLATE_STATUS)가 소유한다.

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`story_pages\` (
        \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`template_id\` INT UNSIGNED NOT NULL,
        \`page_no\` SMALLINT UNSIGNED NOT NULL,
        \`body_text\` TEXT NOT NULL,
        \`base_image_key\` VARCHAR(512) NULL,
        \`persona_target_role\` VARCHAR(64) NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_story_pages_template_page_no\` (\`template_id\`, \`page_no\`),
        CONSTRAINT \`fk_story_pages_template\` FOREIGN KEY (\`template_id\`)
          REFERENCES \`story_templates\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`story_characters\` (
        \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`template_id\` INT UNSIGNED NOT NULL,
        \`role\` VARCHAR(64) NOT NULL,
        \`display_name\` VARCHAR(100) NOT NULL,
        \`persona\` TEXT NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_story_characters_template_role\` (\`template_id\`, \`role\`),
        CONSTRAINT \`fk_story_characters_template\` FOREIGN KEY (\`template_id\`)
          REFERENCES \`story_templates\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`story_page_characters\` (
        \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`page_id\` INT UNSIGNED NOT NULL,
        \`character_id\` INT UNSIGNED NOT NULL,
        \`hitbox\` JSON NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_story_page_characters_page_character\` (\`page_id\`, \`character_id\`),
        KEY \`ix_story_page_characters_character\` (\`character_id\`),
        CONSTRAINT \`fk_story_page_characters_page\` FOREIGN KEY (\`page_id\`)
          REFERENCES \`story_pages\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_story_page_characters_character\` FOREIGN KEY (\`character_id\`)
          REFERENCES \`story_characters\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 참조하는 쪽부터 지운다. 순서를 뒤집으면 FK 제약으로 실패한다.
    await queryRunner.query('DROP TABLE IF EXISTS `story_page_characters`');
    await queryRunner.query('DROP TABLE IF EXISTS `story_pages`');
    await queryRunner.query('DROP TABLE IF EXISTS `story_characters`');
    await queryRunner.query('DROP TABLE IF EXISTS `story_templates`');
  }
}
