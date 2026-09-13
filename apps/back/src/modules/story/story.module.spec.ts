import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createMockRepository } from '@common/__spec__/mock-repository';
import { User } from '@entities/user.entity';
import { StoryTemplate } from '@entities/story-template.entity';
import { StoryPage } from '@entities/story-page.entity';
import { StoryCharacter } from '@entities/story-character.entity';
import { StoryPageCharacter } from '@entities/story-page-character.entity';
import { StorySession } from '@entities/story-session.entity';
import { StoryPageChat } from '@entities/story-page-chat.entity';
import { StoryChatController } from './story-chat.controller';
import { StoryModule } from './story.module';

@Global()
@Module({
  providers: [{ provide: ConfigService, useValue: new ConfigService({ ENV: 'LOCAL' }) }],
  exports: [ConfigService],
})
class TestConfigModule {}

describe('StoryModule 실제 의존성 구성', () => {
  it('DB·외부 AI 없이 인증과 채팅 컨트롤러를 구성한다', async () => {
    const builder = Test.createTestingModule({ imports: [TestConfigModule, StoryModule] });
    // forFeature의 repository provider만 대체한다. AuthGuard/SessionService를 직접 주입하면
    // 프로덕션 모듈의 imports 누락을 HTTP 서비스 테스트처럼 놓치게 된다.
    for (const entity of [
      User,
      StoryTemplate,
      StoryPage,
      StoryCharacter,
      StoryPageCharacter,
      StorySession,
      StoryPageChat,
    ]) {
      builder.overrideProvider(getRepositoryToken(entity)).useValue(createMockRepository());
    }
    const module = await builder.compile();
    try {
      expect(module.get(StoryChatController)).toBeInstanceOf(StoryChatController);
    } finally {
      await module.close();
    }
  });
});
