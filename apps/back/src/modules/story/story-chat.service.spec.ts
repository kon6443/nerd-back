import { Logger } from '@nestjs/common';
import { asRepository, createMockRepository } from '@common/__spec__/mock-repository';
import type { LlmPort } from '@common/port/llm.port';
import type { TextToSpeechPort } from '@common/port/textToSpeechPort';
import type { StoragePort } from '@common/port/storage.port';
import {
  FIXED_DATE,
  createStoryCharacter,
  createStoryPage,
  createStoryPageChat,
  createStorySession,
  STORY_SESSION_ID,
} from '@entities/__spec__/entity.factory';
import type { StoryPageChat } from '@entities/story-page-chat.entity';
import { StoryChatService } from './story-chat.service';
import { StoryChatContextService } from './story-chat-context.service';
import { SessionNotFoundErrorResponseDto } from '@modules/story-session/dto/story-session-error.dto';
import type { StorySession } from '@entities/story-session.entity';
import {
  StoryCharacterNotFoundErrorResponseDto,
  StoryChatAlreadyUsedErrorResponseDto,
  StoryChatUnavailableErrorResponseDto,
} from './dto/story-chat.error.dto';

const OTHER_SESSION_ID = '22222222-2222-4222-8222-222222222222';
const INPUT = { role: 'wolf', message: '지금 어떤 기분이야?' };
const COMPLETION = {
  text: '빨간 모자를 만나서 조금 들떴어. 어디로 가는지 궁금해.',
  usage: { model: 'openai/gpt-5.6-luna', inputTokens: 100, outputTokens: 40, elapsedMs: 10 },
};

const flushBackgroundWork = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('페이지당 1회 대화', () => {
  const chats = createMockRepository<StoryPageChat>();
  const sessionRows = createMockRepository<StorySession>();
  const stories = new StoryChatContextService(
    asRepository(sessionRows),
    asRepository(createMockRepository()),
    asRepository(createMockRepository()),
    asRepository(createMockRepository()),
  );
  const llm: jest.Mocked<LlmPort> = { isAvailable: jest.fn(), complete: jest.fn() };
  const textToSpeech: jest.Mocked<TextToSpeechPort> = {
    isAvailable: jest.fn(),
    synthesize: jest.fn(),
  };
  const storage: jest.Mocked<StoragePort> = {
    upload: jest.fn(),
    getPresignedUrl: jest.fn(),
    download: jest.fn(),
    delete: jest.fn(),
  };
  const service = new StoryChatService(
    stories,
    asRepository(chats),
    llm,
    textToSpeech,
    storage,
  );
  let rows: Map<string, StoryPageChat>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Date, 'now').mockReturnValue(FIXED_DATE.getTime());
    jest.spyOn(stories, 'findPage').mockResolvedValue(createStoryPage());
    jest
      .spyOn(stories, 'getChatContext')
      .mockResolvedValue({ page: createStoryPage(), character: createStoryCharacter() });
    jest
      .spyOn(stories, 'listCharacters')
      .mockResolvedValue([{ role: 'wolf', displayName: '늑대' }]);
    llm.isAvailable.mockReturnValue(true);
    llm.complete.mockResolvedValue(COMPLETION);
    textToSpeech.isAvailable.mockReturnValue(false);
    textToSpeech.synthesize.mockResolvedValue({
      audio: Buffer.from('reply-audio'),
      mimeType: 'audio/mpeg',
    });
    storage.upload.mockResolvedValue('prod/chat-audio/reply.mp3');
    storage.getPresignedUrl.mockResolvedValue('https://storage.local/chat.mp3');
    storage.delete.mockResolvedValue(undefined);
    sessionRows.findOne.mockImplementation(
      ({ where }: { where: { id: string; userId: number } }) => {
        const owner = where.id === STORY_SESSION_ID ? 1 : where.id === OTHER_SESSION_ID ? 2 : 0;
        return Promise.resolve(
          owner === where.userId ? createStorySession({ id: where.id, userId: owner }) : null,
        );
      },
    );
    rows = new Map();
    // UNIQUE 위반을 모델링한다. 실제 MySQL 동작 검증이 아니라 서비스의 중복·실패 경로 검증이다.
    chats.save.mockImplementation((input: Partial<StoryPageChat>) => {
      const key = `${input.sessionId}:${input.pageId}`;
      if (rows.has(key)) return Promise.reject({ driverError: { errno: 1062 } });
      const row = createStoryPageChat({ ...input, id: rows.size + 1 });
      rows.set(key, row);
      return Promise.resolve(row);
    });
    chats.findOneBy.mockImplementation(
      ({ sessionId, pageId }: { sessionId: string; pageId: number }) =>
        Promise.resolve(rows.get(`${sessionId}:${pageId}`) ?? null),
    );
    chats.update.mockImplementation(
      (
        criteria: number | { id: number; status?: string; replyAudioStatus?: string },
        patch: Partial<StoryPageChat>,
      ) => {
        const row = [...rows.values()].find(
          (candidate) => candidate.id === (typeof criteria === 'number' ? criteria : criteria.id),
        );
        if (
          !row ||
          (typeof criteria !== 'number' &&
            ((criteria.status !== undefined && row.status !== criteria.status) ||
              (criteria.replyAudioStatus !== undefined &&
                row.replyAudioStatus !== criteria.replyAudioStatus)))
        )
          return Promise.resolve({ affected: 0 });
        Object.assign(row, patch);
        return Promise.resolve({ affected: 1 });
      },
    );
  });

  it('질문 전 1회를 표시하고 저장된 질문·답변을 재방문에 복원한다', async () => {
    expect(await service.get(1, STORY_SESSION_ID, 1)).toEqual({
      characters: [{ role: 'wolf', displayName: '늑대' }],
      status: 'available',
      remainingMessages: 1,
      exchange: null,
    });
    const sent = await service.send(1, STORY_SESSION_ID, 1, INPUT);
    expect(sent).toEqual({
      characters: [{ role: 'wolf', displayName: '늑대' }],
      status: 'completed',
      remainingMessages: 0,
      exchange: {
        ...INPUT,
        displayName: '늑대',
        reply: COMPLETION.text,
        replyAudioUrl: null,
        replyAudioStatus: 'not_requested',
      },
    });
    expect(await service.get(1, STORY_SESSION_ID, 1)).toEqual(sent);
    expect(llm.complete).toHaveBeenCalledTimes(1);
    expect(stories.getChatContext).toHaveBeenCalledWith(1, 1, INPUT.role, 'common');
    expect(chats.save).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: STORY_SESSION_ID, userId: 1, pageId: 31 }),
    );
    expect(Logger.prototype.log).toHaveBeenCalledWith(COMPLETION.usage);
  });

  it('동시 제출·다른 캐릭터로 재제출해도 LLM은 1회만 호출한다', async () => {
    let resolve: ((value: typeof COMPLETION) => void) | undefined;
    llm.complete.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const first = service.send(1, STORY_SESSION_ID, 1, INPUT);
    await expect(
      service.send(1, STORY_SESSION_ID, 1, { ...INPUT, role: 'protagonist' }),
    ).rejects.toBeInstanceOf(StoryChatAlreadyUsedErrorResponseDto);
    expect(await service.get(1, STORY_SESSION_ID, 1)).toMatchObject({
      status: 'pending',
      remainingMessages: 0,
    });
    resolve?.(COMPLETION);
    await first;
    await expect(service.send(1, STORY_SESSION_ID, 1, INPUT)).rejects.toBeInstanceOf(
      StoryChatAlreadyUsedErrorResponseDto,
    );
    expect(llm.complete).toHaveBeenCalledTimes(1);
  });

  it('다른 소유자의 동화와 다른 페이지는 별도 1회를 가진다', async () => {
    await service.send(1, STORY_SESSION_ID, 1, INPUT);
    expect(await service.get(2, OTHER_SESSION_ID, 1)).toMatchObject({
      status: 'available',
      exchange: null,
    });
    await service.send(2, OTHER_SESSION_ID, 1, INPUT);
    jest.spyOn(stories, 'getChatContext').mockResolvedValue({
      page: createStoryPage({ id: 32, pageNo: 2 }),
      character: createStoryCharacter(),
    });
    await service.send(1, STORY_SESSION_ID, 2, INPUT);
    expect(llm.complete).toHaveBeenCalledTimes(3);
  });

  it('타인 동화·없는 동화는 대화 조회·예약·AI 호출 전에 차단한다', async () => {
    await expect(service.get(2, STORY_SESSION_ID, 1)).rejects.toBeInstanceOf(
      SessionNotFoundErrorResponseDto,
    );
    await expect(service.send(2, STORY_SESSION_ID, 1, INPUT)).rejects.toBeInstanceOf(
      SessionNotFoundErrorResponseDto,
    );
    await expect(
      service.send(1, '33333333-3333-4333-8333-333333333333', 1, INPUT),
    ).rejects.toBeInstanceOf(SessionNotFoundErrorResponseDto);
    expect(chats.findOneBy).not.toHaveBeenCalled();
    expect(chats.save).not.toHaveBeenCalled();
    expect(stories.getChatContext).not.toHaveBeenCalled();
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('등장인물 검증 실패와 DB 예약 실패에는 AI를 호출하지 않는다', async () => {
    jest
      .spyOn(stories, 'getChatContext')
      .mockRejectedValueOnce(new StoryCharacterNotFoundErrorResponseDto());
    await expect(service.send(1, STORY_SESSION_ID, 1, INPUT)).rejects.toBeInstanceOf(
      StoryCharacterNotFoundErrorResponseDto,
    );
    expect(chats.save).not.toHaveBeenCalled();
    chats.save.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.send(1, STORY_SESSION_ID, 1, INPUT)).rejects.toBeInstanceOf(
      StoryChatUnavailableErrorResponseDto,
    );
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('키 미설정은 횟수를 소모하지 않고 기존 대화는 계속 조회된다', async () => {
    llm.isAvailable.mockReturnValue(false);
    expect(await service.get(1, STORY_SESSION_ID, 1)).toMatchObject({
      status: 'unavailable',
      remainingMessages: 1,
    });
    await expect(service.send(1, STORY_SESSION_ID, 1, INPUT)).rejects.toBeInstanceOf(
      StoryChatUnavailableErrorResponseDto,
    );
    expect(chats.save).not.toHaveBeenCalled();
    rows.set(
      `${STORY_SESSION_ID}:31`,
      createStoryPageChat({ status: 'completed', reply: COMPLETION.text }),
    );
    expect(await service.get(1, STORY_SESSION_ID, 1)).toMatchObject({
      status: 'completed',
      remainingMessages: 0,
    });
  });

  it('AI 실패 후 횟수 복구·자동 재시도 없이 실패를 표시한다', async () => {
    llm.complete.mockRejectedValueOnce(new Error('provider body must stay private'));
    const result = await service.send(1, STORY_SESSION_ID, 1, INPUT);
    expect(result).toMatchObject({
      status: 'failed',
      remainingMessages: 0,
      exchange: { reply: null },
    });
    expect(JSON.stringify(result)).not.toContain('provider');
    await expect(service.send(1, STORY_SESSION_ID, 1, INPUT)).rejects.toBeInstanceOf(
      StoryChatAlreadyUsedErrorResponseDto,
    );
    expect(llm.complete).toHaveBeenCalledTimes(1);
  });

  it('답변 텍스트를 pending 음성 상태로 먼저 반환하고 생성된 MP3를 저장·재사용한다', async () => {
    textToSpeech.isAvailable.mockReturnValue(true);
    jest.spyOn(stories, 'getChatContext').mockResolvedValue({
      page: createStoryPage(),
      character: createStoryCharacter({
        ttsVoiceId: 'Kore',
        ttsSettings: { audioTag: '[whispers]' },
      }),
    });

    const sent = await service.send(1, STORY_SESSION_ID, 1, INPUT);
    expect(sent.exchange).toMatchObject({
      reply: COMPLETION.text,
      replyAudioStatus: 'pending',
      replyAudioUrl: null,
    });
    expect(textToSpeech.synthesize).not.toHaveBeenCalled();

    await flushBackgroundWork();

    expect(textToSpeech.synthesize).toHaveBeenCalledWith({
      text: COMPLETION.text,
      voiceId: 'Kore',
      settings: { audioTag: '[whispers]' },
    });
    expect(storage.upload).toHaveBeenCalledWith(
      expect.stringMatching(
        new RegExp(`^chat-audio/${STORY_SESSION_ID}/31/1-[0-9a-f-]+\\.mp3$`),
      ),
      Buffer.from('reply-audio'),
      'audio/mpeg',
    );
    expect(await service.get(1, STORY_SESSION_ID, 1)).toMatchObject({
      exchange: {
        replyAudioStatus: 'completed',
        replyAudioUrl: 'https://storage.local/chat.mp3',
      },
    });
    expect(textToSpeech.synthesize).toHaveBeenCalledTimes(1);
  });

  it('TTS 실패는 답변 텍스트를 유지하고 음성만 failed로 바꾼다', async () => {
    textToSpeech.isAvailable.mockReturnValue(true);
    textToSpeech.synthesize.mockRejectedValueOnce(new Error('private provider response'));
    jest.spyOn(stories, 'getChatContext').mockResolvedValue({
      page: createStoryPage(),
      character: createStoryCharacter({ ttsVoiceId: 'Kore' }),
    });

    const sent = await service.send(1, STORY_SESSION_ID, 1, INPUT);
    expect(sent.exchange?.replyAudioStatus).toBe('pending');
    await flushBackgroundWork();

    expect(await service.get(1, STORY_SESSION_ID, 1)).toMatchObject({
      status: 'completed',
      exchange: { reply: COMPLETION.text, replyAudioStatus: 'failed', replyAudioUrl: null },
    });
  });

  it('실패 음성의 동시 재시도는 한 번만 선점하고 LLM 답변은 다시 만들지 않는다', async () => {
    textToSpeech.isAvailable.mockReturnValue(true);
    const chat = createStoryPageChat({
      status: 'completed',
      reply: COMPLETION.text,
      replyAudioStatus: 'failed',
      replyAudioUpdatedAt: FIXED_DATE,
    });
    rows.set(`${STORY_SESSION_ID}:31`, chat);
    jest.spyOn(stories, 'getChatContext').mockResolvedValue({
      page: createStoryPage(),
      character: createStoryCharacter({ ttsVoiceId: 'Kore' }),
    });

    const first = await service.retryAudio(1, STORY_SESSION_ID, 1);
    const second = await service.retryAudio(1, STORY_SESSION_ID, 1);

    expect(first.exchange?.replyAudioStatus).toBe('pending');
    expect(second.exchange?.replyAudioStatus).toBe('pending');
    await flushBackgroundWork();
    expect(textToSpeech.synthesize).toHaveBeenCalledTimes(1);
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('완료 음성의 URL 발급 실패는 채팅 조회를 실패시키지 않는다', async () => {
    rows.set(
      `${STORY_SESSION_ID}:31`,
      createStoryPageChat({
        status: 'completed',
        reply: COMPLETION.text,
        replyAudioKey: 'prod/chat-audio/reply.mp3',
        replyAudioStatus: 'completed',
      }),
    );
    storage.getPresignedUrl.mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(service.get(1, STORY_SESSION_ID, 1)).resolves.toMatchObject({
      exchange: { replyAudioStatus: 'completed', replyAudioUrl: null },
    });
  });

  it('답변 저장 실패와 실패 표시 저장 실패에도 예약을 보존한다', async () => {
    chats.update.mockRejectedValue(new Error('database lost'));
    await expect(service.send(1, STORY_SESSION_ID, 1, INPUT)).rejects.toBeInstanceOf(
      StoryChatUnavailableErrorResponseDto,
    );
    await expect(service.send(1, STORY_SESSION_ID, 1, INPUT)).rejects.toBeInstanceOf(
      StoryChatAlreadyUsedErrorResponseDto,
    );
    expect(llm.complete).toHaveBeenCalledTimes(1);
  });

  it('완료 저장 후 ACK만 유실되면 저장된 답변을 복구하고 실패로 덮어쓰지 않는다', async () => {
    chats.update.mockImplementationOnce(() => {
      const row = rows.get(`${STORY_SESSION_ID}:31`);
      if (row) Object.assign(row, { status: 'completed', reply: COMPLETION.text });
      return Promise.reject(new Error('ack lost'));
    });
    expect(await service.send(1, STORY_SESSION_ID, 1, INPUT)).toMatchObject({
      status: 'completed',
      remainingMessages: 0,
      exchange: { reply: COMPLETION.text },
    });
    expect(llm.complete).toHaveBeenCalledTimes(1);
  });

  it('서버 중단으로 남은 예약은 무한 대기 대신 실패를 표시하며 재호출하지 않는다', async () => {
    rows.set(
      `${STORY_SESSION_ID}:31`,
      createStoryPageChat({ createdAt: new Date(FIXED_DATE.getTime() - 61_000) }),
    );
    expect(await service.get(1, STORY_SESSION_ID, 1)).toMatchObject({
      status: 'failed',
      remainingMessages: 0,
    });
    await expect(service.send(1, STORY_SESSION_ID, 1, INPUT)).rejects.toBeInstanceOf(
      StoryChatAlreadyUsedErrorResponseDto,
    );
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('현재 장면과 persona만 제한된 크기로 전달하고 질문을 별도 입력으로 둔다', async () => {
    jest.spyOn(stories, 'getChatContext').mockResolvedValue({
      page: createStoryPage({ bodyText: '가'.repeat(6000) + '장면초과' }),
      character: createStoryCharacter({ persona: '나'.repeat(2000) + '성격초과' }),
    });
    await service.send(1, STORY_SESSION_ID, 1, INPUT);
    const call = llm.complete.mock.calls[0]?.[0];
    expect(call).toMatchObject({ prompt: INPUT.message, maxOutputTokens: 300 });
    expect(call?.system).toContain('미래 전개나 결말');
    expect(call?.system).not.toContain('장면초과');
    expect(call?.system).not.toContain('성격초과');
    expect(call?.system).not.toContain(INPUT.message);
  });
});
