import { HttpStatus } from '@nestjs/common';
import {
  type MockRepository,
  asRepository,
  createMockRepository,
} from '@common/__spec__/mock-repository';
import { ApiErrorResponseDto } from '@common/dto/api-error.dto';
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

/**
 * 에러 경로는 code 와 status 를 **정확히** 고정한다 (code-patterns §9).
 * 느슨하게 받으면 그 차이가 곧 방어의 유무일 때 테스트가 조용히 무력해진다.
 */
async function expectDomainError(
  promise: Promise<unknown>,
  code: string,
  status: HttpStatus,
): Promise<void> {
  const error: unknown = await promise.then(
    () => {
      throw new Error(`${code} 가 발생해야 하는데 정상 반환됐다`);
    },
    (caught: unknown) => caught,
  );

  expect(error).toBeInstanceOf(ApiErrorResponseDto);
  const domainError = error as ApiErrorResponseDto;
  expect(domainError.code).toBe(code);
  expect(domainError.getStatus()).toBe(status);
}

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

      expect(pages.findOneBy).toHaveBeenCalledWith({ templateId: 7, pageNo: 99 });
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
