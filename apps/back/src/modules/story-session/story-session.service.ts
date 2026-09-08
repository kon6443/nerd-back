import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { StorySession } from '@entities/story-session.entity';
import { StoryTemplate, STORY_TEMPLATE_STATUS } from '@entities/story-template.entity';
import { StoryNotFoundErrorResponseDto } from '@modules/story/dto/story.error.dto';
import {
  FaceRequiredErrorResponseDto,
  SessionNotFoundErrorResponseDto,
  StoryAlreadyCompletedErrorResponseDto,
} from './dto/story-session-error.dto';
import {
  IMAGE_GENERATION_PORT,
  type ImageGenerationPort,
} from '../../common/port/image-generation.port';
import { STORAGE_PORT, type StoragePort } from '../../common/port/storage.port';
import { validateImageBuffer } from '../../common/utils/image-validator';
import type { StorySessionSummary, UploadFaceResponse } from '@nerd/contracts';

@Injectable()
export class StorySessionService {
  private readonly logger = new Logger(StorySessionService.name);

  constructor(
    @InjectRepository(StorySession)
    private readonly sessionRepo: Repository<StorySession>,
    @InjectRepository(StoryTemplate)
    private readonly templateRepo: Repository<StoryTemplate>,
    @Inject(IMAGE_GENERATION_PORT)
    private readonly imagePort: ImageGenerationPort,
    @Inject(STORAGE_PORT)
    private readonly storagePort: StoragePort,
  ) {}

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

    // 3. 캐릭터 레퍼런스 생성 (원본은 generateReference 직후 어디에도 저장되지 않고 폐기)
    const referenceBuffer = await this.imagePort.generateReference({
      front: frontFile.buffer,
      left: leftFile?.buffer,
      right: rightFile?.buffer,
    });

    // 4. 레퍼런스 이미지 S3/스토리지 업로드
    const key = `references/${session.id}/${randomUUID()}.png`;
    const s3Key = await this.storagePort.upload(key, referenceBuffer, 'image/png');

    // 5. 서명 URL 발급
    const referenceImageUrl = await this.storagePort.getPresignedUrl(s3Key);

    // 6. 세션 상태 갱신
    session.status = 'face_ready';
    session.referenceImageKey = s3Key;
    await this.sessionRepo.save(session);

    this.logger.log(`얼굴 업로드 및 레퍼런스 생성 완료: 세션 ${session.id}`);

    return {
      id: session.id,
      status: 'face_ready',
      referenceImageUrl,
    };
  }
}
