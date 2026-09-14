import { HttpStatus } from '@nestjs/common';
import {
  type MockRepository,
  asRepository,
  createMockRepository,
} from '@common/__spec__/mock-repository';
import { expectDomainError } from '@common/__spec__/expect-domain-error';
import {
  createStoryCharacter,
  createStoryPage,
  createStoryPageCharacter,
  createStoryTemplate,
} from '@entities/__spec__/entity.factory';
import type { StoryCharacter } from '@entities/story-character.entity';
import type { StoryPage } from '@entities/story-page.entity';
import type { StoryPageCharacter } from '@entities/story-page-character.entity';
import { STORY_TEMPLATE_STATUS, type StoryTemplate } from '@entities/story-template.entity';
import { StoryService } from './story.service';

const PUBLISHED_TEMPLATE = createStoryTemplate({ id: 7 });

/**
 * 실 DB 에 붙지 않는다 — `forbid-db` 매퍼가 어떤 경로로든 접속을 막는다 (code-patterns §9).
 * 여기서 검증하는 것은 **조회 조건과 응답 매핑**이지 SQL 이 아니다.
 */
describe('StoryService', () => {
  let templates: MockRepository<StoryTemplate>;
  let pages: MockRepository<StoryPage>;
  let characters: MockRepository<StoryCharacter>;
  let pageCharacters: MockRepository<StoryPageCharacter>;
  let service: StoryService;

  beforeEach(() => {
    templates = createMockRepository<StoryTemplate>();
    pages = createMockRepository<StoryPage>();
    characters = createMockRepository<StoryCharacter>();
    pageCharacters = createMockRepository<StoryPageCharacter>();

    service = new StoryService(
      asRepository(templates),
      asRepository(pages),
      asRepository(characters),
      asRepository(pageCharacters),
    );
  });

  describe('listPublished', () => {
    it('published 조건으로만 조회한다 ⭐', async () => {
      // 이 조건이 빠지면 제작 중인 동화가 목록에 노출된다.
      templates.find.mockResolvedValue([]);

      await service.listPublished();

      expect(templates.find).toHaveBeenCalledWith({
        where: { status: STORY_TEMPLATE_STATUS.PUBLISHED },
        order: { id: 'ASC' },
      });
    });

    it('내부 id 와 status 를 응답에 담지 않는다', async () => {
      templates.find.mockResolvedValue([PUBLISHED_TEMPLATE]);

      const result = await service.listPublished();

      expect(result).toEqual([
        {
          slug: 'little-red-riding-hood',
          title: '빨간 모자',
          summary: '숲을 지나 할머니 댁으로',
          coverImageKey: 'covers/lrrh.png',
        },
      ]);
    });
  });

  describe('getPublishedDetail', () => {
    it('없거나 미공개면 STORY_NOT_FOUND · 404 다 ⭐', async () => {
      // 미공개를 403 이나 다른 코드로 구분해 알려주면 slug 를 바꿔가며 존재를 확인할 수 있다.
      templates.findOneBy.mockResolvedValue(null);

      await expectDomainError(
        service.getPublishedDetail('unknown'),
        'STORY_NOT_FOUND',
        HttpStatus.NOT_FOUND,
      );

      expect(templates.findOneBy).toHaveBeenCalledWith({
        slug: 'unknown',
        status: STORY_TEMPLATE_STATUS.PUBLISHED,
      });
    });

    it('페이지 수와 등장인물을 담되 persona 는 담지 않는다 ⭐', async () => {
      templates.findOneBy.mockResolvedValue(PUBLISHED_TEMPLATE);
      pages.countBy.mockResolvedValue(12);
      characters.find.mockResolvedValue([
        createStoryCharacter({ role: 'wolf', displayName: '늑대' }),
        createStoryCharacter({ id: 12, role: 'protagonist', displayName: '빨간 모자' }),
      ]);

      const result = await service.getPublishedDetail('little-red-riding-hood');

      expect(result.pageCount).toBe(12);
      expect(result.characters).toEqual([
        { role: 'wolf', displayName: '늑대' },
        { role: 'protagonist', displayName: '빨간 모자' },
      ]);
      // 프롬프트 설계가 새어나가면 본편 스포일러와 우회 질문의 재료가 된다 (NFR-002).
      expect(JSON.stringify(result)).not.toContain('persona');
    });
  });

  describe('listPublishedPages', () => {
    it('동화가 없으면 STORY_NOT_FOUND 다', async () => {
      templates.findOneBy.mockResolvedValue(null);

      await expectDomainError(
        service.listPublishedPages('unknown'),
        'STORY_NOT_FOUND',
        HttpStatus.NOT_FOUND,
      );

      expect(pages.find).not.toHaveBeenCalled();
    });

    it('본편만 쪽 순서로 조회한다 ⭐', async () => {
      // 🚫 비하인드(a/b)가 섞여 들어오면 리더가 6쪽을 두 번 그린다.
      templates.findOneBy.mockResolvedValue(PUBLISHED_TEMPLATE);
      pages.find.mockResolvedValue([]);

      const result = await service.listPublishedPages('little-red-riding-hood');

      expect(pages.find).toHaveBeenCalledWith({
        where: { templateId: 7, branchKey: 'common' },
        order: { pageNo: 'ASC' },
      });
      expect(result).toEqual([]);
      // 쪽이 없으면 등장인물을 물을 이유가 없다.
      expect(pageCharacters.find).not.toHaveBeenCalled();
    });

    it('등장인물을 쪽마다 묻지 않고 한 번에 긁어 온다 ⭐', async () => {
      // 이 한 번이 이 API 의 존재 이유다. 쪽마다 물으면 쪽 수만큼 쿼리가 늘어난다.
      templates.findOneBy.mockResolvedValue(PUBLISHED_TEMPLATE);
      pages.find.mockResolvedValue([
        createStoryPage({ id: 41, pageNo: 1 }),
        createStoryPage({ id: 42, pageNo: 2 }),
      ]);
      pageCharacters.find.mockResolvedValue([]);

      await service.listPublishedPages('little-red-riding-hood');

      expect(pageCharacters.find).toHaveBeenCalledTimes(1);
      const [[query]] = pageCharacters.find.mock.calls;
      expect(query.relations).toEqual({ character: true });
      expect(query.order).toEqual({ id: 'ASC' });
      // In([41, 42]) — 연산자 내부 값만 확인한다.
      expect(JSON.stringify(query.where)).toContain('41');
      expect(JSON.stringify(query.where)).toContain('42');
    });

    it('등장인물을 자기 쪽에만 붙인다 ⭐', async () => {
      // 그룹핑이 틀리면 2쪽 인물이 1쪽에 나타나 "이 장면에 없는 인물과 대화" 가 열린다.
      templates.findOneBy.mockResolvedValue(PUBLISHED_TEMPLATE);
      pages.find.mockResolvedValue([
        createStoryPage({ id: 41, pageNo: 1, bodyText: '첫 쪽' }),
        createStoryPage({ id: 42, pageNo: 2, bodyText: '둘째 쪽' }),
      ]);
      pageCharacters.find.mockResolvedValue([
        createStoryPageCharacter({
          id: 201,
          pageId: 42,
          hitbox: null,
          character: createStoryCharacter({ id: 12, role: 'wolf', displayName: '늑대' }),
        }),
      ]);

      const result = await service.listPublishedPages('little-red-riding-hood');

      expect(result.map((page) => page.pageNo)).toEqual([1, 2]);
      expect(result[0].characters).toEqual([]);
      expect(result[1].characters).toEqual([
        { role: 'wolf', displayName: '늑대', hitbox: null },
      ]);
    });

    it('단건 조회와 같은 모양을 낸다 ⭐', async () => {
      // 두 API 가 다른 모양을 내면 리더가 어느 쪽으로 받았는지에 따라 갈린다.
      const page = createStoryPage({ id: 41, pageNo: 3, baseImageKey: 'pages/lrrh-3.png' });
      const appearance = createStoryPageCharacter({ pageId: 41, character: createStoryCharacter() });

      templates.findOneBy.mockResolvedValue(PUBLISHED_TEMPLATE);
      pages.find.mockResolvedValue([page]);
      pageCharacters.find.mockResolvedValue([appearance]);
      const [fromList] = await service.listPublishedPages('little-red-riding-hood');

      templates.findOneBy.mockResolvedValue(PUBLISHED_TEMPLATE);
      pages.findOneBy.mockResolvedValue(page);
      pageCharacters.find.mockResolvedValue([appearance]);
      const single = await service.getPublishedPage('little-red-riding-hood', 3);

      expect(fromList).toEqual(single);
    });
  });

  describe('getPublishedPage', () => {
    it('동화가 없으면 STORY_NOT_FOUND 다', async () => {
      templates.findOneBy.mockResolvedValue(null);

      await expectDomainError(
        service.getPublishedPage('unknown', 1),
        'STORY_NOT_FOUND',
        HttpStatus.NOT_FOUND,
      );

      expect(pages.findOneBy).not.toHaveBeenCalled();
    });

    it('동화는 있고 페이지만 없으면 STORY_PAGE_NOT_FOUND 다 ⭐', async () => {
      // 두 에러의 구분이 프론트와의 계약이다. 하나로 합치면 "마지막 페이지 도달"과
      // "잘못된 동화"를 클라이언트가 구분할 수 없다.
      templates.findOneBy.mockResolvedValue(PUBLISHED_TEMPLATE);
      pages.findOneBy.mockResolvedValue(null);

      await expectDomainError(
        service.getPublishedPage('little-red-riding-hood', 99),
        'STORY_PAGE_NOT_FOUND',
        HttpStatus.NOT_FOUND,
      );

      expect(pages.findOneBy).toHaveBeenCalledWith({
        templateId: 7,
        pageNo: 99,
        branchKey: 'common',
      });
    });

    it('본문·개인화 대상 배역·대화 가능 캐릭터를 매핑한다', async () => {
      templates.findOneBy.mockResolvedValue(PUBLISHED_TEMPLATE);
      pages.findOneBy.mockResolvedValue(
        createStoryPage({ pageNo: 3, baseImageKey: 'pages/lrrh-3.png' }),
      );
      pageCharacters.find.mockResolvedValue([
        // 이 테스트는 `character` 관계를 실제로 쓰므로 명시한다 — 팩토리 기본값은 UNSET 이다.
        createStoryPageCharacter({ character: createStoryCharacter() }),
        createStoryPageCharacter({
          id: 102,
          hitbox: null,
          character: createStoryCharacter({ id: 12, role: 'protagonist', displayName: '빨간 모자' }),
        }),
      ]);

      const result = await service.getPublishedPage('little-red-riding-hood', 3);

      expect(result).toEqual({
        pageNo: 3,
        bodyText: '늑대가 숲에서 빨간 모자를 만났습니다.',
        baseImageKey: 'pages/lrrh-3.png',
        personaTargetRole: 'protagonist',
        characters: [
          {
            role: 'wolf',
            displayName: '늑대',
            hitbox: { x: 0.4, y: 0.55, width: 0.2, height: 0.3 },
          },
          { role: 'protagonist', displayName: '빨간 모자', hitbox: null },
        ],
      });
    });
  });
});
