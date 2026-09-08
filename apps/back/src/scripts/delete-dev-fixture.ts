import { DataSource } from 'typeorm';
import { buildMysqlConnectionOptions } from '../common/database/typeorm.options';
import { validateDbEnv } from '../config/env.validation';
import { StoryCharacter } from '../entities/story-character.entity';
import { StoryPageCharacter } from '../entities/story-page-character.entity';
import { StoryPage } from '../entities/story-page.entity';
import { StoryTemplate } from '../entities/story-template.entity';
import { StorySession } from '../entities/story-session.entity';
import { SessionPageImage } from '../entities/session-page-image.entity';

import { User } from '../entities/user.entity';

/**
 * 개발용 픽스처(dev-cloud-village) DB 제거 스크립트.
 *
 *   pnpm db:clean:dev
 */
async function main(): Promise<void> {
  const targetSlug = 'dev-cloud-village';

  const dataSource = new DataSource({
    ...buildMysqlConnectionOptions(validateDbEnv(process.env)),
    entities: [
      User,
      StoryTemplate,
      StoryPage,
      StoryCharacter,
      StoryPageCharacter,
      StorySession,
      SessionPageImage,
    ],
  });

  await dataSource.initialize();
  try {
    await dataSource.transaction(async (manager) => {
      const templateRepo = manager.getRepository(StoryTemplate);
      const template = await templateRepo.findOneBy({ slug: targetSlug });

      if (!template) {
        console.log(`템플릿 '${targetSlug}' 이(가) DB에 존재하지 않습니다.`);
        return;
      }

      // 1. 연관된 story_sessions 및 session_page_images 삭제
      const sessionRepo = manager.getRepository(StorySession);
      const pageImageRepo = manager.getRepository(SessionPageImage);
      const sessions = await sessionRepo.findBy({ templateId: template.id });

      for (const session of sessions) {
        await pageImageRepo.delete({ sessionId: session.id });
      }
      if (sessions.length > 0) {
        await sessionRepo.delete({ templateId: template.id });
        console.log(`연관 세션 ${sessions.length}건 삭제 완료`);
      }

      // 2. 연관된 story_pages 및 story_page_characters 삭제
      const pageRepo = manager.getRepository(StoryPage);
      const pageCharRepo = manager.getRepository(StoryPageCharacter);
      const pages = await pageRepo.findBy({ templateId: template.id });

      for (const page of pages) {
        await pageCharRepo.delete({ pageId: page.id });
      }
      if (pages.length > 0) {
        await pageRepo.delete({ templateId: template.id });
        console.log(`연관 페이지 ${pages.length}건 삭제 완료`);
      }

      // 3. 연관된 story_characters 삭제
      const charRepo = manager.getRepository(StoryCharacter);
      const chars = await charRepo.findBy({ templateId: template.id });
      if (chars.length > 0) {
        await charRepo.delete({ templateId: template.id });
        console.log(`연관 등장인물 ${chars.length}건 삭제 완료`);
      }

      // 4. 템플릿 본체 삭제
      await templateRepo.delete({ id: template.id });
      console.log(`템플릿 '${targetSlug}' 삭제 완료!`);
    });
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
