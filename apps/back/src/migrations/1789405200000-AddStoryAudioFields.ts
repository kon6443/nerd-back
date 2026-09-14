import type { MigrationInterface, QueryRunner } from 'typeorm';

/** 정적 낭독, 캐릭터 목소리 설정, 저장된 답변 음성 필드를 추가한다. 실행은 담당자가 한다. */
export class AddStoryAudioFields1789405200000 implements MigrationInterface {
  name = 'AddStoryAudioFields1789405200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `story_pages` ADD `narration_audio_key` VARCHAR(512) NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `story_characters` ' +
        'ADD `tts_voice_id` VARCHAR(128) NULL, ADD `tts_settings` JSON NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `story_page_chats` ' +
        "ADD `reply_audio_key` VARCHAR(512) NULL, " +
        "ADD `reply_audio_status` VARCHAR(16) NOT NULL DEFAULT 'not_requested', " +
        'ADD `reply_audio_updated_at` DATETIME(3) NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `story_page_chats` DROP COLUMN `reply_audio_updated_at`, ' +
        'DROP COLUMN `reply_audio_status`, DROP COLUMN `reply_audio_key`',
    );
    await queryRunner.query(
      'ALTER TABLE `story_characters` DROP COLUMN `tts_settings`, DROP COLUMN `tts_voice_id`',
    );
    await queryRunner.query('ALTER TABLE `story_pages` DROP COLUMN `narration_audio_key`');
  }
}
