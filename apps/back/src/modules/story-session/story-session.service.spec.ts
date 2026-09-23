import {
  asRepository,
  createMockRepository,
  mockUpdateQueryBuilder,
  type MockRepository,
} from '@common/__spec__/mock-repository';
import {
  createStoryCharacter,
  createStoryPage,
  createStoryPageCharacter,
} from '@entities/__spec__/entity.factory';
import { StorySession } from '@entities/story-session.entity';
import { StoryTemplate, STORY_TEMPLATE_STATUS } from '@entities/story-template.entity';
import { StoryPage } from '@entities/story-page.entity';
import { StoryPageCharacter } from '@entities/story-page-character.entity';
import { SessionPageImage } from '@entities/session-page-image.entity';
import { StoryAfterStoryChoice } from '@entities/story-after-story-choice.entity';
import { SessionBranchChoice } from '@entities/session-branch-choice.entity';
import { StoryPageChat } from '@entities/story-page-chat.entity';
import { StorageCleanupService } from '@common/storage/storage-cleanup.service';
import { StoryNotFoundErrorResponseDto } from '@modules/story/dto/story.error.dto';
import {
  FaceNotReadyErrorResponseDto,
  FaceRequiredErrorResponseDto,
  InvalidImageFormatErrorResponseDto,
  PageNotFoundErrorResponseDto,
  PageNotFailedErrorResponseDto,
  SessionNotFoundErrorResponseDto,
  StoryAlreadyCompletedErrorResponseDto,
  FirstBranchAlreadyChosenErrorResponseDto,
} from './dto/story-session-error.dto';
import { StorySessionService } from './story-session.service';
import type { DataSource } from 'typeorm';
import { addTransactionalDataSource, deleteDataSourceByName } from 'typeorm-transactional';
import sharp from 'sharp';
import type { ImageGenerationPort } from '../../common/port/image-generation.port';
import type { StoragePort } from '../../common/port/storage.port';

const VALID_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

describe('StorySessionService', () => {
  let sessionRepo: MockRepository<StorySession>;
  let templateRepo: MockRepository<StoryTemplate>;
  let pageRepo: MockRepository<StoryPage>;
  let pageCharacterRepo: MockRepository<StoryPageCharacter>;
  let pageImageRepo: MockRepository<SessionPageImage>;
  let afterStoryChoiceRepo: MockRepository<StoryAfterStoryChoice>;
  let branchChoiceRepo: MockRepository<SessionBranchChoice>;
  let pageChatRepo: MockRepository<StoryPageChat>;
  let mockCleanupService: {
    cleanupKey: jest.Mock;
    cleanupKeys: jest.Mock;
    recordTask: jest.Mock;
    processPendingTasks: jest.Mock;
  };
  let mockImagePort: jest.Mocked<ImageGenerationPort>;
  let mockStoragePort: jest.Mocked<StoragePort>;
  let service: StorySessionService;

  // `deleteSession` 의 `@Transactional()` 은 레지스트리에서 DataSource 를 찾아
  // `dataSource.transaction(cb)` 를 부른다. 단위 테스트는 mock repository 만 쓰므로 실제
  // 트랜잭션도 EntityManager 도 필요 없다 — 콜백을 그대로 실행하는 스텁을 `patch: false` 로
  // 등록해 래퍼만 통과시킨다.
  // 🚫 진짜 `DataSource` 를 만들지 않는다 — 생성자가 드라이버를 들며 `mysql2` 를 로드해
  //    forbid-db 스텁에 걸린다 (test/setup/forbid-db.ts).
  beforeAll(() => {
    deleteDataSourceByName('default');
    addTransactionalDataSource({
      name: 'default',
      dataSource: {
        transaction: <T>(cb: (em: unknown) => Promise<T>): Promise<T> => cb({}),
      } as unknown as DataSource,
      patch: false,
    });
  });

  afterAll(() => {
    deleteDataSourceByName('default');
  });

  beforeEach(() => {
    sessionRepo = createMockRepository<StorySession>();
    templateRepo = createMockRepository<StoryTemplate>();
    pageRepo = createMockRepository<StoryPage>();
    pageCharacterRepo = createMockRepository<StoryPageCharacter>();
    pageImageRepo = createMockRepository<SessionPageImage>();
    afterStoryChoiceRepo = createMockRepository<StoryAfterStoryChoice>();
    branchChoiceRepo = createMockRepository<SessionBranchChoice>();
    pageChatRepo = createMockRepository<StoryPageChat>();
    pageCharacterRepo.find.mockResolvedValue([]);
    pageChatRepo.find.mockResolvedValue([]);

    mockImagePort = {
      generateReference: jest.fn().mockResolvedValue(Buffer.from('mock-reference-image-bytes')),
      generatePageIllustration: jest.fn().mockResolvedValue(Buffer.from('mock-page-image-bytes')),
    };

    mockStoragePort = {
      upload: jest.fn().mockResolvedValue('references/session-1/ref.png'),
      getPresignedUrl: jest.fn().mockResolvedValue('https://storage.local/references/session-1/ref.png'),
      download: jest.fn().mockResolvedValue(Buffer.from('mock-downloaded-bytes')),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    mockCleanupService = {
      cleanupKey: jest.fn().mockImplementation(async (key: string) => {
        try {
          await mockStoragePort.delete(key);
        } catch {
          // 실 서비스와 동일하게 swallow하고 영속 큐에 기록하는 동작을 모방
        }
      }),
      cleanupKeys: jest.fn().mockImplementation(async (keys: string[]) => {
        await Promise.allSettled(
          keys.map(async (k) => {
            try {
              await mockStoragePort.delete(k);
            } catch {
              // 실 서비스와 동일하게 swallow
            }
          }),
        );
      }),
      recordTask: jest.fn().mockResolvedValue({}),
      processPendingTasks: jest.fn().mockResolvedValue(0),
    };

    service = new StorySessionService(
      asRepository(sessionRepo),
      asRepository(templateRepo),
      asRepository(pageRepo),
      asRepository(pageCharacterRepo),
      asRepository(pageImageRepo),
      mockImagePort,
      mockStoragePort,
      undefined,
      asRepository(afterStoryChoiceRepo),
      asRepository(branchChoiceRepo),
      undefined,
      mockCleanupService as unknown as StorageCleanupService,
      asRepository(pageChatRepo),
    );
  });

  describe('비하인드 분기', () => {
    const session = { id: 'session-123', userId: 1, templateId: 10 } as StorySession;

    it('A/B 선택지·개인화 상태·최초 선택을 함께 반환한다', async () => {
      sessionRepo.findOne.mockResolvedValue(session);
      afterStoryChoiceRepo.find.mockResolvedValue([
        { branchKey: 'a', title: 'A', description: 'A 설명' },
        { branchKey: 'b', title: 'B', description: 'B 설명' },
      ] as StoryAfterStoryChoice[]);
      pageRepo.find.mockResolvedValue([
        { id: 61, pageNo: 6, branchKey: 'a', bodyText: 'A 결과', narrationAudioKey: 'a.mp3' },
        { id: 62, pageNo: 6, branchKey: 'b', bodyText: 'B 결과', narrationAudioKey: 'b.mp3' },
      ] as StoryPage[]);
      pageCharacterRepo.find.mockResolvedValue([
        createStoryPageCharacter({
          id: 1,
          pageId: 61,
          character: createStoryCharacter({ role: 'jack', displayName: '잭', persona: '비공개' }),
          hitbox: { x: 0.2, y: 0.3, width: 0.3, height: 0.54 },
        }),
        createStoryPageCharacter({
          id: 2,
          pageId: 62,
          character: createStoryCharacter({
            role: 'goose',
            displayName: '요술 거위',
            ttsVoiceId: 'secret-voice',
          }),
          hitbox: { x: 0.05, y: 0.61, width: 0.29, height: 0.3 },
        }),
      ]);
      pageImageRepo.find.mockResolvedValue([
        { pageNo: 6, branchKey: 'a', status: 'succeeded', imageKey: 'a.png', errorMessage: null },
        { pageNo: 6, branchKey: 'b', status: 'failed', imageKey: null, errorMessage: '실패' },
      ] as SessionPageImage[]);
      branchChoiceRepo.findOne.mockResolvedValue({ branchKey: 'a' } as SessionBranchChoice);

      const result = await service.getAfterStory(1, 'session-123');

      expect(result.firstBranchChoice).toBe('a');
      expect(result.choices[0]).toMatchObject({ branchKey: 'a', bodyText: 'A 결과', imageUrl: expect.any(String) });
      expect(result.choices[1]).toMatchObject({ branchKey: 'b', status: 'failed', errorMessage: '실패' });
      expect(result.choices.map((choice) => choice.characters)).toEqual([
        [
          {
            role: 'jack',
            displayName: '잭',
            hitbox: { x: 0.2, y: 0.3, width: 0.3, height: 0.54 },
          },
        ],
        [
          {
            role: 'goose',
            displayName: '요술 거위',
            hitbox: { x: 0.05, y: 0.61, width: 0.29, height: 0.3 },
          },
        ],
      ]);
      expect(pageCharacterRepo.find).toHaveBeenCalledTimes(1);
      expect(result.choices.map((choice) => choice.narrationAudioUrl)).toEqual([
        'https://storage.local/references/session-1/ref.png',
        'https://storage.local/references/session-1/ref.png',
      ]);
    });

    it('비하인드 낭독 URL 하나의 발급 실패가 A/B 응답 전체를 막지 않는다', async () => {
      sessionRepo.findOne.mockResolvedValue(session);
      afterStoryChoiceRepo.find.mockResolvedValue([
        { branchKey: 'a', title: 'A', description: 'A 설명' },
        { branchKey: 'b', title: 'B', description: 'B 설명' },
      ] as StoryAfterStoryChoice[]);
      pageRepo.find.mockResolvedValue([
        { id: 61, pageNo: 6, branchKey: 'a', bodyText: 'A 결과', narrationAudioKey: 'a.mp3' },
        { id: 62, pageNo: 6, branchKey: 'b', bodyText: 'B 결과', narrationAudioKey: 'b.mp3' },
      ] as StoryPage[]);
      pageImageRepo.find.mockResolvedValue([]);
      branchChoiceRepo.findOne.mockResolvedValue(null);
      mockStoragePort.getPresignedUrl
        .mockRejectedValueOnce(new Error('storage unavailable'))
        .mockResolvedValueOnce('https://storage.local/b.mp3');

      await expect(service.getAfterStory(1, 'session-123')).resolves.toMatchObject({
        choices: [
          { branchKey: 'a', narrationAudioUrl: null },
          { branchKey: 'b', narrationAudioUrl: 'https://storage.local/b.mp3' },
        ],
      });
    });

    it('최초 선택을 저장하고 같은 선택은 멱등 처리한다', async () => {
      sessionRepo.findOne.mockResolvedValue(session);
      branchChoiceRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ branchKey: 'a' } as SessionBranchChoice);

      await expect(service.selectAfterStoryChoice(1, 'session-123', { branchKey: 'a' })).resolves.toMatchObject({ isFirstChoice: true });
      await expect(service.selectAfterStoryChoice(1, 'session-123', { branchKey: 'a' })).resolves.toMatchObject({ isFirstChoice: false });
    });

    it('다른 최초 선택으로 덮어쓰려 하면 409 도메인 오류를 던진다', async () => {
      sessionRepo.findOne.mockResolvedValue(session);
      branchChoiceRepo.findOne.mockResolvedValue({ branchKey: 'a' } as SessionBranchChoice);

      await expect(service.selectAfterStoryChoice(1, 'session-123', { branchKey: 'b' })).rejects.toThrow(
        FirstBranchAlreadyChosenErrorResponseDto,
      );
    });
  });

  describe('createOrResumeSession', () => {
    it('동화가 없거나 미공개면 StoryNotFoundErrorResponseDto(404)를 던진다', async () => {
      templateRepo.findOne.mockResolvedValue(null);

      await expect(service.createOrResumeSession(1, 'non-existent')).rejects.toThrow(
        StoryNotFoundErrorResponseDto,
      );
    });

    it('이미 완성(completed)된 동화는 409 (StoryAlreadyCompletedErrorResponseDto)를 던진다', async () => {
      templateRepo.findOne.mockResolvedValue({ id: 10, slug: 'cloud-village', status: STORY_TEMPLATE_STATUS.PUBLISHED } as unknown as StoryTemplate);
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-123',
        userId: 1,
        templateId: 10,
        status: 'completed',
      } as unknown as StorySession);

      await expect(service.createOrResumeSession(1, 'cloud-village')).rejects.toThrow(
        StoryAlreadyCompletedErrorResponseDto,
      );
    });

    it('미완료 세션이 이미 존재하면 새 세션을 만들지 않고 기존 세션을 반환한다 (Idempotent Resume)', async () => {
      templateRepo.findOne.mockResolvedValue({ id: 10, slug: 'cloud-village', status: STORY_TEMPLATE_STATUS.PUBLISHED } as unknown as StoryTemplate);
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-123',
        userId: 1,
        templateId: 10,
        status: 'draft',
        referenceImageKey: null,
        createdAt: new Date('2026-09-08T00:00:00Z'),
        updatedAt: new Date('2026-09-08T00:00:00Z'),
      } as unknown as StorySession);

      const result = await service.createOrResumeSession(1, 'cloud-village');

      expect(result.id).toBe('session-123');
      expect(result.status).toBe('draft');
      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it('세션이 없으면 새로 생성하여 draft 상태로 반환한다', async () => {
      templateRepo.findOne.mockResolvedValue({ id: 10, slug: 'cloud-village', status: STORY_TEMPLATE_STATUS.PUBLISHED } as unknown as StoryTemplate);
      sessionRepo.findOne.mockResolvedValue(null);
      sessionRepo.save.mockImplementation(async (entity) => ({
        ...entity,
        createdAt: new Date('2026-09-08T00:00:00Z'),
        updatedAt: new Date('2026-09-08T00:00:00Z'),
      }));

      const result = await service.createOrResumeSession(1, 'cloud-village');

      expect(result.templateSlug).toBe('cloud-village');
      expect(result.status).toBe('draft');
      expect(sessionRepo.save).toHaveBeenCalled();
    });
  });

  describe('getMySessions', () => {
    it('완료 세션의 1쪽 공통 성공 이미지를 한 번에 조회해 썸네일 URL로 반환한다', async () => {
      sessionRepo.find.mockResolvedValue([
        {
          id: 'session-1',
          userId: 1,
          templateId: 10,
          status: 'completed',
          referenceImageKey: 'references/session-1/ref.png',
          template: { id: 10, slug: 'red-riding-hood', title: '빨간 모자' } as unknown as StoryTemplate,
          createdAt: new Date('2026-09-08T00:00:00Z'),
          updatedAt: new Date('2026-09-08T01:00:00Z'),
        } as unknown as StorySession,
      ]);
      pageImageRepo.find.mockResolvedValue([
        {
          sessionId: 'session-1',
          pageNo: 1,
          branchKey: 'common',
          status: 'succeeded',
          imageKey: 'sessions/session-1/page-1.png',
        } as SessionPageImage,
      ]);
      mockStoragePort.getPresignedUrl.mockImplementation(async (key) => `https://storage.local/${key}`);

      const result = await service.getMySessions(1);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('session-1');
      expect(result[0].templateSlug).toBe('red-riding-hood');
      expect(result[0].referenceImageUrl).toBe('https://storage.local/references/session-1/ref.png');
      expect(result[0].thumbnailImageUrl).toBe(
        'https://storage.local/sessions/session-1/page-1.png',
      );
      expect(mockStoragePort.getPresignedUrl).toHaveBeenCalledWith('references/session-1/ref.png');
      expect(pageImageRepo.find).toHaveBeenCalledTimes(1);
      expect(pageImageRepo.find).toHaveBeenCalledWith({
        where: {
          sessionId: expect.anything(),
          pageNo: 1,
          branchKey: 'common',
          status: 'succeeded',
        },
      });
    });

    it('미완료·키 누락·서명 실패 썸네일을 null로 격리해 목록 전체를 반환한다', async () => {
      sessionRepo.find.mockResolvedValue([
        {
          id: 'session-good',
          userId: 1,
          templateId: 10,
          status: 'completed',
          referenceImageKey: null,
          template: { slug: 'good', title: '성공' },
          createdAt: new Date('2026-09-08T03:00:00Z'),
          updatedAt: new Date('2026-09-08T03:00:00Z'),
        },
        {
          id: 'session-no-key',
          userId: 1,
          templateId: 11,
          status: 'completed',
          referenceImageKey: null,
          template: { slug: 'no-key', title: '키 없음' },
          createdAt: new Date('2026-09-08T02:00:00Z'),
          updatedAt: new Date('2026-09-08T02:00:00Z'),
        },
        {
          id: 'session-sign-fail',
          userId: 1,
          templateId: 12,
          status: 'completed',
          referenceImageKey: null,
          template: { slug: 'sign-fail', title: '서명 실패' },
          createdAt: new Date('2026-09-08T01:00:00Z'),
          updatedAt: new Date('2026-09-08T01:00:00Z'),
        },
        {
          id: 'session-generating',
          userId: 1,
          templateId: 13,
          status: 'generating',
          referenceImageKey: null,
          template: { slug: 'generating', title: '생성 중' },
          createdAt: new Date('2026-09-08T00:00:00Z'),
          updatedAt: new Date('2026-09-08T00:00:00Z'),
        },
      ] as StorySession[]);
      pageImageRepo.find.mockResolvedValue([
        {
          sessionId: 'session-good',
          imageKey: 'sessions/session-good/page-1.png',
        },
        {
          sessionId: 'session-no-key',
          imageKey: null,
        },
        {
          sessionId: 'session-sign-fail',
          imageKey: 'sessions/session-sign-fail/page-1.png',
        },
      ] as SessionPageImage[]);
      mockStoragePort.getPresignedUrl.mockImplementation(async (key) => {
        if (key.includes('sign-fail')) throw new Error('storage unavailable');
        return `https://storage.local/${key}`;
      });

      await expect(service.getMySessions(1)).resolves.toEqual([
        expect.objectContaining({
          id: 'session-good',
          thumbnailImageUrl: 'https://storage.local/sessions/session-good/page-1.png',
        }),
        expect.objectContaining({ id: 'session-no-key', thumbnailImageUrl: null }),
        expect.objectContaining({ id: 'session-sign-fail', thumbnailImageUrl: null }),
        expect.objectContaining({ id: 'session-generating', thumbnailImageUrl: null }),
      ]);
      expect(pageImageRepo.find).toHaveBeenCalledTimes(1);
    });

    it('세션이 없으면 썸네일 이미지를 조회하지 않는다', async () => {
      sessionRepo.find.mockResolvedValue([]);

      const result = await service.getMySessions(1);

      expect(result).toEqual([]);
      expect(pageImageRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('deleteSession', () => {
    it('세션이 존재하지 않거나 소유자가 다르면 SessionNotFoundErrorResponseDto(404)를 던진다', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteSession(1, 'non-existent')).rejects.toThrow(
        SessionNotFoundErrorResponseDto,
      );
    });

    it('세션이 존재하면 페이지 이미지와 세션을 삭제한다', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-1',
        userId: 1,
      } as unknown as StorySession);
      pageImageRepo.find.mockResolvedValue([]);

      await service.deleteSession(1, 'session-1');

      expect(pageImageRepo.delete).toHaveBeenCalledWith({ sessionId: 'session-1' });
      expect(sessionRepo.delete).toHaveBeenCalledWith({ id: 'session-1' });
    });

    // ⭐ DB 행만 지우면 레퍼런스·삽화 객체가 스토리지에 영원히 남는다. 사용자가 "다른 얼굴로
    //    다시 만들기" 를 눌러도 **이전 얼굴에서 파생된 이미지가 계속 보관된다.**
    it('임시 실사·레퍼런스·삽화·대화 음성 객체를 모두 수집해 스토리지에서 삭제한다 ⭐', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-1',
        userId: 1,
        sourcePhotoKey: 'temp/source-photo/session-1/photo.jpg',
        referenceImageKey: 'references/session-1/ref.png',
      } as unknown as StorySession);
      pageImageRepo.find.mockResolvedValue([
        { imageKey: 'personalizations/session-1/common/page-1.webp' },
        { imageKey: null },
      ] as unknown as SessionPageImage[]);
      pageChatRepo.find.mockResolvedValue([
        { replyAudioKey: 'chat-audio/session-1/reply-1.mp3' },
        { replyAudioKey: null },
      ] as unknown as StoryPageChat[]);

      await service.deleteSession(1, 'session-1');

      expect(mockCleanupService.cleanupKeys).toHaveBeenCalledWith([
        'temp/source-photo/session-1/photo.jpg',
        'references/session-1/ref.png',
        'personalizations/session-1/common/page-1.webp',
        'chat-audio/session-1/reply-1.mp3',
      ]);
      expect(mockStoragePort.delete).toHaveBeenCalledWith('temp/source-photo/session-1/photo.jpg');
      expect(mockStoragePort.delete).toHaveBeenCalledWith('references/session-1/ref.png');
      expect(mockStoragePort.delete).toHaveBeenCalledWith(
        'personalizations/session-1/common/page-1.webp',
      );
      expect(mockStoragePort.delete).toHaveBeenCalledWith('chat-audio/session-1/reply-1.mp3');
    });

    it('스토리지 삭제가 실패해도 DB 삭제를 되돌리지 않는다', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-1',
        userId: 1,
        referenceImageKey: 'references/session-1/ref.png',
      } as unknown as StorySession);
      pageImageRepo.find.mockResolvedValue([]);
      mockStoragePort.delete.mockRejectedValue(new Error('스토리지 다운'));

      // 스토리지는 롤백되지 않는다 — 지워진 것을 되살리는 쪽이 더 나쁘다.
      await expect(service.deleteSession(1, 'session-1')).resolves.toBeUndefined();
      expect(sessionRepo.delete).toHaveBeenCalledWith({ id: 'session-1' });
    });

    it('deleteAllUserSessions는 사용자의 모든 세션을 순회하며 삭제한다', async () => {
      const deleteSessionSpy = jest.spyOn(service, 'deleteSession').mockResolvedValue(undefined);
      sessionRepo.find.mockResolvedValue([
        { id: 'session-1', userId: 1 },
        { id: 'session-2', userId: 1 },
      ] as StorySession[]);

      await service.deleteAllUserSessions(1);

      expect(deleteSessionSpy).toHaveBeenCalledWith(1, 'session-1');
      expect(deleteSessionSpy).toHaveBeenCalledWith(1, 'session-2');
      deleteSessionSpy.mockRestore();
    });
  });

  describe('uploadFace', () => {
    it('정면 사진이 없으면 FaceRequiredErrorResponseDto(400)를 던진다', async () => {
      await expect(
        service.uploadFace(1, 'session-123', { front: [] }),
      ).rejects.toThrow(FaceRequiredErrorResponseDto);
    });

    it('위조된 파일은 InvalidImageFormatErrorResponseDto(400)를 던진다', async () => {
      const fakeFile = { buffer: Buffer.from('not an image file') } as unknown as Express.Multer.File;

      await expect(
        service.uploadFace(1, 'session-123', { front: [fakeFile] }),
      ).rejects.toThrow(InvalidImageFormatErrorResponseDto);
    });

    it('세션이 없거나 다른 사용자 소유면 SessionNotFoundErrorResponseDto(404)를 던진다', async () => {
      const validFile = { buffer: VALID_JPEG } as unknown as Express.Multer.File;
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(
        service.uploadFace(1, 'session-not-found', { front: [validFile] }),
      ).rejects.toThrow(SessionNotFoundErrorResponseDto);
    });

    it('기본 동작: 정상 얼굴 사진 업로드 시 실사 원본을 temp/source-photo/에 임시 저장하고 서명 URL을 발급하지 않는다 ⭐', async () => {
      const validFile = { buffer: VALID_JPEG, mimetype: 'image/jpeg' } as unknown as Express.Multer.File;
      const session = {
        id: 'session-123',
        userId: 1,
        status: 'draft',
        sourcePhotoKey: null,
        referenceImageKey: null,
      } as unknown as StorySession;
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockResolvedValue(session);
      mockStoragePort.upload.mockResolvedValueOnce('temp/source-photo/session-123/photo.jpg');

      const result = await service.uploadFace(1, 'session-123', { front: [validFile] });

      expect(mockImagePort.generateReference).not.toHaveBeenCalled();
      expect(mockStoragePort.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^temp\/source-photo\/session-123\/.+\.jpg$/),
        VALID_JPEG,
        'image/jpeg',
      );
      expect(session.sourcePhotoKey).toBe('temp/source-photo/session-123/photo.jpg');
      expect(session.referenceImageKey).toBeNull();
      expect(result.status).toBe('face_ready');
      expect(result.referenceImageUrl).toBeNull();
      expect(session.status).toBe('face_ready');
    });

    it('사진 교체 시 이전 sourcePhotoKey를 정리한다', async () => {
      const validFile = { buffer: VALID_JPEG } as unknown as Express.Multer.File;
      const session = {
        id: 'session-direct',
        userId: 1,
        status: 'draft',
        sourcePhotoKey: 'temp/source-photo/session-direct/old.jpg',
        referenceImageKey: null,
      } as unknown as StorySession;
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockResolvedValue(session);
      mockStoragePort.upload.mockResolvedValueOnce('temp/source-photo/session-direct/new.jpg');

      await service.uploadFace(1, 'session-direct', { front: [validFile] });

      expect(mockCleanupService.cleanupKey).toHaveBeenCalledWith(
        'temp/source-photo/session-direct/old.jpg',
      );
      expect(session.sourcePhotoKey).toBe('temp/source-photo/session-direct/new.jpg');
    });
  });

  describe('personalizeSession', () => {
    it('세션이 없거나 다른 사용자 소유면 SessionNotFoundErrorResponseDto(404)를 던진다', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(service.personalizeSession(1, 'non-existent')).rejects.toThrow(
        SessionNotFoundErrorResponseDto,
      );
    });

    it('얼굴 등록 전(draft) 상태면 FaceNotReadyErrorResponseDto(400)를 던진다', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-123',
        userId: 1,
        status: 'draft',
      } as unknown as StorySession);

      await expect(service.personalizeSession(1, 'session-123')).rejects.toThrow(
        FaceNotReadyErrorResponseDto,
      );
    });

    it('이미 completed 상태면 바로 완료 상태를 반환한다', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-123',
        userId: 1,
        templateId: 10,
        status: 'completed',
      } as unknown as StorySession);
      pageRepo.find.mockResolvedValue([
        { id: 1, pageNo: 1, branchKey: 'common' } as unknown as StoryPage,
        { id: 2, pageNo: 2, branchKey: 'common' } as unknown as StoryPage,
      ]);

      const result = await service.personalizeSession(1, 'session-123');

      expect(result.status).toBe('completed');
      expect(result.totalPages).toBe(2);
      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it('face_ready 상태면 페이지별 레코드를 준비하고 generating 상태로 전환한다', async () => {
      const session = {
        id: 'session-123',
        userId: 1,
        templateId: 10,
        status: 'face_ready',
        referenceImageKey: 'ref-key',
      } as unknown as StorySession;
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockResolvedValue(session);
      pageRepo.find.mockResolvedValue([
        { id: 1, templateId: 10, pageNo: 1, characterRole: 'main', basePrompt: 'p1' } as unknown as StoryPage,
        { id: 2, templateId: 10, pageNo: 2, characterRole: 'main', basePrompt: 'p2' } as unknown as StoryPage,
      ]);
      pageImageRepo.find.mockResolvedValue([]);
      pageImageRepo.create.mockImplementation((dto) => dto as unknown as SessionPageImage);
      pageImageRepo.save.mockImplementation(async (entity) => entity as unknown as SessionPageImage);

      const result = await service.personalizeSession(1, 'session-123');

      expect(result.status).toBe('generating');
      expect(result.totalPages).toBe(2);
      expect(pageImageRepo.save).toHaveBeenCalledTimes(2);
      expect(session.status).toBe('generating');
    });
  });

  describe('getSessionPages', () => {
    it('세션이 없으면 SessionNotFoundErrorResponseDto(404)를 던진다', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(service.getSessionPages(1, 'session-123')).rejects.toThrow(
        SessionNotFoundErrorResponseDto,
      );
    });

    it('페이지별 진행 상태와 성공한 이미지의 서명 URL을 함께 반환한다', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-123',
        userId: 1,
        templateId: 10,
        status: 'generating',
        updatedAt: new Date('2026-09-08T00:00:00Z'),
      } as unknown as StorySession);
      pageRepo.find.mockResolvedValue([
        { id: 1, pageNo: 1, branchKey: 'common' } as unknown as StoryPage,
        { id: 2, pageNo: 2, branchKey: 'common' } as unknown as StoryPage,
      ]);
      pageImageRepo.find.mockResolvedValue([
        {
          sessionId: 'session-123',
          pageNo: 1,
          branchKey: 'common',
          status: 'succeeded',
          imageKey: 'pages/p1.png',
          updatedAt: new Date('2026-09-08T00:01:00Z'),
        } as unknown as SessionPageImage,
        {
          sessionId: 'session-123',
          pageNo: 2,
          branchKey: 'common',
          status: 'pending',
          imageKey: null,
          updatedAt: new Date('2026-09-08T00:00:00Z'),
        } as unknown as SessionPageImage,
      ]);

      const result = await service.getSessionPages(1, 'session-123');

      expect(result.totalPages).toBe(2);
      expect(result.completedPages).toBe(1);
      expect(result.isMainStoryReady).toBe(false);
      expect(result.isAllCompleted).toBe(false);
      expect(result.pages[0].status).toBe('succeeded');
      expect(result.pages[0].imageUrl).toBe('https://storage.local/references/session-1/ref.png');
      expect(result.pages[1].status).toBe('pending');
      expect(result.pages[1].imageUrl).toBeNull();
    });
  });

  describe('retryPage', () => {
    it('세션이 없으면 SessionNotFoundErrorResponseDto(404)를 던진다', async () => {
      sessionRepo.findOne.mockResolvedValue(null);

      await expect(service.retryPage(1, 'session-123', 1)).rejects.toThrow(
        SessionNotFoundErrorResponseDto,
      );
    });

    it('페이지 레코드가 없으면 PageNotFoundErrorResponseDto(404)를 던진다', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-123',
        userId: 1,
      } as unknown as StorySession);
      pageImageRepo.findOne.mockResolvedValue(null);

      await expect(service.retryPage(1, 'session-123', 1)).rejects.toThrow(
        PageNotFoundErrorResponseDto,
      );
    });

    it('실패(failed) 상태가 아닌 페이지를 재시도하면 PageNotFailedErrorResponseDto(400)를 던진다', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-123',
        userId: 1,
      } as unknown as StorySession);
      pageImageRepo.findOne.mockResolvedValue({
        sessionId: 'session-123',
        pageNo: 1,
        status: 'succeeded',
      } as SessionPageImage);

      await expect(service.retryPage(1, 'session-123', 1)).rejects.toThrow(
        PageNotFailedErrorResponseDto,
      );
    });

    // 레플리카 3개: 살아 있는 작업을 재시도로 빼앗으면 같은 삽화가 두 번 생성된다(유료 2회).
    it('다른 인스턴스가 생성 중인(running) 페이지는 재시도를 거절한다 ⭐', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-123',
        userId: 1,
      } as unknown as StorySession);
      pageImageRepo.findOne.mockResolvedValue({
        sessionId: 'session-123',
        pageNo: 1,
        status: 'running',
        updatedAt: new Date(), // 방금 갱신됨 = 살아 있다
      } as SessionPageImage);

      await expect(service.retryPage(1, 'session-123', 1)).rejects.toThrow(
        PageNotFailedErrorResponseDto,
      );
      expect(pageImageRepo.save).not.toHaveBeenCalled();
    });

    it('오래 멈춘(고아) running 페이지는 재시도를 허용한다', async () => {
      const session = { id: 'session-123', userId: 1 } as unknown as StorySession;
      const pageImg = {
        sessionId: 'session-123',
        pageNo: 1,
        status: 'running',
        // 4분 전 — STALE_RUNNING_MS(3분)를 넘겨 고아로 판정된다.
        updatedAt: new Date(Date.now() - 4 * 60 * 1000),
        errorMessage: null,
      } as SessionPageImage;

      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockResolvedValue(session);
      pageImageRepo.findOne.mockResolvedValue(pageImg);
      pageImageRepo.save.mockResolvedValue(pageImg);

      const result = await service.retryPage(1, 'session-123', 1);

      expect(result.status).toBe('pending');
      expect(pageImg.status).toBe('pending');
    });

    it('실패한 페이지를 재시도하면 상태를 pending으로 바꾸고 재생성을 시작한다', async () => {
      const session = {
        id: 'session-123',
        userId: 1,
        status: 'failed',
      } as unknown as StorySession;
      const pageImg = {
        sessionId: 'session-123',
        pageNo: 1,
        status: 'failed',
        errorMessage: 'Generation failed',
      } as SessionPageImage;

      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockResolvedValue(session);
      pageImageRepo.findOne.mockResolvedValue(pageImg);
      pageImageRepo.save.mockResolvedValue(pageImg);

      const result = await service.retryPage(1, 'session-123', 1);

      expect(result.pageNo).toBe(1);
      expect(result.status).toBe('pending');
      expect(pageImg.status).toBe('pending');
      expect(pageImg.errorMessage).toBeNull();
      expect(session.status).toBe('generating');
    });
  });

  describe('executeSinglePagePersonalization', () => {
    it('referenceImageKey 없이 sourcePhotoKey만 있는 실사 세션도 재시도해 성공으로 저장한다', async () => {
      const sourcePhotoKey = 'temp/source-photo/session-direct/photo.jpg';
      const session = {
        id: 'session-direct',
        templateId: 10,
        status: 'generating',
        sourcePhotoKey,
        referenceImageKey: null,
      } as unknown as StorySession;
      const pageImg = {
        id: 'page-image-1',
        sessionId: session.id,
        pageNo: 1,
        branchKey: 'common',
        status: 'running',
        imageKey: null,
        errorMessage: 'OpenRouter 요청 실패',
      } as unknown as SessionPageImage;

      sessionRepo.findOne.mockResolvedValue(session);
      pageRepo.findOne.mockResolvedValue({
        templateId: 10,
        pageNo: 1,
        branchKey: 'common',
        baseImageKey: null,
        illustrationPrompt: '빨간 망토를 입은 아이',
      } as unknown as StoryPage);
      pageImageRepo.findOne.mockResolvedValue(pageImg);
      pageImageRepo.save.mockImplementation(async (entity) => entity as SessionPageImage);
      pageRepo.find.mockResolvedValue([
        { templateId: 10, pageNo: 1, branchKey: 'common' } as StoryPage,
      ]);
      pageImageRepo.find.mockResolvedValue([pageImg]);

      await service.executeSinglePagePersonalization(session.id, 1);

      expect(mockStoragePort.download).toHaveBeenCalledWith(sourcePhotoKey);
      expect(mockImagePort.generatePageIllustration).toHaveBeenCalledWith(
        expect.objectContaining({ referenceImage: Buffer.from('mock-downloaded-bytes') }),
      );
      expect(pageImg.status).toBe('succeeded');
      expect(pageImg.errorMessage).toBeNull();
      expect(pageImageRepo.save).toHaveBeenCalledWith(pageImg);
    });

    it('sourcePhotoKey와 referenceImageKey가 모두 없으면 외부 호출 없이 안전하게 끝낸다', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-without-face',
        templateId: 10,
        sourcePhotoKey: null,
        referenceImageKey: null,
      } as unknown as StorySession);

      await service.executeSinglePagePersonalization('session-without-face', 1);

      expect(pageRepo.findOne).not.toHaveBeenCalled();
      expect(pageImageRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(mockStoragePort.download).not.toHaveBeenCalled();
      expect(mockImagePort.generatePageIllustration).not.toHaveBeenCalled();
      expect(pageImageRepo.save).not.toHaveBeenCalled();
    });

    it('실사 원본 사진을 내려받지 못하면 페이지를 failed로 저장한다', async () => {
      const session = {
        id: 'session-source-download-failed',
        templateId: 10,
        sourcePhotoKey: 'temp/source-photo/session-source-download-failed/photo.jpg',
        referenceImageKey: null,
      } as unknown as StorySession;
      const pageImg = {
        id: 'page-image-source-download-failed',
        sessionId: session.id,
        pageNo: 1,
        branchKey: 'common',
        status: 'running',
        imageKey: null,
        errorMessage: null,
      } as unknown as SessionPageImage;

      sessionRepo.findOne.mockResolvedValue(session);
      pageRepo.findOne.mockResolvedValue({
        templateId: 10,
        pageNo: 1,
        branchKey: 'common',
        baseImageKey: null,
      } as unknown as StoryPage);
      pageImageRepo.findOne.mockResolvedValue(pageImg);
      pageImageRepo.save.mockImplementation(async (entity) => entity as SessionPageImage);
      pageRepo.find.mockResolvedValue([
        { templateId: 10, pageNo: 1, branchKey: 'common' } as StoryPage,
      ]);
      pageImageRepo.find.mockResolvedValue([pageImg]);
      mockStoragePort.download.mockRejectedValue(new Error('source photo unavailable'));

      await service.executeSinglePagePersonalization(session.id, 1);

      expect(mockImagePort.generatePageIllustration).not.toHaveBeenCalled();
      expect(pageImg.status).toBe('failed');
      expect(pageImg.errorMessage).toBe('그림을 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
      expect(pageImg.errorMessage).not.toContain('source photo unavailable');
      expect(pageImageRepo.save).toHaveBeenCalledWith(pageImg);
    });
  });

  // E1 회귀 방지: 레플리카 3개에서 같은 페이지가 두 번 생성되면 유료 API 가 중복 호출된다.
  // 판정은 인메모리가 아니라 `claimPage` 의 조건부 UPDATE(= affected 행 수)가 한다.
  describe('executePersonalizationPipeline — 레플리카 간 중복 생성 방지', () => {
    const session = {
      id: 'session-1',
      userId: 1,
      templateId: 10,
      referenceImageKey: 'references/session-1/ref.png',
    } as StorySession;

    beforeEach(() => {
      sessionRepo.findOne.mockResolvedValue(session);
      pageRepo.find.mockResolvedValue([
        createStoryPage({ templateId: 10, pageNo: 1, branchKey: 'common', baseImageKey: null }),
      ]);
      pageImageRepo.find.mockResolvedValue([]);
      pageImageRepo.findOne.mockResolvedValue({
        id: 'img-1',
        sessionId: 'session-1',
        pageNo: 1,
        branchKey: 'common',
        status: 'running',
        imageKey: null,
        errorMessage: null,
      } as SessionPageImage);
      pageImageRepo.save.mockImplementation((entity: unknown) => Promise.resolve(entity));
    });

    // ⭐ 선행 단계(레퍼런스 다운로드 등)가 실패하면 예전에는 로그만 남고 끝났다. 그러면
    //    세션은 `generating`, 페이지는 전부 `pending` 으로 굳어 폴링이 영원히 끝나지 않고,
    //    `retryStoryPage` 는 `pending` 을 거절해(`status !== 'failed' && !== 'running'`)
    //    **복구 경로가 통째로 막힌다.** 실패를 상태로 남기는 것이 이 테스트의 불변 조건이다.
    it('선행 단계가 실패하면 세션과 대기 페이지를 failed 로 남겨 재시도 경로를 연다 ⭐', async () => {
      mockStoragePort.download.mockRejectedValue(new Error('스토리지에 닿지 못했다'));

      await service.executePersonalizationPipeline('session-1');

      // `running` 은 건드리지 않는다 — 다른 레플리카가 집고 있을 수 있어 회수에 맡긴다.
      expect(pageImageRepo.update).toHaveBeenCalledWith(
        { sessionId: 'session-1', status: 'pending' },
        expect.objectContaining({ status: 'failed' }),
      );
      expect(sessionRepo.update).toHaveBeenCalledWith({ id: 'session-1' }, { status: 'failed' });
    });

    it('실패 사유에 내부 예외 메시지를 담지 않는다', async () => {
      mockStoragePort.download.mockRejectedValue(new Error('ECONNREFUSED 10.0.0.5:9000'));

      await service.executePersonalizationPipeline('session-1');

      const [, patch] = pageImageRepo.update.mock.calls[0] as [unknown, { errorMessage: string }];
      // 이 값은 `GET /sessions/:id/pages` 응답으로 사용자 브라우저까지 나간다.
      expect(patch.errorMessage).not.toContain('ECONNREFUSED');
    });

    it('다른 레플리카가 이미 집어간 페이지는 이미지를 생성하지 않는다 ⭐', async () => {
      // affected 0 = "내가 집지 못했다"
      pageImageRepo.createQueryBuilder.mockReturnValue(mockUpdateQueryBuilder(0));

      await service.executePersonalizationPipeline('session-1');

      expect(mockImagePort.generatePageIllustration).not.toHaveBeenCalled();
      expect(mockStoragePort.upload).not.toHaveBeenCalled();
    });

    it('집을 수 있는 페이지는 WebP로 변환해 정확히 한 번 업로드한다', async () => {
      const generatedPng = await sharp({
        create: {
          width: 64,
          height: 48,
          channels: 4,
          background: { r: 80, g: 120, b: 200, alpha: 1 },
        },
      })
        .png()
        .toBuffer();
      mockImagePort.generatePageIllustration.mockResolvedValueOnce(generatedPng);
      pageImageRepo.createQueryBuilder.mockReturnValue(mockUpdateQueryBuilder(1));

      await service.executePersonalizationPipeline('session-1');

      expect(mockImagePort.generatePageIllustration).toHaveBeenCalledTimes(1);
      const [key, uploadedBuffer, mimeType] = mockStoragePort.upload.mock.calls[0];
      expect(key).toMatch(/^personalizations\/session-1\/common\/page-1-.+\.webp$/);
      expect(mimeType).toBe('image/webp');
      await expect(sharp(uploadedBuffer).metadata()).resolves.toMatchObject({
        format: 'webp',
        width: 64,
        height: 48,
      });
    });

    it('WebP 변환 실패 시 원본 PNG로 폴백해 업로드한다', async () => {
      pageImageRepo.createQueryBuilder.mockReturnValue(mockUpdateQueryBuilder(1));

      await service.executePersonalizationPipeline('session-1');

      expect(mockStoragePort.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^personalizations\/session-1\/common\/page-1-.+\.png$/),
        Buffer.from('mock-page-image-bytes'),
        'image/png',
      );
    });

    it('모든 페이지 생성이 완료되면 sourcePhotoKey를 스토리지에서 삭제하고 DB를 null로 갱신한다 ⭐', async () => {
      const sessionWithSource = {
        id: 'session-1',
        status: 'generating',
        userId: 1,
        templateId: 10,
        referenceImageKey: 'references/session-1/ref.png',
        sourcePhotoKey: 'temp/source-photo/session-1/photo.jpg',
      } as StorySession;
      sessionRepo.findOne.mockResolvedValue(sessionWithSource);
      pageRepo.find.mockResolvedValue([{ pageNo: 1, branchKey: 'common' }] as StoryPage[]);
      pageImageRepo.find.mockResolvedValue([
        { sessionId: 'session-1', pageNo: 1, branchKey: 'common', status: 'succeeded' } as SessionPageImage,
      ]);
      pageImageRepo.createQueryBuilder.mockReturnValue(mockUpdateQueryBuilder(1));

      await service.executePersonalizationPipeline('session-1');

      expect(sessionWithSource.status).toBe('completed');
      expect(sessionWithSource.sourcePhotoKey).toBeNull();
      expect(sessionRepo.save).toHaveBeenCalledWith(sessionWithSource);
      expect(mockCleanupService.cleanupKey).toHaveBeenCalledWith('temp/source-photo/session-1/photo.jpg');
    });

    it('다수의 페이지가 주어졌을 때 슬라이딩 윈도우 풀로 동시성 한도를 넘지 않고 전체를 생성한다 ⭐', async () => {
      const pages = [
        createStoryPage({ templateId: 10, pageNo: 1, branchKey: 'common', baseImageKey: null }),
        createStoryPage({ templateId: 10, pageNo: 2, branchKey: 'common', baseImageKey: null }),
        createStoryPage({ templateId: 10, pageNo: 3, branchKey: 'common', baseImageKey: null }),
        createStoryPage({ templateId: 10, pageNo: 4, branchKey: 'common', baseImageKey: null }),
        createStoryPage({ templateId: 10, pageNo: 5, branchKey: 'common', baseImageKey: null }),
      ];
      pageRepo.find.mockResolvedValue(pages);
      pageImageRepo.createQueryBuilder.mockReturnValue(mockUpdateQueryBuilder(1));

      let activeCount = 0;
      let maxActiveCount = 0;

      mockImagePort.generatePageIllustration.mockImplementation(async () => {
        activeCount++;
        if (activeCount > maxActiveCount) {
          maxActiveCount = activeCount;
        }
        await new Promise((resolve) => setTimeout(resolve, 15));
        activeCount--;
        return Buffer.from('mock-png');
      });

      await service.executePersonalizationPipeline('session-1');

      expect(mockImagePort.generatePageIllustration).toHaveBeenCalledTimes(5);
      // PIPELINE_CONCURRENCY = 4 이하로만 동시 실행되었는지 증명
      expect(maxActiveCount).toBeLessThanOrEqual(4);
    });
  });
});
