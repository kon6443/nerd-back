import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { StorySession } from '@entities/story-session.entity';
import { StoryTemplate, STORY_TEMPLATE_STATUS } from '@entities/story-template.entity';
import { StoryPage } from '@entities/story-page.entity';
import { SessionPageImage } from '@entities/session-page-image.entity';
import { StoryNotFoundErrorResponseDto } from '@modules/story/dto/story.error.dto';
import {
  FaceNotReadyErrorResponseDto,
  FaceRequiredErrorResponseDto,
  PageNotFailedErrorResponseDto,
  PageNotFoundErrorResponseDto,
  SessionNotFoundErrorResponseDto,
  StoryAlreadyCompletedErrorResponseDto,
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
  SessionPageItem,
  SessionPagesResponse,
  StorySessionSummary,
  UploadFaceResponse,
  MyStorySessionItem,
} from '@nerd/contracts';

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
  ) {}

  /** 현재 프로세스에서 비동기로 실행 중인 파이프라인 세션 ID 추적 (중복 실행 방지 및 서버 재시작 시 고아 세션 복구용) */
  private readonly activePipelines = new Set<string>();

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

    // 이미 백그라운드 파이프라인이 현재 프로세스에서 정상 동작 중이면 중복 시작 방지 (멱등성)
    if (session.status === 'generating' && this.activePipelines.has(session.id)) {
      return { id: session.id, status: 'generating', totalPages };
    }

    // face_ready, failed 상태이거나, 서버 재시작 등으로 generating 상태인데 실제 파이프라인이 멈춘 경우:
    // 개별 페이지 엔티티 초기화 및 비동기 작업 기동
    const existingImages = await this.pageImageRepo.find({ where: { sessionId } });

    for (const page of templatePages) {
      const existing = existingImages.find((img) => img.pageNo === page.pageNo);
      if (existing) {
        if (existing.status !== 'succeeded') {
          existing.status = 'pending';
          existing.errorMessage = null;
          await this.pageImageRepo.save(existing);
        }
      } else {
        const newPageImage = this.pageImageRepo.create({
          id: randomUUID(),
          sessionId: session.id,
          pageNo: page.pageNo,
          status: 'pending',
          imageKey: null,
          errorMessage: null,
        });
        await this.pageImageRepo.save(newPageImage);
      }
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

    const templatePages = await this.pageRepo.find({
      where: { templateId: session.templateId },
      order: { pageNo: 'ASC' },
    });

    const pageImages = await this.pageImageRepo.find({
      where: { sessionId },
      order: { pageNo: 'ASC' },
    });

    const pages: SessionPageItem[] = await Promise.all(
      templatePages.map(async (tplPage) => {
        const pageImg = pageImages.find((img) => img.pageNo === tplPage.pageNo);
        let imageUrl: string | null = null;
        if (pageImg?.imageKey && pageImg.status === 'succeeded') {
          imageUrl = await this.storagePort.getPresignedUrl(pageImg.imageKey);
        }

        return {
          pageNo: tplPage.pageNo,
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
    const isAllCompleted = session.status === 'completed';

    return {
      sessionId: session.id,
      status: session.status,
      totalPages: templatePages.length,
      completedPages,
      isAllCompleted,
      pages,
    };
  }

  /**
   * 실패한 특정 페이지 핀포인트 재시도 (API 12).
   */
  async retryPage(userId: number, sessionId: string, pageNo: number): Promise<RetryPageResponse> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw new SessionNotFoundErrorResponseDto();
    }

    const pageImg = await this.pageImageRepo.findOne({
      where: { sessionId, pageNo },
    });

    if (!pageImg) {
      throw new PageNotFoundErrorResponseDto();
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
    void this.executeSinglePagePersonalization(session.id, pageNo);

    return {
      sessionId: session.id,
      pageNo,
      status: 'pending',
    };
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
        return 'an adventurous young peasant boy outfit with brown suspenders and rolled sleeves';
      default:
        return 'the charming protagonist storybook outfit';
    }
  }

  /**
   * 전체 페이지 개인화 파이프라인 백그라운드 병렬(Parallel) 처리
   */
  async executePersonalizationPipeline(sessionId: string): Promise<void> {
    if (this.activePipelines.has(sessionId)) {
      this.logger.warn(`이미 진행 중인 파이프라인 무시: 세션 ${sessionId}`);
      return;
    }
    this.activePipelines.add(sessionId);

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

      // 업스트림(OpenRouter/Gemini)의 동시성 슬롯(최대 5개) 초과 및 큐 지연을 방지하기 위해 3장씩 배치 분할 병렬 처리
      const CHUNK_SIZE = 3;
      for (let i = 0; i < templatePages.length; i += CHUNK_SIZE) {
        const chunk = templatePages.slice(i, i + CHUNK_SIZE);
        await Promise.all(
          chunk.map(async (tplPage) => {
            const pageImg = await this.pageImageRepo.findOne({
              where: { sessionId, pageNo: tplPage.pageNo },
            });

            if (!pageImg || pageImg.status === 'succeeded') {
              return;
            }

            pageImg.status = 'running';
            await this.pageImageRepo.save(pageImg);

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

              const key = `personalizations/${sessionId}/page-${tplPage.pageNo}-${randomUUID()}.png`;
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
    } finally {
      this.activePipelines.delete(sessionId);
    }
  }

  /**
   * 단일 페이지 재시도 비동기 실행
   */
  async executeSinglePagePersonalization(sessionId: string, pageNo: number): Promise<void> {
    const pipelineKey = `${sessionId}:${pageNo}`;
    if (this.activePipelines.has(pipelineKey)) {
      this.logger.warn(`이미 진행 중인 단일 페이지 재시도 무시: ${pipelineKey}`);
      return;
    }
    this.activePipelines.add(pipelineKey);

    try {
      const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
      if (!session || !session.referenceImageKey) return;

      const pageImg = await this.pageImageRepo.findOne({ where: { sessionId, pageNo } });
      if (!pageImg) return;

      const tplPage = await this.pageRepo.findOne({
        where: { templateId: session.templateId, pageNo },
      });
      if (!tplPage) return;

      pageImg.status = 'running';
      await this.pageImageRepo.save(pageImg);

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

        const key = `personalizations/${sessionId}/page-${tplPage.pageNo}-${randomUUID()}.png`;
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
    } finally {
      this.activePipelines.delete(pipelineKey);
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
