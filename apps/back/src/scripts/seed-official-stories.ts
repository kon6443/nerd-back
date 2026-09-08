import { DataSource, type EntityManager } from 'typeorm';
import { buildMysqlConnectionOptions } from '../common/database/typeorm.options';
import { validateDbEnv } from '../config/env.validation';
import { StoryCharacter } from '../entities/story-character.entity';
import { StoryPageCharacter } from '../entities/story-page-character.entity';
import { StoryPage } from '../entities/story-page.entity';
import { STORY_TEMPLATE_STATUS, StoryTemplate } from '../entities/story-template.entity';
import { OFFICIAL_STORIES, type OfficialStoryData } from './official-stories';

/**
 * 정식 동화 템플릿(잭과 콩나무, 빨간 모자) 투입 스크립트.
 *
 *   pnpm db:seed:stories           # 기본 published 로 서재에 바로 노출
 *   pnpm db:seed:stories --draft   # draft 로 저장 (비공개)
 */

async function upsertOfficialStory(
  manager: EntityManager,
  story: OfficialStoryData,
  publish: boolean,
) {
  const templates = manager.getRepository(StoryTemplate);
  const status = publish ? STORY_TEMPLATE_STATUS.PUBLISHED : STORY_TEMPLATE_STATUS.DRAFT;

  const existing = await templates.findOneBy({ slug: story.slug });
  const template = await templates.save(
    templates.create({
      ...(existing === null ? {} : { id: existing.id }),
      slug: story.slug,
      title: story.title,
      summary: story.summary,
      coverImageKey: null,
      status,
    }),
  );

  // 하위 행 교체: 기존 페이지와 등장인물 삭제
  await manager.getRepository(StoryPage).delete({ templateId: template.id });
  await manager.getRepository(StoryCharacter).delete({ templateId: template.id });

  const characters = await manager.getRepository(StoryCharacter).save(
    story.characters.map((character) =>
      manager.getRepository(StoryCharacter).create({
        templateId: template.id,
        role: character.role,
        displayName: character.displayName,
        persona: character.persona,
      }),
    ),
  );
  const characterIdByRole = new Map(characters.map((character) => [character.role, character.id]));

  const pages = await manager.getRepository(StoryPage).save(
    story.pages.map((page) =>
      manager.getRepository(StoryPage).create({
        templateId: template.id,
        pageNo: page.pageNo,
        bodyText: page.bodyText,
        baseImageKey: null,
        personaTargetRole: page.personaTargetRole,
      }),
    ),
  );
  const pageIdByNo = new Map(pages.map((page) => [page.pageNo, page.id]));

  const links = story.pages.flatMap((page) =>
    page.characters.map((appearance) => {
      const pageId = pageIdByNo.get(page.pageNo);
      const characterId = characterIdByRole.get(appearance.role);

      if (pageId === undefined || characterId === undefined) {
        throw new Error(`정식 동화 정합성 오류 — page ${page.pageNo} 의 배역 ${appearance.role}`);
      }

      return manager
        .getRepository(StoryPageCharacter)
        .create({ pageId, characterId, hitbox: appearance.hitbox });
    }),
  );
  await manager.getRepository(StoryPageCharacter).save(links);

  return { status, pageCount: pages.length, characterCount: characters.length };
}

async function main(): Promise<void> {
  // 기본값은 published (서재 노출). --draft 명시 시 draft 로 저장.
  const isDraft = process.argv.includes('--draft');
  const publish = !isDraft;

  const dataSource = new DataSource({
    ...buildMysqlConnectionOptions(validateDbEnv(process.env)),
    entities: [StoryTemplate, StoryPage, StoryCharacter, StoryPageCharacter],
  });

  await dataSource.initialize();
  try {
    for (const story of OFFICIAL_STORIES) {
      const result = await dataSource.transaction((manager) =>
        upsertOfficialStory(manager, story, publish),
      );

      console.log(
        `동화 투입 완료 — [${story.title}] ${story.slug} (${result.status}) · ` +
          `페이지 ${result.pageCount} · 등장인물 ${result.characterCount}`,
      );
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
