import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Transactional } from 'typeorm-transactional';
import { randomUUID } from 'node:crypto';
import { AuthService } from '@modules/auth/auth.service';
import { StorySession } from '@entities/story-session.entity';
import { StoryTemplate, STORY_TEMPLATE_STATUS } from '@entities/story-template.entity';
import { StoryPage } from '@entities/story-page.entity';
import { StoryPageCharacter } from '@entities/story-page-character.entity';
import { SessionPageImage } from '@entities/session-page-image.entity';
import { StoryAfterStoryChoice } from '@entities/story-after-story-choice.entity';
import { SessionBranchChoice } from '@entities/session-branch-choice.entity';
import { convertImageToWebp } from './convertImageToWebp';
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
import { isMysqlDuplicateKey } from '@common/utils/is-mysql-duplicate-key';
import { createLogThrottle } from '@common/utils/log-throttle';
import { NOTIFICATION_PORT, type NotificationPort } from '@common/port/notification.port';
import { StorageCleanupService } from '../../common/storage/storage-cleanup.service';
import { StoryPageChat } from '@entities/story-page-chat.entity';
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
 * `running` 인 페이지를 고아로 간주하기까지의 시간 (3분).
 *
 * 처리하던 프로세스가 죽으면 그 행은 영원히 `running` 으로 남는다. 이 시간을 넘기면
 * 다른 레플리카가 회수해 다시 만든다. 단일 이미지 생성 타임아웃(120초)과 S3 다운로드/업로드
 * 지연을 감안해도 3분이면 충분하다. 10분은 프로세스 비정상 종료 시 사용자 대기 시간을 지나치게
 * 지연시키므로 3분(180초)으로 현실화한다.
 */
export const STALE_RUNNING_MS = 3 * 60 * 1000;

/**
 * 개인화 파이프라인 동시 생성 슬롯 수 (슬라이딩 윈도우 풀 크기).
 * 업스트림 동시성 한도(5개)를 초과하지 않고 슬롯 유휴 시간을 최소화한다.
 */
export const PIPELINE_CONCURRENCY = 3;

/**
 * 파이프라인이 통째로 중단됐을 때 남는 페이지 실패 사유.
 *
 * 🚫 내부 예외 메시지를 담지 않는다 — 이 값은 `GET /sessions/:id/pages` 응답의
 *    `errorMessage` 로 사용자 브라우저까지 나간다.
 */
const PIPELINE_ABORTED_MESSAGE = '만들기가 중단됐어요. 다시 시도해 주세요.';
/** 개별 페이지 실패 사유. 사용자에게 노출되므로 내부 오류 원문을 저장하지 않는다. */
const PAGE_IMAGE_FAILURE_MESSAGE = '그림을 만들지 못했어요. 잠시 후 다시 시도해 주세요.';

@Injectable()
export class StorySessionService implements OnModuleInit {
  private readonly logger = new Logger(StorySessionService.name);
  /** 서명 URL 실패 로그 억제기 — 폴링 경로에서 불리므로 간격 제한이 필수다. */
  private readonly presignFailLog = createLogThrottle(60_000);
  /** 템플릿 삽화 누락 로그 억제기 — 키를 잘못 옮기면 페이지 수만큼 한꺼번에 찍힌다. */
  private readonly templateMissLog = createLogThrottle(60_000);

  constructor(
    @InjectRepository(StorySession)
    private readonly sessionRepo: Repository<StorySession>,
    @InjectRepository(StoryTemplate)
    private readonly templateRepo: Repository<StoryTemplate>,
    @InjectRepository(StoryPage)
    private readonly pageRepo: Repository<StoryPage>,
    @InjectRepository(StoryPageCharacter)
    private readonly pageCharacterRepo: Repository<StoryPageCharacter>,
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
    // ⚠️ `@Optional()` 은 **기존 spec 들이 이 클래스를 positional 로 직접 생성**하기 때문이다
    //    (`new StorySessionService(repoA, repoB, ...)`). 필수로 두면 그 호출이 전부 깨진다.
    //    운영에서는 `StorySessionModule` 이 `NotificationModule` 을 import 해 반드시 주입된다.
    @Optional()
    @Inject(NOTIFICATION_PORT)
    private readonly notifications?: NotificationPort,
    @Optional()
    private readonly cleanupService?: StorageCleanupService,
    @Optional()
    @InjectRepository(StoryPageChat)
    private readonly pageChatRepo?: Repository<StoryPageChat>,
    @Optional()
    private readonly authService?: AuthService,
  ) {}

  onModuleInit(): void {
    if (this.authService) {
      this.authService.registerCleanupHandler(async (userId: number) => {
        await this.deleteAllUserSessions(userId);
      });
    }
  }

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

    const afterStoryPages = pages.filter(
      (page) => page.pageNo === 6 && (page.branchKey === 'a' || page.branchKey === 'b'),
    );
    const appearances: StoryPageCharacter[] =
      afterStoryPages.length === 0
        ? []
        : ((await this.pageCharacterRepo.find({
            where: { pageId: In(afterStoryPages.map((page) => page.id)) },
            relations: { character: true },
            order: { id: 'ASC' },
          })) ?? []);
    const charactersByPage = new Map<number, StoryPageCharacter[]>();
    for (const appearance of appearances) {
      const pageCharacters = charactersByPage.get(appearance.pageId);
      if (pageCharacters) {
        pageCharacters.push(appearance);
      } else {
        charactersByPage.set(appearance.pageId, [appearance]);
      }
    }

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
        imageUrl:
          image?.status === 'succeeded' && image.imageKey
            ? await this.getOptionalPresignedUrl(image.imageKey)
            : null,
        narrationAudioUrl: await this.getNarrationAudioUrl(page.narrationAudioKey),
        errorMessage: image?.errorMessage ?? null,
        characters: (charactersByPage.get(page.id) ?? []).map((appearance) => ({
          role: appearance.character.role,
          displayName: appearance.character.displayName,
          hitbox: appearance.hitbox,
        })),
      };
    });

    return {
      sessionId,
      firstBranchChoice: firstChoice?.branchKey ?? null,
      choices: (await Promise.all(result)) as AfterStoryResponse['choices'],
    };
  }

  private async getNarrationAudioUrl(key: string | null): Promise<string | null> {
    if (key === null) return null;
    try {
      return await this.storagePort.getPresignedUrl(key);
    } catch {
      return null;
    }
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
    try {
      await branchRepo.save(created);
    } catch (error: unknown) {
      // 위 `findOne` 과 이 `save` 사이에 다른 기기가 먼저 골랐다. `uq_session_branch_choices_session`
      // 위반은 곧 "이미 첫 선택이 있다" 이므로, 500 이 아니라 **위 분기와 같은 답**을 내야 한다.
      if (!isMysqlDuplicateKey(error)) throw error;
      const raced = await branchRepo.findOne({ where: { sessionId } });
      if (!raced) throw error;
      if (raced.branchKey !== input.branchKey) throw new FirstBranchAlreadyChosenErrorResponseDto();
      return { sessionId, branchKey: raced.branchKey, isFirstChoice: false };
    }
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
        referenceImageUrl = await this.getOptionalPresignedUrl(existing.referenceImageKey);
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

    const sessionIds = sessions.map((session) => session.id);
    const thumbnailImages: SessionPageImage[] =
      sessionIds.length === 0
        ? []
        : ((await this.pageImageRepo.find({
            where: {
              sessionId: In(sessionIds),
              pageNo: 1,
              branchKey: 'common',
              status: 'succeeded',
            },
          })) ?? []);
    const thumbnailKeyBySession = new Map(
      thumbnailImages
        .filter((image): image is SessionPageImage & { imageKey: string } => Boolean(image.imageKey))
        .map((image) => [image.sessionId, image.imageKey]),
    );

    return Promise.all(
      sessions.map(async (s) => {
        let referenceImageUrl: string | null = null;
        if (s.referenceImageKey) {
          referenceImageUrl = await this.getOptionalPresignedUrl(s.referenceImageKey);
        }
        const thumbnailImageKey = thumbnailKeyBySession.get(s.id);
        const thumbnailImageUrl = thumbnailImageKey
          ? await this.getOptionalPresignedUrl(thumbnailImageKey)
          : null;
        return {
          id: s.id,
          templateId: s.templateId,
          templateSlug: s.template?.slug ?? '',
          templateTitle: s.template?.title ?? '',
          status: s.status,
          referenceImageUrl,
          thumbnailImageUrl,
          createdAt: s.createdAt.toISOString(),
          updatedAt: s.updatedAt.toISOString(),
        };
      }),
    );
  }

  /**
   * 서명 실패를 `null` 로 격리한다 — **조회 경로의 기본값이다.**
   *
   * 삽화 URL 하나를 못 만드는 것과 목록·폴링 응답 전체가 500 이 되는 것은 사용자에게
   * 전혀 다른 일이다. 앞은 그림 한 칸이 비는 것이고, 뒤는 화면이 통째로 죽는 것이다.
   * 🚫 업로드 직후 URL 반환처럼 **그 URL 이 응답의 목적인 곳**에는 쓰지 않는다 —
   *    거기서 조용히 `null` 을 주면 사용자는 성공했다고 오해한다.
   */
  private async getOptionalPresignedUrl(key: string): Promise<string | null> {
    try {
      return await this.storagePort.getPresignedUrl(key);
    } catch (error: unknown) {
      // ⚠️ 이 경로는 **3초 폴링 안의 페이지 루프**에서 불린다(`getSessionPages`).
      //    스토리지가 죽으면 폴링 1회당 페이지 수만큼 찍히고, 레플리카 3개가 함께 찍는다.
      //    🚫 그대로 두면 lessons 2026-08-26 과 같은 로그 폭증이 된다 — 반드시 스로틀을 낀다.
      const { log, suppressed } = this.presignFailLog.consume(Date.now());
      if (log) {
        const omitted = suppressed > 0 ? ` (직전 1분간 동일 실패 ${suppressed}건 생략)` : '';
        this.logger.warn(`서명 URL 발급 실패(해당 항목만 비운다): ${key}${omitted} — ${error}`);
      }
      return null;
    }
  }

  /**
   * 세션 삭제 (초기화 및 다른 얼굴로 새로 만들기용)
   *
   * ⚠️ **스토리지 삭제는 트랜잭션 밖이다.** 안에 두면 DB 커밋 **전에** 객체가 지워져,
   * 커밋이 실패했을 때 세션 행은 살아 있는데 삽화만 사라진다 — 서재에 동화가 남고
   * 그림이 전부 깨진 상태가 된다. 스토리지는 롤백되지 않으므로 **DB 가 확정된 뒤에만** 지운다.
   * 삭제 실패 시 영속 정리 작업(cleanupService)에 기록되어 멱등하게 재시도된다.
   */
  async deleteSession(userId: number, sessionId: string): Promise<void> {
    const storageKeys = await this.deleteSessionRows(userId, sessionId);

    if (this.cleanupService) {
      await this.cleanupService.cleanupKeys(storageKeys);
    } else {
      await Promise.all(
        storageKeys.map((key) =>
          this.storagePort.delete(key).catch((error: unknown) => {
            this.logger.warn(`스토리지 객체 삭제 실패(고아로 남는다): ${key} — ${error}`);
          }),
        ),
      );
    }
  }

  /**
   * 사용자의 모든 세션과 개인 스토리지 객체를 삭제한다 (회원 탈퇴용).
   */
  async deleteAllUserSessions(userId: number): Promise<void> {
    const sessions = await this.sessionRepo.find({ where: { userId } });
    for (const session of sessions) {
      await this.deleteSession(userId, session.id);
    }
  }

  /**
   * 세션의 DB 행만 지우고, 지워야 할 스토리지 키를 돌려준다.
   *
   * 페이지 이미지 → 세션 두 테이블을 지운다. 중간에 끊기면 "지웠는데 목록에 남는" 상태가
   * 되므로 한 트랜잭션으로 묶는다 (컨텍스트는 main.ts 의 initializeTransactionalContext).
   */
  @Transactional()
  private async deleteSessionRows(userId: number, sessionId: string): Promise<string[]> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session || session.userId !== userId) {
      throw new SessionNotFoundErrorResponseDto();
    }

    // 지울 스토리지 키를 **행을 지우기 전에** 모아 둔다.
    // 1. 실사 원본 (임시 보관 중인 경우)
    // 2. AI 레퍼런스 이미지
    // 3. 생성된 개인화 삽화들
    // 4. 캐릭터 대화 음성 MP3들
    const pageImages = await this.pageImageRepo.find({ where: { sessionId } });
    const pageChats = this.pageChatRepo
      ? await this.pageChatRepo.find({ where: { sessionId } })
      : [];

    const storageKeys = [
      session.sourcePhotoKey,
      session.referenceImageKey,
      ...pageImages.map((img) => img.imageKey),
      ...pageChats.map((chat) => chat.replyAudioKey),
    ].filter((key): key is string => typeof key === 'string' && key.trim().length > 0);

    // 1. 해당 세션의 페이지 이미지 레코드 삭제
    await this.pageImageRepo.delete({ sessionId });

    // 2. 세션 레코드 삭제 (story_page_chats 등은 FK CASCADE 처리됨)
    await this.sessionRepo.delete({ id: sessionId });

    this.logger.log(`동화 세션 삭제 완료: ${sessionId} (사용자 ${userId})`);

    return storageKeys;
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

    // 3. 임시 실사 원본 저장 (temp/source-photo/{sessionId}/{uuid}.{ext})
    const ext =
      frontFile.mimetype?.includes('jpeg') || frontFile.mimetype?.includes('jpg') ? 'jpg' : 'png';

    this.logger.log(
      `[uploadFace] 실제 얼굴 사진을 임시 원본으로 등록합니다: 세션 ${session.id}`,
    );
    const tempKey = `temp/source-photo/${session.id}/${randomUUID()}.${ext}`;
    const s3Key = await this.storagePort.upload(
      tempKey,
      frontFile.buffer,
      frontFile.mimetype || 'image/png',
    );

    const prevKeyToDelete = session.sourcePhotoKey;
    session.sourcePhotoKey = s3Key;
    session.referenceImageKey = null;
    // 명세 3절 5항: 임시 원본에는 어떤 API도 서명 URL 또는 직접 접근 URL을 발급하지 않는다.
    const referenceImageUrl = null;

    // 6. 세션 상태 갱신
    session.status = 'face_ready';
    await this.sessionRepo.save(session);

    // 사진 재업로드(교체) 시 이전 객체 정리 (명세 3절 6항)
    if (prevKeyToDelete) {
      if (this.cleanupService) {
        await this.cleanupService.cleanupKey(prevKeyToDelete);
      } else {
        this.storagePort.delete(prevKeyToDelete).catch(() => {});
      }
    }

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
      try {
        await this.pageImageRepo.save(newPageImage);
      } catch (error: unknown) {
        // 위 `find` 와 이 `save` 사이에 다른 요청(버튼 연타·다른 레플리카)이 같은 행을 넣으면
        // `uq_session_page_images_session_page_branch` 를 위반한다. **그건 정상 경합이다** —
        // 이 API 는 멱등하다고 선언했으므로(위 주석) 500 을 내지 않고 넘어간다.
        // back-code-patterns §14 「조회해서 없으면 저장으로 막지 않는다」.
        if (!isMysqlDuplicateKey(error)) throw error;
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
          imageUrl = await this.getOptionalPresignedUrl(pageImg.imageKey);
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
      if (!session) {
        this.logger.error(`파이프라인 중단: 세션(${sessionId}) 부재`);
        return;
      }

      // 명세 확정: 실사 단일 모드(sourcePhotoKey) 우선 적용, 레거시 세션은 referenceImageKey 폴백
      const faceKey = session.sourcePhotoKey || session.referenceImageKey;
      if (!faceKey) {
        this.logger.error(`파이프라인 중단: 세션(${sessionId}) 레퍼런스/실사 이미지 부재`);
        return;
      }

      const refBuffer = await this.storagePort.download(faceKey);
      const templatePages = await this.pageRepo.find({
        where: { templateId: session.templateId },
        order: { pageNo: 'ASC' },
      });

      // Qwen Image 3 요청 하나는 템플릿+인물 레퍼런스 2장만 사용한다.
      // 배치 청크(Head-of-Line Blocking) 대신 슬라이딩 윈도우 워커 풀을 사용한다:
      // 먼저 끝난 슬롯이 생기면 대기 중인 다음 페이지를 즉시 투입하여 전체 생성 시간을 대폭 단축한다.
      const queue = [...templatePages];
      const workerCount = Math.min(PIPELINE_CONCURRENCY, queue.length);

      const workers = Array.from({ length: workerCount }, async () => {
        while (queue.length > 0) {
          const tplPage = queue.shift();
          if (!tplPage) break;

          // 이 페이지를 내가 처리해도 되는지 DB 에 원자적으로 묻는다.
          // 남이 집었거나 이미 끝났으면 조용히 건너뛴다.
          const claimed = await this.claimPage(sessionId, tplPage.pageNo, tplPage.branchKey);
          if (!claimed) continue;

          const pageImg = await this.pageImageRepo.findOne({
            where: { sessionId, pageNo: tplPage.pageNo, branchKey: tplPage.branchKey },
          });
          if (!pageImg) continue;

          try {
            // 템플릿 기본 삽화가 등록되어 있으면 참조용으로 주입
            let baseImageBuffer: Buffer | undefined;
            if (tplPage.baseImageKey) {
              try {
                baseImageBuffer = await this.storagePort.download(tplPage.baseImageKey);
              } catch {
                // 생성은 계속하되 **조용히 넘기지 않는다.** 템플릿이 없으면 어댑터가
                // 텍스트만으로 그려(`openrouter-image.adapter.ts` 의 baseImage 없는 분기)
                // **구도가 전혀 다른 그림**이 나오는데, 상태는 `succeeded` 로 남아
                // 아무도 알아채지 못한다. 키를 옮길 때(예: png → webp) 실수가 여기로 떨어진다.
                if (this.templateMissLog.consume(Date.now()).log) {
                  this.logger.warn(
                    `템플릿 삽화를 받지 못해 참조 없이 생성한다 — 키: ${tplPage.baseImageKey}`,
                  );
                }
              }
            }

            const characterCostume = this.getCostumePrompt(tplPage.personaTargetRole);

            const generatedBuffer = await this.imagePort.generatePageIllustration({
              referenceImage: refBuffer,
              baseImage: baseImageBuffer,
              prompt: tplPage.illustrationPrompt || tplPage.bodyText,
              characterPrompt: characterCostume,
            });

            const { buffer: uploadBuffer, mimeType: uploadMime, ext } =
              await this.convertToWebp(generatedBuffer);
            const key = `personalizations/${sessionId}/${tplPage.branchKey}/page-${tplPage.pageNo}-${randomUUID()}.${ext}`;
            const s3Key = await this.storagePort.upload(key, uploadBuffer, uploadMime);

            pageImg.imageKey = s3Key;
            pageImg.status = 'succeeded';
            pageImg.errorMessage = null;
            await this.pageImageRepo.save(pageImg);
            this.logger.log(`페이지 ${tplPage.pageNo} 삽화 개인화 완료: ${s3Key}`);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            pageImg.status = 'failed';
            pageImg.errorMessage = PAGE_IMAGE_FAILURE_MESSAGE;
            await this.pageImageRepo.save(pageImg);
            this.logger.error(`페이지 ${tplPage.pageNo} 삽화 개인화 실패: ${msg}`);
          }
        }
      });

      await Promise.all(workers);

      await this.checkAndUpdateSessionCompletion(session.id);
    } catch (error: unknown) {
      this.logger.error(`개인화 파이프라인 전체 오류: ${error}`);
      // 🚫 로그만 남기고 끝내지 않는다. 여기서 빠져나오면 세션이 `generating` 인 채로 굳어
      //    폴링이 영원히 끝나지 않고, 페이지가 전부 `pending` 이라 `retryStoryPage` 도
      //    거절해(`status !== 'failed' && status !== 'running'`) **복구 경로가 통째로 막힌다.**
      await this.markPipelineFailed(sessionId);
    }
  }

  /**
   * 파이프라인이 중단됐음을 상태로 남긴다 — 사용자가 실패를 보고 재시도할 수 있게.
   *
   * `pending` 만 `failed` 로 옮긴다. `running` 은 다른 레플리카가 지금 집고 있을 수 있어
   * 건드리지 않는다 — 그쪽은 `STALE_RUNNING_MS` 회수가 맡는다.
   * 🚫 여기서 다시 던지지 않는다. 이 함수는 이미 실패한 경로의 뒤처리다.
   */
  private async markPipelineFailed(sessionId: string): Promise<void> {
    try {
      await this.pageImageRepo.update(
        { sessionId, status: 'pending' },
        { status: 'failed', errorMessage: PIPELINE_ABORTED_MESSAGE },
      );
      // 로드한 엔티티를 `save` 하지 않는다 — 동시에 도는 `uploadFace` 의 변경을 덮을 수 있다.
      await this.sessionRepo.update({ id: sessionId }, { status: 'failed' });

      // 사용자 한 명의 제작이 통째로 실패한 것이다. 반복되면 업스트림·스토리지 장애를 의심한다.
      // 🚫 `userId`·세션 소유자를 넣지 않는다 — 외부 채널로 나가는 값이다(개인정보).
      this.notifications?.notify({
        severity: 'warning',
        title: '동화 제작 파이프라인 중단',
        summary:
          '한 세션의 개인화가 중단되어 실패로 표시했습니다. 짧은 시간에 반복되면 외부 의존(이미지 API·스토리지)을 확인하세요.',
        dedupeKey: 'story-session:pipeline-aborted',
        // 5분. 여러 세션이 연달아 실패하는 상황을 한 건으로 묶어 본다.
        dedupeTtlSeconds: 300,
      });
    } catch (error: unknown) {
      this.logger.error(`파이프라인 실패 상태 기록에 실패했다: 세션 ${sessionId} — ${error}`);
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
      if (!session) return;

      // 실사 단일 모드(sourcePhotoKey)를 쓰는 새 세션도 재시도할 수 있어야 한다.
      // 얼굴 키가 전혀 없을 때는 페이지 claim이나 외부 이미지 호출 없이 안전하게 끝낸다.
      const faceKey = session.sourcePhotoKey || session.referenceImageKey;
      if (!faceKey) {
        this.logger.error(`단일 페이지 재시도 중단: 세션(${sessionId}) 레퍼런스/실사 이미지 부재`);
        return;
      }

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

      try {
        // 이 다운로드도 재시도 작업의 일부다. try 밖에 두면 실패 시 페이지가 running 에
        // 남아 stale 회수 전까지 다시 시도할 수 없게 된다.
        const refBuffer = await this.storagePort.download(faceKey);
        let baseImageBuffer: Buffer | undefined;
        if (tplPage.baseImageKey) {
          try {
            baseImageBuffer = await this.storagePort.download(tplPage.baseImageKey);
          } catch {
            // 위 일괄 경로와 같은 이유로 조용히 넘기지 않는다.
            if (this.templateMissLog.consume(Date.now()).log) {
              this.logger.warn(
                `템플릿 삽화를 받지 못해 참조 없이 생성한다 — 키: ${tplPage.baseImageKey}`,
              );
            }
          }
        }

        const characterCostume = this.getCostumePrompt(tplPage.personaTargetRole);

        const generatedBuffer = await this.imagePort.generatePageIllustration({
          referenceImage: refBuffer,
          baseImage: baseImageBuffer,
          prompt: tplPage.illustrationPrompt || tplPage.bodyText,
          characterPrompt: characterCostume,
        });

        const { buffer: uploadBuffer, mimeType: uploadMime, ext } =
          await this.convertToWebp(generatedBuffer);
        const key = `personalizations/${sessionId}/${tplPage.branchKey}/page-${tplPage.pageNo}-${randomUUID()}.${ext}`;
        const s3Key = await this.storagePort.upload(key, uploadBuffer, uploadMime);

        pageImg.imageKey = s3Key;
        pageImg.status = 'succeeded';
        pageImg.errorMessage = null;
        await this.pageImageRepo.save(pageImg);
        this.logger.log(`단일 페이지 ${pageNo} 재시도 완료: ${s3Key}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        pageImg.status = 'failed';
        pageImg.errorMessage = PAGE_IMAGE_FAILURE_MESSAGE;
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
      const sourcePhotoToDelete = session.sourcePhotoKey;
      if (sourcePhotoToDelete) {
        session.sourcePhotoKey = null;
      }
      await this.sessionRepo.save(session);

      if (sourcePhotoToDelete) {
        if (this.cleanupService) {
          await this.cleanupService.cleanupKey(sourcePhotoToDelete);
        } else {
          this.storagePort.delete(sourcePhotoToDelete).catch(() => {});
        }
      }
      this.logger.log(`동화 세션 전체 완료 (completed) 및 임시 실사 원본 삭제: 세션 ${sessionId}`);
    } else {
      const anyFailed = pageImages.some((img) => img.status === 'failed');
      if (anyFailed) {
        session.status = 'failed';
        await this.sessionRepo.save(session);
      }
    }
  }

  private async convertToWebp(buffer: Buffer): Promise<{ buffer: Buffer; mimeType: string; ext: string }> {
    try {
      const webpBuffer = await convertImageToWebp(buffer);
      return { buffer: webpBuffer, mimeType: 'image/webp', ext: 'webp' };
    } catch (err) {
      this.logger.warn(`WebP 변환 실패, 원본 포맷을 유지합니다: ${err}`);
      return { buffer, mimeType: 'image/png', ext: 'png' };
    }
  }
}
