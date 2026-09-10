import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StorySession } from '@entities/story-session.entity';
import { StoryTemplate } from '@entities/story-template.entity';
import { StoryPage } from '@entities/story-page.entity';
import { SessionPageImage } from '@entities/session-page-image.entity';
import { StoryAfterStoryChoice } from '@entities/story-after-story-choice.entity';
import { SessionBranchChoice } from '@entities/session-branch-choice.entity';
import { User } from '@entities/user.entity';
import { AuthModule } from '@modules/auth/auth.module';
import { StorySessionController } from './story-session.controller';
import { StorySessionService } from './story-session.service';
import { IMAGE_GENERATION_PORT } from '../../common/port/image-generation.port';
import { STORAGE_PORT } from '../../common/port/storage.port';
import { MockImageAdapter } from '../../common/adapters/mock-image.adapter';
import { OpenRouterImageAdapter } from '../../common/adapters/openrouter-image.adapter';
import { S3StorageAdapter } from '../../common/adapters/s3-storage.adapter';
import { LocalStorageAdapter } from '../../common/adapters/local-storage.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StorySession,
      StoryTemplate,
      StoryPage,
      SessionPageImage,
      StoryAfterStoryChoice,
      SessionBranchChoice,
      User,
    ]),
    ConfigModule,
    AuthModule,
  ],
  controllers: [StorySessionController],
  providers: [
    StorySessionService,
    MockImageAdapter,
    OpenRouterImageAdapter,
    S3StorageAdapter,
    LocalStorageAdapter,
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
    {
      provide: STORAGE_PORT,
      useFactory: (
        config: ConfigService,
        s3: S3StorageAdapter,
        local: LocalStorageAdapter,
      ) => {
        const provider = config.get<string>('STORAGE_PROVIDER');
        return provider === 's3' ? s3 : local;
      },
      inject: [ConfigService, S3StorageAdapter, LocalStorageAdapter],
    },
  ],
  exports: [StorySessionService],
})
export class StorySessionModule {}
