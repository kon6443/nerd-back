import type { QueryRunner } from 'typeorm';
import { getMetadataArgsStorage } from 'typeorm';
import { StoryPageChat } from '../entities/story-page-chat.entity';
import { CreateStoryPageChats1789138800000 } from './1789138800000-CreateStoryPageChats';

describe('채팅 테이블의 main 스키마 호환성 (DB 실행 없음)', () => {
  const migration = new CreateStoryPageChats1789138800000();
  it('기존 세션 varchar UUID를 참조하며 장면별 유일성·UTC 정밀도를 유지한다', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await migration.up({ query } as unknown as QueryRunner);
    const sql = query.mock.calls[0]?.[0] as string;
    expect(query).toHaveBeenCalledTimes(1);
    expect(sql).toContain('`session_id` VARCHAR(36) NOT NULL');
    expect(sql).toContain('`uq_story_page_chats_session_page` (`session_id`, `page_id`)');
    expect(sql).toContain('REFERENCES `story_sessions` (`id`)');
    expect(sql).toContain('DATETIME(3)');
    expect(sql).not.toMatch(/ALTER TABLE|CREATE TABLE IF NOT EXISTS/);
    const metadata = getMetadataArgsStorage();
    expect(
      metadata.columns.find(
        (column) => column.target === StoryPageChat && column.propertyName === 'sessionId',
      )?.options,
    ).toMatchObject({ type: 'varchar', length: 36 });
    expect(metadata.uniques.find((unique) => unique.target === StoryPageChat)?.columns).toEqual([
      'sessionId',
      'pageId',
    ]);
  });
  it('rollback은 새 채팅 테이블에만 한정한다', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await migration.down({ query } as unknown as QueryRunner);
    expect(query).toHaveBeenCalledWith('DROP TABLE IF EXISTS `story_page_chats`');
    expect(query).toHaveBeenCalledTimes(1);
  });
});
