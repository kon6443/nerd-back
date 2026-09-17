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
import type { StoragePort } from '@common/port/storage.port';

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
  let storage: jest.Mocked<StoragePort>;
  let service: StoryService;

  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    templates = createMockRepository<StoryTemplate>();
    pages = createMockRepository<StoryPage>();
    characters = createMockRepository<StoryCharacter>();
    pageCharacters = createMockRepository<StoryPageCharacter>();
    storage = {
      upload: jest.fn(),
      getPresignedUrl: jest
        .fn()
        .mockImplementation(async (key: string) => `https://storage.local/${key}`),
      download: jest.fn(),
      delete: jest.fn(),
    };

    service = new StoryService(
      asRepository(templates),
      asRepository(pages),
      asRepository(characters),
      asRepository(pageCharacters),
      storage,
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
          coverImageUrl: 'https://storage.local/covers/lrrh.png',
        },
      ]);
      expect(storage.getPresignedUrl).toHaveBeenCalledWith(
        'covers/lrrh.png',
        3600,
        expect.any(Date),
      );
    });

    it('공개 표지는 5분 경계에서만 서명 시각이 바뀌고 표지 교체는 즉시 반영한다', async () => {
      jest.useFakeTimers({ now: new Date('2026-09-17T13:00:01Z') });
      templates.find.mockResolvedValue([PUBLISHED_TEMPLATE]);
      await service.listPublished();
      jest.setSystemTime(new Date('2026-09-17T13:04:59Z'));
      await service.listPublished();
      expect(storage.getPresignedUrl.mock.calls[1]).toEqual(storage.getPresignedUrl.mock.calls[0]);
      expect(storage.getPresignedUrl.mock.calls[0][2]).toEqual(new Date('2026-09-17T13:00:00Z'));

      templates.find.mockResolvedValue([createStoryTemplate({ coverImageKey: 'covers/new.webp' })]);
      await service.listPublished();
      expect(storage.getPresignedUrl).toHaveBeenLastCalledWith(
        'covers/new.webp',
        3600,
        new Date('2026-09-17T13:00:00Z'),
      );

      jest.setSystemTime(new Date('2026-09-17T13:05:00Z'));
      await service.listPublished();
      expect(storage.getPresignedUrl).toHaveBeenLastCalledWith(
        'covers/new.webp',
        3600,
        new Date('2026-09-17T13:05:00Z'),
      );
    });

    it('표지 키가 없으면 URL은 null이고 스토리지를 호출하지 않는다', async () => {
      templates.find.mockResolvedValue([createStoryTemplate({ coverImageKey: null })]);

      await expect(service.listPublished()).resolves.toEqual([
        expect.objectContaining({ coverImageKey: null, coverImageUrl: null }),
      ]);
      expect(storage.getPresignedUrl).not.toHaveBeenCalled();
    });

    it('한 표지의 URL 발급 실패가 다른 표지나 목록 조회를 실패시키지 않는다', async () => {
      templates.find.mockResolvedValue([
        PUBLISHED_TEMPLATE,
        createStoryTemplate({
          id: 8,
          slug: 'jack-and-beanstalk',
          coverImageKey: 'covers/jack.png',
        }),
      ]);
      storage.getPresignedUrl.mockRejectedValueOnce(new Error('storage unavailable'));

      await expect(service.listPublished()).resolves.toEqual([
        expect.objectContaining({ coverImageUrl: null }),
        expect.objectContaining({ coverImageUrl: 'https://storage.local/covers/jack.png' }),
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
      expect(storage.getPresignedUrl).not.toHaveBeenCalled();
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
      expect(result).toMatchObject({ coverImageUrl: 'https://storage.local/covers/lrrh.png' });
      expect(result.characters).toEqual([
        { role: 'wolf', displayName: '늑대' },
        { role: 'protagonist', displayName: '빨간 모자' },
      ]);
      // 프롬프트 설계가 새어나가면 본편 스포일러와 우회 질문의 재료가 된다 (NFR-002).
      expect(JSON.stringify(result)).not.toContain('persona');
    });

    it('표지 URL 발급 실패 시에도 상세 메타데이터를 반환한다', async () => {
      templates.findOneBy.mockResolvedValue(PUBLISHED_TEMPLATE);
      pages.countBy.mockResolvedValue(6);
      characters.find.mockResolvedValue([]);
      storage.getPresignedUrl.mockRejectedValueOnce(new Error('storage unavailable'));

      await expect(service.getPublishedDetail(PUBLISHED_TEMPLATE.slug)).resolves.toMatchObject({
        slug: PUBLISHED_TEMPLATE.slug,
        coverImageUrl: null,
        pageCount: 6,
      });
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
      expect(result[1].characters).toEqual([{ role: 'wolf', displayName: '늑대', hitbox: null }]);
    });

    it('단건 조회와 같은 모양을 낸다 ⭐', async () => {
      // 두 API 가 다른 모양을 내면 리더가 어느 쪽으로 받았는지에 따라 갈린다.
      const page = createStoryPage({ id: 41, pageNo: 3, baseImageKey: 'pages/lrrh-3.png' });
      const appearance = createStoryPageCharacter({
        pageId: 41,
        character: createStoryCharacter(),
      });

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
          character: createStoryCharacter({
            id: 12,
            role: 'protagonist',
            displayName: '빨간 모자',
          }),
        }),
      ]);

      const result = await service.getPublishedPage('little-red-riding-hood', 3);

      expect(result).toEqual({
        pageNo: 3,
        bodyText: '늑대가 숲에서 빨간 모자를 만났습니다.',
        baseImageKey: 'pages/lrrh-3.png',
        baseImageUrl: 'https://storage.local/pages/lrrh-3.png',
        narrationAudioUrl: null,
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

    it('기본 삽화는 5분 고정 윈도우 서명 URL로 발급하고 키가 없으면 null이다', async () => {
      jest.useFakeTimers({ now: new Date('2026-09-17T13:00:01Z') });
      templates.findOneBy.mockResolvedValue(PUBLISHED_TEMPLATE);
      pages.findOneBy.mockResolvedValue(
        createStoryPage({ pageNo: 1, baseImageKey: 'pages/red-1.webp' }),
      );
      pageCharacters.find.mockResolvedValue([]);

      const result = await service.getPublishedPage('little-red-riding-hood', 1);

      expect(result.baseImageUrl).toBe('https://storage.local/pages/red-1.webp');
      expect(storage.getPresignedUrl).toHaveBeenCalledWith(
        'pages/red-1.webp',
        3600,
        new Date('2026-09-17T13:00:00Z'),
      );

      pages.findOneBy.mockResolvedValue(
        createStoryPage({ pageNo: 1, baseImageKey: null }),
      );
      const nullResult = await service.getPublishedPage('little-red-riding-hood', 1);
      expect(nullResult.baseImageUrl).toBeNull();

      pages.findOneBy.mockResolvedValue(
        createStoryPage({ pageNo: 1, baseImageKey: '   ' }),
      );
      const spaceResult = await service.getPublishedPage('little-red-riding-hood', 1);
      expect(spaceResult.baseImageUrl).toBeNull();
    });

    it('기본 삽화 URL 발급 실패는 본문 조회를 실패시키지 않고 null로 내린다', async () => {
      templates.findOneBy.mockResolvedValue(PUBLISHED_TEMPLATE);
      pages.findOneBy.mockResolvedValue(
        createStoryPage({ baseImageKey: 'pages/fail.webp' }),
      );
      pageCharacters.find.mockResolvedValue([]);
      storage.getPresignedUrl.mockRejectedValueOnce(new Error('storage unavailable'));

      const result = await service.getPublishedPage('little-red-riding-hood', 1);
      expect(result.baseImageUrl).toBeNull();
      expect(result.bodyText).toBeDefined();
    });

    it('낭독 키는 서명 URL로 바꾸고 오브젝트 키를 응답에 노출하지 않는다', async () => {
      templates.findOneBy.mockResolvedValue(PUBLISHED_TEMPLATE);
      pages.findOneBy.mockResolvedValue(
        createStoryPage({
          baseImageKey: null,
          narrationAudioKey: 'prod/narration/red/page-3.mp3',
        }),
      );
      pageCharacters.find.mockResolvedValue([]);
      storage.getPresignedUrl.mockResolvedValueOnce('https://storage.local/red-3.mp3?signed=1');

      const result = await service.getPublishedPage('little-red-riding-hood', 3);

      expect(result.narrationAudioUrl).toBe('https://storage.local/red-3.mp3?signed=1');
      expect(storage.getPresignedUrl).toHaveBeenCalledWith('prod/narration/red/page-3.mp3');
      expect(JSON.stringify(result)).not.toContain('prod/narration');
    });

    it('낭독 URL 발급 실패는 본문 조회를 실패시키지 않고 null로 내린다', async () => {
      templates.findOneBy.mockResolvedValue(PUBLISHED_TEMPLATE);
      pages.findOneBy.mockResolvedValue(
        createStoryPage({
          baseImageKey: null,
          narrationAudioKey: 'prod/narration/red/page-3.mp3',
        }),
      );
      pageCharacters.find.mockResolvedValue([]);
      storage.getPresignedUrl.mockRejectedValueOnce(new Error('storage unavailable'));

      await expect(service.getPublishedPage('little-red-riding-hood', 3)).resolves.toMatchObject({
        narrationAudioUrl: null,
        bodyText: expect.any(String),
      });
    });

    it('기본 삽화와 낭독 음성이 모두 존재하면 두 서명 URL을 함께 반환한다', async () => {
      templates.findOneBy.mockResolvedValue(PUBLISHED_TEMPLATE);
      pages.findOneBy.mockResolvedValue(
        createStoryPage({
          pageNo: 1,
          baseImageKey: 'pages/red-1.webp',
          narrationAudioKey: 'audio/red-1.mp3',
        }),
      );
      pageCharacters.find.mockResolvedValue([]);

      const result = await service.getPublishedPage('little-red-riding-hood', 1);

      expect(result.baseImageUrl).toBe('https://storage.local/pages/red-1.webp');
      expect(result.narrationAudioUrl).toBe('https://storage.local/audio/red-1.mp3');
    });
  });
});
