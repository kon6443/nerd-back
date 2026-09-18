import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { StoryDetail, StoryPageView, StorySummary } from '@nerd/contracts';
import { StoryCharacter } from '@entities/story-character.entity';
import { StoryPage } from '@entities/story-page.entity';
import { StoryPageCharacter } from '@entities/story-page-character.entity';
import { STORY_TEMPLATE_STATUS, StoryTemplate } from '@entities/story-template.entity';
import { STORAGE_PORT, type StoragePort } from '@common/port/storage.port';
import {
  StoryNotFoundErrorResponseDto,
  StoryPageNotFoundErrorResponseDto,
} from './dto/story.error.dto';

const PUBLIC_COVER_SIGNING_WINDOW_MS = 5 * 60 * 1000;
const PUBLIC_COVER_URL_TTL_SECONDS = 60 * 60;

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
    @Inject(STORAGE_PORT)
    private readonly storage: StoragePort,
  ) {}

  /** 공개된 동화 목록. `draft` 는 절대 포함하지 않는다. */
  async listPublished(): Promise<StorySummary[]> {
    const templates = await this.templates.find({
      where: { status: STORY_TEMPLATE_STATUS.PUBLISHED },
      order: { id: 'ASC' },
    });

    return Promise.all(templates.map((template) => this.toSummary(template)));
  }

  async getPublishedDetail(slug: string): Promise<StoryDetail> {
    const template = await this.findPublishedOrThrow(slug);

    const [summary, pageCount, characters] = await Promise.all([
      this.toSummary(template),
      this.pages.countBy({ templateId: template.id, branchKey: 'common' }),
      this.characters.find({ where: { templateId: template.id }, order: { id: 'ASC' } }),
    ]);

    return {
      ...summary,
      pageCount,
      // persona 는 엔티티에서 select: false 라 여기 담기지 않는다. 프롬프트 설계를 노출하지 않기 위한 것이다.
      characters: characters.map((character) => ({
        role: character.role,
        displayName: character.displayName,
      })),
    };
  }

  /**
   * 본편 전 쪽을 한 번에. **리더는 이것 하나로 끝난다.**
   *
   * ⭐ 쪽마다 부르면 6쪽짜리 책 한 권에 요청 5회 · 쿼리 15회가 나간다. 여기서는 등장인물까지
   * `In(pageIds)` 로 **한 번에 긁어와** 쿼리가 3회(템플릿 · 쪽 · 등장)로 고정된다.
   * 🚫 쪽 수만큼 반복 조회하지 않는다 — 분량이 늘어도 쿼리 수가 그대로여야 한다.
   *
   * 🚫 비하인드(`branchKey` 'a'/'b')는 포함하지 않는다. 그것은 세션의 선택 결과라
   * `GET /sessions/:id/after-story` 가 소유한다.
   */
  async listPublishedPages(slug: string): Promise<StoryPageView[]> {
    const template = await this.findPublishedOrThrow(slug);

    const pages = await this.pages.find({
      where: { templateId: template.id, branchKey: 'common' },
      order: { pageNo: 'ASC' },
    });
    if (pages.length === 0) {
      return [];
    }

    const appearances = await this.pageCharacters.find({
      where: { pageId: In(pages.map((page) => page.id)) },
      relations: { character: true },
      order: { id: 'ASC' },
    });

    const byPage = new Map<number, StoryPageCharacter[]>();
    for (const appearance of appearances) {
      const bucket = byPage.get(appearance.pageId);
      if (bucket) {
        bucket.push(appearance);
      } else {
        byPage.set(appearance.pageId, [appearance]);
      }
    }

    return Promise.all(pages.map((page) => this.toPageView(page, byPage.get(page.id) ?? [])));
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

    return this.toPageView(page, appearances);
  }

  /** 단건 조회와 목록 조회가 **같은 모양**을 내도록 한 곳에 둔다. */
  private async toPageView(
    page: StoryPage,
    appearances: StoryPageCharacter[],
  ): Promise<StoryPageView> {
    const signingDate = new Date(
      Math.floor(Date.now() / PUBLIC_COVER_SIGNING_WINDOW_MS) * PUBLIC_COVER_SIGNING_WINDOW_MS,
    );
    const [baseImageUrl, narrationAudioUrl] = await Promise.all([
      this.getOptionalAssetUrl(page.baseImageKey, signingDate),
      this.getOptionalAssetUrl(page.narrationAudioKey),
    ]);
    return {
      pageNo: page.pageNo,
      bodyText: page.bodyText,
      baseImageKey: page.baseImageKey,
      baseImageUrl,
      narrationAudioUrl,
      personaTargetRole: page.personaTargetRole,
      characters: appearances.map((appearance) => ({
        role: appearance.character.role,
        displayName: appearance.character.displayName,
        hitbox: appearance.hitbox,
      })),
    };
  }

  private async getOptionalAssetUrl(
    key: string | null,
    signingDate?: Date,
  ): Promise<string | null> {
    if (!key || !key.trim()) return null;
    const trimmedKey = key.trim();
    try {
      if (signingDate) {
        return await this.storage.getPresignedUrl(trimmedKey, PUBLIC_COVER_URL_TTL_SECONDS, signingDate);
      }
      return await this.storage.getPresignedUrl(trimmedKey);
    } catch {
      return null;
    }
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

  private async toSummary(template: StoryTemplate): Promise<StorySummary> {
    // 공개 표지만 5분 동안 같은 URL을 사용해 홈 preload와 서재의 브라우저 캐시를 공유한다.
    // 1시간 서명의 남은 수명은 55~60분이며 개인화/얼굴 사진의 서명에는 적용하지 않는다.
    const signingDate = new Date(
      Math.floor(Date.now() / PUBLIC_COVER_SIGNING_WINDOW_MS) * PUBLIC_COVER_SIGNING_WINDOW_MS,
    );
    return {
      slug: template.slug,
      title: template.title,
      summary: template.summary,
      coverImageKey: template.coverImageKey,
      coverImageUrl: await this.getOptionalAssetUrl(template.coverImageKey, signingDate),
    };
  }
}
