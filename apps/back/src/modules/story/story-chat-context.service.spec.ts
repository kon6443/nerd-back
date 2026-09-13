import type { StorySession } from '@entities/story-session.entity';
import type { StoryPage } from '@entities/story-page.entity';
import type { StoryCharacter } from '@entities/story-character.entity';
import type { StoryPageCharacter } from '@entities/story-page-character.entity';
import { asRepository, createMockRepository } from '@common/__spec__/mock-repository';
import {
  createStoryCharacter,
  createStoryPage,
  createStoryPageCharacter,
  createStorySession,
  STORY_SESSION_ID,
} from '@entities/__spec__/entity.factory';
import { StoryChatContextService } from './story-chat-context.service';
import { SessionNotFoundErrorResponseDto } from '@modules/story-session/dto/story-session-error.dto';
import { StoryPageNotFoundErrorResponseDto } from './dto/story.error.dto';
import { StoryCharacterNotFoundErrorResponseDto } from './dto/story-chat.error.dto';

describe('채팅의 기존 개인 동화·분기 장면 조회', () => {
  const sessions = createMockRepository<StorySession>();
  const pages = createMockRepository<StoryPage>();
  const characters = createMockRepository<StoryCharacter>();
  const appearances = createMockRepository<StoryPageCharacter>();
  const context = new StoryChatContextService(
    asRepository(sessions),
    asRepository(pages),
    asRepository(characters),
    asRepository(appearances),
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('본인과 공개 템플릿을 함께 조회하고 없는 동화는 같은 404로 처리한다', async () => {
    sessions.findOne.mockResolvedValueOnce(createStorySession()).mockResolvedValueOnce(null);
    expect((await context.findOwned(1, STORY_SESSION_ID)).id).toBe(STORY_SESSION_ID);
    expect(sessions.findOne).toHaveBeenCalledWith({
      where: { id: STORY_SESSION_ID, userId: 1, template: { status: 'published' } },
      relations: { template: true },
    });
    await expect(context.findOwned(2, STORY_SESSION_ID)).rejects.toBeInstanceOf(
      SessionNotFoundErrorResponseDto,
    );
    expect(pages.findOneBy).not.toHaveBeenCalled();
  });

  it('페이지 번호가 같아도 선택한 분기의 페이지 ID를 사용한다', async () => {
    pages.findOneBy
      .mockResolvedValueOnce(createStoryPage({ id: 62, pageNo: 6, branchKey: 'b' }))
      .mockResolvedValueOnce(null);
    expect((await context.findPage(1, 6, 'b')).id).toBe(62);
    expect(pages.findOneBy).toHaveBeenCalledWith({ templateId: 1, pageNo: 6, branchKey: 'b' });
    await expect(context.findPage(1, 6, 'common')).rejects.toBeInstanceOf(
      StoryPageNotFoundErrorResponseDto,
    );
  });

  it('목록에는 persona를 제외하고 등장인물 없는 장면은 빈 목록이다', async () => {
    appearances.find
      .mockResolvedValueOnce([createStoryPageCharacter({ character: createStoryCharacter() })])
      .mockResolvedValueOnce([]);
    expect(await context.listCharacters(31)).toEqual([{ role: 'wolf', displayName: '늑대' }]);
    expect(await context.listCharacters(32)).toEqual([]);
  });

  it('등장인물의 persona는 서버에서만 읽고 해당 분기의 출연 여부를 검사한다', async () => {
    pages.findOneBy.mockResolvedValue(createStoryPage({ id: 62, pageNo: 6, branchKey: 'b' }));
    characters.findOne.mockResolvedValue(createStoryCharacter());
    appearances.findOneBy
      .mockResolvedValueOnce(createStoryPageCharacter())
      .mockResolvedValueOnce(null);
    const result = await context.getChatContext(1, 6, 'wolf', 'b');
    expect(result.character.persona).toBe('능글맞고 말이 많다.');
    expect(characters.findOne).toHaveBeenCalledWith({
      where: { templateId: 1, role: 'wolf' },
      select: { id: true, role: true, displayName: true, persona: true },
    });
    expect(appearances.findOneBy).toHaveBeenCalledWith({ pageId: 62, characterId: 11 });
    await expect(context.getChatContext(1, 6, 'wolf', 'b')).rejects.toBeInstanceOf(
      StoryCharacterNotFoundErrorResponseDto,
    );
  });
});
