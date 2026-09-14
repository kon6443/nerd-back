import { getMetadataArgsStorage, type QueryRunner } from 'typeorm';
import { StoryCharacter } from '../entities/story-character.entity';
import { StoryPageChat } from '../entities/story-page-chat.entity';
import { StoryPage } from '../entities/story-page.entity';
import { AddStoryAudioFields1789405200000 } from './1789405200000-AddStoryAudioFields';

describe('동화 오디오 필드 마이그레이션 (DB 실행 없음)', () => {
  const migration = new AddStoryAudioFields1789405200000();

  it('마이그레이션 SQL과 엔티티 metadata가 같은 컬럼을 정의한다', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await migration.up({ query } as unknown as QueryRunner);

    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      'ALTER TABLE `story_pages` ADD `narration_audio_key` VARCHAR(512) NULL',
      'ALTER TABLE `story_characters` ADD `tts_voice_id` VARCHAR(128) NULL, ADD `tts_settings` JSON NULL',
      "ALTER TABLE `story_page_chats` ADD `reply_audio_key` VARCHAR(512) NULL, ADD `reply_audio_status` VARCHAR(16) NOT NULL DEFAULT 'not_requested', ADD `reply_audio_updated_at` DATETIME(3) NULL",
    ]);

    const columns = getMetadataArgsStorage().columns;
    expect(
      columns.find(
        (column) => column.target === StoryPage && column.propertyName === 'narrationAudioKey',
      )?.options,
    ).toMatchObject({ name: 'narration_audio_key', type: 'varchar', length: 512, nullable: true });
    expect(
      columns.find(
        (column) => column.target === StoryCharacter && column.propertyName === 'ttsVoiceId',
      )?.options,
    ).toMatchObject({ name: 'tts_voice_id', type: 'varchar', length: 128, nullable: true });
    expect(
      columns.find(
        (column) => column.target === StoryCharacter && column.propertyName === 'ttsSettings',
      )?.options,
    ).toMatchObject({ name: 'tts_settings', type: 'json', nullable: true });
    expect(
      columns.find(
        (column) => column.target === StoryPageChat && column.propertyName === 'replyAudioStatus',
      )?.options,
    ).toMatchObject({
      name: 'reply_audio_status',
      type: 'varchar',
      length: 16,
      default: 'not_requested',
    });
    expect(
      columns.find(
        (column) =>
          column.target === StoryPageChat && column.propertyName === 'replyAudioUpdatedAt',
      )?.options,
    ).toMatchObject({
      name: 'reply_audio_updated_at',
      type: 'datetime',
      precision: 3,
      nullable: true,
    });
  });

  it('rollback은 추가한 컬럼만 역순으로 제거한다', async () => {
    const query = jest.fn().mockResolvedValue(undefined);
    await migration.down({ query } as unknown as QueryRunner);

    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      'ALTER TABLE `story_page_chats` DROP COLUMN `reply_audio_updated_at`, DROP COLUMN `reply_audio_status`, DROP COLUMN `reply_audio_key`',
      'ALTER TABLE `story_characters` DROP COLUMN `tts_settings`, DROP COLUMN `tts_voice_id`',
      'ALTER TABLE `story_pages` DROP COLUMN `narration_audio_key`',
    ]);
  });
});
