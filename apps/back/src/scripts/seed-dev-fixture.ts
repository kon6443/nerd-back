import { DataSource, type EntityManager } from 'typeorm';
import { buildMysqlConnectionOptions } from '../common/database/typeorm.options';
import { validateDbEnv } from '../config/env.validation';
import { StoryCharacter } from '../entities/story-character.entity';
import { StoryPageCharacter } from '../entities/story-page-character.entity';
import { StoryPage } from '../entities/story-page.entity';
import { STORY_TEMPLATE_STATUS, StoryTemplate } from '../entities/story-template.entity';
import { DEV_FIXTURE_STORY, type DevFixtureStory } from './dev-fixture';

/**
 * 개발용 픽스처 투입 스크립트.
 *
 *   pnpm db:seed:dev            # draft 로 넣는다 (공개 목록에 안 보인다)
 *   pnpm db:seed:dev --publish  # published 로 넣는다 (서재에 보인다)
 *
 * 🚫 **실행은 사람이 한다.** 전 환경이 같은 DB 라 실행이 곧 상용 DB 쓰기다
 * (마이그레이션과 같은 이유, `apps/back/CLAUDE.md` Never).
 * 🚫 자동 실행(부팅·CI)에 걸지 않는다.
 *
 * **계정은 앱 계정(`DB_USER`)이다.** 마이그레이션과 다르다 — 이건 DDL 이 아니라 행 쓰기라
 * `nerd_app` 의 권한으로 충분하고, 그래야 DDL 권한이 이 경로로 새지 않는다.
 * 🚫 `DB_MIGRATION_*` 를 쓰지 않는다.
 *
 * 상대 경로 import 를 쓰는 이유: `data-source.ts` 와 같다 — tsconfig-paths 없이 빌드
 * 산출물로 직접 돌린다.
 */

/** 🚫 이 접두사 밖의 행은 절대 건드리지 않는다 — 실 콘텐츠를 지울 수 있는 유일한 경로를 막는다. */
function assertDevSlug(story: DevFixtureStory): void {
  if (!story.slug.startsWith('dev-')) {
    throw new Error(
      `픽스처 slug 는 'dev-' 로 시작해야 한다 (받은 값: ${story.slug}).\n` +
        '  이 스크립트는 같은 slug 의 기존 콘텐츠를 덮어쓴다. 접두사가 없으면 실 콘텐츠를 지울 수 있다.',
    );
  }
}

/**
 * 멱등하게 다시 넣는다 — 같은 slug 의 페이지·등장인물을 지우고 새로 쓴다.
 *
 * "있으면 건너뛴다" 로 만들지 않은 이유: 픽스처 본문을 고쳐도 반영되지 않아, 고친 사람이
 * 왜 안 바뀌는지 찾게 된다. 지우고 다시 쓰는 편이 결과가 항상 파일과 같다.
 */
async function upsertStory(manager: EntityManager, story: DevFixtureStory, publish: boolean) {
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

  // 하위 행은 통째로 갈아 끼운다. `story_page_characters` 는 FK 가 CASCADE 라 함께 사라진다.
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

      // dev-fixture.spec.ts 가 이미 막지만, 스크립트를 단독으로 읽는 사람에게도 보이게 둔다.
      if (pageId === undefined || characterId === undefined) {
        throw new Error(`픽스처 정합성 오류 — page ${page.pageNo} 의 배역 ${appearance.role}`);
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
  const publish = process.argv.includes('--publish');
  assertDevSlug(DEV_FIXTURE_STORY);

  const dataSource = new DataSource({
    ...buildMysqlConnectionOptions(validateDbEnv(process.env)),
    entities: [StoryTemplate, StoryPage, StoryCharacter, StoryPageCharacter],
  });

  await dataSource.initialize();
  try {
    const result = await dataSource.transaction((manager) =>
      upsertStory(manager, DEV_FIXTURE_STORY, publish),
    );

    console.log(
      `픽스처 투입 완료 — ${DEV_FIXTURE_STORY.slug} (${result.status}) · ` +
        `페이지 ${result.pageCount} · 등장인물 ${result.characterCount}`,
    );
    if (!publish) {
      console.log('draft 라 공개 목록에는 보이지 않는다. 서재에 띄우려면 --publish 로 다시 실행한다.');
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
