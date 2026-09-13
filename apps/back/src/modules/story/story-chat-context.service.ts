import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { StoryCharacterSummary, StoryChatBranchKey } from '@nerd/contracts';
import { StorySession } from '@entities/story-session.entity';
import { StoryPage } from '@entities/story-page.entity';
import { StoryCharacter } from '@entities/story-character.entity';
import { StoryPageCharacter } from '@entities/story-page-character.entity';
import { STORY_TEMPLATE_STATUS } from '@entities/story-template.entity';
import { SessionNotFoundErrorResponseDto } from '@modules/story-session/dto/story-session-error.dto';
import { StoryPageNotFoundErrorResponseDto } from './dto/story.error.dto';
import { StoryCharacterNotFoundErrorResponseDto } from './dto/story-chat.error.dto';

export interface StoryChatContext {
  page: StoryPage;
  character: StoryCharacter;
}

/** 기존 제작 세션을 읽기만 한다. 소유권 확인 전에는 장면·대화·모델에 접근하지 않는다. */
@Injectable()
export class StoryChatContextService {
  constructor(
    @InjectRepository(StorySession) private readonly sessions: Repository<StorySession>,
    @InjectRepository(StoryPage) private readonly pages: Repository<StoryPage>,
    @InjectRepository(StoryCharacter) private readonly characters: Repository<StoryCharacter>,
    @InjectRepository(StoryPageCharacter)
    private readonly appearances: Repository<StoryPageCharacter>,
  ) {}

  async findOwned(userId: number, sessionId: string): Promise<StorySession> {
    const session = await this.sessions.findOne({
      where: { id: sessionId, userId, template: { status: STORY_TEMPLATE_STATUS.PUBLISHED } },
      relations: { template: true },
    });
    if (!session) throw new SessionNotFoundErrorResponseDto();
    return session;
  }

  async findPage(
    templateId: number,
    pageNo: number,
    branchKey: StoryChatBranchKey,
  ): Promise<StoryPage> {
    const page = await this.pages.findOneBy({ templateId, pageNo, branchKey });
    if (!page) throw new StoryPageNotFoundErrorResponseDto();
    return page;
  }

  async listCharacters(pageId: number): Promise<StoryCharacterSummary[]> {
    const appearances = await this.appearances.find({
      where: { pageId },
      relations: { character: true },
      order: { id: 'ASC' },
    });
    return appearances.map(({ character }) => ({
      role: character.role,
      displayName: character.displayName,
    }));
  }

  /** persona를 명시적으로 읽는 유일한 경로. 현재 장면의 출연 여부를 확인한다. */
  async getChatContext(
    templateId: number,
    pageNo: number,
    role: string,
    branchKey: StoryChatBranchKey,
  ): Promise<StoryChatContext> {
    const page = await this.findPage(templateId, pageNo, branchKey);
    const character = await this.characters.findOne({
      where: { templateId, role },
      select: { id: true, role: true, displayName: true, persona: true },
    });
    if (
      !character ||
      !(await this.appearances.findOneBy({ pageId: page.id, characterId: character.id }))
    ) {
      throw new StoryCharacterNotFoundErrorResponseDto();
    }
    return { page, character };
  }
}
