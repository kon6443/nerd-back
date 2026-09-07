import type { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { Server } from 'node:http';
import { API_PREFIX } from '@common/constants/app.constants';
import { StoryCharacter } from '@entities/story-character.entity';
import { StoryPage } from '@entities/story-page.entity';
import { StoryPageCharacter } from '@entities/story-page-character.entity';
import { StoryTemplate } from '@entities/story-template.entity';
import { StoryController } from '@modules/story/story.controller';
import { StoryService } from '@modules/story/story.service';
import { createE2eApp } from './helpers/e2e-app';

const STORIES_PATH = `/${API_PREFIX}/stories`;

function server(app: INestApplication): Server {
  return app.getHttpServer() as Server;
}

interface RepoStubs {
  templates: { find: jest.Mock; findOneBy: jest.Mock };
  pages: { findOneBy: jest.Mock; countBy: jest.Mock };
  characters: { find: jest.Mock };
  pageCharacters: { find: jest.Mock };
}

function createRepoStubs(): RepoStubs {
  return {
    templates: { find: jest.fn().mockResolvedValue([]), findOneBy: jest.fn().mockResolvedValue(null) },
    pages: { findOneBy: jest.fn().mockResolvedValue(null), countBy: jest.fn().mockResolvedValue(0) },
    characters: { find: jest.fn().mockResolvedValue([]) },
    pageCharacters: { find: jest.fn().mockResolvedValue([]) },
  };
}

/**
 * 🚫 `StoryModule` 을 import 하지 않는다 — `TypeOrmModule.forFeature` 가 실 DataSource 를 요구한다.
 * 컨트롤러·서비스만 올리고 Repository 를 토큰으로 스텁한다 (code-patterns §9).
 * 여기서 검증하는 것은 **HTTP 계약**(응답 봉투·에러 형식·전역 파이프)이다.
 */
function storyWiring(stubs: RepoStubs) {
  return {
    controllers: [StoryController],
    providers: [
      StoryService,
      { provide: getRepositoryToken(StoryTemplate), useValue: stubs.templates },
      { provide: getRepositoryToken(StoryPage), useValue: stubs.pages },
      { provide: getRepositoryToken(StoryCharacter), useValue: stubs.characters },
      { provide: getRepositoryToken(StoryPageCharacter), useValue: stubs.pageCharacters },
    ],
  };
}

describe('동화 콘텐츠 조회 (E2E)', () => {
  let app: INestApplication;
  let stubs: RepoStubs;

  beforeEach(async () => {
    stubs = createRepoStubs();
    app = await createE2eApp(storyWiring(stubs));
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /stories', () => {
    it('성공 응답은 { code, data, message } 봉투다', async () => {
      stubs.templates.find.mockResolvedValue([
        {
          id: 1,
          slug: 'cinderella',
          title: '신데렐라',
          summary: '유리구두',
          coverImageKey: 'covers/cinderella.png',
          status: 'published',
        },
      ]);

      const res = await request(server(app)).get(STORIES_PATH).expect(200);

      expect(res.body).toEqual({
        code: 'SUCCESS',
        message: '',
        data: [
          {
            slug: 'cinderella',
            title: '신데렐라',
            summary: '유리구두',
            coverImageKey: 'covers/cinderella.png',
          },
        ],
      });
    });
  });

  describe('GET /stories/:slug', () => {
    it('없는 동화는 404 · STORY_NOT_FOUND 이고 바디에 statusCode 가 없다 ⭐', async () => {
      // 에러 바디 형식은 프론트와의 계약이다. statusCode 가 끼면 분기 기준이 둘로 갈린다.
      const res = await request(server(app)).get(`${STORIES_PATH}/unknown`).expect(404);

      expect(res.body).toMatchObject({
        code: 'STORY_NOT_FOUND',
        message: '동화를 찾을 수 없습니다.',
      });
      expect(res.body.timestamp).toEqual(expect.any(String));
      expect(res.body).not.toHaveProperty('statusCode');
    });

    it('slug 형식이 어긋나면 400 · VALIDATION_FAILED 다 ⭐', async () => {
      // 전역 ValidationPipe 가 @Param() DTO 에도 실제로 걸리는지 고정한다.
      // 안 걸리면 형식 방어가 통째로 무력해지는데 정상 경로만 보면 드러나지 않는다.
      const res = await request(server(app)).get(`${STORIES_PATH}/Bad_Slug`).expect(400);

      expect(res.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      expect(stubs.templates.findOneBy).not.toHaveBeenCalled();
    });

    it('공개된 동화는 페이지 수와 등장인물을 반환한다', async () => {
      stubs.templates.findOneBy.mockResolvedValue({
        id: 4,
        slug: 'snow-white',
        title: '백설공주',
        summary: null,
        coverImageKey: null,
        status: 'published',
      });
      stubs.pages.countBy.mockResolvedValue(6);
      stubs.characters.find.mockResolvedValue([{ role: 'queen', displayName: '왕비' }]);

      const res = await request(server(app)).get(`${STORIES_PATH}/snow-white`).expect(200);

      expect(res.body.data).toEqual({
        slug: 'snow-white',
        title: '백설공주',
        summary: null,
        coverImageKey: null,
        pageCount: 6,
        characters: [{ role: 'queen', displayName: '왕비' }],
      });
    });
  });

  describe('GET /stories/:slug/pages/:pageNo', () => {
    beforeEach(() => {
      stubs.templates.findOneBy.mockResolvedValue({
        id: 4,
        slug: 'snow-white',
        title: '백설공주',
        summary: null,
        coverImageKey: null,
        status: 'published',
      });
    });

    it('pageNo 가 정수가 아니면 400 이다', async () => {
      const res = await request(server(app))
        .get(`${STORIES_PATH}/snow-white/pages/abc`)
        .expect(400);

      expect(res.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });

    it('pageNo 가 1 미만이면 400 이다', async () => {
      const res = await request(server(app)).get(`${STORIES_PATH}/snow-white/pages/0`).expect(400);

      expect(res.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    });

    it('동화는 있고 페이지만 없으면 404 · STORY_PAGE_NOT_FOUND 다 ⭐', async () => {
      // STORY_NOT_FOUND 와 구분되어야 프론트가 "마지막 페이지"와 "잘못된 동화"를 나눌 수 있다.
      const res = await request(server(app)).get(`${STORIES_PATH}/snow-white/pages/99`).expect(404);

      expect(res.body).toMatchObject({ code: 'STORY_PAGE_NOT_FOUND' });
    });

    it('본문과 대화 가능한 등장인물을 반환한다', async () => {
      stubs.pages.findOneBy.mockResolvedValue({
        id: 40,
        pageNo: 2,
        bodyText: '거울아 거울아',
        baseImageKey: 'pages/snow-white-2.png',
        personaTargetRole: 'protagonist',
      });
      stubs.pageCharacters.find.mockResolvedValue([
        {
          hitbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
          character: { role: 'queen', displayName: '왕비' },
        },
      ]);

      const res = await request(server(app)).get(`${STORIES_PATH}/snow-white/pages/2`).expect(200);

      expect(res.body.data).toEqual({
        pageNo: 2,
        bodyText: '거울아 거울아',
        baseImageKey: 'pages/snow-white-2.png',
        personaTargetRole: 'protagonist',
        characters: [
          {
            role: 'queen',
            displayName: '왕비',
            hitbox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
          },
        ],
      });
    });
  });
});
