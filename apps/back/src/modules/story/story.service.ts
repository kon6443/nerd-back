import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { StoryDetail, StoryPageView, StorySummary } from '@nerd/contracts';
import { StoryCharacter } from '@entities/story-character.entity';
import { StoryPage } from '@entities/story-page.entity';
import { StoryPageCharacter } from '@entities/story-page-character.entity';
import { STORY_TEMPLATE_STATUS, StoryTemplate } from '@entities/story-template.entity';
import { StoryNotFoundErrorResponseDto, StoryPageNotFoundErrorResponseDto } from './dto/story.error.dto';

/**
 * 사전 제작 동화 콘텐츠 조회 (SPEC-001 Library · SPEC-004 Story Reader).
 *
 * 이 서비스는 **읽기 전용**이다. 콘텐츠는 운영이 마이그레이션·SQL 로 넣는다.
 * 개인화·대화·After Story 는 별도 슬라이스가 맡는다
 * (`docs/tasks/tasks-my-story.md`).
 *
 * Repository 클래스를 따로 두지 않고 `Repository<T>` 를 직접 주입받는다 (code-patterns §1).
 */
@Injectable()
export class StoryService {
  constructor(
    @InjectRepository(StoryTemplate)
    private readonly templates: Repository<StoryTemplate>,
    @InjectRepository(StoryPage)
    private readonly pages: Repository<StoryPage>,
    @InjectRepository(StoryCharacter)
    private readonly characters: Repository<StoryCharacter>,
    @InjectRepository(StoryPageCharacter)
    private readonly pageCharacters: Repository<StoryPageCharacter>,
  ) {}

  /** 공개된 동화 목록. `draft` 는 절대 포함하지 않는다. */
  async listPublished(): Promise<StorySummary[]> {
    const templates = await this.templates.find({
      where: { status: STORY_TEMPLATE_STATUS.PUBLISHED },
      order: { id: 'ASC' },
    });

    return templates.map((template) => this.toSummary(template));
  }

  async getPublishedDetail(slug: string): Promise<StoryDetail> {
    const template = await this.findPublishedOrThrow(slug);

    const [pageCount, characters] = await Promise.all([
      this.pages.countBy({ templateId: template.id, branchKey: 'common' }),
      this.characters.find({ where: { templateId: template.id }, order: { id: 'ASC' } }),
    ]);

    return {
      ...this.toSummary(template),
      pageCount,
      // persona 는 엔티티에서 select: false 라 여기 담기지 않는다. 프롬프트 설계를 노출하지 않기 위한 것이다.
      characters: characters.map((character) => ({
        role: character.role,
        displayName: character.displayName,
      })),
    };
  }

  async getPublishedPage(slug: string, pageNo: number): Promise<StoryPageView> {
    const template = await this.findPublishedOrThrow(slug);

    const page = await this.pages.findOneBy({
      templateId: template.id,
      pageNo,
      branchKey: 'common',
    });
    if (!page) {
      throw new StoryPageNotFoundErrorResponseDto();
    }

    const appearances = await this.pageCharacters.find({
      where: { pageId: page.id },
      relations: { character: true },
      order: { id: 'ASC' },
    });

    return {
      pageNo: page.pageNo,
      bodyText: page.bodyText,
      baseImageKey: page.baseImageKey,
      personaTargetRole: page.personaTargetRole,
      characters: appearances.map((appearance) => ({
        role: appearance.character.role,
        displayName: appearance.character.displayName,
        hitbox: appearance.hitbox,
      })),
    };
  }

  /**
   * 미공개 동화는 **찾을 수 없는 것으로 취급**한다 (`StoryNotFoundErrorResponseDto` 주석 참조).
   * 목록·상세·페이지 조회가 같은 조건을 쓰도록 한 곳에 모은다.
   */
  private async findPublishedOrThrow(slug: string): Promise<StoryTemplate> {
    const template = await this.templates.findOneBy({
      slug,
      status: STORY_TEMPLATE_STATUS.PUBLISHED,
    });

    if (!template) {
      throw new StoryNotFoundErrorResponseDto();
    }

    return template;
  }

  private toSummary(template: StoryTemplate): StorySummary {
    return {
      slug: template.slug,
      title: template.title,
      summary: template.summary,
      coverImageKey: template.coverImageKey,
    };
  }
}
