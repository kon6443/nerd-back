import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoryCharacter } from '@entities/story-character.entity';
import { StoryPage } from '@entities/story-page.entity';
import { StoryPageCharacter } from '@entities/story-page-character.entity';
import { StoryTemplate } from '@entities/story-template.entity';
import { StoryController } from './story.controller';
import { StoryService } from './story.service';

/**
 * 동화 콘텐츠 조회 모듈 (Slice 1).
 *
 * `forFeature` 로 등록한 엔티티를 `autoLoadEntities: true` 가 수집한다 — 경로 glob 을 쓰지 않는
 * 이유는 `typeorm.options.ts` 주석 참조.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([StoryTemplate, StoryPage, StoryCharacter, StoryPageCharacter]),
  ],
  controllers: [StoryController],
  providers: [StoryService],
})
export class StoryModule {}
