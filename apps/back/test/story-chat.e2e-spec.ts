import { createHmac } from 'node:crypto';
import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { API_PREFIX } from '@common/constants/app.constants';
import { createMockRepository } from '@common/__spec__/mock-repository';
import { AuthGuard } from '@common/guards/auth.guard';
import { LLM_PORT } from '@common/port/llm.port';
import { TEXT_TO_SPEECH_PORT } from '@common/port/textToSpeechPort';
import { STORAGE_PORT } from '@common/port/storage.port';
import {
  createStoryCharacter,
  createStoryPage,
  createStoryPageCharacter,
  createStoryPageChat,
  createStoryTemplate,
  createStorySession,
  STORY_SESSION_ID,
  createUser,
} from '@entities/__spec__/entity.factory';
import { StoryCharacter } from '@entities/story-character.entity';
import { StoryPage } from '@entities/story-page.entity';
import { StoryPageCharacter } from '@entities/story-page-character.entity';
import { StoryPageChat } from '@entities/story-page-chat.entity';
import { StorySession } from '@entities/story-session.entity';
import { StoryTemplate } from '@entities/story-template.entity';
import { User } from '@entities/user.entity';
import { SessionService, SESSION_COOKIE } from '@modules/auth/session.service';
import { StoryChatController } from '@modules/story/story-chat.controller';
import { StoryChatService } from '@modules/story/story-chat.service';
import { StoryChatContextService } from '@modules/story/story-chat-context.service';
import { createE2eApp, E2E_SESSION_SECRET } from './helpers/e2e-app';

const SESSIONS_PATH = `/${API_PREFIX}/sessions`;
const OTHER_SESSION_ID = '22222222-2222-4222-8222-222222222222';
const PATH = `${SESSIONS_PATH}/${STORY_SESSION_ID}/pages/1/chat`;
const INPUT = { role: 'wolf', message: '지금 어떤 기분이야?' };

describe('등장인물 대화 HTTP 계약', () => {
  let app: INestApplication;
  const templates = createMockRepository<StoryTemplate>();
  const pages = createMockRepository<StoryPage>();
  const characters = createMockRepository<StoryCharacter>();
  const appearances = createMockRepository<StoryPageCharacter>();
  const chats = createMockRepository<StoryPageChat>();
  const sessions = createMockRepository<StorySession>();
  const users = createMockRepository<User>();
  const llm = { isAvailable: jest.fn(), complete: jest.fn() };
  const textToSpeech = { isAvailable: jest.fn().mockReturnValue(false), synthesize: jest.fn() };
  const storage = {
    upload: jest.fn(),
    getPresignedUrl: jest.fn(),
    download: jest.fn(),
    delete: jest.fn(),
  };
  let rows: Map<string, StoryPageChat>;
  let ownedBooks: Map<string, StorySession>;

  beforeEach(async () => {
    jest.clearAllMocks();
    rows = new Map();
    ownedBooks = new Map([
      [STORY_SESSION_ID, createStorySession()],
      [OTHER_SESSION_ID, createStorySession({ id: OTHER_SESSION_ID, userId: 2 })],
    ]);
    sessions.findOne.mockImplementation(
      ({ where }: { where: { id: string; userId: number; template: { status: string } } }) => {
        const book = ownedBooks.get(where.id);
        return Promise.resolve(
          book?.userId === where.userId && book.template.status === where.template.status
            ? book
            : null,
        );
      },
    );
    sessions.find.mockImplementation(
      ({ where }: { where: { userId: number; template: { status: string } } }) =>
        Promise.resolve(
          [...ownedBooks.values()].filter(
            (book) =>
              book.userId === where.userId && book.template.status === where.template.status,
          ),
        ),
    );
    sessions.save.mockImplementation((input: Partial<StorySession>) => {
      if (
        [...ownedBooks.values()].some(
          (book) => book.userId === input.userId && book.templateId === input.templateId,
        )
      )
        return Promise.reject({ driverError: { errno: 1062 } });
      const book = createStorySession({ ...input, createdAt: new Date() });
      ownedBooks.set(book.id, book);
      return Promise.resolve(book);
    });
    templates.findOneBy.mockResolvedValue(createStoryTemplate());
    pages.findOneBy.mockResolvedValue(createStoryPage());
    pages.countBy.mockResolvedValue(4);
    characters.find.mockResolvedValue([createStoryCharacter()]);
    appearances.find.mockResolvedValue([
      createStoryPageCharacter({ character: createStoryCharacter() }),
    ]);
    characters.findOne.mockImplementation(({ where }: { where: { role: string } }) =>
      Promise.resolve(where.role === 'wolf' ? createStoryCharacter() : null),
    );
    appearances.findOneBy.mockResolvedValue(createStoryPageCharacter());
    users.findOneBy.mockImplementation(({ id }: { id: number }) =>
      Promise.resolve(createUser({ id })),
    );
    llm.isAvailable.mockReturnValue(true);
    llm.complete.mockResolvedValue({
      text: '조금 설레는 기분이야.',
      usage: { model: 'openai/gpt-5.6-luna', inputTokens: 100, outputTokens: 20, elapsedMs: 1 },
    });
    chats.save.mockImplementation((input: Partial<StoryPageChat>) => {
      const key = `${input.sessionId}:${input.pageId}`;
      if (rows.has(key)) return Promise.reject({ driverError: { errno: 1062 } });
      const row = createStoryPageChat({ ...input, id: rows.size + 1, createdAt: new Date() });
      rows.set(key, row);
      return Promise.resolve(row);
    });
    chats.findOneBy.mockImplementation(
      ({ sessionId, pageId }: { sessionId: string; pageId: number }) =>
        Promise.resolve(rows.get(`${sessionId}:${pageId}`) ?? null),
    );
    chats.update.mockImplementation(
      (criteria: number | { id: number }, values: Partial<StoryPageChat>) => {
        const row = [...rows.values()].find(
          (candidate) => candidate.id === (typeof criteria === 'number' ? criteria : criteria.id),
        );
        if (row) Object.assign(row, values);
        return Promise.resolve({ affected: row ? 1 : 0 });
      },
    );
    app = await createE2eApp({
      controllers: [StoryChatController],
      providers: [
        StoryChatContextService,
        StoryChatService,
        AuthGuard,
        SessionService,
        { provide: ConfigService, useValue: new ConfigService() },
        { provide: LLM_PORT, useValue: llm },
        { provide: TEXT_TO_SPEECH_PORT, useValue: textToSpeech },
        { provide: STORAGE_PORT, useValue: storage },
        { provide: getRepositoryToken(StorySession), useValue: sessions },
        { provide: getRepositoryToken(User), useValue: users },
        { provide: getRepositoryToken(StoryTemplate), useValue: templates },
        { provide: getRepositoryToken(StoryPage), useValue: pages },
        { provide: getRepositoryToken(StoryCharacter), useValue: characters },
        { provide: getRepositoryToken(StoryPageCharacter), useValue: appearances },
        { provide: getRepositoryToken(StoryPageChat), useValue: chats },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  function cookie(userId = 1): string {
    const sid = app.get(SessionService).issue(userId);
    const signature = createHmac('sha256', E2E_SESSION_SECRET)
      .update(sid)
      .digest('base64')
      .replace(/=+$/, '');
    return `${SESSION_COOKIE}=${encodeURIComponent(`s:${sid}.${signature}`)}`;
  }

  function http() {
    return request(app.getHttpServer() as Server);
  }

  it('인증 없거나 위조 쿠키면 GET/POST 모두 401이며 비용을 소모하지 않는다', async () => {
    for (const session of ['', `${SESSION_COOKIE}=s:forged`]) {
      const get = await http().get(PATH).set('Cookie', session).expect(401);
      const post = await http().post(PATH).set('Cookie', session).send(INPUT).expect(401);
      expect(get.body.code).toBe('UNAUTHORIZED');
      expect(post.body.code).toBe('UNAUTHORIZED');
    }
    expect(llm.complete).not.toHaveBeenCalled();
    expect(chats.save).not.toHaveBeenCalled();
  });

  it('GET 1회 → POST 201 → GET 저장된 답변 → 중복 409이며 다른 사용자에게 노출하지 않는다', async () => {
    const first = await http().get(PATH).set('Cookie', cookie()).expect(200);
    expect(first.headers['cache-control']).toContain('no-store');
    expect(first.body.data).toMatchObject({
      status: 'available',
      remainingMessages: 1,
      exchange: null,
    });
    const sent = await http().post(PATH).set('Cookie', cookie()).send(INPUT).expect(201);
    expect(sent.body.data).toMatchObject({
      status: 'completed',
      remainingMessages: 0,
      exchange: { message: INPUT.message, reply: '조금 설레는 기분이야.' },
    });
    const restored = await http().get(PATH).set('Cookie', cookie()).expect(200);
    expect(restored.body).toEqual(sent.body);
    expect(JSON.stringify(restored.body)).not.toMatch(/persona|userId|pageId|능글맞/);
    const duplicate = await http().post(PATH).set('Cookie', cookie()).send(INPUT).expect(409);
    expect(duplicate.body.code).toBe('STORY_CHAT_ALREADY_USED');
    const other = await http()
      .get(PATH.replace(STORY_SESSION_ID, OTHER_SESSION_ID))
      .set('Cookie', cookie(2))
      .expect(200);
    expect(other.body.data).toMatchObject({ remainingMessages: 1, exchange: null });
    expect(llm.complete).toHaveBeenCalledTimes(1);
  });

  it.each([
    { role: 'wolf', message: ' ' },
    { role: 'wolf', message: '가'.repeat(301) },
    { ...INPUT, userId: 2 },
    { ...INPUT, persona: 'fake' },
    { ...INPUT, model: 'expensive-model' },
    { message: '질문' },
  ])('잘못된 입력과 서버 값 위조를 400으로 막는다', async (input) => {
    const result = await http().post(PATH).set('Cookie', cookie()).send(input).expect(400);
    expect(result.body.code).toBe('VALIDATION_FAILED');
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('300자 입력을 허용하고 현재 장면 밖 캐릭터는 404로 거절한다', async () => {
    const invalid = await http()
      .post(PATH)
      .set('Cookie', cookie())
      .send({ ...INPUT, role: 'absent' })
      .expect(404);
    expect(invalid.body.code).toBe('STORY_CHARACTER_NOT_FOUND');
    expect(llm.complete).not.toHaveBeenCalled();
    await http()
      .post(PATH)
      .set('Cookie', cookie())
      .send({ ...INPUT, message: '가'.repeat(300) })
      .expect(201);
  });

  it('미공개 동화·없는 페이지·잘못된 페이지 번호를 구분해 검증한다', async () => {
    await http().get(PATH.replace('/pages/1/', '/pages/0/')).set('Cookie', cookie()).expect(400);
    sessions.findOne.mockResolvedValueOnce(null);
    const draft = await http().post(PATH).set('Cookie', cookie()).send(INPUT).expect(404);
    expect(draft.body.code).toBe('SESSION_NOT_FOUND');
    pages.findOneBy.mockResolvedValueOnce(null);
    const missing = await http().post(PATH).set('Cookie', cookie()).send(INPUT).expect(404);
    expect(missing.body.code).toBe('STORY_PAGE_NOT_FOUND');
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('타인 동화와 없는 동화는 본문·대화 모두 같은 404이며 비용을 소모하지 않는다', async () => {
    for (const id of [STORY_SESSION_ID, '33333333-3333-4333-8333-333333333333']) {
      const pagePath = `${SESSIONS_PATH}/${id}/pages/1`;
      for (const path of [`${pagePath}/chat`]) {
        const response = await http().get(path).set('Cookie', cookie(2)).expect(404);
        expect(response.body.code).toBe('SESSION_NOT_FOUND');
      }
      const sent = await http()
        .post(`${pagePath}/chat`)
        .set('Cookie', cookie(2))
        .send(INPUT)
        .expect(404);
      expect(sent.body.code).toBe('SESSION_NOT_FOUND');
    }
    expect(chats.save).not.toHaveBeenCalled();
    expect(chats.findOneBy).not.toHaveBeenCalled();
    expect(pages.findOneBy).not.toHaveBeenCalled();
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('UUID와 분기 경로는 검증하며 A/B의 6쪽은 별도 장면으로 예약한다', async () => {
    await http().get(PATH.replace(STORY_SESSION_ID, 'invalid')).set('Cookie', cookie()).expect(400);
    await http().get(`${PATH}?branchKey=other`).set('Cookie', cookie()).expect(400);
    expect(chats.save).not.toHaveBeenCalled();
    pages.findOneBy.mockImplementation(
      ({ pageNo, branchKey }: { pageNo: number; branchKey: string }) =>
        Promise.resolve(
          pageNo === 6 && (branchKey === 'a' || branchKey === 'b')
            ? createStoryPage({ id: branchKey === 'a' ? 61 : 62, pageNo: 6, branchKey })
            : null,
        ),
    );
    const branchPath = PATH.replace('/pages/1/', '/pages/6/');
    await http().get(branchPath).set('Cookie', cookie()).expect(404);
    for (const branchKey of ['a', 'b']) {
      await http()
        .post(`${branchPath}?branchKey=${branchKey}`)
        .set('Cookie', cookie())
        .send(INPUT)
        .expect(201);
      await http()
        .post(`${branchPath}?branchKey=${branchKey}`)
        .set('Cookie', cookie())
        .send(INPUT)
        .expect(409);
    }
    expect(llm.complete).toHaveBeenCalledTimes(2);
    expect([...rows.values()].map((row) => row.pageId)).toEqual([61, 62]);
  });

  it('공용 원작의 이전 채팅 경로는 더 이상 제공하지 않는다', async () => {
    const old = `/${API_PREFIX}/stories/little-red-riding-hood/pages/1/chat`;
    await http().get(old).set('Cookie', cookie()).expect(404);
    await http().post(old).set('Cookie', cookie()).send(INPUT).expect(404);
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('모델 설정이 없으면 POST 503이며 횟수를 예약하지 않는다', async () => {
    llm.isAvailable.mockReturnValue(false);
    const result = await http().post(PATH).set('Cookie', cookie()).send(INPUT).expect(503);
    expect(result.body.code).toBe('STORY_CHAT_UNAVAILABLE');
    expect(chats.save).not.toHaveBeenCalled();
  });
});
