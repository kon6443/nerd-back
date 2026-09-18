import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StorySession } from '@entities/story-session.entity';
import { StoryTemplate } from '@entities/story-template.entity';
import { StoryPage } from '@entities/story-page.entity';
import { StoryPageCharacter } from '@entities/story-page-character.entity';
import { SessionPageImage } from '@entities/session-page-image.entity';
import { StoryAfterStoryChoice } from '@entities/story-after-story-choice.entity';
import { SessionBranchChoice } from '@entities/session-branch-choice.entity';
import { StoryPageChat } from '@entities/story-page-chat.entity';
import { User } from '@entities/user.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { StorySessionController } from './story-session.controller';
import { StorySessionService } from './story-session.service';
import { IMAGE_GENERATION_PORT } from '../../common/port/image-generation.port';
import { MockImageAdapter } from '../../common/adapters/mock-image.adapter';
import { OpenRouterImageAdapter } from '../../common/adapters/openrouter-image.adapter';
import { StorageModule } from '../../common/storage/storageModule';
import { StorageCleanupModule } from '../../common/storage/storage-cleanup.module';
import { NotificationModule } from '../../common/notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StorySession,
      StoryTemplate,
      StoryPage,
      StoryPageCharacter,
      SessionPageImage,
      StoryAfterStoryChoice,
      SessionBranchChoice,
      StoryPageChat,
      User,
    ]),
    ConfigModule,
    StorageModule,
    StorageCleanupModule,
    NotificationModule,
    AuthModule,
  ],
  controllers: [StorySessionController],
  providers: [
    StorySessionService,
    MockImageAdapter,
    OpenRouterImageAdapter,
    {
      provide: IMAGE_GENERATION_PORT,
      useFactory: (
        config: ConfigService,
        mock: MockImageAdapter,
        openRouter: OpenRouterImageAdapter,
      ) => {
        const provider = config.get<string>('IMAGE_PROVIDER');
        return provider === 'openrouter' ? openRouter : mock;
      },
      inject: [ConfigService, MockImageAdapter, OpenRouterImageAdapter],
    },
  ],
  exports: [StorySessionService],
})
export class StorySessionModule {}
