import { asRepository, createMockRepository, type MockRepository } from '@common/__spec__/mock-repository';
import { StorySession } from '@entities/story-session.entity';
import { StoryTemplate, STORY_TEMPLATE_STATUS } from '@entities/story-template.entity';
import { StoryNotFoundErrorResponseDto } from '@modules/story/dto/story.error.dto';
import {
  FaceRequiredErrorResponseDto,
  InvalidImageFormatErrorResponseDto,
  SessionNotFoundErrorResponseDto,
  StoryAlreadyCompletedErrorResponseDto,
} from './dto/story-session-error.dto';
import { StorySessionService } from './story-session.service';
import type { ImageGenerationPort } from '../../common/port/image-generation.port';
import type { StoragePort } from '../../common/port/storage.port';

const VALID_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

describe('StorySessionService', () => {
  let sessionRepo: MockRepository<StorySession>;
  let templateRepo: MockRepository<StoryTemplate>;
  let mockImagePort: jest.Mocked<ImageGenerationPort>;
  let mockStoragePort: jest.Mocked<StoragePort>;
  let service: StorySessionService;

  beforeEach(() => {
    sessionRepo = createMockRepository<StorySession>();
    templateRepo = createMockRepository<StoryTemplate>();

    mockImagePort = {
      generateReference: jest.fn().mockResolvedValue(Buffer.from('mock-reference-image-bytes')),
    };

    mockStoragePort = {
      upload: jest.fn().mockResolvedValue('references/session-1/ref.png'),
      getPresignedUrl: jest.fn().mockResolvedValue('https://storage.local/references/session-1/ref.png'),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    service = new StorySessionService(
      asRepository(sessionRepo),
      asRepository(templateRepo),
      mockImagePort,
      mockStoragePort,
    );
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

    it('정상 얼굴 사진 업로드 시 레퍼런스를 생성하고 S3에 저장 후 presigned URL을 반환한다', async () => {
      const validFile = { buffer: VALID_JPEG } as unknown as Express.Multer.File;
      const session = {
        id: 'session-123',
        userId: 1,
        status: 'draft',
        referenceImageKey: null,
      } as unknown as StorySession;
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.save.mockResolvedValue(session);

      const result = await service.uploadFace(1, 'session-123', { front: [validFile] });

      expect(mockImagePort.generateReference).toHaveBeenCalledWith({
        front: VALID_JPEG,
        left: undefined,
        right: undefined,
      });
      expect(mockStoragePort.upload).toHaveBeenCalled();
      expect(mockStoragePort.getPresignedUrl).toHaveBeenCalled();
      expect(result.status).toBe('face_ready');
      expect(result.referenceImageUrl).toBe('https://storage.local/references/session-1/ref.png');
      expect(session.status).toBe('face_ready');
    });
  });
});
