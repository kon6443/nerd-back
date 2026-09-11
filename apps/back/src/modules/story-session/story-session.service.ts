import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transactional } from 'typeorm-transactional';
import { randomUUID } from 'node:crypto';
import { StorySession } from '@entities/story-session.entity';
import { StoryTemplate, STORY_TEMPLATE_STATUS } from '@entities/story-template.entity';
import { StoryPage } from '@entities/story-page.entity';
import { SessionPageImage } from '@entities/session-page-image.entity';
import { StoryAfterStoryChoice } from '@entities/story-after-story-choice.entity';
import { SessionBranchChoice } from '@entities/session-branch-choice.entity';
import { StoryNotFoundErrorResponseDto } from '@modules/story/dto/story.error.dto';
import {
  FaceNotReadyErrorResponseDto,
  FaceRequiredErrorResponseDto,
  PageNotFailedErrorResponseDto,
  PageNotFoundErrorResponseDto,
  SessionNotFoundErrorResponseDto,
  StoryAlreadyCompletedErrorResponseDto,
  FirstBranchAlreadyChosenErrorResponseDto,
} from './dto/story-session-error.dto';
import {
  IMAGE_GENERATION_PORT,
  type ImageGenerationPort,
} from '../../common/port/image-generation.port';
import { STORAGE_PORT, type StoragePort } from '../../common/port/storage.port';
import { validateImageBuffer } from '../../common/utils/image-validator';
import type {
  PersonalizeSessionResponse,
  RetryPageResponse,
  RetryAfterStoryResponse,
  SessionPageItem,
  SessionPagesResponse,
  StorySessionSummary,
  UploadFaceResponse,
  MyStorySessionItem,
  AfterStoryResponse,
  SelectAfterStoryChoiceInput,
  SelectAfterStoryChoiceResponse,
  StoryBranchKey,
} from '@nerd/contracts';

/**
 * `running` 인 페이지를 고아로 간주하기까지의 시간.
 *
 * 처리하던 프로세스가 죽으면 그 행은 영원히 `running` 으로 남는다. 이 시간을 넘기면
 * 다른 레플리카가 회수해 다시 만든다. 이미지 1장 생성이 이보다 오래 걸리는 일은 없다 —
 * 너무 짧으면 **정상 작업을 남이 빼앗고**, 너무 길면 진짜 고아를 오래 방치한다.
 */
const STALE_RUNNING_MS = 10 * 60 * 1000;

@Injectable()
export class StorySessionService {
  private readonly logger = new Logger(StorySessionService.name);

  constructor(
    @InjectRepository(StorySession)
    private readonly sessionRepo: Repository<StorySession>,
    @InjectRepository(StoryTemplate)
    private readonly templateRepo: Repository<StoryTemplate>,
    @InjectRepository(StoryPage)
    private readonly pageRepo: Repository<StoryPage>,
    @InjectRepository(SessionPageImage)
    private readonly pageImageRepo: Repository<SessionPageImage>,
    @Inject(IMAGE_GENERATION_PORT)
    private readonly imagePort: ImageGenerationPort,
    @Inject(STORAGE_PORT)
    private readonly storagePort: StoragePort,
    @Optional()
    private readonly configService?: ConfigService,
    @Optional()
    @InjectRepository(StoryAfterStoryChoice)
    private readonly afterStoryChoiceRepo?: Repository<StoryAfterStoryChoice>,
    @Optional()
    @InjectRepository(SessionBranchChoice)
    private readonly branchChoiceRepo?: Repository<SessionBranchChoice>,
  ) {}

  /**
   * 페이지 한 장을 이 프로세스가 처리하겠다고 **원자적으로** 선언한다.
   * `true` 면 내가 집은 것이고, `false` 면 다른 레플리카가 처리 중이거나 이미 끝난 것이다.
   *
   * 🚫 인메모리 플래그로 중복을 막지 않는다 — **레플리카가 3개라 프로세스마다 갈린다.**
   *    "누가 처리 중인가" 를 메모리에 두면 다른 레플리카에게는 그 사실이 보이지 않아,
   *    **처리 중인 작업**과 **죽어서 방치된 작업**이 똑같이 "비어 있음" 으로 관측된다.
   *    그 둘은 정반대 대응(건드리지 않기 / 다시 돌리기)을 요구하므로 구분에 실패하면
   *    유료 이미지 생성이 중복 호출된다. 그래서 판정을 DB 한 곳에 모은다.
   *
   * 같은 행에 대한 `UPDATE` 는 DB 가 직렬화하므로, 동시에 들어와도 **정확히 한 쪽만** 1행을 얻는다.
   * `running` 인데 `updated_at` 이 오래된 행은 고아로 보고 회수한다 — TTL 을 따로 두지 않고
   * 이미 있는 타임스탬프를 쓰므로 스키마 변경이 필요 없다.
   */
  /**
   * 이 시각보다 `updated_at` 이 오래된 `running` 은 고아로 본다.
   *
   * claim 의 회수 조건과 재시도 허용 조건이 **같은 기준**을 쓰도록 한 곳에 둔다 —
   * 두 곳이 어긋나면 한쪽은 빼앗고 한쪽은 막는 모순이 생긴다.
   */
  private staleRunningThreshold(): Date {
    return new Date(Date.now() - STALE_RUNNING_MS);
  }

  private async claimPage(
    sessionId: string,
    pageNo: number,
    branchKey: 'common' | StoryBranchKey,
  ): Promise<boolean> {
    const staleBefore = this.staleRunningThreshold();

    const result = await this.pageImageRepo
      .createQueryBuilder()
      .update(SessionPageImage)
      .set({ status: 'running', errorMessage: null, updatedAt: new Date() })
      .where('session_id = :sessionId', { sessionId })
      .andWhere('page_no = :pageNo', { pageNo })
      .andWhere('branch_key = :branchKey', { branchKey })
      .andWhere(
        '(status IN (:...claimable) OR (status = :running AND updated_at < :staleBefore))',
        { claimable: ['pending', 'failed'], running: 'running', staleBefore },
      )
      .execute();

    return (result.affected ?? 0) > 0;
  }

  async getAfterStory(userId: number, sessionId: string): Promise<AfterStoryResponse> {
    const session = await this.getOwnedSessionOrThrow(userId, sessionId);
    const choiceRepo = this.requireAfterStoryChoiceRepo();
    const branchRepo = this.requireBranchChoiceRepo();
    const [choices, pages, images, firstChoice] = await Promise.all([
      choiceRepo.find({ where: { templateId: session.templateId }, order: { branchKey: 'ASC' } }),
      this.pageRepo.find({ where: { templateId: session.templateId }, order: { pageNo: 'ASC' } }),
      this.pageImageRepo.find({ where: { sessionId } }),
      branchRepo.findOne({ where: { sessionId } }),
    ]);

    const byBranch = new Map(choices.map((choice) => [choice.branchKey, choice]));
    const result = (['a', 'b'] as const).map(async (branchKey) => {
      const choice = byBranch.get(branchKey);
      const page = pages.find((item) => item.pageNo === 6 && item.branchKey === branchKey);
      if (!choice || !page) throw new Error(`비하인드 콘텐츠 누락: ${branchKey}`);
      const image = images.find((item) => item.pageNo === 6 && item.branchKey === branchKey);
      return {
        branchKey,
        title: choice.title,
        description: choice.description,
        pageNo: 6 as const,
        bodyText: page.bodyText,
        status: image?.status ?? 'pending',
        imageUrl: image?.status === 'succeeded' && image.imageKey ? await this.storagePort.getPresignedUrl(image.imageKey) : null,
        errorMessage: image?.errorMessage ?? null,
      };
    });

    return {
      sessionId,
      firstBranchChoice: firstChoice?.branchKey ?? null,
      choices: (await Promise.all(result)) as AfterStoryResponse['choices'],
    };
  }

  async selectAfterStoryChoice(
    userId: number,
    sessionId: string,
    input: SelectAfterStoryChoiceInput,
  ): Promise<SelectAfterStoryChoiceResponse> {
    await this.getOwnedSessionOrThrow(userId, sessionId);
    const branchRepo = this.requireBranchChoiceRepo();
    const existing = await branchRepo.findOne({ where: { sessionId } });
    if (existing) {
      if (existing.branchKey !== input.branchKey) throw new FirstBranchAlreadyChosenErrorResponseDto();
      return { sessionId, branchKey: existing.branchKey, isFirstChoice: false };
    }
    const created = branchRepo.create({ id: randomUUID(), sessionId, branchKey: input.branchKey });
    await branchRepo.save(created);
    return { sessionId, branchKey: input.branchKey, isFirstChoice: true };
  }

  private async getOwnedSessionOrThrow(userId: number, sessionId: string): Promise<StorySession> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session || session.userId !== userId) throw new SessionNotFoundErrorResponseDto();
    return session;
  }

  private requireAfterStoryChoiceRepo(): Repository<StoryAfterStoryChoice> {
    if (!this.afterStoryChoiceRepo) throw new Error('StoryAfterStoryChoice repository is not configured');
    return this.afterStoryChoiceRepo;
  }

  private requireBranchChoiceRepo(): Repository<SessionBranchChoice> {
    if (!this.branchChoiceRepo) throw new Error('SessionBranchChoice repository is not configured');
    return this.branchChoiceRepo;
  }

  /**
   * 세션 생성 또는 미완료 세션 재사용 (Idempotent resume).
   * - 이미 완성된 동화(completed): 409 Conflict (1인 1권 제한)
   * - 기존 미완료 세션(draft, failed, face_ready, generating): 기존 세션 반환 (재촬영/재시도 가능)
   * - 신규: 새로 생성
   */
  async createOrResumeSession(userId: number, templateSlug: string): Promise<StorySessionSummary> {
    const template = await this.templateRepo.findOne({
      where: { slug: templateSlug, status: STORY_TEMPLATE_STATUS.PUBLISHED },
    });

    if (!template) {
      throw new StoryNotFoundErrorResponseDto();
    }

    const existing = await this.sessionRepo.findOne({
      where: { userId, templateId: template.id },
    });

    if (existing) {
      if (existing.status === 'completed') {
        throw new StoryAlreadyCompletedErrorResponseDto();
      }

      let referenceImageUrl: string | null = null;
      if (existing.referenceImageKey) {
        referenceImageUrl = await this.storagePort.getPresignedUrl(existing.referenceImageKey);
      }

      return {
        id: existing.id,
        templateSlug,
        status: existing.status,
        referenceImageUrl,
        createdAt: existing.createdAt.toISOString(),
        updatedAt: existing.updatedAt.toISOString(),
      };
    }

    try {
      const session = this.sessionRepo.create({
        id: randomUUID(),
        userId,
        templateId: template.id,
        status: 'draft',
      });
      const saved = await this.sessionRepo.save(session);

      return {
        id: saved.id,
        templateSlug,
        status: saved.status,
        referenceImageUrl: null,
        createdAt: saved.createdAt.toISOString(),
        updatedAt: saved.updatedAt.toISOString(),
      };
    } catch (error: unknown) {
      // 동시 요청 경합 시 DB UNIQUE 제약 위반(ER_DUP_ENTRY / 1062) 방어
      const dbErr = error as { code?: string; errno?: number } | null | undefined;
      if (dbErr?.code === 'ER_DUP_ENTRY' || dbErr?.errno === 1062) {
        const raceSession = await this.sessionRepo.findOne({
          where: { userId, templateId: template.id },
        });
        if (raceSession) {
          if (raceSession.status === 'completed') {
            throw new StoryAlreadyCompletedErrorResponseDto();
          }
          return {
            id: raceSession.id,
            templateSlug,
            status: raceSession.status,
            referenceImageUrl: null,
            createdAt: raceSession.createdAt.toISOString(),
            updatedAt: raceSession.updatedAt.toISOString(),
          };
        }
      }
      throw error;
    }
  }

  /**
   * 사용자의 모든 동화 제작 세션 목록 조회 (마이페이지 / 서재 연동)
   */
  async getMySessions(userId: number): Promise<MyStorySessionItem[]> {
    const sessions = await this.sessionRepo.find({
      where: { userId },
      relations: ['template'],
      order: { createdAt: 'DESC' },
    });

    return Promise.all(
      sessions.map(async (s) => {
        let referenceImageUrl: string | null = null;
        if (s.referenceImageKey) {
          referenceImageUrl = await this.storagePort.getPresignedUrl(s.referenceImageKey);
        }
        return {
          id: s.id,
          templateId: s.templateId,
          templateSlug: s.template?.slug ?? '',
          templateTitle: s.template?.title ?? '',
          status: s.status,
          referenceImageUrl,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        };
      }),
    );
  }

  /**
   * 세션 삭제 (초기화 및 다른 얼굴로 새로 만들기용)
   */
  // 페이지 이미지 → 세션 두 테이블을 지운다. 중간에 끊기면 "지웠는데 목록에 남는" 상태가
  // 되므로 한 트랜잭션으로 묶는다 (컨텍스트는 main.ts 의 initializeTransactionalContext).
  @Transactional()
  async deleteSession(userId: number, sessionId: string): Promise<void> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw new SessionNotFoundErrorResponseDto();
    }

    // 1. 해당 세션의 페이지 이미지 레코드 삭제
    await this.pageImageRepo.delete({ sessionId });

    // 2. 세션 레코드 삭제
    await this.sessionRepo.delete({ id: sessionId });

    this.logger.log(`동화 세션 삭제 완료: ${sessionId} (사용자 ${userId})`);
  }

  /**
   * 얼굴 사진 1~3장 업로드 → 매직바이트 검증 → 레퍼런스 생성 → 원본 폐기 → S3 저장
   */
  async uploadFace(
    userId: number,
    sessionId: string,
    files: {
      front?: Express.Multer.File[];
      left?: Express.Multer.File[];
      right?: Express.Multer.File[];
    },
  ): Promise<UploadFaceResponse> {
    const frontFile = files?.front?.[0];
    if (!frontFile || !frontFile.buffer || frontFile.buffer.length === 0) {
      throw new FaceRequiredErrorResponseDto();
    }

    // 1. 매직바이트 및 크기 검증
    validateImageBuffer(frontFile.buffer);

    const leftFile = files?.left?.[0];
    if (leftFile?.buffer && leftFile.buffer.length > 0) {
      validateImageBuffer(leftFile.buffer);
    }

    const rightFile = files?.right?.[0];
    if (rightFile?.buffer && rightFile.buffer.length > 0) {
      validateImageBuffer(rightFile.buffer);
    }

    // 2. 세션 확인 및 소유권 검증
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new SessionNotFoundErrorResponseDto();
    }

    if (session.status === 'completed') {
      throw new StoryAlreadyCompletedErrorResponseDto();
    }

    // 3. 캐릭터 레퍼런스 준비
    // DIRECT_FACE_MODE=true 인 경우 (테스트 모드): AI 1차 캐릭터 생성을 건너뛰고 사용자의 실제 얼굴 사진을 직접 템플릿 합성에 사용
    let referenceBuffer: Buffer;
    const isDirectFaceMode =
      this.configService?.get<string>('DIRECT_FACE_MODE') === 'true' ||
      process.env.DIRECT_FACE_MODE === 'true';

    if (isDirectFaceMode) {
      this.logger.log(
        `[DIRECT_FACE_MODE] 1차 캐릭터 생성을 건너뛰고 실제 얼굴 사진을 직접 레퍼런스로 등록합니다: 세션 ${session.id}`,
      );
      referenceBuffer = frontFile.buffer;
    } else {
      const template = await this.templateRepo.findOne({ where: { id: session.templateId } });
      const referenceCostume = this.getCostumePrompt(template?.slug);

      referenceBuffer = await this.imagePort.generateReference({
        front: frontFile.buffer,
        left: leftFile?.buffer,
        right: rightFile?.buffer,
        characterPrompt: referenceCostume,
      });
    }

    // 4. 레퍼런스 이미지 S3/스토리지 업로드
    const ext =
      frontFile.mimetype?.includes('jpeg') || frontFile.mimetype?.includes('jpg') ? 'jpg' : 'png';
    const key = `references/${session.id}/${randomUUID()}.${ext}`;
    const s3Key = await this.storagePort.upload(
      key,
      referenceBuffer,
      frontFile.mimetype || 'image/png',
    );

    // 5. 서명 URL 발급
    const referenceImageUrl = await this.storagePort.getPresignedUrl(s3Key);

    // 6. 세션 상태 갱신
    session.status = 'face_ready';
    session.referenceImageKey = s3Key;
    await this.sessionRepo.save(session);

    this.logger.log(`얼굴 업로드 및 레퍼런스 등록 완료: 세션 ${session.id}`);

    return {
      id: session.id,
      status: 'face_ready',
      referenceImageUrl,
    };
  }

  /**
   * 동화 페이지 개인화 비동기 파이프라인 시작 (API 10: 202 Accepted).
   * - 멱등성: 이미 generating 이거나 completed 이면 현재 상태 반환
   */
  async personalizeSession(userId: number, sessionId: string): Promise<PersonalizeSessionResponse> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw new SessionNotFoundErrorResponseDto();
    }

    if (session.status === 'draft') {
      throw new FaceNotReadyErrorResponseDto();
    }

    const templatePages = await this.pageRepo.find({
      where: { templateId: session.templateId },
      order: { pageNo: 'ASC' },
    });

    const totalPages = templatePages.length;

    if (session.status === 'completed') {
      return { id: session.id, status: 'completed', totalPages };
    }

    // 진행 중이든 고아든 **똑같이 기동한다** — 어느 쪽인지 미리 알 필요가 없다.
    // 어떤 페이지를 실제로 처리할지는 `claimPage` 의 조건부 UPDATE 가 정하므로,
    // 다른 레플리카가 붙들고 있는 페이지는 자연히 건너뛴다. 이것이 멱등성을 보장한다.
    const existingImages = await this.pageImageRepo.find({ where: { sessionId } });

    // 🚫 기존 행의 상태를 여기서 되돌리지 않는다. `running` 을 `pending` 으로 리셋하면
    //    **다른 레플리카가 지금 만들고 있는 페이지**를 빼앗아 같은 이미지를 두 번 생성하게 된다.
    //    재시도가 필요한 행(`failed`·오래된 `running`)은 claim 조건이 이미 포함한다.
    for (const page of templatePages) {
      const exists = existingImages.some(
        (img) => img.pageNo === page.pageNo && img.branchKey === page.branchKey,
      );
      if (exists) continue;

      const newPageImage = this.pageImageRepo.create({
        id: randomUUID(),
        sessionId: session.id,
        pageNo: page.pageNo,
        branchKey: page.branchKey,
        status: 'pending',
        imageKey: null,
        errorMessage: null,
      });
      await this.pageImageRepo.save(newPageImage);
    }

    session.status = 'generating';
    await this.sessionRepo.save(session);

    // 비동기 백그라운드 파이프라인 시작 (요청 블로킹 방지)
    void this.executePersonalizationPipeline(session.id);

    return {
      id: session.id,
      status: 'generating',
      totalPages,
    };
  }

  /**
   * 세션의 페이지별 생성 진행률 및 서명 URL 목록 조회 (API 11: 폴링 경로).
   */
  async getSessionPages(userId: number, sessionId: string): Promise<SessionPagesResponse> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw new SessionNotFoundErrorResponseDto();
    }

    const templatePages = await this.pageRepo.find({ where: { templateId: session.templateId } });
    templatePages.sort((left, right) =>
      left.pageNo === right.pageNo
        ? left.branchKey.localeCompare(right.branchKey)
        : left.pageNo - right.pageNo,
    );

    const pageImages = await this.pageImageRepo.find({
      where: { sessionId },
      order: { pageNo: 'ASC' },
    });

    const pages: SessionPageItem[] = await Promise.all(
      templatePages.map(async (tplPage) => {
        const pageImg = pageImages.find(
          (img) => img.pageNo === tplPage.pageNo && img.branchKey === tplPage.branchKey,
        );
        let imageUrl: string | null = null;
        if (pageImg?.imageKey && pageImg.status === 'succeeded') {
          imageUrl = await this.storagePort.getPresignedUrl(pageImg.imageKey);
        }

        return {
          pageNo: tplPage.pageNo,
          branchKey: tplPage.branchKey,
          status: pageImg?.status || 'pending',
          imageUrl,
          errorMessage: pageImg?.errorMessage || null,
          updatedAt: pageImg?.updatedAt
            ? pageImg.updatedAt.toISOString()
            : session.updatedAt.toISOString(),
        };
      }),
    );

    const completedPages = pages.filter((p) => p.status === 'succeeded').length;
    const mainStoryPages = pages.filter((page) => page.branchKey === 'common');
    const isMainStoryReady =
      mainStoryPages.length > 0 && mainStoryPages.every((page) => page.status === 'succeeded');
    const isAllCompleted = pages.length > 0 && pages.every((page) => page.status === 'succeeded');

    return {
      sessionId: session.id,
      status: session.status,
      totalPages: templatePages.length,
      completedPages,
      isMainStoryReady,
      isAllCompleted,
      pages,
    };
  }

  /**
   * 실패한 특정 페이지 핀포인트 재시도 (API 12).
   */
  async retryPage(userId: number, sessionId: string, pageNo: number): Promise<RetryPageResponse> {
    const result = await this.retryStoryPage(userId, sessionId, pageNo, 'common');
    return { sessionId: result.sessionId, pageNo: result.pageNo, status: result.status };
  }

  /** 실패한 A/B 결과 6쪽만 비동기로 다시 생성한다. */
  async retryAfterStoryPage(
    userId: number,
    sessionId: string,
    branchKey: StoryBranchKey,
  ): Promise<RetryAfterStoryResponse> {
    const result = await this.retryStoryPage(userId, sessionId, 6, branchKey);
    return { sessionId: result.sessionId, pageNo: 6, branchKey, status: result.status };
  }

  private async retryStoryPage(
    userId: number,
    sessionId: string,
    pageNo: number,
    branchKey: 'common' | StoryBranchKey,
  ): Promise<{ sessionId: string; pageNo: number; status: 'pending' }> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw new SessionNotFoundErrorResponseDto();
    }

    const pageImg = await this.pageImageRepo.findOne({
      where: { sessionId, pageNo, branchKey },
    });

    if (!pageImg) {
      throw new PageNotFoundErrorResponseDto();
    }

    // 🚫 **살아 있는 `running` 을 재시도로 받지 않는다.** 아래에서 `pending` 으로 되돌리는데,
    //    그러면 **다른 레플리카가 지금 그리고 있는 페이지를 빼앗아** 같은 삽화가 두 번 생성된다
    //    (유료 호출 2배). 멈춘 것으로 보일 때 — 즉 claim 이 회수할 수 있는 시점 — 만 허용한다.
    //    코드는 그대로 두고 메시지만 상황에 맞춘다(§3 override).
    if (pageImg.status === 'running' && pageImg.updatedAt > this.staleRunningThreshold()) {
      throw new PageNotFailedErrorResponseDto('아직 생성 중입니다. 잠시 후 다시 시도해 주세요.');
    }

    if (pageImg.status !== 'failed' && pageImg.status !== 'running') {
      throw new PageNotFailedErrorResponseDto();
    }

    pageImg.status = 'pending';
    pageImg.errorMessage = null;
    await this.pageImageRepo.save(pageImg);

    session.status = 'generating';
    await this.sessionRepo.save(session);

    // 해당 페이지만 비동기 재실행
    void this.executeSinglePagePersonalization(session.id, pageNo, branchKey);

    return { sessionId: session.id, pageNo, status: 'pending' };
  }

  /**
   * 동화 주인공 배역별 시그니처 의상 고정 프롬프트
   */
  private getCostumePrompt(roleOrSlug?: string | null): string {
    switch (roleOrSlug) {
      case 'red-hood':
      case 'red-riding-hood':
        return 'an iconic vibrant bright red hooded cape (Red Riding Hood cloak) with the hood up, consistent red fairy tale dress';
      case 'jack':
      case 'jack-and-beanstalk':
        return 'an adventurous young peasant boy outfit: a dark green vest, loose ivory shirt with rolled sleeves, brown trousers, and sturdy brown boots';
      default:
        return 'the charming protagonist storybook outfit';
    }
  }

  /**
   * 전체 페이지 개인화 파이프라인 백그라운드 병렬(Parallel) 처리
   */
  async executePersonalizationPipeline(sessionId: string): Promise<void> {
    // 중복 기동 자체는 막지 않는다 — 페이지별 `claimPage` 가 실제 작업의 중복을 막으므로
    // 두 레플리카가 함께 들어와도 유료 생성은 한 번만 일어난다.
    try {
      const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
      if (!session || !session.referenceImageKey) {
        this.logger.error(`파이프라인 중단: 세션(${sessionId}) 또는 레퍼런스 이미지 부재`);
        return;
      }

      const refBuffer = await this.storagePort.download(session.referenceImageKey);
      const templatePages = await this.pageRepo.find({
        where: { templateId: session.templateId },
        order: { pageNo: 'ASC' },
      });

      // Qwen Image 3 요청 하나는 템플릿+인물 레퍼런스 2장만 사용한다.
      // 업스트림 동시성 슬롯(최대 5개)을 넘지 않도록, 최대 4개 요청만 함께 실행한다.
      const CHUNK_SIZE = 4;
      for (let i = 0; i < templatePages.length; i += CHUNK_SIZE) {
        const chunk = templatePages.slice(i, i + CHUNK_SIZE);
        await Promise.all(
          chunk.map(async (tplPage) => {
            // 이 페이지를 내가 처리해도 되는지 DB 에 원자적으로 묻는다.
            // 남이 집었거나 이미 끝났으면 조용히 건너뛴다.
            const claimed = await this.claimPage(sessionId, tplPage.pageNo, tplPage.branchKey);
            if (!claimed) return;

            const pageImg = await this.pageImageRepo.findOne({
              where: { sessionId, pageNo: tplPage.pageNo, branchKey: tplPage.branchKey },
            });
            if (!pageImg) return;

            try {
              // 템플릿 기본 삽화가 등록되어 있으면 참조용으로 주입
              let baseImageBuffer: Buffer | undefined;
              if (tplPage.baseImageKey) {
                try {
                  baseImageBuffer = await this.storagePort.download(tplPage.baseImageKey);
                } catch {
                  // 다운로드 실패 시에도 페이지 생성은 계속 진행
                }
              }

              const characterCostume = this.getCostumePrompt(tplPage.personaTargetRole);

              const generatedBuffer = await this.imagePort.generatePageIllustration({
                referenceImage: refBuffer,
                baseImage: baseImageBuffer,
                prompt: tplPage.illustrationPrompt || tplPage.bodyText,
                characterPrompt: characterCostume,
              });

              const key = `personalizations/${sessionId}/${tplPage.branchKey}/page-${tplPage.pageNo}-${randomUUID()}.png`;
              const s3Key = await this.storagePort.upload(key, generatedBuffer, 'image/png');

              pageImg.imageKey = s3Key;
              pageImg.status = 'succeeded';
              pageImg.errorMessage = null;
              await this.pageImageRepo.save(pageImg);
              this.logger.log(`페이지 ${tplPage.pageNo} 삽화 개인화 완료: ${s3Key}`);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              pageImg.status = 'failed';
              pageImg.errorMessage = msg;
              await this.pageImageRepo.save(pageImg);
              this.logger.error(`페이지 ${tplPage.pageNo} 삽화 개인화 실패: ${msg}`);
            }
          }),
        );
      }

      await this.checkAndUpdateSessionCompletion(session.id);
    } catch (error: unknown) {
      this.logger.error(`개인화 파이프라인 전체 오류: ${error}`);
    }
  }

  /**
   * 단일 페이지 재시도 비동기 실행
   */
  async executeSinglePagePersonalization(
    sessionId: string,
    pageNo: number,
    branchKey: 'common' | StoryBranchKey = 'common',
  ): Promise<void> {
    try {
      const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
      if (!session || !session.referenceImageKey) return;

      const tplPage = await this.pageRepo.findOne({
        where: { templateId: session.templateId, pageNo, branchKey },
      });
      if (!tplPage) return;

      // 전체 파이프라인과 같은 판정을 쓴다 — 다른 레플리카가 이 페이지를 재시도 중이면 집히지 않는다.
      const claimed = await this.claimPage(sessionId, pageNo, branchKey);
      if (!claimed) {
        this.logger.warn(`이미 처리 중인 페이지라 재시도를 건너뛴다: ${sessionId}:${branchKey}:${pageNo}`);
        return;
      }

      const pageImg = await this.pageImageRepo.findOne({
        where: { sessionId, pageNo, branchKey },
      });
      if (!pageImg) return;

      const refBuffer = await this.storagePort.download(session.referenceImageKey);
      try {
        let baseImageBuffer: Buffer | undefined;
        if (tplPage.baseImageKey) {
          try {
            baseImageBuffer = await this.storagePort.download(tplPage.baseImageKey);
          } catch {
            // 무시하고 진행
          }
        }

        const characterCostume = this.getCostumePrompt(tplPage.personaTargetRole);

        const generatedBuffer = await this.imagePort.generatePageIllustration({
          referenceImage: refBuffer,
          baseImage: baseImageBuffer,
          prompt: tplPage.illustrationPrompt || tplPage.bodyText,
          characterPrompt: characterCostume,
        });

        const key = `personalizations/${sessionId}/${tplPage.branchKey}/page-${tplPage.pageNo}-${randomUUID()}.png`;
        const s3Key = await this.storagePort.upload(key, generatedBuffer, 'image/png');

        pageImg.imageKey = s3Key;
        pageImg.status = 'succeeded';
        pageImg.errorMessage = null;
        await this.pageImageRepo.save(pageImg);
        this.logger.log(`단일 페이지 ${pageNo} 재시도 완료: ${s3Key}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        pageImg.status = 'failed';
        pageImg.errorMessage = msg;
        await this.pageImageRepo.save(pageImg);
        this.logger.error(`단일 페이지 ${pageNo} 재시도 실패: ${msg}`);
      }

      await this.checkAndUpdateSessionCompletion(session.id);
    } catch (error: unknown) {
      this.logger.error(`단일 페이지 재시도 오류: ${error}`);
    }
  }

  private async checkAndUpdateSessionCompletion(sessionId: string): Promise<void> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) return;

    const templatePages = await this.pageRepo.find({ where: { templateId: session.templateId } });
    const pageImages = await this.pageImageRepo.find({ where: { sessionId } });

    const allSucceeded =
      pageImages.length === templatePages.length &&
      pageImages.every((img) => img.status === 'succeeded');

    if (allSucceeded) {
      session.status = 'completed';
      await this.sessionRepo.save(session);
      this.logger.log(`동화 세션 전체 완료 (completed): 세션 ${sessionId}`);
    } else {
      const anyFailed = pageImages.some((img) => img.status === 'failed');
      if (anyFailed) {
        session.status = 'failed';
        await this.sessionRepo.save(session);
      }
    }
  }
}
