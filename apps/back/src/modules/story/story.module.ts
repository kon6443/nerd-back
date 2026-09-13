import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoryCharacter } from '@entities/story-character.entity';
import { StoryPage } from '@entities/story-page.entity';
import { StoryPageCharacter } from '@entities/story-page-character.entity';
import { StoryTemplate } from '@entities/story-template.entity';
import { User } from '@entities/user.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { StorySession } from '@entities/story-session.entity';
import { StoryPageChat } from '@entities/story-page-chat.entity';
import { LLM_PORT } from '@common/port/llm.port';
import { StoryChatController } from './story-chat.controller';
import { StoryChatService } from './story-chat.service';
import { StoryChatContextService } from './story-chat-context.service';
import { StoryChatLlm } from './story-chat.llm';
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
    AuthModule,
    TypeOrmModule.forFeature([
      StoryTemplate,
      StoryPage,
      StoryCharacter,
      StoryPageCharacter,
      StorySession,
      StoryPageChat,
      User,
    ]),
  ],
  controllers: [StoryController, StoryChatController],
  providers: [
    StoryService,
    StoryChatService,
    StoryChatContextService,
    { provide: LLM_PORT, useClass: StoryChatLlm },
  ],
})
export class StoryModule {}
