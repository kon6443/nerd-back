import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 체험하기 사용자 테이블 (Slice 2).
 *
 * 목적 하나 = `users`. 🚫 **실행은 사람이 한다** (`pnpm db:migrate:up`, 계정 `DB_MIGRATION_*`).
 * 전 환경이 같은 DB 라 실행이 곧 상용 적용이다.
 *
 * 멱등 작성 — MySQL 은 DDL 이 암묵 커밋이라 중간 실패가 부분 적용 상태로 남는다.
 */
export class CreateUsers1788555600000 implements MigrationInterface {
  name = 'CreateUsers1788555600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`login_id\` VARCHAR(20) NOT NULL,
        -- scrypt 파라미터·salt·해시를 한 문자열에 담는다. 255 는 그 형식의 여유값이다.
        \`password_hash\` VARCHAR(255) NOT NULL,
        \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (\`id\`),
        -- 가입 경합에서 앱 레벨 조회만으로는 중복을 못 막는다. 동시 요청 둘이 모두
        -- "없음"을 보고 통과하기 때문이다. 이 제약이 최종 방어선이다.
        UNIQUE KEY \`uq_users_login_id\` (\`login_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `users`');
  }
}
