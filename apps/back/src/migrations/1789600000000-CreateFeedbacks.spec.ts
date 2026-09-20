import type { QueryRunner } from 'typeorm';
import { getMetadataArgsStorage } from 'typeorm';
import { Feedback } from '../entities/feedback.entity';
import { CreateFeedbacks1789600000000 } from './1789600000000-CreateFeedbacks';

describe('피드백 테이블의 main 스키마 호환성 (DB 실행 없음)', () => {
  const migration = new CreateFeedbacks1789600000000();

  it('기존 유저 int unsigned를 참조하며 카테고리·제목·내용 및 UTC 정밀도를 유지한다', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await migration.up({ query } as unknown as QueryRunner);
    const sql = query.mock.calls[0]?.[0] as string;

    expect(query).toHaveBeenCalledTimes(1);
    expect(sql).toContain('`user_id` INT UNSIGNED NOT NULL');
    expect(sql).toContain('REFERENCES `users` (`id`) ON DELETE CASCADE');
    expect(sql).toContain('DATETIME(3)');
    expect(sql).toContain('`category` VARCHAR(32) NOT NULL');
    expect(sql).toContain('`title` VARCHAR(50) NOT NULL');
    expect(sql).toContain('`content` TEXT NOT NULL');
    expect(sql).not.toMatch(/ALTER TABLE|CREATE TABLE IF NOT EXISTS/);

    const metadata = getMetadataArgsStorage();
    expect(
      metadata.columns.find(
        (column) => column.target === Feedback && column.propertyName === 'userId',
      )?.options,
    ).toMatchObject({ type: 'int', unsigned: true });
    expect(
      metadata.columns.find(
        (column) => column.target === Feedback && column.propertyName === 'title',
      )?.options,
    ).toMatchObject({ type: 'varchar', length: 50 });
  });

  it('rollback은 새 피드백 테이블에만 한정한다', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await migration.down({ query } as unknown as QueryRunner);
    expect(query).toHaveBeenCalledWith('DROP TABLE IF EXISTS `feedbacks`');
    expect(query).toHaveBeenCalledTimes(1);
  });
});
